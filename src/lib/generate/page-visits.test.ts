/**
 * TFP-167: every page visit in a generated test waits for the page to draw
 * (network quiet, at most 5 s, never failing the test for the wait),
 * approved by Emil, 2026-10-06.
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
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import type { ExecutionRecord, JsonReport } from "../report/types.ts";

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
    // The helper's own goto calls stay page.goto, and the suite type-checks.
    assert.deepEqual(findTypeErrors(routed.replace("await view.goto('/x');", "")), []);
});

async function runSuite(code: string, label: string): Promise<ExecutionRecord[]> {
    const dir = join(process.cwd(), ".playwright-runs");
    await mkdir(dir, { recursive: true });
    const name = `page-visits-unit-${label}-${process.pid}-${Date.now()}`;
    const specFile = join(dir, `${name}.spec.ts`);
    const jsonFile = join(dir, `${name}.json`);
    await writeFile(specFile, code, "utf8");
    try {
        await new Promise<void>((resolve, reject) => {
            const child = spawn(process.execPath, [join(process.cwd(), "node_modules", "playwright", "cli.js"), "test", `.playwright-runs/${name}.spec.ts`, "--reporter=json", "--project=chromium", "--workers=1"], {
                cwd: process.cwd(),
                env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: jsonFile, FORCE_COLOR: "0", TESTFORGE_INTERACTIVE: "0" },
                stdio: "ignore",
                windowsHide: true,
            });
            child.on("error", reject);
            child.on("close", () => resolve());
        });
        return flattenSuites((JSON.parse(await readFile(jsonFile, "utf8")) as JsonReport).suites ?? []);
    } finally {
        await rm(specFile, { force: true });
        await rm(jsonFile, { force: true });
    }
}

test("in a real browser: on a page that draws its form after a slow request, the form and name checks see the drawn page and pass", { skip: needsChromium }, async () => {
    const fixture = await startRecordedFixture();
    try {
        // Inspection waits (TFP-165), so it records the late form and button.
        const inspection = await inspectPages(fixture.origin, ["/late-form"]);
        const recorded = (inspection.pages[0].actionableElements ?? []).map((element: { elementType: string; text: string }) => `${element.elementType}:${element.text}`);
        assert.ok(recorded.includes("form:TitleTagBody") || recorded.some((entry: string) => entry.startsWith("form:")), JSON.stringify(recorded));
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
        assert.match(comprehensive, /tfGoto\(page, '\/late-form'/);
        assert.deepEqual(findTypeErrors(comprehensive), []);
    } finally {
        await fixture.close();
    }
});
