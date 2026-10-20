// Phase 39 Gate B: every variant's suites, run in one session, interleaved, so before and after share the machine's
// state (the locked rule: TFP-211 saw the same code drift 14 to 19% between sessions). Each round runs each kind
// (Standard, then Comprehensive security, then accessibility) for every variant that has it, in the plan's order.
// Each run is TFP-211's: the executor's Playwright call (read-only gate, --timeout=30000, --workers=1, Chromium)
// with the timing reporter beside the JSON one. The suites are generate.mts's, from the session's one inspection.
// Writes <runsDir>/<variant>/<label>-<kind>-run<n>-records.json and -timing.json.
// Usage (from the repo root): node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types <this> <label> <site> <runsDir> <plan> <rounds>
//   <plan>: "A:standard,security,accessibility;B:standard;C:standard,security,accessibility"
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const load = (path: string) => import(pathToFileURL(join(root, path)).href);
const { flattenSuites } = await load("src/lib/report/execution.ts");
const { buildTimingReporterSource, summarizeTiming, TIMING_FILE_ENV_VAR } = await load("src/lib/run/timing.ts");

const [label, site, runsDir, planArg, roundsArg] = process.argv.slice(2);
const origin = site.replace(/\/$/, "");
const rounds = Number(roundsArg);
const plan = planArg.split(";").map((part) => {
    const [variant, kinds] = part.split(":");
    return { variant, kinds: kinds.split(",") };
});
const KINDS = ["standard", "security", "accessibility"];

const playwrightRuns = join(root, ".playwright-runs");
await mkdir(playwrightRuns, { recursive: true });
const reporter = join(playwrightRuns, `gate-b-timing-reporter-${process.pid}.cjs`);
await writeFile(reporter, buildTimingReporterSource(), "utf8");

type Rec = { title: string; status: string; rawMessage: string; page?: string; findings?: string[]; issues?: Array<{ kind: string; category: string; detail: string }>; skipReason?: string };
async function runOnce(variant: string, kind: string, run: number) {
    const dir = join(runsDir, variant);
    const name = `gate-b-${variant}-${label}-${kind}-${run}-${process.pid}`;
    const specFile = join(playwrightRuns, `${name}.spec.ts`);
    const jsonFile = join(playwrightRuns, `${name}.json`);
    const timingFile = join(playwrightRuns, `${name}-timing.json`);
    await writeFile(specFile, await readFile(join(dir, `${label}-${kind}-suite.spec.ts`), "utf8"), "utf8");
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
    const out = (suffix: string) => join(dir, `${label}-${kind}-run${run}-${suffix}.json`);
    await writeFile(out("records"), JSON.stringify({
        label, variant, site: origin, kind, run, commit: process.env.MEASURE_COMMIT ?? "?", startedAt: new Date(started).toISOString(), runSeconds: Math.round(runMs / 1000), tests: records.length, byStatus,
        records: records.map((record) => ({ title: record.title, page: record.page ?? null, status: record.status, message: record.status === "Failed" || record.status === "Blocked" ? (record.rawMessage ?? "").replace(/\s+/g, " ").slice(0, 600) : "", skipReason: record.skipReason ?? "", findings: record.findings ?? [], issues: (record.issues ?? []).map((issue) => `${issue.kind} ${issue.category} ${issue.detail}`) })),
    }, null, 2), "utf8");
    await writeFile(out("timing"), JSON.stringify(raw), "utf8");
    for (const file of [specFile, jsonFile, timingFile]) await rm(file, { force: true });
    await rm(join(playwrightRuns, `${name}-artifacts`), { recursive: true, force: true });
    const summary = summarizeTiming(raw, { baseUrl: origin });
    const seconds = (ms: number) => Math.round(ms / 1000);
    console.log(`${label}: ${new Date().toTimeString().slice(0, 8)} ${variant} ${kind} run ${run}: ${seconds(runMs)} s, ${records.length} tests ${JSON.stringify(byStatus)}; loads ${summary.pageLoads.count}, settle ${seconds(summary.settle.ms)} s, failing ${summary.failing.tests} (${seconds(summary.failing.ms)} s)`);
}

try {
    for (let run = 1; run <= rounds; run++) {
        for (const kind of KINDS) {
            for (const { variant, kinds } of plan) if (kinds.includes(kind)) await runOnce(variant, kind, run);
        }
    }
} finally {
    await rm(reporter, { force: true });
}
