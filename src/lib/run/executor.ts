import type { GenerationRecord } from "@/lib/report/types";
import { spawn } from "child_process";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { join, relative } from "path";
import type { ContentProfile } from "@/lib/generate/mock/types";
import { buildRunSnapshot, createEmptyProgress, finalizeRunJob, runJobs } from "@/lib/run/jobs";
import { runEnv } from "@/lib/run/child-env";
import { authDirFor, prepareRunLogin, removeAuthState, removeStaleAuthDirs, STORAGE_STATE_ENV_VAR } from "@/lib/run/auth";
import type { LoginConfig } from "@/lib/run/auth";
import { INTERACTIVE_ENV_VAR } from "@/lib/run/interactive";
import type { RunJob } from "@/lib/run/jobs";
import { appendProcessOutput } from "@/lib/run/output";
import { buildRunSelection, estimateTestCount } from "@/lib/run/selection";
import { recheckSiteSuiteAfterRun } from "@/lib/run/stale-recheck";
import { comprehensiveLabel, isComprehensive, STANDARD_RUN, workerCountFor } from "@/lib/comprehensive/run-mode";
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
    // host runs one test at a time.
    const workerCount = workerCountFor(runMode, baseUrl, calculateWorkerCount(auditMode));
    const estimatedExecutions = estimateTestCount(code) * browserProjects.length;
    const runTimeout = calculateRunTimeout(
        code,
        browserProjects.length,
        auditMode
    );

    const runsDir = join(process.cwd(), ".playwright-runs");
    await mkdir(runsDir, { recursive: true });
    const runId = randomUUID();

    // TFP-092: log in once, before any test starts. A failure throws a named
    // RunLoginError and the run never starts - there is no fallback to an
    // unauthenticated run. The state file is per-run, outside the evidence
    // directory, and removed when the run's process closes (or right here if
    // the run never starts). Any left behind by a crashed run are swept first.
    await removeStaleAuthDirs(runsDir, runJobs.keys());
    const authDir = login ? authDirFor(runsDir, runId) : null;
    const preparedLogin = login ? await prepareRunLogin(login, runsDir, runId) : null;
    const storageStateFile = preparedLogin?.stateFile ?? null;
    const testFile = join(runsDir, `test-${runId}.spec.ts`);
    const jsonReportFile = join(runsDir, `report-${runId}.json`);
    const reporterFile = join(runsDir, `progress-reporter-${runId}.cjs`);
    const artifactDir = join(runsDir, `artifacts-${runId}`);

    await writeFile(testFile, code, "utf8");
    await writeFile(reporterFile, buildProgressReporterSource(), "utf8");
    await mkdir(artifactDir, { recursive: true });

    const testPath = relative(process.cwd(), testFile).replace(/\\/g, "/");
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
        artifactDir,
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
        FORCE_COLOR: "0",
        HOME:
            process.env.HOME ??
            process.env.USERPROFILE ??
            process.cwd(),
        // Likewise never inherited: only this run's own login state, if any.
        ...(storageStateFile ? { [STORAGE_STATE_ENV_VAR]: storageStateFile } : {}),
    });

    const child = spawn(
        process.execPath,
        [
            playwrightCli,
            "test",
            testPath,
            `--reporter=${reporterFile},json`,
            "--timeout=30000",
            `--output=${artifactDir.replace(/\\/g, "/")}`,
            `--workers=${workerCount}`,
            ...(runSelection.grepPattern ? [`--grep=${runSelection.grepPattern}`] : []),
            ...(runSelection.grepInvertPattern ? [`--grep-invert=${runSelection.grepInvertPattern}`] : []),
            ...browserProjects.flatMap((project) => [`--project=${project}`]),
        ],
        {
            cwd: process.cwd(),
            env: childEnv,
            windowsHide: true,
            stdio: ["ignore", "pipe", "pipe"],
        }
    );

    job.process = child;
    runJobs.set(runId, job);
    job.outputChunks.push(
        `Run budget: up to ${Math.round(runTimeout / 1000)}s for ~${estimatedExecutions} execution(s) across ${browserProjects.length} browser project(s) in ${auditMode} mode.\n`
    );
    if (isComprehensive(runMode)) {
        job.outputChunks.push(
            `${comprehensiveLabel(runMode)} run with ${workerCount} worker: one test at a time, on every host.\n`
        );
    }

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => appendProcessOutput(job, chunk));
    child.stderr?.on("data", (chunk: string) => appendProcessOutput(job, chunk));
    child.on("error", (error) => {
        job.outputChunks.push(`${error.message}\n`);
    });

    let forceStopTimer: NodeJS.Timeout | null = null;

    const timeoutId = setTimeout(() => {
        if (job.status === "running" && child.exitCode === null) {
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

    child.on("close", () => {
        clearTimeout(timeoutId);
        if (forceStopTimer) {
            clearTimeout(forceStopTimer);
        }
        appendProcessOutput(job, "", true);
        // Phase 42 (TFP-191): failing reused tests on a page that changed are regenerated and re-run
        // first, with this run's login state, so the report has only the re-run's results.
        void recheckSiteSuiteAfterRun(job, { env: childEnv, workerCount, browserProjects, timeoutMs: runTimeout })
            .catch((error: unknown) => {
                job.outputChunks.push(`Site suite: the failing reused tests' pages could not be read again (${error instanceof Error ? error.message : String(error)}); their failures stand.\n`);
            })
            .finally(() => {
                void removeAuthState(authDir);
                void finalizeRunJob(job);
            });
    });

    return buildRunSnapshot(job);
}
