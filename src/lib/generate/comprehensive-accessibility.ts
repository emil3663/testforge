import { formFieldNamesTest } from "./mock/form-field-names";

// Phase 35 (TFP-134, Decision 4): Comprehensive accessibility - an axe-core
// WCAG scan on every page, plus the existing accessibility check (Phase 34,
// TFP-121: every form field has an accessible name) on every page.
//
// - Rules: WCAG 2.0, 2.1 and 2.2 at levels A and AA (axe's tags).
// - Failures: violations axe rates "critical" or "serious".
// - Findings: violations rated "moderate" or "minor".
// - Anything axe could not decide ("incomplete") is listed as needing manual
//   review - never counted as passed.
//
// Each violation and undecided item is recorded as an `issue` annotation
// carrying its WCAG criterion, read from axe's own tags (wcag143 -> 1.4.3),
// so the report groups failures and findings by criterion. The criterion is
// never written by hand here.
//
// @axe-core/playwright and axe-core are MPL-2.0 and used unmodified.

/** axe's tags for WCAG 2.0, 2.1 and 2.2 at levels A and AA. */
export const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];

/** What the TFP-121 check verifies, by axe's own `label` rule's tag (wcag412). */
export const FORM_FIELD_NAMES_CRITERION = "WCAG 4.1.2";

export const AXE_IMPORT = "import AxeBuilder from '@axe-core/playwright';";

export const ACCESSIBILITY_HELPERS = String.raw`// The WCAG criterion axe tags a rule with: wcag143 -> "WCAG 1.4.3".
function tfCriterion(tags: string[]): string {
  const tag = tags.find((candidate) => /^wcag\d{3,}$/.test(candidate));
  return tag ? 'WCAG ' + tag.slice(4, 5) + '.' + tag.slice(5, 6) + '.' + tag.slice(6) : 'WCAG (no criterion tagged by axe)';
}

// Where on the page: the first five elements axe named, and how many more.
function tfWhere(nodes: Array<{ target: unknown[] }>): string {
  const shown = nodes.slice(0, 5).map((node) => node.target.map(String).join(' '));
  return shown.join(', ') + (nodes.length > 5 ? ' and ' + (nodes.length - 5) + ' more' : '');
}
`;

export interface AccessibilityCheckPage {
    escapedPath: string;
    path: string;
    /** `{ annotation: [...] }`: the page, plus the given category. */
    details: (category: string) => string;
}

const AXE_SCAN = String.raw`    test('__PATH__ passes the WCAG 2.2 A and AA scan', __DETAILS__, async ({ page }) => {
      await page.goto('__PATH__');
      await page.waitForLoadState('load');
      const results = await new AxeBuilder({ page }).withTags(__TAGS__).analyze();
      const failures: string[] = [];
      for (const violation of results.violations) {
        const criterion = tfCriterion(violation.tags);
        const detail = violation.id + ' (' + (violation.impact ?? 'no impact given') + '): ' + violation.help + ' - ' + tfWhere(violation.nodes);
        const serious = violation.impact === 'critical' || violation.impact === 'serious';
        test.info().annotations.push({ type: 'issue', description: JSON.stringify({ kind: serious ? 'failure' : 'finding', category: criterion, detail }) });
        if (serious) failures.push(criterion + ' ' + detail);
        else test.info().annotations.push({ type: 'finding', description: criterion + ' ' + detail });
      }
      for (const item of results.incomplete) {
        test.info().annotations.push({ type: 'issue', description: JSON.stringify({ kind: 'manual-review', category: tfCriterion(item.tags), detail: item.id + ': ' + item.help + ' - ' + tfWhere(item.nodes) }) });
      }
      expect(failures, 'serious or critical WCAG violations on __PATH__: ' + failures.join('; ')).toEqual([]);
    });`;

function indent(code: string) {
    return code.split("\n").map((line) => (line ? `  ${line}` : line)).join("\n");
}

/** The per-page accessibility checks: the axe scan, then TFP-121's field names. */
export function accessibilityPageTests(page: AccessibilityCheckPage): string[] {
    const scan = AXE_SCAN.split("__PATH__").join(page.escapedPath)
        .split("__DETAILS__").join(page.details("WCAG 2.2 A and AA (axe-core)"))
        .split("__TAGS__").join(JSON.stringify(WCAG_TAGS).replace(/"/g, "'"));
    const fieldNames = indent(formFieldNamesTest(page.path)).replace("', async ({ page }) => {", `', ${page.details(FORM_FIELD_NAMES_CRITERION)}, async ({ page }) => {`);
    return [scan, fieldNames];
}
