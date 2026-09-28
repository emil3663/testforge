import { escapeForSingleQuotedString } from "./format";
import type { ActionableElementDetail, ContentProfile } from "./types";

// TFP-121 (Phase 34, Decision 10). The template's accessibility tests only
// looked at the landing page's elements, so TFP-120's comparison found them
// passing with the fixture's sign-in email field unlabelled. This check runs
// on every inspected page that has form fields, and at run time lists every
// visible field there - not only the ones introspection saw.
//
// The name is the one the browser computes, read from the field's aria
// snapshot (`- textbox "Email"` has a name, `- textbox` has none), the same
// computation Playwright's role queries and toHaveAccessibleName use - not a
// hand-rolled label/aria-label/placeholder heuristic.
//
// - A field with no name fails the test; the message names each field (id,
//   name or type) and the page.
// - A field named only by its placeholder is a finding, not a failure: the
//   placeholder vanishes as the user types, so it is a weak label, not a
//   missing one. Detected by removing the placeholder attribute in the page,
//   reading the name again and putting it back - still the browser's own
//   computation, and nothing is sent to the site.
//
// Read-only. Generated code avoids template literals so it needs no second
// escaping.

const MAX_PAGES = 10;

/** Inputs that are controls, not fields a user fills in. */
const NON_FIELD_INPUT_TYPES = new Set(["hidden", "submit", "button", "image", "reset"]);

/** Runtime selector for the fields checked: every input but the above, select, textarea. */
export const FORM_FIELD_SELECTOR = `input${[...NON_FIELD_INPUT_TYPES].map((type) => `:not([type="${type}"])`).join("")}, select, textarea`;

function isFormField(element: ActionableElementDetail) {
    if (element.elementType === "select" || element.elementType === "textarea") return true;
    return element.elementType === "input" && !NON_FIELD_INPUT_TYPES.has(element.locator.inputType);
}

/** Inspected pages with at least one form field, in profile order. */
export function findFormFieldPages(contentProfile: ContentProfile | null): string[] {
    const paths = (contentProfile?.pages ?? [])
        .filter((page) => (page.actionableElements ?? []).some(isFormField))
        .map((page) => page.path);
    return [...new Set(paths)].slice(0, MAX_PAGES);
}

function formFieldNamesTest(path: string) {
    const p = escapeForSingleQuotedString(path);
    return `  test('every form field has an accessible name: ${p}', async ({ page }) => {
    await page.goto('${p}');
    await page.waitForLoadState('domcontentloaded');

    // A field has a name when its aria snapshot's first line quotes one.
    const hasName = (snapshot: string) => /^-\\s+[^\\s:"]+\\s+"/.test(snapshot.trim().split('\\n')[0]);
    const unnamed: string[] = [];
    const placeholderOnly: string[] = [];
    for (const field of await page.locator('${escapeForSingleQuotedString(FORM_FIELD_SELECTOR)}').all()) {
      if (!(await field.isVisible())) continue;
      const described = await field.evaluate((el) => {
        const id = el.getAttribute('id');
        const name = el.getAttribute('name');
        if (id) return '#' + id;
        if (name) return el.tagName.toLowerCase() + '[name="' + name + '"]';
        return el.tagName.toLowerCase() + (el.getAttribute('type') ? '[type="' + el.getAttribute('type') + '"]' : '');
      });
      if (!hasName(await field.ariaSnapshot())) {
        unnamed.push(described);
        continue;
      }
      const placeholder = await field.getAttribute('placeholder');
      if (placeholder !== null) {
        await field.evaluate((el) => el.removeAttribute('placeholder'));
        const namedWithout = hasName(await field.ariaSnapshot());
        await field.evaluate((el, value) => el.setAttribute('placeholder', value), placeholder);
        if (!namedWithout) placeholderOnly.push(described + ' ("' + placeholder + '")');
      }
    }
    // A weak label, not a missing one: recorded without failing the test.
    for (const field of placeholderOnly) {
      test.info().annotations.push({ type: 'finding', description: 'form field named only by its placeholder on ${p}, which disappears as the user types: ' + field });
    }
    expect(unnamed, 'form fields on ${p} with no accessible name (a screen reader announces them without a label): ' + unnamed.join(', ')).toEqual([]);
  });`;
}

export function buildFormFieldNameTests(contentProfile: ContentProfile | null): string[] {
    return findFormFieldPages(contentProfile).map(formFieldNamesTest);
}
