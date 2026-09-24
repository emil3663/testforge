/**
 * Extra rules for the local (Ollama) generation path only (Phase 31, TFP-106).
 *
 * `testforge-qwen7b` invented `expect(locator).toBeAccessible()` on every
 * accessibility-worded request tested in Phase 30; the 3B spike invented
 * `expect(page).toHaveAccessibleRole()`. TFP-103's type check catches both,
 * but then the request falls back to the template. These rules tell the model
 * which accessibility assertions actually exist, with an example to copy.
 *
 * Deliberately NOT part of src/lib/generate/prompt.ts: the shared
 * SYSTEM_PROMPT also drives the OpenAI path, which has no such defect and
 * stays exactly as Phase 28 left it (Phase 31 Decision 1). Every matcher
 * named here is proven to exist by local-rules.test.ts, which type-checks
 * the example against the installed @playwright/test.
 */

/** Written so it compiles as-is; local-rules.test.ts checks that it does. */
export const ACCESSIBILITY_EXAMPLE = `import { test, expect } from '@playwright/test';

test.describe('Accessibility', () => {
  test('Sign in button has an accessible role and name', async ({ page }) => {
    await page.goto('https://example.invalid/EXAMPLE-ONLY');
    const signIn = page.getByRole('button', { name: 'Sign in' });
    await expect(signIn).toHaveRole('button');
    await expect(signIn).toHaveAccessibleName('Sign in');
  });

  test('Email field is labelled and reachable by keyboard', async ({ page }) => {
    await page.goto('https://example.invalid/EXAMPLE-ONLY');
    const email = page.getByLabel('Email');
    await expect(email).toBeVisible();
    await email.focus();
    await expect(email).toBeFocused();
  });

  test('Page has exactly one main heading', async ({ page }) => {
    await page.goto('https://example.invalid/EXAMPLE-ONLY');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  });
});`;

export const LOCAL_MODEL_RULES = `Playwright API rules (these override any habit you have):
- Only use matchers that exist in @playwright/test. Never invent one.
- Always write await before every expect(...) call: await expect(page).toHaveURL(url), await expect(locator).toBeVisible(). An expect on page or a locator without await never runs - the test passes while checking nothing.
- There is NO accessibility matcher that checks a whole element or page at once. These do NOT exist and must never be used: toBeAccessible, toHaveAccessibleRole, toPassAxe, toHaveNoViolations, toBeAccessibilityCompliant.
- expect(page) only supports page matchers: toHaveURL, toHaveTitle. Never call an element matcher such as toHaveRole or toBeVisible on page - always on a locator, e.g. expect(page.getByRole('main')).toHaveRole('main').
- Check accessibility with these real locator matchers instead (each is called on a locator, never on page):
  - toHaveRole(role) - the element's ARIA role.
  - toHaveAccessibleName(name) - what a screen reader announces.
  - toHaveAccessibleDescription(text) - its accessible description.
  - toHaveAttribute('aria-...', value) - a specific ARIA attribute, or toHaveAttribute('alt', /.+/) for image alt text.
  - toBeFocused() after locator.focus() or page.keyboard.press('Tab') - keyboard reachability.
  - toHaveCount(n) on page.getByRole('heading', { level: 1 }) - heading structure.
- Find elements the way assistive technology does: getByRole, getByLabel, getByText.

Example of correct accessibility tests. Copy the assertion style, not the URLs or names - use the page and elements from the user's request:
${ACCESSIBILITY_EXAMPLE}`;
