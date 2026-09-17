import type { ChildProcess } from "child_process";
import { readFile, unlink } from "fs/promises";
import { flattenSuites } from "@/lib/report/execution";
import { buildReport } from "@/lib/report/report";
import type { JsonReport, RunReport } from "@/lib/report/types";
import { buildConsoleSummary, collectArtifactFiles, finalizeInterruptedPlannedExecutions, withArtifactDownloadPath } from "@/lib/run/output";
import { persistRunJob } from "@/lib/run/persistence";
import { estimateTestCount } from "@/lib/run/selection";

export type RunLifecycleStatus = "queued" | "running" | "passed" | "failed" | "cancelled";

export interface ActiveExecution {
    id: string;
    title: string;
    linkLabel: string | null;
}

export type PlannedExecutionStatus = "not-run" | "running" | "passed" | "failed" | "flaky" | "blocked" | "interrupted";

export interface PlannedExecutionSnapshot {
    id: string;
    title: string;
    linkLabel: string | null;
    status: PlannedExecutionStatus;
    duration: number | null;
}

export interface RunProgressSnapshot {
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

export interface RunResultPayload {
    runId: string;
    runStatus: Exclude<RunLifecycleStatus, "queued" | "running">;
    passed: boolean;
    output: string;
    duration: number;
    progress: RunProgressSnapshot;
    report?: RunReport;
}

export interface RunStatusPayload {
    runId: string;
    runStatus: RunLifecycleStatus;
    duration: number;
    progress: RunProgressSnapshot;
    cancellationRequested: boolean;
    result?: RunResultPayload;
}

export interface RunJob {
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
    description: string;
    auditMode: string;
    selectedPractices: string[];
    artifactFiles: Map<string, { filePath: string; fileName: string; contentType: string }>;
    result: RunResultPayload | null;
}

const globalRunJobs = globalThis as typeof globalThis & {
    __testforgeRunJobs?: Map<string, RunJob>;
};
export const runJobs = globalRunJobs.__testforgeRunJobs ?? (globalRunJobs.__testforgeRunJobs = new Map());

export function createEmptyProgress(totalTests = 0): RunProgressSnapshot {
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

export function buildRunSnapshot(job: RunJob): RunStatusPayload {
    return {
        runId: job.id,
        runStatus: job.status,
        duration: (job.finishedAt ?? Date.now()) - job.createdAt,
        progress: job.progress,
        cancellationRequested: job.cancellationRequested,
        result: job.result ?? undefined,
    };
}

export async function finalizeRunJob(job: RunJob) {
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

            job.artifactFiles = new Map(Object.entries(await persistRunJob(job)));

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

    job.artifactFiles = new Map(Object.entries(await persistRunJob(job)));

    await Promise.all([
        unlink(job.testFile).catch(() => { }),
        unlink(job.jsonReportFile).catch(() => { }),
        unlink(job.reporterFile).catch(() => { }),
    ]);
}
