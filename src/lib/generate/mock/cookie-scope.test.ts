/**
 * TFP-144: the Standard security check and the Comprehensive passive-security
 * check must flag the same cookies for missing HttpOnly/Secure. On
 * rizonetech.com (2026-10-01) the Standard check named 6 cookies and passive
 * security none: the Standard check took every cookie the site set, passive
 * security only those named like a session. Both now take the session-named
 * ones (SESSION_COOKIE_NAME).
 *
 * Phase 38 (TFP-147, Decision 4): Standard no longer has a cookie check of
 * its own. Its security suite runs the passive check itself, built by the
 * same function, so the two cannot drift apart again. These tests now pin
 * that: the Standard check is the passive one, and still flags only the
 * session cookie.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/generate/mock/cookie-scope.test.ts
 */
import assert from "node:assert";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";

const { buildSecurityChecks } = await import("./security-checks.ts");
const { checkDetails, passiveSecurityPageTests } = await import("../comprehensive-security.ts");
const { PASSIVE_SECURITY_HELPERS } = await import("../comprehensive-security-helpers.ts");
const { findTypeErrors } = await import("../validate.ts");
const { flattenSuites } = await import("../../report/execution.ts");
const { chromiumSkipReason } = await import("../../../test-support/chromium.ts");
const { runPlaywrightSpec } = await import("../../../test-support/playwright-cli.ts");
const needsChromium = await chromiumSkipReason();

const COOKIE_CHECK = "sends its security headers and session cookies";

/** The Standard security suite's cookie check for /, with the helpers the suite writes above it. */
function standardCookieTest() {
    const { tests, preamble } = buildSecurityChecks("http://127.0.0.1:1", null);
    const found = tests.filter((t) => t.includes(COOKIE_CHECK));
    assert.equal(found.length, 1);
    return `${preamble}\n${found[0]}`;
}

function passiveCookieTest(path: string) {
    const found = passiveSecurityPageTests({ escapedPath: path, details: () => "{ annotation: [] }" }).filter((t) => t.includes(COOKIE_CHECK));
    assert.equal(found.length, 1);
    return `${PASSIVE_SECURITY_HELPERS}\n${found[0]}`;
}

/** The cookies a finding names as missing HttpOnly or Secure. */
function flaggedCookies(findings: string[]) {
    return findings.filter((f) => /HttpOnly|Secure/.test(f)).map((f) => (/cookie "([^"]+)"/.exec(f) ?? [])[1]).sort();
}

test("the Standard cookie check is the passive check, built by the same function, and type-checks (TFP-147)", () => {
    const standard = buildSecurityChecks("http://127.0.0.1:1", null).tests.filter((t) => t.includes(COOKIE_CHECK));
    const passive = passiveSecurityPageTests({ escapedPath: "/", details: checkDetails("/") }).filter((t) => t.includes(COOKIE_CHECK));
    assert.deepEqual(standard, passive);
    assert.deepEqual(findTypeErrors(`import { test, expect } from '@playwright/test';\n${standardCookieTest()}\n`), []);
});

/** Runs one generated test through the Playwright CLI, returning its outcome, message and findings. */
async function runGenerated(code: string, baseURL: string) {
    const { report } = await runPlaywrightSpec(`import { test, expect } from '@playwright/test';\ntest.use({ baseURL: '${baseURL}' });\n${code}\n`, "cookie-scope-unit", ["--workers=1"]);
    const [record] = flattenSuites(report.suites);
    return { status: record.status, message: record.status === "Not run" ? (record.skipReason ?? "") : record.rawMessage, findings: record.findings ?? [] };
}

test("in a real browser: on a page with a session cookie and two that are not, none with HttpOnly, both checks name the same one", { skip: needsChromium }, async () => {
    const cookies = ["sid=acme-4f9c2a1e7b; Path=/", "_ga=GA1.1.1234567890; Path=/", "theme=dark; Path=/"];
    const server = createServer((_req, res) => {
        res.writeHead(200, { "content-type": "text/html", "set-cookie": cookies }).end("<!doctype html><title>t</title><p>Home</p>");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    try {
        const standard = await runGenerated(standardCookieTest(), origin);
        const passive = await runGenerated(passiveCookieTest("/"), origin);
        assert.equal(standard.status, "Passed", standard.message);
        assert.equal(passive.status, "Passed", passive.message);
        assert.deepEqual(flaggedCookies(standard.findings), ["sid"]);
        assert.deepEqual(flaggedCookies(passive.findings), ["sid"]);
    } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
    }
});

// TFP-147 changed this outcome. Standard's own check was Not run here ("no
// session cookie on the landing page"); the shared check also reads the
// page's headers, so it runs, records the header findings, and names no cookie.
test("in a real browser: with no session-named cookie the Standard check names no cookie, and records the header findings", { skip: needsChromium }, async () => {
    const server = createServer((_req, res) => {
        res.writeHead(200, { "content-type": "text/html", "set-cookie": ["_ga=GA1.1.1234567890; Path=/"] }).end("<!doctype html><title>t</title><p>Home</p>");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
        const result = await runGenerated(standardCookieTest(), `http://127.0.0.1:${(server.address() as AddressInfo).port}`);
        assert.equal(result.status, "Passed", result.message);
        assert.deepEqual(flaggedCookies(result.findings), []);
        assert.ok(result.findings.some((finding) => finding === "no Content-Security-Policy header on /"), JSON.stringify(result.findings));
    } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
    }
});
