// TFP-197 (Phase 42 Gate B): one Standard run of one local Toolshop copy with the gap writer, as the app makes it.
// Generation goes through POST /api/generate (the route inspects the pages, applies the site suite, binds pool
// candidates on Standard and the library's promoted entries, then writes gap tests for the site that opted in),
// so every Phase 42 piece applies. The suite is then run as TFP-175's driver runs it - all ten areas, fast mode,
// read-only gate, one worker, Chromium, the executor's Playwright arguments - with TFP-202's run environment
// (src/lib/run/child-env.ts), never TestForge's own.
//
// Claude Code is the real one, behind claude-logger.mjs (a pass-through that times each call and keeps its
// reply). TESTFORGE_DATA_DIR must name a folder outside the repo; the site's opt-in is set there.
//
// Writes, under <outDir>: <label>-suite.spec.ts, <label>-generate.json (the route's answer but the code),
// <label>-report.json (Playwright's), <label>-records.json (TFP-175's shape, plus generator and candidate),
// <label>-claude-calls.jsonl (one line per call), and <label>-data/ (the site suite's manifest and gap-writing
// record, and the candidate pool, as they stood after the run).
// Usage (from the repo root):
//   TESTFORGE_DATA_DIR=<folder> node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types <this> <label> <site> <outDir> <path>...
import { spawn } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const [label, site, outDirArg, ...paths] = process.argv.slice(2);
const dataDir = process.env.TESTFORGE_DATA_DIR?.trim();
if (!dataDir || !isAbsolute(dataDir) || !relative(root, resolve(dataDir)).startsWith("..")) throw new Error("TESTFORGE_DATA_DIR must be an absolute folder outside the repo");
const notPaths = paths.filter((path) => !path.startsWith("/"));
if (!label || !site || !outDirArg || paths.length === 0 || notPaths.length > 0) throw new Error(`usage: <label> <site> <outDir> <path>...; not page paths: ${notPaths.join(", ")}`);
const outDir = resolve(outDirArg);
await mkdir(outDir, { recursive: true });
const origin = site.replace(/\/$/, "");

// The template path, and the real Claude Code behind the logger. Nothing else may answer for the generation.
delete process.env.OPENAI_API_KEY;
delete process.env.TESTFORGE_OLLAMA_MODEL;
// 50, not the default 5 (Emil, 2026-10-15): at 5 a re-run of an unchanged site asks for the next 5 of the clean
// copy's 36 gaps, so "a re-run writes nothing" could only hold once the gap list is used up.
process.env.TESTFORGE_GAP_LIMIT = "50";
const callLog = join(outDir, `${label}-claude-calls.jsonl`);
await rm(callLog, { force: true });
process.env.TFP197_CLAUDE_LOG = callLog;
process.env.TESTFORGE_CLAUDE_COMMAND = JSON.stringify([process.execPath, join(root, "benchmarks/2026-10-15-tfp197-gap-writer/claude-logger.mjs")]);

const load = (path: string) => import(pathToFileURL(join(root, path)).href);
const settingsRoute = await load("src/app/api/site-settings/route.ts");
const generateRoute = await load("src/app/api/generate/route.ts");
const { flattenSuites } = await load("src/lib/report/execution.ts");
const { runEnv } = await load("src/lib/run/child-env.ts");
const { NextRequest } = await import("next/server");
const post = (url: string, body: unknown) => new NextRequest(new URL(url), { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });

const AREAS = ["functional", "responsive/mobile", "performance/load", "security", "accessibility", "usability", "seo/content", "cookie/session", "database", "reliability"];

// The site's opt-in (Decision 6): Claude Code as its gap writer.
const settings = await settingsRoute.POST(post("http://localhost/api/site-settings", { baseUrl: origin, gapWriter: "claude-code" }));
if (settings.status !== 200) throw new Error(`site settings: ${settings.status} ${await settings.text()}`);

const t0 = Date.now();
const response = await generateRoute.POST(post("http://localhost/api/generate", { baseUrl: origin, description: "Check the site.", selectedPractices: AREAS, contentRules: { paths }, auditMode: "fast" }));
if (response.status !== 200) throw new Error(`generate: ${response.status} ${await response.text()}`);
const generated = (await response.json()) as { code: string; generatedBy?: string; siteSuite?: { store: string; gapTests?: unknown; candidateTests?: unknown }; pageInspection?: unknown };
const generateMs = Date.now() - t0;
const { code, ...answer } = generated;
await writeFile(join(outDir, `${label}-suite.spec.ts`), code, "utf8");
await writeFile(join(outDir, `${label}-generate.json`), JSON.stringify(answer, null, 2), "utf8");

const runs = join(root, ".playwright-runs");
await mkdir(runs, { recursive: true });
const name = `tfp197-${label}-${process.pid}`;
const jsonFile = join(runs, `${name}.json`);
await writeFile(join(runs, `${name}.spec.ts`), code, "utf8");
const started = Date.now();
await new Promise<void>((done, fail) => {
    const child = spawn(process.execPath, [join(root, "node_modules", "playwright", "cli.js"), "test", `.playwright-runs/${name}.spec.ts`, "--reporter=json", "--timeout=30000", "--workers=1", "--project=chromium", `--output=.playwright-runs/${name}-artifacts`], {
        cwd: root,
        env: runEnv({ PLAYWRIGHT_JSON_OUTPUT_FILE: jsonFile, FORCE_COLOR: "0", TESTFORGE_INTERACTIVE: "0", HOME: process.env.HOME ?? process.env.USERPROFILE ?? root }),
        stdio: "ignore",
        windowsHide: true,
    });
    child.on("error", fail);
    child.on("close", () => done());
});
const runMs = Date.now() - started;
const json = JSON.parse(await readFile(jsonFile, "utf8"));
await writeFile(join(outDir, `${label}-report.json`), JSON.stringify(json), "utf8");
await rm(join(runs, `${name}.spec.ts`), { force: true });
await rm(jsonFile, { force: true });
await rm(join(runs, `${name}-artifacts`), { recursive: true, force: true });

type Rec = { title: string; status: string; rawMessage: string; page?: string; generator?: string; candidate?: string; findings?: string[]; issues?: Array<{ kind: string; category: string; detail: string }>; skipReason?: string };
const records = flattenSuites(json.suites ?? []) as Rec[];
const byStatus: Record<string, number> = {};
for (const r of records) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
const slim = records.map((r) => ({
    title: r.title,
    page: r.page ?? null,
    status: r.status,
    generator: r.generator ?? null,
    candidate: r.candidate ?? null,
    message: r.status === "Failed" || r.status === "Blocked" ? (r.rawMessage ?? "").replace(/\s+/g, " ").slice(0, 600) : "",
    skipReason: r.skipReason ?? "",
    findings: r.findings ?? [],
    issues: (r.issues ?? []).map((issue) => `${issue.kind} ${issue.category} ${issue.detail}`),
}));

// What the data folder held afterwards: the site suite's manifest and gap-writing record, and the pool.
const kept = join(outDir, `${label}-data`);
await rm(kept, { recursive: true, force: true });
const store = generated.siteSuite?.store;
if (store) {
    for (const file of ["manifest.json", "gap-writing.json"]) if (existsSync(join(store, file))) await cp(join(store, file), join(kept, "site-suite", file));
}
if (existsSync(join(dataDir, "candidates"))) await cp(join(dataDir, "candidates"), join(kept, "candidates"), { recursive: true });

const calls = existsSync(callLog) ? readFileSync(callLog, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line) as { ms: number; exit: number; reply?: { total_cost_usd?: number; is_error?: boolean } }) : [];
const claude = { calls: calls.length, failedCalls: calls.filter((call) => call.exit !== 0 || call.reply?.is_error).length, costUsd: Number(calls.reduce((sum, call) => sum + (call.reply?.total_cost_usd ?? 0), 0).toFixed(4)), seconds: Math.round(calls.reduce((sum, call) => sum + call.ms, 0) / 1000) };
await writeFile(join(outDir, `${label}-records.json`), JSON.stringify({ label, site: origin, kind: "standard", paths, commit: process.env.MEASURE_COMMIT ?? "?", startedAt: new Date(t0).toISOString(), generateSeconds: Math.round(generateMs / 1000), runSeconds: Math.round(runMs / 1000), claude, tests: records.length, byStatus, records: slim }, null, 2), "utf8");
console.log(`${label}: standard on ${origin}; generate ${Math.round(generateMs / 1000)} s (Claude Code: ${claude.calls} calls, ${claude.seconds} s, $${claude.costUsd}), run ${Math.round(runMs / 1000)} s; ${records.length} tests ${JSON.stringify(byStatus)}`);
