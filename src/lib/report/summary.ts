import type { DefectRecord, ExecutionRecord } from "./types";

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

export function buildSummary(
    records: ExecutionRecord[],
    defects: DefectRecord[],
    duration: number
) {
    const passed = records.filter((record) => record.status === "Passed").length;
    const failed = records.filter((record) => record.status === "Failed").length;
    const blocked = records.filter((record) => record.status === "Blocked").length;
    const flaky = records.filter((record) => record.status === "Flaky").length;
    // Phase 34 Option C: "Not run" tests skipped themselves with a reason. They
    // were not executed, are left out of the pass/fail ratio, and do not
    // downgrade the recommendation - an unexplained "Blocked" still does.
    const notRunRecords = records.filter((record) => record.status === "Not run");
    const executed = records.filter((record) => record.status !== "Blocked" && record.status !== "Not run").length;
    const reasonCounts = new Map<string, number>();
    for (const record of notRunRecords) {
        const reason = record.skipReason ?? "skipped itself";
        reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
    }
    const notRunReasons = [...reasonCounts].map(([reason, count]) => ({ reason, count }));
    const notRunNote = notRunRecords.length === 0
        ? ""
        : `${notRunRecords.length} ${notRunRecords.length === 1 ? "test" : "tests"} not run: ${notRunReasons.map((r) => (notRunReasons.length > 1 ? `${r.reason} (${r.count})` : r.reason)).join("; ")}`;
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
        notRun: notRunRecords.length,
        notRunReasons,
        notRunNote,
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
