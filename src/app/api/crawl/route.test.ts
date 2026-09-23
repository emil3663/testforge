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

const { POST } = await import("./route.ts");
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
