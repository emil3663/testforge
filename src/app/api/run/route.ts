import { NextRequest, NextResponse } from "next/server";
import { type ChildProcess, spawn } from "child_process";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import { join, relative, resolve } from "path";
import { randomUUID } from "crypto";
import { flattenSuites } from "@/lib/report/execution";
import { buildReport } from "@/lib/report/report";
import { normalizeExecutionTitle, stripAnsi } from "@/lib/report/text";
import type { ExecutionRecord, JsonReport, ReportArtifactItem, RunReport } from "@/lib/report/types";

type TestAuditMode = "fast" | "deep";
type RunLifecycleStatus = "queued" | "running" | "passed" | "failed" | "cancelled";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ActiveExecution {
    id: string;
    title: string;
    linkLabel: string | null;
}

type PlannedExecutionStatus = "not-run" | "running" | "passed" | "failed" | "flaky" | "blocked" | "interrupted";

interface PlannedExecutionSnapshot {
    id: string;
    title: string;
    linkLabel: string | null;
    status: PlannedExecutionStatus;
    duration: number | null;
}

interface RunProgressSnapshot {
    totalTests: number;
    startedTests: number;
    completedTests: number;
    passedTests: number;
    failedTests: number;
    flakyTests: number;
    blockedTests: number;
    currentTestTitle: string | null;
    currentLinkLabel: string | null;
    lastCompletedTitle: string | null;
    activeExecutions: ActiveExecution[];
    plannedExecutions: PlannedExecutionSnapshot[];
}

interface RunResultPayload {
    runId: string;
    runStatus: Exclude<RunLifecycleStatus, "queued" | "running">;
    passed: boolean;
    output: string;
    duration: number;
    progress: RunProgressSnapshot;
    report?: RunReport;
}

interface RunStatusPayload {
    runId: string;
    runStatus: RunLifecycleStatus;
    duration: number;
    progress: RunProgressSnapshot;
    cancellationRequested: boolean;
    result?: RunResultPayload;
}

interface RunJob {
    id: string;
    status: RunLifecycleStatus;
    cancellationRequested: boolean;
    createdAt: number;
    finishedAt: number | null;
    pendingOutput: string;
    outputChunks: string[];
    progress: RunProgressSnapshot;
    activeExecutions: Map<string, ActiveExecution>;
    process: ChildProcess | null;
    testFile: string;
    jsonReportFile: string;
    reporterFile: string;
    artifactDir: string;
    baseUrl?: string;
    selectedPractices: string[];
    artifactFiles: Map<string, { filePath: string; fileName: string; contentType: string }>;
    result: RunResultPayload | null;
}

const PROGRESS_PREFIX = "TESTFORGE_PROGRESS ";
const RUN_TIMEOUT_GRACE_MS = 15_000;
const globalRunJobs = globalThis as typeof globalThis & {
    __testforgeRunJobs?: Map<string, RunJob>;
};
const runJobs = globalRunJobs.__testforgeRunJobs ?? (globalRunJobs.__testforgeRunJobs = new Map());

function estimateTestCount(code: string) {
    const matches = code.match(/\btest\s*\(/g);
    return Math.max(1, matches?.length ?? 0);
}

function extractDeclaredTestTitles(code: string) {
    const titles: string[] = [];
    const testTitlePattern = /\btest(?:\.only|\.skip|\.fixme)?\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g;

    for (const match of code.matchAll(testTitlePattern)) {
        const rawTitle = match[2] ?? "";
        titles.push(rawTitle.replace(/\\([\\'"`])/g, "$1"));
    }

    return titles;
}

function escapeRegexLiteral(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildRunSelection(code: string, excludedTestTitles: string[], includedTestTitles: string[] = []) {
    const declaredTitles = extractDeclaredTestTitles(code);
    const uniqueExcludedTitles = [...new Set(excludedTestTitles.filter((title) => title.trim().length > 0))];
    const uniqueIncludedTitles = [...new Set(includedTestTitles.filter((title) => title.trim().length > 0))];

    const candidateTitles = uniqueIncludedTitles.length > 0
        ? declaredTitles.filter((title) => uniqueIncludedTitles.includes(title))
        : declaredTitles;

    if (uniqueExcludedTitles.length === 0 && uniqueIncludedTitles.length === 0) {
        return {
            runnableTestCount: declaredTitles.length > 0 ? declaredTitles.length : estimateTestCount(code),
            grepPattern: null,
            grepInvertPattern: null,
        };
    }

    const excludedTitleSet = new Set(uniqueExcludedTitles);
    const runnableTitles = candidateTitles.filter((title) => !excludedTitleSet.has(title));
    const fallbackCount = uniqueIncludedTitles.length > 0
        ? uniqueIncludedTitles.filter((title) => !excludedTitleSet.has(title)).length
        : estimateTestCount(code);
    const runnableTestCount = declaredTitles.length > 0 ? runnableTitles.length : fallbackCount;

    return {
        runnableTestCount,
        grepPattern: uniqueIncludedTitles.length > 0 ? uniqueIncludedTitles.map(escapeRegexLiteral).join("|") : null,
        grepInvertPattern: uniqueExcludedTitles.map(escapeRegexLiteral).join("|"),
    };
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

function calculateRunTimeout(
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

function createEmptyProgress(totalTests = 0): RunProgressSnapshot {
    return {
        totalTests,
        startedTests: 0,
        completedTests: 0,
        passedTests: 0,
        failedTests: 0,
        flakyTests: 0,
        blockedTests: 0,
        currentTestTitle: null,
        currentLinkLabel: null,
        lastCompletedTitle: null,
        activeExecutions: [],
        plannedExecutions: [],
    };
}

function deriveLinkLabel(title: string) {
    const normalizedTitle = normalizeExecutionTitle(title);
    return normalizedTitle || null;
}

function updateActiveExecutions(job: RunJob) {
    job.progress.activeExecutions = [...job.activeExecutions.values()].slice(0, 3);
    job.progress.currentTestTitle = job.progress.activeExecutions[0]?.title ?? null;
    job.progress.currentLinkLabel = job.progress.activeExecutions[0]?.linkLabel ?? null;
}

function updatePlannedExecutionStatus(
    job: RunJob,
    id: string,
    status: PlannedExecutionStatus,
    duration?: number | null
) {
    const execution = job.progress.plannedExecutions.find((entry) => entry.id === id);

    if (execution) {
        execution.status = status;
        if (duration !== undefined) {
            execution.duration = duration;
        }
    }
}

function syncPlannedExecutions(job: RunJob, plannedTests: Array<{ id: string; title: string }>) {
    const uniqueExecutions = plannedTests.reduce((executions, test) => {
        if (!executions.some((entry) => entry.id === test.id)) {
            executions.push({
                id: test.id,
                title: test.title,
                linkLabel: deriveLinkLabel(test.title),
                status: "not-run" as PlannedExecutionStatus,
                duration: null,
            });
        }

        return executions;
    }, [] as PlannedExecutionSnapshot[]);

    if (uniqueExecutions.length > 0) {
        job.progress.plannedExecutions = uniqueExecutions;
        job.progress.totalTests = Math.max(job.progress.totalTests, uniqueExecutions.length);
    }
}

function updateCompletedCounts(job: RunJob, status: string | undefined) {
    if (status === "passed") {
        job.progress.passedTests += 1;
        return;
    }

    if (status === "flaky") {
        job.progress.flakyTests += 1;
        return;
    }

    if (status === "skipped" || status === "interrupted") {
        job.progress.blockedTests += 1;
        return;
    }

    job.progress.failedTests += 1;
}

function mapResultStatusToPlannedStatus(status: string | undefined): PlannedExecutionStatus {
    if (status === "passed") {
        return "passed";
    }

    if (status === "flaky") {
        return "flaky";
    }

    if (status === "skipped") {
        return "blocked";
    }

    if (status === "interrupted") {
        return "interrupted";
    }

    return "failed";
}

function finalizeInterruptedPlannedExecutions(job: RunJob) {
    let interruptedCount = 0;

    for (const execution of job.progress.plannedExecutions) {
        if (execution.status === "running") {
            execution.status = "interrupted";
            interruptedCount += 1;
        }
    }

    if (interruptedCount > 0) {
        job.progress.blockedTests += interruptedCount;
    }
}

function handleProgressEvent(job: RunJob, line: string) {
    if (!line.startsWith(PROGRESS_PREFIX)) {
        return false;
    }

    const payload = line.slice(PROGRESS_PREFIX.length);

    try {
        const event = JSON.parse(payload) as
            | { type: "begin"; total: number; tests?: Array<{ id: string; title: string }> }
            | { type: "test-begin"; id: string; title: string }
            | { type: "test-end"; id: string; title: string; status?: string; duration?: number };

        if (event.type === "begin") {
            job.progress.totalTests = Math.max(job.progress.totalTests, event.total || 0);
            syncPlannedExecutions(job, event.tests ?? []);
            return true;
        }

        if (event.type === "test-begin") {
            if (!job.activeExecutions.has(event.id)) {
                job.progress.startedTests += 1;
            }

            job.activeExecutions.set(event.id, {
                id: event.id,
                title: event.title,
                linkLabel: deriveLinkLabel(event.title),
            });
            updatePlannedExecutionStatus(job, event.id, "running", null);
            updateActiveExecutions(job);
            return true;
        }

        if (event.type === "test-end") {
            if (job.activeExecutions.has(event.id)) {
                job.activeExecutions.delete(event.id);
            }

            job.progress.completedTests += 1;
            job.progress.lastCompletedTitle = event.title;
            updatePlannedExecutionStatus(job, event.id, mapResultStatusToPlannedStatus(event.status), event.duration ?? null);
            updateCompletedCounts(job, event.status);
            updateActiveExecutions(job);
            return true;
        }
    } catch {
        return false;
    }

    return false;
}

function appendProcessOutput(job: RunJob, chunk: string, flush = false) {
    if (!chunk && !flush) {
        return;
    }

    const sanitizedChunk = stripAnsi(chunk);
    const combinedOutput = `${job.pendingOutput}${sanitizedChunk}`;
    const endsWithLineBreak = /\r?\n$/.test(combinedOutput);
    const lines = combinedOutput.split(/\r?\n/);
    const rawLines = endsWithLineBreak || flush ? lines.filter(Boolean) : lines.slice(0, -1).filter(Boolean);

    job.pendingOutput = endsWithLineBreak || flush ? "" : lines.at(-1) ?? "";

    for (const line of rawLines) {
        if (!handleProgressEvent(job, line)) {
            job.outputChunks.push(`${line}\n`);
        }
    }
}

function buildRunSnapshot(job: RunJob): RunStatusPayload {
    return {
        runId: job.id,
        runStatus: job.status,
        duration: (job.finishedAt ?? Date.now()) - job.createdAt,
        progress: job.progress,
        cancellationRequested: job.cancellationRequested,
        result: job.result ?? undefined,
    };
}

function buildProgressReporterSource() {
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

async function finalizeRunJob(job: RunJob) {
    job.finishedAt = Date.now();
    finalizeInterruptedPlannedExecutions(job);
    job.progress.completedTests = Math.min(job.progress.completedTests, Math.max(job.progress.totalTests, job.progress.completedTests));
    job.progress.totalTests = Math.max(job.progress.totalTests, job.progress.completedTests, estimateTestCount(await readFile(job.testFile, "utf8").catch(() => "")));

    const reportText = await readFile(job.jsonReportFile, "utf8").catch(() => "");
    const parsedReport: JsonReport | null = reportText
        ? (JSON.parse(reportText) as JsonReport)
        : null;
    const output = job.outputChunks.join("").trim();
    const duration = job.finishedAt - job.createdAt;

    if (parsedReport) {
        const executionRecords = flattenSuites(parsedReport.suites ?? []);
        const aggregatedReport = buildReport(
            parsedReport,
            job.selectedPractices,
            output || buildConsoleSummary(executionRecords, duration),
            job.baseUrl
        );
        job.artifactFiles = collectArtifactFiles(executionRecords);
        const zeroExecution = aggregatedReport.summary.planned === 0;

        if (zeroExecution) {
            const reportedErrors = (parsedReport.errors ?? [])
                .map((error) => error.message?.trim())
                .filter((message): message is string => Boolean(message));
            const finalOutput = [
                ...reportedErrors,
                output,
                "Playwright completed without executing any tests. TestForge did not produce a structured report because no test cases actually ran.",
            ]
                .filter(Boolean)
                .join("\n\n")
                .trim();

            job.result = {
                runId: job.id,
                runStatus: job.cancellationRequested ? "cancelled" : "failed",
                passed: false,
                output: finalOutput || "Playwright completed without executing any tests.",
                duration,
                progress: {
                    ...job.progress,
                    totalTests: 0,
                    completedTests: 0,
                    passedTests: 0,
                    failedTests: 0,
                    flakyTests: 0,
                    blockedTests: 0,
                },
            };
            job.progress = job.result.progress;
            job.status = job.result.runStatus;
            job.process = null;

            await Promise.all([
                unlink(job.testFile).catch(() => { }),
                unlink(job.jsonReportFile).catch(() => { }),
                unlink(job.reporterFile).catch(() => { }),
            ]);
            return;
        }

        const runStatus: RunResultPayload["runStatus"] = job.cancellationRequested
            ? "cancelled"
            : aggregatedReport.summary.failed === 0
                ? "passed"
                : "failed";

        job.result = {
            runId: job.id,
            runStatus,
            passed: runStatus === "passed",
            output: aggregatedReport.rawOutput,
            duration,
            progress: {
                ...job.progress,
                totalTests: Math.max(job.progress.totalTests, aggregatedReport.summary.planned),
                completedTests: Math.max(job.progress.completedTests, aggregatedReport.summary.executed + aggregatedReport.summary.blocked),
                passedTests: aggregatedReport.summary.passed,
                failedTests: aggregatedReport.summary.failed,
                flakyTests: aggregatedReport.summary.flaky,
                blockedTests: aggregatedReport.summary.blocked,
            },
            report: {
                ...aggregatedReport,
                defects: {
                    ...aggregatedReport.defects,
                    issues: aggregatedReport.defects.issues.map((defect) => ({
                        ...defect,
                        artifacts: defect.artifacts.map((item) => withArtifactDownloadPath(item, job.id)),
                    })),
                },
                usability: {
                    ...aggregatedReport.usability,
                    findings: aggregatedReport.usability.findings.map((finding) => ({
                        ...finding,
                        artifacts: finding.artifacts.map((item) => withArtifactDownloadPath(item, job.id)),
                    })),
                    sessionEvidence: aggregatedReport.usability.sessionEvidence.map((item) => ({
                        ...withArtifactDownloadPath(item, job.id),
                    })),
                },
            },
        };
        job.progress = job.result.progress;
        job.status = runStatus;
    } else {
        const runStatus: RunResultPayload["runStatus"] = job.cancellationRequested ? "cancelled" : "failed";
        const finalOutput = output || (job.cancellationRequested
            ? "Run cancelled by user before a structured report was produced."
            : "Run failed before a structured report was produced.");

        job.result = {
            runId: job.id,
            runStatus,
            passed: false,
            output: finalOutput,
            duration,
            progress: job.progress,
        };
        job.status = runStatus;
    }

    job.process = null;

    await Promise.all([
        unlink(job.testFile).catch(() => { }),
        unlink(job.jsonReportFile).catch(() => { }),
        unlink(job.reporterFile).catch(() => { }),
    ]);
}

async function startRunJob(
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

function normalizeSelectedPractices(input: unknown) {
    if (!Array.isArray(input)) {
        return [] as string[];
    }

    return input.filter((item): item is string => typeof item === "string");
}

function normalizeTestAuditMode(input: unknown): TestAuditMode {
    return input === "deep" ? "deep" : "fast";
}

function calculateWorkerCount(auditMode: TestAuditMode) {
    return auditMode === "deep" ? 2 : 4;
}


function collectArtifactFiles(records: ExecutionRecord[]) {
    const artifactFiles = new Map<string, { filePath: string; fileName: string; contentType: string }>();

    for (const record of records) {
        for (const artifact of record.artifacts) {
            artifactFiles.set(artifact.artifactId, {
                filePath: artifact.filePath,
                fileName: artifact.fileName,
                contentType: artifact.contentType,
            });
        }
    }

    return artifactFiles;
}

function withArtifactDownloadPath(item: ReportArtifactItem, runId: string): ReportArtifactItem {
    return {
        ...item,
        downloadPath: `/api/run?runId=${encodeURIComponent(runId)}&artifactId=${encodeURIComponent(item.artifactId)}`,
    };
}

function buildConsoleSummary(records: ExecutionRecord[], duration: number) {
    const lines = [`Executed ${records.length} test results in ${duration}ms.`];

    for (const record of records) {
        lines.push(
            `[${record.browser}] ${record.status} ${record.area} > ${record.title} (${record.duration}ms)`
        );
    }

    return lines.join("\n");
}

export async function POST(req: NextRequest) {
    const { code, selectedPractices, auditMode, baseUrl, excludeTestTitles, includeTestTitles } = await req.json();

    if (!code || typeof code !== "string") {
        return NextResponse.json({ error: "code is required" }, { status: 400 });
    }

    const normalizedPractices = normalizeSelectedPractices(selectedPractices);
    const normalizedAuditMode = normalizeTestAuditMode(auditMode);
    const normalizedExcludedTitles = Array.isArray(excludeTestTitles)
        ? excludeTestTitles.filter((title): title is string => typeof title === "string")
        : [];
    const normalizedIncludedTitles = Array.isArray(includeTestTitles)
        ? includeTestTitles.filter((title): title is string => typeof title === "string")
        : [];

    if (buildRunSelection(code, normalizedExcludedTitles, normalizedIncludedTitles).runnableTestCount === 0) {
        return NextResponse.json({ error: normalizedIncludedTitles.length > 0 ? "No selected tests are available to rerun." : "No remaining tests are available to continue." }, { status: 400 });
    }

    const job = await startRunJob(
        code,
        normalizedPractices,
        normalizedAuditMode,
        typeof baseUrl === "string" ? baseUrl : undefined,
        normalizedExcludedTitles,
        normalizedIncludedTitles
    );
    return NextResponse.json(job, { status: 202 });
}

export async function GET(req: NextRequest) {
    const runId = req.nextUrl.searchParams.get("runId");
    const artifactId = req.nextUrl.searchParams.get("artifactId");

    if (!runId) {
        return NextResponse.json({ error: "runId is required" }, { status: 400 });
    }

    const job = runJobs.get(runId);

    if (!job) {
        return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    if (artifactId) {
        const artifact = job.artifactFiles.get(artifactId);

        if (!artifact) {
            return NextResponse.json({ error: "Artifact not found" }, { status: 404 });
        }

        const artifactPath = resolve(artifact.filePath);
        const allowedRoot = resolve(job.artifactDir);

        if (!artifactPath.startsWith(allowedRoot)) {
            return NextResponse.json({ error: "Artifact path is invalid" }, { status: 400 });
        }

        const fileBuffer = await readFile(artifactPath).catch(() => null);
        if (!fileBuffer) {
            return NextResponse.json({ error: "Artifact file is unavailable" }, { status: 404 });
        }

        return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
                "Content-Type": artifact.contentType,
                "Content-Disposition": `attachment; filename="${artifact.fileName}"`,
            },
        });
    }

    return NextResponse.json(buildRunSnapshot(job));
}

export async function DELETE(req: NextRequest) {
    const { runId } = await req.json().catch(() => ({ runId: null }));

    if (!runId || typeof runId !== "string") {
        return NextResponse.json({ error: "runId is required" }, { status: 400 });
    }

    const job = runJobs.get(runId);

    if (!job) {
        return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    if (job.status === "running" && job.process?.exitCode === null) {
        job.cancellationRequested = true;
        job.outputChunks.push("Cancellation requested by user.\n");
        job.process.kill("SIGTERM");
    }

    return NextResponse.json(buildRunSnapshot(job));
}
