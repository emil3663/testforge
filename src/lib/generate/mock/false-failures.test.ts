/**
 * Phase 36 (TFP-123): four failures on a healthy real site
 * (the-internet.herokuapp.com), each reproduced and read by hand, each a
 * template error. See docs/decisions/data/labelled-failures.md.
 *
 * - TFFU-002 visited "/", which on that site is a list of examples with no
 *   sign-in control; the sign-in lives on /login, the page inspected.
 * - TFFU-007, 010 and 015 located the "Fork me on GitHub" ribbon with
 *   `a[href=...]:visible`. The anchor wraps an absolutely positioned image,
 *   so the anchor itself has a 0x0 box and Playwright calls it hidden, while
 *   a user sees the image, can click it, and reaches it first with Tab.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/generate/mock/false-failures.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";
import type { ActionableElementDetail, ContentProfile, ContentProfilePage, LinkDetail } from "./types.ts";

const { findSignInPath } = await import("./generic-suites.ts");
const { buildLinkLocatorExpression } = await import("./locators.ts");
const { mockGenerate } = await import("./index.ts");
const { normalizeContentRules, normalizeTestAuditMode } = await import("../normalize.ts");
const { findTypeErrors } = await import("../validate.ts");

function el(elementType: ActionableElementDetail["elementType"], fields: { text?: string; name?: string; inputType?: string }): ActionableElementDetail {
    return {
        text: fields.text ?? "", url: null, category: "form", elementType, containerLabel: "", expectedStatus: null, isVisible: true,
        ariaPressed: null, ariaSelected: null, ariaChecked: null, ariaExpanded: null, groupId: null,
        locator: { role: null, name: fields.name ?? "", label: "", placeholder: "", id: "", inputType: fields.inputType ?? "" },
    };
}

function page(path: string, elements: ActionableElementDetail[]): ContentProfilePage {
    return { path, url: `https://site.test${path}`, title: path, metaDescription: "", headings: [], buttons: [], links: [], actionableElements: elements, visibleTextSnippets: [] };
}

const profile = (pages: ContentProfilePage[]) => ({ pages }) as unknown as ContentProfile;

test("findSignInPath: the first inspected page with a password field or a Log in / Sign in control", () => {
    assert.equal(findSignInPath(profile([page("/", [el("link", { text: "Form Authentication" })]), page("/login", [el("input", { inputType: "password" })])])), "/login");
    assert.equal(findSignInPath(profile([page("/account", [el("button", { text: "Sign in" })])])), "/account");
    assert.equal(findSignInPath(profile([page("/", [el("link", { text: "Log In" })])])), "/");
    assert.equal(findSignInPath(profile([page("/", [el("button", { text: "Login required for checkout" })])])), "/", "a word boundary match, not a phrase check");
    assert.equal(findSignInPath(profile([page("/", [el("button", { text: "Blogging" })])])), null, "not a substring match");
    assert.equal(findSignInPath(null), null);
});

test("the sign-in test visits the inspected sign-in page, and / without page data", () => {
    const rules = normalizeContentRules(undefined);
    const withProfile = mockGenerate("https://site.test", "Check the login page", ["functional"], profile([page("/", [el("link", { text: "Form Authentication" })]), page("/login", [el("input", { inputType: "password" })])]) as never, rules, normalizeTestAuditMode(undefined));
    const signInTest = withProfile.slice(withProfile.indexOf("surfaces a sign-in related control"));
    assert.match(signInTest, /^surfaces a sign-in related control for the described flow', async \(\{ page \}\) => \{\n    await page\.goto\('\/login'\);/);
    const without = mockGenerate("https://site.test", "Check the login page", ["functional"], null, rules, normalizeTestAuditMode(undefined));
    assert.match(without.slice(without.indexOf("surfaces a sign-in related control")), /\n    await page\.goto\('\/'\);/);
    assert.deepEqual(findTypeErrors(withProfile), []);
});

const RIBBON_PAGE = `<!doctype html><title>t</title>
<a id="ribbon" href="https://github.test/repo"><img style="position:absolute;top:0;right:0;width:40px;height:40px" alt="Fork me"></a>
<div style="display:none"><a id="hidden-copy" href="https://shop.test/">Hidden copy</a></div>
<a id="shown-copy" href="https://shop.test/">Shown copy</a>
<div style="display:none"><a id="gone" href="https://gone.test/"><img alt="x" style="width:10px;height:10px"></a></div>`;

const hrefLink = (rawHref: string) => ({ text: "", url: rawHref, rawHref }) as LinkDetail;

test("in a real browser: an image link whose anchor has no box is found and seen; truly hidden links are not", async () => {
    const { chromium } = await import("@playwright/test");
    const browser = await chromium.launch();
    try {
        const p = await browser.newPage();
        await p.setContent(RIBBON_PAGE);
        const locate = (rawHref: string) => new Function("page", `return ${buildLinkLocatorExpression(hrefLink(rawHref))};`)(p);
        // The generated code's "the link, or what renders it".
        const rendered = (locator: ReturnType<typeof locate>) => locator.or(locator.locator("*")).filter({ visible: true }).first();

        const ribbon = locate("https://github.test/repo");
        assert.equal(await ribbon.getAttribute("id"), "ribbon", "the ribbon anchor is found");
        assert.equal(await ribbon.isVisible(), false, "Playwright calls the zero-size anchor itself hidden");
        assert.equal(await rendered(ribbon).isVisible(), true, "what renders it is visible");
        await ribbon.focus();
        assert.equal(await ribbon.evaluate((a: Element) => document.activeElement === a), true, "and it takes keyboard focus");

        assert.equal(await locate("https://shop.test/").getAttribute("id"), "shown-copy", "a hidden duplicate is still skipped");
        assert.equal(await locate("https://gone.test/").count(), 0, "a link hidden with its content is still not found");
    } finally {
        await browser.close();
    }
});
