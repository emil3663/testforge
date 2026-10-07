/**
 * Phase 40 Decisions 2 and 3 (TFP-171): each page's outline, the exact
 * structural signature that merges and splits TFP-170's address types, and
 * the report-only labels.
 *
 * ISTQB technique: equivalence partitioning over how two pages relate -
 * one address and one signature (one type), one address and different
 * signatures (split), different addresses and one signature (merge),
 * different addresses and signatures (two types), and a page with no outline
 * - then a real crawl of the fixture's /types shop, which has each, plus
 * TFP-170's two address edges (a mixed :id/:slug family, two varying
 * segments) folded back together by their outlines.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/selection/page-outline.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";
import type { PageOutline } from "./page-outline.ts";

const { signatureOf, narrowSignatureOf } = await import("./page-outline.ts");
const { groupPagesIntoTypes, groupPagesByAddress, labelPageType } = await import("./page-types.ts");
const { startRecordedFixture } = await import("../../test-support/comparison-fixture.ts");
const { chromiumSkipReason } = await import("../../test-support/chromium.ts");
const needsChromium = await chromiumSkipReason();

const outline = (over: Partial<PageOutline> = {}): PageOutline => ({ landmarks: ["banner", "contentinfo", "main", "navigation"], forms: [], cards: false, headings: ["h1"], interactive: 20, ...over });

test("the signature is landmarks, forms (count and field types) and cards; counts never decide", () => {
    assert.equal(signatureOf(outline()), signatureOf(outline({ headings: ["h1", "h2", "h2"], interactive: 90 })), "headings and interactive counts are left out");
    assert.notEqual(signatureOf(outline()), signatureOf(outline({ landmarks: ["main"] })));
    assert.notEqual(signatureOf(outline()), signatureOf(outline({ cards: true })));
    assert.notEqual(signatureOf(outline({ forms: [["email", "password"]] })), signatureOf(outline({ forms: [["email"]] })));
    assert.equal(signatureOf(outline({ forms: [["email"], ["search"]] })), signatureOf(outline({ forms: [["search"], ["email"]] })), "form order doesn't matter");
    // Decision 2's narrow reading (only password, email, textarea, search) can't tell a registration form from a sign-in form.
    const signIn = outline({ forms: [["email", "password"]] });
    const register = outline({ forms: [["date", "email", "password", "select", "tel", "text"]] });
    assert.notEqual(signatureOf(signIn), signatureOf(register));
    assert.equal(narrowSignatureOf(signIn), narrowSignatureOf(register));
});

test("split within an address, merge across addresses, and a page with no outline keeps its address type", () => {
    const content = signatureOf(outline());
    const form = signatureOf(outline({ forms: [["email", "text", "textarea"]] }));
    const types = groupPagesIntoTypes([
        { path: "/", signature: signatureOf(outline({ landmarks: ["main", "search"] })) },
        { path: "/account/login", signature: signatureOf(outline({ forms: [["email", "password"]] })) },
        { path: "/account/contact", signature: form },
        { path: "/legal/privacy", signature: content },
        { path: "/help/terms", signature: content },
        { path: "/unread/a" },
        { path: "/unread/b" },
    ]);
    assert.deepEqual(types.map((type: { pattern: string; pages: string[] }) => `${type.pattern} = ${type.pages.join(",")}`), [
        "/ = /",
        "/account/:slug = /account/login",
        "/account/:slug = /account/contact",
        "/legal/privacy + /help/terms = /legal/privacy,/help/terms",
        "/unread/:slug = /unread/a,/unread/b",
    ]);
});

test("TFP-170's edges fold back by outline: a mixed :id/:slug family, and two varying segments", () => {
    const detail = signatureOf(outline({ forms: [["number"]] }));
    const listing = signatureOf(outline({ cards: true }));
    assert.deepEqual(groupPagesByAddress(["/p/iphone15promaxblack2023", "/p/galaxy-s24"]).map((type: { pattern: string }) => type.pattern), ["/p/:id", "/p/:slug"], "by address, two types");
    assert.deepEqual(groupPagesIntoTypes([{ path: "/p/iphone15promaxblack2023", signature: detail }, { path: "/p/galaxy-s24", signature: detail }]).map((type: { pattern: string }) => type.pattern), ["/p/:id + /p/:slug"]);
    assert.deepEqual(groupPagesByAddress(["/shop/men/shirts", "/shop/women/shoes"]).map((type: { pattern: string }) => type.pattern), ["/shop/men/shirts", "/shop/women/shoes"]);
    assert.deepEqual(groupPagesIntoTypes([{ path: "/shop/men/shirts", signature: listing }, { path: "/shop/women/shoes", signature: listing }]).map((type: { pattern: string }) => type.pattern), ["/shop/men/shirts + /shop/women/shoes"]);
});

test("a third address edge, found here: under a shared prefix, two id families read as one slug pattern; their outlines split them again", () => {
    // TFP-170's rule, unchanged: after ids become :id, /en/product/:id and /en/category/:id differ only in one segment under /en.
    assert.deepEqual(groupPagesByAddress(["/en/product/1", "/en/category/2"]).map((type: { pattern: string; pages: string[] }) => `${type.pattern} ${type.pages.length}`), ["/en/:slug/:id 2"]);
    const types = groupPagesIntoTypes([{ path: "/en/product/1", signature: signatureOf(outline({ forms: [["number"]] })) }, { path: "/en/category/2", signature: signatureOf(outline({ cards: true })) }]);
    assert.deepEqual(types.map((type: { pattern: string; pages: string[] }) => `${type.pattern} = ${type.pages.join(",")}`), ["/en/:slug/:id = /en/product/1", "/en/:slug/:id = /en/category/2"], "split by outline, but both named /en/:slug/:id");
});

test("a label never changes a type's pages", () => {
    const pages = [{ path: "/", signature: "a" }, { path: "/x", signature: "b" }, { path: "/y", signature: "b" }];
    const before = JSON.stringify(groupPagesIntoTypes(pages));
    const types = groupPagesIntoTypes(pages);
    // A deliberately wrong outline gives a wrong label, and the pages stay as they were.
    const labels = types.map((type: { pattern: string }) => labelPageType(type as never, outline({ forms: [["password"]] }), "/nowhere"));
    assert.deepEqual(labels, ["sign-in", "sign-in"]);
    assert.equal(JSON.stringify(types), before);
    assert.deepEqual(types.map((type: { pages: string[] }) => type.pages), [["/"], ["/x", "/y"]]);
});

test("in a real browser: the crawl of the fixture's /types shop finds exactly its types, with one merge, the splits and both edges shown", { skip: needsChromium }, async () => {
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
        assert.equal(crawl.result.pageCount, 14);
        const types = crawl.result.pageTypes.map((type: { label: string; pattern: string; pages: string[] }) => `${type.label} | ${type.pattern} | ${type.pages.join(", ")}`);
        assert.deepEqual(types, [
            "home | /types | /types",
            "detail | /types/product/:id | /types/product/101, /types/product/102",
            // Split: one address, a different outline (sold out, with an aside).
            "detail | /types/product/:id | /types/product/103",
            "listing | /types/category/:slug | /types/category/tools, /types/category/garden",
            // Split: /types/account/:slug by outline into sign-in and form, as the Toolshop's /auth/:slug.
            "sign-in | /types/account/:slug | /types/account/login",
            "form | /types/account/:slug | /types/account/contact",
            // Merge: different addresses, one outline.
            "content | /types/legal/privacy + /types/help/terms | /types/legal/privacy, /types/help/terms",
            // TFP-170's edges, each folded back into one type.
            "detail | /p/:id + /p/:slug | /p/iphone15promaxblack2023, /p/galaxy-s24",
            "listing | /shop/men/shirts + /shop/women/shoes | /shop/men/shirts, /shop/women/shoes",
        ]);
    } finally {
        await fixture.close();
    }
});
