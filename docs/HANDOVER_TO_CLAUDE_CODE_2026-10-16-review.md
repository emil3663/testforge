# Handover to Claude Code — Post-Phase 42 Review (2026-10-16)

This replaces `docs/HANDOVER_TO_CLAUDE_CODE_2026-10-05-phase38.md`. Delete
that file in the commit that adds this one. Its history is in git and in
the phase records.

## Read first

- `docs/decisions/post-phase-42-review-plan.md`: the review, R1 to R6, and
  the ticket you build next (TFP-208, under R2).
- `docs/decisions/post-phase-42-review-findings.md`: R3's findings, the
  numbers the review works from, and TFP-210.
- `docs/QUALITY_GATES.md`: gates, evidence and verification.
- `CLAUDE.md`: RTK. Check it with `rtk gain` at the start of a session. If
  it isn't working, tell Emil; don't reinstall it or change user-level
  settings.

## State on 2026-10-16

- **`origin/main` is at `60c1fc4`** (the review's doc commits, 2026-10-16). Phases 38, 40, 41 and 42 are complete
  (42 on 2026-10-15). The phase records hold each gate and ruling.
- **R1 (TFP-207) is verified.**
  - Unit runs: 571, 572 and 571 of 572.
  - Regression: 57/57.
  - Template check: 166/166 against `18b47d8`.
  - Toolshop score, Standard only, local copies: 30 found, 0 hinted,
    7 missed. Gate B's 33 also needed Comprehensive security.
  - Standard on one worker: with-bugs 1,535 s, clean 1,131 s.
- **R3 is done,** its doc fixes committed (`e0ce8f6` to `60c1fc4`).
- **TFP-208 is built, waiting for verification** (`decbfad` to `139f8df`,
  then `02ed0ef`; `benchmarks/2026-10-16-tfp208/outcome.md`). Standard on
  with-bugs is now 1,306 s on one worker, 494 s under the limit. Its
  card-group ruling is confirmed by Emil (2026-10-19), with the condition
  that a failing card names its product (`02ed0ef`).
- **Phase 39 is amended and locked** (2026-10-16): fewer page visits first,
  then workers, measurement before anything is built. It comes after
  TFP-208 and TFP-210, ahead of the rest of the review. Until its TFP-211 has measured, add no new Standard
  check: with-bugs has 265 s left under the 1,800 s limit.

## Commit first

Done: the order change is `980346f`.

## Next, in order (Emil, 2026-10-16)

1. **TFP-208:** flakes, the regression web server's timeout, and the
   link tests on changing content. Stop for verification.
2. **TFP-210:** CI runs the unit suite and the template check, nightly and
   on manual dispatch (`post-phase-42-review-findings.md`, Tickets).
3. **Phase 39,** from TFP-211
   (`docs/decisions/phase-39-run-concurrency-decision-record.md`).
4. **TFP-206 and TFP-209** (R4), after Phase 39 or between its gates.

TFP-208 goes first so Phase 39's measurements and same-results proof aren't
read through flakes and false failures. TFP-210 goes next so a nightly unit
run guards Phase 39.

Don't start any of them before Emil's word.

## Git

- Don't use `git stash` in this repo. Emil keeps an older stash entry.
- Don't use `git worktree` here either. A worktree linked to this repo's
  `node_modules` deleted it when removed (2026-10-07, restored with
  `npm ci`).
- To read an old version, use `git show <commit>:<path>`. To build an older
  commit, clone it to a separate folder with its own `npm ci`.

## Local Toolshop copies

- `scripts/toolshop-local/`. Docker Desktop must be started first; it isn't
  running by default.
- One version at a time. Stop each copy after use.

## TestForge's test account

- `testforgeapp@gmail.com`, with `testforgeapp+<site>@gmail.com` per site.
- Credentials are only in `.env.local` (`TESTFORGE_ACCOUNT_EMAIL`,
  `TESTFORGE_ACCOUNT_PASSWORD`). Never in a tracked file, a commit, a doc, a
  fixture, a report or a log. Never print them.
- Practice sites use their published demo accounts. Any other site waits
  for the owner's sign-off on Comprehensive testing.
- Real-site runs: never rizonetech.com (a friend's revenue-earning site).

## Standing rules

- `TEST_PLAN.md` cases go in the same commit as the code.
- Measure output changes with `npm run check:template-unchanged`; don't
  diff-read them.
- Report counts and measurements from unfiltered output (`rtk proxy`).
- Every new test names the ISTQB technique it uses.
- Until the ownership confirmation exists, the script-payload test is Not
  run, with the reason "attack-shaped input: needs the ownership
  confirmation, not built yet" (Phase 38 Decision 6).
- A decision that comes up while building goes to Emil, not into the
  ticket.
- ASVS IDs are copied from the published source, with file and version.
  Core Web Vitals bands come from web.dev. Don't change a threshold without
  a decision.
- Stop only the processes you started, by process ID, never by name.
- Conventional Commits, with the why, the alternatives rejected, and what
  the change doesn't do.
