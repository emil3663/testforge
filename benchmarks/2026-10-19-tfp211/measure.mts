// TFP-211 (Phase 39, Decision 1): where the run time goes, three runs of each suite on one site, one worker.
// The suites are TFP-175's (benchmarks/2026-10-07-tfp175-selection/run-tfp175.ts): Standard (all ten areas,
// fast) on Standard's selected pages, inspected first as the app does, and Comprehensive security (passive) and
// accessibility on Comprehensive's pages, cap 20 - the two Comprehensive areas there are. Each suite is
// generated once and then run three times, interleaved (Standard, security, accessibility; then again), so the
// spread is the run's own, not inspection's: a listing that moves between loads would change the suite.
// Each run is the executor's Playwright call (read-only gate, --timeout=30000, --workers=1, Chromium) with the
// timing reporter beside the JSON one (src/lib/run/timing.ts), so no generated test changes.
// Writes, per suite: <label>-<kind>-suite.spec.ts (and -profile.json for Standard); per run:
// <label>-<kind>-run<n>-records.json (each test's status and message, as TFP-175 keeps them),
// -timing.json (the reporter's raw record) and -summary.json (summarizeTiming, with controls for Standard).
// Usage (from the repo root, after crawl-and-select.mts wrote <outDir>/<label>-selection.json):
//   node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types <this> <label> <site> <outDir> <runs>
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
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
const { buildTimingReporterSource, countControlKinds, summarizeTiming, TIMING_FILE_ENV_VAR } = await load("src/lib/run/timing.ts");

const [label, site, outDir, runsArg] = process.argv.slice(2);
const runs = Number(runsArg);
if (!label || !site || !outDir || !Number.isInteger(runs) || runs < 1) throw new Error("usage: measure.mts <label> <site> <outDir> <runs>");
const origin = site.replace(/\/$/, "");
const AREAS = ["functional", "responsive/mobile", "performance/load", "security", "accessibility", "usability", "seo/content", "cookie/session", "database", "reliability"];
const KINDS = ["standard", "security", "accessibility"] as const;
type Kind = (typeof KINDS)[number];
await mkdir(outDir, { recursive: true });

const selection = JSON.parse(await readFile(join(outDir, `${label}-selection.json`), "utf8"));
const standardPaths: string[] = selection.standard.pages;
const comprehensivePaths: string[] = selection.comprehensive.pages;
for (const path of [...standardPaths, ...comprehensivePaths]) if (!path.startsWith("/")) throw new Error(`not a page path, refusing to run: ${path}`);

// The suites, once.
const suiteFile = (kind: Kind) => join(outDir, `${label}-${kind}-suite.spec.ts`);
const profileFile = join(outDir, `${label}-standard-profile.json`);
let profile = existsSync(profileFile) ? JSON.parse(await readFile(profileFile, "utf8")) : null;
for (const kind of KINDS) {
    if (existsSync(suiteFile(kind))) continue;
    let code: string;
    if (kind === "standard") {
        profile = { scannedAt: new Date().toISOString(), baseUrl: origin, ...(await inspectPages(origin, standardPaths)) };
        await writeFile(profileFile, JSON.stringify(profile, null, 2), "utf8");
        code = mockGenerate(origin, "Check the site.", AREAS, profile, normalizeContentRules({ paths: standardPaths }), normalizeTestAuditMode("fast"));
    } else {
        code = buildComprehensiveSuite(origin, normalizeRunMode({ kind: "comprehensive", area: kind }), { covered: comprehensivePaths, notCovered: [], pageCap: 20 });
    }
    await writeFile(suiteFile(kind), code, "utf8");
    console.log(`${label}: ${new Date().toTimeString().slice(0, 8)} ${kind} suite written`);
}

const playwrightRuns = join(root, ".playwright-runs");
await mkdir(playwrightRuns, { recursive: true });
const reporter = join(playwrightRuns, `tfp211-timing-reporter-${process.pid}.cjs`);
await writeFile(reporter, buildTimingReporterSource(), "utf8");

type Rec = { title: string; status: string; rawMessage: string; page?: string; findings?: string[]; skipReason?: string };
async function runOnce(kind: Kind, run: number) {
    const name = `tfp211-${label}-${kind}-${run}-${process.pid}`;
    const specFile = join(playwrightRuns, `${name}.spec.ts`);
    const jsonFile = join(playwrightRuns, `${name}.json`);
    const timingFile = join(playwrightRuns, `${name}-timing.json`);
    await writeFile(specFile, await readFile(suiteFile(kind), "utf8"), "utf8");
    const env: NodeJS.ProcessEnv = { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: jsonFile, [TIMING_FILE_ENV_VAR]: timingFile, FORCE_COLOR: "0", TESTFORGE_INTERACTIVE: "0" };
    delete env.TESTFORGE_STORAGE_STATE;
    const started = Date.now();
    await new Promise<void>((resolve, reject) => {
        const child = spawn(process.execPath, [join(root, "node_modules", "playwright", "cli.js"), "test", `.playwright-runs/${name}.spec.ts`, `--reporter=json,${reporter.replace(/\\/g, "/")}`, "--timeout=30000", "--workers=1", "--project=chromium", `--output=.playwright-runs/${name}-artifacts`], { cwd: root, env, stdio: "ignore", windowsHide: true });
        child.on("error", reject);
        child.on("close", () => resolve());
    });
    const runMs = Date.now() - started;
    const report = JSON.parse(await readFile(jsonFile, "utf8"));
    const raw = JSON.parse(await readFile(timingFile, "utf8"));
    const records = flattenSuites(report.suites ?? []) as Rec[];
    const byStatus: Record<string, number> = {};
    for (const record of records) byStatus[record.status] = (byStatus[record.status] ?? 0) + 1;
    const out = (suffix: string) => join(outDir, `${label}-${kind}-run${run}-${suffix}.json`);
    await writeFile(out("records"), JSON.stringify({
        label, site: origin, kind, run, commit: process.env.MEASURE_COMMIT ?? "?", startedAt: new Date(started).toISOString(), runSeconds: Math.round(runMs / 1000), tests: records.length, byStatus,
        records: records.map((record) => ({ title: record.title, page: record.page ?? null, status: record.status, message: record.status === "Failed" || record.status === "Blocked" ? (record.rawMessage ?? "").replace(/\s+/g, " ").slice(0, 600) : "", skipReason: record.skipReason ?? "" })),
    }, null, 2), "utf8");
    await writeFile(out("timing"), JSON.stringify(raw), "utf8");
    const summary = { ...summarizeTiming(raw, { baseUrl: origin, profile: kind === "standard" ? profile : null }), ...(kind === "standard" && profile ? { controls: countControlKinds(profile) } : {}) };
    await writeFile(out("summary"), JSON.stringify({ label, kind, run, runMs, ...summary }, null, 2), "utf8");
    for (const file of [specFile, jsonFile, timingFile]) await rm(file, { force: true });
    await rm(join(playwrightRuns, `${name}-artifacts`), { recursive: true, force: true });
    const seconds = (ms: number) => Math.round(ms / 1000);
    console.log(`${label}: ${new Date().toTimeString().slice(0, 8)} ${kind} run ${run}: ${seconds(runMs)} s, ${records.length} tests ${JSON.stringify(byStatus)}; loads ${summary.pageLoads.count} (${seconds(summary.pageLoads.ms)} s), settle ${seconds(summary.settle.ms)} s (${summary.settle.capped} capped), failing ${summary.failing.tests} (${seconds(summary.failing.ms)} s)`);
}

try {
    for (let run = 1; run <= runs; run++) {
        for (const kind of KINDS) await runOnce(kind, run);
    }
} finally {
    await rm(reporter, { force: true });
}
