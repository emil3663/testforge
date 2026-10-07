// TFP-175: TFP-154's run driver (benchmarks/2026-10-06-toolshop-known-bugs/
// run-tfp154.ts), unchanged except that Standard now runs every page it is
// given - the automatic selection, up to 8 types - where TFP-154 took the
// first 5. One run on one site - Standard (all ten areas, fast, the pages
// inspected first, as the app does) or a Comprehensive area (every page
// given). Read-only gate, one worker, Chromium, the executor's own
// Playwright arguments. Keeps the suite, Playwright's JSON report, and every
// record (status, findings, issues, message) for scoring.
// Usage (from the repo root):
//   node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types <this> <label> <site> <standard|security|accessibility> <outDir> <path>...
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const load = (path: string) => import(pathToFileURL(join(root, path)).href);
const { mockGenerate } = await load("src/lib/generate/mock/index.ts");
const { normalizeContentRules, normalizeTestAuditMode } = await load("src/lib/generate/normalize.ts");
const { inspectPages } = await load("src/lib/introspect/inspector.ts");
const { buildComprehensiveSuite } = await load("src/lib/generate/comprehensive.ts");
const { normalizeRunMode } = await load("src/lib/comprehensive/run-mode.ts");
const { flattenSuites } = await load("src/lib/report/execution.ts");

const [label, site, kind, outDir, ...paths] = process.argv.slice(2);
const origin = site.replace(/\/$/, "");
// A page that isn't a path (a shell rewrote it into a file path) would be visited as a file, not on the site.
const notPaths = paths.filter((path) => !path.startsWith("/"));
if (notPaths.length > 0) throw new Error(`not page paths, refusing to run: ${notPaths.join(", ")}`);
const AREAS = ["functional", "responsive/mobile", "performance/load", "security", "accessibility", "usability", "seo/content", "cookie/session", "database", "reliability"];
await mkdir(outDir, { recursive: true });

const t0 = Date.now();
let code: string;
if (kind === "standard") {
    // Phase 40 (TFP-172): the selected pages, all of them.
    const standardPaths = paths;
    const inspection = await inspectPages(origin, standardPaths);
    const profile = { scannedAt: new Date().toISOString(), baseUrl: origin, ...inspection };
    await writeFile(join(outDir, `${label}-profile.json`), JSON.stringify(profile, null, 2), "utf8");
    code = mockGenerate(origin, "Check the site.", AREAS, profile, normalizeContentRules({ paths: standardPaths }), normalizeTestAuditMode("fast"));
} else {
    const mode = normalizeRunMode({ kind: "comprehensive", area: kind });
    code = buildComprehensiveSuite(origin, mode, { covered: paths, notCovered: [], pageCap: 20 });
}
const generatedMs = Date.now() - t0;
await writeFile(join(outDir, `${label}-suite.spec.ts`), code, "utf8");

const runs = join(root, ".playwright-runs");
await mkdir(runs, { recursive: true });
const name = `tfp175-${label}-${process.pid}`;
const jsonFile = join(runs, `${name}.json`);
await writeFile(join(runs, `${name}.spec.ts`), code, "utf8");
const env: NodeJS.ProcessEnv = { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: jsonFile, FORCE_COLOR: "0", TESTFORGE_INTERACTIVE: "0" };
delete env.TESTFORGE_STORAGE_STATE;
const started = Date.now();
await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [join(root, "node_modules", "playwright", "cli.js"), "test", `.playwright-runs/${name}.spec.ts`, "--reporter=json", "--timeout=30000", "--workers=1", "--project=chromium", `--output=.playwright-runs/${name}-artifacts`], { cwd: root, env, stdio: "ignore", windowsHide: true });
    child.on("error", reject);
    child.on("close", () => resolve());
});
const runMs = Date.now() - started;
const json = JSON.parse(await readFile(jsonFile, "utf8"));
await writeFile(join(outDir, `${label}-report.json`), JSON.stringify(json), "utf8");
await rm(join(runs, `${name}.spec.ts`), { force: true });
await rm(jsonFile, { force: true });
await rm(join(runs, `${name}-artifacts`), { recursive: true, force: true });

type Rec = { title: string; status: string; rawMessage: string; page?: string; gate?: string; findings?: string[]; issues?: Array<{ kind: string; category: string; detail: string }>; skipReason?: string };
const records = flattenSuites(json.suites ?? []) as Rec[];
const byStatus: Record<string, number> = {};
for (const r of records) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
const slim = records.map((r) => ({
    title: r.title,
    page: r.page ?? null,
    status: r.status,
    message: r.status === "Failed" || r.status === "Blocked" ? (r.rawMessage ?? "").replace(/\s+/g, " ").slice(0, 600) : "",
    skipReason: r.skipReason ?? "",
    findings: r.findings ?? [],
    issues: (r.issues ?? []).map((issue) => `${issue.kind} ${issue.category} ${issue.detail}`),
}));
await writeFile(join(outDir, `${label}-records.json`), JSON.stringify({ label, site: origin, kind, paths, commit: process.env.MEASURE_COMMIT ?? "?", startedAt: new Date(started).toISOString(), generateSeconds: Math.round(generatedMs / 1000), runSeconds: Math.round(runMs / 1000), tests: records.length, byStatus, records: slim }, null, 2), "utf8");
console.log(`${label}: ${kind} on ${origin}; generate ${Math.round(generatedMs / 1000)} s, run ${Math.round(runMs / 1000)} s; ${records.length} tests ${JSON.stringify(byStatus)}`);
