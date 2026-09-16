#!/usr/bin/env node
/**
 * Expand a TEST_PLAN.md into a Playwright spec tree, one file per test case.
 *
 *   node generate-specs.js               write missing stubs
 *   node generate-specs.js --check       verify, write nothing
 *
 * Options (all optional, resolved relative to the current working
 * directory - run this from the repo whose plan you're expanding):
 *
 *   --plan <path>      the test plan (default: TEST_PLAN.md)
 *   --out <dir>        where generated specs go (default: tests/generated)
 *   --case-id <regex>  the case-ID shape, as a regex source string with no
 *                      anchors (default: [A-Z]{2,4}-\d{2,3}, cah-pwa's own
 *                      scheme - override it for a repo with a different one,
 *                      e.g. TA-\d{3} or [A-Z]+-\d+)
 *
 * Ported from cah-pwa's generator-improvements branch (commit 78e30de,
 * Martin Hugo + Claude Opus 5) - see SKILL.md for what changed there and
 * why, and scripts/README.md on that branch for the source's own account.
 * The one thing generalized beyond that branch: cah-pwa's version resolves
 * ROOT from `__dirname` on the assumption that this script always lives at
 * `<repo>/scripts/`; this version resolves everything from `process.cwd()`
 * plus the flags above, so the same file runs against any repo without
 * being copied into a fixed location in it first.
 *
 * --check is the mode worth having. A generator that only creates is a
 * one-way door: the plan and the spec tree drift apart silently, and the
 * drift is invisible because everything still passes. --check reports both
 * directions of drift and exits non-zero, so CI can hold the two in step.
 *
 * Existing files are never overwritten. The stubs are scaffolding; the
 * implementations are the work, and a generator that could clobber them
 * would be one nobody dared run.
 */
const fs = require('fs');
const path = require('path');
const { parseTestPlan, slug, DEFAULT_CASE_ID_CORE } = require('./lib/test-plan');
const { readSpecTree } = require('./lib/spec-tree');

function parseArgs(argv) {
  const args = {
    check: false,
    plan: 'TEST_PLAN.md',
    out: path.join('tests', 'generated'),
    caseId: DEFAULT_CASE_ID_CORE,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--check') args.check = true;
    else if (arg === '--plan') args.plan = argv[(i += 1)];
    else if (arg === '--out') args.out = argv[(i += 1)];
    else if (arg === '--case-id') args.caseId = argv[(i += 1)];
  }
  return args;
}

function specPath(testCase, outDir) {
  return path.join(outDir, testCase.section, `${slug(testCase.id)}.spec.js`);
}

/**
 * The stub for one case.
 *
 * Carries the plan's Expected Result rather than a `(fill expected result)`
 * placeholder. The plan already states it; making someone retype it is how
 * the two versions start disagreeing - and the expectation is the part of a
 * test that matters most.
 */
function renderStub({ id, title, expected, section }) {
  const escape = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return `// Generated from the test plan for ${id}. Safe to edit - the generator
// never overwrites an existing file. Remove the skip once implemented.
const { test, expect } = require('@playwright/test');

test.describe('${escape(section)}', () => {
  test('${escape(id)}: ${escape(title)}', async ({ page }) => {
    // Expected:
    //   ${expected || '(the plan states no expected result for this case)'}
    test.skip(true, 'Not yet implemented — ${escape(id)}');

    await page.goto('/');
  });
});
`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = process.cwd();
  const planPath = path.resolve(root, args.plan);
  const outDir = path.resolve(root, args.out);

  const cases = parseTestPlan(fs.readFileSync(planPath, 'utf8'), args.caseId);
  const specs = readSpecTree(outDir, args.caseId);

  // Coverage is what tests actually cover, not what files are named. An
  // implemented suite may cover several cases in one file - in cah-pwa, two
  // of them covered seventeen cases between them.
  const covered = new Set();
  for (const spec of specs) {
    if (spec.implemented) for (const id of spec.covers) covered.add(id);
  }

  const missing = cases.filter((c) => !fs.existsSync(specPath(c, outDir)));
  const scaffolds = specs.filter((s) => !s.implemented);
  const implemented = specs.filter((s) => s.implemented);

  // Only a scaffold can be an orphan. An implementation is somebody's work,
  // whatever it is called - reporting it as deletable is how real tests get
  // thrown away during a tidy-up.
  const expectedFiles = new Set(cases.map((c) => specPath(c, outDir)));
  const orphans = scaffolds.filter((s) => !expectedFiles.has(s.file));

  console.log(`${path.relative(root, planPath)} declares ${cases.length} test cases.`);
  console.log(`Spec tree: ${specs.length} files — ${implemented.length} implemented, ${scaffolds.length} scaffolds.`);
  console.log(`Cases covered by an implemented test: ${covered.size} of ${cases.length}.`);

  if (!args.check) {
    let written = 0;
    for (const testCase of missing) {
      const file = specPath(testCase, outDir);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, renderStub(testCase), 'utf8');
      written += 1;
    }
    console.log(`Wrote ${written} new stub(s).`);
    return;
  }

  let failed = false;
  if (missing.length) {
    failed = true;
    console.error(`\n${missing.length} case(s) in the plan have no spec file:`);
    for (const c of missing) console.error(`  ${c.id}  ${c.title}`);
  }
  if (orphans.length) {
    failed = true;
    console.error(`\n${orphans.length} scaffold(s) match no case in the plan:`);
    for (const s of orphans) console.error(`  ${path.relative(root, s.file)}`);
  }
  if (failed) {
    console.error('\nThe plan and the spec tree disagree. Run without --check to add');
    console.error('missing stubs; review orphans by hand before deleting any.');
    process.exit(1);
  }
  console.log('Plan and spec tree agree.');
}

if (require.main === module) main();
module.exports = { renderStub, specPath, parseArgs };
