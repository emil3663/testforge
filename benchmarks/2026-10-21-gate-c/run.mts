// Phase 39 Gate C: every variant's suites, run in one session, interleaved, three rounds, one worker (the Gate A
// rules). As Gate B's run.mts, with two changes:
// - Each run in a folder of its own under .playwright-runs, with a config scoped to it (TFP-222's helper), so no
//   run's start-up walk reaches another's files.
// - F's suites (and F with the axe scan last) run as the app runs them (TFP-155, TFP-156): split into units by this
//   code's splitSuite, the read-only units in one pass and the serial group in a second, their reports and timing
//   merged as the executor merges them. The other variants run their one file, as their own code did.
// Each pass is the executor's Playwright call (--timeout=30000, --workers=1, Chromium, interactive off) with the
// timing reporter beside the JSON one. A run that fails to report is logged and the session goes on.
// Writes <runsDir>/<variant>/<label>-<kind>-run<n>-records.json and -timing.json.
// Usage (from the repo root): node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types <this> <label> <site> <runsDir> <plan> <rounds>
//   <plan>: "C:standard;C1:standard;C2:standard,accessibility;F:standard,accessibility;FL:accessibility;A:accessibility"
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

const [label, site, runsDir, planArg, roundsArg] = process.argv.slice(2);
const origin = site.replace(/\/$/, "");
const rounds = Number(roundsArg);
const plan = planArg.split(";").map((part) => {
    const [variant, kinds] = part.split(":");
    return { variant, kinds: kinds.split(",") };
});
const KINDS = ["standard", "accessibility"];
/** The variants with TFP-155 and TFP-156: run as units, the serial group second. */
const SPLIT = new Set(["F", "FL"]);

type Rec = { title: string; status: string; rawMessage: string; page?: string; findings?: string[]; issues?: Array<{ kind: string; category: string; detail: string }>; skipReason?: string };
type Pass = { config: string; report: string; timing: string; output: string };

function runPass(pass: Pass, reporter: string) {
    const env: NodeJS.ProcessEnv = { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: pass.report, [TIMING_FILE_ENV_VAR]: pass.timing, FORCE_COLOR: "0", TESTFORGE_INTERACTIVE: "0" };
    delete env.TESTFORGE_STORAGE_STATE;
    return new Promise<void>((resolve, reject) => {
        const child = spawn(process.execPath, [join(root, "node_modules", "playwright", "cli.js"), "test", "--config", pass.config, `--reporter=json,${reporter.replace(/\\/g, "/")}`, "--timeout=30000", "--workers=1", "--project=chromium", `--output=${pass.output.replace(/\\/g, "/")}`], { cwd: root, env, stdio: "ignore", windowsHide: true });
        child.on("error", reject);
        child.on("close", () => resolve());
    });
}

async function runOnce(variant: string, kind: string, run: number) {
    const dir = join(runsDir, variant);
    const name = `gate-c-${variant}-${label}-${kind}-${run}-${process.pid}`;
    const code = await readFile(join(dir, `${label}-${kind}-suite.spec.ts`), "utf8");
    const folder = await createRunFolder(PLAYWRIGHT_RUNS_DIR, name, ", testIgnore: ['serial/**']");
    const reporter = join(folder.dir, "timing-reporter.cjs");
    await writeFile(reporter, buildTimingReporterSource(), "utf8");
    const output = join(PLAYWRIGHT_RUNS_DIR, `${name}-artifacts`);
    const passes: Pass[] = [{ config: folder.config, report: join(folder.dir, "report.json"), timing: join(folder.dir, "timing.json"), output }];
    let units = 1, serialTests = 0;
    if (SPLIT.has(variant)) {
        const split = splitSuite(code) as Array<{ name: string; kind: string; code: string }>;
        units = split.length;
        for (const unit of split.filter((entry) => entry.kind !== "serial")) await writeFile(join(folder.dir, unit.name), unit.code, "utf8");
        const serial = split.find((entry) => entry.kind === "serial");
        if (serial) {
            const serialFolder = await createRunFolder(folder.dir, "serial");
            await writeFile(join(serialFolder.dir, serial.name), serial.code, "utf8");
            serialTests = (serial.code.match(/\n\s*test(\.skip|\.fixme)?\(\s*'/g) ?? []).length;
            passes.push({ config: serialFolder.config, report: join(folder.dir, "report-serial.json"), timing: join(folder.dir, "timing-serial.json"), output: join(output, "serial") });
        }
    } else {
        await writeFile(join(folder.dir, `${name}.spec.ts`), code, "utf8");
    }
    const started = Date.now();
    try {
        for (const pass of passes) await runPass(pass, reporter);
        const runMs = Date.now() - started;
        await mergePasses(passes.map((pass) => pass.report), passes[0].report, passes.map((pass) => pass.timing), passes[0].timing);
        const report = JSON.parse(await readFile(passes[0].report, "utf8"));
        const raw = JSON.parse(await readFile(passes[0].timing, "utf8"));
        const records = flattenSuites(report.suites ?? []) as Rec[];
        const byStatus: Record<string, number> = {};
        for (const record of records) byStatus[record.status] = (byStatus[record.status] ?? 0) + 1;
        const out = (suffix: string) => join(dir, `${label}-${kind}-run${run}-${suffix}.json`);
        await writeFile(out("records"), JSON.stringify({
            label, variant, site: origin, kind, run, commit: process.env.MEASURE_COMMIT ?? "?", startedAt: new Date(started).toISOString(), runSeconds: Math.round(runMs / 1000), units, passes: passes.length, serialTests, tests: records.length, byStatus,
            records: records.map((record) => ({ title: record.title, page: record.page ?? null, status: record.status, message: record.status === "Failed" || record.status === "Blocked" ? (record.rawMessage ?? "").replace(/\s+/g, " ").slice(0, 600) : "", skipReason: record.skipReason ?? "", findings: record.findings ?? [], issues: (record.issues ?? []).map((issue) => `${issue.kind} ${issue.category} ${issue.detail}`) })),
        }, null, 2), "utf8");
        await writeFile(out("timing"), JSON.stringify(raw), "utf8");
        const summary = summarizeTiming(raw, { baseUrl: origin });
        const seconds = (ms: number) => Math.round(ms / 1000);
        console.log(`${label}: ${new Date().toTimeString().slice(0, 8)} ${variant} ${kind} run ${run}: ${seconds(runMs)} s, ${units} unit(s) in ${passes.length} pass(es), ${records.length} tests ${JSON.stringify(byStatus)}; loads ${summary.pageLoads.count}, settle ${seconds(summary.settle.ms)} s, failing ${summary.failing.tests} (${seconds(summary.failing.ms)} s)`);
    } catch (error) {
        console.log(`${label}: ${new Date().toTimeString().slice(0, 8)} ${variant} ${kind} run ${run}: FAILED to report (${error instanceof Error ? error.message : String(error)}); the session goes on`);
    } finally {
        await removeRunFolder(folder.dir);
        await rm(output, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }).catch(() => undefined);
    }
}

for (let run = 1; run <= rounds; run++) {
    for (const kind of KINDS) {
        for (const { variant, kinds } of plan) if (kinds.includes(kind)) await runOnce(variant, kind, run);
    }
}
