/**
 * Tests for req.json() error handling on POST /api/introspect
 * (TFP-067, Phase 24 reliability audit).
 *
 * baseUrl and paths are both optional here (both fall back to defaults),
 * so a malformed body must be rejected explicitly rather than relying on
 * a required-field check to incidentally produce the 400.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/app/api/introspect/route.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";

const { POST } = await import("./route.ts");
const { NextRequest } = await import("next/server");

test("POST /api/introspect: truncated JSON body returns 400 with a JSON error body, not a 500", async () => {
    const req = new NextRequest(new URL("http://localhost/api/introspect"), {
        method: "POST",
        body: "{not valid json",
        headers: { "content-type": "application/json" },
    });

    const res = await POST(req);
    const body = await res.json();

    assert.equal(res.status, 400);
    assert.equal(typeof body.error, "string");
});

test("POST /api/introspect: empty body returns 400 with a JSON error body, not a 500", async () => {
    const req = new NextRequest(new URL("http://localhost/api/introspect"), {
        method: "POST",
        body: "",
        headers: { "content-type": "application/json" },
    });

    const res = await POST(req);
    const body = await res.json();

    assert.equal(res.status, 400);
    assert.equal(typeof body.error, "string");
});

// Phase 40 Decision 8 (TFP-174): a page on another origin is rejected before inspection, naming it.
test("POST /api/introspect: a page URL on another origin returns 400 naming it, before anything is inspected", async () => {
    const req = new NextRequest(new URL("http://localhost/api/introspect"), {
        method: "POST",
        body: JSON.stringify({ baseUrl: "https://site.example", paths: ["https://site.example/#/contact", "https://other.example/x"] }),
        headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error, "https://other.example/x is not on the run's site (https://site.example); every page must be on the same origin.");
});

// TFP-174's follow-up: a path that isn't a full URL but resolves to another site is rejected the same way.
test("a protocol-relative path (//evil.test/x) or a backslash one (/\\evil.test/x) resolves to another site: rejected before inspection, naming it; real paths pass", async () => {
    const { findForeignPath, normalizeInspectionPathList } = await import("../../../lib/introspect/paths.ts");
    const base = "https://site.example/app";
    for (const page of ["//evil.test/x", "/\\evil.test/x", "\\\\evil.test\\x", " //evil.test "]) {
        assert.equal(findForeignPath(base, ["/", page]), page.trim(), JSON.stringify(page));
        assert.deepEqual(normalizeInspectionPathList(base, ["/", page]), ["/"], `${JSON.stringify(page)} is never visited`);
        const res = await POST(new NextRequest(new URL("http://localhost/api/introspect"), {
            method: "POST",
            body: JSON.stringify({ baseUrl: base, paths: ["/", page] }),
            headers: { "content-type": "application/json" },
        }));
        assert.equal(res.status, 400, JSON.stringify(page));
        assert.equal((await res.json()).error, `${page.trim()} is not on the run's site (https://site.example); every page must be on the same origin.`);
    }
    // Paths on the site still pass, hash routes and queries included. "https:evil.test/x" with an https base is a
    // path on the site (the URL parser reads it as relative), so it is resolved there, as the inspector would.
    const fine = ["/", "notes", "/#/contact", "/search?next=//evil.test", "/a/b#//evil.test", "https://site.example/#/product/1", "https:evil.test/x"];
    assert.equal(findForeignPath(base, fine), null);
    assert.deepEqual(normalizeInspectionPathList(base, fine), ["/", "/notes", "/#/contact", "/search?next=//evil.test", "/a/b#//evil.test", "/#/product/1", "/evil.test/x"]);
});
