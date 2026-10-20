/**
 * Phase 42 (TFP-192, Decision 3): the coverage map and its index, on the
 * comparison fixture's /types shop - generated through POST /api/generate,
 * the pages inspected in a real browser.
 *
 * ISTQB technique: equivalence partitioning over what touches an element:
 *   a test on its page that uses its locator      -> covered in context, by that test (a field, a button, a form by its record)
 *   a link checked only by a site-wide request    -> reachability only: on the gap list, saying so (TFP-201)
 *   a link on every page, checked on one of them  -> one item, covered in context (TFP-201)
 *   a link with its own check (TFP-205)           -> covered in context by it; the template now writes one for every
 *                                                    link, so the TFP-201 columns take those checks out of the suite
 *   an element whose test is gone from the suite  -> listed as touched by none, in its page type's row
 *   a flow no journey test was written for        -> listed as touched by none
 * And the index, both ways, on the in-context tier: one changed element
 * selects exactly the tests that check it (a run of just those), and every
 * element check maps to the element it checks. Gate: Phase 42 Gate A.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/report/coverage-map.test.ts
 */
import assert from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import type { ContentProfile } from "../generate/mock/types.ts";

const scratch = mkdtempSync(join(tmpdir(), "testforge-coverage-map-"));
const savedDataDir = process.env.TESTFORGE_DATA_DIR;
process.env.TESTFORGE_DATA_DIR = scratch;

const { POST } = await import("../../app/api/generate/route.ts");
const { NextRequest } = await import("next/server");
const { startRecordedFixture } = await import("../../test-support/comparison-fixture.ts");
const { chromiumSkipReason } = await import("../../test-support/chromium.ts");
const { loadSiteSuiteProfile } = await import("../site-suites/store.ts");
const { parseTestUnits } = await import("../site-suites/units.ts");
const { buildRunSelection } = await import("../run/selection.ts");
const { buildCoverageMap, testsTouching, touchedBy, untouched } = await import("./coverage-map.ts");
const { buildCoverageMapHtmlSection } = await import("./coverage-map-html.ts");
const { describeCoverageMap } = await import("./coverage-map-text.ts");
const needsChromium = await chromiumSkipReason();

const PATHS = ["types", "types/product/101", "types/product/102", "types/product/103", "types/category/tools", "types/category/garden", "types/account/login", "types/account/contact", "types/legal/privacy", "types/help/terms"];

let code = "";
let profile: ContentProfile | null = null;

before(async () => {
    if (needsChromium) return;
    const fixture = await startRecordedFixture();
    try {
        const response = await POST(new NextRequest(new URL("http://localhost/api/generate"), {
            method: "POST",
            body: JSON.stringify({ baseUrl: fixture.origin, description: "Check the shop.", selectedPractices: ["functional", "accessibility", "seo"], contentRules: { paths: PATHS } }),
            headers: { "content-type": "application/json" },
        }));
        const body = await response.json();
        code = body.code;
        profile = await loadSiteSuiteProfile(body.siteSuite.store);
    } finally {
        await fixture.close();
    }
});

after(() => {
    if (savedDataDir === undefined) delete process.env.TESTFORGE_DATA_DIR;
    else process.env.TESTFORGE_DATA_DIR = savedDataDir;
    rmSync(scratch, { recursive: true, force: true });
});

const SUBJECT = "form element check: subject [Email] [input]";
// TFP-205: the template's own check of each link. Taken out where a case is about a link no test finds on a page.
// TFP-205's check per link, and TFP-208's per listing's cards.
const isLinkCheck = (title: string) => title.startsWith('link "') || title.startsWith("cards linking to ");
const withoutLinkChecks = (source: string) => parseTestUnits(source).filter((unit) => isLinkCheck(unit.title)).sort((a, b) => b.start - a.start).reduce((rest, unit) => rest.slice(0, unit.start) + rest.slice(unit.end), source);
const titleOf = (title: string) => {
    const unit = parseTestUnits(code).find((candidate) => candidate.title === title);
    assert.ok(unit, title);
    return `${unit.id}: ${unit.title}`;
};

test("every element check maps to the element it checks, and a form is matched by its record (TFP-192)", { skip: needsChromium }, () => {
    const map = buildCoverageMap(profile, code);
    assert.ok(map);
    const checks = parseTestUnits(code).filter((unit) => / element check: /.test(unit.title));
    assert.ok(checks.length > 10, `${checks.length} element checks`);
    for (const unit of checks) {
        assert.ok(touchedBy(map, `${unit.id}: ${unit.title}`).length > 0, `${unit.title} maps to an element`);
    }
    assert.deepEqual(touchedBy(map, titleOf(SUBJECT)).map((entry) => `${entry.page} ${entry.name}`), ["/types/account/contact subject [input]"]);
    const form = map.entries.find((entry) => entry.page === "/types/account/contact" && entry.kind === "element" && entry.name.endsWith("[form]"));
    assert.ok(form);
    assert.ok(form.tests.includes(titleOf("form element check: Email Subject Message Send [Contact] [form]")), form.tests.join(" | "));
});

test("an element no test touches is listed by name in its page type's row, and so is a flow with no journey test (TFP-192)", { skip: needsChromium }, () => {
    // The suite without its Subject check, as when that test is gone.
    const subject = parseTestUnits(code).find((unit) => unit.title === SUBJECT)!;
    const without = withoutLinkChecks(code.slice(0, subject.start) + code.slice(subject.end));
    const map = buildCoverageMap(profile, without)!;

    const account = map.types.find((type) => type.pattern === "/types/account/:slug");
    assert.ok(account);
    assert.ok(account.uncovered.includes("/types/account/contact: subject [input]"), account.uncovered.join(" | "));
    assert.equal(account.covered, account.total - account.uncovered.length);
    assert.ok(untouched(map).some((entry) => entry.kind === "element" && entry.name === "subject [input]"));
    // No journey was selected, so every flow the inspection found is touched by none.
    const flows = map.entries.filter((entry) => entry.kind === "flow");
    assert.ok(flows.length > 0);
    assert.ok(flows.every((entry) => entry.tests.length === 0 && untouched(map).includes(entry)));
    // With the Subject check, every element of the contact type is checked; its gaps are flows and links only reached by URL (TFP-201).
    const full = buildCoverageMap(profile, code)!;
    assert.deepEqual(full.types.find((type) => type.pattern === "/types/account/:slug")!.uncovered.filter((item) => !item.includes(": journey ") && !item.includes(" [link] (its URL is requested")), []);

    const untouchedCount = map.total - map.covered - map.reachedOnly!;
    assert.equal(describeCoverageMap(map), `${map.covered} of the ${map.total} elements, links and flows the inspection found are checked in context by a test; ${map.reachedOnly} more are only reached (a link's URL requested, the link not checked on a page), and ${untouchedCount} are touched by no test. Links are counted once each: ${map.links!.distinct} distinct links, found ${map.links!.onPages} times across the pages.`);
    const html = buildCoverageMapHtmlSection(map);
    assert.match(html, /<h2[^>]*>Coverage map<\/h2>/);
    assert.ok(html.includes("/types/account/contact: subject [input]"));
});

test("the index selects the tests for one changed element: a run of just those (TFP-192)", { skip: needsChromium }, () => {
    const map = buildCoverageMap(profile, code)!;
    const subject = map.entries.find((entry) => entry.page === "/types/account/contact" && entry.name === "subject [input]")!;
    const selected = testsTouching(map, subject.key);
    assert.deepEqual(selected, [titleOf(SUBJECT)]);
    assert.equal(buildRunSelection(code, [], selected).runnableTestCount, 1);

    // A link: the checks that find it on a page - on every page it is on - and not the site-wide request (TFP-201).
    const link = map.entries.find((entry) => entry.kind === "link" && entry.name === "/types/product/101 [link]")!;
    const linkTests = testsTouching(map, link.key);
    const onPages = parseTestUnits(code).filter((unit) => unit.paths.length === 1 && (unit.title === "navigation link health: /types/product/101" || unit.title.startsWith('link "/types/product/101" on ') || unit.title.startsWith("cards linking to /types/product/:id on "))).map((unit) => `${unit.id}: ${unit.title}`);
    assert.ok(onPages.length > 1);
    assert.deepEqual([...linkTests].sort(), [...onPages].sort());
    assert.ok(link.reachedBy!.some((title) => title.endsWith("link health: internal, external, and download links do not return broken responses")), link.reachedBy!.join(" | "));
    assert.equal(buildRunSelection(code, [], linkTests).runnableTestCount, linkTests.length);
});

test("a link checked only by a site-wide request is reachability-covered and on the gap list (TFP-201); its own check covers it in context (TFP-205)", { skip: needsChromium }, () => {
    // TFP-205: with the template's link checks, the privacy link is checked on its page.
    const withChecks = buildCoverageMap(profile, code)!.entries.find((entry) => entry.kind === "link" && entry.name === "/types/legal/privacy [link]")!;
    assert.ok(withChecks.tests.some((title) => isLinkCheck(title.replace(/^TF[A-Z]+-\d+: /, ""))), withChecks.tests.join(" | "));
    assert.ok(!untouched(buildCoverageMap(profile, code)!).some((entry) => entry.kind === "link"), "no link is left on the gap list");
    // Without them, as before TFP-205: reached by a site-wide request only.
    const map = buildCoverageMap(profile, withoutLinkChecks(code))!;
    const privacy = map.entries.find((entry) => entry.kind === "link" && entry.name === "/types/legal/privacy [link]")!;
    assert.ok(privacy);
    assert.deepEqual(privacy.tests, [], "no test finds it on a page");
    assert.ok(privacy.reachedBy!.length > 0, "a site-wide check requests its URL");
    assert.ok(untouched(map).includes(privacy));
    const terms = map.types.find((type) => type.pattern === "/types/help/terms")!;
    assert.ok(terms.uncovered.some((item) => item.endsWith("/types/legal/privacy [link] (its URL is requested, but it isn't checked on a page)")), terms.uncovered.join(" | "));
    assert.ok(terms.reachedOnly! > 0);
    assert.ok(map.reachedOnly! >= terms.reachedOnly!);
});

test("a link on every page, checked on one of them, is one item covered in context (TFP-201)", { skip: needsChromium }, () => {
    // Keep the check of /types/product/101's link on the terms page alone; take it off every other page.
    // Positions from the suite they are cut from: since Phase 39 (TFP-212) a page's link checks sit among its other
    // shared checks, so removing them moves what follows.
    let fewer = withoutLinkChecks(code);
    const checks = parseTestUnits(fewer).filter((unit) => unit.title === "navigation link health: /types/product/101" && unit.paths.length === 1);
    const kept = checks.find((unit) => unit.paths[0] === "/types/help/terms")!;
    assert.ok(kept && checks.length >= 3, `${checks.length} pages check it`);
    for (const unit of [...checks].filter((unit) => unit !== kept).sort((a, b) => b.start - a.start)) fewer = fewer.slice(0, unit.start) + fewer.slice(unit.end);
    const map = buildCoverageMap(profile, fewer)!;

    const items = map.entries.filter((entry) => entry.kind === "link" && entry.name === "/types/product/101 [link]");
    assert.equal(items.length, 1, "one item, however many pages it is on");
    assert.ok(items[0].pages!.length >= 3, items[0].pages!.join(", "));
    assert.deepEqual(items[0].tests, [`${kept.id}: ${kept.title}`]);
    assert.ok(!untouched(map).includes(items[0]));
    assert.ok(map.links!.distinct < map.links!.onPages, `${map.links!.distinct} distinct of ${map.links!.onPages}`);
    assert.equal(map.links!.distinct, map.entries.filter((entry) => entry.kind === "link").length);
});

test("no page data or no suite source: no map", () => {
    assert.equal(buildCoverageMap(null, "test('x', async () => {});"), null);
    assert.equal(buildCoverageMap({ pages: [] } as unknown as ContentProfile, "test('x', async () => {});"), null);
});
