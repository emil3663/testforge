---
name: honest-coverage
description: >
  After writing or reviewing a set of tests, state per test or per group what
  is actually proven and what remains unproven, using a Stable/Moderate/
  Blocked rating with the specific reasoning behind each rating — not a
  generic "tests may not cover everything" disclaimer. Use this skill right
  after producing test coverage, or when reviewing someone else's, whenever
  the point is to be honest about what a green run does and does not mean.
---

# State what a test suite actually proves

## The gap this closes

A reviewer who counts spec files concludes there's a large suite. A reviewer
who opens one concludes the opposite. `cah-pwa/tests/README.md` states this
plainly rather than letting the count imply coverage that isn't there: 229
Playwright spec files, 228 of them generated scaffolds, 225 of those still
calling `test.skip()`, 1 file actually implemented, holding 4 tests and 13
assertions. The generator is worth showing; the file count presented as
coverage is not.

The same gap exists inside a single green run, not just across a file tree —
"331 passed" says nothing about whether those 331 are deterministic, timing-
dependent, or standing in for something that was never actually exercised.
That's what this skill states explicitly, test by test.

## Inputs you need from the user

1. **The tests** — a file, a suite, or a diff to review.
2. **What each test actually does** — read it, don't infer from its name. A
   test named `test_launcher_dock_right...` and one asserting a tooltip
   string are not the same kind of claim.
3. **What's substituted** — any stub, mock, monkeypatch, or offscreen/headless
   platform constraint already in play, since that's what turns "stable" into
   "moderate."

## Output format

A rating per test or per tightly-related group — never one rating for a
whole file — using this scheme:

| Rating | Meaning |
|---|---|
| **Stable** | Deterministic. No timing dependency, no substituted API, no external system. |
| **Moderate** | Deterministic in behaviour, but depends on timing, a substituted API/object, or an external system whose state isn't controlled by the test. |
| **Blocked** | Cannot be verified in this environment at all — needs real hardware, a real network endpoint, or a human. |

For each Moderate or Blocked entry, name the specific thing that's
substituted or missing, not just the category. "Moderate — depends on
network" is a category. "Moderate — depends on `https://example.com` staying
reachable and `test.user@example.com` remaining a valid, unrate-limited
account; nothing in the test controls either" is the rating this skill asks
for.

Close with what the suite as a whole does not prove — the thing a green run
doesn't mean, stated once, specifically, for this suite.

## Rules

**Rate per test or group, not per file.** A file mixing stable assertions
with one network-dependent test is not "mostly stable" — say which lines
are which.

**Name the substitution, not just that one exists.** "Uses a stub" is a
category. "Substitutes `QScreen` so the test proves screen-picking logic, not
that a real display returns the pixels this pixmap claims" is a rating.

**Measure test counts with the runner, not by reading source.** A
parametrised or loop-generated test is invisible to a source-level count —
`playwright test --list` / `pytest --collect-only -q` report what actually
exists. A claim audit that counts `test(` calls in source can produce a
confident, wrong "this is overstated."

**A green run is a specific, quotable number, not "the tests pass."** State
it the way it would need to be checked: "47 tests, 0 failures" not "the suite
is green."

**Don't blend "not automatable here" with "not tested."** Blocked is not a
failure grade — it's an honest statement that a manual pass covers this case,
and that pass should be named, not implied.

**No generic disclaimer.** "These tests may not cover every scenario" is true
of every suite ever written and says nothing. If the specific reasoning can't
be produced for a case, that's a sign it hasn't actually been read yet.

## Worked example

**Applied to `write-playwright-test`'s own worked example** (the login-page
test file in that skill's `SKILL.md`) — using it as the input, since it's
the most immediately available real test file in this repo's own skills:

| Test | Rating | Reasoning |
|---|---|---|
| `user can sign in with valid credentials and lands on the dashboard` | Moderate | Deterministic in its own logic, but depends on `https://example.com` being reachable and `test.user@example.com` / `correct-horse-battery-staple` remaining a valid, non-expired, non-rate-limited account — nothing in the test controls either, and neither is seeded or reset between runs. |
| `invalid credentials show an inline error without navigating away` | Moderate | Same external-reachability dependency as above, plus the error assertion is a soft regex (`/invalid\|incorrect/i`) — it would pass against unrelated text containing either word, so it proves *an* error-shaped message appeared, not that it's the correct one. |
| `login form is usable at ${viewport.name} size` (×3, phone/tablet/desktop) | Moderate | Same external-reachability dependency; also proves the three controls stay in the DOM and visible at each viewport, not that the layout is legible or that touch targets are large enough to actually use on a phone — "usable" in the test name is a stronger claim than the assertions back. |

**What this suite does not prove:** that the login flow survives a real
network hiccup mid-request (no failure-mode test — see `failure-mode-tests`
for that gap specifically), that the session established on success persists
across a reload, or that either test account stays valid over time since
nothing here seeds or resets it. All five tests are Moderate, not Stable —
there is no Blocked case here because nothing requires hardware or a human,
but there is also no Stable case, because every assertion routes through a
live external URL this suite doesn't control.

## How to invoke this skill

> "Run honest-coverage over this suite before we call it done."

Or after `write-playwright-test` produces a file: "now rate what that
actually proves."
