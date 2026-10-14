import { entryApplies } from "@/lib/library/entries";
import { NOT_A_PAGE_HELPER } from "./comprehensive-security-helpers";
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

/**
 * axe's tags for WCAG 2.0, 2.1 and 2.2 at levels A and AA. axe-core 4.13.0
 * has no `wcag22a` tag (Gate B finding): WCAG 2.2's new level-A criteria
 * have no axe rule, which the "needs a person" statement covers.
 */
export const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** What the TFP-121 check verifies, by axe's own `label` rule's tag (wcag412). */
export const FORM_FIELD_NAMES_CRITERION = "WCAG 4.1.2";

export const ACCESSIBILITY_HELPERS = NOT_A_PAGE_HELPER + String.raw`// The WCAG criterion axe tags a rule with: wcag143 -> "WCAG 1.4.3".
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
    /** Phase 42 (TFP-193): the page as inspection recorded it, when it did; the library's patterns read it. */
    inspected?: import("./mock/types").ContentProfilePage;
    /** `{ annotation: [...] }`: the page, plus the given category. */
    details: (category: string) => string;
}

const AXE_SCAN = String.raw`    test('__PATH__ passes the WCAG 2.2 A and AA scan', __DETAILS__, async ({ page }) => {
      const response = await page.goto('__PATH__');
      const notAPage = response ? tfNotAPage(response.status()) : null;
      test.skip(notAPage !== null, '__PATH__ ' + notAPage);
      await page.waitForLoadState('load');
      // Loaded here, not imported at the top of the file: the Standard suite runs this same test (Phase 38 TFP-148).
      const { default: AxeBuilder } = await import('@axe-core/playwright');
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

// Phase 41 (TFP-183, Decision 4): keyboard order and grouping, which axe has
// no rule for. Both read only: focus moves, nothing is typed or sent.
//
// Tab order (bug 53; ISTQB: state transition, each Tab press moving focus
// to the next field in reading order): a form field with a positive
// tabindex fails, and so does a Tab walk that reaches a form's fields out of
// reading order - top to bottom, then left to right, fields whose boxes
// share a row read left to right. WCAG 2.4.3 Focus Order.
//
// Grouping (bug 94; decision table: shares a name or a heading x inside a
// named fieldset or group): two or more checkboxes or radio buttons that
// share a name, or the heading just before them, must sit in a fieldset
// with a legend, or an element with role group or radiogroup and a name.
// WCAG 1.3.1 Info and Relationships, technique H71.
const TAB_ORDER = String.raw`    test('__PATH__ is tabbed through in reading order', __DETAILS__, async ({ page }) => {
      // ISTQB: state transition (each Tab press moves focus to the next field in reading order).
      const response = await page.goto('__PATH__');
      const notAPage = response ? tfNotAPage(response.status()) : null;
      test.skip(notAPage !== null, '__PATH__ ' + notAPage);
      const fields = await page.evaluate(() => {
        const found: Array<{ index: number; form: number; name: string; top: number; left: number; height: number; tabIndex: number }> = [];
        Array.from(document.querySelectorAll('form')).forEach((form, formIndex) => {
          for (const field of Array.from(form.querySelectorAll('input, select, textarea')) as HTMLInputElement[]) {
            const box = field.getBoundingClientRect();
            if (field.type === 'hidden' || field.disabled || box.width === 0 || box.height === 0) continue;
            field.setAttribute('data-tf-field', String(found.length));
            const name = (field.getAttribute('aria-label') || field.labels?.[0]?.textContent || field.getAttribute('placeholder') || field.name || field.id || field.type).replace(/\s+/g, ' ').trim();
            found.push({ index: found.length, form: formIndex, name, top: box.top + window.scrollY, left: box.left + window.scrollX, height: box.height, tabIndex: field.tabIndex });
          }
        });
        return found;
      });
      const forms = [...new Set(fields.map((field) => field.form))].filter((form) => fields.filter((field) => field.form === form).length >= 2);
      test.skip(forms.length === 0, 'no form with two or more fields on __PATH__');
      const problems: string[] = [];
      const positive = fields.filter((field) => forms.includes(field.form) && field.tabIndex > 0);
      if (positive.length > 0) problems.push('positive tabindex on __PATH__, which overrides the reading order: ' + positive.map((field) => '"' + field.name + '" (' + field.tabIndex + ')').join(', '));
      const visited: number[] = [];
      const presses = Math.min(await page.locator('a[href], button, input, select, textarea, [tabindex]').count() + 5, 150);
      await page.locator('body').evaluate((body) => { (document.activeElement as HTMLElement | null)?.blur(); body.focus(); });
      for (let press = 0; press < presses; press++) {
        await page.keyboard.press('Tab');
        const at = await page.evaluate(() => document.activeElement?.getAttribute('data-tf-field') ?? null);
        if (at !== null && !visited.includes(Number(at))) visited.push(Number(at));
      }
      for (const form of forms) {
        const own = fields.filter((field) => field.form === form);
        const sameRow = (a: (typeof own)[number], b: (typeof own)[number]) => Math.abs(a.top - b.top) < Math.min(a.height, b.height) / 2;
        const reading = [...own].sort((a, b) => (sameRow(a, b) ? a.left - b.left : a.top - b.top));
        const rank = new Map(reading.map((field, position) => [field.index, position]));
        const walk = visited.filter((index) => rank.has(index));
        for (let step = 1; step < walk.length; step++) {
          if ((rank.get(walk[step]) as number) < (rank.get(walk[step - 1]) as number)) {
            problems.push('Tab on __PATH__ goes from "' + fields[walk[step - 1]].name + '" back to "' + fields[walk[step]].name + '", against the reading order (' + reading.map((field) => field.name).join(', ') + ')');
            break;
          }
        }
      }
      expect(problems, problems.join('; ')).toEqual([]);
    });`;

const GROUPING = String.raw`    test('__PATH__ groups its checkboxes and radio buttons', __DETAILS__, async ({ page }) => {
      // ISTQB: decision table (shares a name or a heading x inside a named fieldset or group).
      const response = await page.goto('__PATH__');
      const notAPage = response ? tfNotAPage(response.status()) : null;
      test.skip(notAPage !== null, '__PATH__ ' + notAPage);
      const result = await page.evaluate(() => {
        const visible = (element: Element) => { const box = element.getBoundingClientRect(); return box.width > 0 && box.height > 0; };
        const choices = Array.from(document.querySelectorAll('input[type="checkbox"], input[type="radio"], [role="checkbox"], [role="radio"]')).filter(visible);
        const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]'));
        const label = (choice: Element) => ((choice as HTMLInputElement).labels?.[0]?.textContent || choice.getAttribute('aria-label') || choice.textContent || (choice as HTMLInputElement).value || '').replace(/\s+/g, ' ').trim();
        const grouped = (choice: Element) => {
          const group = choice.closest('fieldset, [role="group"], [role="radiogroup"]');
          if (!group) return false;
          const legend = group.tagName === 'FIELDSET' ? group.querySelector(':scope > legend')?.textContent ?? '' : '';
          const labelledBy = (group.getAttribute('aria-labelledby') ?? '').split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ');
          return (legend + (group.getAttribute('aria-label') ?? '') + labelledBy).trim() !== '';
        };
        const groups = new Map<string, Element[]>();
        for (const choice of choices) {
          const name = choice.getAttribute('name');
          if (name) groups.set('the name "' + name + '"', [...(groups.get('the name "' + name + '"') ?? []), choice]);
          const heading = headings.filter((candidate) => candidate.compareDocumentPosition(choice) & Node.DOCUMENT_POSITION_FOLLOWING).pop();
          const title = heading ? 'the heading "' + (heading.textContent ?? '').replace(/\s+/g, ' ').trim() + '"' : '';
          if (title) groups.set(title, [...(groups.get(title) ?? []), choice]);
        }
        const problems: string[] = [];
        const reported = new Set<Element>();
        for (const [shared, members] of groups) {
          const loose = members.filter((choice) => !grouped(choice) && !reported.has(choice));
          if (members.length < 2 || loose.length < 2) continue;
          loose.forEach((choice) => reported.add(choice));
          const kind = loose.every((choice) => (choice as HTMLInputElement).type === 'radio' || choice.getAttribute('role') === 'radio') ? 'radio buttons' : 'checkboxes';
          const names = loose.slice(0, 4).map((choice) => '"' + label(choice) + '"').join(', ') + (loose.length > 4 ? ' and ' + (loose.length - 4) + ' more' : '');
          problems.push(loose.length + ' ' + kind + ' sharing ' + shared + ' (' + names + ') are not in a fieldset with a legend or a named group');
        }
        return { problems, groups: [...groups.values()].filter((members) => members.length >= 2).length };
      });
      test.skip(result.groups === 0, 'no checkboxes or radio buttons sharing a name or a heading on __PATH__');
      expect(result.problems, result.problems.map((problem) => problem + ' on __PATH__').join('; ')).toEqual([]);
    });`;

/**
 * TFP-183: the tab-order and grouping checks of one page. They need ACCESSIBILITY_HELPERS in scope.
 * Phase 42 (TFP-193): each is a library entry, applied when its pattern matches the page (a page known
 * only by its path matches an entry for any page).
 */
export function keyboardAndGroupingTests(page: AccessibilityCheckPage): string[] {
    const fill = (template: string, criterion: string) => template.split("__PATH__").join(page.escapedPath).split("__DETAILS__").join(page.details(criterion));
    return [
        ...(entryApplies("keyboard.tab-order", page.inspected) ? [fill(TAB_ORDER, "WCAG 2.4.3")] : []),
        ...(entryApplies("keyboard.grouping", page.inspected) ? [fill(GROUPING, "WCAG 1.3.1")] : []),
    ];
}

function indent(code: string) {
    return code.split("\n").map((line) => (line ? `  ${line}` : line)).join("\n");
}

/**
 * The axe-core WCAG scan of one page. Phase 38 (TFP-148, Decision 4): the
 * Standard and Comprehensive runs both build it here, so they class every
 * violation the same way. It needs ACCESSIBILITY_HELPERS in scope.
 */
export function axeScanTest(page: AccessibilityCheckPage): string {
    return AXE_SCAN.split("__PATH__").join(page.escapedPath)
        .split("__DETAILS__").join(page.details("WCAG 2.2 A and AA (axe-core)"))
        .split("__TAGS__").join(JSON.stringify(WCAG_TAGS).replace(/"/g, "'"));
}

/** The per-page accessibility checks: the axe scan, TFP-121's field names, then TFP-183's tab order and grouping. */
export function accessibilityPageTests(page: AccessibilityCheckPage): string[] {
    const scan = axeScanTest(page);
    // Gate B finding: like the scan, the field-name check is Not run on a
    // page answering 400 or more (198dbec's rule) - a 401 page has no fields
    // to check, so passing there checked nothing. Only this copy changes; the
    // Standard template's own check is untouched.
    const load = `await page.goto('${page.escapedPath}');`;
    const standardCheck = indent(formFieldNamesTest(page.path));
    if (standardCheck.split(load).length !== 2) throw new Error(`TFP-121's check no longer loads ${page.path} exactly once; update the Comprehensive copy`);
    const fieldNames = standardCheck
        .replace("', async ({ page }) => {", `', ${page.details(FORM_FIELD_NAMES_CRITERION)}, async ({ page }) => {`)
        .replace(
            load,
            `const response = await page.goto('${page.escapedPath}');\n      const notAPage = response ? tfNotAPage(response.status()) : null;\n      test.skip(notAPage !== null, '${page.escapedPath} ' + notAPage);`
        );
    return [scan, fieldNames, ...keyboardAndGroupingTests(page)];
}
