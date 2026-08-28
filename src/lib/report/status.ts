import { escapeReportHtml, formatMilliseconds } from "./text";
import type { FallbackExecutionStatus } from "./types";

type PlannedExecutionLiveStatus = "not-run" | "running" | "passed" | "failed" | "flaky" | "blocked" | "interrupted";

interface PlannedExecutionLike {
    id: string;
    title: string;
    linkLabel: string | null;
    duration: number | null;
    status: PlannedExecutionLiveStatus;
}

interface ProgressLike {
    plannedExecutions: PlannedExecutionLike[];
}

export function mapFallbackExecutionStatus(
    status: PlannedExecutionLiveStatus
): FallbackExecutionStatus {
    if (status === "passed") {
        return "Passed";
    }

    if (status === "failed") {
        return "Failed";
    }

    if (status === "flaky") {
        return "Flaky";
    }

    if (status === "blocked") {
        return "Blocked";
    }

    if (status === "interrupted" || status === "running") {
        return "Interrupted";
    }

    return "Not run";
}

export function fallbackExecutionSummary(status: FallbackExecutionStatus) {
    if (status === "Passed") {
        return "Completed successfully before the run stopped.";
    }

    if (status === "Failed") {
        return "Completed with a failure before the run stopped.";
    }

    if (status === "Flaky") {
        return "Recovered after a retry before the run stopped.";
    }

    if (status === "Blocked") {
        return "Marked as skipped or blocked before the run stopped.";
    }

    if (status === "Interrupted") {
        return "Started but did not finish before the run was stopped.";
    }

    return "This test had not started when the run was stopped.";
}

export function getFallbackExecutionRecords(progress: ProgressLike) {
    return (progress.plannedExecutions ?? []).map((execution) => ({
        id: execution.id,
        title: execution.title,
        linkLabel: execution.linkLabel,
        duration: execution.duration,
        status: mapFallbackExecutionStatus(execution.status),
        remarks: fallbackExecutionSummary(mapFallbackExecutionStatus(execution.status)),
    }));
}

export function fallbackStatusClasses(status: FallbackExecutionStatus) {
    if (status === "Passed") {
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
    }

    if (status === "Failed") {
        return "bg-rose-100 text-rose-800 border-rose-200";
    }

    if (status === "Flaky") {
        return "bg-sky-100 text-sky-800 border-sky-200";
    }

    if (status === "Blocked") {
        return "bg-amber-100 text-amber-800 border-amber-200";
    }

    if (status === "Interrupted") {
        return "bg-orange-100 text-orange-800 border-orange-200";
    }

    return "bg-zinc-100 text-zinc-700 border-zinc-200";
}

export function buildFallbackExecutionHtmlMarkup(progress: ProgressLike) {
    const records = getFallbackExecutionRecords(progress);

    if (records.length === 0) {
        return "";
    }

    return `<ul>${records.map((record) => `
            <li>
                <strong>${escapeReportHtml(record.title)}</strong><br />
                Status: ${escapeReportHtml(record.status)}<br />
                Duration: ${escapeReportHtml(record.duration !== null ? formatMilliseconds(record.duration) : "Not captured")}<br />
                ${escapeReportHtml(record.remarks)}
            </li>`).join("")}
        </ul>`;
}
