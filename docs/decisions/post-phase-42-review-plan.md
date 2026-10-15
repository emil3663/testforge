# Post-Phase 42 Review Plan

Date: 2026-10-15
Scope: the review the roadmap lists under "After Phase 42" (Emil,
2026-10-13), in the order it is done, with who does each step and what
counts as done.
Status: Agreed with Emil 2026-10-15. Code builds and runs only from a ticket
below; planning steps happen in Cowork first.

## Order

| # | Step | Who | Ticket |
| --- | --- | --- | --- |
| R1 | Baseline: the full regression | Code | TFP-207 |
| R2 | Flakes, from R1's evidence | Code | TFP-208 (written after R1) |
| R3 | Claims audit: every phase's claims against code and measurements | Cowork, with Emil | tickets it finds |
| R4 | Small security items | Code | TFP-206, TFP-209 |
| R5 | Three decisions: the Docker sandbox, app screens, scenario gaps | Cowork, with Emil | a decision record each |
| R6 | The skills relook | Cowork, with Emil | skill proposals |

R1 comes first so every later step works from today's numbers. R3 needs
R1's numbers. R4 can run alongside R3. R5 builds nothing until a decision
record is locked. R6 is last, so the skills describe what the review left.

Progress (2026-10-16):
- R1 is verified.
- R3's findings are done and its doc fixes are made
  (`post-phase-42-review-findings.md`). TFP-210 is written there.
- R5's Phase 39 amendment is locked.
- **Order for Code (Emil, 2026-10-16):**
  1. **TFP-208**;
  2. **TFP-210**;
  3. **Phase 39**, from TFP-211;
  4. TFP-206 and TFP-209 (R4) afterwards, or between Phase 39's gates.

  TFP-208 first, so Phase 39's measurements and its same-results proof
aren't read through flakes and false failures. TFP-210 next, so a nightly
unit run guards Phase 39 while it changes how every test reaches its page.
- R5's three decision records and R6 (skills) run in Cowork alongside
  Phase 39, not before it.

## R1 — Baseline (TFP-207)

### TFP-207 — The full regression after Phase 42

- **Priority:** P1 · **Labels:** `measurement`, `benchmark`
- **Problem it solves:** the last clean full unit run predates TFP-205, the
  Toolshop score hasn't been taken since Phase 41's Gate B, and three test
  files fail once in a full run and pass alone.
- **Scope:**
  - the full unit suite three times, the regression suite once,
    `check:template-unchanged` once (against `18b47d8`: expected 166/166);
  - the Toolshop known-bug benchmark, Standard, both local copies
    (with-bugs, then clean, one at a time), Phase 40's selection unedited,
    the gap writer **off**, scored with TFP-154's rule;
  - every unit failure logged with its file, test, run number and message.
- **No Claude Code calls.** No code changes: a failure found here is
  recorded, not fixed (that is TFP-208, or a ticket from R3).
- **Acceptance criteria:**
  - evidence and a short `outcome.md` committed under
    `benchmarks/2026-10-1x-tfp207-regression/`;
  - the Toolshop score compared bug for bug with Phase 41's Gate B local
    score (TFP-188), each difference explained;
  - on clean, every failure matched to Gate B's labelled list; any new one
    named;
  - TFP-205's link tests: how many ran per copy, how many failed, and the
    in-context gap list per copy (expected: no links);
  - the flake table: each failing test, in how many of the three unit runs.
- **Time:** about 30 min of unit runs, 7 min regression, about 1.5 h for
  the two Toolshop copies. Projected times reported as it goes.
- **Stop for verification.**

## R1 result (verified 2026-10-16, Cowork)

TFP-207 accepted (`bfd900a..6d8f7e4`), with three corrections made to its
`outcome.md`. Findings and the numbers used since:
`post-phase-42-review-findings.md`.

## R2 — Flakes (TFP-208)

### TFP-208 — Flakes, and the link tests on changing content

- **Priority:** P1 · **Labels:** `flaky`, `test`, `generate`
- **Problem it solves:** R1 (TFP-207) left two kinds of unreliable result.
  - **Unit tests that fail once in three full runs and pass alone.**
  - **Five false or doubtful failures from TFP-205's link tests** on
    with-bugs' `/#/category/hand-tools`. The page drew a different window of
    products from one load to the next: products 1 to 9 at Gate B, 6 to 14 at
    R1's inspection, and 10 to 14 gone by the time the tests ran.
- **Scope:**
  1. **The unit flakes.** For each one, find the cause (timing, a shared
     resource or port, load) and fix it, or record it as a known flake with
     its cause and a ticket:
     - `read-only-guard.test.ts:168`, TFP-199's beacon case (R1 run 1:
       `sendBeacon's POST, typed ping` expected true, got false);
     - `cookie-scope.test.ts:90` (R1 run 3: a record missing from the run,
       `reading 'status'` of undefined);
     - the three named in the Phase 42 record, all of which passed 3 of 3 in
       R1: `comprehensive-scenarios.test.ts:85`,
       `performance-bands.test.ts:67`, `api-fields.test.ts:65`. Look for a
       shared cause with the two above before closing them as passing;
     - TFP-169 (security case `ECONNRESET` at fixture start-up), probably
       the same load flake as the Comprehensive security case.
  2. **The regression suite's web server.** Its `next build` and start missed
     the config's 120 s once in R1. Either raise the timeout, or build in a
     step before and only start in `webServer`. Pick one, name it in the
     commit; TFP-210's CI job uses the same.
  3. **The 5 link failures: the answer key, then the design gap.**
     - First, the answer key. Read 2026-10-16 (Cowork): no listed bug varies
       the category listing; bug 4 randomises the titles' alignment only.
       Confirm against with-bugs' `category.component` source and say whether
       the window moves by design, by data (the database or its pagination)
       or by a planted bug.
     - **Whatever it says, decide the design gap** (Emil, 2026-10-16). A link
       test written for content that changes between loads, like a rotating
       product list, fails whenever the list moves. TFP-205 doesn't
       distinguish such content today. Choose, and record the choice in the
       Phase 42 record as a ruling for Emil to confirm:
       - **skip:** links inside repeated product cards (a repeated card
         layout on a listing page) get no per-link test; the listing is
         covered by one test that its cards are present and each has a
         working link, by position rather than by name; or
       - **find by something stable:** a card link is found by a stable
         attribute or by its target's address pattern
         (`/product/:id`), not by its text, and the test passes when any
         card's link matches the pattern and loads.
     - Either way, fixture cases cover a listing whose cards change between
       loads (it must pass), and a listing whose card links are broken (it
       must still fail).
  4. **Time headroom (Emil, 2026-10-16).** Standard on with-bugs took
     1,535 s against its 1,800 s limit at R1, leaving 265 s. The fix in 3
     must not add run time. Report its cost in seconds on both local copies.
     It may lower it, since the skip option removes tests. This is also why
     Phase 39 comes straight after TFP-208 and TFP-210, measurement first
     (`phase-39-run-concurrency-decision-record.md`, locked 2026-10-16).
- **No Claude Code calls.**
- **Acceptance criteria:**
  - three full unit runs clean in a row after the fixes, or each remaining
    flake recorded with its cause, its rate in those three runs and a
    ticket;
  - the regression suite starts within its limit in three attempts in a row;
  - the 5 hand-tools failures gone on with-bugs, with the reason (answer key
    or design) recorded, and no link-test failure on clean;
  - Standard re-run on both local copies, one worker, Gate B's driver:
    - the failure sets are R1's except the 5, and any change is explained;
    - the score is still 30 found through Standard;
    - the link-test count and run time are reported against R1's (39, 38;
      1535 s, 1131 s);
  - `check:template-unchanged`: if 3 changes template output, the change is
    described and the baseline is updated in its own commit, as TFP-205's
    was;
  - `TEST_PLAN.md` cases for the changing-listing fixture, in the same
    commit as the code.
- **Time:** about 40 min of unit runs, 8 min regression, about 1.5 h for
  the two Toolshop copies.
- **Stop for verification.**

## R3 — Claims audit (Cowork)

Each phase record (38 to 42), the README, `TEST_PLAN.md` and the handover
checked against the code and R1's numbers: claims that are false, stale or
undersold. Done when the findings are listed in a review findings doc, the
doc fixes are made from Cowork, and anything needing code is a ticket.

## R4 — Small security items (Code)

- **TFP-206** (in the Phase 42 record): allow exactly
  `response.request().method()` in the code check.
- **TFP-209 — Gap writer and run environment, the two batch 3 notes.**
  - Claude Code as gap writer stops loading Emil's CLAUDE.md, memory and
    hooks: `--safe-mode` if Claude Code 2.1.238 has it (check its CLI
    reference), otherwise the nearest documented equivalent, named in the
    commit; a stand-in test shows the flag is passed.
  - The run environment passes on proxy settings (`HTTP_PROXY`,
    `HTTPS_PROXY`, `NO_PROXY`, `NODE_EXTRA_CA_CERTS`) when they are set,
    and nothing else new; a test of `runEnv` shows it.
  - Done: targeted tests, unit and regression suites pass; no Claude Code
    call.

## R5 — Three decisions (Cowork first)

Each gets a decision record locked with Emil before any code:
1. **The Docker sandbox** for gap and candidate tests: what runs inside it,
   what leaves it, and the cost in run time.
2. **App screens** for the gap-writer opt-in and candidate promotion
   (today API routes only): what Emil sees and approves.
3. **Scenario gaps,** the gap writer's redefined purpose: how a scenario
   gap is found, what Claude Code is asked, how it is measured (a benchmark
   that can discriminate, unlike TFP-197's), and the rule against
   self-confirming checks.

Done when each record is locked; its tickets then join the backlog.

## R6 — The skills relook (Cowork)

`docs/CLAUDE_SKILLS.md`, Martin's draft QA/SRE skills and the Cowork skills
read against what Phases 38 to 42 and the review changed. Done when each
skill is kept, updated or retired, and new skills for repeatable procedures
seen in this work are proposed for Emil to save.
