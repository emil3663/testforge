/**
 * TFP-121 (Phase 34, Decision 10): every form field has an accessible name.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/generate/mock/form-field-names.test.ts
 */
import assert from "node:assert";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import type { ActionableElementDetail, ContentProfile, ContentProfilePage } from "./types.ts";

const { buildFormFieldNameTests, findFormFieldPages } = await import("./form-field-names.ts");
const { findTypeErrors, findUnawaitedAssertions } = await import("../validate.ts");

function el(elementType: ActionableElementDetail["elementType"], inputType = ""): ActionableElementDetail {
    return {
        text: "", url: null, category: "form", elementType, containerLabel: "", expectedStatus: null, isVisible: true,
        ariaPressed: null, ariaSelected: null, ariaChecked: null, ariaExpanded: null, groupId: null,
        locator: { role: null, name: "", label: "", placeholder: "", id: "", inputType },
    };
}

function page(path: string, elements: ActionableElementDetail[]): ContentProfilePage {
    return { path, url: `http://127.0.0.1:4410${path}`, title: path, metaDescription: "", headings: [], buttons: [], links: [], actionableElements: elements, visibleTextSnippets: [] };
}

function profile(pages: ContentProfilePage[]): ContentProfile {
    return { pages } as unknown as ContentProfile;
}

test("findFormFieldPages: pages with a fillable field; buttons, hidden and submit inputs don't count", () => {
    const p = profile([
        page("/", [el("button"), el("input", "hidden"), el("input", "submit")]),
        page("/login", [el("form"), el("input", "email"), el("input", "password")]),
        page("/notes", [el("textarea")]),
        page("/pick", [el("select")]),
        page("/login", [el("input", "text")]),
    ]);
    assert.deepEqual(findFormFieldPages(p), ["/login", "/notes", "/pick"]);
    assert.deepEqual(findFormFieldPages(null), [], "no page data: nothing to check");
    assert.deepEqual(buildFormFieldNameTests(null), []);
});

test("generated tests type-check against @playwright/test and await every assertion", () => {
    const tests = buildFormFieldNameTests(profile([page("/it's", [el("input", "text")]), page("/login", [el("input", "email")])]));
    assert.equal(tests.length, 2);
    const suite = `import { test, expect } from '@playwright/test';\n${tests.join("\n\n")}\n`;
    assert.deepEqual(findTypeErrors(suite), []);
    assert.deepEqual(findUnawaitedAssertions(suite).filter((a) => a.returnsPromise), []);
});

const FIELDS_PAGE = `<!doctype html><title>t</title>
<form>
<label for="email">Email</label> <input id="email" type="email">
<input id="search" aria-label="Search">
<span id="lb">Phone</span> <input id="phone" type="tel" aria-labelledby="lb">
<label>Wrapped <input id="wrapped"></label>
<input id="titled" title="Title only">
<input id="nick" placeholder="Your nickname">
<span>Unlabelled</span> <input id="unlabelled" type="email">
<select name="country"><option>x</option></select>
<textarea placeholder="Say something"></textarea>
<input type="hidden" name="token"> <input type="submit" value="Go">
<div style="display:none"><input id="hidden-by-css"></div>
</form>`;

const LABELLED_PAGE = `<!doctype html><title>t</title><form><label for="a">A</label> <input id="a"><button>Go</button></form>`;

/** Runs a generated test the way Playwright would: a real browser, a real page, Playwright's expect. */
async function runGenerated(testCode: string, baseURL: string) {
    const ts = await import("typescript");
    const { chromium, expect } = await import("@playwright/test");
    const js = ts.transpileModule(testCode, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const annotations: Array<{ type: string; description?: string }> = [];
    let body: ((fixtures: { page: unknown }) => Promise<void>) | null = null;
    const fakeTest = Object.assign((_title: string, fn: typeof body) => { body = fn; }, { info: () => ({ annotations }) });
    new Function("test", "expect", js)(fakeTest, expect);
    const browser = await chromium.launch();
    try {
        const page = await (await browser.newContext({ baseURL })).newPage();
        let error: Error | null = null;
        try {
            await body!({ page });
        } catch (e) {
            error = e as Error;
        }
        return { error, annotations };
    } finally {
        await browser.close();
    }
}

test("in a real browser: an unlabelled field fails and is named; a placeholder-only one is a finding; labelled ones pass", async () => {
    const server = createServer((req, res) => {
        res.writeHead(200, { "content-type": "text/html" }).end(req.url === "/fields" ? FIELDS_PAGE : LABELLED_PAGE);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    try {
        const [fieldsTest, labelledTest] = buildFormFieldNameTests(profile([page("/fields", [el("input", "email")]), page("/labelled", [el("input", "text")])]));

        const bad = await runGenerated(fieldsTest, baseURL);
        assert.ok(bad.error, "the unlabelled field must fail the test");
        // Only the unlabelled field and the select: label, aria-label,
        // aria-labelledby, a wrapping label, title and a placeholder all give a name.
        // (Outside the runner Playwright drops expect's custom message, which
        // adds the page; the failing list itself is always in the error.)
        const failing = (bad.error as Error & { matcherResult?: { actual?: unknown } }).matcherResult?.actual;
        assert.deepEqual(failing, ["#unlabelled", 'select[name="country"]']);
        assert.deepEqual(
            bad.annotations.map((a) => a.description),
            [
                'form field named only by its placeholder on /fields, which disappears as the user types: #nick ("Your nickname")',
                'form field named only by its placeholder on /fields, which disappears as the user types: textarea ("Say something")',
            ]
        );

        const good = await runGenerated(labelledTest, baseURL);
        assert.equal(good.error, null, String(good.error));
        assert.deepEqual(good.annotations, []);
    } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
    }
});
