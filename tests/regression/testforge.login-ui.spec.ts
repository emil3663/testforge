import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Server } from "node:http";
import { expect, type Page, test } from "@playwright/test";
import {
    AUTH_FIXTURE_PASS,
    AUTH_FIXTURE_PASS_ENV,
    AUTH_FIXTURE_URL,
    AUTH_FIXTURE_USER_ENV,
    startAuthFixture,
} from "./auth-fixture";

// Phase 20 (TFP-097): the "Authenticated Run" section. Real app, real fixture
// with a real cookie login: what the user types must produce the same
// authenticated run the equivalent /api/run request body does.

let fixture: Server;

test.beforeAll(async () => {
    fixture = await startAuthFixture();
});

test.afterAll(async () => {
    await new Promise<void>((resolve) => fixture.close(() => resolve()));
});

// The login exactly as a user would type it into the section.
const typed = {
    "Login URL": "/login",
    "Username field selector": "#username",
    "Password field selector": "#password",
    "Submit button selector": "#submit",
    "Username environment variable name": AUTH_FIXTURE_USER_ENV,
    "Password environment variable name": AUTH_FIXTURE_PASS_ENV,
    "Signed-in page path": "/secure",
    "Signed-in element selector": "#logout",
};

// The same login as the request body field names it.
const asApiBlock = {
    loginUrl: "/login",
    usernameSelector: "#username",
    passwordSelector: "#password",
    submitSelector: "#submit",
    usernameEnv: AUTH_FIXTURE_USER_ENV,
    passwordEnv: AUTH_FIXTURE_PASS_ENV,
    postLoginPath: "/secure",
    postLoginSelector: "#logout",
};

// Two tests that never log in themselves, each on a page that only exists
// behind the login (an unauthenticated visit redirects to /login).
const authenticatedSuite = `import { test, expect } from '@playwright/test';

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

async function generateSuiteAndUseAuthenticatedCode(page: Page) {
    await page.goto("/");
    await page.getByLabel("Base URL").fill(AUTH_FIXTURE_URL);
    await page.getByLabel("What do you want to test?").fill("Create functional coverage for the sign-in page.");
    await expect(page.getByText(/\d+ active/)).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Generate test suite" }).click();
    await expect(page.getByText("generated_test.spec.ts")).toBeVisible({ timeout: 90_000 });

    // Swap in a suite whose assertions only hold when signed in, through the app's own editor.
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page.locator("textarea.font-mono").fill(authenticatedSuite);
}

async function fillLoginSection(page: Page, values: Record<string, string>) {
    const header = page.getByRole("button", { name: /Authenticated Run/i });
    if ((await header.getAttribute("aria-expanded")) !== "true") {
        await header.click();
    }

    for (const [label, value] of Object.entries(values)) {
        await page.getByLabel(label, { exact: true }).fill(value);
    }
}

async function reportFor(request: import("@playwright/test").APIRequestContext, runId: string) {
    let snapshot: { result?: { report?: { execution: { title: string; status: string }[] } } } = {};
    await expect.poll(async () => {
        snapshot = await (await request.get(`/api/run?runId=${runId}`)).json();
        return Boolean(snapshot.result?.report);
    }, { timeout: 120_000, intervals: [2_000] }).toBe(true);
    return snapshot.result!.report!.execution;
}

test.describe("Login config in the UI (TFP-097)", () => {
    test("a login entered in the UI authenticates a real run exactly as the equivalent /api/run request body does", async ({ page, request }) => {
        await generateSuiteAndUseAuthenticatedCode(page);
        await fillLoginSection(page, typed);
        await expect(page.getByTestId("login-config-state")).toHaveText("This run will log in first.");
        await expect(page.getByTestId("login-config-problem")).toHaveCount(0);

        const runRequest = page.waitForRequest((req) => req.url().endsWith("/api/run") && req.method() === "POST");
        const runResponse = page.waitForResponse((res) => res.url().endsWith("/api/run") && res.request().method() === "POST");
        await page.getByRole("button", { name: "Run suite" }).first().click();

        // What the UI sent: the login block, in the API's own field names, exactly as typed.
        const sent = (await runRequest).postDataJSON();
        expect(sent.login).toEqual(asApiBlock);
        const uiRun = await (await runResponse).json();
        expect(uiRun.runId).toBeTruthy();

        // The same suite, same block, sent straight to the API.
        const direct = await request.post("/api/run", {
            data: { code: authenticatedSuite, selectedPractices: ["functional"], auditMode: "fast", baseUrl: AUTH_FIXTURE_URL, description: "direct api", login: asApiBlock },
        });
        expect(direct.status()).toBe(202);
        const apiRunId = (await direct.json()).runId;

        // Same outcome: every test signed in, both passed - and the run signed out fails both (see testforge.auth.spec.ts).
        const uiRecords = await reportFor(request, uiRun.runId);
        const apiRecords = await reportFor(request, apiRunId);
        expect(uiRecords.map((record) => [record.title, record.status])).toEqual(apiRecords.map((record) => [record.title, record.status]));
        expect(uiRecords.map((record) => record.status)).toEqual(["Passed", "Passed"]);

        // Same persisted run config, references only.
        const persisted = async (runId: string) => JSON.parse(await readFile(join(process.cwd(), "runs", runId, "run.json"), "utf8"));
        const [uiRecord, apiRecord] = [await persisted(uiRun.runId), await persisted(apiRunId)];
        expect(uiRecord.login).toEqual(apiRecord.login);
        expect(JSON.stringify(uiRecord)).not.toContain(AUTH_FIXTURE_PASS);
    });

    test("with nothing typed the run carries no login, and is signed out", async ({ page }) => {
        const bodies: { login?: unknown }[] = [];
        await page.route("**/api/run", async (route) => {
            if (route.request().method() === "POST") {
                bodies.push(route.request().postDataJSON());
                await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "stubbed: run not started" }) });
                return;
            }
            await route.continue();
        });

        await generateSuiteAndUseAuthenticatedCode(page);
        await page.getByRole("button", { name: /Authenticated Run/i }).click();
        await expect(page.getByTestId("login-config-state")).toHaveText("No login configured - runs are signed out.");
        await page.getByRole("button", { name: "Run suite" }).first().click();

        await expect.poll(() => bodies.length).toBe(1);
        expect(bodies[0]).not.toHaveProperty("login");
    });

    test("a credential typed where a variable name belongs blocks the run and is never sent", async ({ page }) => {
        let runRequests = 0;
        page.on("request", (req) => {
            if (req.url().endsWith("/api/run") && req.method() === "POST") {
                runRequests += 1;
            }
        });

        await generateSuiteAndUseAuthenticatedCode(page);
        await fillLoginSection(page, { ...typed, "Password environment variable name": AUTH_FIXTURE_PASS });

        await expect(page.getByTestId("login-config-problem")).toContainText("\"Password environment variable name\" must be the NAME of an environment variable in upper case");
        await expect(page.getByTestId("login-config-problem")).not.toContainText(AUTH_FIXTURE_PASS);
        await expect(page.getByRole("button", { name: "Run suite" }).first()).toBeDisabled();
        await expect(page.getByText("Fix the login settings before running")).toBeVisible();
        expect(runRequests).toBe(0);

        // Fix it: the block is usable again.
        await page.getByLabel("Password environment variable name", { exact: true }).fill(AUTH_FIXTURE_PASS_ENV);
        await expect(page.getByTestId("login-config-problem")).toHaveCount(0);
        await expect(page.getByRole("button", { name: "Run suite" }).first()).toBeEnabled();
    });

    test("an incomplete login is not run signed out: the server's named error reaches the user and no run starts", async ({ page }) => {
        await generateSuiteAndUseAuthenticatedCode(page);
        await fillLoginSection(page, { "Login URL": "/login" });

        await page.getByRole("button", { name: "Run suite" }).first().click();

        await expect(page.getByText("Login config: \"usernameEnv\" is required.")).toBeVisible({ timeout: 30_000 });
    });

    test("the section has no field that takes a password, and says so", async ({ page }) => {
        await page.goto("/");
        await page.getByRole("button", { name: /Authenticated Run/i }).click();

        await expect(page.getByText("Never type a password here.")).toBeVisible();
        await expect(page.locator('input[id^="login-"]')).toHaveCount(8);
        await expect(page.locator('input[type="password"]')).toHaveCount(0);
    });
});
