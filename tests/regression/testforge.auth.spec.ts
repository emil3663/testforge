import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Server } from "node:http";
import { devices, expect, type APIRequestContext, test } from "@playwright/test";
import { buildReportHtmlDocument } from "../../src/lib/report/html";
import { readZipEntries } from "../../src/lib/run/redact";
import {
    AUTH_FIXTURE_PASS,
    AUTH_FIXTURE_PASS_ENV,
    AUTH_FIXTURE_SESSION,
    AUTH_FIXTURE_USER,
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

    test("a credential pasted where a variable name belongs is refused before it is looked up, and never echoed back", async ({ request }) => {
        for (const pasted of ["hunter2", "Hunter2Hunter2", AUTH_FIXTURE_PASS]) {
            const response = await startRun(request, { ...validLogin, passwordEnv: pasted });
            const text = await response.text();

            expect(response.status()).toBe(400);
            expect(text).toContain("must be the NAME of an environment variable");
            expect(text).not.toContain(pasted);
        }
    });
});

// Phase 20 (TFP-094): a run that logged in must not hand back its credentials
// or its session. Not "should be fine because Playwright does not capture
// that": found by probe that a real authenticated run's trace.zip held the
// whole storageState. So this test ACTIVELY tries to leak - the suite prints
// the session cookie, types the credentials into fields (which the trace
// records as action values), and fails with an assertion message that
// contains the session - then searches everything the run hands back.
const leakAttemptCode = `import { test, expect } from '@playwright/test';

test.use({ baseURL: '${AUTH_FIXTURE_URL}' });

test('TFFU-001: deliberately tries to leak the session and the credentials', async ({ page, context }) => {
  await page.goto('/secure');
  await expect(page.locator('#logout')).toBeVisible();
  const cookies = await context.cookies();
  const session = cookies.find((cookie) => cookie.name === 'fixture_session')!.value;
  console.log('LEAK-ATTEMPT stdout session=' + session);
  // TFP-202: a run's tests get only the environment Playwright needs, so the credentials TestForge was given as
  // environment variables can't be read here. They are typed as literals, so their redaction is still tested.
  expect(process.env.${AUTH_FIXTURE_USER_ENV}, 'the username is not in the run environment').toBeUndefined();
  expect(process.env.${AUTH_FIXTURE_PASS_ENV}, 'the password is not in the run environment').toBeUndefined();
  await page.goto('/login');
  await page.fill('#username', ${JSON.stringify(AUTH_FIXTURE_USER)});
  await page.fill('#password', ${JSON.stringify(AUTH_FIXTURE_PASS)});
  expect(session, 'LEAK-ATTEMPT assertion session=' + session).toBe('not-the-session');
});
`;

async function entriesOf(zipFile: string) {
    return readZipEntries(await readFile(zipFile));
}

const BINARY_FILE = /\.(png|webm)$/;

test.describe("Nothing leaks from an authenticated run (TFP-094)", () => {
    test("a run that deliberately tries to leak its credentials and session hands back none of them", async ({ request }) => {
        const started = await request.post("/api/run", {
            data: { code: leakAttemptCode, selectedPractices: ["functional"], auditMode: "fast", baseUrl: AUTH_FIXTURE_URL, description: "leak attempt", login: validLogin },
        });
        expect(started.status()).toBe(202);
        const { runId } = await started.json();

        let snapshot: { result?: { report?: Record<string, unknown>; output: string } } = {};
        await expect.poll(async () => {
            snapshot = await (await request.get(`/api/run?runId=${runId}`)).json();
            return Boolean(snapshot.result?.report);
        }, { timeout: 120_000, intervals: [2_000] }).toBe(true);

        // The attempt really happened: the test failed on the assertion that echoes the session.
        const resultText = JSON.stringify(snapshot.result);
        expect(resultText).toContain("LEAK-ATTEMPT assertion session=");
        expect(resultText).toContain("Failed");
        // TFP-202: it got that far, so reading the credentials from the run's environment gave undefined.
        expect(resultText).not.toContain("is not in the run environment");

        const secrets = [AUTH_FIXTURE_PASS, AUTH_FIXTURE_USER, AUTH_FIXTURE_SESSION];
        const leaks: string[] = [];
        const scan = (label: string, text: string) => {
            for (const secret of secrets) {
                if (text.includes(secret) || text.includes(encodeURIComponent(secret)) || text.includes(JSON.stringify(secret).slice(1, -1))) {
                    leaks.push(`${label} contains ${secret === AUTH_FIXTURE_SESSION ? "the session token" : secret === AUTH_FIXTURE_PASS ? "the password" : "the username"}`);
                }
            }
        };

        // 1. The result the API returns (report, console output, everything).
        scan("API result", resultText);

        // 2. The HTML report - what a user downloads - built from that result.
        scan("HTML report", buildReportHtmlDocument(snapshot.result!.report as never, runId));

        // 3. Everything persisted for the run, including the inside of every zip.
        const runDir = join(process.cwd(), "runs", runId);
        const files: string[] = [];
        const walkDir = async (dir: string) => {
            for (const entry of await readdir(dir, { withFileTypes: true })) {
                const path = join(dir, entry.name);
                if (entry.isDirectory()) {
                    await walkDir(path);
                } else {
                    files.push(path);
                }
            }
        };
        await walkDir(runDir);

        const traces = files.filter((file) => file.endsWith("trace.zip"));
        expect(traces).toHaveLength(1);
        expect(files.some((file) => file.endsWith(".png"))).toBe(true);

        for (const file of files) {
            const label = file.slice(runDir.length + 1);
            // TFP-202: the run's own copy of the suite as it was sent, which now holds the credentials as the
            // literals this test wrote in it. Exactly what the caller sent, nothing TestForge captured.
            if (label === "suite.spec.ts") {
                expect(await readFile(file, "utf8")).toBe(leakAttemptCode);
                continue;
            }
            if (file.endsWith(".zip")) {
                for (const entry of await entriesOf(file)) {
                    scan(`${label}!${entry.name}`, entry.data.toString("utf8"));
                }
            } else if (!BINARY_FILE.test(file)) {
                scan(label, await readFile(file, "utf8"));
            }
        }

        // 4. What a user actually downloads: each artifact through the API.
        const report = snapshot.result!.report as { defects: { issues: { artifacts: { artifactId: string; fileName: string }[] }[] } };
        const downloadable = report.defects.issues.flatMap((issue) => issue.artifacts);
        expect(downloadable.some((artifact) => artifact.fileName.endsWith("trace.zip"))).toBe(true);
        for (const artifact of downloadable) {
            const response = await request.get(`/api/run?runId=${runId}&artifactId=${artifact.artifactId}`);
            expect(response.ok()).toBe(true);
            const body = await response.body();

            if (artifact.fileName.endsWith(".zip")) {
                const temp = join(runDir, `download-${artifact.artifactId}.zip`);
                await writeFile(temp, body);
                for (const entry of await entriesOf(temp)) {
                    scan(`download ${artifact.fileName}!${entry.name}`, entry.data.toString("utf8"));
                }
            } else if (!BINARY_FILE.test(artifact.fileName)) {
                scan(`download ${artifact.fileName}`, body.toString("utf8"));
            }
        }

        expect(leaks).toEqual([]);

        // The trace was scrubbed, not deleted: it is still a valid, useful
        // trace, and it says where it was redacted.
        const traceText = (await entriesOf(traces[0])).map((entry) => entry.data.toString("utf8")).join("\n");
        expect(traceText).toContain("[redacted]");
        expect(traceText).toContain("context-options");
        expect(traceText).toContain("LEAK-ATTEMPT assertion session=");
        expect(snapshot.result!.output).toContain("redacted this run's login credentials and session from");
    });
});

// Phase 20 (TFP-093): the login config references credentials by the NAME of
// an environment variable and never carries a value. So the literal values
// must appear nowhere TestForge writes or returns that is not scrubbed by
// design: the generated suite, the run config it persists, and the API's own
// responses. (RUN-18 covers what the run *captures*; this covers what
// TestForge itself produces, which no scrubbing pass should be needed for.)
test.describe("Credentials are referenced by name, never inlined (TFP-093)", () => {
    test("the literal credentials appear in no generated code, persisted run config, or API response", async ({ request }) => {
        const values = [AUTH_FIXTURE_PASS, AUTH_FIXTURE_USER];
        const leaks: string[] = [];
        const grep = (label: string, text: string) => {
            for (const value of values) {
                if (text.includes(value)) {
                    leaks.push(`${label} contains ${value === AUTH_FIXTURE_PASS ? "the password" : "the username"}`);
                }
            }
        };

        // Generated output: introspect the fixture's login page, generate a suite for it.
        const introspected = await request.post("/api/introspect", { data: { baseUrl: AUTH_FIXTURE_URL, paths: ["/login"] } });
        grep("introspect response", await introspected.text());
        const generated = await request.post("/api/generate", {
            data: {
                baseUrl: AUTH_FIXTURE_URL,
                description: "Create functional coverage for the sign-in form.",
                selectedPractices: ["functional"],
                contentRules: { paths: ["/login"], requiredHeadings: [], requiredText: [], forbiddenText: [] },
                contentProfile: JSON.parse(await introspected.text()),
            },
        });
        const generatedCode = (await generated.json()).code as string;
        expect(generatedCode.length).toBeGreaterThan(200);
        grep("generated suite", generatedCode);

        // A run with a login: the API's start response, its final status, and what is persisted for it.
        const started = await request.post("/api/run", {
            data: { code: suiteCode, selectedPractices: ["functional"], auditMode: "fast", baseUrl: AUTH_FIXTURE_URL, description: "reference by name", login: validLogin },
        });
        expect(started.status()).toBe(202);
        grep("run start response", await started.text());
        const { runId } = JSON.parse(await started.text());

        let finalText = "";
        await expect.poll(async () => {
            finalText = await (await request.get(`/api/run?runId=${runId}`)).text();
            return finalText.includes('"report"');
        }, { timeout: 120_000, intervals: [2_000] }).toBe(true);
        grep("run status response", finalText);

        const runDir = join(process.cwd(), "runs", runId);
        const record = JSON.parse(await readFile(join(runDir, "run.json"), "utf8"));
        grep("run.json", JSON.stringify(record));
        grep("persisted suite.spec.ts", await readFile(join(runDir, "suite.spec.ts"), "utf8"));

        // The run config that IS persisted names the variables, and only them.
        expect(record.login).toEqual({
            loginUrl: `${AUTH_FIXTURE_URL}/login`,
            usernameSelector: "#username",
            passwordSelector: "#password",
            submitSelector: "#submit",
            usernameEnv: AUTH_FIXTURE_USER_ENV,
            passwordEnv: AUTH_FIXTURE_PASS_ENV,
            postLoginPath: "/secure",
            postLoginSelector: "#logout",
        });

        expect(leaks).toEqual([]);
    });
});
