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
import { LOGIN_FIELD_LABELS } from "./login-fields.ts";

const root = process.cwd();
const doc = readFileSync(join(root, "docs", "AUTOMATED_ACCOUNT_SETUP.md"), "utf8");
// The messages live in auth.ts and, for the shared name rule, login-fields.ts.
const authSource = ["auth.ts", "login-fields.ts"].map((file) => readFileSync(join(root, "src", "lib", "run", file), "utf8")).join("\n");

test("the doc names all four exemption categories", () => {
    for (const heading of ["### 1. Account lockout", "### 2. Rate limiting", "### 3. MFA interruption", "### 4. New-sign-in alerts"]) {
        assert.ok(doc.includes(heading), `missing section: ${heading}`);
    }
});

test("the doc documents every field a login block accepts, and no field that does not exist", () => {
    const tableFields = [...doc.matchAll(/^\| `([A-Za-z]+)` \|/gm)].map((match) => match[1]);

    assert.deepStrictEqual([...tableFields].sort(), [...LOGIN_CONFIG_FIELDS].sort());
});

test("the doc tells you what each field is called in the app, and the app's section really carries those labels", () => {
    const section = readFileSync(join(root, "src", "app", "_components", "LoginConfigSection.tsx"), "utf8");

    for (const field of LOGIN_CONFIG_FIELDS) {
        const row = new RegExp(`^\\| \`${field}\` \\| ${LOGIN_FIELD_LABELS[field]} \\|`, "m");
        assert.match(doc, row, `the doc's table does not give ${field}'s UI label "${LOGIN_FIELD_LABELS[field]}"`);
    }

    // The section is built from those labels, and is named as the doc says.
    assert.ok(section.includes("LOGIN_FIELD_LABELS"));
    assert.ok(section.includes('title="Authenticated Run"') && doc.includes("**Authenticated Run**"));
});

test("the section has no field that takes a credential value", () => {
    const section = readFileSync(join(root, "src", "app", "_components", "LoginConfigSection.tsx"), "utf8");

    assert.ok(!/type=["']password["']/.test(section), "no input in the login section may be type=password");
    assert.ok(section.includes('type="text"'));
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
    // TFP-157 (Phase 39 Decision 10): the worker count and request cap come from the host; the machine's limit is at
    // most 3 since Gate D's re-measurement ruling 1. Compared with the doc's line breaks collapsed, as it is rewrapped.
    const executor = readFileSync(join(root, "src", "lib", "run", "executor.ts"), "utf8");
    const limits = readFileSync(join(root, "src", "lib", "run", "host-limits.ts"), "utf8");
    const prose = doc.replace(/\s+/g, " ");

    assert.match(executor, /const workerCount = hostLimits\.workers;/);
    assert.match(limits, /MACHINE_MAX_WORKERS = 3;/);
    assert.match(limits, /CAPPED_HOST_MAX_WORKERS = 3;/);
    assert.match(limits, /CAPPED_HOST_REQUESTS_PER_SECOND = 5;/);
    assert.match(limits, /Math\.floor\(cores \/ 2\)/);
    assert.ok(prose.includes("half the machine's cores and at most three") && prose.includes("up to three workers sharing at most five requests per second"));
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
