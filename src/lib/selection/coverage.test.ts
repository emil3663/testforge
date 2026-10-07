/**
 * Phase 40 Decision 7 (TFP-173): the report of page types found, covered and
 * skipped, and the copyable re-run lists, in the app's report and both HTML
 * exports; a manual override recorded.
 *
 * ISTQB technique: decision table. Conditions: chosen by type or by hand;
 * Standard or Comprehensive; a type covered, skipped, or added by hand; a
 * path-routed or hash-routed site. Then the record's trip through /api/run's
 * normalizer (untrusted input) and into each HTML export.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/selection/coverage.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";
import type { PageOutline } from "./page-outline.ts";
import type { JsonReport, PageTypeCoverageRecord } from "../report/types.ts";

const { rankPageTypes } = await import("./select.ts");
const { buildPageTypeCoverage } = await import("./coverage.ts");
const { describePageTypeHeadline, describePageTypeSelection, coveredPageUrls, skippedPageUrls } = await import("../report/page-types-text.ts");
const { normalizeGenerationRecord } = await import("../run/generation-record.ts");
const { buildReport } = await import("../report/report.ts");
const { buildReportHtmlDocument } = await import("../report/html.ts");

const ORIGIN = "https://with-bugs.practicesoftwaretesting.com";
const outline = (forms: string[][] = [], interactive = 10): PageOutline => ({ landmarks: [], forms, cards: false, headings: [], interactive });
/** A small hash-routed shop: 9 types, so Standard (cap 8) skips one. */
const TYPES: Array<{ pattern: string; label: string; pages: string[]; forms?: string[][] }> = [
    { pattern: "/#/", label: "home", pages: ["/#/"], forms: [["search"]] },
    { pattern: "/#/product/:id", label: "detail", pages: ["/#/product/1", "/#/product/2", "/#/product/3"] },
    { pattern: "/#/category/:slug", label: "listing", pages: ["/#/category/hand-tools", "/#/category/power-tools"], forms: [["select"]] },
    { pattern: "/#/auth/:slug", label: "sign-in", pages: ["/#/auth/login"], forms: [["password", "text"]] },
    { pattern: "/#/auth/:slug", label: "form", pages: ["/#/auth/forgot-password"], forms: [["text"]] },
    { pattern: "/#/contact", label: "form", pages: ["/#/contact"], forms: [["email", "textarea"]] },
    { pattern: "/#/checkout", label: "other", pages: ["/#/checkout"] },
    { pattern: "/#/privacy", label: "content", pages: ["/#/privacy"] },
    { pattern: "/#/rentals", label: "content", pages: ["/#/rentals"] },
];
const outlines = new Map<string, PageOutline>();
for (const type of TYPES) for (const page of type.pages) outlines.set(page, outline(type.forms ?? [], page === "/#/product/2" ? 30 : 10));
const ranked = rankPageTypes(
    TYPES.map((type) => ({ ...type, formSignature: `forms:${(type.forms ?? []).length}${(type.forms ?? []).map((f) => `[${f.join(",")}]`).sort().join("")}` })),
    (path: string) => outlines.get(path)
);
const pages = TYPES.flatMap((type) => type.pages).map((path) => ({ path, url: `${ORIGIN}${path}` }));
const STANDARD = { kind: "standard" } as const;
const COMPREHENSIVE = { kind: "comprehensive", area: "security", level: "passive", pageCap: 12 } as const;

function chosenByType(runMode: typeof STANDARD | typeof COMPREHENSIVE, selectedPaths: string[] = []) {
    return buildPageTypeCoverage({ baseUrl: ORIGIN, pages, rankedTypes: ranked, runMode, selectedPaths, selectedBy: "type" });
}

test("chosen by type, Standard: covered and skipped types, each with pattern, page count, label and the full URL as the address bar shows it", () => {
    const record = chosenByType(STANDARD);
    assert.equal(record.selectedBy, "type");
    assert.equal(record.found, 9);
    assert.equal(record.cap, 8);
    assert.equal(record.covered.length, 8);
    const product = record.covered.find((entry) => entry.pattern === "/#/product/:id")!;
    assert.deepEqual(product, { pattern: "/#/product/:id", label: "detail", pages: 3, url: `${ORIGIN}/#/product/2`, covered: [`${ORIGIN}/#/product/2`] }, "the representative: most interactive elements");
    assert.deepEqual(record.skipped.map((entry) => [entry.url, entry.reason]), [
        [`${ORIGIN}/#/rentals`, "over the cap of 8 types: ranked 9th; after /#/privacy by crawl order (crawled 9th against crawled 8th)"],
    ]);
    // Decision 7's sentence.
    assert.equal(describePageTypeHeadline(record), "Found 9 page types. Covered 8: home, detail (3 pages), listing (2 pages), sign-in (login), form (forgot-password, contact), other (checkout), content (privacy). Not covered: content (rentals).");
    assert.equal(describePageTypeSelection(record), "Pages chosen by page type: one page of each type, up to 8 types.");
    // The copyable lists: every covered page's full URL, one per line; then the skipped types' pages.
    assert.equal(coveredPageUrls(record).length, 8);
    assert.ok(coveredPageUrls(record).every((url) => url.startsWith(`${ORIGIN}/#/`)));
    assert.deepEqual(skippedPageUrls(record), [`${ORIGIN}/#/rentals`]);
});

test("chosen by type, Comprehensive: every type covered, more pages of the big types, and all of them in the covered list", () => {
    const record = chosenByType(COMPREHENSIVE);
    assert.equal(record.runType, "comprehensive");
    assert.equal(record.cap, 12);
    assert.equal(record.covered.length, 9);
    assert.equal(record.skipped.length, 0);
    assert.deepEqual(record.covered.find((entry) => entry.pattern === "/#/product/:id")!.covered, [`${ORIGIN}/#/product/2`, `${ORIGIN}/#/product/1`, `${ORIGIN}/#/product/3`]);
    assert.equal(coveredPageUrls(record).length, 12);
    assert.deepEqual(skippedPageUrls(record), []);
    assert.equal(describePageTypeSelection(record), "Pages chosen by page type: one page of every type first, then more pages of the biggest types, up to 12 pages.");
});

test("chosen by hand: an override, recorded - a type added, a page left out, and each skipped type says whether the type selection would have covered it", () => {
    const typePages = chosenByType(STANDARD).covered.flatMap((entry) => entry.covered).map((url) => url.slice(ORIGIN.length));
    // The user leaves out the contact page and adds rentals, the type the cap skipped.
    const selectedPaths = [...typePages.filter((path) => path !== "/#/contact"), "/#/rentals"];
    const record = buildPageTypeCoverage({ baseUrl: ORIGIN, pages, rankedTypes: ranked, runMode: STANDARD, selectedPaths, selectedBy: "user" });
    assert.equal(record.selectedBy, "user");
    assert.deepEqual(record.override, { added: [`${ORIGIN}/#/rentals`], removed: [`${ORIGIN}/#/contact`] });
    assert.ok(record.covered.some((entry) => entry.pattern === "/#/rentals"));
    assert.deepEqual(record.skipped.map((entry) => [entry.pattern, entry.reason]), [["/#/contact", "not chosen by hand; the type selection would have covered it"]]);
    assert.equal(describePageTypeSelection(record), `Pages chosen by hand: an override of the selection by page type (added ${ORIGIN}/#/rentals; left out ${ORIGIN}/#/contact).`);
    // A second product page chosen by hand is covered with its type.
    const twoProducts = buildPageTypeCoverage({ baseUrl: ORIGIN, pages, rankedTypes: ranked, runMode: STANDARD, selectedPaths: ["/#/", "/#/product/1", "/#/product/3"], selectedBy: "user" });
    assert.deepEqual(twoProducts.covered.map((entry) => [entry.pattern, entry.covered.length]), [["/#/", 1], ["/#/product/:id", 2]]);
    assert.match(twoProducts.skipped.find((entry) => entry.pattern === "/#/rentals")!.reason!, /^not chosen by hand; the type selection would also have skipped it \(over the cap of 8 types/);
});

test("the record survives /api/run's normalizer whole; junk is dropped and nothing grows past its cap", () => {
    const record = chosenByType(STANDARD);
    const normalized = normalizeGenerationRecord({ generatedBy: "template", gates: [], pageTypes: record });
    assert.deepEqual(normalized!.pageTypes, record);
    const override = buildPageTypeCoverage({ baseUrl: ORIGIN, pages, rankedTypes: ranked, runMode: STANDARD, selectedPaths: ["/#/"], selectedBy: "user" });
    assert.deepEqual(normalizeGenerationRecord({ generatedBy: "template", gates: [], pageTypes: override })!.pageTypes, override);
    // Untrusted: an unknown selector or run type drops the record; malformed entries drop alone.
    assert.equal(normalizeGenerationRecord({ generatedBy: "template", gates: [], pageTypes: { ...record, selectedBy: "robot" } })!.pageTypes, undefined);
    assert.equal(normalizeGenerationRecord({ generatedBy: "template", gates: [], pageTypes: { ...record, runType: "x" } })!.pageTypes, undefined);
    const messy = normalizeGenerationRecord({ generatedBy: "template", gates: [], pageTypes: { ...record, covered: [...record.covered, { pattern: "/x", label: "other", pages: 0, url: "u", covered: ["u"] }, "junk"] } });
    assert.equal(messy!.pageTypes!.covered.length, 8);
    const huge = normalizeGenerationRecord({ generatedBy: "template", gates: [], pageTypes: { ...record, skipped: Array.from({ length: 500 }, (_, i) => ({ pattern: `/p${i}`, label: "content", pages: 1, url: `${ORIGIN}/p${i}`, covered: [] })) } });
    assert.equal(huge!.pageTypes!.skipped.length, 100);
    // A run that inspected 8 pages records all 8, not the first 5 (TFP-172's reach).
    const inspected = normalizeGenerationRecord({ generatedBy: "template", gates: [], pageInspection: { status: "inspected", paths: Array.from({ length: 8 }, (_, i) => `/p${i}`), pages: 8, warnings: [] } });
    assert.equal(inspected!.pageInspection!.paths.length, 8);
});

const EMPTY: JsonReport = { suites: [], errors: [], stats: { duration: 0, expected: 0, unexpected: 0, flaky: 0, skipped: 0 } };

test("both HTML exports end with the page types, the covered list and the skipped list; without a crawl there is no such section", () => {
    const record: PageTypeCoverageRecord = chosenByType(STANDARD);
    const generation = { generatedBy: "template", gates: [], pageTypes: record };
    const standard = buildReportHtmlDocument(buildReport(EMPTY, ["security"], "raw", ORIGIN, null, null, generation), "run-1");
    const comprehensive = buildReportHtmlDocument(buildReport(EMPTY, ["security"], "raw", ORIGIN, null, null, generation, "", COMPREHENSIVE as never, 1), "run-2");
    for (const [name, html] of [["Standard", standard], ["Comprehensive", comprehensive]]) {
        const section = html.indexOf('id="page-types"');
        assert.ok(section > html.indexOf("raw</pre>"), `${name}: the section comes after the raw output`);
        assert.ok(html.indexOf('id="covered-urls"') > section && html.indexOf('id="skipped-urls"') > html.indexOf('id="covered-urls"'), `${name}: covered list, then skipped list`);
        // Nothing but the closing tags after the skipped list.
        assert.match(html.slice(html.indexOf('id="skipped-urls"')), /^id="skipped-urls"[^>]*>[^<]*<\/pre>\s*<\/section>\s*<\/main>/, `${name}: the export ends with the lists`);
        assert.ok(html.includes(`${ORIGIN}/#/product/2\n`) || html.includes(`${ORIGIN}/#/product/2`), `${name}: full URLs`);
        assert.match(html, /Found 9 page types\. Covered 8/);
        assert.match(html, /over the cap of 8 types: ranked 9th/);
    }
    const covered = standard.slice(standard.indexOf('id="covered-urls"'));
    assert.equal(covered.slice(covered.indexOf(">") + 1, covered.indexOf("</pre>")), coveredPageUrls(record).join("\n"), "one URL per line, ready to paste");
    assert.doesNotMatch(buildReportHtmlDocument(buildReport(EMPTY, ["security"], "raw", ORIGIN), "run-3"), /id="page-types"/);
});
