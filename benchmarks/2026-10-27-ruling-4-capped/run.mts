// Gate D's re-measurement ruling 4 (Emil, 2026-10-27): does the request cap change results? The local with-bugs
// Toolshop, the same suites run two ways, interleaved, three rounds:
// - W1:  1 worker, uncapped, on loopback (http://localhost:4200): the uncapped answer;
// - CAP: the capped row as the app runs it (Decision 10: at most 3 workers sharing 5 requests per second, TFP-157's
//        slot server and run-time module), reached through this machine's LAN address so Decision 10 treats it as
//        remote. The suite is W1's with its page origin rewritten (run-all.sh), so both run the same tests.
// What CAP counts: the app calls its API at http://localhost:8091 whatever host its pages come from, so counting only
// the LAN address (as the app would) leaves the API uncapped, where on the hosted site the API is under the site's
// domain and capped. CAP_DOMAIN (default "", every request) sets what counts; "" also counts the page's two
// cdnjs.cloudflare.com requests, so it caps slightly more than the hosted site does, not less.
// Adapted from benchmarks/2026-10-27-gate-d-rerun/run.mts (frozen): the same passes (split into units, the read-only
// units on the variant's workers, then the serial group on one worker, merged as the executor merges them; Playwright
// --timeout=30000, Chromium, interactive off, the timing reporter beside the JSON one), with a site per variant.
// Writes <runsDir>/<variant>/<label>-<kind>-run<n>-records.json and -timing.json.
// Usage (from the repo root): node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types <this> <label> <loopbackSite> <capSite> <runsDir> <rounds> [<kinds>]
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
const { hostLimitsFor } = await load("src/lib/run/host-limits.ts");
const { requestCapEnv, startRequestCap, withRequestCap, writeRequestCapModule } = await load("src/lib/run/request-cap.ts");

const [label, loopbackSite, capSite, runsDir, roundsArg, kindsArg] = process.argv.slice(2);
const rounds = Number(roundsArg);
const KINDS = (kindsArg ?? "standard,security,accessibility").split(",");
const CAP_DOMAIN = process.env.CAP_DOMAIN ?? "";

const loopback = loopbackSite.replace(/\/$/, "");
const capOrigin = capSite.replace(/\/$/, "");
const capped = hostLimitsFor(capOrigin, { ownershipConfirmed: false });
if (capped.row !== "capped") throw new Error(`CAP needs a capped host; ${capOrigin} is ${capped.row}`);
if (hostLimitsFor(loopback, { ownershipConfirmed: false }).row !== "local") throw new Error(`W1 needs a local host; ${loopback} isn't`);
const VARIANTS: Record<string, { origin: string; workers: number; cap: boolean }> = {
    W1: { origin: loopback, workers: 1, cap: false },
    CAP: { origin: capOrigin, workers: capped.workers, cap: true },
};

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

/** A test that ran out of time, as the re-measurement's analyse.mts counts it: teardown and afterAll included. */
const TIMEOUT = /Test timeout of \d+ms exceeded|Timeout \d+ms exceeded|timed out after \d+|exceeded the test timeout|hook timeout of \d+ms exceeded/i;

async function runOnce(variant: string, kind: string, run: number) {
    const settings = VARIANTS[variant];
    const dir = join(runsDir, variant);
    const name = `ruling-4-${variant}-${label}-${kind}-${run}-${process.pid}`;
    const code = await readFile(join(dir, `${label}-${kind}-suite.spec.ts`), "utf8");
    const folder = await createRunFolder(PLAYWRIGHT_RUNS_DIR, name, ", testIgnore: ['serial/**']");
    const reporter = join(folder.dir, "timing-reporter.cjs");
    await writeFile(reporter, buildTimingReporterSource(), "utf8");
    const output = join(PLAYWRIGHT_RUNS_DIR, `${name}-artifacts`);
    const passes: Pass[] = [{ config: folder.config, report: join(folder.dir, "report.json"), timing: join(folder.dir, "timing.json"), output, workers: settings.workers }];
    const cap = settings.cap ? await startRequestCap(capped.requestsPerSecond) : null;
    if (cap) await writeRequestCapModule(folder.dir);
    const prepare = (unitCode: string, unitDir: string) => (cap ? withRequestCap(unitCode, unitDir, folder.dir) : unitCode);
    const split = splitSuite(code) as Array<{ name: string; kind: string; code: string }>;
    let serialTests = 0;
    for (const unit of split.filter((entry) => entry.kind !== "serial")) await writeFile(join(folder.dir, unit.name), prepare(unit.code, folder.dir), "utf8");
    const serial = split.find((entry) => entry.kind === "serial");
    if (serial) {
        const serialFolder = await createRunFolder(folder.dir, "serial");
        await writeFile(join(serialFolder.dir, serial.name), prepare(serial.code, serialFolder.dir), "utf8");
        serialTests = (serial.code.match(/\n\s*test(\.skip|\.fixme)?\(\s*'/g) ?? []).length;
        passes.push({ config: serialFolder.config, report: join(folder.dir, "report-serial.json"), timing: join(folder.dir, "timing-serial.json"), output: join(output, "serial"), workers: 1 });
    }
    const extraEnv = cap ? requestCapEnv(cap, CAP_DOMAIN) : {};
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
        const summary = summarizeTiming(raw, { baseUrl: settings.origin });
        const timeouts = records.filter((record) => record.status === "Failed" && TIMEOUT.test(record.rawMessage ?? "")).map((record) => `${record.title} @${record.page ?? ""}`);
        const out = (suffix: string) => join(dir, `${label}-${kind}-run${run}-${suffix}.json`);
        await writeFile(out("records"), JSON.stringify({
            label, variant, site: settings.origin, kind, run, commit: process.env.MEASURE_COMMIT ?? "?", startedAt: new Date(started).toISOString(), runSeconds: Math.round(runMs / 1000),
            workers: settings.workers, workersUsed: summary.workers ?? null, units: split.length, passes: passes.length, serialTests, tests: records.length, byStatus,
            requestCap: capStats, capDomain: cap ? CAP_DOMAIN : null, timeouts,
            records: records.map((record) => ({ title: record.title, page: record.page ?? null, status: record.status, message: record.status === "Failed" || record.status === "Blocked" ? (record.rawMessage ?? "").replace(/\s+/g, " ").slice(0, 600) : "", skipReason: record.skipReason ?? "", findings: record.findings ?? [], issues: (record.issues ?? []).map((issue) => `${issue.kind} ${issue.category} ${issue.detail}`) })),
        }, null, 2), "utf8");
        await writeFile(out("timing"), JSON.stringify(raw), "utf8");
        const capLine = capStats ? `; cap: ${capStats.requests} slot(s), ${capStats.waited} waited, mean wait ${(capStats.waitedMs / Math.max(1, capStats.waited) / 1000).toFixed(2)} s, ${(capStats.requests / (runMs / 1000)).toFixed(1)} per s` : "";
        console.log(`${label}: ${new Date().toTimeString().slice(0, 8)} ${variant} ${kind} run ${run}: ${Math.round(runMs / 1000)} s, ${settings.workers} worker(s) (${summary.workers ?? "?"} used), ${split.length} unit(s) in ${passes.length} pass(es), ${records.length} tests ${JSON.stringify(byStatus)}; timeouts ${timeouts.length}${capLine}`);
    } catch (error) {
        console.log(`${label}: ${new Date().toTimeString().slice(0, 8)} ${variant} ${kind} run ${run}: FAILED to report (${error instanceof Error ? error.message : String(error)}); the session goes on`);
    } finally {
        await cap?.close();
        await removeRunFolder(folder.dir);
        await rm(output, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }).catch(() => undefined);
    }
}

for (let run = 1; run <= rounds; run++) {
    for (const kind of KINDS) for (const variant of ["W1", "CAP"]) await runOnce(variant, kind, run);
}
