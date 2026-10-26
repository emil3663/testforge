/**
 * TFP-167: every page visit in a generated test waits for the page to draw
 * (network quiet, at most 5 s, never failing the test for the wait;
 * owner decision, 2026-10-06).
 *
 * ISTQB technique: equivalence partitioning over when a page's content
 * exists - in the HTML (every fixture page before this one), drawn after a
 * slow request (the fixture's /late-form, 1.5 s), and drawn by a hash route
 * (TFP-165's /spa) - plus the rewrite itself: every page.goto routed through
 * the helper, nothing else touched.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/generate/page-visits.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";
import type { ExecutionRecord } from "../report/types.ts";

const { routePageVisits, PAGE_VISIT_HELPER } = await import("./page-visits.ts");
const { mockGenerate } = await import("./mock/index.ts");
const { normalizeContentRules, normalizeTestAuditMode } = await import("./normalize.ts");
const { buildComprehensiveSuite } = await import("./comprehensive.ts");
const { normalizeRunMode } = await import("../comprehensive/run-mode.ts");
const { findTypeErrors } = await import("./validate.ts");
const { inspectPages } = await import("../introspect/inspector.ts");
const { flattenSuites } = await import("../report/execution.ts");
const { startRecordedFixture } = await import("../../test-support/comparison-fixture.ts");
const { chromiumSkipReason } = await import("../../test-support/chromium.ts");
const { runPlaywrightSpec } = await import("../../test-support/playwright-cli.ts");
const needsChromium = await chromiumSkipReason();

test("every page.goto in a suite goes through the helper, added once after test.use; other code is untouched", () => {
    const suite = "import { test, expect } from '@playwright/test';\ntest.use({ baseURL: 'http://x.test' });\ntest.describe('A', () => {\n  test('a', async ({ page }) => {\n    const response = await page.goto('/', { waitUntil: 'load' });\n    await view.goto('/x');\n  });\n  test('b', async ({ page }) => { await page.goto('/#/contact'); });\n});\n";
    const routed = routePageVisits(suite);
    assert.match(routed, /const response = await tfGoto\(page, '\/', \{ waitUntil: 'load' \}\);/);
    assert.match(routed, /await tfGoto\(page, '\/#\/contact'\);/);
    assert.match(routed, /await view\.goto\('\/x'\);/, "only page.goto");
    assert.equal(routed.split(PAGE_VISIT_HELPER).length, 2, "the helper once");
    assert.ok(routed.indexOf(PAGE_VISIT_HELPER) > routed.indexOf("test.use("), "after test.use");
    assert.equal(routePageVisits("const x = 1;\n"), "const x = 1;\n", "a suite with no visits is unchanged");
    // Idempotent: a second pass changes nothing, so the helper's own page.goto is never turned into a call to itself.
    assert.equal(routePageVisits(routed), routed);
    assert.equal(routePageVisits(routed).split("async function tfGoto(").length, 2, "the helper once");
    assert.match(routePageVisits(routed), /const response = await page\.goto\(url, options\);/, "the helper still calls page.goto");
    // The helper's own goto calls stay page.goto, and the suite type-checks.
    assert.deepEqual(findTypeErrors(routed.replace("await view.goto('/x');", "")), []);
});

async function runSuite(code: string, label: string): Promise<ExecutionRecord[]> {
    const { report } = await runPlaywrightSpec(code, `page-visits-unit-${label}`, ["--workers=1"], { TESTFORGE_INTERACTIVE: "0" });
    return flattenSuites(report.suites);
}

test("in a real browser: on a page that draws its form after a slow request, the form and name checks see the drawn page and pass", { skip: needsChromium }, async () => {
    const fixture = await startRecordedFixture();
    try {
        // Inspection waits (TFP-165), so it records the late form and button.
        const inspection = await inspectPages(fixture.origin, ["/late-form"]);
        const elements = inspection.pages[0].actionableElements ?? [];
        const recorded = elements.map((element: { elementType: string; text: string }) => `${element.elementType}:${element.text}`);
        // The drawn form, not "Loading...": its labels' text, and the fields it holds (TFP-160's record).
        assert.ok(recorded.includes("form:TitleTag"), JSON.stringify(recorded));
        const form = elements.find((element: { elementType: string }) => element.elementType === "form");
        assert.deepEqual(form?.form?.fields.map((field: { tag: string; type: string; name: string }) => `${field.tag}${field.type ? `[${field.type}]` : ""}:${field.name}`), ["input:title", "input:tag", "input[submit]:"]);
        assert.ok(recorded.includes("button:Save draft"), JSON.stringify(recorded));

        const profile = { scannedAt: new Date().toISOString(), baseUrl: fixture.origin, ...inspection };
        // The base URL is the page under test, so the name checks are generated for it (accessibilityPath).
        const code: string = mockGenerate(`${fixture.origin}/late-form`, "Check the site.", ["functional", "accessibility"], profile as never, normalizeContentRules(undefined), normalizeTestAuditMode("fast"));
        assert.deepEqual(findTypeErrors(code), []);
        assert.doesNotMatch(code, /\bpage\.goto\('\/late-form'/, "every visit goes through tfGoto");

        const records = await runSuite(code, "late-form");
        const one = (title: RegExp) => {
            const found = records.filter((record) => title.test(record.title));
            assert.equal(found.length, 1, `${title}: ${records.map((record) => `${record.title} ${record.status}`).join(" | ")}`);
            return found[0];
        };
        const status = (record: ExecutionRecord) => `${record.status} ${record.rawMessage.split("\n")[0]}`;
        const formCheck = one(/form element check: .*\[form\]$/);
        assert.equal(formCheck.status, "Passed", status(formCheck));
        const formName = one(/accessible name and role: .*\[form\]$/);
        assert.equal(formName.status, "Passed", status(formName));
        const buttonName = one(/accessible name and role: Save draft \[button\]$/);
        assert.equal(buttonName.status, "Passed", status(buttonName));
        const scan = one(/\/late-form passes the WCAG 2\.2 A and AA scan/);
        assert.equal(scan.status, "Passed", status(scan));

        // Comprehensive suites route their visits too.
        const comprehensive = buildComprehensiveSuite(fixture.origin, normalizeRunMode({ kind: "comprehensive", area: "accessibility" }) as never, { covered: ["/late-form"], notCovered: [], pageCap: 20 });
        // Since TFP-214 every accessibility check shares its page's visit, which the shared-visit helper loads by tfGoto.
        assert.match(comprehensive, /tfShared\.visit\('\/late-form'\)/);
        assert.match(comprehensive, /const response = await tfGoto\(page, path\);/);
        assert.doesNotMatch(comprehensive, /\bpage\.goto\('\/late-form'/);
        assert.deepEqual(findTypeErrors(comprehensive), []);
    } finally {
        await fixture.close();
    }
});

test("in a real browser: a hash route that draws late (/spa#/contact) is read after it draws: its form check finds the form", { skip: needsChromium }, async () => {
    const fixture = await startRecordedFixture();
    try {
        const inspection = await inspectPages(fixture.origin, ["/spa#/contact"]);
        const form = (inspection.pages[0].actionableElements ?? []).find((element: { elementType: string }) => element.elementType === "form");
        assert.ok(form, "inspection read the drawn route");
        const profile = { scannedAt: new Date().toISOString(), baseUrl: fixture.origin, ...inspection };
        const code: string = mockGenerate(fixture.origin, "Check the site.", ["functional"], profile as never, normalizeContentRules(undefined), normalizeTestAuditMode("fast"));
        assert.deepEqual(findTypeErrors(code), []);
        assert.match(code, /tfGoto\(page, '\/spa#\/contact'\)/, "the route visit goes through tfGoto");

        const records = await runSuite(code, "spa-contact");
        // TFP-160's form lookup reads the page once: at load it would see "Loading..." and no form.
        const formCheck = records.filter((record) => /form element check: .*\[form\]$/.test(record.title));
        assert.equal(formCheck.length, 1, records.map((record) => record.title).join(" | "));
        assert.equal(formCheck[0].status, "Passed", formCheck[0].rawMessage.split("\n")[0]);
    } finally {
        await fixture.close();
    }
});

// TFP-168: the local model's gap-fill block, the Comprehensive scenario block and an OpenAI suite route their visits too.
test("model and OpenAI page visits go through tfGoto: no raw page.goto outside the helper's own body, the helper once, and each suite type-checks", async () => {
    const { mergeLocalSuite, gateOpenAiSuite } = await import("./gap-fill.ts");
    const { mergeComprehensiveScenarios } = await import("./comprehensive.ts");
    /** Every page.goto outside the helper's own body. */
    const rawVisits = (code: string) => code.replace(PAGE_VISIT_HELPER, "").match(/\bpage\.goto\(/g) ?? [];
    const modelCode = "import { test, expect } from '@playwright/test';\ntest('the model visits a page', async ({ page }) => {\n  await page.goto('/notes');\n  await expect(page.locator('h1')).toBeVisible();\n});\n";

    const template = mockGenerate("http://x.test", "Check the site.", ["functional"], null, normalizeContentRules(undefined), normalizeTestAuditMode("fast"));
    assert.ok(template.includes(PAGE_VISIT_HELPER), "the template suite has the helper (TFP-167)");
    const merged = mergeLocalSuite(template, modelCode, "testforge-qwen7b", ["database"]);
    assert.deepEqual(rawVisits(merged), [], "gap-fill: no raw page.goto");
    assert.match(merged, /await tfGoto\(page, '\/notes'\);/);
    assert.equal(merged.split("async function tfGoto(").length, 2, "gap-fill: the helper once");
    assert.deepEqual(findTypeErrors(merged), []);

    const mode = normalizeRunMode({ kind: "comprehensive", area: "accessibility" }) as Parameters<typeof mergeComprehensiveScenarios>[3];
    const suite = buildComprehensiveSuite("http://x.test", mode, { covered: ["/"], notCovered: [], pageCap: 20 });
    const scenarios = mergeComprehensiveScenarios(suite, modelCode, "testforge-qwen7b", mode);
    assert.deepEqual(rawVisits(scenarios), [], "scenarios: no raw page.goto");
    assert.equal(scenarios.split("async function tfGoto(").length, 2, "scenarios: the helper once");
    assert.deepEqual(findTypeErrors(scenarios), []);

    // OpenAI writes the whole suite, with imports of its own shape: the helper goes after them.
    const openAi = gateOpenAiSuite('import { test, expect, type Page } from "@playwright/test";\n\ntest("opens the notes", async ({ page }) => {\n  await page.goto("/notes");\n});\n', "gpt-5");
    assert.deepEqual(rawVisits(openAi), [], "OpenAI: no raw page.goto");
    assert.equal(openAi.split("async function tfGoto(").length, 2, "OpenAI: the helper once");
    assert.ok(openAi.indexOf("async function tfGoto(") > openAi.indexOf('from "@playwright/test"'), "after the imports");
    assert.deepEqual(findTypeErrors(openAi), []);
});
