/**
 * TFP-092: normalizeLoginConfig / resolveCredentials / removeStaleAuthDirs.
 *
 * The login driver itself needs a real browser and a real login page, so it
 * is covered end to end in tests/regression/testforge.auth.spec.ts. What is
 * checked here are the properties that must hold before any browser opens:
 * a config is valid or the run does not start, credentials are only ever
 * referenced by environment variable name, and a missing value is a named
 * error.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/run/auth.test.ts
 */
import assert from "node:assert";
import { mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { normalizeLoginConfig, removeStaleAuthDirs, resolveCredentials, RunLoginError } from "./auth.ts";

const BASE = "https://app.example.com";

const valid = {
    loginUrl: "/login",
    usernameSelector: "#user",
    passwordSelector: "#pass",
    submitSelector: "button[type=submit]",
    usernameEnv: "APP_USER",
    passwordEnv: "APP_PASS",
    postLoginPath: "/dashboard/",
};

function rejects(input: unknown, kind: string, pattern: RegExp, baseUrl: string | null = BASE) {
    assert.throws(
        () => normalizeLoginConfig(input, baseUrl ?? undefined),
        (error: unknown) => error instanceof RunLoginError && error.kind === kind && pattern.test(error.message)
    );
}

test("no login block means no login", () => {
    assert.strictEqual(normalizeLoginConfig(undefined, BASE), null);
    assert.strictEqual(normalizeLoginConfig(null, BASE), null);
});

test("a complete config is resolved against the base URL and normalized", () => {
    assert.deepStrictEqual(normalizeLoginConfig(valid, BASE), {
        loginUrl: "https://app.example.com/login",
        usernameSelector: "#user",
        passwordSelector: "#pass",
        submitSelector: "button[type=submit]",
        usernameEnv: "APP_USER",
        passwordEnv: "APP_PASS",
        postLoginPath: "/dashboard",
        postLoginSelector: undefined,
    });
});

test("inline credentials are never accepted, whatever they are called", () => {
    for (const key of ["username", "password", "user", "pass", "credentials", "token", "secret"]) {
        rejects({ ...valid, [key]: "hunter2" }, "config-invalid", /unrecognized field/);
    }
});

test("a credential reference must be an environment variable NAME, so a pasted value is refused", () => {
    rejects({ ...valid, passwordEnv: "hunter2 has spaces!" }, "config-invalid", /NAME of an environment variable/);
    rejects({ ...valid, usernameEnv: "9starts-with-digit" }, "config-invalid", /NAME of an environment variable/);
});

test("a credential pasted where a name belongs is refused, so it is never looked up or echoed back", () => {
    // Mixed-case or lower-case values are the usual shape of a real password.
    for (const pasted of ["hunter2", "Hunter2Hunter2", "correct-horse-battery", "p@ssw0rd"]) {
        assert.throws(
            () => normalizeLoginConfig({ ...valid, passwordEnv: pasted }, BASE),
            (error: unknown) => error instanceof RunLoginError && error.kind === "config-invalid" && !error.message.includes(pasted)
        );
    }

    assert.ok(normalizeLoginConfig({ ...valid, passwordEnv: "MYAPP_TEST_PASS2" }, BASE));
});

test("every field a login needs is required", () => {
    for (const key of ["loginUrl", "usernameSelector", "passwordSelector", "submitSelector", "usernameEnv", "passwordEnv"]) {
        rejects({ ...valid, [key]: "" }, "config-invalid", new RegExp(`"${key}" is required`));
    }
});

test("a config with no signed-in signal is refused, since a failed login could not be told from a successful one", () => {
    rejects({ ...valid, postLoginPath: undefined }, "config-invalid", /postLoginPath.*postLoginSelector/);
    assert.ok(normalizeLoginConfig({ ...valid, postLoginPath: undefined, postLoginSelector: "#logout" }, BASE));
});

test("the login page must be on the site under test - credentials are typed into it", () => {
    rejects({ ...valid, loginUrl: "https://evil.example.net/login" }, "config-invalid", /same origin/);
    // With no base URL there is no site to compare against, so nothing is typed anywhere.
    rejects({ ...valid, loginUrl: "https://app.example.com/login" }, "config-invalid", /same origin/, null);
});

test("a login that is not an object is refused", () => {
    rejects("login please", "config-invalid", /must be an object/);
    rejects([valid], "config-invalid", /must be an object/);
});

test("credential values are read from the environment at run time, and a missing or empty one is a named error", () => {
    const config = normalizeLoginConfig(valid, BASE)!;

    assert.deepStrictEqual(resolveCredentials(config, { APP_USER: "u", APP_PASS: "p" }), { username: "u", password: "p" });
    for (const env of [{ APP_USER: "u" }, { APP_PASS: "p" }, { APP_USER: "u", APP_PASS: "" }]) {
        assert.throws(
            () => resolveCredentials(config, env),
            (error: unknown) => error instanceof RunLoginError && error.kind === "credential-missing" && /environment variable APP_(USER|PASS) is not set/.test(error.message)
        );
    }
});

test("a missing-credential error names the variable and never a value", () => {
    const config = normalizeLoginConfig(valid, BASE)!;

    assert.throws(
        () => resolveCredentials(config, { APP_USER: "super-secret-user" }),
        (error: unknown) => error instanceof RunLoginError && !error.message.includes("super-secret-user")
    );
});

test("stale per-run login state is swept, but a run still in progress keeps its own", async () => {
    const dir = mkdtempSync(join(tmpdir(), "testforge-auth-sweep-"));

    try {
        for (const name of ["auth-finished-run", "auth-live-run", "artifacts-unrelated"]) {
            mkdirSync(join(dir, name));
        }

        await removeStaleAuthDirs(dir, ["live-run"]);

        assert.deepStrictEqual(readdirSync(dir).sort(), ["artifacts-unrelated", "auth-live-run"]);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
