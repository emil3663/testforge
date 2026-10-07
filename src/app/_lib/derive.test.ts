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

// Phase 40 Decision 8 (TFP-174): the URL field takes one URL, as before, or a list of pages on one site.
test("parseUrlField: one URL behaves as today; a list keeps each page's path and hash route on the first URL's origin; another origin is rejected, naming it", async () => {
    const { parseUrlField } = await import("./derive.ts");
    assert.deepEqual(parseUrlField("https://with-bugs.practicesoftwaretesting.com/#/"), { kind: "single", value: "https://with-bugs.practicesoftwaretesting.com/#/" });
    assert.deepEqual(parseUrlField("  localhost:3000/notes \n\n"), { kind: "single", value: "  localhost:3000/notes \n\n" }, "one line with blank lines is still one URL");
    assert.deepEqual(parseUrlField("https://site.example/#/contact\r\nhttps://site.example/product/1?x=2\n\nhttps://site.example/#/contact\nsite.example/a"), {
        kind: "invalid",
        message: "http://site.example/a is on another site than the first URL (https://site.example). Every page in the list must be on the same origin.",
    }, "a line without a protocol reads as http, so it is another origin than https");
    assert.deepEqual(parseUrlField("https://site.example/#/contact\r\nhttps://site.example/product/1?x=2\n\nhttps://site.example/#/contact\nhttps://site.example/"), {
        kind: "list",
        site: "https://site.example",
        pages: ["/#/contact", "/product/1?x=2", "/"],
        urls: ["https://site.example/#/contact", "https://site.example/product/1?x=2", "https://site.example/"],
    });
    assert.deepEqual(parseUrlField("https://site.example/a\nhttps://other.example/b"), { kind: "invalid", message: "https://other.example/b is on another site than the first URL (https://site.example). Every page in the list must be on the same origin." });
    assert.deepEqual(parseUrlField("https://site.example/a\njavascript:alert(1)"), { kind: "invalid", message: "javascript:alert(1) is not an http or https URL." });
    assert.deepEqual(parseUrlField("https://site.example/a\nhttp://[bad"), { kind: "invalid", message: "\"http://[bad\" is not a valid URL. Enter one page URL per line." });
});
