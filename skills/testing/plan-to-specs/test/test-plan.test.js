/**
 * Tests for the generator's parser.
 *
 * The generator is the most leveraged code a repo using this pattern has -
 * it produces the whole spec tree - and until generator-improvements
 * (cah-pwa, commit 78e30de) nothing tested it. The bug it fixed shipped 35
 * junk files into that repo and hid two real test suites; a single
 * assertion would have caught it.
 *
 * Ported from that branch's scripts/test/test-plan.test.js. The final test
 * there read cah-pwa's own real TEST_PLAN.md directly - not portable, since
 * this repo doesn't have one. Replaced here with a synthetic plan built the
 * same shape (many sections, each with a header and separator row) so the
 * regression it guards against - a large, real-shaped plan producing junk
 * IDs - is still covered without a hardcoded path to another repo.
 *
 * Run: node --test test/
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { parseTestPlan, DEFAULT_CASE_ID_CORE } = require('../lib/test-plan');

const PLAN = `
## 3-1 Authentication

| ID | Test | Expected Result | Status |
|----|------|-----------------|--------|
| LG-01 | Create account | Account created and menu shown | ⬜ |
| LG-02 | Sign in | Profile loads | ✅ |

## 3-2 Rooms

| ID | Test | Expected Result | Status |
|----|------|-----------------|--------|
| RM-01 | Create room | 6-char code displayed | ⬜ |
`;

test('a markdown header row is not a test case', () => {
  const ids = parseTestPlan(PLAN).map((c) => c.id);
  assert.ok(!ids.includes('ID'), 'the literal header "| ID | Test |" was parsed as a case');
});

test('a markdown separator row is not a test case', () => {
  const ids = parseTestPlan(PLAN).map((c) => c.id);
  assert.ok(!ids.some((id) => /^-+$/.test(id)), 'a separator row was parsed as a case');
  assert.ok(!ids.includes(''), 'an empty id was produced — this is what named files ".spec.js"');
});

test('parses exactly the real cases', () => {
  assert.deepEqual(parseTestPlan(PLAN).map((c) => c.id), ['LG-01', 'LG-02', 'RM-01']);
});

test('captures the expected result, not just the title', () => {
  const [first] = parseTestPlan(PLAN);
  assert.equal(first.expected, 'Account created and menu shown');
});

test('assigns each case to the section it appears under', () => {
  const cases = parseTestPlan(PLAN);
  assert.equal(cases[0].section, '3-1-authentication');
  assert.equal(cases[2].section, '3-2-rooms');
});

test('ignores tables that are not test cases', () => {
  const other = `
## Notes

| Term | Meaning |
|------|---------|
| Czar | The judge for a round |
`;
  assert.deepEqual(parseTestPlan(other), [],
    'a glossary table was parsed as test cases');
});

test('a caller can override the case-ID shape for a different scheme', () => {
  // REQ_001 - underscore-separated, unlike cah-pwa's own hyphenated scheme -
  // so the default pattern genuinely cannot match it, not just a near miss.
  const reqPlan = `
## Requirements

| ID | Test | Expected Result | Status |
|----|------|-----------------|--------|
| REQ_001 | Multi-display fix | Second screen captured correctly | ✅ |
`;
  const cases = parseTestPlan(reqPlan, '[A-Z]+_\\d{3}');
  assert.deepEqual(cases.map((c) => c.id), ['REQ_001']);
  assert.deepEqual(parseTestPlan(reqPlan), [],
    'the default cah-pwa-shaped (hyphenated) pattern should not match an underscore-separated id');
});

test('a large, real-shaped plan (many sections, each with header and separator rows) produces no junk ids', () => {
  const sections = Array.from({ length: 30 }, (_, i) => {
    const letters = String.fromCharCode(65 + (i % 26)).repeat(2);
    return `
## Section ${i}

| ID | Test | Expected Result | Status |
|----|------|-----------------|--------|
| ${letters}-${String(i).padStart(2, '0')} | Case ${i} | Result ${i} | ⬜ |
`;
  }).join('\n');

  const cases = parseTestPlan(sections);
  assert.equal(cases.length, 30, `expected exactly the 30 real cases, got ${cases.length}`);
  const caseIdPattern = new RegExp(`^${DEFAULT_CASE_ID_CORE}$`);
  for (const c of cases) {
    assert.match(c.id, caseIdPattern, `"${c.id}" is not a case ID`);
  }
});
