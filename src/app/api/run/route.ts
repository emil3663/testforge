import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import { join, relative } from "path";
import { randomUUID } from "crypto";

const execFileAsync = promisify(execFile);
const CROSS_BROWSER_AREA = "cross-browser";

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
    order: number;
}

interface DefectRecord {
    id: string;
    summary: string;
    reproductionSteps: string[];
    severity: DefectSeverity;
    priority: DefectSeverity;
    status: "Open" | "Fixed" | "Closed";
    area: string;
    browser: string;
}

function normalizeSelectedPractices(input: unknown) {
    if (!Array.isArray(input)) {
        return [] as string[];
    }

    return input.filter((item): item is string => typeof item === "string");
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

function extractMessage(result: JsonTestResult) {
    return (
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
        return `Recovered after retry. ${message.split("\n")[0]}`;
    }

    if (status === "Blocked") {
        return "Execution was skipped or blocked before completion.";
    }

    return message.split("\n")[0];
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
                summary: record.remarks,
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
        .map((record) => `${record.title}: ${record.remarks}`);

    return {
        successRate: scopedRecords.length === 0
            ? 100
            : Math.round((passedTasks / scopedRecords.length) * 100),
        findings: findings.length > 0
            ? findings
            : ["No major usability blockers surfaced in the current automated pass."],
        videoClips: "Session recordings are not captured by the current runner. Add Playwright video or trace collection if you need evidence clips.",
        tasksCompleted: passedTasks,
        totalTasks: scopedRecords.length,
    };
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
    const { code, selectedPractices } = await req.json();

    if (!code || typeof code !== "string") {
        return NextResponse.json({ error: "code is required" }, { status: 400 });
    }

    const normalizedPractices = normalizeSelectedPractices(selectedPractices);
    const browserProjects = normalizedPractices.includes(CROSS_BROWSER_AREA)
        ? ["chromium", "firefox", "webkit"]
        : ["chromium"];

    const runsDir = join(process.cwd(), ".playwright-runs");
    await mkdir(runsDir, { recursive: true });
    const runId = randomUUID();
    const testFile = join(runsDir, `test-${runId}.spec.ts`);
    const jsonReportFile = join(runsDir, `report-${runId}.json`);

    try {
        await writeFile(testFile, code, "utf8");

        const start = Date.now();
        const testPath = relative(process.cwd(), testFile).replace(/\\/g, "/");
        const playwrightCli = join(
            process.cwd(),
            "node_modules",
            "playwright",
            "cli.js"
        );

        const { stdout, stderr } = await execFileAsync(
            process.execPath,
            [
                playwrightCli,
                "test",
                testPath,
                "--reporter=json",
                "--timeout=30000",
                ...browserProjects.flatMap((project) => [`--project=${project}`]),
            ],
            {
                cwd: process.cwd(),
                env: {
                    ...process.env,
                    PLAYWRIGHT_JSON_OUTPUT_FILE: jsonReportFile,
                    HOME:
                        process.env.HOME ??
                        process.env.USERPROFILE ??
                        process.cwd(),
                },
                timeout: normalizedPractices.includes(CROSS_BROWSER_AREA)
                    ? 240_000
                    : 120_000,
            }
        ).catch((err: { stdout?: string; stderr?: string }) => ({
            stdout: err.stdout ?? "",
            stderr: err.stderr ?? "",
        }));

        const duration = Date.now() - start;
        const reportText = await readFile(jsonReportFile, "utf8").catch(() => "");
        const parsedReport: JsonReport | null = reportText
            ? (JSON.parse(reportText) as JsonReport)
            : null;

        if (!parsedReport) {
            const fallbackOutput = [stdout, stderr].filter(Boolean).join("\n").trim();
            return NextResponse.json({
                passed: false,
                output: fallbackOutput || "Run failed before a structured report was produced.",
                duration,
            });
        }

        const fallbackOutput = [stdout, stderr].filter(Boolean).join("\n").trim();
        const executionRecords = flattenSuites(parsedReport.suites ?? []);
        const output = fallbackOutput || buildConsoleSummary(executionRecords, duration);
        const aggregatedReport = buildReport(parsedReport, normalizedPractices, output);
        const passed = aggregatedReport.summary.failed === 0;

        return NextResponse.json({
            passed,
            output,
            duration,
            report: aggregatedReport,
        });
    } finally {
        await unlink(testFile).catch(() => { });
        await unlink(jsonReportFile).catch(() => { });
    }
}
