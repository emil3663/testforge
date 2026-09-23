/**
 * Tests for req.json() error handling on POST /api/save-suite
 * (TFP-067, Phase 24 reliability audit).
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/app/api/save-suite/route.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";

const { POST } = await import("./route.ts");
const { NextRequest } = await import("next/server");

test("POST /api/save-suite: truncated JSON body returns 400 with a JSON error body, not a 500", async () => {
    const req = new NextRequest(new URL("http://localhost/api/save-suite"), {
        method: "POST",
        body: "{not valid json",
        headers: { "content-type": "application/json" },
    });

    const res = await POST(req);
    const body = await res.json();

    assert.equal(res.status, 400);
    assert.equal(typeof body.error, "string");
});

test("POST /api/save-suite: empty body returns 400 with a JSON error body, not a 500", async () => {
    const req = new NextRequest(new URL("http://localhost/api/save-suite"), {
        method: "POST",
        body: "",
        headers: { "content-type": "application/json" },
    });

    const res = await POST(req);
    const body = await res.json();

    assert.equal(res.status, 400);
    assert.equal(typeof body.error, "string");
});
