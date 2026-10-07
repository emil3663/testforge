/**
 * Phase 34 (TFP-118): Option B's gap detection and merge.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/generate/gap-fill.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";

const { findGapAreas, mergeLocalSuite, localModelSuiteTitle } = await import("./gap-fill.ts");
const { findTypeErrors } = await import("./validate.ts");

const TEMPLATE = "import { test, expect } from '@playwright/test';\ntest.use({ baseURL: 'http://x.test' });\ntest.describe('Functional Coverage', () => {\n  test('TFFU-001: loads', async ({ page }) => { await page.goto('/'); });\n});";

test("findGapAreas: in-scope areas with zero template tests, reliability never included", () => {
    assert.deepEqual(
        findGapAreas(["functional", "database", "reliability", "security"], { functional: 3, database: 0, reliability: 0, security: 2 }),
        ["database"]
    );
    assert.deepEqual(findGapAreas(["functional"], { functional: 1 }), []);
    assert.deepEqual(findGapAreas(["accessibility"], {}), ["accessibility"], "an area missing from the counts wrote nothing");
});

test("mergeLocalSuite: template kept whole; every @playwright/test import form dropped; one gap area gets its own block", () => {
    const local = [
        'import { test, expect } from "@playwright/test";',
        "import {test} from '@playwright/test'",
        "test.describe('Database', () => {",
        "  test('x', async ({ page }) => { await page.goto('/'); await expect(page.locator('body')).toBeVisible(); });",
        "});",
    ].join("\n");
    const merged = mergeLocalSuite(TEMPLATE, local, "testforge-qwen7b:latest", ["database"]);
    assert.ok(merged.startsWith(TEMPLATE));
    // Import statements, not mentions: since TFP-168 the model's page.goto adds tfGoto, whose type names @playwright/test.
    assert.equal((merged.match(/^\s*import\b[^\n]*@playwright\/test/gm) ?? []).length, 1, "only the template's import remains");
    assert.match(merged, /await tfGoto\(page, '\/'\)/, "the model's visit goes through tfGoto (TFP-168)");
    assert.match(merged, /test\.describe\('Local model \(testforge-qwen7b:latest\)', \{ annotation: \{ type: 'gate', description: 'interactive' \} \}, \(\) => \{\n    test\.skip\([^\n]+\);\n\n    test\.describe\('Database Coverage', \(\) => \{\n        test\.describe\('Database'/);
    assert.deepEqual(findTypeErrors(merged), []);
});

test("mergeLocalSuite: several gap areas are not forced under one area block", () => {
    const local = "test.describe('Security', () => {});\ntest.describe('Database', () => {});";
    const merged = mergeLocalSuite(TEMPLATE, local, "m", ["security", "database"]);
    assert.doesNotMatch(merged, /Security Coverage|Database Coverage/);
    assert.match(merged, /test\.describe\('Local model \(m\)', \{ annotation: \{ type: 'gate', description: 'interactive' \} \}, \(\) => \{\n    test\.skip\([^\n]+\);\n\n    test\.describe\('Security'/);
    assert.match(merged, /for the selected areas the template\n\/\/ generator left without tests: security, database/);
});

test("localModelSuiteTitle: the prefix the run report recognises", () => {
    assert.equal(localModelSuiteTitle("testforge-qwen7b:latest"), "Local model (testforge-qwen7b:latest)");
});

// --- GEN-43 (amended Decision 6) ---------------------------------------------

test("findGapAreas: an area the template inspected and found nothing to test in is not a gap", () => {
    const noForm = "Database: no form that saves visible text was found on the inspected pages";
    assert.deepEqual(findGapAreas(["database", "security"], { database: 0, security: 0 }, { database: noForm }), ["security"]);
});

test("mergeLocalSuite: the whole local block skips unless interactive tests are on, with a stated reason", () => {
    const merged = mergeLocalSuite(TEMPLATE, "test('x', async () => {});", "testforge-qwen7b:latest", ["database"]);
    const wrapper = merged.slice(merged.indexOf("test.describe('Local model"));
    const firstStatement = wrapper.split("\n")[1].trim();
    assert.equal(
        firstStatement,
        "test.skip(process.env.TESTFORGE_INTERACTIVE !== '1', 'gap-fill test written by the local model (testforge-qwen7b:latest): it may submit forms on the live site, so it only runs when TESTFORGE_INTERACTIVE=1 is set for the run');"
    );
    assert.ok(!TEMPLATE.includes("test.skip"), "the template's own tests are not touched by it");
    assert.deepEqual(findTypeErrors(merged), []);
});
