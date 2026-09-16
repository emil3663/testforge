---
name: write-playwright-test
description: >
  Turn a plain-English description of a page or user flow into a clean,
  idiomatic Playwright TypeScript test file, with judgment about which
  testing categories (functional, responsive, performance, security,
  accessibility, usability, SEO/content, cookie/session, database) are
  actually relevant to the scenario described. Use this skill whenever
  the user describes a page, feature, or flow in plain English and wants
  Playwright test coverage for it — especially when they aren't a
  developer and need the reasoning about *what* to test made explicit,
  not just working code.
---

# Write a Playwright test from a plain-English description

## The gap this closes

Testers who understand quality — who can spot a bug from a mile away and
reason about user flows, edge cases, and risk — are routinely told to
"learn to code" when they want that judgment turned into automation.
Most of them can. The actual barrier is that automation frameworks are
written by developers for developers: opaque selectors, no explanation
of why a given assertion exists, no guidance on what's worth testing in
the first place. Writing the test is the easy part. Deciding what
deserves coverage is the part that takes judgment.

When this skill runs, both parts are your job: pick the right coverage
categories for the scenario described, then write the test so a
non-developer tester reading it later can follow — and learn from — every
step.

## 1. Read the scenario and decide which categories apply

Not every category applies to every scenario — a balanced suite covers
the categories that are actually relevant, not all nine reflexively.
Weigh each one against what was described:

- **Functional** — navigation, forms, links, and the primary happy-path
  flow. Almost always in scope.
- **Responsive/mobile** — viewport checks across phone, tablet, and
  desktop, when layout is part of the description or the page is
  clearly layout-sensitive.
- **Performance/load** — lightweight browser timing assertions, only
  when requested. Never fabricate JMeter or Lighthouse-style output —
  Playwright can't produce it, so don't write tests that pretend it can.
- **Security** — browser-visible checks only: HTTPS, invalid-input
  handling, auth/session behavior, visible security errors. Not a
  penetration test.
- **Accessibility** — pragmatic WCAG-oriented checks: headings, labels,
  roles, keyboard-reachable controls, meaningful text. Not a full audit.
- **Usability** — clear navigation, obvious calls to action, visible
  user guidance.
- **SEO/content** — title, meta description, heading structure, and
  critical content, only when the page is public-facing.
- **Cookie/session** — inspect cookies or auth state only when it's
  observable from the page flow itself.
- **Database** — validate persistence indirectly through user-visible
  create/read/update flows. Only reach for direct API or DB checks if
  the user explicitly provided that path — otherwise it's out of reach
  from the browser and out of scope.

If a category is relevant but needs tooling outside what's in the
repo (a load-testing harness, a Lighthouse run), don't fake its output.
Keep the executable Playwright code to what can actually run, and leave
a comment noting the follow-up work that would need separate tooling.

## 2. Write the test file

- Import from `@playwright/test` (`test`, `expect`) — nothing else.
- Use the base URL the user gave you as the starting point.
- Name tests descriptively enough that a non-developer tester
  understands what's being verified from the name alone.
- Comment each step in plain language — the comments are how a tester
  learns to read the test, not filler.
- Prefer user-visible locators — `getByRole`, `getByLabel`,
  `getByPlaceholder`, `getByText` — over CSS selectors. CSS selectors
  couple the test to implementation details that change without the
  user-visible behavior changing.
- Assert on visible outcomes (text, state, navigation), not internal
  implementation details.
- Cover the happy path plus any failure scenarios the description
  mentions — don't invent failure cases that weren't asked for.
- When more than one coverage category is in scope, group tests into
  separate `test.describe` blocks named after each area (e.g.
  `test.describe('Accessibility', ...)`), so the categories stay legible
  in the output rather than interleaved.
- Write complete tests, not `TODO` stubs — if something can't be
  implemented for real, leave it out and note why in a comment rather
  than stubbing it.
- Output only the TypeScript code for the test file — no markdown
  fences, no surrounding explanation, unless the user asked for
  commentary alongside it.

## Worked example

**Description given to the skill:**

> Test the login page at https://example.com/login. There's an email
> field, a password field, and a "Sign in" button. On success the user
> is redirected to /dashboard which shows a welcome heading. On invalid
> credentials, an inline error message appears without navigating away.
> The page should also work well on mobile.

Reading that against the category list in step 1: this is a login form
with a stated success/failure outcome (**Functional** — clearly in
scope) and an explicit mobile-layout requirement (**Responsive/mobile**
— clearly in scope). Nothing in the description touches performance,
security, accessibility, usability, SEO, cookies, or persistence, so
those categories are left out rather than added reflexively — each of
the two describe blocks below maps to preconditions, inputs, and
expected results for its cases, the same shape ISTQB uses for a test
case: a known starting state, what's entered or done, and what should
be observably true afterward.

**Resulting test file:**

```typescript
import { test, expect } from '@playwright/test';

const BASE_URL = 'https://example.com';

test.describe('Functional', () => {
  test('user can sign in with valid credentials and lands on the dashboard', async ({ page }) => {
    // Go to the login page
    await page.goto(`${BASE_URL}/login`);

    // Fill in valid credentials
    await page.getByLabel('Email').fill('test.user@example.com');
    await page.getByLabel('Password').fill('correct-horse-battery-staple');

    // Submit the form
    await page.getByRole('button', { name: 'Sign in' }).click();

    // The user should land on the dashboard and see a welcome heading
    await expect(page).toHaveURL(`${BASE_URL}/dashboard`);
    await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible();
  });

  test('invalid credentials show an inline error without navigating away', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    await page.getByLabel('Email').fill('test.user@example.com');
    await page.getByLabel('Password').fill('wrong-password');

    await page.getByRole('button', { name: 'Sign in' }).click();

    // An inline error appears, and the user stays on the login page
    await expect(page.getByText(/invalid|incorrect/i)).toBeVisible();
    await expect(page).toHaveURL(`${BASE_URL}/login`);
  });
});

test.describe('Responsive/mobile', () => {
  const viewports = [
    { name: 'phone', width: 375, height: 667 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1440, height: 900 },
  ];

  for (const viewport of viewports) {
    test(`login form is usable at ${viewport.name} size`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(`${BASE_URL}/login`);

      // The core form controls stay visible and usable at every size
      await expect(page.getByLabel('Email')).toBeVisible();
      await expect(page.getByLabel('Password')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    });
  }
});
```
