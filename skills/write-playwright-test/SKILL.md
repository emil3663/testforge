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
