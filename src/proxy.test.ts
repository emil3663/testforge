/**
 * TFP-261: the API's request guard (src/proxy.ts), decision by decision; the real server's refusals, and the code a
 * refused run would have run, are tests/regression/testforge.request-guard.spec.ts.
 *
 * ISTQB technique: decision table. Conditions: the Host (loopback by each name, with or without a port; another name;
 * missing); the Origin (absent; the same origin; another origin; another port; "null"); the method (a read, a write);
 * the Content-Type (JSON, JSON with a charset, text/plain, form, multipart, missing).
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/proxy.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";

const { refusalOf, proxy, config } = await import("./proxy.ts");
const { NextRequest } = await import("next/server");

const headers = (entries: Record<string, string>) => new Headers(entries);
const JSON_TYPE = { "content-type": "application/json" };

test("a loopback Host by any of its names, with or without a port, goes on; any other name, or none, is refused", () => {
    for (const host of ["localhost:3000", "127.0.0.1:3001", "[::1]:3000", "localhost", "LOCALHOST:3000"]) {
        assert.equal(refusalOf("GET", headers({ host })), null, host);
    }
    for (const host of ["attacker.example:3000", "192.168.1.20:3000", "localhost.attacker.example", "127.0.0.1.nip.io:3000", ""]) {
        assert.match(refusalOf("GET", headers({ host })) ?? "", /Host .* isn't this machine/, host);
    }
});

test("an Origin goes on only when it is this same origin, port included; another site, another port or null is refused", () => {
    assert.equal(refusalOf("POST", headers({ host: "localhost:3000", origin: "http://localhost:3000", ...JSON_TYPE })), null);
    assert.equal(refusalOf("POST", headers({ host: "localhost:3000", ...JSON_TYPE })), null, "no Origin: a same-origin GET, or a tool on this machine");
    for (const origin of ["https://attacker.example", "http://localhost:3001", "http://127.0.0.1:3000", "null"]) {
        assert.match(refusalOf("POST", headers({ host: "localhost:3000", origin, ...JSON_TYPE })) ?? "", /another origin/, origin);
    }
});

test("a write must be JSON; a read needs no Content-Type", () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE", "post"]) {
        assert.equal(refusalOf(method, headers({ host: "localhost:3000", "content-type": "application/json; charset=utf-8" })), null, method);
        for (const type of ["text/plain", "application/x-www-form-urlencoded", "multipart/form-data; boundary=x"]) {
            assert.match(refusalOf(method, headers({ host: "localhost:3000", "content-type": type })) ?? "", /must be Content-Type: application\/json/, `${method} ${type}`);
        }
        assert.match(refusalOf(method, headers({ host: "localhost:3000" })) ?? "", /it was missing/, method);
    }
    assert.equal(refusalOf("GET", headers({ host: "localhost:3000" })), null);
});

test("the 2026-10-27 request (another Origin, text/plain) is refused with 403 and why; the UI's own request goes on", async () => {
    const refused = proxy(new NextRequest("http://localhost:3000/api/run", { method: "POST", headers: { host: "localhost:3000", origin: "https://attacker.example", "content-type": "text/plain" }, body: "{}" }));
    assert.equal(refused.status, 403);
    assert.match((await refused.json()).error, /another origin \(https:\/\/attacker\.example\)/);
    const allowed = proxy(new NextRequest("http://localhost:3000/api/run", { method: "POST", headers: { host: "localhost:3000", origin: "http://localhost:3000", ...JSON_TYPE }, body: "{}" }));
    assert.equal(allowed.headers.get("x-middleware-next"), "1", "NextResponse.next(): the route runs");
});

test("the guard covers every API route and nothing else", () => {
    assert.equal(config.matcher, "/api/:path*");
});
