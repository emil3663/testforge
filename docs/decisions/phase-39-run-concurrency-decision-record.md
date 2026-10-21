# Phase 39 Decision Record — Run Speed: Fewer Page Visits, Then Workers

Date: 2026-10-06; amended 2026-10-16
Scope: make Standard and Comprehensive runs faster without changing any
test's result. The phase works in this order:
1. measure where run time goes;
2. visit each page once for its read-only checks, across areas;
3. share pages for functional checks by kind of control;
4. tune the settle wait and the read-only timeouts;
5. spread the work over Playwright workers, with how many workers a run may
   use set per kind of host, and ownership permission lifting the cap.

Tests that change data still run one at a time.

Status: Locked. Decisions 1 to 6 of the original record (now Decisions 8
to 13) were locked 2026-10-06 and approved by Emil, including the owner's
sign-off on Comprehensive testing removing the caps with no separate ask
(now Decision 10) and the recommended values. The 2026-10-16 amendment
(Decisions 1 to 7, the changes to Decisions 8, 11, 12 and 13, and TFP-211
to TFP-215) was locked by Emil on 2026-10-16, with the narrower re-run in
Decision 4. **Gate A passed 2026-10-20:** TFP-211 is verified, and Emil
locked the targets (see "Gate A — targets locked" below). **Phase 39 is next after TFP-208 and TFP-210** (Emil, 2026-10-16;
see Dependencies and order).

## Context

### As of 2026-10-06 (unchanged)

- **Comprehensive** runs one worker on any host that isn't a local
  development host (Phase 35 Decision 2), "so it doesn't load the site like
  an attack would". As Comprehensive grows to cover every area and the
  30 APG patterns, one worker running everything gets slow.
- **Standard** runs with 4 workers in fast mode and 2 in deep mode
  (`calculateWorkerCount`, `src/lib/run/executor.ts`), on any host. So the
  two runs follow different politeness rules on the same site. This was
  still true at `6d8f7e4`.
- **Phase 38 TFP-150** measured Standard with one worker: 954 s on
  practicesoftwaretesting.com. Real runs from the app use 4.
- Workers are separate browsers running in parallel. However the tests are
  divided, N workers means up to N browsers hitting the site at once. So the
  limit belongs to the host, not to how the tests are split.

### Added 2026-10-16: where the time goes

- **The phase was overtaken, not dropped.** Phase 40 went first (Emil,
  2026-10-07), then 41 and 42. Since the original record, Standard has
  gained a test for every link (TFP-205) and checks from Phase 41, and
  every page visit waits for the network to settle, up to 5 s (TFP-167).
- **TFP-197's clean re-run, one worker:** 468 tests, 446 page visits, a
  median test of about 1.5 s, about 17 min of test time. Almost every test
  loads its page afresh.
- **TFP-207 (R1), Standard on one worker:**
  - with-bugs: 500 tests, 1535 s run, 1399 s of test time; the 89 failing
    tests take 493 s of it (35%);
  - clean: 489 tests, 1131 s run, 1057 s of test time; the 46 failing tests
    take 189 s;
  - TFP-205's link tests: 39 tests and 104 s on with-bugs, 38 tests and
    67 s on clean. Each is a page visit for a link that link health, the
    linked-routes check or the navigation-link check often visits already;
  - link health stops after 14 s and left 13 product routes unchecked on
    with-bugs (9 at Gate B);
  - with-bugs' margin under Phase 40 and 41's 1,800 s on one worker fell
    from 565 s to 265 s. The app's own run timeout also caps at 1,800 s;
  - the same unchanged tests ran about 15% slower than at Gate B (median
    1.61 s to 1.92 s). One run per side can't show a gain smaller than
    that.
- **Workers alone multiply the visits.** N workers spread the same visits
  over N browsers on the same site. Cutting the visits first also lowers
  the load each worker adds, which matters on capped hosts (Decision 10).

## Decisions

### Added 2026-10-16

1. **Measure first, and set the targets before building.**
- Per run, TFP-211 records:
  - time in page loads and in settle waits;
  - how many visits hit the 5 s settle cap;
  - time failing tests spend waiting out timeouts;
  - page visits per page, per area;
  - the overlap left between areas: link health, TFP-205's link tests, the
    linked-routes check and the navigation-link check visiting the same
    targets;
  - the functional controls on each selected page, counted by Decision 3's
    kinds, as data for Emil's later look.
- Measured on the fixture and on both local Toolshop copies, Standard and
  Comprehensive (every area), one worker, **three runs each**, so the
  run-to-run spread is known.
- From these, the keep-or-revert target for Decisions 2 to 6 and the
  revised one for Decision 13 are written into this record and locked by
  Emil **before TFP-212 starts.** The amendment does not guess them now.

2. **One visit per page for read-only checks, across areas.**
- The read-only checks of every area run on one shared visit of the page:
  functional, accessibility, SEO, usability and passive security.
- Each check is still its own test, with its own result, under its own
  area in the report.
- Passive security needs the page's load-time requests and responses. They
  are recorded on the shared visit from before the load starts, and handed
  to each check.
- A failing check must not stop the page's other checks from running.
  (Playwright's serial mode skips the rest of a group after a failure, so it
  can't be the mechanism as it stands.)

3. **Functional checks share pages by kind of control.**
- **In place** (radio buttons, toggles, tabs, accordions, anchors, a link's
  presence): the loaded page is shared. A test that changes something puts
  it back.
- **In-app navigation** (single-page apps, such as a sidebar that swaps the
  main pane): the clicks are chained on one loaded app. Each check confirms
  the pane really changed to its target, by address and by content, so it
  can't pass on the previous link's content.
- **Full navigation** (multi-page sites): the target loads anyway. The test
  returns with back rather than a fresh load.
- How many controls fall into each kind is looked at later, from TFP-211's
  count (Emil). Until then, a control whose kind isn't clear keeps its own
  fresh page.

4. **Rules for shared pages.**
- After a failure, the page is reloaded before the next test (Emil).
- After a test that left the page, the page is reloaded.
- A test that types clears what it typed, pass or fail.
- **A failure is re-run on a fresh page only when a state-changing test ran
  before it on the same visit** (Emil, 2026-10-16). The fresh result is the
  one reported, and both are recorded.
  - A read-only check on an untouched page sees what a fresh page would,
    so its failure stands as it is.
  - Why not re-run every failure: with-bugs had 89 failures at R1, about
    5.5 s each. Re-running them all would add up to about 490 s and cancel
    much of the saving on a buggy site.
  - "State-changing" means any test that clicked, typed, toggled or
    navigated on the shared page (Decision 3's kinds), whether or not it
    put the page back.
- Proof on the fixture: every test gets the same result shared and
  one-page-per-test.

5. **These keep their own fresh page:**
- performance (it measures the load itself);
- responsive (the viewport is set before the load);
- cookie and session checks (they need a clean state);
- everything at the interactive or active gates;
- gap-writer and candidate tests (Phase 42), which also stay in
  Comprehensive, outside the verdict.

6. **Tune the settle wait and the read-only timeouts from the
   measurements.**
- TFP-167's 5 s settle cap, link health's 14 s, and the 30 s per test are
  set from TFP-211's numbers. Each change is measured against the locked
  target, with the same-results proof.
- Not changed by this decision: what counts as settled, and any check's
  pass rule.

7. **Results don't change; the suite's shape does.**
- Decisions 2 to 4 change how tests reach their page, so test bodies change
  and `check:template-unchanged` will differ.
- That difference is accepted deliberately, as TFP-205's was, with the
  baseline updated in its own commit.
- The proof that nothing else changed is the results:
  - on the fixture, every test's result is the same shared and
    one-page-per-test;
  - on both local Toolshop copies, the failure set is the same as R1's,
    test by test, apart from differences explained one by one;
  - the Toolshop score is unchanged.

### Locked 2026-10-06 (renumbered; amendments marked)

8. Work is split into units, and Playwright hands the units out to workers
   from a shared queue.
- ~~TestForge writes one test file per area. An area with page-level tests
  gets one file per page.~~ **Amended 2026-10-16:** the unit for
  read-only work is **a page**, meaning its shared visit with every area's
  read-only checks (Decision 2), not an area. Site-wide tests,
  fresh-page tests (Decision 5) and the serial group (Decision 9) get files
  of their own.
- Workers take the next unit as soon as they are free. Areas are not
  assigned one per worker: they differ a lot in size, and a fixed split
  leaves workers idle.
- The report groups results by area and page exactly as today, whichever
  worker or file ran them.

9. Tests that change data run one at a time.
- Interactive and active tests (journeys, the database round trip, form
  submissions, model-written blocks) run in one serial group. They never run
  alongside each other, so one test's saved data can't change another's
  result.
- Read-only tests run in parallel freely.
- The serial group runs after the read-only tests, never alongside them, so
  no read-only check sees half-saved data (Emil, 2026-10-06).

10. The worker limit depends on the host. Ownership permission removes the
    cap.

   | Host | Workers | Request cap |
   | --- | --- | --- |
   | Local development host (`localhost`, `127.0.0.1`, `[::1]`, `*.localhost`, `*.test`) | Limited only by the machine | None |
   | Host with the typed ownership confirmation (Phase 35 Decision 8) | Limited only by the machine | None |
   | Any other host | At most 3 | 5 requests per second, shared by all workers |

- **Ownership permission (decided by Emil, 2026-10-06):** the owner's
  sign-off on Comprehensive testing, the typed confirmation of Phase 35
  Decision 8, is all it takes. There is no separate question, setting or
  confirmation for concurrency.
  - Once that confirmation is saved with the run, the worker cap and the
    request cap are both removed and the run goes all out. It is limited
    only by the machine.
  - The report records that the caps were lifted, and why (Decision 11).
  - **Amended 2026-10-19 (Emil; Phase 43 Decision 14):** "once that
    confirmation is saved with the run" now reads "once the site has a
    valid confirmation covering the host". Phase 43 saves it with the site:
    confirmed once, until it expires or is withdrawn.
    - Nothing else in this decision changes.
    - TFP-157 still tests the row with a stub. Phase 43's TFP-220 replaces
      the stub.
- **"Limited only by the machine"** means half the machine's CPU cores,
  Playwright's own default, and at least 1.
- **Until Decision 8 is built,** no remote host can carry the confirmation,
  so every remote host gets the capped row.
- **On a capped host,** the request cap is what keeps the run polite. All
  workers share it, so three workers put no more load on the site per second
  than the cap allows, however many tests they run. Without the cap, a
  capped host gets one worker, as today.
- **One rule for both runs:** this replaces Phase 35 Decision 2's
  one-worker rule and Standard's fixed 4 and 2.
- **Not load testing:** even uncapped, more workers spread ordinary
  browsing-level tests. Load testing stays its own opt-in run behind the
  active gate, as agreed on 2026-10-05. This decision does not make it
  easier to run.

11. The run records how it ran.
- The report and the saved run record the worker count, the host's row in
  Decision 10, and whether the ownership confirmation was present.
- A run that hit the request cap says how often it waited, so a slow run
  can be explained.
- **Added 2026-10-16:** the run also records its page visits, and
  the shared-page re-runs (Decision 4) with both results.

12. Output and results don't change, only run time.
- ~~Each test's body is measured unchanged on the 166 fixed inputs.~~
  **Amended 2026-10-16:** for the worker split alone (TFP-155),
  each test's body is unchanged on the 166 fixed inputs. For Decisions 2
  to 4, Decision 7's results proof applies instead.
- On the fixture, the same test gets the same result with 1 worker and with
  N. A test whose result changes with the worker count is a defect to fix
  before this phase closes.

13. Decide before measuring.
- Measure run time with 1 worker and with the Decision 10 limit, on:
  - the comparison fixture;
  - a local Docker copy of Toolshop (Testsmith's `docker compose` setup),
    which is a local host. Set up since in Phase 41 (TFP-179), at
    `scripts/toolshop-local/`;
  - a local Docker copy of the-internet (its own Dockerfile, Apache-2.0),
    which is also a local host. Its hosted copy couldn't be measured in
    Phase 38's TFP-150. The local copy also gives Phase 38's before and
    after: `d90de57` against `d202315`, one worker;
  - practicesoftwaretesting.com, capped.
- The change is kept if the Comprehensive run (every area) on the local
  Toolshop copy is at least 40% faster with the machine limit than with 1
  worker, and no test's result differs between 1 and N workers on the
  fixture. Otherwise it is reverted, and the result is recorded either way.
  - **Amended 2026-10-16:** both sides are measured on the code
    after Decisions 2 to 6, three runs each, comparing medians. Whether 40%
    still fits is set in Decision 1's target step.
- The capped run on practicesoftwaretesting.com is recorded for its time and
  its measured requests per second. It does not decide keep or revert.

## Acceptance Criteria

1. Measurement and targets (added)
- TFP-211's numbers are committed for the fixture and both local copies,
  three runs each, with each run's spread.
- The keep-or-revert targets are written into this record and locked by
  Emil before TFP-212 starts.

2. Shared visits (added)
- On the fixture, each selected page is visited once for its read-only
  checks. The run record's visit count shows it.
- Every test's result is the same shared and one-page-per-test (fixture).
- A failing read-only check doesn't stop the page's others. A fixture case
  fails one on purpose.
- Passive security gets the shared visit's load-time requests. A fixture
  case has a header and a request only the load shows.

3. Shared-page rules (added)
- Fixture cases cover:
  - a reload after a failure;
  - a reload after a test that left the page;
  - typed text cleared on pass and on fail;
  - the fresh-page re-run after a state-changing test, both results
    recorded, and no re-run for a failure on an untouched page;
  - each in-app navigation check confirming its target by address and
    content, failing on a pane that didn't change.

4. Split and queue
- A Comprehensive run of every area on the fixture produces the units of
  Decision 8 and runs them across the workers.
- The report groups results by area and page, the same as a one-worker run.

5. Serial group
- With interactive on, no two interactive tests overlap in time. Test start
  and end times in the run record show it.

6. Host limits
- On a local host the run uses the machine limit, with no request cap.
- On a capped host the run never exceeds the worker maximum, and its
  requests per second stay at or under the cap. A request-recording test
  proves it, as in Phase 35 Acceptance Criteria 2.
- With the ownership confirmation saved, a remote host's run uses the
  machine limit and no request cap. This is checkable once Decision 8 is
  built; until then it is tested with a stub confirmation on the fixture.

7. Same results
- Decision 7's proof on the fixture and both local copies, and Decision 12
  for the worker split.
- On the fixture, every test gets the same result with 1 and with N
  workers.

8. Measurement
- The Decision 13 runs are recorded with their durations, and the keep or
  revert rules (Decision 1's targets and Decision 13's) are applied as
  written.

## Regression Policy

- Add `TEST_PLAN.md` cases for:
  - the shared visit, and a failing check not stopping the others;
  - each shared-page rule;
  - each kind of control in Decision 3;
  - the fresh-page list in Decision 5;
  - the file split;
  - the serial group;
  - each host row of Decision 10, including the ownership row;
  - the request cap;
  - the same results shared and one-page-per-test, and with 1 and N
    workers.
- The request-recording test from Phase 35 and Phase 38 stays, extended to
  count requests per second.

## Dependencies and order

- **After TFP-208 and TFP-210, ahead of the rest of the review,
  measurement first** (Emil, 2026-10-16). R4 (TFP-206, TFP-209) follows
  Phase 39 or fits between its gates. R5 and R6 run in Cowork alongside
  it. Standard on with-bugs takes 1,535 s against its 1,800 s
  limit, leaving 265 s. Another check or two could push it over, so no new
  Standard check is added until TFP-211 has measured and a check's run-time
  cost can be weighed against the margin.
- TFP-208 before TFP-211, so the three-run measurements and Decision 7's
  same-results proof aren't read through flakes and the hand-tools link
  failures. TFP-210 before TFP-211, so a nightly unit run guards the
  phase.
- The local Toolshop copies (TFP-179) are in place. Docker Desktop must be
  started first, one version at a time.
- The ownership row needs Phase 35 Decision 8's typed confirmation. The rest
  can be built first.
- Tickets: TFP-211 to TFP-215 (added), then TFP-155 to TFP-158.

## Backlog

TFP-210 is the last ticket proposed (`post-phase-42-review-findings.md`).

### TFP-211 — Measure where run time goes (added 2026-10-16)

- **Phase:** 39 · **Priority:** P1 · **Labels:** `measurement`, `run`
- **Problem it solves:** the speed work needs numbers to aim at. Today's
  evidence (TFP-197, R1) gives totals, not where the time goes.
- **Scope:** Decision 1. Recording only: no change to what any test does.
- **Deliverables:**
  - the per-run numbers of Decision 1, kept in the run record;
  - the runs on the fixture and both local Toolshop copies, Standard and
    Comprehensive, one worker, three each;
  - a report under `docs/decisions/` with each number's spread, and the
    proposed targets for Emil to lock.
- **Acceptance criteria:** Acceptance Criteria 1 (up to Emil's lock).
  `check:template-unchanged` 166/166 if the recording lives outside the
  generated code. If it has to live inside, the difference is described
  and accepted deliberately.
- **Dependencies:** TFP-208.

### TFP-212 — One visit per page for read-only checks (added 2026-10-16)

- **Phase:** 39 · **Priority:** P1 · **Labels:** `enhancement`, `generate`, `run`
- **Problem it solves:** every read-only check loads its page afresh and
  waits for it to settle.
- **Scope:** Decisions 2, 5 and 7.
- **Deliverables:**
  - the shared visit across areas, with passive security's recorded
    requests;
  - the fresh-page list kept;
  - the template baseline updated in its own commit;
  - `TEST_PLAN.md` cases.
- **Acceptance criteria:** Acceptance Criteria 2. Decision 7's proof on both
  local copies. Measured against the locked target.
- **Dependencies:** TFP-211 and the locked targets.

### TFP-213 — The shared-page rules (added 2026-10-16)

- **Phase:** 39 · **Priority:** P1 · **Labels:** `enhancement`, `run`
- **Problem it solves:** a shared page can carry one test's state into the
  next.
- **Scope:** Decision 4, with the re-run only after a state-changing test.
- **Deliverables:**
  - reloads after failures and after leaving the page;
  - typed text cleared;
  - the fresh-page re-run with both results in the run record (Decision
    11);
  - `TEST_PLAN.md` cases.
- **Acceptance criteria:** Acceptance Criteria 3.
- **Dependencies:** TFP-212. Can be built with it.

### TFP-214 — Functional checks share pages by kind of control (added 2026-10-16)

- **Phase:** 39 · **Priority:** P2 · **Labels:** `enhancement`, `generate`
- **Problem it solves:** functional checks still load a page each, and on a
  single-page app they reload the whole app for every click.
- **Scope:** Decision 3, after Emil's look at TFP-211's control counts.
- **Deliverables:**
  - the three kinds;
  - the in-app navigation check confirming its target by address and
    content;
  - unclear controls kept on a fresh page;
  - `TEST_PLAN.md` cases.
- **Acceptance criteria:** Acceptance Criteria 3's navigation case.
  Decision 7's proof. Measured against the locked target.
- **Dependencies:** TFP-213; Emil's look at the counts.
- **Added at Gate B (Emil, 2026-10-20):**
  - **Accessibility's two page-changing checks share the visit too.**
    These are "every form field has an accessible name" and "tabbed through
    in reading order", both Decision 3's "in place" kind.
  - **The axe scan runs last in each page's shared group,** so a failing
    scan forces no reload of the checks after it.
    - **Superseded (Emil, 2026-10-20, during the build):** the order is
      read-only checks, then the axe scan, then the page-changing checks.
      The scan reads a page no check has touched.
    - **Measured at Gate C (Emil, 2026-10-21):** the order becomes a switch,
      and Gate C's session runs both orders.
    - **"Scan last" becomes the default only if** its axe findings are
      identical to the built order's on both copies (Decision 7) and it is
      faster. Otherwise the built order stays.
    - **Why it's measured:** with the scan last, a failing scan costs
      nothing extra, but the scan then reads a page the changing checks
      have altered and put back.
  - **Judged against accessibility's ≥30% target,** now at Gate C (see
    "Gate B ruling").
  - **Dependency:** TFP-241.
- **Emil's look at the control counts (2026-10-20),** from TFP-211's report:
  - **"Path navigation" links share as full navigation:** the target loads,
    and the check returns to the shared page by Back.
    - Inspection can't tell a single-page app's path links from a
      multi-page site's links. Full navigation with Back is safe on both.
    - The check confirms both the address and the content, so it can't pass
      on the previous page's content.
  - **"Unclear" controls keep their own fresh page,** as Decision 3 says.
    These are mostly form fields and plain buttons.
  - **"In place" and "in-app navigation"** share as Decision 3 says.
  - TFP-214 no longer waits on this look.

- **TFP-214 verified (Cowork, 2026-10-21),** `ae4a1ff` and `40ea7ed`.
  Accepted:
  - **Menus opened to reveal a link keep their own page.** Shared, they
    changed another check's finding wording, which no re-run can catch.
  - **The navigation check's 5 s wait for a late view.**
  - **A re-run drops the first attempt's findings,** keeping its failure in
    the remarks (Decision 4's "both recorded").
  - **The guarded navigation check stays on its own page** until its guard
    can be installed twice safely.

### TFP-215 — Tune the settle wait and read-only timeouts (added 2026-10-16)

**Narrowed at Gate A (Emil, 2026-10-20): the read-only assertion timeouts
only.**
- **The settle cap stays at 5 s.** TFP-211 found at most 4 visits a run
  reached it (17 s at most), so a change can't reach the 5% bar.
- **Link health's 14 s stays too.** It costs 7 to 8 s a run. The routes it
  leaves unchecked (R1) are a coverage question, not a speed one.
- **What remains:** the failed steps' 5 s waits, 137 s on with-bugs (9%).
- The text below is kept as it was decided.

- **Phase:** 39 · **Priority:** P2 · **Labels:** `run`, `measurement`
- **Problem it solves:**
  - visits that wait the full 5 s;
  - failing tests that wait out long timeouts (35% of with-bugs' test time
    at R1);
  - link health stopping before it reaches every route.
- **Scope:** Decision 6.
- **Deliverables:** each value changed with its measurement; the Toolshop
  score and failure sets unchanged.
- **Acceptance criteria:** Decision 7's proof after each change. The
  locked target is met or the change is reverted, recorded either way.
- **Dependencies:** TFP-212.

### TFP-155 — Split suites into units on a shared queue

- **Phase:** 39 · **Priority:** P1 · **Labels:** `enhancement`, `run`, `generate`
- **Problem it solves:** one long file per run, and one worker on most
  hosts, makes big Comprehensive runs slow.
- **Scope:** Decisions 8 and 12 (amended: the page is the unit for
  read-only work).
- **Deliverables:**
  - the units of Decision 8;
  - the report grouped as today;
  - `TEST_PLAN.md` cases.
- **Acceptance criteria:** Acceptance Criteria 4 and 7.
- **Dependencies:** ~~Phase 38 Gate B~~ TFP-212 and TFP-213 (amended).

### TFP-156 — Data-changing tests run one at a time, after the read-only tests

- **Phase:** 39 · **Priority:** P1 · **Labels:** `enhancement`, `run`
- **Problem it solves:** in parallel, one test's saved data could change
  another test's result.
- **Scope:** Decision 9.
- **Deliverables:**
  - the serial group, run after the read-only tests;
  - `TEST_PLAN.md` cases.
- **Acceptance criteria:** Acceptance Criteria 5. Also shown in the run
  record: no serial-group test starts before the last read-only test ends.
- **Dependencies:** TFP-155.

### TFP-157 — Worker limits and a request cap by host; ownership lifts both

- **Phase:** 39 · **Priority:** P1 · **Labels:** `enhancement`, `run`
- **Problem it solves:** Standard and Comprehensive follow different
  politeness rules on the same site, and neither scales.
- **Scope:** Decisions 10 and 11.
- **Deliverables:**
  - the host table, replacing Phase 35 Decision 2's one-worker rule and
    `calculateWorkerCount`'s fixed 4 and 2;
  - the shared request cap, with its wait count recorded;
  - the run record's worker count, host row and confirmation flag;
  - an extended request-recording test;
  - `TEST_PLAN.md` cases.
- **Acceptance criteria:** Acceptance Criteria 6.
- **Dependencies:** TFP-155. The ownership row is tested with a stub
  confirmation until Phase 35 Decision 8 is built.

### TFP-158 — Measure 1 worker against N

- **Phase:** 39 · **Priority:** P2 · **Labels:** `measurement`
- **Problem it solves:** the speed-up is an estimate until it's measured.
- **Scope:** Decision 13.
- **Deliverables:**
  - the runs on the fixture, local Toolshop and the-internet copies, and
    practicesoftwaretesting.com;
  - Phase 38's missing before and after on the local the-internet copy;
  - the keep or revert rule applied as written;
  - a report under `docs/decisions/`.
- **Acceptance criteria:** Acceptance Criteria 8.
- **Dependencies:** TFP-156, TFP-157. ~~The local Toolshop copy needs Docker
  on Emil's machine.~~ In place since TFP-179.

### TFP-240 — The clean copy's sort check, unstable since TFP-211 (added at Gate A, 2026-10-20)

- **Phase:** 39 · **Priority:** P1 · **Labels:** `flaky`, `generate`
- **Problem it solves:** "sort options order the items" fails on clean's `/`
  in all three of TFP-211's runs, and on `/category/hand-tools` in run 2
  only.
  - In the failure, "Drawer Tool Cabinet" 89.55 came before "Tool
    Cabinet" 86.71, sorting by price low to high.
  - It passed at TFP-208.
  - Sorting is not one of clean's known bugs.
  - Decision 7's proof compares failure sets test by test, so an unstable
    check makes Gate B unreadable.
- **Scope:**
  - **Find the cause.** For example: the check reads the list before the
    sorted page has drawn, the clean copy seeds new data on every start,
    or the sort is by a value other than the shown price. Prove it with
    the check's own trace or a recorded run.
  - **Fix the check.** It waits for the sorted state by a signal (the
    list's order, the request's response), not a delay. A real sort bug
    must still fail it.
- **Acceptance criteria:**
  - **Fixture cases:**
    - a list that draws its sorted state late passes;
    - a list sorted wrongly still fails.
  - **Stable on both copies:** Standard on both local copies, three runs
    each, in one session.
    - The sort check gives the same result in every run.
    - On clean it passes, unless the cause is shown to be a real defect in
      the clean copy, which is then recorded as a new answer-key finding.
  - **Template:** `check:template-unchanged`, with any change described and
    accepted deliberately.
  - **Test plan:** a `TEST_PLAN.md` case, in the same commit as the code.
- **Dependencies:** none. **Before TFP-212** (Emil, 2026-10-20).

### TFP-241 — Failure evidence for shared checks: a trace per check, and the visit's video (added at Gate B, 2026-10-20)

**Corrected 2026-10-20, when built (`3b1210c`).** The problem below
overstates the loss. Measured on Gate B's code (`2be975c`), a failing
shared check still had:
- Playwright's trace, which covers every context a test creates, a chunk
  per test;
- Playwright's failure screenshot;
- `error-context.md`.

Only the video was missing. So TFP-241 adds the shared visit's video, kept
for a failing check with where in it the check starts, and deleted when no
check fails. It adds no trace of its own (that clashed with Playwright's).
The text below is kept as written.

- **Phase:** 39 · **Priority:** P1 · **Labels:** `run`, `report`
- **Problem it solves:** since TFP-212, a failing shared check gets only a
  screenshot of the shared page.
  - Playwright's per-test trace and video (`retain-on-failure`) belong to
    its page fixture, which a shared check doesn't use.
  - Every failure had both before. Failure evidence is one of TestForge's
    promises (Phase 17; the evidence sweep, TFP-198).
- **Scope:**
  - **Trace:** the shared visit records a trace in chunks, one per check
    (`tracing.startChunk` / `stopChunk`). A chunk is kept only for a check
    that fails, and attached to that check's result as its trace.
  - **Video:** the shared visit's video is kept when any of its checks
    fails, and attached to each failing check, with the time each check
    started so the right moment can be found.
  - **Credential scan:** both pass through Phase 20's credential scan, as
    every capture does.
  - **Passing checks:** nothing is kept.
- **Acceptance criteria:**
  - **Fixture:** a failing shared check has a trace that opens in
    Playwright's trace viewer and shows only its own steps, plus the
    visit's video, with its start time. A passing one leaves nothing.
  - **Report:** the evidence links resolve.
  - **Cost:** under 5% of the Standard median on with-bugs, measured
    against Gate B's code (C) in one session, three runs each side.
    Otherwise the video is dropped and the trace kept, recorded either way.
  - **Template:** `check:template-unchanged`, with any difference described
    and the baseline moved in its own commit.
  - **Test plan:** `TEST_PLAN.md` cases.
- **Dependencies:** none. **Before TFP-214** (Emil, 2026-10-20).

## Recommended Execution Order

1. TFP-211, then Emil locks the targets. **Done 2026-10-20.**
1a. TFP-240, the sort check, before TFP-212.
2. TFP-212 and TFP-213, together.
3. TFP-215, then TFP-214 (after Emil's look at the control counts).
   **Gate B ruled 2026-10-20:** TFP-212, TFP-213 and TFP-215 are kept.
   **Builds first, then one overnight session (Emil, 2026-10-20).**
   - **Build in order,** each stopping for verification:
     1. TFP-241;
     2. TFP-214 (the control-count look done 2026-10-20);
     3. TFP-222 (R4; it must land before TFP-155);
     4. TFP-155;
     5. TFP-156.

     Building needs no quiet machine, and Emil uses the PC as normal.
   - **Then one overnight measurement session** (see Gate C below). Emil
     closes his browsers before bed, and Code stops and restarts Plane's
     containers.
   - **No separate measurement sessions** for TFP-241's cost or TFP-222's
     run time. Both are measured in the overnight session.
   - **Measurement sessions run overnight from now on,** Gate D's included.
4. TFP-155.
5. TFP-156 and TFP-157, in either order.
6. TFP-158.

## Suggested Milestone Gates

### Gate A — Measured and targeted (added)
- TFP-211 landed and independently verified.
- The targets are locked in this record by Emil.
- **Passed 2026-10-20.** TFP-211 was verified by Cowork (`684dc0a`,
  `160606e`, `afa8d4f`, `768d509`, `dce7c69`; report
  `phase-39-tfp211-measurement-report.md`). The targets are locked below.

### Gate A — targets locked (Emil, 2026-10-20)

**How every target is judged:**
- **Before against after, in one session.** The before side and the after
  side are measured in one session, interleaved, three runs each, and
  their medians compared.
- **Never against this report's numbers.** The same code drifted 14 to 19%
  between sessions (TFP-211).
- **The setup:** one worker, the local Toolshop copies, the suites
  generated once per side.

**A quiet machine (Emil, 2026-10-20).** For every Phase 39 before-and-after
session:
- Emil's Plane stack and Ollama are stopped;
- browsers are closed, apart from the run's;
- nothing else heavy runs;
- the machine's state is recorded at the start, as TFP-211 did.

**The targets:**
1. **Gate B** (TFP-212, TFP-213, TFP-215 together):
   - Standard at least **20% faster** on each copy;
   - Comprehensive security and accessibility each at least **30% faster**
     on each copy;
   - with Decision 7's proof: the failure sets are TFP-211's, test by test,
     apart from differences explained one by one, with the sort check
     settled by TFP-240. The Toolshop score is unchanged.
   - Not met: the change is reverted, and the result recorded either way.
2. **TFP-215:** each value it changes saves at least **5%** of the Standard
   median on with-bugs, or it is reverted. 5% is the spread within a
   session.
3. **Gate C** (TFP-214), measured against Gate B's code: at least a further
   **10%** on Standard, each copy.
4. **Decision 13:** the **40%** bar stays. Measured on Comprehensive, every
   area, on the local Toolshop, after Gates B and C, medians of three each
   side.

**Recorded, not work:** Playwright restarts the worker after each failed
test, about 1.6 s each. That is 136 s of with-bugs' Standard run, and none
of Decisions 2 to 6 touch it.

### Gate B — Fewer visits (added)
- TFP-212, TFP-213 and TFP-215 landed and independently verified.
- Decision 7's proof holds on the fixture and both local copies.
- The locked target is met, or the change is reverted and recorded.

### Gate C — Split and serial (was Gate A)
- TFP-214, TFP-155 and TFP-156 landed and independently verified.
- With one worker, the fixture gives the same results as at Gate B.
- **Measured in one overnight session (Emil, 2026-10-20).** Five
  variants, interleaved, three runs each, one worker, a quiet machine:
  - **A:** `4a85f1f`, before TFP-212;
  - **C:** `2be975c`, Gate B's code;
  - **C1:** with TFP-241;
  - **C2:** with TFP-214;
  - **F:** the final code, with TFP-222, TFP-155 and TFP-156.
- **What each comparison judges:**

  | Comparison | Judges | Target |
  | --- | --- | --- |
  | C against C1 | TFP-241's cost, with-bugs Standard | under 5%, or the video is dropped |
  | C1 against C2 | TFP-214, Standard on each copy | at least 10% faster |
  | A against C2 | accessibility on each copy (moved from Gate B) | at least 30% faster |
  | C2 against F | TFP-222, TFP-155 and TFP-156 | the same results; no slower beyond the 5% spread |
  | F against F with the axe scan last (accessibility, each copy) | where the axe scan runs (Emil, 2026-10-21) | identical axe findings and faster, or the built order stays |

- **What must also hold:** Decision 7's proof in every comparison, and the
  with-bugs `/` sort message compared again.
- **Trimming:** variants that a target doesn't need are left out of a copy
  or suite, to keep the session to about 5 to 5½ hours. The runner states
  which.

### Gate B ruling (Emil, 2026-10-20)

**Measured** (`phase-39-gate-b-report.md`; evidence
`benchmarks/2026-10-20-gate-b/`): before (A, `4a85f1f`) against after (C,
`2be975c`), in one session on a quiet machine.

| Suite | with-bugs | clean | Target | Result |
| --- | --- | --- | --- | --- |
| Standard | 36.4% faster | 50.0% faster | 20% | met |
| Comprehensive security | 45.9% faster | 46.2% faster | 30% | met |
| Comprehensive accessibility | 1.0% faster | 8.6% faster | 30% | not met |

- **TFP-215:** 7.1% faster than B, against its 5% bar. Kept.
- **Decision 7 holds:** the same failures in every run of A and C, and the
  same evidence for all 37 bugs.

**Ruling:**
1. **TFP-212, TFP-213 and TFP-215 are kept.** The locked "not met:
   revert" rule is not applied. Accessibility missed because the target
   assumed all four of its checks would share a visit. Two of them change
   the page, and sharing those is TFP-214's job by design. A failing axe
   scan, which runs first, also forces the next check to reload. The build
   didn't fail; the target was set ahead of its ticket.
2. **Accessibility's ≥30% moves to Gate C** (amending Gate A's target 1),
   with TFP-214's additions above.
   - It is judged on each copy against the before code (A, `4a85f1f`).
     Gate C's session runs A again for this comparison, so it stays within
     one session.
3. **TFP-241 restores failure evidence for shared checks, before
   TFP-214.** (Corrected when built: only the video had been lost. See
   TFP-241.)
4. **Accepted as recorded, re-checked at Gate C:** the with-bugs sort
   check's message on `/`. It names "Name (Z - A)" before the change and
   not after, while the check fails in every run of both, with the same
   failure set and score. Gate C's report compares that message again. A
   second unexplained change is measured, not read.
5. **Accepted:** `4a85f1f`, test-only, each unit run's Playwright output in
   its own folder, outside the tickets but in its own commit.

### Gate D — Limits and measurement (was Gate B)
- TFP-157 and TFP-158 landed and independently verified.
- The request cap is shown held by a recording test.
- The keep or revert rule is applied and recorded.
