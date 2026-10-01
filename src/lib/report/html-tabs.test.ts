/**
 * Phase 35 (TFP-138): the Standard HTML export's tabs switch. Since 9fbfab9
 * its script had neither its opening tag nor `function showTab(btn, id) {`,
 * so no tab switched and the function's body showed as page text. RPT-08
 * checked the export was available, not that its tabs worked.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/report/html-tabs.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";
import type { JsonReport } from "./types.ts";

const { buildReport } = await import("./report.ts");
const { buildReportHtmlDocument } = await import("./html.ts");

const { chromiumSkipReason } = await import("../../test-support/chromium.ts");
const needsChromium = await chromiumSkipReason();

const JSON_REPORT: JsonReport = {
    suites: [{ title: "s.spec.ts", specs: [], suites: [{ title: "Functional Coverage", specs: [{ id: "a", title: "TFFU-001: loads", tests: [{ projectName: "chromium", status: "expected", results: [{ duration: 5, retry: 0, errors: [] }] }] }] }] }],
    errors: [],
    stats: { duration: 5, expected: 1, unexpected: 0, flaky: 0, skipped: 0 },
};

test("in a real browser: every tab of an exported Standard report shows its own panel and hides the others, and no script shows as text", { skip: needsChromium }, async () => {
    const { chromium } = await import("@playwright/test");
    const html = buildReportHtmlDocument(buildReport(JSON_REPORT, ["functional"], "raw output", "https://site.test"), "run-1");
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        const pageErrors: string[] = [];
        page.on("pageerror", (error) => pageErrors.push(error.message));
        await page.setContent(html);

        const tabs = page.locator(".tab-btn");
        const panelIds = await page.locator(".tab-panel").evaluateAll((panels) => panels.map((panel) => panel.id));
        assert.deepEqual(panelIds, ["tab-summary", "tab-execution", "tab-defects", "tab-coverage", "tab-performance", "tab-usability", "tab-seo"]);
        assert.equal(await tabs.count(), panelIds.length);

        for (let i = 0; i < panelIds.length; i++) {
            await tabs.nth(i).click();
            const visible = await page.locator(".tab-panel").evaluateAll((panels) => panels.filter((panel) => getComputedStyle(panel).display !== "none").map((panel) => panel.id));
            assert.deepEqual(visible, [panelIds[i]], `after clicking tab ${i + 1}, only its panel shows`);
            assert.deepEqual(await tabs.evaluateAll((buttons) => buttons.map((button) => button.classList.contains("active"))), panelIds.map((_, j) => j === i), `tab ${i + 1} is the active one`);
        }

        const text = await page.locator("body").innerText();
        assert.doesNotMatch(text, /classList|showTab|getElementById/, "no script shows as page text");
        assert.deepEqual(pageErrors, []);
    } finally {
        await browser.close();
    }
});
