/**
 * Tests for req.json() error handling on POST /api/generate
 * (TFP-067, Phase 24 reliability audit).
 *
 * Before this fix, an unguarded `await req.json()` on a malformed body
 * threw and Next.js turned that into a raw 500. The fix applies the
 * existing in-repo `.catch(() => ({}))` pattern (see runs/route.ts,
 * run/route.ts's DELETE handler) so a malformed body instead falls
 * through to the route's own "description is required" validation,
 * which already returns a clean 400.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/app/api/generate/route.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";

const { POST } = await import("./route.ts");
const { NextRequest } = await import("next/server");

test("POST /api/generate: truncated JSON body returns 400 with a JSON error body, not a 500", async () => {
    const req = new NextRequest(new URL("http://localhost/api/generate"), {
        method: "POST",
        body: "{not valid json",
        headers: { "content-type": "application/json" },
    });

    const res = await POST(req);
    const body = await res.json();

    assert.equal(res.status, 400);
    assert.equal(typeof body.error, "string");
});

test("POST /api/generate: empty body returns 400 with a JSON error body, not a 500", async () => {
    const req = new NextRequest(new URL("http://localhost/api/generate"), {
        method: "POST",
        body: "",
        headers: { "content-type": "application/json" },
    });

    const res = await POST(req);
    const body = await res.json();

    assert.equal(res.status, 400);
    assert.equal(typeof body.error, "string");
});
