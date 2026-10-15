# Post-Phase 42 Review — R3 Claims Audit Findings

Date: 2026-10-16
Scope: review step R3 (`post-phase-42-review-plan.md`). The Phase 38 to 42
records, the README, `TEST_PLAN.md` and the handover are read against the code
at `6d8f7e4` and against R1's numbers (TFP-207,
`benchmarks/2026-10-15-tfp207-regression/`).
Status: findings complete. Doc fixes D1 to D6 were approved by Emil and
made from Cowork on 2026-10-16, uncommitted, for Code to commit. The Phase 39
amendment was locked the same day. The first pass (F1 to F4, S1 to S5,
U1, U2) is carried over from `post-phase-42-review-notes-2026-10-15.md`,
which stays as the working notes.

## TFP-207 verified (Cowork, 2026-10-16)

- **Accepted.** Every headline number matches the raw evidence:
  - git: `main` = `origin/main` = `6d8f7e4`;
  - node:test summaries 571, 572 and 571 of 572, with the two failures as
    reported;
  - regression `57 passed (7.8m)`;
  - template check `166 inputs, 166 identical`;
  - failures against Gate B recounted as a multiset, without the Set in
    `analyse.mts`: with-bugs +5 / −0, clean 0 / 0, and no status change on
    any test present in both runs;
  - `evidence.mjs` differs from TFP-188's only in its run list;
  - Gate B's items for 75, 80 and 82 all came from the security run;
  - bug 92's `image-alt` evidence is the same in both full reports, and
    clean has none.
- **Corrections to `outcome.md`** (doc fix, below as D1):
  1. TFP-205's link tests: **39 on with-bugs (34 passed, 5 failed) and 38 on
     clean (38 passed)**, not 38 and 37. `analyse.mts`'s `isLink` pattern
     misses the external-link title form `link "Unsplash" to https://… on …`.
     The test-count changes since Gate B (+39 and +38) agree.
  2. Gate B's items for 75 and 82 were 23 and 13, all from security. The "8"
     in the outcome is the evidence display's cut-off.
  3. `076fba5` was committed 22 s into unit run 1. So runs 2 and 3, the
     regression and the template check ran on `076fba5`'s tree, and only
     unit run 1 started on `bfd900a`'s. The difference is
     `benchmarks/` only, so no result changes.
- **Not in the report:**
  - link health ran out of its 14 s on more product routes: 13 unchecked on
    with-bugs (6 + 7), against 9 at Gate B (5 + 4);
  - Gate B's one CLS finding (0.100 on with-bugs' home page) didn't recur.
- **Not recomputed here:** the coverage map's gap counts. They need the
  repo's code to run; they are taken from `analysis.txt`.

## R1's numbers used below

| | with-bugs Gate B | with-bugs R1 | clean Gate B | clean R1 |
| --- | --- | --- | --- | --- |
| Tests | 461 | 500 | 451 | 489 |
| Failed | 84 | 89 | 46 | 46 |
| Run (wall) | 1235 s | 1535 s | 1049 s | 1131 s |
| Test time (sum of tests) | 1127 s | 1399 s | n/a | 1057 s |
| Median test | 1.61 s | 1.92 s | n/a | 1.63 s |
| Time in failing tests | 410 s | 493 s | n/a | 189 s |
| TFP-205 link tests | — | 39 tests, 104 s | — | 38 tests, 67 s |

Score, Standard only: 30 found, 0 hinted, 7 missed. Gate B's 33 needed
Comprehensive security for 75, 80 and 82.

## Findings

### False

- **F1 to F4:** as in the notes, unchanged by R1:
  - F1: the README's OpenAI GPT-4o claims;
  - F2: the README's hand-written example test;
  - F3: Phase 42 saying Phase 39's workers apply;
  - F4: TEST_PLAN known limitation 1, "in-process".
- **F5 — Phase 42 record, TFP-205 "Problem it solves":** says the in-context
  gap list "was links only (36 on clean): the template checks every element
  in context, but not links". That was not so on Gate B's own suites:
  - with-bugs had 31 element gaps, the home page's filter checkboxes and
    its sort, search and page forms;
  - clean had 5 forms and 35 links.

  R1 shows the same elements still uncovered. Correct the sentence, and
  record that "every element in context" holds only for clean's elements
  other than forms.
- **F6 — Phase 42 record and roadmap, "Load flakes to look at in the
  review":** they name `comprehensive-scenarios`, `performance-bands` and a
  Comprehensive security case. All three passed 3 of 3 in R1. The tests
  that did fail once each were `read-only-guard.test.ts:168` (TFP-199's
  beacon case) and `cookie-scope.test.ts:90`. The list is now history, not
  the current flake set. TFP-208 takes all five, plus TFP-169 and the
  regression web server timeout (below).

### Stale

- **S1 to S5:** as in the notes:
  - S1: the roadmap's Phase 41 and 42 status;
  - S2: TEST_PLAN's header, overview, feature table and roadmap;
  - S3: the handover;
  - S4: Plane named as the target;
  - S5: the scripts table.
- **S6 — the handover:** "Code's first ticket: TFP-207 … Stop for
  verification" is now done. The fresh handover (S3) says that R1 is
  verified and names the next ticket.
- **S7 — Phase 39 record, Status:** "Not started; starts after Phase 38
  Gate B". It was overtaken by Phase 40 going first (Emil, 2026-10-07), then
  41 and 42. This is replaced by the amendment drafted alongside this
  document.

### Understated, or a number missing its conditions

- **U1:** as in the notes. Also, with R1: the benchmark line should give
  both numbers and their conditions.
  - **30 of 37 found by Standard alone**, at the read-only gate on one
    worker. That is R1.
  - **33 of 37 with Comprehensive security and accessibility added.** That
    is Phase 41's Gate B.
  - Write it per local copy. The hosted copy wasn't re-run.
- **U2:** as in the notes. With R1's times: the unit suite takes 13 to
  14 min on Emil's machine and the regression suite 8 min. That sets
  TFP-210's design: the unit suite is too slow for every push, so it fits a
  nightly or manual run.
- **U3 — Phase 40 and 41, "Standard stays within 1,800 s on one worker":**
  this holds. with-bugs ran 1535 s and clean 1131 s. But with-bugs' margin
  fell from 565 s to 265 s:
  - 104 s of that is TFP-205's link tests. Each test visits its page,
    though none loads a target of its own.
  - The rest is a run about 15% slower all round: the median test went
    from 1.61 s to 1.92 s on unchanged tests.

  The app's own run timeout caps at 1,800 s too (`calculateRunTimeout`,
  `maxTimeout`), though app runs use 4 workers. The Phase 42 record's
  TFP-205 entry should state the run-time cost. Phase 39 (amended) takes
  the margin as its input.
- **U4 — TFP-205's "send no request of their own":** true of target loads,
  but silent on cost. Each link test is a fresh page visit, 104 s on
  with-bugs and 67 s on clean. Add one line to the TFP-205 entry.

### Holds (checked against R1)

- Phase 41's Standard finds: every bug Gate B found through Standard is
  found again by the same check and cause.
- Phase 41 batch 1's "clean has no unlabelled failure": R1 has the same 46,
  all labelled at Gate B.
- TFP-205's "no link left on the gap list" holds on both copies at runtime,
  not only offline (taken from `analysis.txt`).
- TFP-198's template baseline: 166 of 166 identical against `18b47d8`.
- Phase 39's Context still describes the code: Standard runs 4 workers in
  fast mode and 2 in deep mode on any host (`calculateWorkerCount`), and
  Comprehensive runs 1 off a local host (`workerCountFor`).

## Open questions for TFP-208 (from R1)

- The 5 link failures on `/#/category/hand-tools`. The page drew a
  different window of products on each load: 1 to 9 at Gate B, 6 to 14 at
  the inspection, fewer by the test.
  - Check the answer key first: a with-bugs bug that varies the category
    listing would make these true finds of a planted bug, not false
    failures.
  - Clean passed all 38.
- The regression suite's web server, a `next build` and then a start, missed
  its 120 s once.
  - Raise the timeout, or build first and start only. One or the other.
  - CI hits the same path (TFP-210).

## Doc fixes (approved by Emil 2026-10-16, made from Cowork)

| # | Fix | File |
| --- | --- | --- |
| D1 | The three corrections above | `benchmarks/2026-10-15-tfp207-regression/outcome.md` |
| D2 | S1: Phase 41 complete 2026-10-13, Phase 42 complete 2026-10-15; Phase 39 entry pointing at the amendment | `product-roadmap.md` |
| D3 | F3, F5, F6, U3, U4 as correction notes dated 2026-10-16, without rewriting the history | Phase 42 record |
| D4 | S3, S6: a short fresh handover replacing the Phase 38 one (state, rules, next ticket) | `docs/HANDOVER_TO_CLAUDE_CODE_2026-10-16-review.md`, old one deleted in the same commit |
| D5 | F4, S2: header, overview, feature table (Phases 35 to 42), roadmap pointer; limitation 1 rewritten | `TEST_PLAN.md` |
| D6 | F1, F2, S4, S5, U1 (with both benchmark numbers), U2 | README front door, last, after D1 to D5 |

All six are made. D4's new handover is
`docs/HANDOVER_TO_CLAUDE_CODE_2026-10-16-review.md`. The Phase 38 handover is
still on disk, for Code to delete (`git rm`) in the same commit. Code
commits these as `docs` commits; Cowork doesn't commit.

## Tickets

- **TFP-208 — Flakes, and the link tests on changing content** (R2):
  written in `post-phase-42-review-plan.md` under R2. It takes R1's flake
  table, the two open questions above, and Emil's two additions
  (2026-10-16):
  - the link-test design gap for content that changes between loads, which
    is decided whatever the answer key says;
  - the time headroom.
- **TFP-210 — CI runs the unit suite and the template check** (proposed in
  the notes, now with R1's times):
  - the unit suite and `check:template-unchanged`, on a nightly schedule
    and on manual dispatch, not on every push (13 to 14 min);
  - the regression job's web server timeout matching TFP-208's fix;
  - Done: both jobs green once on GitHub, their times recorded.
- **Phase 39, amended and locked (2026-10-16):** TFP-211 to TFP-215 in the
  record, with TFP-155 to TFP-158 kept. The fresh-page re-run is the narrower
  form (only after a state-changing test). It comes straight after the
  review, measurement first.
