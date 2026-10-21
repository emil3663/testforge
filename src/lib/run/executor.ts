import type { GenerationRecord, JsonReport } from "@/lib/report/types";
import { spawn } from "child_process";
import { randomUUID } from "crypto";
import { mkdir, readdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import type { ContentProfile } from "@/lib/generate/mock/types";
import { buildRunSnapshot, createEmptyProgress, finalizeRunJob, runJobs } from "@/lib/run/jobs";
import { runEnv } from "@/lib/run/child-env";
import { authDirFor, prepareRunLogin, removeAuthState, removeStaleAuthDirs, STORAGE_STATE_ENV_VAR } from "@/lib/run/auth";
import type { LoginConfig } from "@/lib/run/auth";
import { INTERACTIVE_ENV_VAR } from "@/lib/run/interactive";
import type { RunJob } from "@/lib/run/jobs";
import { appendProcessOutput } from "@/lib/run/output";
import { buildRunSelection, estimateTestCount } from "@/lib/run/selection";
import { createRunFolder, PLAYWRIGHT_RUNS_DIR, removeRunFolder, removeStaleRunFolders, STALE_RUN_FOLDER_MS } from "@/lib/run/run-folders";
import { recheckSiteSuiteAfterRun } from "@/lib/run/stale-recheck";
import { buildTimingReporterSource, TIMING_FILE_ENV_VAR } from "@/lib/run/timing";
import type { RawTiming } from "@/lib/run/timing";
import { comprehensiveLabel, isComprehensive, isLocalDevelopmentHost, STANDARD_RUN, workerCountFor } from "@/lib/comprehensive/run-mode";
import { splitSuite } from "@/lib/run/split";
import type { RunMode } from "@/lib/comprehensive/run-mode";

export type TestAuditMode = "fast" | "deep";

const RUN_TIMEOUT_GRACE_MS = 15_000;

export function buildProgressReporterSource() {
    return `class TestForgeProgressReporter {
  emit(event) {
    process.stdout.write('TESTFORGE_PROGRESS ' + JSON.stringify(event) + '\\n');
  }

  onBegin(config, suite) {
        const tests = suite.allTests().map((test) => ({ id: test.id, title: test.title }));
        this.emit({ type: 'begin', total: tests.length, tests });
  }

  onTestBegin(test) {
    this.emit({ type: 'test-begin', id: test.id, title: test.title });
  }

  onTestEnd(test, result) {
        this.emit({ type: 'test-end', id: test.id, title: test.title, status: result.status, duration: result.duration });
  }
}

module.exports = TestForgeProgressReporter;
`;
}

function getRunTimeoutBudget(auditMode: TestAuditMode, isLinkHeavySuite: boolean) {
    if (auditMode === "deep") {
        return {
            baseTimeout: isLinkHeavySuite ? 300_000 : 180_000,
            perExecutionBudget: isLinkHeavySuite ? 30_000 : 20_000,
            minTimeout: 240_000,
            maxTimeout: 2_700_000,
        };
    }

    return {
        baseTimeout: 60_000,
        perExecutionBudget: isLinkHeavySuite ? 15_000 : 10_000,
        minTimeout: 120_000,
        maxTimeout: 1_800_000,
    };
}

export function calculateRunTimeout(
    code: string,
    browserProjectCount: number,
    auditMode: TestAuditMode
) {
    const estimatedExecutions = estimateTestCount(code) * browserProjectCount;
    const isLinkHeavySuite = /link health|navigation destination|link types|href|links?/i.test(code);
    const timeoutBudget = getRunTimeoutBudget(auditMode, isLinkHeavySuite);
    const timeout = timeoutBudget.baseTimeout + estimatedExecutions * timeoutBudget.perExecutionBudget;

    return Math.min(Math.max(timeout, timeoutBudget.minTimeout), timeoutBudget.maxTimeout);
}

export function calculateWorkerCount(auditMode: TestAuditMode) {
    return auditMode === "deep" ? 2 : 4;
}

export async function startRunJob(
    code: string,
    selectedPractices: string[],
    auditMode: TestAuditMode,
    baseUrl?: string,
    excludedTestTitles: string[] = [],
    includedTestTitles: string[] = [],
    description = "",
    contentProfile: ContentProfile | null = null,
    enableInteractive = false,
    login: LoginConfig | null = null,
    generation: GenerationRecord | null = null,
    runMode: RunMode = STANDARD_RUN
) {
    const browserProjects = ["chromium"];
    const runSelection = buildRunSelection(code, excludedTestTitles, includedTestTitles);

    if (runSelection.runnableTestCount === 0) {
        throw new Error("No remaining tests are available to run.");
    }

    // Phase 35 (TFP-132, Decision 2): a Comprehensive run on anyone else's
    // host runs one test at a time. TFP-155: the suite now runs as units (one file each), so a run really uses its
    // workers; before, its one file ran on one worker whatever it asked for. A host that isn't local keeps one worker
    // until TFP-157's host limits and request cap (Decision 10: "without the cap, a capped host gets one worker, as
    // today"). The data-changing tests run in the serial group, on one worker, after the rest (TFP-156, Decision 9).
    const units = splitSuite(code);
    const local = isLocalDevelopmentHost(baseUrl);
    const workerCount = local ? workerCountFor(runMode, baseUrl, calculateWorkerCount(auditMode)) : 1;
    const estimatedExecutions = estimateTestCount(code) * browserProjects.length;
    const runTimeout = calculateRunTimeout(
        code,
        browserProjects.length,
        auditMode
    );

    const runsDir = PLAYWRIGHT_RUNS_DIR;
    await mkdir(runsDir, { recursive: true });
    const runId = randomUUID();

    // TFP-222: the run in a folder of its own (run-<id>), with a config whose testDir is that folder, so Playwright's
    // start-up walk sees only this run's files: another run's folder made or removed meanwhile can't fail it. The
    // folder holds the spec, the reporters, the report, the timing file and the login state; the artifacts stay where
    // they were (artifacts-<id>), which persistence reads. Removed when the run is finalized.
    const runFolders = [...runJobs.keys()].map((id) => `run-${id}`);
    await removeStaleRunFolders(runsDir, (name, ageMs) => /^(run|gap|recheck)-/.test(name) && !runFolders.includes(name) && ageMs > STALE_RUN_FOLDER_MS);
    // TFP-156: the serial group runs in a second pass, from a folder of its own the first pass's config leaves out.
    const { dir: runDir, config: configFile } = await createRunFolder(runsDir, `run-${runId}`, ", testIgnore: ['serial/**']");

    // TFP-092: log in once, before any test starts. A failure throws a named
    // RunLoginError and the run never starts - there is no fallback to an
    // unauthenticated run. The state file is per-run, outside the evidence
    // directory, and removed when the run's process closes (or right here if
    // the run never starts). Any left behind by a crashed run are swept first:
    // at the top level (before TFP-222) and in every run's folder.
    const active = [...runJobs.keys()];
    await removeStaleAuthDirs(runsDir, active);
    for (const entry of await readdir(runsDir).catch(() => [] as string[])) {
        if (entry.startsWith("run-")) await removeStaleAuthDirs(join(runsDir, entry), active);
    }
    const authDir = login ? authDirFor(runDir, runId) : null;
    const preparedLogin = login ? await prepareRunLogin(login, runDir, runId).catch(async (error: unknown) => {
        await removeRunFolder(runDir);
        throw error;
    }) : null;
    const storageStateFile = preparedLogin?.stateFile ?? null;
    // The whole suite, as generated: what persistence saves and the stale re-check reads. Not a .spec.ts, so Playwright
    // runs the units beside it, not this.
    const testFile = join(runDir, `suite-${runId}.ts`);
    const jsonReportFile = join(runDir, `report-${runId}.json`);
    const reporterFile = join(runDir, `progress-reporter-${runId}.cjs`);
    // TFP-211: a second reporter records where the time goes, so the generated suite stays as it is.
    const timingReporterFile = join(runDir, `timing-reporter-${runId}.cjs`);
    const timingFile = join(runDir, `timing-${runId}.json`);
    const artifactDir = join(runsDir, `artifacts-${runId}`);

    await writeFile(testFile, code, "utf8");
    const parallelUnits = units.filter((unit) => unit.kind !== "serial");
    const serialUnit = units.find((unit) => unit.kind === "serial") ?? null;
    for (const unit of parallelUnits) await writeFile(join(runDir, unit.name), unit.code, "utf8");
    const serialFolder = serialUnit ? await createRunFolder(runDir, "serial") : null;
    if (serialUnit && serialFolder) await writeFile(join(serialFolder.dir, serialUnit.name), serialUnit.code, "utf8");
    await writeFile(reporterFile, buildProgressReporterSource(), "utf8");
    await writeFile(timingReporterFile, buildTimingReporterSource(), "utf8");
    await mkdir(artifactDir, { recursive: true });

    const playwrightCli = join(
        process.cwd(),
        "node_modules",
        "playwright",
        "cli.js"
    );

    const job: RunJob = {
        id: runId,
        status: "running",
        cancellationRequested: false,
        createdAt: Date.now(),
        finishedAt: null,
        pendingOutput: "",
        outputChunks: [],
        progress: createEmptyProgress(runSelection.runnableTestCount * browserProjects.length),
        activeExecutions: new Map(),
        process: null,
        testFile,
        jsonReportFile,
        reporterFile,
        timingReporterFile,
        timingFile,
        artifactDir,
        runDir,
        baseUrl,
        description,
        auditMode,
        selectedPractices,
        contentProfile,
        enableInteractive,
        login,
        generation,
        runMode,
        workerCount,
        redactions: preparedLogin?.secrets ?? [],
        artifactFiles: new Map(),
        result: null,
    };

    // Phase 42 (TFP-202): only what the run needs, never TestForge's own environment (keys, tokens,
    // settings) - a run can hold tests a model wrote (gap tests, candidates, promoted entries).
    const childEnv = runEnv({
        // Always set, never inherited: skipped-by-default interactive tests
        // (journeys) run only when this run explicitly asked.
        [INTERACTIVE_ENV_VAR]: enableInteractive ? "1" : "0",
        PLAYWRIGHT_JSON_OUTPUT_FILE: jsonReportFile,
        [TIMING_FILE_ENV_VAR]: timingFile,
        FORCE_COLOR: "0",
        HOME:
            process.env.HOME ??
            process.env.USERPROFILE ??
            process.cwd(),
        // Likewise never inherited: only this run's own login state, if any.
        ...(storageStateFile ? { [STORAGE_STATE_ENV_VAR]: storageStateFile } : {}),
    });

    // TFP-156 (Decision 9): the read-only units first, on the run's workers; then the serial group, on one worker, so its
    // tests run one at a time and none alongside a read-only test. Two Playwright runs, each with its own report, timing
    // file and artifact folder (a run clears its output folder as it starts), merged into the run's own after the last.
    // Not Playwright's project dependencies: a dependent project doesn't run once any test it depends on fails.
    // A pass the run's selection leaves empty is skipped: Playwright would report "No tests found" as an error.
    const selects = (unitCodes: string[]) => unitCodes.some((unitCode) => buildRunSelection(unitCode, excludedTestTitles, includedTestTitles).runnableTestCount > 0);
    const passes = [
        ...(selects(parallelUnits.map((unit) => unit.code)) || !serialUnit ? [{ config: configFile, workers: workerCount, output: artifactDir, report: jsonReportFile, timing: timingFile }] : []),
        ...(serialFolder && serialUnit && selects([serialUnit.code]) ? [{ config: serialFolder.config, workers: 1, output: join(artifactDir, "serial"), report: join(runDir, `report-${runId}-serial.json`), timing: join(runDir, `timing-${runId}-serial.json`) }] : []),
    ];
    const spawnPass = (pass: (typeof passes)[number]) => spawn(
        process.execPath,
        [
            playwrightCli,
            "test",
            "--config",
            pass.config,
            `--reporter=${reporterFile},${timingReporterFile},json`,
            "--timeout=30000",
            `--output=${pass.output.replace(/\\/g, "/")}`,
            `--workers=${pass.workers}`,
            ...(runSelection.grepPattern ? [`--grep=${runSelection.grepPattern}`] : []),
            ...(runSelection.grepInvertPattern ? [`--grep-invert=${runSelection.grepInvertPattern}`] : []),
            ...browserProjects.flatMap((project) => [`--project=${project}`]),
        ],
        {
            cwd: process.cwd(),
            env: { ...childEnv, PLAYWRIGHT_JSON_OUTPUT_FILE: pass.report, [TIMING_FILE_ENV_VAR]: pass.timing },
            windowsHide: true,
            stdio: ["ignore", "pipe", "pipe"],
        }
    );
    const attach = (child: ReturnType<typeof spawnPass>) => {
        child.stdout?.setEncoding("utf8");
        child.stderr?.setEncoding("utf8");
        child.stdout?.on("data", (chunk: string) => appendProcessOutput(job, chunk));
        child.stderr?.on("data", (chunk: string) => appendProcessOutput(job, chunk));
        child.on("error", (error) => {
            job.outputChunks.push(`${error.message}\n`);
        });
    };

    const first = spawnPass(passes[0]);
    job.process = first;
    runJobs.set(runId, job);
    job.outputChunks.push(
        `Run budget: up to ${Math.round(runTimeout / 1000)}s for ~${estimatedExecutions} execution(s) across ${browserProjects.length} browser project(s) in ${auditMode} mode.\n`
    );
    if (isComprehensive(runMode)) {
        job.outputChunks.push(
            `${comprehensiveLabel(runMode)} run with ${workerCount} worker: one test at a time, on every host.\n`
        );
    }
    // TFP-155: how the suite was split, and how many workers take its units.
    const pageUnits = parallelUnits.filter((unit) => unit.kind === "page").length;
    job.outputChunks.push(
        `Split into ${parallelUnits.length} unit file(s) (${pageUnits} page(s), ${parallelUnits.length - pageUnits} other), run by ${workerCount} worker(s)${local ? "" : ": one, as this host isn't local"}.\n`
    );
    if (serialUnit) {
        job.outputChunks.push("The serial group (data-changing and model-written tests) runs after them, one test at a time (Decision 9).\n");
    }
    attach(first);

    let forceStopTimer: NodeJS.Timeout | null = null;

    // One budget for both passes: the timer stops whichever is running.
    const timeoutId = setTimeout(() => {
        const child = job.process;
        if (job.status === "running" && child && child.exitCode === null) {
            job.cancellationRequested = true;
            job.outputChunks.push(
                `Run timed out after ${Math.round(runTimeout / 1000)}s and TestForge requested a graceful stop.\n`
            );
            child.kill("SIGINT");

            forceStopTimer = setTimeout(() => {
                if (job.status === "running" && child.exitCode === null) {
                    child.kill("SIGTERM");
                    job.outputChunks.push("Playwright did not stop in time, so TestForge forced termination.\n");
                }
            }, RUN_TIMEOUT_GRACE_MS);
        }
    }, runTimeout);

    let passIndex = 0;
    const onClose = () => {
        appendProcessOutput(job, "", true);
        passIndex += 1;
        if (passIndex < passes.length && !job.cancellationRequested) {
            const next = spawnPass(passes[passIndex]);
            job.process = next;
            attach(next);
            next.on("close", onClose);
            return;
        }
        clearTimeout(timeoutId);
        if (forceStopTimer) {
            clearTimeout(forceStopTimer);
        }
        void mergePasses(passes.map((pass) => pass.report), jsonReportFile, passes.map((pass) => pass.timing), timingFile)
            // Phase 42 (TFP-191): failing reused tests on a page that changed are regenerated and re-run
            // first, with this run's login state, so the report has only the re-run's results.
            .then(() => recheckSiteSuiteAfterRun(job, { env: childEnv, workerCount, browserProjects, timeoutMs: runTimeout }))
            .catch((error: unknown) => {
                job.outputChunks.push(`Site suite: the failing reused tests' pages could not be read again (${error instanceof Error ? error.message : String(error)}); their failures stand.\n`);
            })
            .finally(() => {
                void removeAuthState(authDir);
                void finalizeRunJob(job);
            });
    };
    first.on("close", onClose);

    return buildRunSnapshot(job);
}

type ReportStats = { startTime?: string; duration?: number; expected?: number; unexpected?: number; flaky?: number; skipped?: number };

/**
 * TFP-156: the passes' JSON reports and timing files, merged into the run's own, in pass order (the read-only units,
 * then the serial group). A pass that wrote nothing adds nothing; a single pass that wrote the run's own files is left
 * as it is.
 */
export async function mergePasses(reports: string[], report: string, timings: string[], timing: string) {
    if (reports.length > 1 || reports[0] !== report) {
        const found = (await Promise.all(reports.map((file) => readFile(file, "utf8").then((text) => JSON.parse(text) as JsonReport & { stats?: ReportStats }).catch(() => null))))
            .filter((entry): entry is JsonReport & { stats?: ReportStats } => entry !== null);
        if (found.length > 0) {
            const stats = found.map((entry) => entry.stats ?? {});
            const starts = stats.map((entry) => Date.parse(entry.startTime ?? "")).filter((value) => Number.isFinite(value));
            const ends = stats.map((entry) => Date.parse(entry.startTime ?? "") + (entry.duration ?? 0)).filter((value) => Number.isFinite(value));
            const total = (key: "expected" | "unexpected" | "flaky" | "skipped") => stats.reduce((sum, entry) => sum + (entry[key] ?? 0), 0);
            const span = starts.length > 0 ? { startTime: new Date(Math.min(...starts)).toISOString(), duration: Math.max(...ends) - Math.min(...starts) } : {};
            await writeFile(report, JSON.stringify({
                ...found[0],
                suites: found.flatMap((entry) => entry.suites ?? []),
                errors: found.flatMap((entry) => entry.errors ?? []),
                stats: { ...stats[0], ...span, expected: total("expected"), unexpected: total("unexpected"), flaky: total("flaky"), skipped: total("skipped") },
            }), "utf8");
        }
    }
    if (timings.length > 1 || timings[0] !== timing) {
        const found = (await Promise.all(timings.map((file) => readFile(file, "utf8").then((text) => JSON.parse(text) as RawTiming).catch(() => null))))
            .filter((entry): entry is RawTiming => entry !== null);
        if (found.length > 0) await writeFile(timing, JSON.stringify({ version: 1, tests: found.flatMap((entry) => entry.tests) }), "utf8");
    }
}
