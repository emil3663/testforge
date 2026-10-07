/**
 * Phase 40 Decisions 4, 5 and 6 (TFP-172): rank page types, then select
 * pages for Standard (one per type, a hard cap of 8) and Comprehensive (every
 * type first, then its page budget).
 *
 * ISTQB technique: decision table. Conditions for the always-covered rule:
 * home or not; has a form or not; the largest type or not; content or not.
 * For the cap: types within it or over it; always-covered types alone over
 * it or not. Then the ordered rules one at a time (pages, forms, interactive
 * elements, crawl order), and the committed Gate A crawls of both Toolshops
 * and the-internet.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/selection/select.test.ts
 */
import assert from "node:assert";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import type { PageOutline } from "./page-outline.ts";

const { rankPageTypes, selectStandardPages, selectComprehensivePagesByType, STANDARD_TYPE_CAP } = await import("./select.ts");
const { groupPagesIntoTypes, labelPageType } = await import("./page-types.ts");

const outline = (over: Partial<PageOutline> = {}): PageOutline => ({ landmarks: ["main"], forms: [], cards: false, headings: ["h1"], interactive: 10, ...over });
interface Spec { pattern: string; label: string; pages: string[]; forms?: string[][]; interactive?: number | number[] }
/** Types, with each page's outline: forms and interactive elements per page. */
function site(specs: Spec[]) {
    const outlines = new Map<string, PageOutline>();
    const types = specs.map((spec) => {
        spec.pages.forEach((page, index) => {
            const interactive = Array.isArray(spec.interactive) ? spec.interactive[index] : spec.interactive ?? 10;
            outlines.set(page, outline({ forms: spec.forms ?? [], interactive }));
        });
        const forms = (spec.forms ?? []).map((fields) => `[${fields.join(",")}]`).sort();
        return { pattern: spec.pattern, label: spec.label, pages: spec.pages, formSignature: `forms:${forms.length}${forms.join("")}` };
    });
    return rankPageTypes(types, (path: string) => outlines.get(path));
}
const patterns = (types: Array<{ pattern: string }>) => types.map((type) => type.pattern);
const one = (pattern: string, label = "content", extra: Partial<Spec> = {}): Spec => ({ pattern, label, pages: [pattern], ...extra });

test("always covered: home, every type with a form, and the largest type - whatever the ordered rules say", () => {
    // Decision table: home (no form, 1 page); a form type (1 page); the largest type (no form); a content and a detail type with more pages than home.
    const ranked = site([
        one("/about"),
        { pattern: "/blog/:slug", label: "content", pages: ["/blog/a", "/blog/b"] },
        { pattern: "/item/:id", label: "detail", pages: ["/item/1", "/item/2", "/item/3", "/item/4"] },
        one("/", "home"),
        one("/contact", "form", { forms: [["email", "textarea"]] }),
        { pattern: "/tag/:slug", label: "listing", pages: ["/tag/a", "/tag/b", "/tag/c"] },
    ]);
    assert.deepEqual(ranked.map((type: { pattern: string; alwaysCovered: string[] | null }) => [type.pattern, type.alwaysCovered]), [
        ["/item/:id", ["largest"]],
        // Among themselves, by the rules: the form type's 1 form puts it before home's none.
        ["/contact", ["form"]],
        ["/", ["home"]],
        ["/tag/:slug", null],
        // Content types last, since they are dropped first - even with more pages than a listing.
        ["/blog/:slug", null],
        ["/about", null],
    ]);
    // A type that is home and has a form is always covered for both reasons.
    const both = site([one("/", "home", { forms: [["search"]] }), { pattern: "/item/:id", label: "detail", pages: ["/item/1", "/item/2"] }]);
    assert.deepEqual(both.map((type: { alwaysCovered: string[] | null }) => type.alwaysCovered), [["largest"], ["home", "form"]]);
});

test("the ordered rules, one at a time: pages, then forms, then interactive elements, then crawl order - each type names the rule that placed it", () => {
    const ranked = site([
        // Always covered (largest), so out of this comparison.
        { pattern: "/big/:id", label: "detail", pages: ["/big/1", "/big/2", "/big/3"] },
        one("/d"),
        one("/c", "listing", { interactive: 30 }),
        { pattern: "/b/:id", label: "detail", pages: ["/b/1", "/b/2"] },
        one("/e", "listing", { interactive: 30 }),
        one("/a", "listing", { interactive: 50 }),
    ]);
    assert.deepEqual(ranked.map((type: { pattern: string; placedBy: string }) => `${type.pattern} ${type.placedBy}`), [
        "/big/:id first",
        "/b/:id always covered",
        "/a pages",
        "/c interactive elements",
        "/e crawl order",
        "/d content type",
    ]);
    assert.equal(ranked[2].placement, "after /b/:id by pages (1 page against 2 pages)");
    assert.equal(ranked[3].placement, "after /a by interactive elements (30 interactive elements against 50 interactive elements)");
    assert.equal(ranked[4].placement, "after /c by crawl order (crawled 5th against crawled 3rd)");
    // More forms on the representative page wins over fewer, once pages tie.
    const byForms = site([one("/", "home"), one("/one", "form", { forms: [["text"]] }), one("/two", "form", { forms: [["text"], ["email"]] })]);
    assert.deepEqual(patterns(byForms), ["/two", "/one", "/"]);
    assert.equal(byForms[1].placedBy, "forms");
});

test("the representative page has the most interactive elements; ties go to crawl order; no outline counts as 0", () => {
    const [type] = site([{ pattern: "/p/:id", label: "detail", pages: ["/p/1", "/p/2", "/p/3"], interactive: [5, 40, 40] }]);
    assert.equal(type.representative, "/p/2");
    assert.deepEqual(type.pagesByInteractive, ["/p/2", "/p/3", "/p/1"]);
    const [unknown] = rankPageTypes([{ pattern: "/x/:id", label: "other", pages: ["/x/1", "/x/2"], formSignature: "" }], () => undefined);
    assert.equal(unknown.representative, "/x/1");
    assert.equal(unknown.interactive, 0);
    assert.deepEqual(unknown.alwaysCovered, ["largest"], "an unknown form signature is not a form");
});

test("Standard: one page per type up to the hard cap of 8; over it, content types go first, then the lowest ranked, each skip naming its rule", () => {
    assert.equal(STANDARD_TYPE_CAP, 8);
    // 11 types: home, a form, the largest; 5 other types; 3 content types.
    const ranked = site([
        one("/", "home"),
        one("/login", "sign-in", { forms: [["password", "text"]] }),
        { pattern: "/item/:id", label: "detail", pages: ["/item/1", "/item/2", "/item/3", "/item/4"] },
        one("/privacy"),
        one("/terms"),
        one("/about"),
        { pattern: "/tag/:slug", label: "listing", pages: ["/tag/a", "/tag/b"], interactive: [10, 60] },
        one("/deals", "listing"),
        one("/new", "listing"),
        one("/gallery", "other"),
        one("/map", "other", { interactive: 99 }),
    ]);
    const standard = selectStandardPages(ranked);
    assert.equal(standard.cap, 8);
    assert.deepEqual(standard.pages, ["/item/1", "/login", "/", "/tag/b", "/map", "/deals", "/new", "/gallery"]);
    assert.deepEqual(patterns(standard.skipped), ["/privacy", "/terms", "/about"]);
    assert.deepEqual(standard.skipped.map((type: { reason: string }) => type.reason), [
        "over the cap of 8 types: ranked 9th; after every other type: content types are dropped first",
        "over the cap of 8 types: ranked 10th; after /privacy by crawl order (crawled 5th against crawled 4th)",
        "over the cap of 8 types: ranked 11th; after /terms by crawl order (crawled 6th against crawled 5th)",
    ]);
    // Within the cap, nothing is skipped, and every type gives its representative.
    const small = selectStandardPages(ranked.slice(0, 5));
    assert.equal(small.skipped.length, 0);
    assert.deepEqual(small.covered.map((type: { selected: string[] }) => type.selected.length), [1, 1, 1, 1, 1]);
});

test("the cap is hard: always-covered types alone over it are ordered among themselves by the rules, and the rest are skipped, named", () => {
    // Home and 9 form types: 10 always-covered types, cap 8.
    const forms = Array.from({ length: 9 }, (_, index) => one(`/form${index + 1}`, "form", { forms: [["text"]], interactive: 20 + index }));
    const ranked = site([one("/", "home", { interactive: 100 }), ...forms]);
    assert.ok(ranked.every((type: { alwaysCovered: unknown }) => type.alwaysCovered));
    const standard = selectStandardPages(ranked);
    assert.equal(standard.pages.length, 8);
    // Each form type has 1 form and home none: the forms rule puts home after them, so the cap cuts it.
    assert.deepEqual(patterns(standard.skipped), ["/form1", "/"]);
    assert.equal(standard.skipped[1].reason, "over the cap of 8 types: ranked 10th; always covered (home); after /form1 by forms (0 forms against 1 form)");
});

test("Comprehensive: every type before a second page of any type; then one more page per type per round, in rank order, up to the budget", () => {
    const ranked = site([
        one("/", "home"),
        { pattern: "/item/:id", label: "detail", pages: ["/item/1", "/item/2", "/item/3", "/item/4", "/item/5"], interactive: [1, 2, 3, 4, 5] },
        { pattern: "/tag/:slug", label: "listing", pages: ["/tag/a", "/tag/b"] },
        one("/about"),
    ]);
    const comprehensive = selectComprehensivePagesByType(ranked, 7);
    assert.deepEqual(comprehensive.covered.map((type: { pattern: string; selected: string[] }) => `${type.pattern}: ${type.selected.join(" ")}`), [
        "/item/:id: /item/5 /item/4 /item/3",
        "/: /",
        "/tag/:slug: /tag/a /tag/b",
        "/about: /about",
    ]);
    assert.equal(comprehensive.pages.length, 7);
    assert.equal(comprehensive.skipped.length, 0);
    // A budget below the type count covers one page of the top types and names the rest.
    const tight = selectComprehensivePagesByType(ranked, 2);
    assert.deepEqual(tight.pages, ["/item/5", "/"]);
    assert.deepEqual(tight.skipped.map((type: { reason: string }) => type.reason), [
        "over the cap of 2 pages: ranked 3rd; after the always-covered types",
        "over the cap of 2 pages: ranked 4th; after every other type: content types are dropped first",
    ]);
    // A budget beyond every page stops when the pages run out.
    assert.equal(selectComprehensivePagesByType(ranked, 20).pages.length, 9);
});

/** The committed Gate A crawl of a site, grouped and labelled as the crawl route does, then ranked. */
async function rankedFromCrawl(site: string) {
    const crawl = JSON.parse(await readFile(new URL(`../../../benchmarks/2026-10-07-phase40-types/${site}-crawl.json`, import.meta.url), "utf8"));
    const pages: Array<{ path: string; outline?: PageOutline }> = crawl.result.pages;
    const outlines = new Map(pages.map((page) => [page.path, page.outline]));
    const startPath = pages.some((page) => page.path === "/#/") ? "/#/" : "/";
    const types = groupPagesIntoTypes(pages.map((page) => ({ path: page.path, outline: page.outline })))
        .map((type: Parameters<typeof labelPageType>[0]) => ({ ...type, label: labelPageType(type, outlines.get(type.pages[0]), startPath) }));
    return rankPageTypes(types, (path: string) => outlines.get(path));
}

test("the committed crawls: both Toolshops cover 8 of their 9 types and skip one content type; the-internet covers its 8 always-covered types", async () => {
    // The committed crawls list pages sorted by path, so crawl order here is path order.
    for (const [site, home, skipped] of [["toolshop-clean", "/", "/rentals"], ["toolshop-with-bugs", "/#/", "/#/rentals"]] as const) {
        const ranked = await rankedFromCrawl(site);
        const standard = selectStandardPages(ranked);
        assert.equal(ranked.length, 9, site);
        assert.deepEqual(patterns(standard.skipped), [skipped], site);
        assert.equal(standard.skipped[0].label, "content", site);
        const covered = new Set(standard.covered.map((type: { pattern: string }) => type.pattern));
        for (const pattern of [home, `${home === "/" ? "" : "/#"}/product/:id`, `${home === "/" ? "" : "/#"}/category/:slug`, `${home === "/" ? "" : "/#"}/contact`, `${home === "/" ? "" : "/#"}/auth/:slug`]) {
            assert.ok(covered.has(pattern), `${site}: ${pattern} covered`);
        }
        assert.equal(standard.covered.filter((type: { pattern: string }) => type.pattern.endsWith("/auth/:slug")).length, 3, `${site}: login, register and forgot-password`);
        // Comprehensive: all 9 types, then the rest of 20 pages.
        const comprehensive = selectComprehensivePagesByType(ranked, 20);
        assert.equal(comprehensive.covered.length, 9, site);
        assert.equal(comprehensive.pages.length, 20, site);
    }
    const internet = await rankedFromCrawl("the-internet");
    const standard = selectStandardPages(internet);
    assert.equal(internet.length, 57);
    assert.deepEqual(standard.covered.map((type: { pattern: string; alwaysCovered: string[] | null }) => `${type.pattern} ${type.alwaysCovered?.join("+")}`), [
        "/infinite_scroll/:id largest",
        "/dynamic_controls form",
        "/login form",
        "/upload form",
        "/checkboxes form",
        "/forgot_password form",
        "/key_presses form",
        "/ home",
    ]);
    assert.equal(standard.skipped.length, 49);
    assert.equal(standard.skipped[0].reason, "over the cap of 8 types: ranked 9th; after the always-covered types");
});

test("a run inspects the selected pages: Standard's or Comprehensive's by type after a crawl, every page without types; no 5-page cap", async () => {
    const { typeSelectedPaths } = await import("../../app/_lib/derive.ts");
    const { normalizeInspectionPathList, MAX_INSPECTION_PATHS } = await import("../introspect/paths.ts");
    const ranked = site([
        one("/", "home"),
        { pattern: "/item/:id", label: "detail", pages: ["/item/1", "/item/2", "/item/3"] },
        ...Array.from({ length: 8 }, (_, index) => one(`/page${index + 1}`, "listing")),
    ]);
    const crawl = { crawledAt: "", baseUrl: "http://site.test", pageCount: 0, pages: [], rankedTypes: ranked };
    const standard = typeSelectedPaths(crawl, { kind: "standard" });
    assert.equal(standard.length, 8);
    assert.deepEqual(typeSelectedPaths(crawl, { kind: "comprehensive", area: "security", level: "passive", pageCap: 12 }), selectComprehensivePagesByType(ranked, 12).pages);
    // A crawl without ranked types (an older result) selects every page, as before.
    assert.deepEqual(typeSelectedPaths({ ...crawl, rankedTypes: undefined, pages: [{ path: "/a", url: "", title: "", discoveredFrom: null }, { path: "/b", url: "", title: "", discoveredFrom: null }] }, { kind: "standard" }), ["/a", "/b"]);
    // Phase 38 Decision 4's reach is the selected pages: all 8 are inspected, not the first 5.
    assert.deepEqual(normalizeInspectionPathList("http://site.test", standard), standard);
    assert.equal(MAX_INSPECTION_PATHS, 100, "the bound left is Comprehensive's largest page cap");
    assert.equal(normalizeInspectionPathList("http://site.test", Array.from({ length: 150 }, (_, index) => `/p${index}`)).length, 100);
});
