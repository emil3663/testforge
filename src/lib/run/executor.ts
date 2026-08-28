import { spawn } from "child_process";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { join, relative } from "path";
import { buildRunSnapshot, createEmptyProgress, finalizeRunJob, runJobs } from "@/lib/run/jobs";
import type { RunJob } from "@/lib/run/jobs";
import { appendProcessOutput } from "@/lib/run/output";
import { buildRunSelection, estimateTestCount } from "@/lib/run/selection";

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
    includedTestTitles: string[] = []
) {
    const browserProjects = ["chromium"];
    const runSelection = buildRunSelection(code, excludedTestTitles, includedTestTitles);

    if (runSelection.runnableTestCount === 0) {
        throw new Error("No remaining tests are available to run.");
    }

    const workerCount = calculateWorkerCount(auditMode);
    const estimatedExecutions = estimateTestCount(code) * browserProjects.length;
    const runTimeout = calculateRunTimeout(
        code,
        browserProjects.length,
        auditMode
    );

    const runsDir = join(process.cwd(), ".playwright-runs");
    await mkdir(runsDir, { recursive: true });
    const runId = randomUUID();
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
        selectedPractices,
        artifactFiles: new Map(),
        result: null,
    };

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
            env: {
                ...process.env,
                PLAYWRIGHT_JSON_OUTPUT_FILE: jsonReportFile,
                FORCE_COLOR: "0",
                HOME:
                    process.env.HOME ??
                    process.env.USERPROFILE ??
                    process.cwd(),
            },
            windowsHide: true,
            stdio: ["ignore", "pipe", "pipe"],
        }
    );

    job.process = child;
    runJobs.set(runId, job);
    job.outputChunks.push(
        `Run budget: up to ${Math.round(runTimeout / 1000)}s for ~${estimatedExecutions} execution(s) across ${browserProjects.length} browser project(s) in ${auditMode} mode.\n`
    );

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
        void finalizeRunJob(job);
    });

    return buildRunSnapshot(job);
}
