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
