/**
 * TFP-189: the planned test count counts the tests a suite declares, not a
 * regular expression's `.test(`. TFP-167's tfGoto helper holds
 * `/#!?\//.test(url)`, so every generated suite was estimated one test too
 * high (15 planned, 14 run) and the completed-report page never opened.
 *
 * ISTQB technique: equivalence partitioning - a declaration (`test(`,
 * `test.only(`), a property access (`.test(`, `regex.test(`), a describe or
 * skip call (`test.describe(`, `test.skip(`), and a longer name ending in
 * "test" (`latest(`).
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/run/selection.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";

const { countDeclaredTests, estimateTestCount, extractDeclaredTestTitles } = await import("./selection.ts");
const { mockGenerate } = await import("../generate/mock/index.ts");
const { normalizeContentRules, normalizeTestAuditMode } = await import("../generate/normalize.ts");
const { PAGE_VISIT_HELPER } = await import("../generate/page-visits.ts");

test("a suite with the tfGoto helper is counted exactly: its .test(url) is not a test", () => {
    const suite = mockGenerate("http://127.0.0.1:3001", "Create SEO and usability coverage for the landing page.", ["seo/content", "usability"], null, normalizeContentRules(undefined), normalizeTestAuditMode("fast"));
    assert.ok(suite.includes(PAGE_VISIT_HELPER), "the suite carries the helper (TFP-167)");
    assert.equal(estimateTestCount(suite), extractDeclaredTestTitles(suite).length);
    // The helper alone declares nothing.
    assert.equal(countDeclaredTests(PAGE_VISIT_HELPER), 0);
});

test("declarations count; property accesses, describes, skips and longer names don't", () => {
    const counted = ["test('a', async () => {});", "  test (\"b\", async () => {});", "test.only('c', async () => {});", "{test('d', () => {})}"];
    for (const line of counted) assert.equal(countDeclaredTests(line), 1, line);
    const notCounted = ["if (/x/.test(url)) {}", "pattern.test(value)", "test.describe('A', () => {});", "test.skip(true, 'reason');", "latest(1);", "contest(2);", "$test(3);"];
    for (const line of notCounted) assert.equal(countDeclaredTests(line), 0, line);
    // A suite that declares nothing is estimated as 1, as before.
    assert.equal(estimateTestCount("import { test } from '@playwright/test';\n"), 1);
});
