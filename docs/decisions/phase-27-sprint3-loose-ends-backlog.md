# Phase 27 — Close Out Sprint 3 Loose Ends

**Version:** 1.0
**Date:** 2026-09-23
**Status:** Complete. TFP-078/079 `955601e`, TFP-080 `abb94f0`, TFP-082 `6f90a0e` (all 2026-09-23). TFP-081's three pieces landed separately: the help panel in `8be5dd7`, the README update in `e231a8b`, and `.clinerules` is in `.gitignore`. Reconciled with git 2026-09-29.

## Context

Sprint 3 (Phase 24, TFP-065-070) landed and was verified ticket-by-ticket
against the actual repo, not just the report — all four remaining commits
(`a95027a`, `2bd1b32`, `f54e9e1`, `3f3e7ac`) check out. Re-running the
project's own `npm run lint` as part of that verification surfaced 15
pre-existing errors that none of those four commits introduced (confirmed:
none of the flagged files appear in any of the four diffs), plus a handful
of other loose ends accumulated across the last few sessions. Emil's call:
resolve all of it before picking the next roadmap item, rather than
carrying it forward.

Nothing here is new functionality — this phase is entirely cleanup,
config correction, and finishing verification that was legitimately
deferred (not skipped) in Sprint 3.

## Backlog

### TFP-078 - Scope `no-require-imports` correctly: exclude `skills/` from the app's eslint config

- **Phase:** 27
- **Priority:** P1
- **Suggested labels:** `tech-debt`, `config`
- **Problem it solves:** `eslint.config.mjs`'s `ignores` list excludes
  build artifacts (`.next`, `out`, `build`, etc.) but not `skills/`, so
  `skills/testing/plan-to-specs/*.js` gets linted under
  `eslint-config-next`'s ESM-only ruleset and fails
  `@typescript-eslint/no-require-imports` on 4 lines across 3 files. This
  is a scoping bug, not a style violation: those files are standalone,
  `#!/usr/bin/env node`-shebanged CommonJS scripts, shipped as part of the
  `testforge-skills` plugin for someone else's repo to run directly with
  plain Node — they were never meant to be linted as if they were part of
  this Next.js app's own ESM source tree.
- **Scope:**
  - Add `skills/**` to `eslint.config.mjs`'s `ignores` array.
  - Confirm no other directory outside `src/` is silently being linted
    under the same mismatched assumption (a quick check, not a full
    audit — this backlog isn't asking for a general eslint-scope review
    beyond what's already been found).
- **Deliverables:** Updated `eslint.config.mjs`.
- **Acceptance criteria:** `npm run lint` no longer reports the 4
  `no-require-imports` errors; skills' own tests (if any exist for
  `plan-to-specs`, e.g. `npm test` inside that directory, or however that
  skill runs its own suite) still pass — this is a lint-scope fix, not a
  code change to the skill itself.
- **Dependencies:** None.

### TFP-079 - Split `actionable-elements.ts` along its existing function boundaries

- **Phase:** 27
- **Priority:** P2
- **Suggested labels:** `tech-debt`, `refactor`
- **Problem it solves:** `src/lib/generate/mock/actionable-elements.ts` is
  517 lines, 17 over this repo's own `max-lines: 500` cap (scoped to
  `src/**/*.ts(x)`, and enforced for real — TFP-068 extracted
  `pollRun.ts` specifically to respect it). Unlike `dom-snapshot.ts`
  (see TFP-080), this file has no `page.evaluate()` serialization
  constraint — it's imported normally by `demoqa-suites.ts`,
  `generic-suites.ts`, and `link-audits/index.ts` — and already has 5
  clearly separable top-level exported functions
  (`buildActionableElementTests`, `buildToggleGroupTests`,
  `buildAccessibilityElementTests`, `buildUsabilityElementTests`,
  `buildActionPairTests`), so a real split is low-risk here, not just
  theoretically possible.
- **Scope:**
  - Extract along the existing function boundaries into sibling files
    (naming and exact grouping is Code's call — e.g. one file per
    function, or grouping the two small private helpers
    `activeAriaStateField`/`elementWords` with whichever exported
    function actually uses each).
  - Re-export from `actionable-elements.ts` (or update the three
    importing files directly) so nothing calling into this module today
    has to change its import path unless that's the cleaner outcome —
    Code's call, state which was chosen and why.
  - This is an extraction, not a rewrite: follow
    `behavior-preservation-verification` — prove output is unchanged via
    an actual before/after fixture diff on generated test output, not by
    reading the diff and asserting it looks equivalent.
- **Deliverables:** The split files; updated imports; a fixture-diff
  proof of unchanged output.
- **Acceptance criteria:** No file in this module exceeds 500 lines;
  `npm run test:unit` and the existing regression suite both still pass;
  the fixture-diff proof is included in the commit message or as a
  committed artifact, not just asserted.
- **Dependencies:** None.

### TFP-080 - Document, don't split, `dom-snapshot.ts`'s max-lines exception

- **Phase:** 27
- **Priority:** P2
- **Suggested labels:** `tech-debt`, `config`
- **Problem it solves:** `src/lib/introspect/dom-snapshot.ts` is 817
  lines, but it is **not** a normal candidate for extraction the way
  TFP-079's file is. The file's own existing comment (lines 10-14) states
  why: `captureDomSnapshot` is passed by reference to Playwright's
  `page.evaluate()`, which serializes the function's own source and runs
  it inside the browser's isolated JS context with no access to this
  module's scope — every helper it uses must stay nested inside its body,
  because there is no module system or import mechanism available at
  runtime in that context. Splitting it into separate files, however
  clean-looking in the diff, would silently break real page introspection
  the moment it runs against a live page, since the extracted helpers
  would no longer be reachable inside the serialized function. Treat the
  existing in-file comment as authoritative — verify the constraint is
  still real (check `dom-snapshot.ts`'s own call site for
  `page.evaluate(captureDomSnapshot, ...)` or equivalent) rather than
  taking the comment itself as sufficient proof, then fix the tooling
  gap it exposes rather than the file.
- **Scope:**
  - Confirm the `page.evaluate()` call site and that it does pass this
    function by reference (not by re-implementing its body as a string
    or similar) — this is the one fact this ticket needs verified
    firsthand, not assumed from the comment.
  - Add a scoped `max-lines` override for this one file (an
    `eslint.config.mjs` block keyed to its exact path, or a targeted
    `/* eslint-disable max-lines */` at the top of the file with a
    comment pointing back to the existing rationale) — whichever this
    repo's existing eslint-disable conventions (if any) already favor.
  - Do not extract, rename, or otherwise restructure
    `captureDomSnapshot`'s internals as part of this ticket.
- **Deliverables:** The scoped lint exception; a one-line note in
  `README.md`'s Known Limitations section (or wherever the doc-audit's
  earlier work landed similar notes) stating this file is intentionally
  long and why, so a future contributor doesn't rediscover this from
  scratch.
- **Acceptance criteria:** `npm run lint` no longer flags
  `dom-snapshot.ts`; every other file under `src/**` is still held to the
  500-line cap (this is a named, single-file exception, not a general
  loosening of the rule).
- **Dependencies:** None.

### TFP-081 - Commit the outstanding uncommitted work sitting in the tree

- **Phase:** 27
- **Priority:** P1
- **Suggested labels:** `chore`
- **Problem it solves:** Several pieces of already-finished, already-
  verified work are sitting uncommitted:
  - TFP-077 (the in-app help panel) — `src/app/_components/HelpPanel.tsx`
    and the `page.tsx` wiring, independently verified (tsc/eslint clean,
    all five content sections present, dismiss behavior confirmed).
  - The `README.md` doc update (Skills library section, the honest-
    coverage and run-diffing bullet updates) from the earlier
    `repo-claim-audit` pass.
  - `.clinerules` was agreed (Cowork session, 2026-09-23) to be added to
    `.gitignore` rather than committed as a tracked file — that
    `.gitignore` entry was never actually added; `.clinerules` is still
    untracked.
- **Scope:**
  - Commit TFP-077 and the README update as their own appropriately-
    scoped commits (they're unrelated changes — don't squash them
    together).
  - Add `.clinerules` to `.gitignore` in its own small commit.
  - Leave `docs/HANDOVER_TO_CLAUDE_CODE_2026-09-22.md` untracked and
    uncommitted — that exclusion was deliberate (it contains a stale
    claim, see that session's notes) and still stands.
- **Deliverables:** The commits described above.
- **Acceptance criteria:** `git status` is clean except for
  `docs/HANDOVER_TO_CLAUDE_CODE_2026-09-22.md`, which stays untracked on
  purpose.
- **Dependencies:** None, but do this after TFP-078-080 land so this
  isn't the commit that also happens to fix unrelated lint errors.

### TFP-082 - Restore the local dev server and complete the live-browser verification Sprint 3 deferred

- **Phase:** 27
- **Priority:** P1
- **Suggested labels:** `reliability`, `testing`
- **Problem it solves:** TFP-068 and TFP-069 both shipped with solid
  automated proof (real unit tests against the actual production poll
  loop; a child-process test reading the real CSP header function) but
  explicitly deferred live-browser verification because the pre-existing
  dev server on `:3000` hit an unrelated Turbopack/Tailwind internal
  error mid-session and was correctly left alone rather than restarted
  without authorization. It's still down. Emil wants nothing left
  unresolved before moving on, and this is the one piece of Sprint 3
  that's genuinely still open, not just under-verified.
- **Scope:**
  - Diagnose and fix the Turbopack/Tailwind error that's currently
    crashing `next dev` on `:3000` (not touched or diagnosed yet — this
    ticket is where that actually happens).
  - Once the dev server is healthy, complete the live-browser
    verification that TFP-068's commit message describes as attempted-
    but-not-completed: a real generate+run cycle with the poll request
    intercepted to fail exactly once, proving the retry/backoff visibly
    works end-to-end, not just at the unit level.
  - Do the equivalent for TFP-069: a real `next build && next start`
    (or an equivalent that doesn't collide with the shared `.next`
    directory the way the commit message flagged) confirming the actual
    served response headers omit `unsafe-eval` in production.
- **Deliverables:** A working local dev server; real captured evidence
  (network log, screenshot, or equivalent) for both live checks, not a
  restated summary of the unit-test proof that already exists.
- **Acceptance criteria:** `next dev` runs cleanly on `:3000` with no
  startup errors; TFP-068's retry/backoff is observed live, not just
  proven at the unit level; TFP-069's production CSP header is confirmed
  from an actual served response.
- **Dependencies:** None, but do this first if the Turbopack/Tailwind
  error turns out to affect anything else being worked on in this phase.

## Recommended Execution Order

1. TFP-078 (quick, unblocks a clean lint baseline)
2. TFP-082 (the dev server fix may be needed for other verification work
   anyway — worth doing early rather than last)
3. TFP-079 and TFP-080 (independent of each other and of the above)
4. TFP-081 (last, so it doesn't bundle in changes from 078-080)

## Suggested Milestone Gates

### Gate A - Sprint 3 genuinely closed, nothing carried forward
- `npm run lint` and `npx tsc --noEmit` are both fully clean, repo-wide.
- `git status` is clean except for the one deliberately-untracked
  handover doc.
- TFP-068 and TFP-069 both have real live-browser evidence, not just
  unit-level proof.
