/**
 * Phase 36 (TFP-126): the local-model benchmark's per-suite quality checks.
 * A change to the gates or the category signals changes these results.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/generate/benchmark-quality.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";

const { hasCategorySignal, scoreSuite, testTitles } = await import("./benchmark-quality.ts");

const suite = (body: string) => `import { test, expect } from '@playwright/test';\ntest.describe('Area', () => {\n${body}\n});\n`;

test("testTitles: test(...) calls only, any quote style; not describe, skip or use", () => {
    const code = suite(`  test.use({ viewport: { width: 1, height: 1 } });
  test('one', async ({ page }) => { test.skip(true, 'x'); });
  test("two", async () => {});
  test(\`three\`, async () => {});
  latest('not a test', () => {});`);
    assert.deepEqual(testTitles(code), ["one", "two", "three"]);
});

test("scoreSuite: a clean suite passes both gates, counts its tests and finds no leak or duplicate", () => {
    const q = scoreSuite("functional", suite(`  test('clicks', async ({ page }) => {
    await page.goto('http://127.0.0.1:4410/login');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/login/);
  });`));
    assert.deepEqual(q, { typeErrors: 0, unawaitedAssertions: 0, gatesPassed: true, tests: 1, categorySignal: true, leakedExampleData: false, duplicateTitles: [] });
});

test("scoreSuite: an invented API fails the type gate; an unawaited web-first assertion fails the other", () => {
    const invented = scoreSuite("accessibility", suite(`  test('a', async ({ page }) => { await expect(page).toBeAccessible(); });`));
    assert.ok(invented.typeErrors > 0);
    assert.equal(invented.gatesPassed, false);

    const unawaited = scoreSuite("functional", suite(`  test('a', async ({ page }) => { expect(page.locator('h1')).toBeVisible(); });`));
    assert.equal(unawaited.typeErrors, 0);
    assert.equal(unawaited.unawaitedAssertions, 1);
    assert.equal(unawaited.gatesPassed, false);
});

test("scoreSuite: leaked worked-example data and duplicate titles are caught", () => {
    const q = scoreSuite("functional", suite(`  test('same', async ({ page }) => { await page.goto('https://example.invalid/EXAMPLE-ONLY'); });
  test('same', async ({ page }) => { await page.goto('/'); });`));
    assert.equal(q.leakedExampleData, true);
    assert.deepEqual(q.duplicateTitles, ["same"]);
    assert.equal(q.tests, 2);
});

test("scoreSuite: a file with no test(...) at all has zero tests", () => {
    assert.equal(scoreSuite("functional", suite("  // nothing here")).tests, 0);
});

const SIGNAL_CASES: Array<[Parameters<typeof hasCategorySignal>[0], string, string]> = [
    ["performance/load", "const start = Date.now(); await page.goto('/'); expect(Date.now() - start).toBeLessThan(3000);", "await page.goto('/'); await expect(page.locator('h1')).toBeVisible();"],
    ["seo/content", "await expect(page).toHaveTitle(/Acme/); const d = await page.locator('meta[name=\"description\"]').getAttribute('content');", "await expect(page).toHaveTitle(/Acme/);"],
    ["database", "await page.getByLabel('Note').fill(value); await page.getByRole('button').click(); await page.reload();", "await page.getByLabel('Note').fill(value); await page.getByRole('button').click();"],
    ["security", "page.on('dialog', () => { fired = true; }); await page.getByLabel('Note').fill('<script>alert(1)</script>');", "await page.getByLabel('Note').fill('hello');"],
    ["security", "expect(new URL(page.url()).protocol).toBe('https:');", "expect(page.url()).toContain('/login');"],
    ["reliability", "await page.route('**/api/status', (route) => route.abort());", "await page.goto('/'); await expect(page.locator('main')).toBeVisible();"],
    ["accessibility", "await expect(page.getByLabel('Email')).toBeVisible();", "await expect(page.locator('#email')).toBeVisible();"],
    ["functional", "await page.getByRole('button').click();", "await expect(page.locator('h1')).toBeVisible();"],
];

test("hasCategorySignal: each area's trait is present in a suite that has it and absent in one that doesn't", () => {
    for (const [area, withIt, without] of SIGNAL_CASES) {
        assert.equal(hasCategorySignal(area, withIt), true, `${area} should see: ${withIt}`);
        assert.equal(hasCategorySignal(area, without), false, `${area} should not see: ${without}`);
    }
});

test("hasCategorySignal: an area with no defined trait is null, not a pass", () => {
    assert.equal(hasCategorySignal("usability", "await page.click('a');"), null);
});

const { withBaseUrl } = await import("./benchmark-quality.ts");
const { findTypeErrors } = await import("./validate.ts");

test("withBaseUrl: runs a model suite as TestForge does, with the site as the base for relative URLs", () => {
    const code = "import { test, expect } from '@playwright/test';\ntest('a', async ({ page }) => { await page.goto('/login'); });\n";
    const run = withBaseUrl(code, "http://127.0.0.1:4410");
    assert.equal(run.split("\n")[1], "test.use({ baseURL: 'http://127.0.0.1:4410' });", "right after the imports");
    assert.deepEqual(findTypeErrors(run), []);
    assert.equal(withBaseUrl("import { test } from '@playwright/test';\ntest.use({ baseURL: 'https://other.test' });\n", "http://x"), "import { test } from '@playwright/test';\ntest.use({ baseURL: 'https://other.test' });\n", "a suite with its own baseURL is left alone");
    assert.ok(withBaseUrl(code, "http://x/it's").includes("baseURL: 'http://x/it\\'s'"), "quotes escaped");
});
