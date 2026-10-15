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
Decision 4. The keep-or-revert targets are still to be set: TFP-211
measures, and Emil locks them here before TFP-212 starts. Nothing is
started. **Phase 39 is next after the review** (Emil, 2026-10-16; see
Dependencies and order).

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

- **Straight after the post-Phase 42 review, measurement first** (Emil,
  2026-10-16). Standard on with-bugs takes 1,535 s against its 1,800 s
  limit, leaving 265 s. Another check or two could push it over, so no new
  Standard check is added until TFP-211 has measured and a check's run-time
  cost can be weighed against the margin.
- TFP-208 (flakes) before TFP-211, so the three-run measurements aren't read
  through known flakes.
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

### TFP-215 — Tune the settle wait and read-only timeouts (added 2026-10-16)

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

## Recommended Execution Order

1. TFP-211, then Emil locks the targets.
2. TFP-212 and TFP-213, together.
3. TFP-215, then TFP-214 (after Emil's look at the control counts).
4. TFP-155.
5. TFP-156 and TFP-157, in either order.
6. TFP-158.

## Suggested Milestone Gates

### Gate A — Measured and targeted (added)
- TFP-211 landed and independently verified.
- The targets are locked in this record by Emil.

### Gate B — Fewer visits (added)
- TFP-212, TFP-213 and TFP-215 landed and independently verified.
- Decision 7's proof holds on the fixture and both local copies.
- The locked target is met, or the change is reverted and recorded.

### Gate C — Split and serial (was Gate A)
- TFP-214, TFP-155 and TFP-156 landed and independently verified.
- With one worker, the fixture gives the same results as at Gate B.

### Gate D — Limits and measurement (was Gate B)
- TFP-157 and TFP-158 landed and independently verified.
- The request cap is shown held by a recording test.
- The keep or revert rule is applied and recorded.
