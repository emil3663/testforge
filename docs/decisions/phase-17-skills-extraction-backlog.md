# Phase 17 — Skills Extraction (Claude Code) Backlog

**Version:** 1.0
**Date:** 2026-09-16
**Status:** Shipped — content built out under Phases 18-21 (skills/README.md, skills/ROADMAP.md are the live source of truth); this doc's own header was never updated when the work landed. Corrected 2026-09-23 (Cowork verification pass) — see the Sept 22 handover note that first flagged this.

## Context

`docs/REIMAGINING.md` proposed rebuilding TestForge as a set of testing
skills for coding agents instead of a standalone app. That proposal was
written against `main-origin`, the pre-Phase-16 codebase (a 4,739-line
`page.tsx`, a 2,226-line `run/route.ts`, a 2,415-line `generate/route.ts`,
and a FastAPI backend). Phase 16 already deleted the FastAPI backend
entirely and decomposed all three of those files — `page.tsx` is 353
lines with no code editor, `run/route.ts` is 120 lines, and the actual
prompt content already lives on its own in `src/lib/generate/prompt.ts`
(29 lines). The literal "delete ~12,000 lines" reading of the proposal no
longer applies to a codebase that's already been decomposed and is about
to ship as test-assist.

What still holds from the proposal, reconciled against Emil's own
answers to Martin's four questions: TestForge is paused, not abandoned,
so this is additive work alongside the app, not a replacement for it
(Q1). The prompt + problem statement are worth packaging now, since the
prompt is already isolated and more skills are expected to surface as
work continues (Q2). Claude Code is the only target for now; portability
to Copilot/Cursor is an explicitly deferred follow-up (Q3). Testing is
multi-disciplinary — this backlog treats `skills/` as a growing set, and
no single skill is positioned as the product (Q4).

## Scope (this phase)

### In scope
1. A new, additive `skills/` directory at the repo root.
2. One real, working Claude Code skill built from content that's already
   isolated in the codebase (the prompt + best-practice guidance).
3. A roadmap document recording the other candidate skills from
   `REIMAGINING.md` as candidates, not commitments.
4. A spike to check whether Playwright MCP already covers the DOM
   exploration `introspect`/`crawl` currently do, before anyone commits to
   rebuilding that as a skill.

### Out of scope
- Any change to `src/app` or `src/lib` — the shipping app is untouched.
- Building `honest-coverage`, `dont-stub-what-you-prove`,
  `find-the-hidden-platform`, or `plan-to-specs` — these are recorded as
  candidates only in this phase.
- Portability to any agent other than Claude Code.
- Deleting or deprecating any part of the existing app.

## Backlog

### TFP-034 - Package the prompt and problem statement as a Claude Code skill

- **Phase:** 17
- **Priority:** P1
- **Suggested labels:** `enhancement`, `skills`, `claude-code`
- **Problem it solves:** TestForge's most differentiated asset — the
  best-practice testing judgment in `SYSTEM_PROMPT` — is currently only
  reachable by running the TestForge app. Packaging it as a Claude Code
  skill lets that judgment be used directly inside a coding agent's own
  workflow, without installing or running TestForge, and without
  touching the app Phase 16 just finished decomposing.
- **Scope:**
  - New `skills/write-playwright-test/` directory, additive only.
  - `SKILL.md` built from the existing content of
    `src/lib/generate/prompt.ts` (`SYSTEM_PROMPT` +
    `BEST_PRACTICE_GUIDANCE`), rewritten for a skill's instruction format
    rather than copied verbatim as an LLM system-prompt string.
  - A short problem statement drawn from the current README, unedited in
    substance.
  - Built and tested against Claude Code only.
- **Deliverables:**
  - `skills/write-playwright-test/SKILL.md`
  - `skills/README.md` stating this is the first of several planned
    skills, not a rename of the product.
- **Acceptance criteria:**
  - `git diff` shows zero changes outside `skills/` and the new README.
  - Running the skill in Claude Code against a real page description
    produces a Playwright test file covering the same best-practice
    categories the app's `generate` endpoint currently applies.
  - No reference to FastAPI, `app.py`, or the deleted proxy layer appears
    anywhere in the new skill.
- **Dependencies:** None.

### TFP-035 - Record the multi-skill roadmap before building a second skill

- **Phase:** 17
- **Priority:** P2
- **Suggested labels:** `documentation`, `planning`
- **Problem it solves:** Prevents the direction from quietly collapsing
  into "one flagship skill is the product" by default — testing is being
  treated as multiple disciplines, and that needs to be written down
  before a second skill gets built, not decided implicitly by whichever
  one gets built next.
- **Scope:**
  - `skills/ROADMAP.md` listing the four other candidate skills from
    `REIMAGINING.md` (`honest-coverage`, `dont-stub-what-you-prove`,
    `find-the-hidden-platform`, `plan-to-specs`) as candidates.
  - Each entry: one-line description, the existing doc or pattern it
    generalizes from, status (not started).
- **Deliverables:**
  - `skills/ROADMAP.md`
- **Acceptance criteria:**
  - The roadmap states explicitly that `skills/` is a growing set and no
    entry is marked primary or flagship.
- **Dependencies:** TFP-034.

### TFP-036 - Spike: does Playwright MCP already cover introspect/crawl?

- **Phase:** 17
- **Priority:** P2
- **Suggested labels:** `investigation`, `spike`
- **Problem it solves:** `src/lib/introspect` and
  `src/app/api/crawl/route.ts` are roughly 1,200 lines of real DOM
  exploration logic — the one part of the app REIMAGINING.md flagged as a
  genuine loss if deleted outright. Before any `find-the-hidden-platform`
  -style skill gets built, confirm whether Playwright MCP already
  provides equivalent capability, so that logic isn't duplicated and then
  maintained twice.
- **Scope:**
  - Spike only — no production code. Exercise Playwright MCP's
    page-exploration/DOM-inspection tools against 2-3 of the same pages
    `src/lib/introspect` and `crawl/route.ts` currently handle.
  - Record findings, not code.
- **Deliverables:**
  - A findings note (in `skills/ROADMAP.md` or linked from it) on the
    overlap and gap between Playwright MCP and TestForge's own
    introspect/crawl logic.
- **Acceptance criteria:**
  - Findings state plainly whether a future `find-the-hidden-platform`
    skill needs new exploration logic or can lean on Playwright MCP.
- **Dependencies:** None.

## Recommended Execution Order

1. TFP-034
2. TFP-035
3. TFP-036

## Suggested Milestone Gates

### Gate A - Phase 17 first-skill checkpoint
- TFP-034 is complete and has been run for real in a Claude Code session
  against a live page description.
- The result is reviewed against this phase's acceptance criteria before
  any decision is made to build a second skill.
