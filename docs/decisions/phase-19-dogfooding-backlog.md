# Phase 19 — Dogfooding Against test-assist Backlog

**Version:** 1.0
**Date:** 2026-09-16
**Status:** Draft — for review, not yet started

## Context

Emil asked for two related things: once skills exist, actually use them
rather than leave them as documentation — and specifically, run
TestForge's actual app against `test-assist` to see what it produces,
plus separately run the skills themselves directly against
`test-assist`'s codebase, as a standing pattern that repeats for each
new skill as it lands (not a one-off).

`test-assist` turns out to have two builds, and only one is reachable by
anything TestForge does:

- **Browser build** — vanilla JS, Canvas API, no build step. Served
  locally via `npm run serve` (port 4321) or live at
  `https://emil3663.github.io/test-assist/`. Already has 55 of its own
  hand-written Playwright tests (a smoke suite in CI, a regression suite
  on demand) — a real baseline to compare against, not just eyeball.
- **Desktop build** — Python, PySide6 (Qt), a native application.
  TestForge's entire pipeline is browser/Playwright-based (crawl,
  introspect, generate, run); it has no way to reach a native desktop
  app, and neither does a Playwright-authored skill like
  `write-playwright-test`. This is out of reach for this whole phase,
  not a gap to work around — stated plainly so it isn't assumed later.

This phase only targets the browser build.

Running TestForge's own app requires a live dev server (and, for
TFP-040, `test-assist`'s browser build served at the same time) staying
up across multiple steps — that needs Claude Code's persistent terminal,
not Cowork's stateless shell, which can't keep a background process
alive between tool calls.

## Scope (this phase)

### In scope
1. Run TestForge's actual app (crawl → generate → run) against
   `test-assist`'s browser build, served locally.
2. Run `write-playwright-test` directly against the same target, with no
   TestForge app involved — skill judgment in isolation.
3. Compare the two outputs against each other and against
   `test-assist`'s own existing 55-test suite.
4. Set up `examples/` as a standing location this repeats into for every
   future skill, not just this one run — matching the `examples/`
   folder `REIMAGINING.md` originally proposed ("a real suite built with
   them, warts recorded").

### Out of scope
- Building any new skills — that's TFP-035 / TFP-038 / TFP-039's job.
- Testing `test-assist`'s desktop (PySide6) build — unreachable by this
  tooling entirely.
- Modifying `test-assist` itself.

## Backlog

### TFP-040 - Run TestForge's app against test-assist's browser build

- **Phase:** 19
- **Priority:** P1
- **Suggested labels:** `dogfooding`, `integration`
- **Problem it solves:** nobody has run the actual product end-to-end
  against a real external target since Phase 16's restructuring. This
  is the first real integration check of the decomposed app, not just a
  demonstration.
- **Scope:**
  - Serve `test-assist`'s browser build locally: `npm run serve` in
    `test-assist` (port 4321).
  - Start TestForge's own dev server.
  - Run the full pipeline against it: crawl, generate, run — through
    TestForge's actual UI or API, not a script that bypasses it.
  - Capture the generated suite and the structured report as real
    files, not a description of what happened.
- **Deliverables:**
  - `examples/testforge-app/test-assist/` — the generated suite, the
    run report, and a short note on what worked and what didn't.
    Warts recorded, not cleaned up before showing.
- **Acceptance criteria:**
  - The generated suite actually ran, with real pass/fail results
    captured — not just "a suite was generated."
  - The report is saved as a reviewable artifact.
- **Dependencies:** None.

### TFP-041 - Run write-playwright-test directly against test-assist

- **Phase:** 19
- **Priority:** P2
- **Suggested labels:** `dogfooding`, `skills`
- **Problem it solves:** Emil wants to see the skill's judgment in
  isolation from the app's pipeline, and wants this to repeat for every
  future skill as it's built or promoted — it needs to be a documented,
  repeatable pattern now, not something reinvented each time.
- **Scope:**
  - Apply `write-playwright-test` (via Claude Code, no TestForge app
    involved) directly against `test-assist`'s browser build — its
    source (`app.js`, `index.html`) and the served instance.
  - Capture the resulting test file(s) as-is.
  - Write a short `examples/README.md` stating this pattern repeats for
    each future skill (`code-structure`, `refactor-audit` once
    promoted; the SRE/ISTQB candidates once built) against the same
    target, so there's a consistent baseline across skills over time.
- **Deliverables:**
  - `examples/skills/write-playwright-test/test-assist/`
  - `examples/README.md`
- **Acceptance criteria:**
  - Output captured as a real file, not summarized.
  - The repeatable-pattern note is explicit enough that a future ticket
    for a new skill can follow it without re-deriving the approach.
- **Dependencies:** None (can run in parallel with TFP-040).

### TFP-042 - Compare the three suites

- **Phase:** 19
- **Priority:** P2
- **Suggested labels:** `dogfooding`, `analysis`
- **Problem it solves:** three suites now exist for the same app —
  TestForge's own generated one, the skill-only one, and `test-assist`'s
  existing hand-written 55-test suite. Without a direct comparison,
  having three teaches nothing.
- **Scope:**
  - Run all three against the same served instance.
  - Record, per suite: what it catches that the others miss, any false
    positives, which categories (functional, responsive, accessibility,
    etc.) it's weak in.
- **Deliverables:**
  - A comparison note in `examples/` — no new tooling.
- **Acceptance criteria:**
  - Findings are specific (named test, named gap), not "roughly similar
    coverage."
- **Dependencies:** TFP-040, TFP-041.

## Recommended Execution Order

1. TFP-040 and TFP-041 (can run in parallel)
2. TFP-042

## Suggested Milestone Gates

### Gate A - First dogfooding pass complete
- TFP-040 and TFP-041 both have real, saved output in `examples/`.
- TFP-042's comparison identifies at least one concrete, specific gap or
  strength in each of the three suites.
