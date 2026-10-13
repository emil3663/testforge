/**
 * Phase 42 (TFP-192, Decision 3): the coverage map and its index, on the
 * comparison fixture's /types shop - generated through POST /api/generate,
 * the pages inspected in a real browser.
 *
 * ISTQB technique: equivalence partitioning over what touches an element:
 *   a test on its page that uses its locator     -> covered, by that test (a field, a button, a form by its record)
 *   a link, checked on its page and by request   -> covered, by both
 *   an element whose test is gone from the suite -> listed as touched by none, in its page type's row
 *   a flow no journey test was written for       -> listed as touched by none
 * And the index, both ways: one changed element selects exactly the tests
 * that touch it (a run of just those), and every element check maps to the
 * element it checks. Gate: Phase 42 Gate A.
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
    const without = code.slice(0, subject.start) + code.slice(subject.end);
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
    // With the Subject check, the contact page's only gaps are its flows.
    const full = buildCoverageMap(profile, code)!;
    assert.deepEqual(full.types.find((type) => type.pattern === "/types/account/:slug")!.uncovered.filter((item) => !item.includes(": journey ")), []);

    assert.equal(describeCoverageMap(map), `${map.covered} of the ${map.total} elements, links and flows the inspection found are touched by a test; ${map.total - map.covered} are touched by none.`);
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

    // A link on one page: its check on that page, and the site-wide link check that requests it.
    const link = map.entries.find((entry) => entry.page === "/types/help/terms" && entry.kind === "link" && entry.name === "/types/product/101 [link]")!;
    const linkTests = testsTouching(map, link.key);
    const onPage = parseTestUnits(code).filter((unit) => unit.paths.includes("/types/help/terms") && unit.title === "navigation link health: /types/product/101").map((unit) => `${unit.id}: ${unit.title}`);
    assert.equal(onPage.length, 1);
    assert.ok(linkTests.includes(onPage[0]), linkTests.join(" | "));
    assert.ok(linkTests.some((title) => title.endsWith("link health: internal, external, and download links do not return broken responses")), linkTests.join(" | "));
    assert.equal(buildRunSelection(code, [], linkTests).runnableTestCount, linkTests.length);
});

test("no page data or no suite source: no map", () => {
    assert.equal(buildCoverageMap(null, "test('x', async () => {});"), null);
    assert.equal(buildCoverageMap({ pages: [] } as unknown as ContentProfile, "test('x', async () => {});"), null);
});
