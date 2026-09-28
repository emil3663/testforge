import type { CoverageMatrixItem, ExecutionRecord, ExecutionStatus, SeoRecommendation } from "@/lib/report/types";
import type { RunProgressSnapshot } from "@/app/_lib/types";

function ensureSentence(value: string) {
    const trimmed = value.trim();

    if (!trimmed) {
        return "";
    }

    return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

export function formatExecutionRemark(record: ExecutionRecord) {
    const trimmed = record.remarks.trim();

    if (!trimmed) {
        return record.status === "Passed"
            ? "Passed. The observed result matched the expected result."
            : record.status === "Flaky"
                ? "Passed after retry. The observed result was unstable before it recovered."
                : record.status === "Blocked"
                    ? "Blocked. The test could not be completed."
                    : record.status === "Not run"
                        ? "Not run. The test skipped itself."
                        : "Failed. The observed result did not match the expected result.";
    }

    return ensureSentence(trimmed);
}

export function summarizeSuite(records: ExecutionRecord[]) {
    return records.reduce(
        (summary, record) => {
            summary[record.status] += 1;
            return summary;
        },
        { Passed: 0, Failed: 0, Blocked: 0, Flaky: 0, "Not run": 0 } as Record<ExecutionStatus, number>
    );
}

export function statusClasses(status: ExecutionStatus) {
    if (status === "Passed") {
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
    }

    if (status === "Failed") {
        return "bg-rose-100 text-rose-800 border-rose-200";
    }

    if (status === "Blocked") {
        return "bg-amber-100 text-amber-800 border-amber-200";
    }

    // Phase 34 Option C: skipped by choice - neutral, neither pass nor problem.
    if (status === "Not run") {
        return "bg-zinc-100 text-zinc-700 border-zinc-200";
    }

    return "bg-sky-100 text-sky-800 border-sky-200";
}

export function coverageClasses(status: CoverageMatrixItem["status"]) {
    if (status === "covered") {
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
    }

    if (status === "partial") {
        return "bg-amber-100 text-amber-800 border-amber-200";
    }

    return "bg-rose-100 text-rose-800 border-rose-200";
}

export function recommendationClasses(priority: SeoRecommendation["priority"]) {
    if (priority === "High") {
        return "border-rose-200 bg-rose-50 text-rose-700";
    }

    if (priority === "Medium") {
        return "border-amber-200 bg-amber-50 text-amber-700";
    }

    return "border-sky-200 bg-sky-50 text-sky-700";
}

export function livePlannedExecutionStatusLabel(
    status: RunProgressSnapshot["plannedExecutions"][number]["status"]
) {
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

    if (status === "interrupted") {
        return "Interrupted";
    }

    if (status === "running") {
        return "Running";
    }

    return "Queued";
}

export function livePlannedExecutionStatusClasses(
    status: RunProgressSnapshot["plannedExecutions"][number]["status"]
) {
    if (status === "passed") {
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
    }

    if (status === "failed") {
        return "bg-rose-100 text-rose-800 border-rose-200";
    }

    if (status === "flaky") {
        return "bg-sky-100 text-sky-800 border-sky-200";
    }

    if (status === "blocked") {
        return "bg-amber-100 text-amber-800 border-amber-200";
    }

    if (status === "interrupted") {
        return "bg-orange-100 text-orange-800 border-orange-200";
    }

    if (status === "running") {
        return "bg-indigo-100 text-indigo-800 border-indigo-200";
    }

    return "bg-zinc-100 text-zinc-700 border-zinc-200";
}

export function getSuiteLabel(suite: string) {
    const trimmed = suite.trim();
    return trimmed || "General test set";
}

export function toSentenceCase(value: string) {
    if (value.toLowerCase() === "seo") {
        return "SEO";
    }

    return value
        .split("/")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" / ");
}
