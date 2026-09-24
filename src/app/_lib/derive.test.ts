/**
 * TFP-096: parseNamedFlowLines - the "Named flows" input's parser.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/app/_lib/derive.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";
import { normalizeNamedFlows } from "../../lib/introspect/journeys.ts";
import { parseNamedFlowLines } from "./derive.ts";

test("one flow per line, label: /entry -> /exit", () => {
    assert.deepStrictEqual(parseNamedFlowLines("checkout: /cart -> /confirmation").flows, [
        { label: "checkout", entryPath: "/cart", exitPath: "/confirmation" },
    ]);
});

test("accepts => and the arrow character, tolerates spacing, and adds a missing leading slash", () => {
    const { flows, invalidLines } = parseNamedFlowLines("a:/x=>/y\nb :  z   \u2192   w  \n  c: /p ->/q");

    assert.deepStrictEqual(flows, [
        { label: "a", entryPath: "/x", exitPath: "/y" },
        { label: "b", entryPath: "/z", exitPath: "/w" },
        { label: "c", entryPath: "/p", exitPath: "/q" },
    ]);
    assert.deepStrictEqual(invalidLines, []);
});

test("a label may contain a comma (lists are split on newlines only)", () => {
    assert.deepStrictEqual(parseNamedFlowLines("sign up, then verify: /signup -> /welcome").flows[0].label, "sign up, then verify");
});

test("a line that is not understood is reported, not silently dropped; blank lines are ignored", () => {
    const { flows, invalidLines } = parseNamedFlowLines("ok: /a -> /b\n\nno arrow here\n: /a -> /b\nmissing: /a ->\n");

    assert.strictEqual(flows.length, 1);
    assert.deepStrictEqual(invalidLines, ["no arrow here", ": /a -> /b", "missing: /a ->"]);
});

test("empty input is no flows and no errors", () => {
    assert.deepStrictEqual(parseNamedFlowLines(""), { flows: [], invalidLines: [] });
});

// The UI parses first and the server re-validates: a parsed flow must survive
// the server's normalization unchanged, or the UI would show one thing and
// send another.
test("a parsed flow is unchanged by the server-side normalizeNamedFlows", () => {
    const { flows } = parseNamedFlowLines("login: /login -> /secure\ncheckout: cart -> confirmation");

    assert.deepStrictEqual(normalizeNamedFlows(flows), flows);
});

// TFP-097: the login block the "Authenticated Run" section builds.
import { buildLoginBlock, EMPTY_LOGIN_INPUTS } from "./derive.ts";
import { normalizeLoginConfig } from "../../lib/run/auth.ts";
import { LOGIN_CONFIG_FIELDS, LOGIN_FIELD_LABELS } from "../../lib/run/login-fields.ts";

const completeInputs = {
    ...EMPTY_LOGIN_INPUTS,
    loginUrl: " /login ",
    usernameSelector: "#username",
    passwordSelector: "#password",
    submitSelector: "button[type=submit]",
    usernameEnv: "MYAPP_TEST_USER",
    passwordEnv: "MYAPP_TEST_PASS",
    postLoginPath: "/dashboard",
};

test("nothing typed means no login, and no problem", () => {
    assert.deepStrictEqual(buildLoginBlock(EMPTY_LOGIN_INPUTS), { login: null, problem: "" });
    assert.deepStrictEqual(buildLoginBlock({ ...EMPTY_LOGIN_INPUTS, loginUrl: "   " }), { login: null, problem: "" });
});

test("what was typed becomes the login block, trimmed, with blank optional fields left out", () => {
    const { login, problem } = buildLoginBlock(completeInputs);

    assert.strictEqual(problem, "");
    assert.deepStrictEqual(login, {
        loginUrl: "/login",
        usernameSelector: "#username",
        passwordSelector: "#password",
        submitSelector: "button[type=submit]",
        usernameEnv: "MYAPP_TEST_USER",
        passwordEnv: "MYAPP_TEST_PASS",
        postLoginPath: "/dashboard",
    });
});

test("the block the UI builds is exactly what the server accepts - the same normalization the API request gets", () => {
    const { login } = buildLoginBlock(completeInputs);

    assert.ok(normalizeLoginConfig(login, "https://app.example.com"));
    assert.deepStrictEqual(Object.keys(login!).every((key) => (LOGIN_CONFIG_FIELDS as readonly string[]).includes(key)), true);
});

test("a credential pasted where a variable name belongs blocks the run and never becomes part of a request", () => {
    for (const pasted of ["hunter2", "Hunter2Hunter2", "correct-horse-battery", "p@ssw0rd"]) {
        for (const field of ["usernameEnv", "passwordEnv"] as const) {
            const { login, problem } = buildLoginBlock({ ...completeInputs, [field]: pasted });

            assert.strictEqual(login, null, `${field}=${pasted} must not produce a request`);
            assert.ok(problem.includes(LOGIN_FIELD_LABELS[field]) && problem.includes("upper case"));
            assert.ok(!problem.includes(pasted), "the problem message must not echo the pasted value");
        }
    }
});

test("an incomplete block is still sent, so the server's named error reaches the user instead of a silent signed-out run", () => {
    const { login, problem } = buildLoginBlock({ ...EMPTY_LOGIN_INPUTS, loginUrl: "/login" });

    assert.strictEqual(problem, "");
    assert.deepStrictEqual(login, { loginUrl: "/login" });
});

test("every field a login block accepts has a UI label, and the section has no field for a credential value", () => {
    assert.deepStrictEqual(Object.keys(LOGIN_FIELD_LABELS).sort(), [...LOGIN_CONFIG_FIELDS].sort());
    assert.ok(!Object.values(LOGIN_FIELD_LABELS).some((label) => /^(username|password)$/i.test(label)));
});
