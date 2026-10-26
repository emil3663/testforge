---
name: failure-mode-tests
description: >
  Given a plain-English scenario already covered by write-playwright-test,
  propose and write Playwright tests for the failure and timeout scenarios
  nobody explicitly asked about — a slow or down dependency, a partial
  response, a network drop mid-flow. Same output shape as
  write-playwright-test (a Playwright TypeScript file), different judgment:
  what to test when nothing was said about failure. Use this skill alongside
  or after write-playwright-test, when the happy-path and explicitly-stated
  failure coverage exists but nothing has asked "what if the dependency
  itself misbehaves."
---

# Write the failure-mode tests nobody asked for

## The gap this closes

`write-playwright-test` covers "the happy path plus any failure scenarios
the description mentions" — deliberately, since inventing untested paths
isn't that skill's job. But a description rarely mentions a slow auth
endpoint, a dropped connection mid-submit, or a response that times out —
not because those don't matter, but because a non-developer describing a
login page thinks in terms of what the user does, not in terms of what the
backend might fail to do. SRE ch. 17's point generalizes directly: testing
for reliability means covering dependency failure as a matter of course, not
only when someone happens to ask.

This skill is `write-playwright-test`'s sibling for exactly that gap — same
output (a Playwright test file), same category-weighing habit, but the
question it asks is "what happens when the thing this page depends on
doesn't behave," not "what does the user do."

## Inputs you need from the user

1. **The scenario** — the same plain-English description
   `write-playwright-test` would take.
2. **What `write-playwright-test`'s own output already covers**, if it's
   already been run — so this skill adds to it rather than duplicating the
   happy-path and stated-failure cases.
3. **What's actually interceptable** — Playwright can intercept and stall
   or corrupt its own page's network requests (`page.route`), but can't
   simulate a real backend's internal failure. Say which dependency calls
   are visible to the page (and therefore mockable this way) versus opaque.

## Output format

Same as `write-playwright-test`: a Playwright TypeScript test file, grouped
into `test.describe` blocks, output as code with no surrounding
explanation unless asked. The describe block name for this skill's own
output is `Failure modes` (or similar), kept separate from
`write-playwright-test`'s categories so the two files' outputs merge without
collision.

## Rules

**Start from what could fail, not from what was asked.** Read the scenario
for every network call it implies (form submit, redirect, any data the page
loads) and ask, for each: slow, down, or wrong — not just "does the happy
path work."

**Use `page.route` to intercept, not to invent an unreachable dependency.**
Delay a response (`await new Promise(r => setTimeout(r, ms)); await
route.continue()`), abort it (`route.abort()`), or fulfill it with a
malformed body (`route.fulfill({ status: 500, body: '...' })`) — all three
are real Playwright mechanisms that exercise the page's actual error-
handling code, not a fabrication of what a real outage would look like.

**Assert on user-visible degradation, the same standard
`write-playwright-test` uses.** A timeout test should assert the page shows
*something* the user can act on — a visible error, a retry affordance, a
loading state that doesn't hang forever — not just that the request was
intercepted. If the page has no visible failure handling at all, that's the
finding: write the test, watch it fail, and say so rather than softening the
assertion to match what the page currently does.

**Don't duplicate `write-playwright-test`'s stated-failure coverage.** If
the description already says "on invalid credentials, an inline error
appears," that's already covered — this skill's job is the failure modes
that description doesn't mention: the request never completing, completing
with the wrong shape, or the server being unreachable at all.

**Name what can't be tested this way.** A Playwright-level network
intercept can't prove what the real backend does under real load — it
proves the *page* degrades sensibly when its own request layer sees a given
failure shape. Say that distinction, same as `write-playwright-test` says
it can't fabricate Lighthouse output.

## Worked example

**Same scenario `write-playwright-test`'s own worked example uses:**

> Test the login page at https://example.com/login. There's an email
> field, a password field, and a "Sign in" button. On success the user
> is redirected to /dashboard which shows a welcome heading. On invalid
> credentials, an inline error message appears without navigating away.
> The page should also work well on mobile.

`write-playwright-test`'s output covers: valid login → dashboard, invalid
credentials → inline error, and three responsive viewports. Nothing in
that description or that output touches what happens if the login request
itself never completes, or completes too slowly — this skill's gap.

**Resulting test file:**

```typescript
import { test, expect } from '@playwright/test';

const BASE_URL = 'https://example.com';

test.describe('Failure modes', () => {
  test('a login request that times out shows a visible error, not an infinite spinner', async ({ page }) => {
    // Intercept the login request and delay it well past any reasonable timeout
    await page.route('**/login', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 30000));
      await route.continue();
    });

    await page.goto(`${BASE_URL}/login`);
    await page.getByLabel('Email').fill('test.user@example.com');
    await page.getByLabel('Password').fill('correct-horse-battery-staple');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // The page should surface something actionable well before 30s pass —
    // not leave the user staring at a spinner with no way to tell it's stuck
    await expect(page.getByText(/taking longer than expected|try again|timed out/i)).toBeVisible({ timeout: 10000 });
  });

  test('the login endpoint being unreachable shows a visible error, not a silent failure', async ({ page }) => {
    // Simulate the connection dropping entirely, not a slow response
    await page.route('**/login', (route) => route.abort('connectionfailed'));

    await page.goto(`${BASE_URL}/login`);
    await page.getByLabel('Email').fill('test.user@example.com');
    await page.getByLabel('Password').fill('correct-horse-battery-staple');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // The user stays on the login page and sees an error, rather than a
    // silently ignored click or a navigation to nowhere
    await expect(page).toHaveURL(`${BASE_URL}/login`);
    await expect(page.getByText(/unable to|couldn.?t|try again/i)).toBeVisible();
  });

  test('a malformed success response does not redirect the user to a broken dashboard', async ({ page }) => {
    // The server claims success but returns a body the page can't parse
    await page.route('**/login', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: 'not valid json' })
    );

    await page.goto(`${BASE_URL}/login`);
    await page.getByLabel('Email').fill('test.user@example.com');
    await page.getByLabel('Password').fill('correct-horse-battery-staple');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // The page should not navigate to /dashboard on the strength of a 200
    // status alone if it can't actually parse what came back
    await expect(page).not.toHaveURL(`${BASE_URL}/dashboard`);
    await expect(page.getByText(/something went wrong|try again/i)).toBeVisible();
  });
});
```

**What this doesn't prove:** these tests exercise how the *page* behaves
when its own network layer sees a delay, an abort, or a malformed body —
they say nothing about the real backend's actual timeout, retry, or error-
response behavior, only that the frontend degrades visibly instead of
silently when it encounters those shapes. Whichever of these three
assertions actually fails against the real page is the finding: it means
that specific failure mode has no visible handling today, which
`write-playwright-test`'s own happy-path-plus-stated-failures output would
never have surfaced.

## How to invoke this skill

> "Run failure-mode-tests on this same scenario — what's write-playwright-test not covering?"

Or as a matter of course: "write the tests for this, and the failure modes,"
which is two skills' worth of output in one request.
