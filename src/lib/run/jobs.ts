import type { ChildProcess } from "child_process";
import { readFile, unlink } from "fs/promises";
import type { ContentProfile } from "@/lib/generate/mock/types";
import { flattenSuites } from "@/lib/report/execution";
import { recordCandidateRuns } from "@/lib/candidates/evidence";
import { buildReport } from "@/lib/report/report";
import type { GenerationRecord, JsonReport, RunReport } from "@/lib/report/types";
import { buildConsoleSummary, collectArtifactFiles, finalizeInterruptedPlannedExecutions, withArtifactDownloadPath } from "@/lib/run/output";
import type { LoginConfig } from "@/lib/run/auth";
import { persistRunJob } from "@/lib/run/persistence";
import { buildRedactor, redactDeep, scrubArtifactDirectory } from "@/lib/run/redact";
import { countDeclaredTests, estimateTestCount } from "@/lib/run/selection";
import { removeRunFolder } from "@/lib/run/run-folders";
import { readRunTiming } from "@/lib/run/timing";
import type { RunMode } from "@/lib/comprehensive/run-mode";

export type RunLifecycleStatus = "queued" | "running" | "passed" | "failed" | "cancelled" | "empty";

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
    // TFP-211: the timing reporter and what it writes; optional so jobs built before it (and in tests) have none.
    timingReporterFile?: string;
    timingFile?: string;
    artifactDir: string;
    // TFP-222: the run's own folder (spec, reporters, report, timing, login state); removed when it is finalized.
    runDir?: string;
    baseUrl?: string;
    description: string;
    auditMode: string;
    selectedPractices: string[];
    // Phase 17 Group 2 (TFP-071): the crawl/introspect snapshot the client
    // already has from generation, threaded through so finalizeRunJob can
    // compute honest coverage against the discovered surface. Null for
    // runs started without one (e.g. a client that skipped generation).
    contentProfile: ContentProfile | null;
    // TFP-091: whether this run explicitly enabled the skipped-by-default
    // interactive (journey) tests.
    enableInteractive: boolean;
    // TFP-092: the login this run used - references only (URL, selectors, and
    // the NAMES of the credential environment variables), never a value.
    login: LoginConfig | null;
    // Phase 34 (TFP-119): how the suite was generated (gap-fill outcome and
    // gate verdicts), as the client received it from /api/generate.
    generation: GenerationRecord | null;
    // Phase 35 (TFP-132): Standard, or Comprehensive for one area. Optional
    // so jobs built before it existed (and in tests) read as Standard.
    runMode?: RunMode;
    // The Playwright worker count the run used (Phase 39 Decision 10, by host).
    workerCount?: number;
    // TFP-157 (Phase 39 Decisions 10 and 11): the host's row, its caps, and whether the ownership confirmation was
    // present; and, on a capped host, how the request cap went (set once the run's last pass closes).
    hostLimits?: import("@/lib/run/host-limits").HostLimits;
    requestCap?: import("@/lib/run/request-cap").RequestCapStats | null;
    // TFP-094: the run's secret values (credentials and session contents),
    // used to scrub everything the run produces. In memory only: never on a
    // snapshot, never persisted, and cleared once the run is finalized.
    redactions: string[];
    artifactFiles: Map<string, { filePath: string; fileName: string; contentType: string }>;
    // TFP-208: set, with no await between, where the result is set, and settled once the run is saved
    // (its evidence moved into the run's folder and artifactFiles pointing there). Until then
    // artifactFiles still names the files where Playwright left them, while they are being moved.
    saving?: Promise<void>;
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

/** TFP-208: saves the run, and keeps the save on the job, so an artifact asked for meanwhile waits for it. */
async function saveRunJob(job: RunJob) {
    job.saving = persistRunJob(job).then((files) => {
        job.artifactFiles = new Map(Object.entries(files));
    });
    await job.saving;
}

export async function finalizeRunJob(job: RunJob) {
    try {
        await finalizeRunJobUnredacted(job);
    } finally {
        job.redactions = [];
    }
}

// Second, independent layer: the assembled result is scrubbed once more as a
// whole, and any storageState key dropped, right before it is exposed or
// persisted - so a secret that reached it by a path the first pass did not
// cover still cannot leave.
function sealResult(job: RunJob, redactor: ReturnType<typeof buildRedactor>) {
    if (job.result) {
        job.result = redactDeep(job.result, redactor);
        job.progress = job.result.progress;
    }
}

// The run's working files, and (TFP-222) its own folder once they are gone.
async function removeRunFiles(job: RunJob) {
    await Promise.all([
        unlink(job.testFile).catch(() => { }),
        unlink(job.jsonReportFile).catch(() => { }),
        unlink(job.reporterFile).catch(() => { }),
        ...[job.timingReporterFile, job.timingFile].filter((file): file is string => Boolean(file)).map((file) => unlink(file).catch(() => { })),
    ]);
    if (job.runDir) await removeRunFolder(job.runDir);
}

async function finalizeRunJobUnredacted(job: RunJob) {
    job.finishedAt = Date.now();

    // TFP-094: scrub every artifact the run produced, in place, before
    // anything is collected, served, or persisted (a real authenticated
    // run's trace.zip held the whole storageState). Anything that cannot be
    // scrubbed is removed rather than kept.
    const redactor = buildRedactor(job.redactions ?? []);
    const scrubNotes = await scrubArtifactDirectory(job.artifactDir, redactor);
    if (scrubNotes.length > 0) {
        const removed = scrubNotes.filter((note) => note.action === "removed").length;
        job.outputChunks.push(
            `TestForge redacted this run's login credentials and session from ${scrubNotes.length - removed} captured artifact(s)${removed > 0 ? ` and removed ${removed} that could not be scrubbed` : ""}.\n`
        );
    }

    finalizeInterruptedPlannedExecutions(job);
    job.progress.completedTests = Math.min(job.progress.completedTests, Math.max(job.progress.totalTests, job.progress.completedTests));
    // Null (not "") when the suite source is gone: coverage then can't tell
    // which journeys were generated and falls back to execution records.
    const suiteCode = await readFile(job.testFile, "utf8").catch(() => null);
    job.progress.totalTests = Math.max(job.progress.totalTests, job.progress.completedTests, estimateTestCount(suiteCode ?? ""));

    const reportText = await readFile(job.jsonReportFile, "utf8").catch(() => "");
    let parsedReport: JsonReport | null = null;
    if (reportText) {
        try {
            parsedReport = JSON.parse(reportText) as JsonReport;
        } catch {
            job.outputChunks.push("Warning: Playwright JSON report was corrupted and could not be parsed.\n");
        }
    }
    // Also the parsed report and the console output: a failing assertion's
    // message can echo whatever the page did.
    if (parsedReport) {
        parsedReport = redactDeep(parsedReport, redactor);
    }
    const output = redactor.redact(job.outputChunks.join("").trim());
    const duration = job.finishedAt - job.createdAt;
    // TFP-211: where the run's time went, from the timing reporter, outside the generated suite.
    const runTiming = job.timingFile ? await readRunTiming(job.timingFile, job.baseUrl, job.contentProfile, suiteCode) : null;

    if (parsedReport) {
        const executionRecords = flattenSuites(parsedReport.suites ?? []);
        // Phase 42 (TFP-195): each pool candidate that ran adds this run to its evidence.
        await recordCandidateRuns(executionRecords, job.baseUrl, job.id).catch((error: unknown) => {
            job.outputChunks.push(`Candidate pool: this run's results could not be recorded (${error instanceof Error ? error.message : String(error)}).\n`);
        });
        const aggregatedReport = buildReport(
            parsedReport,
            job.selectedPractices,
            output || buildConsoleSummary(executionRecords, duration),
            job.baseUrl,
            job.contentProfile,
            suiteCode,
            job.generation,
            job.description,
            job.runMode,
            job.workerCount,
            job.enableInteractive,
            job.hostLimits?.note ?? null
        );
        job.artifactFiles = collectArtifactFiles(executionRecords);
        const zeroExecution = aggregatedReport.summary.planned === 0;

        if (zeroExecution) {
            const reportedErrors = (parsedReport.errors ?? [])
                .map((error) => error.message?.trim())
                .filter((message): message is string => Boolean(message));

            // Phase 36 TFP-125: a suite that declares no test at all - every
            // area in scope was not applicable, e.g. database on a site with
            // no form that saves text - has nothing to run. That is not a
            // failed run: it keeps its report, whose empty areas say why.
            // Any other error, or a suite that declares tests yet ran none,
            // is still a failure.
            const nothingToRun =
                !job.cancellationRequested &&
                suiteCode !== null &&
                countDeclaredTests(suiteCode) === 0 &&
                reportedErrors.every((message) => /^(Error: )?No tests found/.test(message));
            if (nothingToRun) {
                const reasons = (aggregatedReport.emptyAreas ?? []).flatMap((area) => area.reasons);
                job.result = {
                    runId: job.id,
                    runStatus: "empty",
                    passed: false,
                    output: ["Nothing to run: the generated suite has no tests.", ...reasons].join("\n"),
                    duration,
                    progress: { ...job.progress, totalTests: 0, completedTests: 0, passedTests: 0, failedTests: 0, flakyTests: 0, blockedTests: 0 },
                    report: aggregatedReport,
                };
                job.progress = job.result.progress;
                job.status = "empty";
                job.process = null;

                sealResult(job, redactor);
                await saveRunJob(job);

                await removeRunFiles(job);
                return;
            }
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

            sealResult(job, redactor);
            await saveRunJob(job);

            await removeRunFiles(job);
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
                ...(runTiming ? { runTiming } : {}),
                ...(job.hostLimits ? { hostLimits: { ...job.hostLimits, requestCap: job.requestCap ?? null } } : {}),
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

    sealResult(job, redactor);
    await saveRunJob(job);

    await removeRunFiles(job);
}
