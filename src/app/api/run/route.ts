import { NextRequest, NextResponse } from "next/server";
import { type ChildProcess, spawn } from "child_process";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import { basename, extname, join, relative, resolve } from "path";
import { randomUUID } from "crypto";

const CROSS_BROWSER_AREA = "cross-browser";
type TestAuditMode = "fast" | "deep";
type RunLifecycleStatus = "queued" | "running" | "passed" | "failed" | "cancelled";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AREA_LABELS: Record<string, string> = {
    functional: "Functional",
    "cross-browser": "Cross-Browser",
    "responsive/mobile": "Responsive",
    "performance/load": "Performance",
    security: "Security",
    accessibility: "Accessibility",
    usability: "Usability",
    "seo/content": "SEO",
    "cookie/session": "Cookies",
    database: "Database",
};

const SUITE_AREA_MAP: Record<string, string> = {
    "Functional Coverage": "functional",
    "Cross-Browser Coverage": "cross-browser",
    "Responsive Coverage": "responsive/mobile",
    "Performance Coverage": "performance/load",
    "Security Coverage": "security",
    "Accessibility Coverage": "accessibility",
    "Usability Coverage": "usability",
    "SEO and Content Coverage": "seo/content",
    "Cookie and Session Coverage": "cookie/session",
    "Database Coverage": "database",
};

type ExecutionStatus = "Passed" | "Failed" | "Blocked" | "Flaky";
type DefectSeverity = "Critical" | "Major" | "Minor";

interface JsonReport {
    suites: JsonSuite[];
    errors: { message?: string }[];
    stats: {
        duration: number;
        expected: number;
        unexpected: number;
        flaky: number;
        skipped: number;
    };
}

interface JsonSuite {
    title: string;
    specs: JsonSpec[];
    suites?: JsonSuite[];
}

interface JsonSpec {
    title: string;
    tests: JsonTest[];
    id: string;
}

interface JsonTest {
    projectName: string;
    results: JsonTestResult[];
    status: "expected" | "unexpected" | "flaky" | "skipped";
}

interface JsonTestResult {
    status?: string;
    duration: number;
    retry: number;
    error?: { message?: string; stack?: string };
    errors: { message?: string }[];
    attachments?: Array<{
        name?: string;
        path?: string;
        contentType?: string;
    }>;
}

interface ExecutionArtifact {
    artifactId: string;
    filePath: string;
    fileName: string;
    label: string;
    artifactType: "trace" | "video" | "screenshot" | "file";
    contentType: string;
}

interface ExecutionRecord {
    id: string;
    title: string;
    description: string;
    suite: string;
    area: string;
    interactionType: "Navigation" | "API" | "Form" | "Action" | null;
    browser: string;
    status: ExecutionStatus;
    duration: number;
    remarks: string;
    reproductionSteps: string[];
    artifacts: ExecutionArtifact[];
    order: number;
}

interface DefectRecord {
    id: string;
    title: string;
    summary: string;
    description: string;
    reproductionSteps: string[];
    severity: DefectSeverity;
    priority: DefectSeverity;
    status: "Open" | "Fixed" | "Closed";
    area: string;
    browser: string;
}

interface SeoCheckRecord {
    title: string;
    browser: string;
    status: ExecutionStatus;
    remarks: string;
}

interface SeoCheckSummary {
    id: string;
    label: string;
    description: string;
    status: "passed" | "failed" | "not-covered";
    evidence: SeoCheckRecord[];
}

interface SeoPageCheckSummary extends SeoCheckSummary {
    pageKey: string;
    pageLabel: string;
}

interface SeoPageGroup {
    pageKey: string;
    pageLabel: string;
    findings: string[];
    strengths: string[];
    checks: SeoPageCheckSummary[];
}

interface SeoRecommendation {
    priority: "High" | "Medium" | "Low";
    title: string;
    rationale: string;
    pageKey?: string;
    pageLabel?: string;
}

function pluralize(value: number, singular: string, plural: string) {
    return value === 1 ? singular : plural;
}

function sanitizeDiagnosticText(value: string) {
    return stripAnsi(value)
        .replace(/\s+/g, " ")
        .replace(/\s+([.,;:!?])/g, "$1")
        .trim();
}

function toTitleCase(value: string) {
    return value
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

function simplifyExecutionTarget(title: string) {
    const normalized = normalizeExecutionTitle(title)
        .replace(/^keeps\s+/i, "")
        .replace(/^shows\s+/i, "")
        .replace(/^does not show\s+/i, "")
        .replace(/^exposes\s+/i, "")
        .replace(/^publishes\s+/i, "")
        .replace(/^link health:\s*/i, "")
        .replace(/^navigation destination:\s*/i, "")
        .replace(/^link types:\s*/i, "")
        .trim();

    return normalized || "the expected behavior";
}

function inferArtifactType(fileName: string, contentType?: string): ExecutionArtifact["artifactType"] {
    const normalizedName = fileName.toLowerCase();
    const normalizedType = contentType?.toLowerCase() ?? "";

    if (normalizedName.endsWith(".zip") || normalizedType.includes("zip") || normalizedName.includes("trace")) {
        return "trace";
    }

    if (/(\.webm|\.mp4)$/i.test(normalizedName) || normalizedType.startsWith("video/")) {
        return "video";
    }

    if (/(\.png|\.jpg|\.jpeg|\.webp)$/i.test(normalizedName) || normalizedType.startsWith("image/")) {
        return "screenshot";
    }

    return "file";
}

function inferArtifactContentType(fileName: string, contentType?: string) {
    if (contentType) {
        return contentType;
    }

    const extension = extname(fileName).toLowerCase();
    if (extension === ".zip") {
        return "application/zip";
    }

    if (extension === ".webm") {
        return "video/webm";
    }

    if (extension === ".mp4") {
        return "video/mp4";
    }

    if (extension === ".png") {
        return "image/png";
    }

    if (extension === ".jpg" || extension === ".jpeg") {
        return "image/jpeg";
    }

    if (extension === ".webp") {
        return "image/webp";
    }

    return "application/octet-stream";
}

function buildArtifactLabel(artifactType: ExecutionArtifact["artifactType"], fileName: string) {
    if (artifactType === "trace") {
        return "Trace";
    }

    if (artifactType === "video") {
        return "Video";
    }

    if (artifactType === "screenshot") {
        return "Screenshot";
    }

    return basename(fileName);
}

function extractSeoPageInfo(title: string) {
    const pathMatch = title.match(/\sfor\s(\/.*)$/i);
    if (pathMatch?.[1]) {
        return {
            pageKey: pathMatch[1],
            pageLabel: pathMatch[1],
        };
    }

    if (/robots\.txt|sitemap\.xml|manifest metadata/i.test(title)) {
        return {
            pageKey: "site-wide",
            pageLabel: "Site-wide",
        };
    }

    return {
        pageKey: "general",
        pageLabel: "General",
    };
}

function classifyFailureReason(message: string) {
    const normalized = sanitizeDiagnosticText(message).toLowerCase();

    if (/tohaveattribute|attribute/.test(normalized)) {
        return "required attribute values did not match the expected result";
    }

    if (/tohavetitle|title/.test(normalized)) {
        return "the page title did not match the expected value";
    }

    if (/tocontaintext|text content|not to contain text|tocontain/.test(normalized)) {
        return "the expected page text did not match the expected content";
    }

    if (/tobevisible|not found|locator/.test(normalized)) {
        return "the expected element was not visible to the user";
    }

    if (/tohaveurl|url/.test(normalized)) {
        return "navigation finished on a different URL than expected";
    }

    if (/timeout/.test(normalized)) {
        return "the check timed out before the expected state was reached";
    }

    if (/toequal|tobe\(|expected/.test(normalized)) {
        return "the observed result did not match the expected assertion";
    }

    return "the automated check did not reach the expected result";
}

function buildIssueTitle(record: ExecutionRecord) {
    const areaLabel = toTitleCase(record.area);
    const target = simplifyExecutionTarget(record.title);

    if (record.area === "SEO") {
        return `${areaLabel}: ${toTitleCase(target)} check failed`;
    }

    if (record.area === "Usability") {
        return `${areaLabel}: ${toTitleCase(target)} needs attention`;
    }

    return `${areaLabel}: ${toTitleCase(target)} failed`;
}

function buildIssueDescription(record: ExecutionRecord) {
    return `${toTitleCase(record.area)} validation for ${simplifyExecutionTarget(record.title)} failed because ${classifyFailureReason(record.remarks)}.`;
}

function summarizeFinding(record: ExecutionRecord) {
    return `${toTitleCase(record.area)} issue: ${simplifyExecutionTarget(record.title)} needs attention because ${classifyFailureReason(record.remarks)}.`;
}

interface ActiveExecution {
    id: string;
    title: string;
    linkLabel: string | null;
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
}

interface RunResultPayload {
    runId: string;
    runStatus: Exclude<RunLifecycleStatus, "queued" | "running">;
    passed: boolean;
    output: string;
    duration: number;
    progress: RunProgressSnapshot;
    report?: ReturnType<typeof buildReport>;
}

const SEO_RULE_DEFINITIONS: Array<{
    id: string;
    label: string;
    description: string;
    test: (record: ExecutionRecord) => boolean;
    recommendation: SeoRecommendation;
}> = [
        {
            id: "title",
            label: "Page titles",
            description: "Public pages should expose stable, descriptive document titles.",
            test: (record) => /keeps page title stable/i.test(record.title),
            recommendation: {
                priority: "High",
                title: "Stabilize page titles",
                rationale: "Set a unique, descriptive title for each public page and keep the title aligned with the final indexable URL and page intent.",
            },
        },
        {
            id: "meta-description",
            label: "Meta descriptions",
            description: "Public pages should ship a non-empty meta description that matches the page intent.",
            test: (record) => /keeps meta description stable/i.test(record.title),
            recommendation: {
                priority: "High",
                title: "Improve meta description coverage",
                rationale: "Add or refine meta descriptions so each page has concise summary copy that can stand in search results without duplication.",
            },
        },
        {
            id: "heading-structure",
            label: "Heading structure",
            description: "Landing pages should keep a visible heading hierarchy led by a clear primary heading.",
            test: (record) => /keeps heading structure stable/i.test(record.title),
            recommendation: {
                priority: "High",
                title: "Tighten heading hierarchy",
                rationale: "Ensure each public page has a clear primary heading and that major sections descend in a predictable order.",
            },
        },
        {
            id: "canonical",
            label: "Canonical URLs",
            description: "Canonical metadata should point crawlers at the final URL for each public page.",
            test: (record) => /keeps canonical metadata stable/i.test(record.title),
            recommendation: {
                priority: "High",
                title: "Validate canonical URLs",
                rationale: "Add rel=canonical to each public page and make sure it resolves to the final, preferred indexable path.",
            },
        },
        {
            id: "structured-data",
            label: "Structured data",
            description: "Public pages should expose machine-readable schema when the page is intended to rank in search.",
            test: (record) => /exposes structured data/i.test(record.title),
            recommendation: {
                priority: "Medium",
                title: "Add JSON-LD schema",
                rationale: "Publish relevant JSON-LD for the landing page or page type so crawlers can parse entity and page intent more reliably.",
            },
        },
        {
            id: "robots",
            label: "robots.txt",
            description: "robots.txt should be reachable and point crawlers at the sitemap.",
            test: (record) => /publishes robots\.txt/i.test(record.title),
            recommendation: {
                priority: "Medium",
                title: "Publish robots.txt",
                rationale: "Serve a robots.txt file that allows intended crawl paths and includes a sitemap reference for discovery.",
            },
        },
        {
            id: "sitemap",
            label: "Sitemap",
            description: "A sitemap should be reachable and expose at least one canonical URL.",
            test: (record) => /publishes sitemap\.xml/i.test(record.title),
            recommendation: {
                priority: "Medium",
                title: "Publish sitemap.xml",
                rationale: "Expose a valid sitemap.xml containing the canonical public URLs you want crawlers to discover and revisit.",
            },
        },
        {
            id: "manifest",
            label: "Manifest",
            description: "The site should expose a valid web manifest for installable-browser metadata where applicable.",
            test: (record) => /publishes manifest metadata/i.test(record.title),
            recommendation: {
                priority: "Low",
                title: "Expose a valid web manifest",
                rationale: "Link a valid web manifest from the document head so installable browsers and rich previews can resolve app metadata consistently.",
            },
        },
        {
            id: "critical-content",
            label: "Critical content",
            description: "Key public-facing content snippets should be present when they are declared as SEO-critical rules.",
            test: (record) => /shows the required content snippet/i.test(record.title),
            recommendation: {
                priority: "Medium",
                title: "Protect critical content blocks",
                rationale: "Turn important marketing copy, product value statements, or entity text into stable content checks so SEO-critical sections do not silently disappear.",
            },
        },
    ];

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
    selectedPractices: string[];
    artifactFiles: Map<string, { filePath: string; fileName: string; contentType: string }>;
    result: RunResultPayload | null;
}

const PROGRESS_PREFIX = "TESTFORGE_PROGRESS ";
const globalRunJobs = globalThis as typeof globalThis & {
    __testforgeRunJobs?: Map<string, RunJob>;
};
const runJobs = globalRunJobs.__testforgeRunJobs ?? (globalRunJobs.__testforgeRunJobs = new Map());

function estimateTestCount(code: string) {
    const matches = code.match(/\btest\s*\(/g);
    return Math.max(1, matches?.length ?? 0);
}

function calculateRunTimeout(
    code: string,
    browserProjectCount: number,
    includesCrossBrowser: boolean
) {
    const estimatedExecutions = estimateTestCount(code) * browserProjectCount;
    const timeout = 60_000 + estimatedExecutions * 7_500;

    return Math.min(
        Math.max(timeout, includesCrossBrowser ? 240_000 : 120_000),
        includesCrossBrowser ? 1_200_000 : 900_000
    );
}

function stripAnsi(text: string) {
    return text
        .replace(/\u001B\[[0-9;?]*[ -/]*[@-~]/g, "")
        .replace(/\u001B\][^\u0007]*(?:\u0007|\u001B\\)/g, "");
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

function handleProgressEvent(job: RunJob, line: string) {
    if (!line.startsWith(PROGRESS_PREFIX)) {
        return false;
    }

    const payload = line.slice(PROGRESS_PREFIX.length);

    try {
        const event = JSON.parse(payload) as
            | { type: "begin"; total: number }
            | { type: "test-begin"; id: string; title: string }
            | { type: "test-end"; id: string; title: string; status?: string };

        if (event.type === "begin") {
            job.progress.totalTests = Math.max(job.progress.totalTests, event.total || 0);
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
            updateActiveExecutions(job);
            return true;
        }

        if (event.type === "test-end") {
            if (job.activeExecutions.has(event.id)) {
                job.activeExecutions.delete(event.id);
            }

            job.progress.completedTests += 1;
            job.progress.lastCompletedTitle = event.title;
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
    this.emit({ type: 'begin', total: suite.allTests().length });
  }

  onTestBegin(test) {
    this.emit({ type: 'test-begin', id: test.id, title: test.title });
  }

  onTestEnd(test, result) {
    this.emit({ type: 'test-end', id: test.id, title: test.title, status: result.status });
  }
}

module.exports = TestForgeProgressReporter;
`;
}

async function finalizeRunJob(job: RunJob) {
    job.finishedAt = Date.now();
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
        const aggregatedReport = buildReport(parsedReport, job.selectedPractices, output || buildConsoleSummary(executionRecords, duration));
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
                usability: {
                    ...aggregatedReport.usability,
                    sessionEvidence: aggregatedReport.usability.sessionEvidence.map((item) => ({
                        ...item,
                        downloadPath: `/api/run?runId=${encodeURIComponent(job.id)}&artifactId=${encodeURIComponent(item.artifactId)}`,
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
    auditMode: TestAuditMode
) {
    const includesCrossBrowser = selectedPractices.includes(CROSS_BROWSER_AREA);
    const browserProjects = includesCrossBrowser
        ? ["chromium", "firefox", "webkit"]
        : ["chromium"];
    const workerCount = calculateWorkerCount(auditMode, includesCrossBrowser);
    const runTimeout = calculateRunTimeout(
        code,
        browserProjects.length,
        includesCrossBrowser
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
        progress: createEmptyProgress(estimateTestCount(code) * browserProjects.length),
        activeExecutions: new Map(),
        process: null,
        testFile,
        jsonReportFile,
        reporterFile,
        artifactDir,
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

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => appendProcessOutput(job, chunk));
    child.stderr?.on("data", (chunk: string) => appendProcessOutput(job, chunk));
    child.on("error", (error) => {
        job.outputChunks.push(`${error.message}\n`);
    });

    const timeoutId = setTimeout(() => {
        if (job.status === "running" && child.exitCode === null) {
            job.cancellationRequested = true;
            child.kill("SIGTERM");
            job.outputChunks.push("Run timed out and was stopped by TestForge.\n");
        }
    }, runTimeout);

    child.on("close", () => {
        clearTimeout(timeoutId);
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

function calculateWorkerCount(
    auditMode: TestAuditMode,
    includesCrossBrowser: boolean
) {
    if (includesCrossBrowser) {
        return auditMode === "deep" ? 2 : 3;
    }

    return auditMode === "deep" ? 2 : 4;
}

function mapStatus(testStatus: JsonTest["status"]): ExecutionStatus {
    if (testStatus === "unexpected") {
        return "Failed";
    }

    if (testStatus === "flaky") {
        return "Flaky";
    }

    if (testStatus === "skipped") {
        return "Blocked";
    }

    return "Passed";
}

function deriveArea(pathTitles: string[]) {
    const matchedSuite = pathTitles.find((title) => SUITE_AREA_MAP[title]);
    const area = matchedSuite ? SUITE_AREA_MAP[matchedSuite] : "functional";
    return {
        key: area,
        label: AREA_LABELS[area] ?? "Functional",
    };
}

function deriveInteractionType(title: string) {
    if (/^navigation link health:/i.test(title) || /^navigation element check:/i.test(title)) {
        return "Navigation" as const;
    }

    if (/^api link response:/i.test(title) || /^api element check:/i.test(title)) {
        return "API" as const;
    }

    if (/^form element check:/i.test(title)) {
        return "Form" as const;
    }

    if (/^action element check:/i.test(title)) {
        return "Action" as const;
    }

    return null;
}

function normalizeExecutionTitle(title: string) {
    return title
        .replace(/^navigation link health:\s*/i, "")
        .replace(/^api link response:\s*/i, "")
        .replace(/^navigation element check:\s*/i, "")
        .replace(/^api element check:\s*/i, "")
        .replace(/^form element check:\s*/i, "")
        .replace(/^action element check:\s*/i, "")
        .trim();
}

function buildExecutionDescription(
    title: string,
    interactionType: "Navigation" | "API" | "Form" | "Action" | null,
) {
    if (interactionType) {
        return `Validated the ${interactionType.toLowerCase()} element behavior for ${normalizeExecutionTitle(title)}.`;
    }

    return `Validated that ${title}.`;
}

function buildExecutionSteps(
    title: string,
    suiteName: string,
    browserName: string,
    message: string,
    interactionType: "Navigation" | "API" | "Form" | "Action" | null
) {
    if (interactionType) {
        return [
            `Opened the generated ${suiteName} scenario in ${browserName}.`,
            `Executed the ${interactionType.toLowerCase()} element check for ${normalizeExecutionTitle(title)}.`,
            `Validated the observed outcome: ${message.split("\n")[0]}.`,
        ];
    }

    return [
        `Opened the generated ${suiteName} scenario in ${browserName}.`,
        `Executed the test case: ${title}.`,
        `Validated the observed outcome: ${message.split("\n")[0]}.`,
    ];
}

function createExecutionArtifacts(result: JsonTestResult | undefined, testId: string, browser: string) {
    const attachments = result?.attachments ?? [];

    return attachments
        .filter((attachment) => attachment.path)
        .map((attachment, index) => {
            const fileName = basename(attachment.path ?? `artifact-${index}`);
            const artifactType = inferArtifactType(fileName, attachment.contentType);
            return {
                artifactId: `${testId}-${browser}-${index}`.replace(/[^a-zA-Z0-9_-]+/g, "-"),
                filePath: resolve(attachment.path ?? fileName),
                fileName,
                label: buildArtifactLabel(artifactType, fileName),
                artifactType,
                contentType: inferArtifactContentType(fileName, attachment.contentType),
            } satisfies ExecutionArtifact;
        });
}

function extractMessage(result: JsonTestResult) {
    return sanitizeDiagnosticText(
        result.error?.message ??
        result.errors.find((error) => error.message)?.message ??
        "No additional diagnostics captured."
    );
}

function toRemark(status: ExecutionStatus, message: string) {
    if (status === "Passed") {
        return "Completed successfully.";
    }

    if (status === "Flaky") {
        return `Recovered after retry. ${sanitizeDiagnosticText(message.split("\n")[0])}`;
    }

    if (status === "Blocked") {
        return "Execution was skipped or blocked before completion.";
    }

    return sanitizeDiagnosticText(message.split("\n")[0]);
}

function severityFromMessage(message: string): DefectSeverity {
    const normalized = message.toLowerCase();

    if (
        /(browsertype\.launch|security|https|ssl|certificate|500|spawn|crash|fatal)/.test(
            normalized
        )
    ) {
        return "Critical";
    }

    if (/(timeout|locator|expect\(|not found|tobevisible|tohaveurl)/.test(normalized)) {
        return "Major";
    }

    return "Minor";
}

function releaseRecommendation(
    failed: number,
    blocked: number,
    critical: number,
    major: number
) {
    if (critical > 0 || failed > 0) {
        return "Not ready for release";
    }

    if (blocked > 0 || major > 0) {
        return "Ready with caution";
    }

    return "Ready for release";
}

function flattenSuites(
    suites: JsonSuite[],
    lineage: string[] = [],
    orderRef: { value: number } = { value: 0 }
): ExecutionRecord[] {
    const records: ExecutionRecord[] = [];

    for (const suite of suites) {
        const nextLineage = suite.title ? [...lineage, suite.title] : lineage;

        for (const spec of suite.specs ?? []) {
            const area = deriveArea(nextLineage);
            const suiteName = nextLineage.find((title) => SUITE_AREA_MAP[title]) ?? "General";

            for (const test of spec.tests ?? []) {
                const latestResult = [...(test.results ?? [])].sort(
                    (left, right) => left.retry - right.retry
                ).at(-1);
                const status = mapStatus(test.status);
                const message = latestResult ? extractMessage(latestResult) : "No result captured.";
                const interactionType = deriveInteractionType(spec.title);

                orderRef.value += 1;
                records.push({
                    id: spec.id,
                    title: spec.title,
                    description: buildExecutionDescription(
                        spec.title,
                        interactionType,
                    ),
                    suite: suiteName,
                    area: area.label,
                    interactionType,
                    browser: test.projectName || "chromium",
                    status,
                    duration: latestResult?.duration ?? 0,
                    remarks: toRemark(status, message),
                    reproductionSteps: buildExecutionSteps(
                        spec.title,
                        suiteName,
                        test.projectName || "chromium",
                        message,
                        interactionType
                    ),
                    artifacts: createExecutionArtifacts(latestResult, spec.id, test.projectName || "chromium"),
                    order: orderRef.value,
                });
            }
        }

        records.push(...flattenSuites(suite.suites ?? [], nextLineage, orderRef));
    }

    return records;
}

function buildDefects(records: ExecutionRecord[]) {
    return records
        .filter((record) => record.status === "Failed")
        .map((record, index) => {
            const severity = severityFromMessage(record.remarks);
            return {
                id: `BUG-${String(index + 1).padStart(3, "0")}`,
                title: buildIssueTitle(record),
                summary: buildIssueDescription(record),
                description: record.remarks,
                reproductionSteps: record.reproductionSteps,
                severity,
                priority: severity,
                status: "Open" as const,
                area: record.area,
                browser: record.browser,
            };
        });
}

function buildDefectTrend(records: ExecutionRecord[]) {
    let runningFailures = 0;

    return records.map((record, index) => {
        if (record.status === "Failed") {
            runningFailures += 1;
        }

        return {
            label: `T${index + 1}`,
            count: runningFailures,
        };
    });
}

function inferCoverageAreas(records: ExecutionRecord[]) {
    const areas = new Set<string>();

    for (const record of records) {
        const key = Object.entries(AREA_LABELS).find(
            ([, label]) => label === record.area
        )?.[0];

        if (key) {
            areas.add(key);
        }
    }

    return [...areas];
}

function buildCoverageMatrix(
    selectedPractices: string[],
    records: ExecutionRecord[]
) {
    const targetPractices = selectedPractices.length > 0
        ? selectedPractices
        : inferCoverageAreas(records);

    const matrix = targetPractices.map((practice) => {
        const label = AREA_LABELS[practice] ?? practice;
        const relatedTests = records.filter((record) => record.area === label);
        const successfulTests = relatedTests.filter(
            (record) => record.status === "Passed" || record.status === "Flaky"
        );
        const status = relatedTests.length === 0
            ? "uncovered"
            : successfulTests.length === relatedTests.length
                ? "covered"
                : "partial";

        return {
            requirement: label,
            status,
            tests: relatedTests.map((record) => `${record.browser}: ${record.title}`),
        };
    });

    const covered = matrix.filter((item) => item.status === "covered").length;
    const total = matrix.length;

    return {
        percentage: total === 0 ? 100 : Math.round((covered / total) * 100),
        covered,
        total,
        uncovered: matrix
            .filter((item) => item.status === "uncovered")
            .map((item) => item.requirement),
        matrix,
    };
}

function buildPerformanceReport(records: ExecutionRecord[], duration: number) {
    const executedRecords = records.filter((record) => record.status !== "Blocked");
    const averageDuration = executedRecords.length === 0
        ? 0
        : Math.round(
            executedRecords.reduce((total, record) => total + record.duration, 0) /
            executedRecords.length
        );
    const throughput = duration === 0
        ? 0
        : Number(((executedRecords.length / duration) * 60000).toFixed(2));
    const slowestTests = [...records]
        .sort((left, right) => right.duration - left.duration)
        .slice(0, 5)
        .map((record) => ({
            title: record.title,
            browser: record.browser,
            area: record.area,
            duration: record.duration,
        }));
    const performanceTests = records.filter((record) => record.area === "Performance");

    return {
        totalDuration: duration,
        averageDuration,
        throughput,
        slowestTests,
        pageResponseTimes: performanceTests.map((record) => ({
            title: record.title,
            duration: record.duration,
            browser: record.browser,
        })),
        resourceUtilization: "CPU and memory utilization are not captured in the current browser-only runner.",
        scalability: "Scalability conclusions require dedicated load tooling such as Lighthouse or JMeter alongside this suite.",
    };
}

function buildUsabilityReport(records: ExecutionRecord[]) {
    const usabilityRecords = records.filter((record) => record.area === "Usability");
    const scopedRecords = usabilityRecords.length > 0 ? usabilityRecords : records;
    const passedTasks = scopedRecords.filter(
        (record) => record.status === "Passed" || record.status === "Flaky"
    ).length;
    const findings = scopedRecords
        .filter((record) => record.status === "Failed")
        .map((record) => summarizeFinding(record));
    const sessionEvidence = scopedRecords
        .flatMap((record) =>
            record.artifacts.map((artifact) => ({
                artifactId: artifact.artifactId,
                label: artifact.label,
                artifactType: artifact.artifactType,
                browser: record.browser,
                testTitle: normalizeExecutionTitle(record.title),
                fileName: artifact.fileName,
            }))
        )
        .filter((item, index, allItems) =>
            allItems.findIndex((candidate) => candidate.artifactId === item.artifactId) === index
        );

    return {
        successRate: scopedRecords.length === 0
            ? 100
            : Math.round((passedTasks / scopedRecords.length) * 100),
        findings: findings.length > 0
            ? findings
            : ["No major usability blockers surfaced in the current automated pass."],
        videoClips: sessionEvidence.length > 0
            ? "Failed-run artifacts were captured for this run. Use the evidence list to inspect trace, video, or screenshot files."
            : "No failed-run artifacts were captured in this run. Trace, video, and screenshot evidence only appear when Playwright retains failure artifacts.",
        sessionEvidence,
        tasksCompleted: passedTasks,
        totalTasks: scopedRecords.length,
    };
}

function buildSeoReport(records: ExecutionRecord[], selectedPractices: string[]) {
    const seoScopedRecords = records.filter(
        (record) => record.area === "SEO" || /shows the required content snippet/i.test(record.title)
    );
    const seoRequested = selectedPractices.includes("seo/content") || seoScopedRecords.length > 0;

    const checks = SEO_RULE_DEFINITIONS
        .filter((rule) => seoRequested || seoScopedRecords.some(rule.test))
        .map((rule) => {
            const evidence = seoScopedRecords
                .filter(rule.test)
                .map((record) => ({
                    title: record.title,
                    browser: record.browser,
                    status: record.status,
                    remarks: record.remarks,
                }));
            const hasFailure = evidence.some(
                (record) => record.status === "Failed" || record.status === "Blocked"
            );
            const hasSuccess = evidence.some(
                (record) => record.status === "Passed" || record.status === "Flaky"
            );

            return {
                id: rule.id,
                label: rule.label,
                description: rule.description,
                status: hasFailure
                    ? "failed"
                    : hasSuccess
                        ? "passed"
                        : "not-covered",
                evidence,
            } satisfies SeoCheckSummary;
        });

    const passedChecks = checks.filter((check) => check.status === "passed").length;
    const failedChecks = checks.filter((check) => check.status === "failed").length;
    const notCoveredChecks = checks.filter((check) => check.status === "not-covered").length;
    const scoreDenominator = Math.max(checks.length, 1);
    const score = Math.round((passedChecks / scoreDenominator) * 100);
    const findings = checks
        .filter((check) => check.status === "failed")
        .map((check) => summarizeSeoCheckFailure(check));
    const strengths = checks
        .filter((check) => check.status === "passed")
        .map((check) => `${check.label} passed in the current run.`);
    const pageChecks = SEO_RULE_DEFINITIONS.flatMap((rule) => {
        const groupedEvidence = new Map<string, SeoCheckRecord[]>();

        for (const record of seoScopedRecords.filter(rule.test)) {
            const pageInfo = extractSeoPageInfo(record.title);
            const existing = groupedEvidence.get(pageInfo.pageKey) ?? [];
            existing.push({
                title: record.title,
                browser: record.browser,
                status: record.status,
                remarks: record.remarks,
            });
            groupedEvidence.set(pageInfo.pageKey, existing);
        }

        return [...groupedEvidence.entries()].map(([pageKey, evidence]) => {
            const pageInfo = extractSeoPageInfo(evidence[0]?.title ?? "");
            const hasFailure = evidence.some(
                (record) => record.status === "Failed" || record.status === "Blocked"
            );
            const hasSuccess = evidence.some(
                (record) => record.status === "Passed" || record.status === "Flaky"
            );

            return {
                id: `${rule.id}:${pageKey}`,
                label: rule.label,
                description: rule.description,
                status: hasFailure
                    ? "failed"
                    : hasSuccess
                        ? "passed"
                        : "not-covered",
                evidence,
                pageKey,
                pageLabel: pageInfo.pageLabel,
            } satisfies SeoPageCheckSummary;
        });
    });
    const pageGroups = [...new Map(pageChecks.map((check) => [check.pageKey, check.pageLabel])).entries()].map(
        ([pageKey, pageLabel]) => {
            const checksForPage = pageChecks.filter((check) => check.pageKey === pageKey);
            return {
                pageKey,
                pageLabel,
                checks: checksForPage,
                findings: checksForPage
                    .filter((check) => check.status === "failed")
                    .map((check) => summarizeSeoCheckFailure(check)),
                strengths: checksForPage
                    .filter((check) => check.status === "passed")
                    .map((check) => `${check.label} passed for ${pageLabel}.`),
            } satisfies SeoPageGroup;
        }
    );
    const recommendations = pageGroups
        .flatMap((group) =>
            group.checks
                .filter((check) => check.status !== "passed")
                .map((check) => {
                    const rule = SEO_RULE_DEFINITIONS.find((item) => item.id === check.id.split(":")[0]);
                    if (!rule) {
                        return null;
                    }

                    return {
                        ...rule.recommendation,
                        title: `${rule.recommendation.title} for ${group.pageLabel}`,
                        rationale: `Update ${group.pageLabel}: ${rule.recommendation.rationale}`,
                        pageKey: group.pageKey,
                        pageLabel: group.pageLabel,
                    } satisfies SeoRecommendation;
                })
                .filter((recommendation) => recommendation !== null)
        )
        .filter((recommendation, index, allRecommendations) =>
            allRecommendations.findIndex((candidate) =>
                candidate.title === recommendation.title && candidate.pageKey === recommendation.pageKey
            ) === index
        );

    return {
        requested: seoRequested,
        score,
        statusLabel: failedChecks > 0
            ? "Needs attention"
            : notCoveredChecks > 0
                ? "Partially covered"
                : "Healthy",
        passedChecks,
        failedChecks,
        notCoveredChecks,
        totalChecks: checks.length,
        checks,
        pageGroups,
        findings: findings.length > 0
            ? findings
            : ["No SEO-specific failures were produced in the current run."],
        strengths: strengths.length > 0
            ? strengths
            : ["Add explicit SEO checks to surface deterministic strengths in future runs."],
        recommendations: recommendations.length > 0
            ? recommendations
            : pageGroups.length > 0
                ? pageGroups.map((group) => ({
                    priority: "Low" as const,
                    title: `Keep the SEO audit in regression for ${group.pageLabel}`,
                    rationale: `Keep explicit SEO coverage for ${group.pageLabel} so metadata, schema, and crawler-facing behavior stay stable over time.`,
                    pageKey: group.pageKey,
                    pageLabel: group.pageLabel,
                }))
                : [{
                    priority: "Low" as const,
                    title: "Keep the SEO audit in regression",
                    rationale: "The current run is healthy. Preserve these checks in regression so metadata, schema, and crawler files stay stable over time.",
                }],
    };
}

function summarizeSeoCheckFailure(check: SeoCheckSummary) {
    const failingEvidence = check.evidence.filter(
        (record) => record.status === "Failed" || record.status === "Blocked"
    );
    const browserList = [...new Set(failingEvidence.map((record) => record.browser))].join(", ");
    const browserSuffix = browserList ? ` in ${browserList}` : "";
    const failureCount = failingEvidence.length;

    switch (check.id) {
        case "title":
            return `Page titles failed ${failureCount} ${pluralize(failureCount, "time", "times")}${browserSuffix}. The audit could not confirm a stable, descriptive title for the page.`;
        case "meta-description":
            return `Meta descriptions failed ${failureCount} ${pluralize(failureCount, "time", "times")}${browserSuffix}. The audit could not confirm a stable non-empty meta description for the page.`;
        case "heading-structure":
            return `Heading structure failed ${failureCount} ${pluralize(failureCount, "time", "times")}${browserSuffix}. The audit could not confirm the expected visible heading hierarchy.`;
        case "canonical":
            return `Canonical URLs failed ${failureCount} ${pluralize(failureCount, "time", "times")}${browserSuffix}. The audit could not confirm that the page exposes the expected canonical target.`;
        case "structured-data":
            return `Structured data failed ${failureCount} ${pluralize(failureCount, "time", "times")}${browserSuffix}. The audit could not confirm usable JSON-LD on the page.`;
        case "robots":
            return `robots.txt failed ${failureCount} ${pluralize(failureCount, "time", "times")}${browserSuffix}. The crawler-facing robots file was missing or did not expose the expected sitemap reference.`;
        case "sitemap":
            return `Sitemap failed ${failureCount} ${pluralize(failureCount, "time", "times")}${browserSuffix}. The audit could not confirm a reachable sitemap with public URLs.`;
        case "manifest":
            return `Manifest metadata failed ${failureCount} ${pluralize(failureCount, "time", "times")}${browserSuffix}. The audit could not confirm a valid linked web manifest.`;
        case "critical-content":
            return `Critical content checks failed ${failureCount} ${pluralize(failureCount, "time", "times")}${browserSuffix}. Required SEO-facing copy was not confirmed in the current run.`;
        default:
            return `${check.label} failed ${failureCount} ${pluralize(failureCount, "time", "times")}${browserSuffix}. The audit could not confirm this SEO rule in the current run.`;
    }
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

function buildSummary(
    records: ExecutionRecord[],
    defects: DefectRecord[],
    duration: number
) {
    const passed = records.filter((record) => record.status === "Passed").length;
    const failed = records.filter((record) => record.status === "Failed").length;
    const blocked = records.filter((record) => record.status === "Blocked").length;
    const flaky = records.filter((record) => record.status === "Flaky").length;
    const executed = records.filter((record) => record.status !== "Blocked").length;
    const critical = defects.filter((defect) => defect.severity === "Critical").length;
    const major = defects.filter((defect) => defect.severity === "Major").length;
    const minor = defects.filter((defect) => defect.severity === "Minor").length;

    return {
        planned: records.length,
        executed,
        passed,
        failed,
        blocked,
        flaky,
        duration,
        releaseRecommendation: releaseRecommendation(failed, blocked, critical, major),
        defectDistribution: {
            Critical: critical,
            Major: major,
            Minor: minor,
        },
        passFailRatio: {
            passed: passed + flaky,
            failed: failed + blocked,
        },
        browsers: [...new Set(records.map((record) => record.browser))],
    };
}

function buildHeatmap(defects: DefectRecord[]) {
    const areaCounts = new Map<string, number>();

    for (const defect of defects) {
        areaCounts.set(defect.area, (areaCounts.get(defect.area) ?? 0) + 1);
    }

    return [...areaCounts.entries()].map(([area, count]) => ({ area, count }));
}

function buildReport(
    report: JsonReport,
    selectedPractices: string[],
    output: string
) {
    const execution = flattenSuites(report.suites ?? []);
    const defects = buildDefects(execution);
    const coverage = buildCoverageMatrix(selectedPractices, execution);
    const summary = buildSummary(execution, defects, report.stats?.duration ?? 0);
    const performance = buildPerformanceReport(execution, report.stats?.duration ?? 0);
    const usability = buildUsabilityReport(execution);
    const seo = buildSeoReport(execution, selectedPractices);

    return {
        summary: {
            ...summary,
            defectTrend: buildDefectTrend(execution),
        },
        execution,
        defects: {
            issues: defects,
            heatmap: buildHeatmap(defects),
        },
        coverage,
        performance,
        usability,
        seo,
        rawOutput: output,
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
    const { code, selectedPractices, auditMode } = await req.json();

    if (!code || typeof code !== "string") {
        return NextResponse.json({ error: "code is required" }, { status: 400 });
    }

    const normalizedPractices = normalizeSelectedPractices(selectedPractices);
    const normalizedAuditMode = normalizeTestAuditMode(auditMode);
    const job = await startRunJob(code, normalizedPractices, normalizedAuditMode);
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
