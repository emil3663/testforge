/**
 * Extra rules for the local (Ollama) generation path only.
 *
 * Phase 31 (TFP-106): `testforge-qwen7b` invented `expect(locator).toBeAccessible()`
 * on every accessibility-worded request; a worked example of the real matchers
 * fixed it. Phase 33: the same lever, one guide per category the baseline
 * (TEST_PLAN.md GEN-28) found thin - each a short rule plus a worked example.
 *
 * Only the guides for the categories in scope are sent (localRulesFor), because
 * the model copies an example's structure (Phase 32, GEN-30): a guide for an
 * unrelated category would come back as unrelated tests.
 *
 * Every example follows Phase 32's rules: placeholder data only
 * (example.invalid URLs, EXAMPLE-* names - realistic data gets copied
 * verbatim), written as exactly the tests we want copied, all assertions
 * awaited. local-rules.test.ts type-checks each example against the installed
 * @playwright/test and enforces the placeholder and await rules.
 *
 * Deliberately NOT part of src/lib/generate/prompt.ts: the shared
 * SYSTEM_PROMPT also drives the OpenAI path, which stays exactly as Phase 28
 * left it (Phase 31 Decision 1).
 */
import type { BestPracticeArea } from "./mock/types";
import { BEST_PRACTICE_OPTIONS } from "./mock/types";

export const SHARED_RULES = `Playwright API rules (these override any habit you have):
- Only use matchers that exist in @playwright/test. Never invent one.
- Always write await before every expect(...) call: await expect(page).toHaveURL(url), await expect(locator).toBeVisible(). An expect on page or a locator without await never runs - the test passes while checking nothing.
- expect(page) only supports page matchers: toHaveURL, toHaveTitle. Never call an element matcher such as toHaveRole or toBeVisible on page - always on a locator, e.g. expect(page.getByRole('main')).toHaveRole('main').
- Never pass a promise to expect: expect(locator.textContent()).toBe(...) compares a Promise and always fails. Use a locator matcher instead: await expect(locator).toHaveText(...).
- Find elements the way assistive technology does: getByRole, getByLabel, getByText.
- The examples below use placeholder data: https://example.invalid/... URLs and names starting with EXAMPLE-. Never copy a placeholder. Replace every one with the base URL, pages and elements from the user's request.`;

export interface CategoryGuide {
    rules: string;
    /** Compiles as-is; local-rules.test.ts checks it. */
    example: string;
}

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

// TFP-111. Mirrors the template generator's own reliability tests
// (mock/dependency-failure-injection.ts, storage-failure-injection.ts): make a
// dependency or storage fail, then assert only that the page survives - never a
// specific fallback message nobody can know in advance.
export const RELIABILITY_EXAMPLE = `import { test, expect } from '@playwright/test';

test.describe('Reliability', () => {
  test('page still works when its API requests fail', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.route('**/api/**', (route) => route.abort('failed'));
    const response = await page.goto('https://example.invalid/EXAMPLE-PAGE');
    await expect(response?.status() ?? 0).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible();
    await expect(pageErrors).toEqual([]);
  });

  test('page still works when third-party requests fail', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    const ownHost = new URL('https://example.invalid/EXAMPLE-PAGE').host;
    await page.route((url) => url.host !== ownHost, (route) => route.abort('failed'));
    const response = await page.goto('https://example.invalid/EXAMPLE-PAGE');
    await expect(response?.status() ?? 0).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible();
    await expect(pageErrors).toEqual([]);
  });

  test('page still works when localStorage is unavailable', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() { throw new Error('localStorage disabled by the test'); },
      });
    });
    const response = await page.goto('https://example.invalid/EXAMPLE-PAGE');
    await expect(response?.status() ?? 0).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible();
    await expect(pageErrors).toEqual([]);
  });
});`;

export const CATEGORY_GUIDES: Partial<Record<BestPracticeArea, CategoryGuide>> = {
    accessibility: {
        rules: `Accessibility:
- There is NO accessibility matcher that checks a whole element or page at once. These do NOT exist and must never be used: toBeAccessible, toHaveAccessibleRole, toPassAxe, toHaveNoViolations, toBeAccessibilityCompliant.
- Check accessibility with these real locator matchers instead (each is called on a locator, never on page):
  - toHaveRole(role) - the element's ARIA role.
  - toHaveAccessibleName(name) - what a screen reader announces.
  - toHaveAccessibleDescription(text) - its accessible description.
  - toHaveAttribute('aria-...', value) - a specific ARIA attribute, or toHaveAttribute('alt', /.+/) for image alt text.
  - toBeFocused() after locator.focus() or page.keyboard.press('Tab') - keyboard reachability.
  - toHaveCount(n) on page.getByRole('heading', { level: 1 }) - heading structure.`,
        example: ACCESSIBILITY_EXAMPLE,
    },
    reliability: {
        rules: `Reliability (TestForge's meaning - not uptime or load):
- Reliability means graceful degradation: make something the page depends on fail, then check the page survives.
- Simulate the failure BEFORE page.goto: page.route(match, (route) => route.abort('failed')) for a network dependency (API calls, third-party scripts), or page.addInitScript(...) that makes window.localStorage throw for storage.
- page.route only matches network request URLs. It cannot block an input, a button or any other element on the page - never write a route pattern named after a page element.
- The three failures in the example are generic and are NOT placeholders: '**/api/**', every request to another host, and localStorage. Reuse them exactly as written. Only if the page inspection profile lists dependencies, block those exact hosts and paths instead.
- Keep const response = await page.goto(...) - the status check needs response.- Then assert only that the page survived: the response status is below 500, the body is still visible, and no uncaught page errors were recorded with page.on('pageerror'). Never assert a specific error message or fallback text - you cannot know it.`,
        example: RELIABILITY_EXAMPLE,
    },
};

/**
 * The shared rules plus the guide (rules and worked example) for each area in
 * `areas` that has one, in BEST_PRACTICE_OPTIONS order.
 */
export function localRulesFor(areas: readonly BestPracticeArea[]): string {
    const sections = [SHARED_RULES];
    for (const area of BEST_PRACTICE_OPTIONS) {
        const guide = CATEGORY_GUIDES[area];
        if (!guide || !areas.includes(area)) continue;
        sections.push(
            `${guide.rules}\n\nExample of correct ${area} tests. Copy this structure and the kind of checks, not the placeholder data - use the page and elements from the user's request:\n${guide.example}`
        );
    }
    return sections.join("\n\n");
}
