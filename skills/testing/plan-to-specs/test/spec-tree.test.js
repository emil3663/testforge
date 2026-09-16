/**
 * Tests for reading the spec tree back.
 *
 * The property that matters: an implemented test is never mistaken for
 * disposable scaffolding. In cah-pwa, two real suites were sitting in files
 * named `.spec.js`, and a name-based tidy-up would have deleted them.
 *
 * Ported from generator-improvements's scripts/test/spec-tree.test.js,
 * unchanged apart from the added case-ID-override test at the bottom.
 *
 * Run: node --test test/
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { isImplemented, coveredCaseIds } = require('../lib/spec-tree');

const SCAFFOLD = `
test.describe('x', () => {
  test('LG-01: Create account', async ({ page }) => {
    test.skip(true, 'Not yet implemented — LG-01');
  });
});
`;

const IMPLEMENTED = `
test.describe('3-1 Auth', () => {
  test('LG-18: Local regression account sign-in', async ({ page }) => {
    await expect(page.locator('#screen-menu')).toBeVisible();
  });
  test('LG-19: Build tag visibility', async ({ page }) => {
    await expect(page.locator('#buildTag')).not.toBeEmpty();
  });
});
`;

test('a scaffold is recognised as unimplemented', () => {
  assert.equal(isImplemented(SCAFFOLD), false);
});

test('a real test is recognised as implemented', () => {
  assert.equal(isImplemented(IMPLEMENTED), true);
});

test('coverage is read from test titles, not the filename', () => {
  assert.deepEqual([...coveredCaseIds(IMPLEMENTED)], ['LG-18', 'LG-19']);
});

test('one file may cover several cases', () => {
  assert.equal(coveredCaseIds(IMPLEMENTED).size, 2,
    'a multi-case implementation must report every case it covers');
});

test('a caller can override the case-ID shape for a different scheme', () => {
  // REQ_001 - underscore-separated, unlike cah-pwa's own hyphenated scheme -
  // so the default pattern genuinely cannot match it, not just a near miss.
  const reqImplemented = `
test.describe('Requirements', () => {
  test('REQ_001: Multi-display fix', async () => {
    assert.ok(true);
  });
});
`;
  assert.deepEqual([...coveredCaseIds(reqImplemented, '[A-Z]+_\\d{3}')], ['REQ_001']);
  assert.deepEqual([...coveredCaseIds(reqImplemented)], [],
    'the default cah-pwa-shaped (hyphenated) pattern should not match an underscore-separated id');
});
