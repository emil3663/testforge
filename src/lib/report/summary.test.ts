/**
 * Phase 34, Decision 7 Option C (TFP-119): a test that skipped itself with a
 * stated reason is "not run by choice". Before, every skip counted on the
 * failed side of the pass/fail ratio and made a clean run "Ready with
 * caution", so a run with interactive tests off - the safe default - could
 * never read "Ready for release".
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/report/summary.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";
import type { ExecutionRecord, ExecutionStatus } from "./types.ts";

const { buildSummary } = await import("./summary.ts");

const INTERACTIVE_OFF = "database round trip: saves data through a form on the live site, so it only runs when TESTFORGE_INTERACTIVE=1 is set for the run";

function record(status: ExecutionStatus, skipReason?: string): ExecutionRecord {
    return {
        id: "x", title: "t", description: "", suite: "s", area: "Functional", interactionType: null, browser: "chromium",
        status, duration: 1, remarks: "", rawMessage: "", reproductionSteps: [], artifacts: [], order: 0,
        ...(skipReason ? { skipReason } : {}),
    };
}

test("a clean run with interactive tests off reads Ready for release, with the not-run tests named beside it", () => {
    const summary = buildSummary([record("Passed"), record("Passed"), record("Not run", INTERACTIVE_OFF), record("Not run", INTERACTIVE_OFF)], [], 10);
    assert.equal(summary.releaseRecommendation, "Ready for release");
    assert.equal(summary.notRun, 2);
    assert.equal(summary.executed, 2);
    assert.deepEqual(summary.passFailRatio, { passed: 2, failed: 0 }, "not-run tests are out of the ratio");
    assert.equal(summary.notRunNote, `2 tests not run: ${INTERACTIVE_OFF}`);
    assert.deepEqual(summary.notRunReasons, [{ reason: INTERACTIVE_OFF, count: 2 }]);
});

test("different reasons are each counted", () => {
    const summary = buildSummary([record("Not run", "a"), record("Not run", "b"), record("Not run", "a")], [], 1);
    assert.equal(summary.notRunNote, "3 tests not run: a (2); b (1)");
});

test("an unexplained skip or interruption still means Ready with caution and counts as failed in the ratio", () => {
    const summary = buildSummary([record("Passed"), record("Blocked")], [], 1);
    assert.equal(summary.releaseRecommendation, "Ready with caution");
    assert.deepEqual(summary.passFailRatio, { passed: 1, failed: 1 });
    assert.equal(summary.notRun, 0);
    assert.equal(summary.notRunNote, "");
});

test("a failure still means Not ready, whatever was not run", () => {
    const summary = buildSummary([record("Failed"), record("Not run", INTERACTIVE_OFF)], [], 1);
    assert.equal(summary.releaseRecommendation, "Not ready for release");
});

test("GEN-43: a run where every test was not run gives no recommendation, not Ready for release", () => {
    const gapFill = "gap-fill test written by the local model (m): it may submit forms on the live site, so it only runs when TESTFORGE_INTERACTIVE=1 is set for the run";
    const summary = buildSummary([record("Not run", gapFill)], [], 1);
    assert.equal(summary.releaseRecommendation, "No recommendation: no test ran");
    assert.equal(summary.executed, 0);
    assert.equal(summary.notRunNote, `1 test not run: ${gapFill}`);
});

// --- RPT-14 follow-up (Phase 34 Acceptance Criteria 5) -----------------------

const { noTestRan, NO_TEST_RAN } = await import("./summary.ts");
const { buildReport } = await import("./report.ts");
const { buildReportHtmlDocument } = await import("./html.ts");

test("RPT-14: an all-interrupted run gives no recommendation - Blocked tests did not run either", () => {
    const summary = buildSummary([record("Blocked"), record("Blocked")], [], 1);
    assert.equal(summary.releaseRecommendation, NO_TEST_RAN);
    assert.ok(noTestRan(summary));
});

test("RPT-14: a mix of run and Blocked tests still reads Ready with caution", () => {
    const summary = buildSummary([record("Passed"), record("Blocked"), record("Not run", INTERACTIVE_OFF)], [], 1);
    assert.equal(summary.releaseRecommendation, "Ready with caution");
    assert.ok(!noTestRan(summary));
});

test("RPT-14: noTestRan counts passed, flaky and failed only", () => {
    assert.ok(noTestRan(buildSummary([record("Not run", INTERACTIVE_OFF), record("Blocked")], [], 1)));
    assert.ok(noTestRan(buildSummary([], [], 1)));
    assert.ok(!noTestRan(buildSummary([record("Flaky")], [], 1)));
    assert.ok(!noTestRan(buildSummary([record("Failed")], [], 1)));
});

test("RPT-14: the HTML export's recommendation banner is neutral when no test ran, not green or orange", () => {
    const base = buildReport({ suites: [], errors: [], stats: { duration: 0, expected: 0, unexpected: 0, flaky: 0, skipped: 0 } }, [], "");
    const banner = (records: ExecutionRecord[]) =>
        buildReportHtmlDocument({ ...base, summary: { ...base.summary, ...buildSummary(records, [], 1) } }, "r").match(/rec-banner (rec-\w+)/)?.[1];
    assert.equal(banner([record("Not run", INTERACTIVE_OFF)]), "rec-none");
    assert.equal(banner([record("Blocked")]), "rec-none");
    assert.equal(banner([record("Passed"), record("Blocked")]), "rec-blocked");
    assert.equal(banner([record("Passed")]), "rec-passed");
    assert.equal(banner([record("Failed")]), "rec-failed");
});
