import { escapeForSingleQuotedString } from "../format";
import type { ActionableElementDetail } from "../types";
import { hiddenAtIntrospectionComment } from "./shared";

/**
 * TFP-160 (Emil, 2026-10-06): the form check finds the <form> itself by what
 * introspection recorded - its action and method as written, and which of
 * the page's forms with those it is - not by text. Text found the wrong
 * element on a real site: a sort <select> matched its own options' joined
 * text, and a form looked up by all its labels joined matched nothing. It
 * then asserts each recorded field is inside that form, naming any missing.
 *
 * A form with an id keeps its id-based check (functional.ts), as TFP-145
 * keeps a link's id.
 *
 * A profile from before TFP-160 has no form record: the check falls back to
 * the nth <form> on the page, n from the profile's order, and to "it holds
 * at least one control", as before.
 */
export function buildFormCheckTest(title: string, escapedPath: string, element: ActionableElementDetail, profileFormIndex: number) {
    const presence = element.isVisible
        ? "    await expect(locator).toBeVisible();"
        : `${hiddenAtIntrospectionComment}\n    await expect(locator).toBeAttached();`;

    if (!element.form) {
        return `  test('${title}', async ({ page }) => {
    await page.goto('${escapedPath}');
    await page.waitForLoadState('domcontentloaded');

    // The page's form number ${profileFormIndex + 1}, in the order the page was inspected (no form record in this profile).
    const locator = page.locator('form').nth(${profileFormIndex});
${presence}

    const controlCount = await locator.locator('input, textarea, select, button').count();
    expect(controlCount).toBeGreaterThan(0);
  });`;
    }

    const { action, method, occurrence, fields } = element.form;
    const wanted = `{ action: '${escapeForSingleQuotedString(action)}', method: '${escapeForSingleQuotedString(method)}', occurrence: ${occurrence} }`;
    const describe = `${action ? `action "${action}"` : "no action"}, ${method ? `method ${method}` : "no method"}${occurrence > 0 ? `, number ${occurrence + 1} of those` : ""}`;
    return `  test('${title}', async ({ page }) => {
    await page.goto('${escapedPath}');
    await page.waitForLoadState('domcontentloaded');

    // The <form> itself, by its action and method as written and which of the page's forms with those it is (TFP-160).
    const forms = page.locator('form');
    const index = await forms.evaluateAll((nodes, wanted) => nodes
      .map((node, position) => ({ position, action: node.getAttribute('action') ?? '', method: (node.getAttribute('method') ?? '').toLowerCase() }))
      .filter((form) => form.action === wanted.action && form.method === wanted.method)
      .map((form) => form.position)[wanted.occurrence] ?? -1, ${wanted});
    expect(index, 'no form on ${escapedPath} with ${escapeForSingleQuotedString(describe)}').toBeGreaterThanOrEqual(0);
    const locator = forms.nth(index);
${presence}

    // Each field introspection recorded in this form, by name, else id, else its kind.
    const fields = ${JSON.stringify(fields)};
    const missing = await locator.evaluate((form, fields) => {
      const kinds = new Map<string, number>();
      const missing: string[] = [];
      for (const field of fields) {
        if (field.name || field.id) {
          const found = Array.from(form.querySelectorAll(field.tag)).some((control) => (field.name ? control.getAttribute('name') === field.name : control.id === field.id));
          if (!found) missing.push(field.tag + ' ' + (field.name ? 'named "' + field.name + '"' : '#' + field.id));
          continue;
        }
        const kind = field.tag + (field.type ? '[type=' + field.type + ']' : '');
        kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
      }
      for (const [kind, count] of kinds) {
        const [tag, type] = kind.split(/\\[type=|\\]/);
        const present = Array.from(form.querySelectorAll(tag)).filter((control) => !(control.getAttribute('name') || control.id) && (control.getAttribute('type') ?? '').toLowerCase() === (type ?? '')).length;
        if (present < count) missing.push((count - present) + ' unnamed ' + kind);
      }
      return missing;
    }, fields);
    expect(missing, 'fields missing from the form on ${escapedPath}: ' + missing.join(', ')).toEqual([]);
  });`;
}
