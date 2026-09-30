/**
 * Phase 36 (TFP-125, Decision 3): the cookie/session test can fail.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/generate/mock/cookie-session-checks.test.ts
 */
import assert from "node:assert";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";

const { buildCookieSessionTests, SESSION_COOKIE_NAME } = await import("./cookie-session-checks.ts");
const { findTypeErrors, findUnawaitedAssertions } = await import("../validate.ts");

test("SESSION_COOKIE_NAME: framework session names and session-ish words, not analytics cookies", () => {
    for (const name of ["JSESSIONID", "PHPSESSID", "connect.sid", "rack.session", "laravel_session", "session", "app_session", "sid", "auth-token", "jwt"]) {
        assert.ok(SESSION_COOKIE_NAME.test(name), name);
    }
    for (const name of ["_ga", "_gid", "consent", "theme", "possession", "sidebar", "authority"]) {
        assert.ok(!SESSION_COOKIE_NAME.test(name), name);
    }
});

test("the generated test type-checks and awaits its web-first assertions", () => {
    const suite = `import { test, expect } from '@playwright/test';\n${buildCookieSessionTests().join("\n")}\n`;
    assert.deepEqual(findTypeErrors(suite), []);
    assert.deepEqual(findUnawaitedAssertions(suite).filter((a) => a.returnsPromise), []);
});

class Skipped extends Error {}

/** Runs the generated test the way Playwright would: real browser, real page, Playwright's expect; test.skip honoured. */
async function runGenerated(baseURL: string) {
    const ts = await import("typescript");
    const { chromium, expect } = await import("@playwright/test");
    const js = ts.transpileModule(buildCookieSessionTests()[0], { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    let body: ((fixtures: { page: unknown; context: unknown }) => Promise<void>) | null = null;
    const fakeTest = Object.assign((_title: string, fn: typeof body) => { body = fn; }, {
        skip: (condition: boolean, reason: string) => {
            if (condition) throw new Skipped(reason);
        },
    });
    new Function("test", "expect", js)(fakeTest, expect);
    // app.site.test and its parent domain resolve to this machine, so a
    // Domain=site.test cookie is a real parent-domain cookie.
    const browser = await chromium.launch({ args: ["--host-resolver-rules=MAP *.site.test 127.0.0.1"] });
    try {
        const context = await browser.newContext({ baseURL });
        const page = await context.newPage();
        try {
            await body!({ page, context });
            return { outcome: "passed" as const, message: "" };
        } catch (error) {
            if (error instanceof Skipped) return { outcome: "skipped" as const, message: error.message };
            const actual = (error as { matcherResult?: { actual?: unknown } }).matcherResult?.actual;
            return { outcome: "failed" as const, message: JSON.stringify(actual ?? (error as Error).message) };
        }
    } finally {
        await browser.close();
    }
}

async function withCookies(setCookie: string[], run: (baseURL: string) => Promise<void>) {
    const server = createServer((_req, res) => {
        res.writeHead(200, { "content-type": "text/html", ...(setCookie.length ? { "set-cookie": setCookie } : {}) }).end("<!doctype html><title>t</title><h1>Home</h1>");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
        await run(`http://app.site.test:${(server.address() as AddressInfo).port}`);
    } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
    }
}

test("in a real browser: passes a browser-session cookie scoped to the site, fails a 400-day or parent-domain one, skips when there is none", async () => {
    await withCookies(["rack.session=abc; Path=/; HttpOnly"], async (baseURL) => {
        assert.deepEqual(await runGenerated(baseURL), { outcome: "passed", message: "" });
    });
    await withCookies(["sid=abc; Path=/; Max-Age=86400"], async (baseURL) => {
        assert.equal((await runGenerated(baseURL)).outcome, "passed", "one day is within the limit");
    });
    await withCookies(["sid=abc; Path=/; Max-Age=34560000"], async (baseURL) => {
        const result = await runGenerated(baseURL);
        assert.equal(result.outcome, "failed");
        assert.match(result.message, /\\"sid\\" stays valid for 400 days \(more than 30\)/);
    });
    await withCookies(["sid=abc; Path=/; Domain=site.test"], async (baseURL) => {
        const result = await runGenerated(baseURL);
        assert.equal(result.outcome, "failed");
        assert.match(result.message, /\\"sid\\" is set for \.site\.test, so every subdomain of site\.test receives it, not only app\.site\.test/);
    });
    await withCookies(["_ga=1; Path=/; Max-Age=63072000"], async (baseURL) => {
        const result = await runGenerated(baseURL);
        assert.equal(result.outcome, "skipped", "a long-lived analytics cookie is not a session cookie");
        assert.match(result.message, /^no session cookie on the landing page \(1 cookie\(s\) set by the site, none named like a session\)/);
    });
    await withCookies([], async (baseURL) => {
        assert.equal((await runGenerated(baseURL)).outcome, "skipped");
    });
});
