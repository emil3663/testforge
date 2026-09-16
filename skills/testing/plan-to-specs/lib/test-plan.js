/**
 * Parsing a TEST_PLAN.md into test cases.
 *
 * Split out from the generator so it can be tested without writing files.
 * The generator is the most leveraged code a repo using this pattern has -
 * it produces the whole of the generated spec tree - and until
 * generator-improvements (cah-pwa, commit 78e30de) nothing verified it.
 *
 * Ported from that branch's scripts/lib/test-plan.js. The one change from
 * the source: the case-ID shape is a parameter with a default, not a fixed
 * regex, so this runs against a repo whose IDs don't happen to be cah-pwa's
 * own `LG-01` / `GP-23` scheme.
 */

/** cah-pwa's own case-ID shape: 2-4 uppercase letters, a hyphen, 2-3 digits. */
const DEFAULT_CASE_ID_CORE = '[A-Z]{2,4}-\\d{2,3}';

/**
 * Pull the test cases out of a TEST_PLAN.md.
 *
 * The previous parser (pre-generator-improvements) matched any table row
 * whose first cell was uppercase alphanumeric. Markdown tables always carry
 * two rows that fit that description and are not test cases: the header
 * (`| ID | Test | ... |`) and the separator (`|----|------|`). It generated
 * a spec file for both, in every table - 14 files called `id.spec.js` and
 * 21 called `.spec.js`, 35 of 228 generated files in cah-pwa, all junk.
 *
 * Requiring the shape of a real ID rather than "looks tableish" is what
 * removes an entire class of that, rather than special-casing the two rows
 * a reviewer happened to notice.
 *
 * @param {string} markdown
 * @param {string} [caseIdCore] the case-ID shape, as a regex source string
 *   with no anchors - anchored internally so a caller can't accidentally
 *   under-anchor it. Defaults to cah-pwa's own scheme.
 */
function parseTestPlan(markdown, caseIdCore = DEFAULT_CASE_ID_CORE) {
  const caseIdPattern = new RegExp(`^${caseIdCore}$`);
  const cases = [];
  let section = 'general';

  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim();

    const heading = line.match(/^#{2,3}\s*(.+)$/);
    if (heading) {
      section = slug(heading[1]);
      continue;
    }

    if (!line.startsWith('|')) continue;

    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim().replace(/`/g, ''));

    if (cells.length < 2) continue;

    const [id, title, expected = ''] = cells;
    if (!caseIdPattern.test(id)) continue;

    cases.push({ id, title, expected, section });
  }

  return cases;
}

function slug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

module.exports = { parseTestPlan, slug, DEFAULT_CASE_ID_CORE };
