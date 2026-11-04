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
- **Amended 2026-10-21 (Emil, while TFP-157 was built):**
  - **What the cap counts:** every request to the site, page loads and the
    resources they pull in as well as API requests, so the server never
    sees more than 5 in a second.
  - **The site:** the run's host and every host under its domain (`www.`,
    `api.`), so a site's own API is capped with its pages. Third parties
    aren't counted.
  - **Timed checks on a capped host** (load time, LCP, CLS, TBT) are Not
    run, "not judged under the request cap": the cap slows the page loads
    they measure. This is a result change against Decision 12, approved for
    the capped row only. Page weight and failed requests still run.
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

#### RUN-38 evidence

Moved word for word from [`docs/test-plan/RUN.md`](../test-plan/RUN.md) by TFP-253; the case's row there links here.

**Test:** The run record says where the run's time went, measured beside the suite, not in it (TFP-211, Phase 39 Decision 1; unit: `src/lib/run/timing.test.ts` (a fixture site served locally, a suite run in a real browser))

**Expected result:** A second reporter beside the progress reporter (`src/lib/run/timing.ts`) keeps each test's page loads, settle waits, requests and assertions as Playwright names them, without fixture set-up. The run's report gets `runTiming`: tests and their time, page loads, `about:blank` loads, settle waits (count, time, how many reached the 5 s cap), requests, failing tests (their time, and the time their failed steps waited), page loads by page and area, the targets link health, the linked-routes check, TFP-205's link tests and the navigation-link check each reach and share, and each inspected page's controls by Decision 3's kinds. **Proven (decision table, one test per row):** a quiet page: a load and a settle wait, not capped; a page that polls: a settle wait of the 5 s cap, counted as capped; link health's requests: 2 requests, its targets; a link test loading its target: a load, its target only (its own page left out); a navigation-link test: its link's target, named by inspection; a failing assertion with a 1.5 s timeout: 1 failing test, at least 1.4 s of failed-step time. The link-health test's steps are exactly its two requests and two assertions. finalizeRunJob keeps the summary in the report and removes the timing files; a run without them has no `runTiming`. A retried test counts once, by its last attempt. Controls (boundary per kind): radio, checkbox, tab, a pressed and an expanded button are in place, as is an in-page anchor; a hash route is in-app navigation; a same-origin path is path navigation; a plain button, a text field and an external link are unclear. Template output: unchanged (`check:template-unchanged` against `980346f`, 166 of 166).

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

#### GEN-101 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** A page's read-only checks, every area's, run on one shared visit of the page (TFP-212, Phase 39 Decisions 2, 5 and 7; unit: `src/lib/generate/shared-visits.test.ts` (offline, and the comparison fixture in a real browser))

**Expected result:** `shareReadOnlyVisits` (`src/lib/generate/shared-visits.ts`), applied after `routePageVisits` to the Standard and Comprehensive suites, moves each test that only reads its page into that page's `Page /x` group, inside its own area describe. A test shares when its first statement loads one page (`tfGoto(page, '/x')`), it asks for no fixture but `page`, `context` and `request`, and afterwards it neither loads again, interacts, scrolls, routes, listens, adds scripts or styles, changes storage nor opens pages. Decision 5's list keeps its own page: performance, responsive, cookie and session, the interactive and active gates, gap-writer and candidate tests; so does a test in a describe with a hook or `test.use`. The `tfShared` fixture hands each test the visit's page, context and load response (the passive security checks read its headers, cookies and redirect chain); a failing shared test's evidence is GEN-104's. The describes' helpers move to the top of the file. **Proven (decision table, offline):** a test that only reads `/a` and one that reads `/b`'s response share; one that clicks, listens before loading, sits at the interactive gate, asks for `browser`, or scrolls stays; a fresh-page area and a describe with a hook stay; every test keeps its id and page; a helper moves to the top once; the pass runs once only, and a suite with nothing to share is unchanged. **Proven (Decision 7, equivalence of results, real browser):** the fixture's Standard suite (`/`, `/login`, `/notes`, all ten areas) gives every test the same status and findings shared and one-page-per-test; each page is loaded once for its shared checks, and again only after a shared check fails before the page's last; page loads fall by more than half. With a version header, a weak session cookie, a redirect through `?sessionid=` (new fixture defect `security-token-in-redirect`) and a missing meta description, Security and SEO give the same results both ways, a shared check names each defect, and `/`'s other SEO checks pass after one fails.

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

#### GEN-102 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** A shared page's rules: loaded again after a check leaves it and after a failure, typed text cleared, a failure after a change re-run on a fresh page (TFP-213, Phase 39 Decision 4; unit: `src/lib/generate/shared-visits.test.ts` (a local site in a real browser))

**Expected result:** `tfShared.visit` loads the page again, in a new context, when the last check left it; a failure starts a fresh worker, so the next check loads it again. A check that changes the page calls `tfShared.changed()`, and one that types names its field with `tfShared.typed(field)`, cleared when it ends. A failure on a visit a check had changed is re-run on a fresh page where its group allows a retry: the report shows the fresh result, with the first attempt's failure in the remarks (`shared-visit-rerun`). A failure on an untouched page is not re-run and its own message stands (`shared-visit`). The touched state is recorded when a check takes the visit, since a retry can start before the failed worker has finished. **Proven (state transition):** loaded, shared, shared and left (a click to /b), loaded again; typed and passed, the next finds the field empty; a box ticked and left, the next fails, is re-run fresh and reports Passed with the first failure noted; a failure on an untouched page fails with its own message, not re-run; after it the page loads again; typed and failed, the next loads fresh and finds the field empty. The template shares no check that changes the page yet (Decision 3 is TFP-214), so it configures no retries. In-app navigation checks confirming their target are TFP-214's. Changed by TFP-214 (GEN-105): a check that left the page is brought back with Back rather than loaded again, and the re-run is in the same attempt, not a retry, so the marker file and the `shared-visit` note are gone.

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

#### GEN-105 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** A check that changes its page in place shares the visit too, after the page's reads and the axe scan (TFP-214, Phase 39 Decision 3 with the Gate B additions and the owner's look at the control counts; unit: `src/lib/generate/shared-visits.test.ts` (offline, and a local site and the comparison fixture in a real browser))

**Expected result:** Since TFP-214 a check shares its page's visit when, after its visit, it changes the page only in place: it clicks, hovers, focuses, presses keys, scrolls, changes the DOM (a probe element, an attribute put back), opens a route view in a page of its own, or goes back. It still keeps its own page when it loads again, sets up the page or its context (routes, listeners, scripts, viewport, cookies, permissions), uses a form field or a guarded control (owner decision, 2026-10-20: "unclear" controls, mostly form fields and plain buttons, keep a fresh page), opens a menu to reveal a link (`tfReveal`), or writes storage. The menu rule was found by the hidden-links test (GEN-89's menus fixture): shared, "Archived"'s link health ran after "Hand Tools" had left the Categories menu open, and its finding read "no control was found that reveals it" instead of "the 'Categories' menu opened, but it stays hidden" (Decision 7: the same results), and since the check passes either way no re-run would catch it. Declarations that only hold data (the links a check walks) may come before its visit. Such a check calls `tfShared.changed()` and runs inside `tfShared.rerun()`, and in its page's group the checks run reads first, then the checks that change the page, then the axe scan (the Gate C ruling, 2026-10-21; at Gate B, the scan before the changing checks), so a failing scan's fresh worker reloads nothing after it. Where the scan runs is a switch (owner decision, 2026-10-21): `axeOrder: "last"` (the default since the Gate C ruling, and the template's), after the changing checks, not re-run, or `"before-changes"`, TFP-214's built order. Gate C measured both: the scans' findings identical in every run on both Toolshop copies, accessibility 15.6% (with-bugs) and 21.1% (clean) faster with the scan last. **Proven (offline):** by default the scan follows the changing checks in its page's group, in its own area, without `rerun()`; with `"before-changes"` it comes before them, and the suite type-checks; the default's output is `"last"`'s, byte for byte. Template: `check:template-unchanged` against `ae4a1ff`, 120 identical and 46 different, and `benchmarks/2026-10-21-axe-last/verify-template.mts`: this code with `"before-changes"` gives the base's output for all 166, byte for byte, so the order is the only change; the baseline moves in its own commit. A check that left the page is brought back with Back for the next, which counts as changed; the page is loaded again only if Back doesn't return to it (Decision 3's full navigation). Decision 4's re-run is now in the same attempt, not a Playwright retry: a changing check's failure on a page an earlier check changed or left is run again on a fresh page; the report gives the fresh result, the first failure is in the remarks (`shared-visit-rerun`), and what the first attempt found (findings, issues, measurements) is dropped with it; a failure on an untouched page stands. On Gate B's clean suites, every Comprehensive accessibility check now shares (80 of 80, from 40), and Standard keeps 82 of 472 on their own page, from 148 (with-bugs: 90 of 483, from 178): the accessible-name, reading-order, form-field-name, hover, link-type, technical-security, anchor and (for links visible at inspection) navigation-link-health checks join. **Proven (decision table, offline):** a click, a scroll, a route view opened with `page.context().newPage()`, a Tab press and data declared before the visit share; a field filled, a reload, a cookie set, a menu opened to reveal a link and a page read before its visit keep their own page; in `/a`'s group the reads come first, then the changes, then the scan; a changing check is wrapped in `rerun()` with `changed()` after its visit, a reading one isn't. **Proven (state transition, real browser):** a check leaves `/a` by a link, the next is brought back (`shared /a (back)`); a box ticked, the next fails on it, runs again on a fresh page in the same attempt and passes, with the first failure in its remarks and the first attempt's finding dropped; a failure on an untouched page isn't re-run; a failure on a changed page that fails again on a fresh one fails, with both failures recorded. **The navigation check (Acceptance Criteria 3's navigation case; unit: `src/lib/generate/mock/controls.test.ts`):** "navigation links land where their text says" comes back to its start page by Back after each link that moved, loading it again only when Back doesn't reach it (the owner's look: path links as full navigation with Back), and confirms each link by address and content: a link that moves the address while the page still shows the start page's content fails, after waiting up to 5 s for a view that draws late. It stays on its own page (its guard routes the page). **Proven (decision table, real browser, the fixture's `/spa`):** clean, only "Chainsaws" (a missing route) fails, and `/spa` is loaded twice for five links (the test's visit and the check's start; 6 on the code before); with `controls-nav-pane-stuck` (new fixture defect: Products moves the address, its view never draws) "Products" fails with "changes the address to /products but the page still shows what / showed", and the late-drawing Contact view passes. Found on the way: without the wait, Contact's view, drawn 1.5 s late, was judged unchanged and then drew over the next link's view. **Proven (Decision 7):** GEN-101's equivalence on the comparison fixture, with the changing checks shared. Speed is measured at Gate C (C1 against C2: Standard at least 10% faster on each copy; A against C2: accessibility at least 30% faster).

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

#### GEN-103 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** A shared check's assertions wait 2 s, not 5 s (TFP-215, narrowed at Gate A to the read-only assertion timeouts; unit: `src/lib/generate/shared-visits.test.ts` (a local site in a real browser))

**Expected result:** Each page's group shadows `expect` with `expect.configure({ timeout: 2000 })`: every check there only reads a page that has settled. Why 2 s: in TFP-211's 18 runs no passing assertion took over 229 ms (about 10,500), and about 27 failing ones a run on with-bugs waited out the full 5 s. An assertion's own timeout wins; a test outside the groups keeps Playwright's 5 s. Kept only if it saves at least 5% of the with-bugs Standard median (Gate A), measured at Gate B. **Proven (boundary value analysis):** a shared check's failing assertion gives up after 2 s (at least 1.9 s, under 3 s); the same assertion in a check on its own page after 5 s; a shared one with its own 3 s after 3 s. Decision 7's proof (GEN-101) runs with it: the fixture's results the same shared and one-page-per-test.

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

#### RUN-40 evidence

Moved word for word from [`docs/test-plan/RUN.md`](../test-plan/RUN.md) by TFP-253; the case's row there links here.

**Test:** A suite runs as units, one file each, across the run's workers (TFP-155, Phase 39 Decisions 8 and 12, Acceptance Criteria 4 and 7; unit: `src/lib/run/split.test.ts` (offline, and the comparison fixture in a real browser); `benchmarks/2026-10-21-tfp155/verify-split.mts`)

**Expected result:** `splitSuite` (`src/lib/run/split.ts`) splits a suite into units: each page's group (its shared visit with every area's read-only checks), each other top-level describe (an area's own-page and site-wide tests), and the top-level tests together. Each file starts with the suite's top level (imports, `test.use`, helpers), in order, and the files are numbered in the suite's order, so one worker runs them as the one file ran. A describe left with no test makes no file; a suite of fewer than two units stays one file. The executor writes the units beside the suite as generated (`suite-<id>.ts`, which persistence saves and the stale re-check reads, and which Playwright doesn't run), and says how it split ("Split into N unit file(s) (P page(s), O other), run by W worker(s)"). Before this, a run was one file, which Playwright runs in one worker, whatever `--workers` asked for. Standard on a local host now takes its 4 (fast) or 2 (deep) workers; on any other host it runs on one, as it effectively did, until TFP-157's host limits and request cap (Decision 10: "without the cap, a capped host gets one worker, as today"). Comprehensive keeps its one worker (Phase 35 Decision 2) until TFP-157. (Both replaced by TFP-157, RUN-42: the host decides, and the split line no longer adds ": one, as this host isn't local".) The timing record (TFP-211) now keeps each test's worker, file and start, and the run's `runTiming` how many workers and files ran tests. **Proven (decision table, offline):** a page's group, another describe, the top-level tests (one file between them), an empty describe (no file) and the top level (every file's header, comments with what they stand before); each unit type-checks; the same tests, ids, titles, describes and bodies; a one-unit suite unchanged. On generated Standard and both Comprehensive suites, a unit per page, the same tests, every unit type-checks. **Proven (Acceptance Criteria 4 and 7, Decision 12, real browser, the comparison fixture):** Comprehensive security and accessibility (`/`, `/login`, `/notes`, `/forms`) as units on 4 workers give every test the same title, area, suite, status and findings as one file on one worker, with a report suite per unit and more than one worker used; a Standard suite (functional, accessibility, SEO, security, usability on `/`, `/login`, `/notes`) run by the executor on the local fixture gives every test the result one file on one worker gives, its record naming the split, with `runTiming` counting every unit file and more than one worker. **Proven (Decision 12, the 166 fixed inputs):** every test of each in exactly one unit, unchanged (1,394 tests); 102 inputs stay one file, the rest split into up to 8. `check:template-unchanged` against `ae4a1ff`: 166 of 166 identical. Changed by TFP-156 (RUN-41): a run with interactive tests on had one worker until the serial group; now the read-only units take the run's workers and the serial group runs after them on one. Measured at Gate C (C2 against F, one worker).

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

#### RUN-41 evidence

Moved word for word from [`docs/test-plan/RUN.md`](../test-plan/RUN.md) by TFP-253; the case's row there links here.

**Test:** Data-changing tests run one at a time, after the read-only tests (TFP-156, Phase 39 Decision 9, Acceptance Criteria 5; unit: `src/lib/run/split.test.ts` (offline, and the comparison fixture in a real browser))

**Expected result:** `splitSuite` puts every test that changes data (its gate, its own or a describe's, is interactive or active: journeys, the database round trip, form submissions, attack-shaped input) and every model-written block (gap tests, candidates, a model's appended tests) in one serial unit (`serial.spec.ts`), in the suite's order. A describe holding both kinds is in both files, each copy with only its own kind's tests and all of the describe's other statements (helpers, hooks). The executor runs two Playwright passes: the read-only units on the run's workers, then the serial unit, from a folder of its own that the first pass's config leaves out, on one worker. Each pass has its own report, timing file and artifact folder (a run clears its output folder as it starts); they are merged into the run's own after the last, in pass order, under one time budget. A pass the run's selection leaves empty is skipped. Not Playwright's project dependencies: measured on Playwright 1.59.1, a dependent project's test "did not run" once a test it depended on failed. The run's timing record keeps `serialGroup`: its tests, how many pairs of them overlapped, its first start, and the last read-only test's end. **Proven (decision table, offline):** a read-only and an interactive test in one describe (both copies keep its helper and hook), an active-gated describe, a gap-tests block and a page group: the read-only file holds the read-only test, the page its own, and the serial file, last, the interactive test, the active describe and the gap test in the suite's order; every unit type-checks and every test is in exactly one, unchanged; a one-unit suite with a serial group still splits. **Proven (Acceptance Criteria 5, real browser, the comparison fixture):** with interactive tests on, a Standard run (functional, database, security on `/`, `/login`, `/notes`, `/forms`) through the executor: the persistence round trips ran (passed or failed, not Not run), the run said its serial group ran after the rest, and the run record shows no two serial tests overlapping and the first serial test starting at or after the last read-only test ended, with the read-only units on more than one worker. Over the 166 fixed inputs: 4 have a serial group (4 tests); every test in exactly one unit, unchanged; `check:template-unchanged` against `ae4a1ff`: 166 of 166 identical.

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

#### RUN-42 evidence

Moved word for word from [`docs/test-plan/RUN.md`](../test-plan/RUN.md) by TFP-253; the case's row there links here.

**Test:** Worker limits and a request cap by host; the ownership confirmation lifts both (TFP-157, Phase 39 Decisions 10 and 11, Acceptance Criteria 6; unit: `src/lib/run/host-limits.test.ts` (offline, and the executor in a real browser against a recording site on this machine's LAN address); `run-mode.test.ts`, `split.test.ts`)

**Expected result:** `hostLimitsFor` (`src/lib/run/host-limits.ts`) gives each run its host's row, Standard and Comprehensive alike, replacing Phase 35 Decision 2's one worker and Standard's fixed 4 (fast) or 2 (deep): a local development host (`localhost`, loopback, `*.localhost`, and now `*.test`) or a host whose site has a valid ownership confirmation gets the machine's limit (half its cores, at least 1 and at most 3: Gate D's re-measurement ruling 1, 2026-10-27, as 6 workers overloaded the local clean Toolshop and changed its results) and no request cap; any other host gets at most 3 workers sharing 5 requests per second. The confirmation is a stub until Phase 43 (`src/lib/run/ownership.ts`: no host carries one, so every remote host is capped; TFP-220 replaces it; only a test can set the stub). On a capped host the run starts a slot server on loopback and copies `request-cap-fixture.ts` into its folder as `testforge-request-cap.ts`; each unit (and a stale re-check's file) imports it in place of `@playwright/test`, nothing else in the unit changing, so the generated suite is untouched. It makes every request to the site take a slot first: page loads and the resources they pull in (a route on each context, including one a test opens with `browser.newContext()`) and API requests (`request`, `page.request`). The site is its host and every host under its domain (`www.`, `api.`), so its own API is capped with its pages; third parties aren't counted (owner decision, 2026-10-21). At most 5 slots are held at once, each until a second after its request's response (or failure): a request arrives at the server before its response, so no second there can hold more than 5, however long a request takes to leave the browser. Evenly spaced slots couldn't promise that: measured, a fresh browser's first request reached the server about 250 ms after its slot, so slots 210 ms or 250 ms apart each let six requests arrive within one second. A slot is the connection that asked for it (Gate D ruling 1, 2026-10-26): the server answers when one is free and keeps the answer open, and the slot goes back when that connection closes, whether the worker closes it or its process ends (as Playwright ends one after each failed test); a waiter whose connection closes first is dropped, and a context that closes gives up its requests' places. Before, a freed slot went to the next waiter in line whether or not it was still there, and stayed held for a 60 s lease: at Gate D that starved capped Standard on the hosted Toolshop (466 of 484 tests timed out). A slot still held after 60 s is taken back. **Changed by TFP-264 (RUN-44):** a test that failed while the cap held up its requests in the step that failed (an assertion through its assertion wait; any other step that timed out still waiting) is Not run, "starved by the request cap", and a capped run has 60 minutes. Timed checks (load within 5 s, LCP, CLS, TBT, and the local model's "ready quickly") are Not run on a capped host, "not judged under the request cap", as the cap slows the loads they measure (owner decision, 2026-10-21); page weight and failed requests still run. The run says "Host limits: ..." (its workers, row and why) and, when capped, how many slots were given, how many requests gave up waiting when their test ended, and how many waited (TFP-265, RUN-45); the report and saved run keep `hostLimits` (row, workers, cap, ownership confirmation, site domain, the cap's counts), and a Comprehensive report's worker line is its note. Not counted, as Playwright doesn't route them: a redirect's later hops, a service worker's own requests, WebSockets. A gap run (the gap writer's own one-worker check during generation) isn't capped. **Proven (decision table, offline):** each host against the confirmation gives its row, workers and cap; the machine limit at 1, 2, 3, 4, 5, 6, 7, 8 and 12 cores (1, 1, 1, 2, 2, 3, 3, 3, 3); what counts against the cap and the domain it counts under (equivalence partitions); the units' import rewrite; the slot server gives five slots at once, the sixth only a second after one is handed back, counts the three that waited, and refuses a wrong token. **Proven (Gate D ruling 1, state transition):** five waiters that give up before their turn take no slot, and the next request gets one about a second after the held five are handed back (on `54c38eb` it waited 61,007 ms); a process holding five slots that is killed hands them back, and the next request gets one about a second later; in a real browser through the executor, four tests that each fail while 30 slow images wait for slots, which makes Playwright restart the worker, leave the next tests their slots: all four pass, each inside its 30 s test timeout, and the run isn't stopped at its budget (on `54c38eb` they timed out and the run stopped at its 140 s budget). **Proven (Acceptance Criteria 6, real browser, the executor; 3 runs):** on a capped host, the run used more than one and at most 3 workers, the server never saw more than 5 requests in any second (5 at most in each run), every request it got took a slot (40 slots asked for, 35 arrivals: a passing test closes its context while its images still wait; RUN-45 counts the slots given apart from the requests that gave up), some waited, the browser asked for no favicon of its own, and the timed check was Not run with its reason while the rest passed; with the stub confirmation, the same host's run used the machine's limit, no cap, and the timed check ran and passed.

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

#### GEN-100 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** The sort check waits for the order it asked for, not for a quiet network (TFP-240, Phase 39; unit: `src/lib/generate/mock/controls.test.ts` (the comparison fixture's /store, run in a real browser); diagnosis: `benchmarks/2026-10-20-tfp240/`)

**Expected result:** After choosing a sort option, the check reads the list until it shows that order, for up to 5 s, and only a list still out of order then fails. Why: the sort's own request starts inside `selectOption`, before `tfSettle` listens, so `tfSettle` could call the page quiet before the sorted list arrived and the check read the previous option's list. Shown on the clean local Toolshop (`diagnose-clean-home.log`): every sort request started before `selectOption` returned, and once `tfSettle` returned 13 ms after the response. TFP-211's failure on clean's `/` ("Drawer Tool Cabinet" 89.55 before "Tool Cabinet" 86.71, sorting low to high) is the top of the high-to-low list, the option checked just before. **Proven (decision table, GEN-89's columns plus one):** a sorted list drawn 1.5 s late (`controls-sort-late`): every check passes; on the code before the fix its sort check fails, reading the previous order. The name sort reversed (`controls-sort-reversed`) still fails, naming the items out of order; every other column as GEN-89. Template output: 4 of 166 inputs differ (the functional suites with page data, which carry the control helpers), each by this block alone; the baseline moves in its own commit.

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

#### GEN-104 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** A failing shared check keeps its evidence: Playwright's trace and screenshot, and the shared visit's video with where the check starts in it (TFP-241, Gate B ruling; unit: `src/lib/generate/shared-visits.test.ts` (a local site in a real browser); before: `benchmarks/2026-10-20-tfp241/`)

**Expected result:** Playwright's `retain-on-failure` capture reaches every context made from its browser in a test, the shared one too, so a failing shared check already had Playwright's trace (its own steps) and failure screenshot; measured at Gate B's code (`2be975c`), its evidence was a screenshot (twice: Playwright's and the helper's), `error-context.md` and a trace, but no video, which is Playwright's page fixture's alone. The shared visit now records its own video: a failure ends the visit (a fresh worker follows), so the failing check finishes the video and keeps it, with an annotation giving where in it the check starts. A visit no check failed on loses its video when it ends, at a page change or its group's end (an `afterAll` in each page's group; a worker-scoped fixture would have given the shared checks workers of their own). The helper's own screenshot is gone (Playwright's is there). **Proven (decision table, real browser):** a pass, a failure and a pass after it on one shared page: the failing check has a trace, one video and a screenshot, each a file the report's evidence links to, and `this check starts N s into the video of the shared visit`; the passing checks keep nothing; the trace's actions are the failing check's own (its selector, not the first check's); a secret shown on the page is in the trace's snapshots and gone after the run's credential scan (`scrubArtifactDirectory`); no video is left behind. Its cost is measured at Gate C (C against C1, under 5% of the with-bugs Standard median, or the video is dropped).

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

### Gate C ruling (Emil, 2026-10-21)

**Measured** (`phase-39-gate-c-report.md`; evidence
`benchmarks/2026-10-21-gate-c/`): one overnight session, 04:45 to 10:00,
on a quiet machine. Decision 7 holds in every comparison.

| Comparison | with-bugs | clean | Ruling |
| --- | --- | --- | --- |
| TFP-241's cost (C against C1) | 2.5% | not run | kept |
| TFP-214 (C1 against C2), Standard | 14.9% faster | 20.5% faster | met |
| TFP-222, 155, 156 (C2 against F) | same results, 1.6% faster | same results, 0 to 1.7% faster | met |
| Axe scan last (F against FL) | identical findings, 15.6% faster | identical findings, 21.1% faster | met |
| Accessibility (A against the final code, scan last) | 27.1% faster | 49% faster | see below |

**Ruling:**
1. **The axe scan runs last by default.** It met the rule on both copies:
   identical findings, and faster. The switch's default changes, and the
   template baseline moves in its own commit.
2. **Gate C passes, with the with-bugs accessibility miss recorded.**
   - with-bugs accessibility is **27.1%** faster against **30%**.
   - **The cause:** the axe scan fails on all 20 with-bugs pages, and
     Playwright starts a fresh worker after each failed test. Gate A
     recorded that as Playwright's own behaviour, outside Phase 39's reach.
   - Clean beats the target at 49%. Nothing is reverted.
   - Gate D's workers may close the rest. Its report states it.
3. **The with-bugs `/` sort message is closed.** Measured: the same code
   (C) names "Name (Z - A)" in some runs and not in others, so it is the
   app's state, not the code.

### Gate D — Limits and measurement (was Gate B)
- TFP-157 and TFP-158 landed and independently verified.
- The request cap is shown held by a recording test.
- The keep or revert rule is applied and recorded.

### Gate D ruling (Emil, 2026-10-26)

**Measured** (`benchmarks/2026-10-21-gate-d/analysis.md`, `fe63239`): one
overnight session, 2026-10-21 17:27 to 2026-10-22 06:07, on `54c38eb`.
W1 is 1 worker, WN the machine's limit (6), CAP the capped row (3 workers
sharing 5 requests per second). Medians of three; the capped run once.

| Comparison | Measured | Rule | Result |
| --- | --- | --- | --- |
| Decision 12, the fixture: the same results, W1 and WN | the same in Standard, security, accessibility | the same | met |
| Decision 13, with-bugs: Comprehensive (security + accessibility) | W1 262 s, WN 158 s: 39.7% faster | at least 40% | not met |
| Decision 13, clean: Comprehensive | W1 211 s, WN 386 s: 82.9% slower | at least 40% | not met |
| Acceptance Criteria 7, with-bugs and the-internet | the same, every suite | the same | met |
| Acceptance Criteria 7, clean | differs, every suite | the same | not met |
| Gate C's accessibility gap, with-bugs | A 215 s, WN 60 s: 72.1% faster | at least 30% | closed |
| Standard, W1 against WN (recorded) | fixture 74 to 34 s; with-bugs 734 to 365 s; the-internet 316 to 91 s; clean 403 to 519 s | - | recorded |
| Phase 38's before and after, local the-internet (recorded) | `d90de57` 218 s, `d202315` 242 s, no timeouts | - | recorded |
| Capped practicesoftwaretesting.com (recorded) | security 698 s, 2.8 per s; accessibility 170 s, 3.7 per s; Standard 29,340 s, 466 of 484 timed out, 902 slots | - | recorded |

- **Clean with 6 workers:** the copy's API answered too slowly (GETs over
  4 s, content missing at the 2 s waits; 8, 7 and 17 test timeouts in
  Standard's three runs). W1, run before each WN run, kept its Gate C
  times.
  - **Correction (2026-10-27):** those counts are `run.mts`'s, which
    counts a test's, an action's or a navigation's timeout but not a
    fixture teardown's or an `afterAll` hook's. Counted from the records
    (`benchmarks/2026-10-27-gate-d-rerun/analyse.mts`), clean WN had 8,
    10 and 22 timeouts in Standard, 7, 10 and 9 in security (recorded as
    none) and 17, 7 and 6 in accessibility (5, 0 and 3). W1, with-bugs
    and the fixture had none either way. The ruling stands: it rests on
    clean overloading with 6 workers, which the higher counts confirm.
- **The capped Standard collapse:** TFP-157's slot server gave a freed
  slot to a waiter whose connection had gone, and held it for the 60 s
  lease. Measured afterwards: five abandoned waiters made the next
  request wait 61,007 ms instead of about 1 s.

**Ruling:**
1. **TFP-157's leak is fixed first, inside TFP-157.**
   - A waiter whose connection closes is dropped, and its slot goes to
     the next live waiter.
   - A test with abandoned waiters: a worker restart after a failed test
     must not leave the next request waiting out a lease.
   - Unit, regression and host-limits tests as before.
   - Stop for verification.
2. **Decision 13 stays open; nothing is reverted.**
   - with-bugs: 39.7% against 40%, within the run-to-run spread.
   - clean: 6 workers overload the local copy's API, so results change
     with the worker count (Acceptance Criteria 7). Decision 12 holds
     that open.
3. **D26 moves into Phase 39, before the re-measurement.** The Toolshop
   copies move into WSL's Linux filesystem, as D26 in the register says,
   with its proof that only speed changed (failure sets, score, bug 80).
   Stop for verification.
4. **One overnight session after 1 to 3** re-runs Gate D's Toolshop part
   (W1 against WN, both copies, Comprehensive and Standard) and the
   capped hosted practicesoftwaretesting.com run.
   - If clean still overloads or gives different results with 6 workers,
     a lower local-host limit (for example 3) is measured in the same
     session as a further variant.
5. **The capped run's time budget** is decided on that re-measured number
   (a longer budget, or a page limit on capped hosts). It is not changed
   before then.
6. **TFFU-108** varies between runs on with-bugs, whatever the worker
   count. Recorded with the varying tests (Decision 7's method), not a
   defect of Phase 39.

**Progress:**
- **Ruling 1:** fixed in `66cd0c0`, verified (Cowork), pushed.
- **Ruling 3, built 2026-10-27; independently verified 2026-10-27
  (Cowork, read-only, fresh clone at `82421c9`):** `compare.mjs` re-run
  gives output identical to the committed `comparison.txt` (but for a
  byte-order mark): 0 test results unlike every Gate D round on all six
  suites; 0 evidence items changed on bugs steady at Gate D; 0 bug
  verdicts changed, bug 80 included (1 item, as in all three Gate D
  rounds). The re-measurement's W1 failures (with-bugs 84/3/41, clean
  46/2/19, every round) match the D26 run's. The workarounds table and
  `scripts/toolshop-local/README.md`'s timings are updated. Not checkable
  from here: the WSL filesystem itself (`logs/environment.txt` is the
  evidence). The run-time baseline is the re-measurement's W1.
  Originally: **Ruling 3, built 2026-10-27, awaiting verification**
  (`benchmarks/2026-10-27-d26-wsl/README.md`). Both copies run from
  `~/practice-software-testing` in Ubuntu under WSL.
  - **The proof:** one W1 round of all three suites on each copy, test by
    test against Gate D's three W1 rounds: 0 results unlike every round,
    and 0 answer-key verdicts changed, bug 80 included. Clean was crawled
    and generated afresh, as it reseeds its product ids on every start.
  - **Starts:** first 65 s (with-bugs) and 51 s (clean), from 20 to 25
    minutes; later 38 to 49 s (with-bugs) and 46 s (clean), from 863 to
    1,070 s and 381 to 391 s at Gates B to D.
  - **A workaround the move needed:** the API's storage goes to php-fpm's
    user once composer has exited, for both copies, as a Linux filesystem
    enforces composer's uid-82 `chown` (the API answered 500
    without it). The composer reinstall without its timeout is removed.
  - **The times aren't the baseline:** one round, on a machine in use.
    Ruling 4's session takes it.

### Re-measurement ruling (Emil, 2026-10-27)

**Measured** (`benchmarks/2026-10-27-gate-d-rerun/analysis.md`, `b8732a4`):
one session, 2026-10-27 16:54 to 20:31, on `abc227c`, after D26. Medians of
three; the capped run once. Recomputed from the per-round times in a
planning pass (Cowork), and they match.

| | W1 | WN (6) | W3 | Same results as W1 |
| --- | --- | --- | --- | --- |
| with-bugs, Comprehensive (security + accessibility) | 217 s | 123 s, 43.3% faster | 124 s, 42.9% faster | WN yes, W3 yes |
| with-bugs, Standard | 651 s | 311 s | 297 s | WN yes, W3 yes |
| clean, Comprehensive | 158 s | 367 s, 132.3% slower | 156 s, 1.3% faster | WN no, W3 yes |
| clean, Standard | 337 s | 342 s | 180 s, 46.6% faster | WN no, W3 yes |
| fixture, all three suites (W1 against WN) | | | | yes (Decision 12) |
| capped practicesoftwaretesting.com | Standard 1,369 s (28 timeouts), security 478 s, accessibility 140 s; 33 min in all; mean wait for a slot 2.84 s (Gate D: 954 s) | | | |

- Clean round 2's slow WN and W3 Standard passes: the session's own repo
  scan overlapped them for 2 min and 28 s, and every clean pass ran beside
  the same 16 monitor loops (15 left over from Gate D's session). Neither
  explains the slowdown, and the clean verdict is the same with or without
  round 2 (146.1% slower without it). Seven background Edge processes ran
  the whole session; Edge's Startup boost and background apps are now off,
  and `run-all.sh` warns about both kinds of process (`0cd5612`).

**Ruling:**
1. **The machine's limit becomes 3 workers at most:** half the machine's
   cores, at least 1, and no more than 3. It applies to both rows that use
   it — a local host and a host with the ownership confirmation.
   - With 6 workers the clean copy's API overloaded and results changed
     (Decision 12, Acceptance Criteria 7). With 3, results matched 1 worker
     on every suite of both copies, and with-bugs ran as fast as with 6.
   - The capped row (3 workers sharing 5 requests per second) is unchanged.
   - Rejected for now: workers that back off when a site slows down —
     better in principle, but new design and new measurement. Deferred as
     D36.
2. **Decision 13 is met** on with-bugs at the new limit: 42.9% faster
   against at least 40%, with the same results as 1 worker. On clean,
   Comprehensive gains 1.3%: the local copy's API is the bottleneck (GETs
   over 4 s under load), recorded as the target's limit, not TestForge's.
   Clean's Standard is 46.6% faster.
3. **TFP-157's leak fix holds** on the hosted site (23 min for Standard,
   against Gate D's 8 h 9 min collapse).
4. **Ruling 5 is decided by one last measurement, with its outcome set in
   advance.** The mean slot wait (2.84 s) is longer than a shared check's
   2 s assertion wait (TFP-215), so the cap itself may fail tests that
   would pass uncapped — which would read to a tester as the site's
   defects.
   - **The experiment:** local with-bugs reached through the machine's LAN
     address, so it gets the capped row (as Gate D's capped fixture
     variant did), against W1 uncapped on loopback; Standard, security and
     accessibility; three rounds; on the new limit's code; a quiet night.
   - **If every test gives the same result capped and uncapped** (beyond
     the tests already known to vary, Decision 7): the capped time budget
     is 60 minutes, and a test that times out on a capped host is reported
     **Not run, "needs more requests than the request cap allows in its
     time"**, not Failed.
   - **If results differ:** on a capped host, the shared assertion wait
     and the test timeout are lengthened by the mean slot wait measured in
     that run, and re-checked once in the same session. Any test that
     still differs is reported Not run under the request cap, with its
     reason. The budget is 60 minutes.
   - **Either way, Phase 39's timing runs end there.** Gate D closes on
     that session's result, and the phase completes once D26 is verified.

**Progress:**
- **Ruling 1:** built in `bb0b4be`; independently verified 2026-10-27
  (Cowork). `machineWorkerLimit` evaluated for 1 to 32 cores gives 1, 1, 1,
  2, 2, then 3 from 6 cores up; on 12 cores a local host and a confirmed
  host get 3 workers and no cap, a remote host 3 workers capped at 5
  requests per second. It is the only place a worker count is derived
  (`executor.ts` and `stale-recheck.ts` pass it through). The builder's
  unfiltered runs: unit 609 of 609, regression 59 passed. Its review's two
  low findings are left as they are, ruled: the setup-doc test pins the
  constant and the boundary test proves `machineWorkerLimit` uses it; the
  re-measurement's `run.mts` is frozen evidence and isn't edited.

### Ruling 4 amended (Emil, 2026-10-28): the experiment stops at its dry run

**Measured** (`benchmarks/2026-10-27-ruling-4-capped/`, `96ffcf3`): one dry-run
round, local with-bugs reached through the LAN address (capped, every
request counted, the API at `localhost:8091` included) against 1 worker
uncapped on loopback; the same suites, only the address rewritten.

| Suite | Uncapped | Capped | Failed, uncapped / capped | Capped timeouts |
| --- | --- | --- | --- | --- |
| Standard | 618 s | 4,322 s | 84 / 348 | 334 |
| security | 82 s | 1,401 s | 3 / 108 | 105 |
| accessibility | 120 s | 932 s | 41 / 76 | 73 |

Mean wait for a slot 6.18 s (the hosted site: 2.84 s). Capped passes
averaged 5.15 to 5.30 counted requests per second against a cap of 5.

**Ruling:**
1. **The answer is "different", and the three-round session isn't run.** No
   number of rounds can turn 348 against 84 into the same results.
2. **Ruling 4's "different" remedy is replaced.** Lengthening waits by the
   measured mean slot wait ties TestForge to one site's number (6.18 s here,
   2.84 s hosted). Instead (TFP-264):
   - each test on a capped host records how long it waited for slots;
   - a test that fails or times out on a capped host, having waited for
     slots longer than its assertion wait, is reported **Not run, "starved
     by the request cap"**, with the time it waited, never Failed;
   - a test that fails without that much waiting stays Failed;
   - the capped run's time budget is 60 minutes (ruling 5).

   **Amended 2026-10-28 (Emil; TFP-264's build showed the gap):** only
   slot waiting that **overlaps the step that failed** counts. A test is
   starved when its own requests' waiting during that step (from the
   step's start to the failure) exceeds that step's assertion wait — 2 s
   for a shared check, 5 s otherwise. Waiting earlier in the test doesn't
   count, so a check that fails at once, or after its requests arrived,
   stays Failed. As first worded, any waiting in the test counted, and
   with slot waits averaging 2.8 to 6.2 s on capped sites real defects
   would have been reported Not run (RUN-42's lease test showed two).
   Rejected: re-running starved candidates once under the cap (catches
   more, but costs run time on every capped run).

   **Amended again 2026-10-28 (Emil; questions from `f8333b6`):**
   - **Slack:** "exceeds its assertion wait" is read as at least the
     assertion wait less 100 ms. A 2 s step measures as little as
     1,900 ms (TFP-215's boundary test), and waiting can't outlast its
     step; without the slack a starved check could never qualify.
   - **A failing step that isn't an assertion** (a click, fill or load that
     waits out its timeout) is starved only if the test's own requests were
     **still waiting for a slot when the step failed**, within the same
     100 ms: the page was still incomplete when it was judged. Otherwise it
     stays Failed, so a missing button on a page that finished loading
     isn't hidden. (Measured on `f8333b6`'s rule: a 30 s click with only its
     first 6 s queued came out starved.) Rejected: the assertion rule for
     actions (can hide real defects); never starving an action (would
     blame the site for the cap's slowness).
   - **The stale re-check isn't judged** (it has no timing reporter): a
     reused test it re-runs keeps its re-run result. Deferred as D37 and
     listed in `TEST_PLAN.md`'s known limitations; it doesn't hold Phase 39
     open.
3. **The cap is proven, not assumed** (TFP-265). Counted requests above 5
   per second may be slots handed back by connections that closed before
   their request left (TFP-157's leak fix), which would be harmless, or
   real arrivals above the cap, which would break the README's promise.
   Acceptance Criteria 6's method with a recording site decides it,
   including tests that end while their requests still wait.
4. **Phase 39's timing runs are over.** Gate D closes, and Phase 39
   completes, when TFP-264 and TFP-265 are built and verified with tests on
   the fixture; that is `0.2.0`.
- Noted, not acted on: until Phase 43, Standard against a remote site is
  largely cap-starved. TFP-264 makes that honest in the report; Phase 47's
  localhost-first scope already avoids it in CI.

### TFP-264 — Cap-starved results reported as Not run (added 2026-10-28)

- **Phase:** 39 · **Priority:** P0 · **Labels:** `run`, `report`
- **Problem it solves:** on a capped host, a test can fail only because
  TestForge's own request cap made it wait. The tester reads that as the
  site's defect (with-bugs: 348 failed capped, 84 uncapped).
- **Scope:** the request-cap module records each test's total slot wait;
  the report and saved run carry it; a capped test that failed or timed out
  after waiting longer than its assertion wait is Not run with the reason
  "starved by the request cap" and its wait; the run line and report count
  them; the capped time budget becomes 60 minutes.
- **Acceptance criteria:**
  - on the fixture under the cap, a test made to wait past its assertion
    wait is Not run with the reason and its wait; the same test uncapped
    passes;
  - a test that fails for a real defect under the cap, with little waiting,
    stays Failed;
  - **(added 2026-10-28)** a test that waits for slots early, then fails
    for a real defect in a later step whose requests didn't wait, stays
    Failed; a shared check (2 s assertion wait) starved during its failing
    step is Not run — both in a real browser on the fixture;
  - uncapped runs are unchanged: template output byte-identical
    (`check:template-unchanged`), unit and regression suites pass in full;
  - `TEST_PLAN.md` gains the case; RUN-42 notes the change.
- **Dependencies:** None.

#### RUN-44 evidence

Moved word for word from [`docs/test-plan/RUN.md`](../test-plan/RUN.md) by TFP-253; the case's row there links here.

**Test:** On a capped host, a failure the request cap starved is Not run, not Failed (TFP-264, Phase 39 ruling 4 amended, 2026-10-28, item 2 as amended, amended again and clarified a third time the same day; unit: `cap-starved.test.ts` decision table and boundaries, `execution.test.ts` flattenSuites; `cap-starved.test.ts` real browser through the executor, on the recording site `host-limits.test.ts` shares)

**Expected result:** The cap's module (`request-cap-fixture.ts`) records each test's waiting for request slots: the spans in which at least one of the test's own requests waited: only real waiting, a request the slot server queued (its answer says so, `x-testforge-cap-queued`), one given up while queued, or one still waiting as the test ends, never a slot that was free at once (an earlier check's images still queued on a shared visit are that check's: a resource a page's HTML pulls in, an image, stylesheet, script, font or media, counts for the test whose navigation asked for that page, not the one running when it reaches the cap's route; everything else, the navigation itself, a fetch or XHR, an API request and a request with no frame, counts for the test running, so the fetches a later check's click sets off on a shared page are that check's. Not told apart: an image a later check's own action brings in, such as a lazy image it scrolls to, counts for the page's test), their total on the record (`request-cap-wait` annotation, `requestCapWaitMs`), and on a failure the spans and its assertion wait (`request-cap-waits`: 2 s in a page's shared group, TFP-215; Playwright's 5 s otherwise). The timing reporter records when each step started and whether it timed out (its error's first line says `Timeout N ms exceeded` or `Test timeout of N ms exceeded`, as Playwright 1.59 words both). Once a capped run's passes are merged (`cap-starved.ts`, before the stale re-check reads its failures; the re-check runs without the timing reporter, so a reused test it re-runs keeps the re-run's own result), a failed test is **starved** when its waiting during the step that failed (its last step to end, when that failed and isn't TestForge's caught settle wait), from the step's start to the failure, is as long as that step's assertion wait, less 100 ms of step-timing slack (owner ruling: TFP-215's own boundary test measures a 2 s shared check at 1,900 ms or more, and waiting can't outlast its step). A failing step that isn't an assertion (a click, fill or load that waited out its timeout) is starved only if it **timed out** and one of the test's own requests was still waiting for a slot when it did, within the same 100 ms: the page was still incomplete when it was judged. An action that fails at once (a strict-mode violation, a detached element, an invalid selector) fails on what the page is, not on the wait, and stays Failed even with a request queued at that moment (a third clarification). It gets a `request-cap-starved` annotation, and the report records it **Not run**, "starved by the request cap: during the step that failed, its requests waited N s for slots, as long as its M s assertion wait, so its failure says nothing about the site" (an assertion) or "starved by the request cap: when the step that failed gave up, its requests were still waiting for slots (N s of waiting during it), ..." (any other step), its failure message kept. Waiting earlier in the test doesn't count: a check that fails at once, or after its requests arrived, stays Failed, and so does a test that failed outside any recorded step (a hook, a fixture, a plain throw) or went on from a failed one. A missing button on a page that had finished loading stays Failed, however long the page waited first. The stale re-check's re-runs aren't judged (known limitation 10, D37). A pass stands whatever it waited. The run says how many were starved ("Request cap: N test(s) failed while the cap held up their requests in the step that failed, so they are reported Not run ..."), and the saved run keeps the count (`hostLimits.requestCap.starved`). A capped run's budget is 60 minutes (ruling 5), whatever the suite's size, the stale re-check included (it gets what is left of them, not 60 more). Uncapped runs record no wait and are unchanged. **Proven (decision table, offline):** waiting through the failing check is starved; waiting only before it, 2 s of a 5 s check, none, an instant failure after a long wait, and no failing step are not; a navigation that timed out still waiting is; a click that timed out with its page queued only at its start is not, one with a request still waiting 50 ms before it failed is, one whose last wait ended over 150 ms before is not, and, as clarified a third time, a click that failed at once on a page still loading, one that failed late but not by timing out, and a load refused at once, each with a request still waiting, are not; a shared check waited through its 2 s is, 1.5 s of it is not; at 2 s less the slack it is, 1 ms less it is not; the failing step is the last to end when it failed, never a caught settle wait or a failure the test went on from; the marker marks only an unexpected test with waits and timing, once; failed and starved maps to Not run with the reason and wait, and other results keep theirs; the fixture and marker write the names the report reads. **Proven (real browser, the executor, a site on this machine's LAN address):** capped, a page of 200 images can't load inside the 30 s test timeout, and the test is Not run, starved, the summary counting no failure, the run saying 1 starved and its budget 3600 s; the same test with the ownership confirmation's stub (uncapped) passes with no wait recorded; capped, a wrong heading on a page of 10 images (some waiting, under 5 s) stays Failed and the run says 0 starved; capped, a page of 60 images that waits about 12 s while loading, then a wrong heading, stays Failed (as first worded, any waiting in the test counting, it was Not run with 12.3 s: checked by mutation, 2026-10-28); a test that leaves 200 images queued in a context it keeps open is followed by one that fails on purpose 6 s later, which stays Failed with 0 ms of waiting recorded (counted per worker instead, its recorded wait was 11,038 ms, its status Failed either way as its failing step is instant: checked by mutation, 2026-10-28). Reopened the same day: in Linux runs it failed intermittently, about 11 s charged to the next test (Cowork 3 of 4 on `afc4873`, 2 of 3 on `56ef95e`; reproduced in Ubuntu under WSL, 1 of 3 whole-file runs on `5300706`, the first test recording 0 ms): the test ends as its page commits, and when the browser had not yet parsed it, the images reached the cap's route once the next test had begun, and were charged to the test running. The page now sends its images a second after its head, so the case always takes that path; with requests charged to the test running, as before, it failed 2 of 2 on Windows (10,023 ms) and 3 of 3 in WSL (9,981 to 10,021 ms); charged to the test that loaded their document, it passed 20 times in a row on Windows and 20 in a row in Ubuntu 26.04 under WSL (2026-10-28, ruling 1 on TFP-265); a test whose click on a page an earlier test loaded and kept sets off 100 API calls, which the cap holds through its 5 s assertion wait, is Not run, starved, as those calls are its own (charging every request to the test that asked for the page, as a first version of the fix did, it was Failed with 0 ms: checked by mutation, 2 of 2); a real shared check (`shareReadOnlyVisits`, 2 s assertion wait) on a page whose 100 API calls are still waiting for slots when it checks is Not run, starved, "as long as its 2 s assertion wait"; RUN-42's lease test's instant deliberate failures stay Failed though their pages waited; capped, a click on a missing button on a page whose 30 slow images waited for slots only during its first seconds times out at 30 s and stays Failed (judged by the assertion rule instead, as `f8333b6` did, it was Not run with 7.8 s: checked by mutation, 2026-10-28); capped, a load refused at once by a port nothing listens on stays Failed with 0 ms of waiting (with every slot counted as waiting, as before, its recorded wait was 18 ms: checked by mutation; that run's failure came over 100 ms after the free slot, so it stayed Failed either way, but one within 100 ms would have been starved); the slot server answers its first 5 slots `0` and the 6th, after waiting, `1`; capped, a click whose locator matches all 200 images of a page still waiting for slots fails at once on a strict-mode violation and stays Failed (without the timed-out condition, as `afc4873` built it, it was Not run, "still waiting for slots", 5,519 ms recorded: checked by mutation, 2026-10-28); the timing reporter marks the capped settle wait (`timedOut`) and no step that passed (`timing.test.ts`).

### TFP-265 — Prove the cap at the server (added 2026-10-28)

- **Phase:** 39 · **Priority:** P0 · **Labels:** `run`, `test`
- **Problem it solves:** capped passes counted 5.15 to 5.30 requests per
  second against a cap of 5; nothing recorded what reached the server.
- **Scope:** with Acceptance Criteria 6's recording site, record each
  arrival's time; include tests that end, and workers that restart, while
  their requests still wait for slots.
- **Acceptance criteria:**
  - no second has more than 5 arrivals at the recording site, across at
    least three runs; or, if one does, the cause is fixed in this ticket and
    the check passes after it;
  - the counted rate's excess over arrivals is explained in the ticket's
    report (for example, slots handed back unused).
- **Dependencies:** None.

**Ruling 4, item 2, a third clarification (Emil, 2026-10-28, on `afc4873`):**
a failing step that isn't an `expect` step is starved only if it **timed
out** and one of the test's own requests was still queued for a slot when it
did (within 100 ms). An action that fails at once — a strict-mode violation
(two matching elements), a detached element, an invalid selector — fails on
what the page is, not on the wait, and stays Failed even if a request was
queued at that moment. Rejected: counting any queued request at failure
(as built in `afc4873`), which would hide those failures.

**Progress:**
- **TFP-264:** built through `e9943b4`, `f8333b6` and `afc4873`; independently
  verified 2026-10-28 (Cowork) on `afc4873`: the rule's code matches the
  ruling in both branches; `cap-starved.test.ts` 13 of 13 and
  `execution.test.ts` pass in a separate Linux environment, the 8
  real-browser cases included (Chromium 1243, newer than the builder's);
  `check:template-unchanged 57bcc76 afc4873`: 166 of 166 identical, no
  generator file changed. Open: the instant-failure clarification above,
  one follow-up commit with a real-browser case (a strict-mode failure while
  a request is queued stays Failed), then TFP-265.
- **TFP-264's verification is reopened (Cowork, 2026-10-28, 06:15).** In
  the Linux environment, `cap-starved.test.ts`'s case "requests an earlier
  test left waiting don't count as the next test's wait" fails
  intermittently: 3 of 4 runs on `afc4873`, 2 of 3 on `56ef95e`, each time
  with about 11 s (10,963 to 10,997 ms) charged to the next test instead of
  0. The 13-of-13 recorded at 04:40 was a run where it passed. The verdict
  in that case stays right (the next test fails for its own reason), but a
  wait charged to the wrong test can turn a real failure into "starved"
  when the failing step is an `expect`. It passes on the builder's Windows
  machine, which is why the builder and its review didn't see it.

**Rulings on TFP-265 (`5300706`, Emil, 2026-10-28):**
1. **The carry-over flake is fixed first, as part of TFP-264.** Reproduce it
   in Ubuntu under WSL, find why an earlier test's queued requests are
   charged to the next, and fix it. Proof: the case passes at least 20
   times in a row both on Windows and in WSL; record the counts.
2. **The `AbortError` fix stays in TFP-265.** A test failed by its own
   context closing while its requests waited is the cap failing a test,
   the same family as TFP-264. Accepted although outside the stated scope.
3. **The run line says what happened:** "N slot(s) given; M request(s)
   gave up waiting when their test ended", replacing "N request(s) to the
   site took a slot", which counted both.
4. **Workers that restart are asserted,** as TFP-265's scope says: a test
   that fails, so Playwright restarts its worker while its requests wait,
   inside the arrival runs; no second over 5 arrivals.
5. **A context that closes after its request got a slot but before it was
   sent:** check whether Playwright 1.59 can do this. If it can, drop it
   quietly as in item 2 and add a case; if it can't, say why in the
   ticket's report.

**Verification of `70a0ad3` (Cowork, 2026-10-28, 08:30, Linux, 2 cores):**
- **The carry-over fix holds:** "requests an earlier test left waiting"
  passed 20 of 20 in a row here, where it had failed 3 of 4 on `afc4873`.
- **`check:template-unchanged 57bcc76 70a0ad3`:** 166 of 166 identical.
- **Every cap case that doesn't depend on the worker count passes:**
  `cap-starved.test.ts`, `execution.test.ts` and the rest of
  `cap-arrivals.test.ts` and `host-limits.test.ts`, 37 of 39.
- **Two fail, on this machine's core count, not on the cap:** with 2 cores
  the machine's limit is 1 worker.
  - `cap-arrivals.test.ts`'s restart case assumes the three groups' first
    tests run in three different workers (`workers:
    {"ends-1":0,"ends-2":0,"fails-1":0,"fails-2":1,"times-out-1":1,"times-out-2":2}`).
  - TFP-157's Acceptance Criteria 6 case ("at most 3 workers sharing 5
    requests per second, measured at the server") asserts more than one
    worker was used ("1 workers").
  - The nightly runs these real-browser tests on GitHub's `ubuntu-latest`
    (4 cores, so a limit of 2 workers), and hasn't run them yet.

**Rulings on `70a0ad3` (Emil, 2026-10-28):**
1. **The worker-count tests don't depend on the machine.** Give the
   executor's worker count a test-only override (as the ownership stub
   does), set it in those cases to the count they assume, and prove each
   with the machine limit forced to 1, 2 and 3. Then run the nightly by
   manual dispatch and show it green.
2. **The lazy-image gap is a known limitation, not fixed here:** an image a
   later check's own action brings in (a lazy-loaded image it scrolls to)
   is charged to the test that loaded the page, so a starved check of that
   kind can still come out Failed. Listed in `TEST_PLAN.md`'s known
   limitations with its issue, and deferred as D40.
3. **The run line's last clause** ("W request(s) waited for a slot, the
   ones given one S s in all") is accepted as worded.
4. **The WSL setup stays** in the Ubuntu user's home: the nightly runs on
   Linux, and the carry-over flake showed only there. Noted in `CLAUDE.md`
   in one line: where it is and that it's for reproducing Linux-only
   failures.

**Verification of `b38c622` and `4b7120b` (Cowork, 2026-10-31, Linux, 2
cores, machine limit 1):**
- `cap-arrivals.test.ts`, `host-limits.test.ts` and `split.test.ts`
  together: 22 of 22, three rounds in a row — including Acceptance Criteria
  6 (no second over 5 arrivals), the restart case and the new
  garbage-collection case. Two of these failed here on `70a0ad3`.
- `cap-starved.test.ts`: 15 of 15.
- No generator file changed since `70a0ad3`, so the builder's 166-of-166
  template check stands. The builder's evidence: unit 631 of 631; regression
  59; the nightly by manual dispatch green on `b38c622` (630 passed, 1
  Windows-only skip; template 166 of 166).
- `4b7120b`'s release paths read: a held slot is released when its
  response arrives or its request fails, and on context close; the held
  set can't grow without bound.

**Rulings (Emil, 2026-10-31):**
1. **`4b7120b` is accepted** although no ruling asked for it: it fixes the
   cap handing a slot back before its request arrived, which is the
   promise TFP-265 exists to prove.
2. **TFP-265's "never more than 5 arrivals" is re-established on the fixed
   code** by the runs above and the builder's. The nightly runs the arrival
   cases every night from now on, so a regression shows.
3. **The 712 and 724 ms failures** (close to the test's own 300 ms pause)
   stopped once the helper was fixed and stay unexplained: recorded as one
   data point. If they recur, they're investigated, not re-explained.
4. **The garbled sentence in `b38c622`'s message** is corrected in the
   next commit's body, as the builder proposed.

**Gate D closes, and Phase 39 is complete (2026-10-31).** TFP-157, TFP-158,
TFP-264 and TFP-265 are verified; D26 is verified; the timing runs ended
with ruling 4 amended. This is `0.2.0` in `CHANGELOG.md`, tagged by the
next handover's version step with the owner's confirmation.

#### RUN-45 evidence

Moved word for word from [`docs/test-plan/RUN.md`](../test-plan/RUN.md) by TFP-253; the case's row there links here.

**Test:** The request cap, proven at the server; a test whose context closes while its requests wait isn't failed by the cap (TFP-265, Phase 39 ruling 4 amended, item 3, and the rulings on TFP-265; unit: `host-limits.test.ts`, the slot server offline and the run line; `cap-arrivals.test.ts`, the executor in a real browser on the recording site, and Playwright directly)

**Expected result:** Capped passes on 2026-10-27 counted 5.15 to 5.30 requests a second against a cap of 5, and nothing recorded what reached the site. The slot server now counts, beside the requests that asked for a slot (`requests`), how many were given one (`granted`) and how many gave up their place while they waited (`gaveUp`: their context closed or their worker ended first); once a run's workers have ended the two make up `requests`, and the saved run keeps both (`hostLimits.requestCap`). A waiter that gave up never takes a slot, so it never arrives. The run says them apart (ruling 3): "Request cap: N slot(s) given; M request(s) gave up waiting when their test ended; W request(s) waited for a slot, the ones given one S s in all.", replacing "N request(s) to the site took a slot", which counted both. A context that closes after its request's slot came but before the request went on (ruling 5) can't fail a test: Playwright 1.59 resolves the route's call, drops the request (it never reaches the site) and rejects its response at once, which hands the slot back (read from the cap's route, not measured on a slot); should a later Playwright throw there instead, the cap's route drops the request as it does a waiter's. A request still waiting for a slot when its context closes is dropped quietly: before, the cap's route rethrew the abort, and the test that owned the context was reported Failed, "AbortError: This operation was aborted", however its own checks had gone (in the 2026-10-27 capped hosted runs, 16 of 486 Standard, 34 of 122 security and 16 of 80 accessibility tests; 3 of 122 in the with-bugs security dry run). Any other slot failure (the slot server's error) still throws, and fails the test, as before. **Proven (boundary values, offline):** 8 at once are 8 asked, 8 given, none gave up; 5 holders and 5 waiters that give up, then one more, are 11 asked, 6 given, 5 gave up. **Proven (real browser, the executor, a site on this machine's LAN address; 3 runs):** with a test that passes while its page's 200 images still wait, one that fails at once with its images waiting, and one that times out at 5 s while its images wait, and page loads and an API request beside them, the test after each failure ran in a worker Playwright had started anew, one no group's first test ran in, while the two tests that passed shared theirs (ruling 4: each test tells a loopback site its worker index; in each of 6 runs on 2026-10-28, workers 1 and 2 followed by 3 and 4, in either order, and 0 for both), no second at the site had more than 5 arrivals (5 in each run); at least as many slots were given as arrived, a count, not matched per arrival (given and arrived, four sets of 3 runs on 2026-10-28: 62 and 61 in each; 61 and 60, 59 and 58, 61 and 60; inside the full unit run, 62 and 59, 86 and 85, 57 and 56; with the restarts asserted, 62 and 61, 57 and 56, 59 and 58; and inside the full unit run, 53 and 51, 55 and 54, 58 and 56); 445 asked in every run but one (248, under the full unit run's load), of which 195 to 395 gave up, 9 to 36 asks a second over each run's arrivals against at most 5 arrivals: the count above the cap is waiters that gave up; the passing test stayed Passed (before the fix it was Failed in each of 2 runs, with the AbortError in the one whose message was read); the run line gives the slots given and the requests that gave up, never "took a slot". **Proven (real browser, Playwright directly):** a context closed after a route handler's slot came, then `route.fallback()` or `route.continue()`: the call resolves, the response rejects within 1 s (1 to 2 ms measured), and nothing reaches the server. **A worker's garbage collection doesn't hand back a held slot (found 2026-10-30, Phase 39 step 3f):** a slot is an unread fetch response, and collecting one nobody keeps closes its connection, which hands the slot back with its request still on its way. On Windows, in a full unit run, Acceptance Criteria 6's case saw 6 arrivals within 769 ms, which needs a request to arrive at least 231 ms after its slot went back. The cap's module now keeps each held slot's response. **Proven (real browser, through the executor):** the worker forces collections for about 2 s while the site holds its images open for 4 s, and no more than 5 arrive while the first is held, 3 of 3 runs; with the responses dropped (mutation), a sixth at about 1,060 ms, 5 of 5. Only an early close of this kind was found; that one was the cause of the 769 ms is inferred, not caught in the act.

#### TST-05 evidence

Moved word for word from [`docs/test-plan/TST.md`](../test-plan/TST.md) by TFP-253; the case's row there links here.

**Test:** A real-browser case that needs a worker count sets it, so it doesn't depend on the machine (Phase 39 rulings on `70a0ad3`, ruling 1; `setMachineLimitForTests` in `src/lib/run/host-limits.ts`)

**Expected result:** As the ownership stub does, the override stands in for the machine's limit, in tests only; nothing in the app sets it, and a capped host still gets at most 3. Set in the cases that need more than one worker: TFP-265's restart case and Acceptance Criteria 6's (3), and `split.test.ts`'s two executor cases (2). **Proven (2026-10-30, WSL, `taskset` giving Node 2, 4 and 6 cores, so a real machine limit of 1, 2 and 3):** `host-limits`, `cap-arrivals`, `cap-starved` and `split` together, 37 of 37 at each limit, 0 skipped, on the final code. On the same files before the change, at limit 1: 5 of 35 failed (the 4 worker-count cases and the waiter case below); at limit 2: 2 of 35 (the restart case, as on the nightly of 28 to 30 Oct, and the waiter case). Those limits' waiter failures (next request after 724 and 712 ms, against at least 950) went once `takeSlot` kept its fetch response: garbage collecting an unread response closes its connection, measured in a probe (3 of 3 unkept closed with no release, 0 of 3 kept).

