import { closedGates, TEST_GATES, type TestGate } from "@/lib/run/test-gates";
import type { DefectRecord, ExecutionRecord, RunReport } from "./types";

export const NO_TEST_RAN = "No recommendation: no test ran";
/** TFP-125: the suite declared no test at all (every area in scope was not applicable). */
export const NOTHING_TO_RUN = "Nothing to run: the suite has no tests";

/**
 * True when no test executed: every test was Not run (skipped with a reason)
 * or Blocked (interrupted, or skipped without one). Playwright calls such a
 * run passed, so a badge coloured by its pass/fail would read green; callers
 * show a neutral badge instead.
 */
export function noTestRan(summary: Pick<RunReport["summary"], "passed" | "flaky" | "failed">) {
    return summary.passed + summary.flaky + summary.failed === 0;
}

/**
 * Phase 38 Decision 1: e.g. "Not run by gate: read-only 0, interactive 11,
 * active 1". Empty for runs whose tests declare no gate (before TFP-146).
 */
export function formatNotRunByGate(summary: Pick<RunReport["summary"], "notRunByGate">) {
    const counts = summary.notRunByGate;
    const kept = counts ? TEST_GATES.filter((gate) => (counts[gate] ?? 0) > 0) : [];
    return kept.length > 0 ? `Not run because their gate was closed: ${kept.map((gate) => `${gate} ${counts![gate]}`).join(", ")}` : "";
}

function releaseRecommendation(
    planned: number,
    ran: number,
    failed: number,
    blocked: number,
    critical: number,
    major: number
) {
    // GEN-43: with interactive tests off, a suite can be all "Not run" (e.g.
    // only the local model's gap-fill block); an interrupted run can be all
    // Blocked. Nothing executed is no evidence for a release either way.
    if (ran === 0) {
        return planned === 0 ? NOTHING_TO_RUN : NO_TEST_RAN;
    }

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
    duration: number,
    /** Whether the run turned interactive tests on (TESTFORGE_INTERACTIVE=1); off by default, as in the executor. */
    interactiveEnabled = false
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
    // Phase 38 Decision 1: how many tests each gate kept from running - Not
    // run tests whose gate was closed for this run. A test that skipped
    // itself for its own reason behind an open gate (e.g. a read-only cookie
    // check with no cookie to check) is not counted. Only when the run's
    // tests declare gates, so older runs don't show zeros.
    const closed = closedGates(interactiveEnabled);
    const notRunByGate = records.some((record) => record.gate)
        ? Object.fromEntries(TEST_GATES.map((gate) => [gate, closed.includes(gate) ? notRunRecords.filter((record) => record.gate === gate).length : 0])) as Record<TestGate, number>
        : undefined;
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
        ...(notRunByGate ? { notRunByGate } : {}),
        notRunNote,
        duration,
        releaseRecommendation: releaseRecommendation(records.length, passed + flaky + failed, failed, blocked, critical, major),
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
