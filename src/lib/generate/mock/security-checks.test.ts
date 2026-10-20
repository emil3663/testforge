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
    // In id order, the order they were written: Phase 39 (TFP-212) moves the checks that share a visit into the page's group.
    return (code.match(/test\('TFSC-\d+: [^']+'/g) ?? []).sort().map((t) => t.replace(/^test\('TFSC-\d+: /, "").replace(/'$/, ""));
}

// Phase 38 (TFP-147): the passive checks shared with Comprehensive, on every
// inspected page, then the run's one missing-page probe.
const PASSIVE = (path: string) => [
    `${path} sends its security headers and session cookies`,
    `${path} names no software version in its response headers`,
    `${path} keeps passwords off plain HTTP`,
    `${path} puts no password or session token in a URL`,
];
const PROBE = "a page that cannot exist shows no stack trace or server file path";

test("security suite on an http:// target: the shared passive checks on every inspected page, one missing-page probe, and a payload test per form with a free-text field", () => {
    const code = generate("http://127.0.0.1:4410", FIXTURE);
    // The sign-in form has only email and password fields: no free-text field
    // can carry the payload validly, so it gets no payload test.
    assert.deepEqual(titles(code), [...PASSIVE("/login"), ...PASSIVE("/notes"), PROBE, "script-shaped input is not executed: Note on /notes"]);
    assert.doesNotMatch(code, /landing page security headers|session cookies set by the site carry protective flags/, "Standard's own two checks are gone (Decision 4)");
    assert.equal((code.match(/function tfNotAPage\(/g) ?? []).length, 1, "the passive helpers, once, at the top of the suite");
    assert.deepEqual(titles(generate("http://127.0.0.1:4410", null)), [...PASSIVE("/"), PROBE], "without page data: / only");
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

test("security suite: missing headers, cookie flags and software versions are findings, never failures", () => {
    const code = generate("http://127.0.0.1:4410", FIXTURE);
    for (const path of ["/login", "/notes"]) {
        for (const name of [`${path} sends its security headers and session cookies`, `${path} names no software version in its response headers`]) {
            const start = code.indexOf(name);
            const body = code.slice(start, code.indexOf("\n    });", start));
            assert.match(body, /annotations\.push\(\{ type: 'finding'/);
            // The only assertion allowed is that the page answered at all.
            const assertions = body.match(/expect\([^)]*\)/g) ?? [];
            assert.ok(assertions.every((a) => a === `expect(response, 'no response for ${path}')`), `${name} must not fail on a finding: ${assertions.join(", ")}`);
        }
    }
});

test("security suite: payload tests never type into passwords, and are at the active gate, so never run (Phase 38 Decision 6)", () => {
    const code = generate("http://127.0.0.1:4410", FIXTURE);
    assert.doesNotMatch(code, /\[id="password"\]'\)\.fill\(payload\)/);
    const payloadTests = code.split("test('TFSC-").filter((t) => t.includes("script-shaped input is not executed"));
    assert.equal(payloadTests.length, 1);
    for (const body of payloadTests) {
        assert.match(body.slice(0, 400), /\{ annotation: \{ type: 'gate', description: 'active' \} \}, async \(\{ page \}\) => \{\n    test\.skip\(true, 'attack-shaped input: needs the ownership confirmation, not built yet'\);/);
        assert.doesNotMatch(body, /TESTFORGE_INTERACTIVE/, "not behind the interactive switch any more");
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

// --- the payload test must not pass having tested nothing -------------------

const CONTACT: ContentProfile = {
    ...FIXTURE,
    pages: [
        page("/contact", [
            el("form", {}),
            el("input", { label: "Email", name: "Email", id: "email", inputType: "email" }),
            el("input", { label: "Website", name: "Website", id: "site", inputType: "url" }),
            el("input", { label: "Phone", name: "Phone", id: "phone", inputType: "tel" }),
            el("input", { label: "Name", name: "Name", id: "name", inputType: "text" }),
            el("textarea", { label: "Message", name: "Message", id: "message" }),
            el("button", { text: "Send" }),
        ]),
    ],
};

test("payload goes only into free-text fields; email, url and tel get valid dummy values (so validation can't block the submit)", () => {
    const [form] = findPayloadForms(CONTACT);
    assert.deepEqual(form.fields.map((f) => f.locator.id), ["name", "message"]);
    assert.deepEqual(form.dummyFields.map((f) => f.locator.id), ["email", "site", "phone"]);

    const code = generate("http://127.0.0.1:4410", CONTACT);
    assert.match(code, /\[id="name"\]'\)\.fill\(payload\)/);
    assert.match(code, /\[id="message"\]'\)\.fill\(payload\)/);
    assert.doesNotMatch(code, /\[id="email"\]'\)\.fill\(payload\)/, "an email field must never get the payload");
    assert.match(code, /\[id="email"\]'\)\.fill\('testforge-check@example\.com'\)/);
    assert.match(code, /\[id="site"\]'\)\.fill\('https:\/\/example\.com\/'\)/);
    assert.match(code, /\[id="phone"\]'\)\.fill\('5550100'\)/);
    assert.deepEqual(findTypeErrors(code), []);
});

test("payload test skips, with the reason, when validation would block the submit or no request is sent", () => {
    const code = generate("http://127.0.0.1:4410", CONTACT);
    const body = code.slice(code.indexOf("script-shaped input is not executed"));
    const invalidSkip = body.indexOf("test.skip(invalid.length > 0, 'the form on /contact would not submit (browser validation rejects: '");
    const click = body.indexOf(".click();");
    const sentSkip = body.indexOf("test.skip(!(await submitted), 'submitting the form on /contact sent no request");
    const verdict = body.indexOf("the page renders user input as HTML");
    assert.ok(invalidSkip > 0 && invalidSkip < click, "check validity before submitting");
    assert.ok(click > 0 && sentSkip > click, "check a request was sent after submitting");
    assert.ok(sentSkip < verdict, "only judge execution once the payload really reached the site");
});
