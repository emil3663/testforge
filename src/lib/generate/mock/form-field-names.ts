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
// hand-rolled label/aria-label/placeholder heuristic. Only the first line
// counts, and a name is a quoted string straight after the role. Proven per
// input type in a real browser: an unnamed field's line is `- checkbox
// [checked]`, `- slider: "50"`, `- spinbutton: "7"` or `- textbox: "#000000"`
// (state or value, never a name), a named one `- slider "Volume": "50"`.
//
// The exception is `file`: with no label of its own, Chromium names it by its
// button text (`- button "Choose File"`, localised). So a file input whose
// name is that default counts as unnamed - compared against a throwaway
// unlabelled file input in the same page, not a hard-coded English string.
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

/** One page's check, as the Standard suite writes it; Phase 35 (TFP-134) runs it on every page of a Comprehensive accessibility run. */
export function formFieldNamesTest(path: string) {
    const p = escapeForSingleQuotedString(path);
    return `  test('every form field has an accessible name: ${p}', async ({ page }) => {
    await page.goto('${p}');
    await page.waitForLoadState('domcontentloaded');

    // A field has a name when its aria snapshot's first line quotes one
    // straight after the role; state ([checked]) and values (: "50") are not names.
    const firstLine = (snapshot: string) => snapshot.trim().split('\\n')[0];
    const hasName = (snapshot: string) => /^-\\s+[^\\s:"]+\\s+"/.test(firstLine(snapshot));
    // An unlabelled file input is named by its button text ("Choose File",
    // localised): read that default from a throwaway unlabelled file input.
    let fileDefault: string | null = null;
    const isFileDefault = async (snapshot: string) => {
      if (fileDefault === null) {
        await page.evaluate(() => {
          const probe = document.createElement('input');
          probe.type = 'file';
          probe.setAttribute('data-testforge-probe', '');
          document.body.appendChild(probe);
        });
        fileDefault = firstLine(await page.locator('[data-testforge-probe]').ariaSnapshot());
        await page.evaluate(() => document.querySelector('[data-testforge-probe]')?.remove());
      }
      return firstLine(snapshot) === fileDefault;
    };
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
      const snapshot = await field.ariaSnapshot();
      const isFile = (await field.getAttribute('type'))?.toLowerCase() === 'file';
      if (!hasName(snapshot) || (isFile && (await isFileDefault(snapshot)))) {
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
