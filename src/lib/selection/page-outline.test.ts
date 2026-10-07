/**
 * Phase 40 Decisions 2 and 3 (TFP-171), as revised at Gate A (TFP-176, Emil
 * 2026-10-07): each page's outline, and how it refines TFP-170's address
 * types - split only by form signature, merge only sibling address types
 * under one immediate parent with equal full signatures, never top-level
 * pages or home - and the report-only labels.
 *
 * ISTQB technique: decision table. Conditions: same address type or not;
 * form signatures equal or not; full signatures equal or not; same
 * immediate parent or not (top-level, home); outline read or not. Then a real
 * crawl of the fixture's /types shop, updated to the revised expectation.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/selection/page-outline.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";
import type { PageOutline } from "./page-outline.ts";

const { signatureOf, formSignatureOf, narrowSignatureOf } = await import("./page-outline.ts");
const { groupPagesIntoTypes, groupPagesByAddress, labelPageType } = await import("./page-types.ts");
const { startRecordedFixture } = await import("../../test-support/comparison-fixture.ts");
const { chromiumSkipReason } = await import("../../test-support/chromium.ts");
const needsChromium = await chromiumSkipReason();

const outline = (over: Partial<PageOutline> = {}): PageOutline => ({ landmarks: ["banner", "contentinfo", "main", "navigation"], forms: [], cards: false, headings: ["h1"], interactive: 20, ...over });
const shown = (types: Array<{ pattern: string; pages: string[] }>) => types.map((type) => `${type.pattern} = ${type.pages.join(",")}`);

test("the signature is landmarks, forms (count and every field's type) and cards; the form signature is the forms alone; counts never decide", () => {
    assert.equal(signatureOf(outline()), signatureOf(outline({ headings: ["h1", "h2", "h2"], interactive: 90 })));
    assert.notEqual(signatureOf(outline()), signatureOf(outline({ cards: true })));
    assert.equal(formSignatureOf(outline()), formSignatureOf(outline({ cards: true, landmarks: ["main"] })), "cards and landmarks aren't in the form signature");
    assert.notEqual(formSignatureOf(outline({ forms: [["email", "password"]] })), formSignatureOf(outline({ forms: [["email"]] })));
    assert.equal(formSignatureOf(outline({ forms: [["email"], ["search"]] })), formSignatureOf(outline({ forms: [["search"], ["email"]] })), "form order doesn't matter");
    // Every field type counts (Emil, 2026-10-07): the narrow reading can't tell a registration form from a sign-in form.
    const signIn = outline({ forms: [["email", "password"]] });
    const register = outline({ forms: [["date", "email", "password", "select", "tel", "text"]] });
    assert.notEqual(formSignatureOf(signIn), formSignatureOf(register));
    assert.equal(narrowSignatureOf(signIn), narrowSignatureOf(register));
});

test("split an address type only by form signature: different forms split it; cards or landmarks don't", () => {
    assert.deepEqual(shown(groupPagesIntoTypes([
        { path: "/account/login", outline: outline({ forms: [["email", "password"]] }) },
        { path: "/account/register", outline: outline({ forms: [["email", "password", "text"]] }) },
        { path: "/account/forgot", outline: outline({ forms: [["email"]] }) },
    ])), ["/account/:slug = /account/login", "/account/:slug = /account/register", "/account/:slug = /account/forgot"]);
    // A listing page without cards (an empty category), or a product without related items, stays in its type.
    assert.deepEqual(shown(groupPagesIntoTypes([
        { path: "/category/tools", outline: outline({ cards: true, forms: [["select"]] }) },
        { path: "/category/empty", outline: outline({ cards: false, forms: [["select"]] }) },
        { path: "/product/1", outline: outline({ cards: true }) },
        { path: "/product/2", outline: outline({ cards: false, landmarks: ["main"] }) },
    ])), ["/category/:slug = /category/tools,/category/empty", "/product/:id = /product/1,/product/2"]);
});

test("merge only sibling address types under one immediate parent with equal full signatures; never top-level pages or home", () => {
    const same = outline();
    // One immediate parent (/p), equal signatures: TFP-170's id/slug edge folds back.
    assert.deepEqual(shown(groupPagesIntoTypes([{ path: "/p/iphone15promaxblack2023", outline: same }, { path: "/p/galaxy-s24", outline: same }])), ["/p/:id + /p/:slug = /p/iphone15promaxblack2023,/p/galaxy-s24"]);
    // One immediate parent, different signatures: two types.
    assert.deepEqual(shown(groupPagesIntoTypes([{ path: "/p/iphone15promaxblack2023", outline: same }, { path: "/p/galaxy-s24", outline: outline({ cards: true }) }])), ["/p/:id = /p/iphone15promaxblack2023", "/p/:slug = /p/galaxy-s24"]);
    // Different immediate parents (/shop/men, /shop/women) never merge, even with equal outlines (Emil, 2026-10-07).
    assert.deepEqual(shown(groupPagesIntoTypes([{ path: "/shop/men/shirts", outline: same }, { path: "/shop/women/shoes", outline: same }])), ["/shop/men/shirts = /shop/men/shirts", "/shop/women/shoes = /shop/women/shoes"]);
    // Nor do two collections under a language prefix: /en/product/:id and /en/category/:id, equal outlines.
    assert.deepEqual(shown(groupPagesIntoTypes([{ path: "/en/product/1", outline: same }, { path: "/en/category/2", outline: same }])), ["/en/product/:id = /en/product/1", "/en/category/:id = /en/category/2"]);
    // Nor pages deeper under one first segment: /a/b/c/x and /a/d/e/y.
    assert.equal(groupPagesIntoTypes([{ path: "/a/b/c/x", outline: same }, { path: "/a/d/e/y", outline: same }]).length, 2);
    // Top-level pages and home never merge, whatever their outlines.
    assert.deepEqual(shown(groupPagesIntoTypes([{ path: "/", outline: same }, { path: "/privacy", outline: same }, { path: "/terms", outline: same }])), ["/ = /", "/privacy = /privacy", "/terms = /terms"]);
    assert.deepEqual(shown(groupPagesIntoTypes([{ path: "/#/", outline: same }, { path: "/#/rentals", outline: same }, { path: "/#/chainsaws", outline: same }])), ["/#/ = /#/", "/#/rentals = /#/rentals", "/#/chainsaws = /#/chainsaws"]);
    // Different parents never merge.
    assert.equal(groupPagesIntoTypes([{ path: "/legal/privacy", outline: same }, { path: "/help/terms", outline: same }]).length, 2);
    // A page with no outline stays apart and never merges.
    assert.deepEqual(shown(groupPagesIntoTypes([{ path: "/p/a1", outline: same }, { path: "/p/b2" }, { path: "/p/c-3", outline: same }])), ["/p/:slug = /p/a1,/p/c-3", "/p/:slug = /p/b2"]);
});

test("a segment directly before an :id is a collection, not a slug: /en/product/:id beside /en/category/:id", () => {
    assert.deepEqual(groupPagesByAddress(["/en/product/1", "/en/category/2"]).map((type: { pattern: string }) => type.pattern), ["/en/product/:id", "/en/category/:id"]);
    assert.deepEqual(shown(groupPagesIntoTypes([{ path: "/en/product/1", outline: outline({ forms: [["number"]] }) }, { path: "/en/category/2", outline: outline({ cards: true }) }])), ["/en/product/:id = /en/product/1", "/en/category/:id = /en/category/2"]);
    // A slug still forms where no id follows it.
    assert.deepEqual(groupPagesByAddress(["/category/hand-tools", "/category/power-tools"]).map((type: { pattern: string }) => type.pattern), ["/category/:slug"]);
});

test("a label never changes a type's pages", () => {
    const pages = [{ path: "/", outline: outline() }, { path: "/x/1", outline: outline() }, { path: "/x/2", outline: outline() }];
    const before = JSON.stringify(groupPagesIntoTypes(pages));
    const types = groupPagesIntoTypes(pages);
    const labels = types.map((type: Parameters<typeof labelPageType>[0]) => labelPageType(type, outline({ forms: [["password"]] }), "/nowhere"));
    assert.deepEqual(labels, ["sign-in", "sign-in"]);
    assert.equal(JSON.stringify(types), before);
    assert.deepEqual(types.map((type: { pages: string[] }) => type.pages), [["/"], ["/x/1", "/x/2"]]);
});

test("in a real browser: the crawl of the fixture's /types shop finds the revised types", { skip: needsChromium }, async () => {
    const { POST, GET } = await import("../../app/api/crawl/route.ts");
    const { NextRequest } = await import("next/server");
    const fixture = await startRecordedFixture();
    try {
        const started = await (await POST(new NextRequest(new URL("http://localhost/api/crawl"), { method: "POST", body: JSON.stringify({ baseUrl: `${fixture.origin}/types` }) }))).json();
        let crawl = started;
        while (crawl.crawlStatus === "running") {
            await new Promise((resolve) => setTimeout(resolve, 500));
            crawl = await (await GET(new NextRequest(new URL(`http://localhost/api/crawl?crawlId=${started.crawlId}`)))).json();
        }
        assert.equal(crawl.crawlStatus, "completed", JSON.stringify(crawl));
        assert.equal(crawl.result.pageCount, 15);
        const types = crawl.result.pageTypes.map((type: { label: string; pattern: string; pages: string[] }) => `${type.label} | ${type.pattern} | ${type.pages.join(", ")}`);
        assert.deepEqual(types, [
            "home | /types | /types",
            "detail | /types/product/:id | /types/product/101, /types/product/102",
            // Split by forms: 103 is sold out, with no add-to-cart form.
            "detail | /types/product/:id | /types/product/103",
            // The empty category has no cards, and stays: cards don't split.
            "listing | /types/category/:slug | /types/category/tools, /types/category/garden, /types/category/empty",
            // Split by forms, as the Toolshop's /auth/:slug.
            "sign-in | /types/account/:slug | /types/account/login",
            "form | /types/account/:slug | /types/account/contact",
            // Equal outlines, different immediate parents (/types/legal, /types/help): apart.
            "content | /types/legal/privacy | /types/legal/privacy",
            "content | /types/help/terms | /types/help/terms",
            // TFP-170's id/slug edge, one parent (/p): still folded back.
            "detail | /p/:id + /p/:slug | /p/iphone15promaxblack2023, /p/galaxy-s24",
            // Its two-varying-segments edge: different parents, so apart.
            "listing | /shop/men/shirts | /shop/men/shirts",
            "listing | /shop/women/shoes | /shop/women/shoes",
        ]);
        // TFP-172: the crawl also ranks the types and selects Standard's pages, one per type up to 8.
        const standard = crawl.result.pageSelection.standard;
        assert.equal(standard.pages.length, 8);
        // 11 types: 6 always covered (home, the 4 form types, the largest: the category), then 5 others for 2 places.
        // Sold-out 103 loses to the /shop listings on interactive elements; content types go first.
        assert.deepEqual(standard.skipped.map((type: { pattern: string; label: string }) => `${type.label} | ${type.pattern}`), [
            "detail | /types/product/:id",
            "content | /types/legal/privacy",
            "content | /types/help/terms",
        ]);
    } finally {
        await fixture.close();
    }
});
