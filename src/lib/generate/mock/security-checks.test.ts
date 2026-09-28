/**
 * TFP-116 (Phase 34, Decision 3): the template's security checks.
 * Runtime behaviour (a real XSS defect fails the payload test; headers and
 * cookie flags become findings) is proven live - see TEST_PLAN.md GEN-41.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/generate/mock/security-checks.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";
import type { ActionableElementDetail, ContentProfile, ContentProfilePage } from "./types.ts";

const { buildSecurityChecks, findPayloadForms, SCRIPT_PAYLOAD } = await import("./security-checks.ts");
const { mockGenerate } = await import("./index.ts");
const { normalizeContentRules, normalizeTestAuditMode } = await import("../normalize.ts");
const { findTypeErrors, findUnawaitedAssertions } = await import("../validate.ts");

function el(elementType: ActionableElementDetail["elementType"], fields: Partial<ActionableElementDetail["locator"]> & { text?: string; visible?: boolean }): ActionableElementDetail {
    return {
        text: fields.text ?? "",
        url: null,
        category: "form",
        elementType,
        containerLabel: "",
        expectedStatus: null,
        isVisible: fields.visible ?? true,
        ariaPressed: null,
        ariaSelected: null,
        ariaChecked: null,
        ariaExpanded: null,
        groupId: null,
        locator: { role: null, name: fields.name ?? "", label: fields.label ?? "", placeholder: "", id: fields.id ?? "", inputType: fields.inputType ?? "" },
    };
}

function page(path: string, elements: ActionableElementDetail[]): ContentProfilePage {
    return { path, url: `http://127.0.0.1:4410${path}`, title: path, metaDescription: "", headings: [], buttons: [], links: [], actionableElements: elements, visibleTextSnippets: [] };
}

// Mirrors the Phase 21 comparison fixture's introspection output.
const FIXTURE: ContentProfile = {
    scannedAt: "2026-09-28T00:00:00.000Z",
    baseUrl: "http://127.0.0.1:4410",
    pages: [
        page("/login", [
            el("form", {}),
            el("input", { label: "Email", name: "Email", id: "email", inputType: "email" }),
            el("input", { label: "Password", name: "Password", id: "password", inputType: "password" }),
            el("button", { text: "Sign in" }),
        ]),
        page("/notes", [el("form", {}), el("input", { label: "Note", name: "Note", id: "note", inputType: "text" }), el("button", { text: "Save note" })]),
    ],
};

function generate(baseUrl: string, contentProfile: ContentProfile | null) {
    return mockGenerate(baseUrl, "Check the site for security coverage.", ["security"] as never, contentProfile, normalizeContentRules(undefined), normalizeTestAuditMode(undefined));
}

function titles(code: string) {
    return (code.match(/test\('TFSC-\d+: [^']+'/g) ?? []).map((t) => t.replace(/^test\('TFSC-\d+: /, "").replace(/'$/, ""));
}

test("security suite on an http:// target: header and cookie checks plus a payload test per form, not just a note", () => {
    const code = generate("http://127.0.0.1:4410", FIXTURE);
    assert.deepEqual(titles(code), [
        "landing page security headers (recorded as findings)",
        "cookies set by the site carry protective flags (recorded as findings)",
        "script-shaped input is not executed: Email on /login",
        "script-shaped input is not executed: Note on /notes",
    ]);
    assert.match(code, /\/\/ This target is not HTTPS by default/);
    assert.doesNotMatch(code, /toBe\('https:'\)/, "never assert https on an http target");
});

test("security suite on an https:// target keeps the HTTPS check exactly as before", () => {
    const code = generate("https://example.org", null);
    assert.equal(titles(code)[0], "uses HTTPS for the requested public test target");
    assert.match(code, /expect\(new URL\(page\.url\(\)\)\.protocol\)\.toBe\('https:'\);/);
    assert.doesNotMatch(code, /This target is not HTTPS by default/);
});

test("security suite: the generated code compiles and awaits every web-first assertion", () => {
    for (const code of [generate("http://127.0.0.1:4410", FIXTURE), generate("https://example.org", FIXTURE)]) {
        assert.deepEqual(findTypeErrors(code), []);
        assert.deepEqual(findUnawaitedAssertions(code).filter((a) => a.returnsPromise), []);
    }
});

test("security suite: missing headers and cookie flags are findings, never failures", () => {
    const code = generate("http://127.0.0.1:4410", FIXTURE);
    for (const name of ["landing page security headers", "cookies set by the site carry protective flags"]) {
        const start = code.indexOf(name);
        const body = code.slice(start, code.indexOf("\n  });", start));
        assert.match(body, /annotations\.push\(\{ type: 'finding'/);
        // The only assertion allowed is that the page answered at all.
        const assertions = body.match(/expect\([^)]*\)/g) ?? [];
        assert.ok(assertions.every((a) => a === "expect(response, 'no response for /')"), `${name} must not fail on a finding: ${assertions.join(", ")}`);
    }
});

test("security suite: payload tests never type into passwords, and are skipped unless interactive (Decision 5)", () => {
    const code = generate("http://127.0.0.1:4410", FIXTURE);
    assert.doesNotMatch(code, /\[id="password"\]'\)\.fill\(payload\)/);
    const payloadTests = code.split("test('TFSC-").filter((t) => t.includes("script-shaped input is not executed"));
    assert.equal(payloadTests.length, 2);
    for (const body of payloadTests) {
        assert.match(body.slice(0, 400), /test\.skip\(process\.env\.TESTFORGE_INTERACTIVE !== '1'/);
        assert.match(body, /the page renders user input as HTML \(cross-site scripting\)/);
    }
});

test("security payload: survives being written into generated code intact", () => {
    const code = generate("http://127.0.0.1:4410", FIXTURE);
    const literal = code.match(/const payload = ('(?:[^'\\]|\\.)*');/)?.[1];
    assert.ok(literal, "payload literal not found");
    assert.equal(new Function(`return ${literal};`)(), SCRIPT_PAYLOAD);
});

test("findPayloadForms: text-like visible fields only, at most 3 forms", () => {
    const many: ContentProfile = {
        ...FIXTURE,
        pages: ["/a", "/b", "/c", "/d"].map((path) => page(path, [el("form", {}), el("textarea", { label: "Comment", id: `c${path.slice(1)}` }), el("button", { text: "Post" })])),
    };
    assert.equal(findPayloadForms(many).length, 3);
    const hiddenOnly: ContentProfile = { ...FIXTURE, pages: [page("/h", [el("form", {}), el("input", { label: "Code", id: "k", visible: false })])] };
    assert.deepEqual(findPayloadForms(hiddenOnly), []);
});

test("security suite: no inspection data or no form is said in a note", () => {
    assert.match(buildSecurityChecks("http://x.test", null).notes.join(" "), /no page inspection data/);
    assert.match(buildSecurityChecks("http://x.test", { ...FIXTURE, pages: [] }).notes.join(" "), /no form with a text field was found/);
});
