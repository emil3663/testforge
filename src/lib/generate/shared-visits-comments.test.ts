/**
 * TFP-269: the shared-visit pass moves a describe's helper declarations to the top of the suite; the comments written
 * directly before a declaration move with it, and only those. A helper declared in several describes is written once,
 * in the place of its first copy, with the comments of the first copy that has any.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/generate/shared-visits-comments.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";

const { shareReadOnlyVisits, SHARED_VISIT_HELPER } = await import("./shared-visits.ts");
const { PAGE_VISIT_HELPER } = await import("./page-visits.ts");

test("a moved declaration keeps the comments directly before it, not a note a blank line away; one written for many copies keeps the comments of the first that has them", () => {
    const describe = (area: string, before: string) => `test.describe('${area}', () => {
${before}  function tfHelper(text: string) { return text.trim(); }

  test('${area}: reads', { annotation: { type: 'gate', description: 'read-only' } }, async ({ page }) => {
    await tfGoto(page, '/a');
    await expect(page.locator('h1')).toHaveText(tfHelper(' A '));
  });
});`;
    const suite = `import { test, expect } from '@playwright/test';

test.use({ baseURL: 'http://site.test' });

${PAGE_VISIT_HELPER}

${describe("Area A", "  // AREA NOTE: what this area couldn't test.\n\n")}

${describe("Area B", "  // B: trims a heading's text.\n  // B: second line.\n")}

${describe("Area C", "  // C: a different comment.\n")}
`;
    const shared = shareReadOnlyVisits(suite);
    const top = shared.slice(shared.indexOf(SHARED_VISIT_HELPER), shared.indexOf("test.describe("));

    assert.strictEqual((top.match(/function tfHelper\(/g) ?? []).length, 1, top);
    assert.ok(top.includes("// B: trims a heading's text.\n// B: second line.\nfunction tfHelper("), top);
    assert.ok(!top.includes("AREA NOTE"), `a note a blank line above isn't the declaration's: ${top}`);
    assert.ok(!top.includes("// C:"), top);
});
