# Phase 26 — In-App Help for Non-Technical Users

**Version:** 1.0
**Date:** 2026-09-23
**Status:** Draft — for review, not yet started

## Context

TestForge's own UI assumes the person using it already knows what "crawl",
"introspect", a Playwright suite, or a coverage tab mean. That's a
reasonable assumption for the developers who've been building it, but not
for someone non-technical who lands on the running app cold.

A `repo-claim-audit`-style pass on `README.md` (Cowork session, 2026-09-23)
surfaced that the README itself had drifted from what TestForge had grown
into — separately, that same conversation noted there's no in-app
equivalent explanation at all, for any audience. The actual help copy has
already been written and staged at `docs/help-content-draft.md` (plain
language, no unexplained jargon, covers what TestForge is, the five-step
flow, what each report tab means, and a short FAQ) — this ticket is about
building the UI around that content, not writing it again.

## Scope

### In scope
1. TFP-077 below.

### Out of scope
- Rewriting the report tabs' own copy — this is a supplementary explainer,
  not a redesign of the app itself.
- Multi-language content — English only for now.

## Backlog

### TFP-077 - Add an in-app "?" help panel for non-technical users

- **Phase:** 26
- **Priority:** P2
- **Suggested labels:** `ui`, `docs`, `accessibility`
- **Problem it solves:** the running app has no explanation of what it does
  or how to use it aimed at someone without a dev background — someone who
  lands on the page cold has to already know what "crawl", "coverage", or a
  Playwright suite is before any of it makes sense.
- **Scope:**
  - Add a `?` icon button to the header (`src/app/page.tsx:228-250`),
    placed at the far right of the existing logo/title row (`ml-auto`),
    styled consistently with the existing indigo/zinc header treatment.
  - Clicking it opens a dismissible panel — click-outside, Esc, and an
    explicit close control all need to work. Follow the existing
    overlay-component pattern already used by
    `src/app/_components/RunProgressOverlay.tsx` (a props-driven overlay)
    rather than introducing a new modal pattern into the codebase.
  - Content comes from `docs/help-content-draft.md`, already written in
    plain language for a non-technical reader — convert its five sections
    (what TestForge is, the step-by-step flow, the report-tab glossary,
    things worth knowing, FAQ) into the panel's content.
  - The panel must not block or interrupt an in-progress run — it's
    optional reference material, not a required step or a blocking modal.
- **Deliverables:**
  - New component (e.g. `src/app/_components/HelpPanel.tsx`) wired into
    `page.tsx`.
  - `docs/help-content-draft.md` deleted once its content is live in the
    component — its purpose (staging for review) is done at that point,
    same as this repo's other staging docs once integrated.
- **Acceptance criteria:**
  - The `?` icon is visible on first load with no app state required
    (works before any base URL or description is entered).
  - The panel opens and closes correctly: icon click, Esc, click-outside,
    and the explicit close control all verified.
  - All five sections from the draft content are present, in substance
    unchanged from the draft.
  - `docs/help-content-draft.md` no longer exists in the tree once done.
- **Dependencies:** None.

## Recommended Execution Order

1. TFP-077 (single ticket this phase)

## Suggested Milestone Gates

### Gate A - in-app help shipped
- TFP-077 done, verified in a real browser session (not just at the
  component level), and the staging doc removed.
