/**
 * Reading the spec tree back, so the generator can verify and not only create.
 *
 * The distinction that matters here is between a scaffold and an
 * implementation. A scaffold is the generator's output and is disposable.
 * An implementation is somebody's work and is not - so the check must never
 * describe one as an orphan to be deleted, however oddly it is named.
 *
 * That is not hypothetical. In cah-pwa, two implemented suites - 17 real
 * tests between them - were sitting in files called `.spec.js`, because the
 * old parser matched a markdown separator row and named a file after it.
 * They were invisible to `ls`, uncounted in the project's own README, and a
 * tidy-up that deleted "empty generated files" by name would have deleted
 * them.
 *
 * Ported from generator-improvements's scripts/lib/spec-tree.js. The one
 * change: coveredCaseIds and readSpecTree take the same case-ID shape
 * parameter test-plan.js does, instead of a fixed regex, so this reads a
 * spec tree whose test titles use a different ID scheme.
 */
const fs = require('fs');
const path = require('path');
const { DEFAULT_CASE_ID_CORE } = require('./test-plan');

function isImplemented(source) {
  return !/test\.skip\s*\(/.test(source);
}

/**
 * Case IDs a file claims to cover, read from its test titles.
 *
 * @param {string} source
 * @param {string} [caseIdCore] must match the value passed to parseTestPlan
 *   for the two to agree on what a case ID looks like.
 */
function coveredCaseIds(source, caseIdCore = DEFAULT_CASE_ID_CORE) {
  const caseIdInTest = new RegExp(`\\b(${caseIdCore})\\b`, 'g');
  const ids = new Set();
  for (const line of source.split(/\r?\n/)) {
    if (!/\btest\s*\(/.test(line)) continue;
    for (const match of line.matchAll(caseIdInTest)) ids.add(match[1]);
  }
  return ids;
}

function readSpecTree(dir, caseIdCore = DEFAULT_CASE_ID_CORE) {
  const specs = [];
  if (!fs.existsSync(dir)) return specs;
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.spec.js')) {
        const source = fs.readFileSync(full, 'utf8');
        specs.push({
          file: full,
          implemented: isImplemented(source),
          covers: coveredCaseIds(source, caseIdCore),
        });
      }
    }
  };
  walk(dir);
  return specs;
}

module.exports = { readSpecTree, isImplemented, coveredCaseIds };
