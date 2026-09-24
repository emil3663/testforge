/**
 * TFP-095: docs/AUTOMATED_ACCOUNT_SETUP.md must match what TFP-092/093
 * actually shipped - the acceptance criterion is "names all four exemption
 * categories and matches the real config field names, not a stale or assumed
 * shape". A doc that drifts is worse than none, so this fails when it does.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/run/setup-doc.test.ts
 */
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { LOGIN_CONFIG_FIELDS, normalizeLoginConfig } from "./auth.ts";

const root = process.cwd();
const doc = readFileSync(join(root, "docs", "AUTOMATED_ACCOUNT_SETUP.md"), "utf8");
const authSource = readFileSync(join(root, "src", "lib", "run", "auth.ts"), "utf8");

test("the doc names all four exemption categories", () => {
    for (const heading of ["### 1. Account lockout", "### 2. Rate limiting", "### 3. MFA interruption", "### 4. New-sign-in alerts"]) {
        assert.ok(doc.includes(heading), `missing section: ${heading}`);
    }
});

test("the doc documents every field a login block accepts, and no field that does not exist", () => {
    const tableFields = [...doc.matchAll(/^\| `([A-Za-z]+)` \|/gm)].map((match) => match[1]);

    assert.deepStrictEqual([...tableFields].sort(), [...LOGIN_CONFIG_FIELDS].sort());
});

test("the doc's JSON example is a login block TestForge accepts, using every field", () => {
    const example = /```json\n([\s\S]*?)\n```/.exec(doc);
    assert.ok(example, "the doc has no JSON example");

    const parsed = JSON.parse(example[1]);
    assert.deepStrictEqual(Object.keys(parsed).sort(), [...LOGIN_CONFIG_FIELDS].sort());
    assert.ok(normalizeLoginConfig(parsed, "https://app.example.com"), "the example must validate");
});

test("the doc's example environment variable names satisfy the name rule it states", () => {
    const parsed = JSON.parse(/```json\n([\s\S]*?)\n```/.exec(doc)![1]);
    const names = [...doc.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((match) => match[1]);

    assert.ok(names.includes(parsed.usernameEnv) && names.includes(parsed.passwordEnv), "the example names the variables the doc tells you to set");
});

test("every error message the doc quotes still exists in the code, so a reworded error fails here", () => {
    for (const fragment of [
        "is required.",
        "unrecognized field",
        "must be the NAME of an environment variable in upper case",
        "must be on the same origin",
        'Login config needs "postLoginPath" or "postLoginSelector"',
        "Login credentials are not available: environment variable",
        "Login failed: could not open the login page",
        "was not found on",
        "Check the login selectors.",
        "Login failed: after submitting the login form the page ended on",
        "Check the credentials (",
    ]) {
        assert.ok(authSource.includes(fragment), `auth.ts no longer says: ${fragment}`);
    }

    for (const fragment of [
        "is required.",
        "unrecognized field",
        "must be the NAME of an environment variable in upper case",
        "must be on the same origin",
        'Login config needs "postLoginPath" or "postLoginSelector"',
        "Login credentials are not available: environment variable",
        "Login failed: could not open the login page",
        "was not found on <url>. Check the login selectors.",
        "Login failed: after submitting the login form the page ended on",
        "Check the credentials (",
    ]) {
        assert.ok(doc.includes(fragment), `the doc no longer quotes: ${fragment}`);
    }
});

test("the doc's claims about parallelism match the executor", () => {
    const executor = readFileSync(join(root, "src", "lib", "run", "executor.ts"), "utf8");

    assert.match(executor, /auditMode === "deep" \? 2 : 4/);
    assert.ok(doc.includes("four workers") && doc.includes("two in deep mode"));
});

test("the doc never suggests putting a credential value in the config, and no example contains one", () => {
    assert.ok(!/"password"\s*:/.test(doc) && !/"username"\s*:/.test(doc));
    assert.ok(doc.includes("no `username` or\n`password` field") || doc.includes("no `username` or `password` field"));
});

test("the README and .env.example point at the doc", () => {
    for (const file of ["README.md", ".env.example"]) {
        assert.ok(readFileSync(join(root, file), "utf8").includes("AUTOMATED_ACCOUNT_SETUP.md"), `${file} does not point at the setup doc`);
    }
});
