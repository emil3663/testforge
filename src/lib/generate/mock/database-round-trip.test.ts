/**
 * TFP-117 (Phase 34): the template's database persistence round trip.
 *
 * The profile below mirrors real introspection output of the Phase 21
 * comparison fixture (scripts/comparison-fixture.mjs): a sign-in form and a
 * notes form, each listed as a `form` element followed by its fields and
 * button.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/generate/mock/database-round-trip.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";
import type { ActionableElementDetail, ContentProfile, ContentProfilePage } from "./types.ts";

const { buildDatabaseRoundTripTests, findPersistenceForms } = await import("./database-round-trip.ts");
const { mockGenerate } = await import("./index.ts");
const { normalizeContentRules, normalizeTestAuditMode } = await import("../normalize.ts");
const { findTypeErrors, findUnawaitedAssertions } = await import("../validate.ts");

// Phase 36 (TFP-125): tests that need a real browser skip, with the reason,
// where Playwright's Chromium is not installed.
const { chromiumSkipReason } = await import("../../../test-support/chromium.ts");
const needsChromium = await chromiumSkipReason();

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
        locator: {
            role: fields.role ?? (elementType === "button" ? "button" : elementType === "form" ? "form" : "textbox"),
            name: fields.name ?? "",
            label: fields.label ?? "",
            placeholder: fields.placeholder ?? "",
            id: fields.id ?? "",
            inputType: fields.inputType ?? "",
        },
    };
}

function page(path: string, actionableElements: ActionableElementDetail[]): ContentProfilePage {
    return { path, url: `http://127.0.0.1:4410${path}`, title: path, metaDescription: "", headings: [], buttons: [], links: [], actionableElements, visibleTextSnippets: [] };
}

function profile(...pages: ContentProfilePage[]): ContentProfile {
    return { scannedAt: "2026-09-28T00:00:00.000Z", baseUrl: "http://127.0.0.1:4410", pages };
}

const SIGN_IN = page("/login", [
    el("form", { text: "Email Password Sign in" }),
    el("input", { name: "Email", label: "Email", id: "email", inputType: "email" }),
    el("input", { name: "Password", label: "Password", id: "password", inputType: "password" }),
    el("button", { text: "Sign in" }),
]);
const NOTES = page("/notes", [
    el("form", { text: "Note Save note" }),
    el("input", { name: "Note", label: "Note", id: "note", inputType: "text" }),
    el("button", { text: "Save note" }),
]);
const FIXTURE = profile(page("/", []), SIGN_IN, NOTES);

function generate(description: string, practices: string[], contentProfile: ContentProfile | null) {
    return mockGenerate("http://127.0.0.1:4410", description, practices as never, contentProfile, normalizeContentRules(undefined), normalizeTestAuditMode(undefined));
}

test("findPersistenceForms: picks the notes form and leaves the sign-in form out", () => {
    const forms = findPersistenceForms(FIXTURE);
    assert.equal(forms.length, 1);
    assert.equal(forms[0].path, "/notes");
    assert.equal(forms[0].field.locator.label, "Note");
    assert.equal(forms[0].submit?.text, "Save note");
});

test("findPersistenceForms: search boxes, email-only signups and hidden fields are not persistence forms", () => {
    const forms = findPersistenceForms(
        profile(
            page("/search", [el("form", {}), el("input", { label: "Search", id: "q", inputType: "text" }), el("button", { text: "Go" })]),
            page("/news", [el("form", {}), el("input", { label: "Email", id: "e", inputType: "email" }), el("button", { text: "Subscribe" })]),
            page("/hidden", [el("form", {}), el("input", { label: "Code", id: "c", visible: false }), el("button", { text: "Send" })])
        )
    );
    assert.deepEqual(forms, []);
});

test("findPersistenceForms: a textarea counts, fields belong to the form they follow, and at most 3 forms are used", () => {
    const pages = ["/a", "/b", "/c", "/d"].map((path) =>
        page(path, [el("form", {}), el("textarea", { label: `Comment ${path}`, id: `comment${path.slice(1)}` }), el("button", { text: "Post" })])
    );
    const forms = findPersistenceForms(profile(...pages));
    assert.deepEqual(forms.map((f) => f.path), ["/a", "/b", "/c"]);
    assert.equal(forms[0].field.elementType, "textarea");
});

test("database suite: one round trip per form - fill a unique value, save, reload, check it is still shown", () => {
    const code = generate("Check the notes page form for database coverage.", ["database"], FIXTURE);
    const tests = code.match(/test\('TFDB-\d+: [^']+'/g) ?? [];
    assert.deepEqual(tests, ["test('TFDB-001: persistence round trip: Note on /notes'"]);
    const body = code.slice(code.indexOf("TFDB-001"));
    const order = ["Date.now()", "page.locator('[id=\"note\"]')", ".fill(value)", "name: 'Save note'", "getByText(value)", "page.reload(", "getByText(value)"];
    let at = 0;
    for (const step of order) {
        const found = body.indexOf(step, at);
        assert.ok(found >= 0, `missing or out of order: ${step}`);
        at = found + step.length;
    }
    assert.match(body, /it was shown once but not persisted/, "the failure message must say what went wrong");
});

test("database suite: the generated code compiles against real Playwright types and awaits every web-first assertion", () => {
    const code = generate("Check the notes page form for database coverage.", ["database"], FIXTURE);
    assert.deepEqual(findTypeErrors(code), []);
    assert.deepEqual(findUnawaitedAssertions(code).filter((a) => a.returnsPromise), []);
});

test("database suite: skipped unless the run enables interactive tests - even when only a keyword like 'save' triggered it (Decision 5)", () => {
    const selected = generate("Check the notes page for database coverage.", ["database"], FIXTURE);
    const triggered = generate("Check that notes are saved.", [], FIXTURE);
    for (const code of [selected, triggered]) {
        const body = code.slice(code.indexOf("TFDB-001"));
        assert.ok(body.length > 0, "a database test should be generated");
        assert.match(body.slice(0, 400), /test\.skip\(process\.env\.TESTFORGE_INTERACTIVE !== '1'/);
    }
});

test("database suite: no inspection data or no suitable form is reported as a note, not silently empty", () => {
    const none = buildDatabaseRoundTripTests(null);
    assert.equal(none.tests.length, 0);
    assert.match(none.notes[0], /no page inspection data/);

    const signInOnly = buildDatabaseRoundTripTests(profile(SIGN_IN));
    assert.equal(signInOnly.tests.length, 0);
    assert.match(signInOnly.notes[0], /no form that saves visible text was found/);

    const code = generate("Check the sign-in page for database coverage.", ["database"], profile(SIGN_IN));
    assert.match(code, /\/\/ Database: no form that saves visible text was found/);
    assert.match(code, /test\.describe\('Database Coverage'/);
});

test("database suite: not generated when database is neither selected nor triggered", () => {
    const code = generate("Check the home page works.", ["functional"], FIXTURE);
    assert.doesNotMatch(code, /TFDB-|Database Coverage/);
});

test("fieldLocator: ids with '.', ':', a leading digit, quotes or a backslash select exactly that field in a real browser", { skip: needsChromium }, async () => {
    // `#id` would be a CSS syntax error (or match nothing) for all of these;
    // the [id="..."] form, escaped for CSS and then for the JS string, must not.
    const { chromium } = await import("@playwright/test");
    const { fieldLocator } = await import("./database-round-trip.ts");
    const ids = ["note.body", "form:note", "3rd-note", `it's "quoted"`, "back\slash"];
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
        await page.setContent(ids.map((id, i) => `<input id="${escapeHtml(id)}" value="field-${i}">`).join("\n"));
        for (const [i, id] of ids.entries()) {
            const expression = fieldLocator(el("input", { id, label: "Note", inputType: "text" }));
            assert.deepEqual(findTypeErrors(`import { test } from '@playwright/test';\ntest('t', async ({ page }) => { await ${expression}.fill('x'); });`), [], id);
            // Evaluate the generated expression exactly as the suite would run it.
            const locator = new Function("page", `return ${expression};`)(page);
            assert.equal(await locator.count(), 1, `${id}: should match exactly one field`);
            assert.equal(await locator.inputValue(), `field-${i}`, `${id}: matched the wrong field`);
        }
    } finally {
        await browser.close();
    }
});
