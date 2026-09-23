/**
 * Tests for the run-status poll loop's retry/backoff and terminal-status
 * safety net (TFP-068, Phase 24 reliability audit).
 *
 * useRun.ts's poll loop is normally driven from a useEffect wired to real
 * fetch/window.setTimeout, which needs a DOM this repo's test runner
 * doesn't have. TFP-068 pulled the actual decision logic out into
 * pollRunUntilDone() - a framework-agnostic function that takes fetch/sleep
 * as injected dependencies - specifically so the real production logic
 * (not a re-implementation of it) can be exercised here with a mocked
 * fetch and an instant mocked sleep, without a browser.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/app/_hooks/useRun.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";

import type { RunLifecycleStatus, RunProgressSnapshot, RunResult, RunStatusSnapshot } from "@/app/_lib/types";

const { pollRunUntilDone } = await import("./pollRun.ts");

function makeProgress(): RunProgressSnapshot {
    return {
        totalTests: 1,
        startedTests: 1,
        completedTests: 1,
        passedTests: 1,
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

function makeSnapshot(overrides: Partial<RunStatusSnapshot> = {}): RunStatusSnapshot {
    return {
        runId: "run-1",
        runStatus: "running",
        duration: 1000,
        progress: makeProgress(),
        cancellationRequested: false,
        ...overrides,
    };
}

function makeResult(runStatus: Exclude<RunLifecycleStatus, "queued" | "running"> = "passed"): RunResult {
    return {
        runId: "run-1",
        runStatus,
        passed: runStatus === "passed",
        output: "done",
        duration: 2000,
        progress: makeProgress(),
    };
}

function jsonResponse(body: unknown, ok = true): Response {
    return new Response(JSON.stringify(body), {
        status: ok ? 200 : 500,
        headers: { "content-type": "application/json" },
    });
}

test("pollRunUntilDone: a single transient fetch failure retries with backoff, then completes normally", async () => {
    let callCount = 0;
    const fetchImpl = (async () => {
        callCount += 1;
        if (callCount === 1) {
            throw new Error("simulated network blip");
        }
        return jsonResponse(makeSnapshot({ result: makeResult("passed") }));
    }) as unknown as typeof fetch;

    const delays: number[] = [];
    const sleep = async (ms: number) => {
        delays.push(ms);
    };

    const snapshots: RunStatusSnapshot[] = [];
    let result: RunResult | null = null;
    let terminalWithoutResultCalled = false;
    let failureMessage: string | null = null;

    await pollRunUntilDone("run-1", {
        fetchImpl,
        sleep,
        isCancelled: () => false,
        onSnapshot: (snapshot) => snapshots.push(snapshot),
        onResult: (r) => {
            result = r;
        },
        onTerminalWithoutResult: () => {
            terminalWithoutResultCalled = true;
        },
        onFailure: (message) => {
            failureMessage = message;
        },
    });

    assert.equal(callCount, 2, "should have retried exactly once after the single failure");
    assert.deepEqual(delays, [500], "first retry should use the first backoff delay (500ms)");
    assert.equal(terminalWithoutResultCalled, false);
    assert.equal(failureMessage, null, "a single transient failure must not surface as a user-visible error");
    assert.ok(result, "the run must still reach a result once the failure clears");
    assert.equal((result as unknown as RunResult).runStatus, "passed");
});

test("pollRunUntilDone: exhausting all retries surfaces a failure, with the documented backoff sequence", async () => {
    const fetchImpl = (async () => {
        throw new Error("persistent network failure");
    }) as unknown as typeof fetch;

    const delays: number[] = [];
    const sleep = async (ms: number) => {
        delays.push(ms);
    };

    let failureMessage: string | null = null;

    await pollRunUntilDone("run-1", {
        fetchImpl,
        sleep,
        isCancelled: () => false,
        onSnapshot: () => { },
        onResult: () => { },
        onTerminalWithoutResult: () => { },
        onFailure: (message) => {
            failureMessage = message;
        },
    });

    assert.deepEqual(delays, [500, 1000, 2000], "should back off 500ms -> 1s -> 2s before giving up");
    assert.equal(failureMessage, "persistent network failure");
});

test("pollRunUntilDone: a terminal runStatus with no result payload stops polling (safety net)", async () => {
    const fetchImpl = (async () => jsonResponse(makeSnapshot({ runStatus: "failed" }))) as unknown as typeof fetch;

    let terminalWithoutResultCalled = false;
    let resultCalled = false;

    await pollRunUntilDone("run-1", {
        fetchImpl,
        sleep: async () => { },
        isCancelled: () => false,
        onSnapshot: () => { },
        onResult: () => {
            resultCalled = true;
        },
        onTerminalWithoutResult: () => {
            terminalWithoutResultCalled = true;
        },
        onFailure: () => { },
    });

    assert.equal(terminalWithoutResultCalled, true);
    assert.equal(resultCalled, false);
});

test("pollRunUntilDone: an in-progress runStatus with no result keeps polling", async () => {
    let callCount = 0;
    const fetchImpl = (async () => {
        callCount += 1;
        if (callCount < 3) {
            return jsonResponse(makeSnapshot({ runStatus: "running" }));
        }
        return jsonResponse(makeSnapshot({ result: makeResult("passed") }));
    }) as unknown as typeof fetch;

    const delays: number[] = [];
    let result: RunResult | null = null;

    await pollRunUntilDone("run-1", {
        fetchImpl,
        sleep: async (ms) => {
            delays.push(ms);
        },
        isCancelled: () => false,
        onSnapshot: () => { },
        onResult: (r) => {
            result = r;
        },
        onTerminalWithoutResult: () => { },
        onFailure: () => { },
    });

    assert.equal(callCount, 3);
    assert.deepEqual(delays, [800, 800], "normal in-progress polling uses the 800ms interval, not the retry backoff");
    assert.ok(result);
});
