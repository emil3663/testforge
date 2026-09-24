import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { Server } from "node:http";
import { devices, expect, type APIRequestContext, test } from "@playwright/test";
import {
    AUTH_FIXTURE_PASS_ENV,
    AUTH_FIXTURE_URL,
    AUTH_FIXTURE_USER_ENV,
    AUTH_FIXTURE_WRONG_PASS_ENV,
    loginRequestIdentity,
    startAuthFixture,
} from "./auth-fixture";

// Phase 20 (TFP-092): config-driven login, once per run. Runs the real app
// against a small real site with a real cookie login (auth-fixture.ts), through
// the built app's own /api/run - no stubbing. The credentials reach TestForge
// only as environment variables (set for the server in
// playwright.regression.config.ts), and the run request names them.

let fixture: Server;

test.beforeAll(async () => {
    fixture = await startAuthFixture();
});

test.afterAll(async () => {
    await new Promise<void>((resolve) => fixture.close(() => resolve()));
});

const validLogin = {
    loginUrl: "/login",
    usernameSelector: "#username",
    passwordSelector: "#password",
    submitSelector: "#submit",
    usernameEnv: AUTH_FIXTURE_USER_ENV,
    passwordEnv: AUTH_FIXTURE_PASS_ENV,
    postLoginPath: "/secure",
    postLoginSelector: "#logout",
};

// Two tests that never log in themselves: each just opens a page that only
// exists behind the login and asserts an element only a signed-in user sees.
// Unauthenticated, /secure redirects to /login and #logout does not exist.
const suiteCode = `import { test, expect } from '@playwright/test';

test.use({ baseURL: '${AUTH_FIXTURE_URL}' });

test.describe('Authenticated pages', () => {
  test('TFFU-001: secure area shows the log out control', async ({ page }) => {
    await page.goto('/secure');
    await expect(page.locator('#logout')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('h1')).toHaveText('Secure area');
  });

  test('TFFU-002: account page shows the log out control', async ({ page }) => {
    await page.goto('/account');
    await expect(page.locator('#logout')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('h1')).toHaveText('Your account');
  });
});
`;

interface RunRecord { title: string; status: string; rawMessage: string }

async function startRun(request: APIRequestContext, login: unknown) {
    return request.post("/api/run", {
        data: { code: suiteCode, selectedPractices: ["functional"], auditMode: "fast", baseUrl: AUTH_FIXTURE_URL, description: "auth", login },
    });
}

async function finishRun(request: APIRequestContext, runId: string) {
    let snapshot: { result?: { report?: { execution: RunRecord[] } } } = {};
    await expect.poll(async () => {
        snapshot = await (await request.get(`/api/run?runId=${runId}`)).json();
        return Boolean(snapshot.result?.report);
    }, { timeout: 120_000, intervals: [2_000] }).toBe(true);
    return snapshot.result!.report!.execution;
}

async function authDirs() {
    return (await readdir(join(process.cwd(), ".playwright-runs")).catch(() => [] as string[])).filter((entry) => entry.startsWith("auth-"));
}

test.describe("Config-driven login (TFP-092)", () => {
    test("with a login configured, every test in the run starts signed in - and the same tests fail without it", async ({ request }) => {
        // The proof that the assertions are only reachable when authenticated:
        // the identical suite, run with no login, fails.
        const anonymous = await startRun(request, undefined);
        expect(anonymous.status()).toBe(202);
        const anonymousRecords = await finishRun(request, (await anonymous.json()).runId);
        expect(anonymousRecords.map((record) => record.status)).toEqual(["Failed", "Failed"]);

        const response = await startRun(request, validLogin);
        expect(response.status()).toBe(202);
        const records = await finishRun(request, (await response.json()).runId);

        expect(records).toHaveLength(2);
        expect(records.map((record) => record.status)).toEqual(["Passed", "Passed"]);

        // The login ran as the same client the tests run as (see browser-context.ts):
        // a site can bind a session to it, so this is asserted, not left to this
        // machine's locale happening to differ.
        expect(loginRequestIdentity()).toEqual({ userAgent: devices["Desktop Chrome"].userAgent, acceptLanguage: "en-US" });
    });

    test("the per-run login state is gone once the run ends", async ({ request }) => {
        const response = await startRun(request, validLogin);
        const { runId } = await response.json();
        await finishRun(request, runId);

        // The process-close cleanup runs a moment after the report is final.
        await expect.poll(async () => (await authDirs()).filter((entry) => entry.includes(runId)), { timeout: 15_000 }).toEqual([]);
    });

    test("a wrong credential is a named run-level error, and no run starts", async ({ request }) => {
        const response = await startRun(request, { ...validLogin, passwordEnv: AUTH_FIXTURE_WRONG_PASS_ENV });
        const body = await response.json();

        expect(response.status()).toBe(422);
        expect(body.errorKind).toBe("login-failed");
        expect(body.error).toContain("Login failed: after submitting the login form the page ended on /login");
        expect(body.error).toContain("The run was not started, so no test ran unauthenticated.");
        expect(body.runId).toBeUndefined();
        expect(await authDirs()).toEqual([]);
    });

    test("a bad selector is a named run-level error that names the selector", async ({ request }) => {
        const response = await startRun(request, { ...validLogin, usernameSelector: "#no-such-field" });
        const body = await response.json();

        expect(response.status()).toBe(422);
        expect(body.error).toContain('Login failed: the username field (selector "#no-such-field") was not found on');
        expect(body.runId).toBeUndefined();
    });

    test("a credential environment variable that is not set is a named error", async ({ request }) => {
        const response = await startRun(request, { ...validLogin, passwordEnv: "TESTFORGE_TEST_LOGIN_NOT_SET" });
        const body = await response.json();

        expect(response.status()).toBe(422);
        expect(body.errorKind).toBe("credential-missing");
        expect(body.error).toContain("environment variable TESTFORGE_TEST_LOGIN_NOT_SET is not set");
    });

    test("an invalid login config is rejected before anything runs; inline credentials are never accepted", async ({ request }) => {
        const inline = await startRun(request, { ...validLogin, password: "hunter2" });
        expect(inline.status()).toBe(400);
        expect((await inline.json()).error).toContain('unrecognized field "password"');

        const noSignal = await startRun(request, { ...validLogin, postLoginPath: undefined, postLoginSelector: undefined });
        expect(noSignal.status()).toBe(400);
        expect((await noSignal.json()).error).toContain("postLoginPath");

        const valueAsName = await startRun(request, { ...validLogin, passwordEnv: "hunter2 with spaces" });
        expect(valueAsName.status()).toBe(400);
        expect((await valueAsName.json()).error).toContain("must be the NAME of an environment variable");
    });
});
