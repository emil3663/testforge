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
| R4 | Small security items, and CI's Node version | Code | TFP-206, TFP-209, TFP-216, TFP-217, TFP-222, TFP-242, TFP-243, TFP-258 |
| R5 | Three decisions: the Docker sandbox, app screens, scenario gaps | Cowork, with Emil | a decision record each |
| R6 | The skills relook | Cowork, with Emil | skill proposals; TFP-236 to TFP-239 |

R1 comes first so every later step works from today's numbers. R3 needs
R1's numbers. R4 can run alongside R3. R5 builds nothing until a decision
record is locked. R6 is last, so the skills describe what the review left.

Progress (2026-10-16):
- R1 is verified.
- R3's findings are done and its doc fixes are made
  (`post-phase-42-review-findings.md`). TFP-210 is written there.
- R5's Phase 39 amendment is locked.
- **TFP-208 verified (Cowork, 2026-10-19):** `decbfad` to `139f8df`,
  `02ed0ef`; `benchmarks/2026-10-16-tfp208/outcome.md`. Its card-group
  ruling is confirmed by Emil (2026-10-19), on the condition `02ed0ef` meets
  (Phase 42 record). Next for Code: TFP-210.
- **TFP-210 verified (Cowork, 2026-10-19):** `4eff1dc`, `23a1338`;
  `benchmarks/2026-10-19-tfp210/`. Both nightly jobs were green once on
  GitHub, the unit step under pipefail.
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

### TFP-208 result (built 2026-10-16, verified 2026-10-19)

Commits `decbfad`, `60aac09`, `21933f7`, `4c0aca0`, `139f8df`, then
`02ed0ef` (2026-10-19, Emil's condition); runs in
`benchmarks/2026-10-16-tfp208/` (recorded in `a5a3e71`), `outcome.md` for
every number.
- **Unit flakes:** both of R1's causes found and fixed; a third
  (`hardening.test.ts`, a test ending before its run was saved) found and
  fixed. Three full unit runs on `4c0aca0`: 574/574 each. On `139f8df`:
  575/575 three times.
- **Regression web server:** builds first, `webServer` only starts. Three
  attempts on `4c0aca0` all started in time; attempt 3 found an app defect
  (an artifact asked for while its run was saved: 404), fixed in `139f8df`.
  On `139f8df`: 57/57 three times.
- **The 5 link failures:** gone, by one test per listing's cards (ruling for
  Emil). The answer key shows no planted bug; the listing's moving window
  isn't reproduced from the API.
- **Standard, both copies:** failure sets R1's but the 5; score 30 found;
  with-bugs 1,306 s (R1 1,535 s), clean 1,031 s (1,131 s).
- **Raised for Emil:** the app's own runs walk the shared `.playwright-runs`
  too (the race the unit tests had). Decided 2026-10-19: its own ticket, TFP-222 (R4),
  before Phase 39's TFP-155.
- **The ruling, confirmed (Emil, 2026-10-19), on one condition:** a failing
  card names its product. `02ed0ef`: each failing card is listed with its
  position, name, price if shown and `href`, and the test fails once naming
  them all (GEN-99). Its checks: `check:template-unchanged` against
  `980346f`, 166 of 166. Regression 57/57. Unit 574/575: the one failure was
  `performance-bands.test.ts:69` (the 3 s LCP fixture measured over 4 s, in
  a run that took 1,035 s against 659 to 731 s before, on a loaded machine).
  It passed alone afterwards (2 of 2). It is one of the three TFP-208 closed
  as passing, so it is a timing flake under load, not yet ticketed. For
  Emil.

**Verified (Cowork, 2026-10-19):** accepted.
- **Re-read from the committed files:**
  - all twelve unit and regression logs: 574/574 ×3 and 575/575 ×3; 57, 57
    and 56 on `4c0aca0`, then 57 ×3;
  - the failure sets against R1, counted as a multiset: with-bugs 0 new and
    the 5 hand-tools links gone; clean 0 and 0;
  - the run times, 1,306 s and 1,031 s;
  - the evidence by bug: the same checks as R1, with bug 4, the random
    alignment, showing 4 items instead of 2;
  - `02ed0ef`'s generated test, and a TEST_PLAN case with every code change
    (`60aac09` is configuration only).
- **Two notes:**
  - `02ed0ef`'s own check runs (unit, regression, template) are recorded in
    its commit body only, not as logs under `benchmarks/`. Accepted for a
    change this small.
  - Each card's visibility check inside `try` still waits out its own
    timeout when it fails, so the speed reason given for rejecting
    `expect.soft` applies to both. One list is the real gain.
- **`performance-bands.test.ts:69`:** recorded as D23 in
  `deferred-work-register.md`, a known flake. TFP-210's nightly run will
  show its rate.

### TFP-210 result (built 2026-10-19, verified 2026-10-19)

Ticket: `post-phase-42-review-findings.md`, "Tickets". Commit `4eff1dc`;
logs and times in `benchmarks/2026-10-19-tfp210/`.
- **`.github/workflows/nightly.yml`:** jobs `unit` and `template-unchanged`,
  at 02:00 UTC and on manual dispatch, never on push. Node 24, because both
  commands use `--experimental-strip-types`.
- **Template base:** the recorded baseline, `TEMPLATE_BASELINE` (`980346f`),
  in the workflow, or a base named at dispatch. A deliberate change of
  template output updates the baseline in its own commit. Rejected: the
  commit from 24 hours before, which goes red for one night and then green
  again with nothing recorded.
- **Regression workflow:** the separate `npm run build` is gone, so it
  builds once, as `60aac09` set up: build first, `webServer` only starts.
- **Green once on GitHub (dispatched by hand, `4eff1dc`):**
  - `unit`: 575 tests, 574 passed, 0 failed, 1 skipped (Windows only, with
    its reason). Suite 1,123 s, job 1,181 s; 659 to 731 s locally.
  - `template-unchanged`: 166 of 166 identical against `980346f`, job 22 s.
  - Regression: 57 passed, job 403 s.
- **For Emil:** the unit suite takes 1.5 to 1.7 times as long on the
  runner. It is still well inside the job's 45 min. D23's flake passed in
  this run. The first scheduled run is 2026-10-20 at 02:00 UTC.
- **Fix, `23a1338` (2026-10-19, Cowork's verification):** the unit step ran
  under `shell: /usr/bin/bash -e {0}` with no pipefail, so
  `npm run test:unit | tee` took `tee`'s exit code and couldn't fail.
  `shell: bash` on that step. Re-dispatched once (run 39317809076); the step
  header reads
  `shell: /usr/bin/bash --noprofile --norc -e -o pipefail {0}`. `unit` green:
  575 tests, 574 passed, 0 failed, 1 skipped (Windows only); suite 1,036 s,
  job 1,089 s. `template-unchanged` green: 166 of 166 against `980346f`, job
  31 s. Logs in `benchmarks/2026-10-19-tfp210/23a1338/`.

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

### TFP-216 — CI on Node 24: the app's workflows and the actions

- **Priority:** P2 · **Labels:** `ci`, `maintenance`
- **Problem it solves:** two separate Node 20 problems in CI. Found
  verifying TFP-210 (2026-10-19).
  - **The app runs on Node 20 in three workflows.** `pr-validation.yml`,
    `regression-test.yml` and `self-test.yml` set `node-version: 20`.
    - Node 20 reached end of life on 2026-04-30.
    - The nightly workflow and local runs use Node 24.
    - So CI tests the app on a runtime that neither development nor the
      nightly run uses.
  - **The actions target a deprecated runtime.** Every workflow's job log
    warns: "Node.js 20 is deprecated. The following actions target Node.js
    20 but are being forced to run on Node.js 24: actions/checkout@v4,
    actions/setup-node@v4, actions/upload-artifact@v4".
    - The forcing works today.
    - Once GitHub removes Node 20 from its runners, these actions stop
      running.
- **Scope:**
  - `node-version: 24` in all four workflows.
  - One source for the version, so the workflows and local runs can't
    drift apart:
    - an `.nvmrc` (or `engines` in `package.json`, named in the commit);
    - each `setup-node` step reading it (`node-version-file`).
  - Each action raised to its current major that runs on Node 24, every
    action the workflows use. Each version is taken from that action's own
    release notes, named in the commit.
  - Not in scope: any change to what a workflow runs or when.
- **Acceptance criteria:**
  - Each of the four workflows runs green once on GitHub, dispatched by
    hand or on its normal trigger.
  - No job log carries the Node 20 deprecation warning.
  - Each job log's `setup-node` step shows Node 24.
  - Logs and times recorded as TFP-210's were.
- **Dependencies:** TFP-210 verified. It fits with R4, after Phase 39 or
  between its gates.

### TFP-217 — The nightly run emails its summary

- **Priority:** P2 · **Labels:** `ci`, `enhancement`
- **Problem it solves:** the nightly result (TFP-210) is visible only on
  GitHub.
  - GitHub's own emails go out only on failure, and only to the account
    owner.
  - A passing night says nothing, so a quiet inbox can't be told apart from
    a workflow that never ran.
  - Emil wants a quick view of every run, with a link to the run itself.
- **Built in two parts** (Emil, 2026-10-19). The Gmail setup is postponed:
  Google blocks the security change away from his usual location.
  - **Part A, buildable now:**
    - the `notify` job;
    - the summary builder and its unit test;
    - the summary written to the run's own page (`$GITHUB_STEP_SUMMARY`),
      so each run shows it at the top on GitHub.

    No secret is needed. Until Part B, GitHub's own failure emails cover a
    red night (see Dependencies).
  - **Part B, after Emil's setup:** the send step, using the same summary.
    - Google has blocked the security change on the testforgeapp account
      for 7 days (from 2026-10-19), so the setup can be done from about
      2026-10-26.
- **Scope:**
  - **A `notify` job** in `.github/workflows/nightly.yml`.
    - It has `needs: [unit, template-unchanged]` and `if: always()`, so it
      runs whether the jobs passed, failed or were cancelled.
    - It sends nothing until both jobs have finished.
  - **Sender:** `testforgeapp@gmail.com`, through Gmail's SMTP server
    (`smtp.gmail.com`, port 465, TLS).
    - It authenticates with a Gmail app password, kept as the repository
      secret `TESTFORGE_SMTP_PASSWORD`.
    - Setup for Emil, done before the ticket is built: 2-step verification
      on the account, the app password, the secret.
    - The password never appears in code, in the log, or in the email.
  - **Recipient:** the repository variable `CI_REPORT_TO`, set to
    `testforgeapp+ci@gmail.com`.
    - It changes without a commit.
    - CI tests TestForge itself, not a site, so the tag is `ci`, not a
      site's name.
  - **Subject:** `TestForge nightly: PASS` or `FAIL`, then the short commit
    and the date, e.g. `TestForge nightly: FAIL · 4eff1dc · 2026-10-20`.
    - FAIL when either job didn't succeed, including a cancelled job.
  - **Body (plain text):**
    - **the link to the run:**
      `${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}`;
    - **the run's details:** the trigger (schedule or manual dispatch), the
      commit, the template base used;
    - **`unit`:** the job's result, and the counts from node:test's summary
      (tests, pass, fail, skipped, `duration_ms`), passed on as job
      outputs;
    - **failing tests:** the name of each, at most 20, then "and N more";
    - **`template-unchanged`:** the job's result and the check's line
      (`<base> -> <head>: N inputs, N identical, N different`);
    - **when the counts can't be read** (a job cancelled or failed before
      its summary), the body says so in place of the numbers. It never
      leaves them out silently.
  - **The send mechanism:** one of these, named in the commit with the
    reason:
    - a mail action pinned to a full commit SHA;
    - a small script under `scripts/` using a pinned `nodemailer`
      devDependency.

    Rejected: an action referenced by a movable tag, which runs whatever
    that tag points to next, with the SMTP secret in reach.
  - **A failed send** fails the `notify` job, with the reason. A missing
    email then shows on GitHub as a failed send, not as silence.
  - **Not in scope:**
    - the other workflows;
    - an HTML email;
    - the per-site report email after a site run (register D25).
- **Acceptance criteria:**
  - A unit test of the summary builder covers a passing run, a run with
    failing tests (names capped at 20), and a cancelled job with no counts.
    It checks the subject, the counts, the template line and the run link.
  - One manual dispatch delivers the email to `testforgeapp+ci@gmail.com`,
    and its link opens that run.
    - The received subject and body are recorded under `benchmarks/`, as
      TFP-210's logs were.
  - That run's log shows no part of the secret (GitHub masks it; the log is
    checked).
  - A `TEST_PLAN.md` case (TST-05) for the workflow, in the same commit as
    the workflow change.
- **Dependencies:**
  - TFP-210 verified, with its `shell: bash` fix: the email reports the job
    results, so they must be able to fail.
  - Part B only: Emil's setup above.
  - It fits with R4, after Phase 39 or between its gates.
  - **Until Part B:** GitHub emails a failed scheduled run to the account
    that last changed the workflow's schedule. It sends only on failure.
    - Setting on github.com: Settings, Notifications, Actions: "Only
      notify for failed workflows".

### TFP-222 — Each app run in a folder of its own

- **Priority:** P2 · **Labels:** `flaky`, `run`
- **Decided:** Emil, 2026-10-19, as its own ticket in R4. It was raised by
  TFP-208 (`benchmarks/2026-10-16-tfp208/outcome.md`, "Raised, not
  fixed").
- **Problem it solves:** TFP-208 found the unit tests' start-up race and
  fixed it there (`decbfad`, TST-02). The app's own runs still share it.
  - These all use the repo config, whose `testDir` is the shared
    `.playwright-runs`:
    - the executor;
    - `gap-run.ts`;
    - `stale-recheck.ts`.
  - At start-up, Playwright walks that whole folder. A folder another run
    removes mid-walk fails the run with `ENOENT ... scandir`, and the run
    executes nothing.
  - The executor also creates and removes per-run sign-in folders there.
  - Two runs at once in the app can hit it: a run while a gap run or a
    stale re-check is going.
- **Scope:**
  - **One folder per run:** every app run, gap run and stale re-check gets
    its own folder under `.playwright-runs/`, with a config whose
    `testDir` is that folder. This is TST-02's pattern, through the same
    helper or one shared with it.
  - **What moves into it:** the run's spec, reporters, report, timing file
    and sign-in folder.
  - **Saved runs are unchanged.** Persistence, artifacts and diffing read
    what they read today.
  - **The stale-folder cleanup** removes a whole run folder after its run,
    keeping TST-02's rule: a folder Windows still holds is retried and left,
    never failing a run.
  - **Not in scope:** Phase 39's split into units (TFP-155). It builds on
    these folders.
- **Acceptance criteria:**
  - **The race, reproduced:** a test starts two app runs at once while a
    third run's folder is removed mid-start. Both runs execute their tests.
    The case fails on the code before this ticket.
  - **Persistence unchanged:** a saved run's record and artifacts are the
    same as before (the regression suite passes in full).
  - **Unit suite:** passes.
  - **Template check:** every fixed input identical against the recorded
    baseline (166 when this was written; the count follows the check's
    input set). Only how runs
    are laid out changes, not the generated tests.
  - **Run time unaffected:** one Standard run on local with-bugs falls
    within TFP-211's measured spread. That keeps Phase 39's comparisons
    valid.
  - **Test plan:** a `TEST_PLAN.md` case, in the same commit as the code.
- **Dependencies and order:**
  - **Before TFP-155,** so Phase 39's unit split lands inside per-run
    folders.
  - It fits while Gate A waits for Emil's targets, with the rest of R4.

### TFP-242 — Remove an unsaved run's evidence folder in the sweep

- **Priority:** P3 · **Labels:** `run`, `maintenance`
- **Decided:** Emil, 2026-10-21, after 278 MB of leftovers were cleared from
  `.playwright-runs` (505 `artifacts-<id>` folders and about 40 run files,
  2026-08-28 to 2026-10-16).
- **Problem it solves:** saving moves a run's evidence into `runs/<id>/`
  and removes its `artifacts-<id>` folder (TFP-198). But a run that is
  interrupted before it's saved leaves `artifacts-<id>` behind. TFP-222's
  sweep removes only `run-`, `gap-` and `recheck-` folders, so the clutter
  builds up again, slowly.
- **Scope:**
  - The start-of-run sweep also removes `artifacts-<id>` folders older than
    an hour that belong to no active run and that no saved run points to.
  - The same retry-then-leave rule for folders Windows holds.
- **Acceptance criteria:**
  - **Removed:** an aged, orphaned `artifacts-<id>` is removed.
  - **Kept:** an active run's folder, a young one, and one a saved run
    points to are each kept.
  - **Test plan:** a `TEST_PLAN.md` case; unit and regression suites pass.
- **Not in scope:** saved runs in `runs/` (D29, the retention policy).
- **Dependencies:** none. It fits with R4, between Phase 39's gates.

### TFP-243 — A test's evidence listed twice gets a broken second link

- **Priority:** P2 · **Labels:** `bug`, `report`
- **Found:** 2026-10-21, checking saved runs' evidence after the
  `.playwright-runs` clean-up.
- **Problem it solves:** in 8 runs from 2026-10-20 and 2026-10-21, one
  test's report lists the same `error-context.md` twice.
  - Persistence moves the first copy into `runs/<id>/evidence/`.
  - The second move fails, and that link answers HTTP 400 ("Artifact path
    is invalid").
  - The file isn't lost: the first link serves it.
- **Scope:**
  - **Find why** the same artifact is listed twice. Likely the shared
    visit's re-run (TFP-213/214) or TFP-241's attachments.
  - **Fix it at the source:** list each artifact once.
  - **Make saving tolerant:** a duplicate artifact path is linked to the
    one moved copy, not moved twice.
- **Acceptance criteria:**
  - **A unit case:** a report with a duplicate artifact saves both links,
    and both resolve to the same file.
  - **The source case** no longer duplicates.
  - **The 8 existing runs:** report whether they can be repaired by
    re-linking (no deletion), and repair them only on Emil's word.
  - **Test plan:** a `TEST_PLAN.md` case.
- **Dependencies:** none. It fits with R4, between gates.

### TFP-258 — The template check covers every helper the generator writes

- **Priority:** P1 · **Labels:** `test`, `generate`
- **Found:** 2026-10-27, by TFP-250's fresh-context review.
  - Rewording a comment inside `controls.ts`'s generated helpers changed
    generated output.
  - `check:template-unchanged` still reported every fixed input identical,
    because none of its 166 inputs reaches those helpers.
  - The check is the proof that a change leaves users' suites alone, so a
    blind spot in it is a gap in that proof.
- **Scope:**
  - **List every helper** the generator can write into a suite (the
    `tf*` helpers and their kin), and which fixed input reaches each.
  - **Add fixed inputs,** or extend existing ones, until every helper is
    reached. Record the new inputs, and move the baseline in its own commit.
  - **Add a unit test** that fails if a helper the generator can emit is
    reached by no fixed input. Gaps then can't reopen as helpers are added.
- **Acceptance criteria:**
  - **Coverage:** every emitted helper is reached by at least one fixed
    input, shown by the new test.
  - **Proof the gap is closed:** rewording a comment in `controls.ts`'s
    helper makes `check:template-unchanged` report the input as different.
  - **Test plan:** a `TEST_PLAN.md` case.
- **Then (Emil, 2026-10-27):** the two generated comments that still name
  the owner (`controls.ts`, "(Emil, 2026-10-12)" and "Emil's look at the
  control counts") are reworded to the decision vocabulary ("owner
  decision, <date>"). The baseline moves in its own commit, now measured
  by the check.
- **Dependencies:** none. Before the comment rewording. It fits with R4.

## R5 — Three decisions (Cowork first)

**Done 2026-10-20 (Emil):** all three are locked. Their build order is in
`deferred-work-register.md`.
- **Scenario gaps:** `phase-44-scenario-gaps-decision-record.md`, tickets
  TFP-223 to TFP-227. It also answers D6.
- **The Docker sandbox:** `phase-45-docker-sandbox-decision-record.md`,
  tickets TFP-228 to TFP-231.
- **App screens:** `phase-46-app-screens-decision-record.md`, tickets
  TFP-232 to TFP-235. It covers the site lookup, the confirmation form,
  promotion and the active switch.

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

**Done 2026-10-20 (Emil):** `r6-skills-relook-2026-10-20.md`.
- **Verdicts:**
  - 7 skills kept;
  - 2 updated (`write-playwright-test`, and `crawl-and-classify-pages`,
    which settles D12);
  - 4 of Martin's proposals adopted (`sre-testing`, `sre-agents`,
    `sre-overload`, `sre-release`);
  - 12 left proposed, with a note to Martin.
- **D20:** no new run-time rules; the skills are proven by known-answer
  cases.
- **`docs/CLAUDE_SKILLS.md`:** resynced.
- **Tickets:** TFP-236 to TFP-239, built with R4 (after Phase 39 or between
  its gates).

`docs/CLAUDE_SKILLS.md`, Martin's draft QA/SRE skills and the Cowork skills
read against what Phases 38 to 42 and the review changed. Done when each
skill is kept, updated or retired, and new skills for repeatable procedures
seen in this work are proposed for Emil to save.
