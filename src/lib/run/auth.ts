import { chromium } from "@playwright/test";
import { mkdir, readdir, readFile, rm } from "fs/promises";
import { join } from "path";
import { RUN_CONTEXT_OPTIONS } from "./browser-context";
import { secretsFromStorageState } from "./redact";

// Phase 20 (TFP-092): config-driven login, once per run.
//
// The site owner supplies the login URL, the selectors, and the NAMES of the
// environment variables holding the credentials (Decision 3: referenced by
// name, never inlined). TestForge drives that login once, in Chromium, before
// the run's tests start, and every test in the run reuses the resulting
// storageState (Decision 2). The state file lives in a per-run directory that
// is deleted when the run's process ends (Decision 5: single-run only) and is
// never inside the run's evidence directory, so persistRunJob can't move it
// anywhere that outlives the run.

// The base playwright.config.ts reads this to set use.storageState. The
// executor always sets it (to the state file's path, or deletes it), never
// inherits it, so an ambient value can't authenticate a run that didn't ask.
export const STORAGE_STATE_ENV_VAR = "TESTFORGE_STORAGE_STATE";

const AUTH_DIR_PREFIX = "auth-";
// Upper-case letters, digits and underscores: the convention every variable in
// this repo's .env files already follows. Stricter than the OS allows on
// purpose (TFP-093): a credential pasted where a NAME belongs - the exact
// mistake this field invites - is usually mixed-case or has punctuation, so
// it is refused before it is ever looked up, and never echoed back in a
// "variable X is not set" message.
const ENV_NAME_PATTERN = /^[A-Z_][A-Z0-9_]*$/;
const NAVIGATION_TIMEOUT_MS = 30_000;
const STEP_TIMEOUT_MS = 10_000;
const SUCCESS_TIMEOUT_MS = 15_000;

// References only: selectors, URLs, and the names of environment variables.
// Never a credential value.
export interface LoginConfig {
    loginUrl: string;
    usernameSelector: string;
    passwordSelector: string;
    submitSelector: string;
    usernameEnv: string;
    passwordEnv: string;
    // At least one is required: without a signed-in signal a failed login
    // could not be told from a successful one, and every test would silently
    // run unauthenticated - exactly what this phase must not do.
    postLoginPath?: string;
    postLoginSelector?: string;
}

export type RunLoginErrorKind = "config-invalid" | "credential-missing" | "login-unreachable" | "login-failed";

// A named, run-level failure: the run does not start.
export class RunLoginError extends Error {
    kind: RunLoginErrorKind;

    constructor(kind: RunLoginErrorKind, message: string) {
        super(message);
        this.name = "RunLoginError";
        this.kind = kind;
    }
}

// The only fields a login block may carry. docs/AUTOMATED_ACCOUNT_SETUP.md
// documents exactly these, and setup-doc.test.ts fails if the two drift.
export const LOGIN_CONFIG_FIELDS = [
    "loginUrl",
    "usernameSelector",
    "passwordSelector",
    "submitSelector",
    "usernameEnv",
    "passwordEnv",
    "postLoginPath",
    "postLoginSelector",
] as const;

const ALLOWED_KEYS = new Set<string>(LOGIN_CONFIG_FIELDS);

function requiredString(config: Record<string, unknown>, key: string) {
    const value = config[key];

    if (typeof value !== "string" || !value.trim()) {
        throw new RunLoginError("config-invalid", `Login config: "${key}" is required.`);
    }

    return value.trim();
}

function normalizePath(pathname: string) {
    return pathname.replace(/\/$/, "") || "/";
}

// Validates the login block of a run request. Returns null when no login was
// asked for. Anything else that isn't a complete, valid config is an error,
// never a quiet fall back to an unauthenticated run.
export function normalizeLoginConfig(input: unknown, baseUrl: string | undefined): LoginConfig | null {
    if (input === undefined || input === null) {
        return null;
    }

    if (typeof input !== "object" || Array.isArray(input)) {
        throw new RunLoginError("config-invalid", "Login config must be an object.");
    }

    const config = input as Record<string, unknown>;

    for (const key of Object.keys(config)) {
        if (!ALLOWED_KEYS.has(key)) {
            throw new RunLoginError(
                "config-invalid",
                `Login config has an unrecognized field "${key}". Credentials must be referenced by environment variable name (usernameEnv, passwordEnv) and are never accepted inline.`
            );
        }
    }

    const usernameEnv = requiredString(config, "usernameEnv");
    const passwordEnv = requiredString(config, "passwordEnv");

    for (const [key, name] of [["usernameEnv", usernameEnv], ["passwordEnv", passwordEnv]] as const) {
        if (!ENV_NAME_PATTERN.test(name)) {
            throw new RunLoginError(
                "config-invalid",
                `Login config: "${key}" must be the NAME of an environment variable in upper case (letters, digits, underscore - e.g. MYAPP_TEST_PASS), not a credential value.`
            );
        }
    }

    const rawLoginUrl = requiredString(config, "loginUrl");
    let loginUrl: URL;
    try {
        loginUrl = new URL(rawLoginUrl, baseUrl);
    } catch {
        throw new RunLoginError("config-invalid", 'Login config: "loginUrl" must be a full URL, or a path when a base URL is given.');
    }

    // The credentials are typed into the login page, so it must be the site
    // under test - never a different origin the request happened to name.
    if (!baseUrl || loginUrl.origin !== new URL(baseUrl).origin) {
        throw new RunLoginError("config-invalid", 'Login config: "loginUrl" must be on the same origin as the run\'s base URL.');
    }

    const postLoginPath = typeof config.postLoginPath === "string" && config.postLoginPath.trim()
        ? normalizePath(new URL(config.postLoginPath.trim(), loginUrl).pathname)
        : undefined;
    const postLoginSelector = typeof config.postLoginSelector === "string" && config.postLoginSelector.trim()
        ? config.postLoginSelector.trim()
        : undefined;

    if (!postLoginPath && !postLoginSelector) {
        throw new RunLoginError(
            "config-invalid",
            'Login config needs "postLoginPath" or "postLoginSelector" - something only true once signed in - so a failed login can be told from a successful one.'
        );
    }

    return {
        loginUrl: loginUrl.toString(),
        usernameSelector: requiredString(config, "usernameSelector"),
        passwordSelector: requiredString(config, "passwordSelector"),
        submitSelector: requiredString(config, "submitSelector"),
        usernameEnv,
        passwordEnv,
        postLoginPath,
        postLoginSelector,
    };
}

export interface ResolvedCredentials {
    username: string;
    password: string;
}

// Reads the credential values from the environment at run time.
export function resolveCredentials(config: LoginConfig, env: Record<string, string | undefined> = process.env): ResolvedCredentials {
    for (const name of [config.usernameEnv, config.passwordEnv]) {
        if (!env[name]) {
            throw new RunLoginError(
                "credential-missing",
                `Login credentials are not available: environment variable ${name} is not set (or is empty) for the TestForge server.`
            );
        }
    }

    return { username: env[config.usernameEnv] as string, password: env[config.passwordEnv] as string };
}

// Defense in depth: nothing built here interpolates a credential, but an
// error message that came from Playwright is scrubbed of them regardless.
function redact(message: string, credentials: ResolvedCredentials) {
    return [credentials.username, credentials.password]
        .filter((secret) => secret.length > 0)
        .reduce((text, secret) => text.split(secret).join("[redacted]"), message);
}

export function authDirFor(runsDir: string, runId: string) {
    return join(runsDir, `${AUTH_DIR_PREFIX}${runId}`);
}

// Drives the configured login once and writes the resulting storageState to
// stateFile. Throws RunLoginError on any failure; the caller must not start
// the run.
export async function performLogin(config: LoginConfig, credentials: ResolvedCredentials, stateFile: string) {
    const browser = await chromium.launch({ headless: true });

    try {
        // A bare context: no tracing, video, or screenshots are ever started
        // for the login, so nothing of it is captured (TFP-094).
        const context = await browser.newContext({ ...RUN_CONTEXT_OPTIONS });
        const page = await context.newPage();

        try {
            await page.goto(config.loginUrl, { waitUntil: "domcontentloaded", timeout: NAVIGATION_TIMEOUT_MS });
        } catch (error) {
            throw new RunLoginError(
                "login-unreachable",
                redact(`Login failed: could not open the login page ${config.loginUrl}: ${error instanceof Error ? error.message.split("\n")[0] : "unknown error"}`, credentials)
            );
        }

        const control = async (selector: string, what: string) => {
            const locator = page.locator(selector).first();

            try {
                await locator.waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
            } catch {
                throw new RunLoginError(
                    "login-failed",
                    `Login failed: the ${what} (selector "${selector}") was not found on ${config.loginUrl}. Check the login selectors.`
                );
            }

            return locator;
        };

        const usernameField = await control(config.usernameSelector, "username field");
        const passwordField = await control(config.passwordSelector, "password field");
        const submitButton = await control(config.submitSelector, "submit button");

        await usernameField.fill(credentials.username);
        await passwordField.fill(credentials.password);
        await submitButton.click();

        try {
            if (config.postLoginSelector) {
                await page.locator(config.postLoginSelector).first().waitFor({ state: "visible", timeout: SUCCESS_TIMEOUT_MS });
            }

            if (config.postLoginPath) {
                await page.waitForURL((url) => normalizePath(url.pathname) === config.postLoginPath, { timeout: SUCCESS_TIMEOUT_MS });
            }
        } catch {
            const endedOn = normalizePath(new URL(page.url()).pathname);
            const expected = [
                config.postLoginPath ? `the page ${config.postLoginPath}` : "",
                config.postLoginSelector ? `the element "${config.postLoginSelector}"` : "",
            ].filter(Boolean).join(" and ");

            throw new RunLoginError(
                "login-failed",
                `Login failed: after submitting the login form the page ended on ${endedOn}, and ${expected} never appeared. Check the credentials (${config.usernameEnv} / ${config.passwordEnv}) and the post-login settings. The run was not started, so no test ran unauthenticated.`
            );
        }

        await context.storageState({ path: stateFile });
    } finally {
        await browser.close().catch(() => { });
    }
}

// Runs the whole preparation for a run's login: resolve, drive, write state.
// On failure the per-run directory is removed before the error propagates.
export async function prepareRunLogin(config: LoginConfig, runsDir: string, runId: string) {
    const dir = authDirFor(runsDir, runId);
    const stateFile = join(dir, "state.json");
    const credentials = resolveCredentials(config);

    await mkdir(dir, { recursive: true });

    try {
        await performLogin(config, credentials, stateFile);
    } catch (error) {
        await removeAuthState(dir);
        throw error;
    }

    // Every value that must never appear in anything the run hands back
    // (TFP-094): the credentials themselves and everything inside the
    // session the login produced. Held in memory for this run only.
    const state = JSON.parse(await readFile(stateFile, "utf8").catch(() => "{}"));
    const secrets = [credentials.username, credentials.password, ...secretsFromStorageState(state)];

    return { dir, stateFile, secrets };
}

export async function removeAuthState(dir: string | null | undefined) {
    if (dir) {
        await rm(dir, { recursive: true, force: true }).catch(() => { });
    }
}

// A process that died mid-run leaves its per-run directory behind. Sweep any
// that don't belong to a run still in progress, so a session token never
// outlives its run even across a crash (Decision 5).
export async function removeStaleAuthDirs(runsDir: string, activeRunIds: Iterable<string>) {
    const active = new Set(activeRunIds);
    const entries = await readdir(runsDir).catch(() => [] as string[]);

    await Promise.all(
        entries
            .filter((entry) => entry.startsWith(AUTH_DIR_PREFIX) && !active.has(entry.slice(AUTH_DIR_PREFIX.length)))
            .map((entry) => removeAuthState(join(runsDir, entry)))
    );
}
