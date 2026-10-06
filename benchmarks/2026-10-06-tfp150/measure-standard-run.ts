// TFP-150 (Phase 38 Decision 8): times one Standard run, all ten areas,
// fast mode, read-only gate, one worker, and keeps what it produced.
// Run from the root of the tree under test (the repo for "after", a
// worktree at d90de57 for "before"), so that tree's own generator,
// inspector and fixture are used:
//   node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types <this> <label> <origin|fixture> <outDir> <path>...
// Playwright is called with the executor's own arguments (chromium,
// --timeout=30000, JSON report), except --workers=1 where the app's fast
// mode would use 4.
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const load = (path: string) => import(pathToFileURL(join(root, path)).href);
const { mockGenerate } = await load("src/lib/generate/mock/index.ts");
const { normalizeContentRules, normalizeTestAuditMode } = await load("src/lib/generate/normalize.ts");
const { inspectPages } = await load("src/lib/introspect/inspector.ts");
const { flattenSuites } = await load("src/lib/report/execution.ts");

const [label, target, outDir, ...paths] = process.argv.slice(2);
const AREAS = ["functional", "responsive/mobile", "performance/load", "security", "accessibility", "usability", "seo/content", "cookie/session", "database", "reliability"];
const BUDGET_MS = 1_800_000; // the executor's maxTimeout; recorded against, not enforced
const HARD_STOP_MS = 3 * BUDGET_MS; // only so a hung run cannot go on for ever
await mkdir(outDir, { recursive: true });

async function freePort() {
    const server = createServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    return port;
}

let fixture: ReturnType<typeof spawn> | null = null;
let origin = target;
if (target === "fixture") {
    const port = await freePort();
    fixture = spawn(process.execPath, ["scripts/comparison-fixture.mjs", "--port", String(port)], { cwd: root, stdio: "ignore", windowsHide: true });
    origin = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 50; i++) {
        try { await fetch(`${origin}/__fixture/reset`); break; } catch { await new Promise((r) => setTimeout(r, 100)); }
    }
}

try {
    const t0 = Date.now();
    const inspection = await inspectPages(origin, paths);
    const profile = { scannedAt: new Date().toISOString(), baseUrl: origin, ...inspection };
    const t1 = Date.now();
    const code: string = mockGenerate(origin, "Check the site.", AREAS, profile, normalizeContentRules({ paths }), normalizeTestAuditMode("fast"));
    const t2 = Date.now();
    await writeFile(join(outDir, `${label}-profile.json`), JSON.stringify(profile, null, 2), "utf8");
    await writeFile(join(outDir, `${label}-suite.spec.ts`), code, "utf8");

    const runs = join(root, ".playwright-runs");
    await mkdir(runs, { recursive: true });
    const name = `tfp150-${label}-${process.pid}`;
    const jsonFile = join(runs, `${name}.json`);
    await writeFile(join(runs, `${name}.spec.ts`), code, "utf8");
    const env: NodeJS.ProcessEnv = { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: jsonFile, FORCE_COLOR: "0", TESTFORGE_INTERACTIVE: "0" };
    delete env.TESTFORGE_STORAGE_STATE;
    const started = Date.now();
    let hardStopped = false;
    await new Promise<void>((resolve, reject) => {
        const child = spawn(process.execPath, [join(root, "node_modules", "playwright", "cli.js"), "test", `.playwright-runs/${name}.spec.ts`, "--reporter=json", "--timeout=30000", "--workers=1", "--project=chromium", `--output=.playwright-runs/${name}-artifacts`], { cwd: root, env, stdio: "ignore", windowsHide: true });
        const timer = setTimeout(() => { hardStopped = true; child.kill(); }, HARD_STOP_MS);
        child.on("error", reject);
        child.on("close", () => { clearTimeout(timer); resolve(); });
    });
    const runMs = Date.now() - started;
    const json = JSON.parse(await readFile(jsonFile, "utf8"));
    await writeFile(join(outDir, `${label}-report.json`), JSON.stringify(json), "utf8");
    await rm(join(runs, `${name}.spec.ts`), { force: true });
    await rm(jsonFile, { force: true });
    await rm(join(runs, `${name}-artifacts`), { recursive: true, force: true });

    const records = flattenSuites(json.suites ?? []) as Array<{ title: string; status: string; rawMessage: string; page?: string; gate?: string; category?: string; skipReason?: string }>;
    const byStatus: Record<string, number> = {};
    for (const r of records) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    const lines = [
        `${label}: ${origin} paths ${paths.join(" ")}; commit ${process.env.MEASURE_COMMIT ?? "?"}; ${new Date(started).toISOString()}`,
        `inspection ${Math.round((t1 - t0) / 1000)} s, generation ${Math.round((t2 - t1) / 1000)} s, run ${Math.round(runMs / 1000)} s (budget ${BUDGET_MS / 1000} s: ${runMs > BUDGET_MS ? "OVER" : "within"}${hardStopped ? "; HARD-STOPPED" : ""}); playwright duration ${Math.round((json.stats?.duration ?? 0) / 1000)} s`,
        `${records.length} tests ${JSON.stringify(byStatus)}`,
        "failed:",
        ...records.filter((r) => r.status === "Failed" || r.status === "Blocked").map((r) => `  [${r.status}] ${r.title} | ${(r.rawMessage ?? "").replace(/\s+/g, " ").slice(0, 300)}`),
    ];
    await writeFile(join(outDir, `${label}-summary.txt`), lines.join("\n") + "\n", "utf8");
    console.log(lines.slice(0, 3).join("\n"));
} finally {
    fixture?.kill();
}
