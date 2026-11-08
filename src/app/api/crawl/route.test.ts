/**
 * Tests for req.json() error handling on POST /api/crawl
 * (TFP-067, Phase 24 reliability audit).
 *
 * baseUrl is optional here (falls back to a default), so the required-field
 * trick used elsewhere in this fix doesn't apply - a malformed body must be
 * rejected explicitly, before it can silently fall through to "no baseUrl
 * given, use the default" and return 202/200 instead of 400.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/app/api/crawl/route.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";

const { POST, GET } = await import("./route.ts");
const { NextRequest } = await import("next/server");

test("POST /api/crawl: truncated JSON body returns 400 with a JSON error body, not a 500", async () => {
    const req = new NextRequest(new URL("http://localhost/api/crawl"), {
        method: "POST",
        body: "{not valid json",
        headers: { "content-type": "application/json" },
    });

    const res = await POST(req);
    const body = await res.json();

    assert.equal(res.status, 400);
    assert.equal(typeof body.error, "string");
});

test("POST /api/crawl: non-object JSON body (e.g. a bare string) is rejected with 400", async () => {
    const req = new NextRequest(new URL("http://localhost/api/crawl"), {
        method: "POST",
        body: JSON.stringify("just a string"),
        headers: { "content-type": "application/json" },
    });

    const res = await POST(req);
    const body = await res.json();

    assert.equal(res.status, 400);
    assert.equal(typeof body.error, "string");
});

// TFP-272: a browser that can't start ends the crawl as failed, saying why, instead of leaving it running.
test("POST /api/crawl: when the browser can't start, the crawl ends as failed with the cause in error", async (t) => {
    const { chromium } = await import("@playwright/test");
    t.mock.method(chromium, "launch", async () => {
        throw new Error("browserType.launch: Executable doesn't exist at /no/such/chrome\n╔══ Looks like Playwright was just installed ══╗");
    });
    const started = await (await POST(new NextRequest(new URL("http://localhost/api/crawl"), {
        method: "POST",
        body: JSON.stringify({ baseUrl: "http://localhost:4399" }),
        headers: { "content-type": "application/json" },
    }))).json();

    let snapshot = started;
    for (let poll = 0; poll < 40 && snapshot.crawlStatus === "running"; poll++) {
        await new Promise((resolve) => setTimeout(resolve, 25));
        snapshot = await (await GET(new NextRequest(new URL(`http://localhost/api/crawl?crawlId=${started.crawlId}`)))).json();
    }

    assert.equal(snapshot.crawlStatus, "failed");
    assert.equal(snapshot.error, "The browser for the crawl could not start: browserType.launch: Executable doesn't exist at /no/such/chrome");
});
