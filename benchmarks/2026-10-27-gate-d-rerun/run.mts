// Phase 39 Gate D's re-measurement (Gate D ruling 4, 2026-10-26): Gate D's run.mts (benchmarks/2026-10-21-gate-d/), with
// W3 added, a lower local-host limit, measured when clean still overloads or differs with WN. Every variant's suites, run
// in one session, interleaved, with a worker count per variant: the variants differ by workers, not code.
// The variants (VARIANTS below):
// - W1:  this repo's code, 1 worker;
// - WN:  this repo's code, the machine's limit (Decision 10: half the cores, at least 1), as the app runs a local host;
// - W3:  this repo's code, 3 workers: the lower local-host limit ruling 4 names;
// - CAP: this repo's code, a capped host as the app runs it (Decision 10: at most 3 workers sharing 5 requests per
//        second, TFP-157's slot server and run-time module); for the hosted practice site, recorded only;
// The current code's variants run as the app runs them (TFP-155, TFP-156): split into units, the read-only units on the
// variant's workers in one pass, then the serial group on one worker, merged as the executor merges them.
// Each pass is the executor's Playwright call (--timeout=30000, Chromium, interactive off) with the timing reporter
// beside the JSON one. A run that fails to report is logged and the session goes on.
// Writes <runsDir>/<variant>/<label>-<kind>-run<n>-records.json and -timing.json.
// Usage (from the repo root): node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types <this> <label> <site> <runsDir> <plan> <rounds>
//   <plan>: "W1:standard,security,accessibility;WN:standard,security,accessibility;W3:standard,security,accessibility"
import { spawn } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const load = (path: string) => import(pathToFileURL(join(root, path)).href);
const { flattenSuites } = await load("src/lib/report/execution.ts");
const { buildTimingReporterSource, summarizeTiming, TIMING_FILE_ENV_VAR } = await load("src/lib/run/timing.ts");
const { createRunFolder, removeRunFolder, PLAYWRIGHT_RUNS_DIR } = await load("src/lib/run/run-folders.ts");
const { splitSuite } = await load("src/lib/run/split.ts");
const { mergePasses } = await load("src/lib/run/executor.ts");
const { hostLimitsFor, machineWorkerLimit } = await load("src/lib/run/host-limits.ts");
const { requestCapEnv, startRequestCap, withRequestCap, writeRequestCapModule } = await load("src/lib/run/request-cap.ts");

const [label, site, runsDir, planArg, roundsArg] = process.argv.slice(2);
const origin = site.replace(/\/$/, "");
const rounds = Number(roundsArg);
const plan = planArg.split(";").map((part) => {
    const [variant, kinds] = part.split(":");
    return { variant, kinds: kinds.split(",") };
});
const KINDS = ["standard", "security", "accessibility"];

/** TFP-158: each variant's workers, whether it runs as units (this repo's code), and whether it is capped. */
const capped = hostLimitsFor(origin, { ownershipConfirmed: false });
const VARIANTS: Record<string, { workers: number; split: boolean; cap: boolean }> = {
    W1: { workers: 1, split: true, cap: false },
    WN: { workers: machineWorkerLimit(), split: true, cap: false },
    W3: { workers: 3, split: true, cap: false },
    CAP: { workers: capped.workers, split: true, cap: true },
};
for (const { variant } of plan) if (!VARIANTS[variant]) throw new Error(`unknown variant ${variant}`);
if (plan.some(({ variant }) => variant === "CAP") && capped.row !== "capped") throw new Error(`CAP needs a capped host; ${origin} is ${capped.row}`);

type Rec = { title: string; status: string; rawMessage: string; page?: string; findings?: string[]; issues?: Array<{ kind: string; category: string; detail: string }>; skipReason?: string };
type Pass = { config: string; report: string; timing: string; output: string; workers: number };

function runPass(pass: Pass, reporter: string, extraEnv: Record<string, string>) {
    const env: NodeJS.ProcessEnv = { ...process.env, ...extraEnv, PLAYWRIGHT_JSON_OUTPUT_FILE: pass.report, [TIMING_FILE_ENV_VAR]: pass.timing, FORCE_COLOR: "0", TESTFORGE_INTERACTIVE: "0" };
    delete env.TESTFORGE_STORAGE_STATE;
    return new Promise<void>((resolve, reject) => {
        const child = spawn(process.execPath, [join(root, "node_modules", "playwright", "cli.js"), "test", "--config", pass.config, `--reporter=json,${reporter.replace(/\\/g, "/")}`, "--timeout=30000", `--workers=${pass.workers}`, "--project=chromium", `--output=${pass.output.replace(/\\/g, "/")}`], { cwd: root, env, stdio: "ignore", windowsHide: true });
        child.on("error", reject);
        child.on("close", () => resolve());
    });
}

/** A test that ran out of time: Playwright's test timeout, or an action's or a navigation's. */
const TIMEOUT = /Test timeout of \d+ms exceeded|Timeout \d+ms exceeded|timed out after \d+/i;

async function runOnce(variant: string, kind: string, run: number) {
    const settings = VARIANTS[variant];
    const dir = join(runsDir, variant);
    const name = `gate-d-rerun-${variant}-${label}-${kind}-${run}-${process.pid}`;
    const code = await readFile(join(dir, `${label}-${kind}-suite.spec.ts`), "utf8");
    const folder = await createRunFolder(PLAYWRIGHT_RUNS_DIR, name, ", testIgnore: ['serial/**']");
    const reporter = join(folder.dir, "timing-reporter.cjs");
    await writeFile(reporter, buildTimingReporterSource(), "utf8");
    const output = join(PLAYWRIGHT_RUNS_DIR, `${name}-artifacts`);
    const passes: Pass[] = [{ config: folder.config, report: join(folder.dir, "report.json"), timing: join(folder.dir, "timing.json"), output, workers: settings.workers }];
    // TFP-157: a capped variant's slot server, and its units importing the cap's module, as the executor does.
    const cap = settings.cap ? await startRequestCap(capped.requestsPerSecond) : null;
    if (cap) await writeRequestCapModule(folder.dir);
    const prepare = (unitCode: string, unitDir: string) => (cap ? withRequestCap(unitCode, unitDir, folder.dir) : unitCode);
    let units = 1, serialTests = 0;
    if (settings.split) {
        const split = splitSuite(code) as Array<{ name: string; kind: string; code: string }>;
        units = split.length;
        for (const unit of split.filter((entry) => entry.kind !== "serial")) await writeFile(join(folder.dir, unit.name), prepare(unit.code, folder.dir), "utf8");
        const serial = split.find((entry) => entry.kind === "serial");
        if (serial) {
            const serialFolder = await createRunFolder(folder.dir, "serial");
            await writeFile(join(serialFolder.dir, serial.name), prepare(serial.code, serialFolder.dir), "utf8");
            serialTests = (serial.code.match(/\n\s*test(\.skip|\.fixme)?\(\s*'/g) ?? []).length;
            passes.push({ config: serialFolder.config, report: join(folder.dir, "report-serial.json"), timing: join(folder.dir, "timing-serial.json"), output: join(output, "serial"), workers: 1 });
        }
    } else {
        await writeFile(join(folder.dir, `${name}.spec.ts`), code, "utf8");
    }
    const extraEnv = cap && capped.siteDomain !== null ? requestCapEnv(cap, capped.siteDomain) : {};
    const started = Date.now();
    try {
        for (const pass of passes) await runPass(pass, reporter, extraEnv);
        const runMs = Date.now() - started;
        const capStats = cap ? cap.stats() : null;
        await mergePasses(passes.map((pass) => pass.report), passes[0].report, passes.map((pass) => pass.timing), passes[0].timing);
        const report = JSON.parse(await readFile(passes[0].report, "utf8"));
        const raw = JSON.parse(await readFile(passes[0].timing, "utf8"));
        const records = flattenSuites(report.suites ?? []) as Rec[];
        const byStatus: Record<string, number> = {};
        for (const record of records) byStatus[record.status] = (byStatus[record.status] ?? 0) + 1;
        const summary = summarizeTiming(raw, { baseUrl: origin });
        const timeouts = records.filter((record) => record.status === "Failed" && TIMEOUT.test(record.rawMessage ?? "")).map((record) => `${record.title} @${record.page ?? ""}`);
        const out = (suffix: string) => join(dir, `${label}-${kind}-run${run}-${suffix}.json`);
        await writeFile(out("records"), JSON.stringify({
            label, variant, site: origin, kind, run, commit: process.env.MEASURE_COMMIT ?? "?", startedAt: new Date(started).toISOString(), runSeconds: Math.round(runMs / 1000),
            workers: settings.workers, workersUsed: summary.workers ?? null, units, passes: passes.length, serialTests, tests: records.length, byStatus,
            requestCap: capStats, timeouts,
            records: records.map((record) => ({ title: record.title, page: record.page ?? null, status: record.status, message: record.status === "Failed" || record.status === "Blocked" ? (record.rawMessage ?? "").replace(/\s+/g, " ").slice(0, 600) : "", skipReason: record.skipReason ?? "", findings: record.findings ?? [], issues: (record.issues ?? []).map((issue) => `${issue.kind} ${issue.category} ${issue.detail}`) })),
        }, null, 2), "utf8");
        await writeFile(out("timing"), JSON.stringify(raw), "utf8");
        const seconds = (ms: number) => Math.round(ms / 1000);
        const capLine = capStats ? `; cap: ${capStats.requests} slot(s), ${capStats.waited} waited, ${(capStats.requests / (runMs / 1000)).toFixed(1)} per s` : "";
        console.log(`${label}: ${new Date().toTimeString().slice(0, 8)} ${variant} ${kind} run ${run}: ${seconds(runMs)} s, ${settings.workers} worker(s) (${summary.workers ?? "?"} used), ${units} unit(s) in ${passes.length} pass(es), ${records.length} tests ${JSON.stringify(byStatus)}; timeouts ${timeouts.length}${capLine}`);
    } catch (error) {
        console.log(`${label}: ${new Date().toTimeString().slice(0, 8)} ${variant} ${kind} run ${run}: FAILED to report (${error instanceof Error ? error.message : String(error)}); the session goes on`);
    } finally {
        await cap?.close();
        await removeRunFolder(folder.dir);
        await rm(output, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }).catch(() => undefined);
    }
}

for (let run = 1; run <= rounds; run++) {
    for (const kind of KINDS) {
        for (const { variant, kinds } of plan) if (kinds.includes(kind)) await runOnce(variant, kind, run);
    }
}
