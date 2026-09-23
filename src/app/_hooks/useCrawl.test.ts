/**
 * Tests for the crawl-status poll loop's retry/backoff and terminal-status
 * safety net (TFP-068, Phase 24 reliability audit).
 *
 * Mirrors useRun.test.ts: pollCrawlUntilDone() is the framework-agnostic
 * poll loop extracted out of useCrawl.ts's useEffect specifically so it can
 * be exercised here with a mocked fetch/sleep, without a DOM.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/app/_hooks/useCrawl.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";
import type { CrawlProgressSnapshot, CrawlResult, CrawlStatusSnapshot } from "@/app/_lib/types";

const { pollCrawlUntilDone } = await import("./useCrawl.ts");

function makeProgress(): CrawlProgressSnapshot {
    return {
        visitedUrls: 1,
        queuedUrls: 0,
        discoveredPages: 1,
        maxPages: 100,
        currentUrl: null,
        currentPath: null,
        currentTitle: null,
        lastCompletedPath: null,
        lastCompletedTitle: null,
        warningsCount: 0,
    };
}

function makeSnapshot(overrides: Partial<CrawlStatusSnapshot> = {}): CrawlStatusSnapshot {
    return {
        crawlId: "crawl-1",
        crawlStatus: "running",
        duration: 1000,
        progress: makeProgress(),
        ...overrides,
    };
}

function makeResult(): CrawlResult {
    return {
        crawledAt: new Date(0).toISOString(),
        baseUrl: "http://localhost:3000",
        pageCount: 1,
        pages: [{ path: "/", url: "http://localhost:3000/", title: "Home", discoveredFrom: null }],
        warnings: [],
    };
}

function jsonResponse(body: unknown, ok = true): Response {
    return new Response(JSON.stringify(body), {
        status: ok ? 200 : 500,
        headers: { "content-type": "application/json" },
    });
}

test("pollCrawlUntilDone: a single transient fetch failure retries with backoff, then completes normally", async () => {
    let callCount = 0;
    const fetchImpl = (async () => {
        callCount += 1;
        if (callCount === 1) {
            throw new Error("simulated network blip");
        }
        return jsonResponse(makeSnapshot({ crawlStatus: "completed", result: makeResult() }));
    }) as unknown as typeof fetch;

    const delays: number[] = [];
    let result: CrawlResult | null = null;
    let failureMessage: string | null = null;

    await pollCrawlUntilDone("crawl-1", {
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
        onFailure: (message) => {
            failureMessage = message;
        },
    });

    assert.equal(callCount, 2, "should have retried exactly once after the single failure");
    assert.deepEqual(delays, [500], "first retry should use the first backoff delay (500ms)");
    assert.equal(failureMessage, null, "a single transient failure must not surface as a user-visible error");
    assert.ok(result, "the crawl must still reach a result once the failure clears");
});

test("pollCrawlUntilDone: exhausting all retries surfaces a failure, with the documented backoff sequence", async () => {
    const fetchImpl = (async () => {
        throw new Error("persistent network failure");
    }) as unknown as typeof fetch;

    const delays: number[] = [];
    let failureMessage: string | null = null;

    await pollCrawlUntilDone("crawl-1", {
        fetchImpl,
        sleep: async (ms) => {
            delays.push(ms);
        },
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

test("pollCrawlUntilDone: a terminal crawlStatus with no result payload stops polling (safety net)", async () => {
    const fetchImpl = (async () => jsonResponse(makeSnapshot({ crawlStatus: "failed", error: "site unreachable" }))) as unknown as typeof fetch;

    let terminalMessage: string | null = null;
    let resultCalled = false;

    await pollCrawlUntilDone("crawl-1", {
        fetchImpl,
        sleep: async () => { },
        isCancelled: () => false,
        onSnapshot: () => { },
        onResult: () => {
            resultCalled = true;
        },
        onTerminalWithoutResult: (message) => {
            terminalMessage = message;
        },
        onFailure: () => { },
    });

    assert.equal(terminalMessage, "site unreachable");
    assert.equal(resultCalled, false);
});
