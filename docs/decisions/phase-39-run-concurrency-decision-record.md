# Phase 39 Decision Record — Run Concurrency: Split the Work, Respect the Host

Date: 2026-10-06
Scope: Let Standard and Comprehensive runs spread their tests over several
Playwright workers. Set how many workers a run may use against each kind of
host, with ownership permission lifting the cap. Keep tests that change data
running one at a time.
Status: Locked. Approved by Emil on 2026-10-06, including the owner's
sign-off on Comprehensive testing removing the caps with no separate ask
(Decision 3) and the recommended values. Not started; starts after Phase 38
Gate B.

## Context

- **Comprehensive** runs one worker on any host that isn't a local
  development host (Phase 35 Decision 2), "so it doesn't load the site like
  an attack would". As Comprehensive grows to cover every area and the
  30 APG patterns, one worker running everything gets slow.
- **Standard** runs with 4 workers in fast mode and 2 in deep mode
  (`calculateWorkerCount`, `src/lib/run/executor.ts`), on any host. So the
  two runs follow different politeness rules on the same site.
- **Phase 38 TFP-150** measured Standard with one worker: 954 s on
  practicesoftwaretesting.com. Real runs from the app use 4.
- Workers are separate browsers running in parallel. However the tests are
  divided, N workers means up to N browsers hitting the site at once. So the
  limit belongs to the host, not to how the tests are split.

## Decisions

1. Work is split into units, and Playwright hands the units out to workers
   from a shared queue.
- TestForge writes one test file per area. An area with page-level tests
  (the axe scan, passive security, the accessible-name checks) gets one file
  per page.
- Workers take the next unit as soon as they are free. Areas are not
  assigned one per worker: they differ a lot in size, and a fixed split
  leaves workers idle.
- The report groups results by area and page exactly as today, whichever
  worker ran them.

2. Tests that change data run one at a time.
- Interactive and active tests (journeys, the database round trip, form
  submissions, model-written blocks) run in one serial group. They never run
  alongside each other, so one test's saved data can't change another's
  result.
- Read-only tests run in parallel freely.
- The serial group runs after the read-only tests, never alongside them, so
  no read-only check sees half-saved data (Emil, 2026-10-06).

3. The worker limit depends on the host. Ownership permission removes the cap.

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
  - The report records that the caps were lifted, and why (Decision 4).
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
  browsing-level tests.
  Load testing stays its own opt-in run behind the active gate, as agreed
  on 2026-10-05. This decision does not make it easier to run.

4. The run records how it ran.
- The report and the saved run record the worker count, the host's row in
  Decision 3, and whether the ownership confirmation was present.
- A run that hit the request cap says how often it waited, so a slow run
  can be explained.

5. Output and results don't change, only run time.
- Splitting into files changes how a suite is laid out, not what any test
  checks. Each test's body is measured unchanged on the 166 fixed inputs:
  the same tests, with the same bodies, before and after.
- On the fixture, the same test gets the same result with 1 worker and with
  N. A test whose result changes with the worker count is a defect to fix
  before this phase closes.

6. Decide before measuring.
- Measure run time with 1 worker and with the Decision 3 limit, on:
  - the comparison fixture;
  - a local Docker copy of Toolshop (Testsmith's `docker compose` setup),
    which is a local host;
  - a local Docker copy of the-internet (its own Dockerfile, Apache-2.0),
    which is also a local host. Its hosted copy couldn't be measured in
    Phase 38's TFP-150. The local copy also gives Phase 38's before and
    after: `d90de57` against `d202315`, one worker;
  - practicesoftwaretesting.com, capped.
- The change is kept if the Comprehensive run (every area) on the local
  Toolshop copy is at least 40% faster with the machine limit than with 1
  worker, and no test's result differs between 1 and N workers on the
  fixture. Otherwise it is reverted, and the result is recorded either way.
- The capped run on practicesoftwaretesting.com is recorded for its time and
  its measured requests per second. It does not decide keep or revert.

## Acceptance Criteria

1. Split and queue
- A Comprehensive run of every area on the fixture produces one file per
  area, and one per page for page-level areas, and runs them across the
  workers.
- The report groups results by area and page, the same as a one-worker run.

2. Serial group
- With interactive on, no two interactive tests overlap in time. Test start
  and end times in the run record show it.

3. Host limits
- On a local host the run uses the machine limit, with no request cap.
- On a capped host the run never exceeds the worker maximum, and its
  requests per second stay at or under the cap. A request-recording test
  proves it, as in Phase 35 Acceptance Criteria 2.
- With the ownership confirmation saved, a remote host's run uses the
  machine limit and no request cap. This is checkable once Decision 8 is
  built; until then it is tested with a stub confirmation on the fixture.

4. Same results
- Each test's body is unchanged on the 166 fixed inputs.
- On the fixture, every test gets the same result with 1 and with N workers.

5. Measurement
- The Decision 6 runs are recorded with their durations, and the keep or
  revert rule is applied as written.

## Regression Policy

- Add `TEST_PLAN.md` cases for:
  - the file split;
  - the serial group;
  - each host row of Decision 3, including the ownership row;
  - the request cap;
  - the same results with 1 and N workers.
- The request-recording test from Phase 35 and Phase 38 stays, extended to
  count requests per second.

## Dependencies and order

- After Phase 38 Gate B.
- The ownership row needs Phase 35 Decision 8's typed confirmation. The rest
  can be built first.
- Tickets: TFP-155 to TFP-158, below.

## Backlog

TFP-154 was the last issued ticket (`known-bug-benchmark-backlog-2026-10-06.md`).

### TFP-155 — Split suites into area and page files on a shared queue

- **Phase:** 39 · **Priority:** P1 · **Labels:** `enhancement`, `run`, `generate`
- **Problem it solves:** one long file per run, and one worker on most
  hosts, makes big Comprehensive runs slow.
- **Scope:** Decisions 1 and 5.
- **Deliverables:**
  - one file per area, and one per page for page-level areas;
  - the report grouped as today;
  - `TEST_PLAN.md` cases.
- **Acceptance criteria:** Acceptance Criteria 1 and 4.
- **Dependencies:** Phase 38 Gate B.

### TFP-156 — Data-changing tests run one at a time, after the read-only tests

- **Phase:** 39 · **Priority:** P1 · **Labels:** `enhancement`, `run`
- **Problem it solves:** in parallel, one test's saved data could change
  another test's result.
- **Scope:** Decision 2.
- **Deliverables:**
  - the serial group, run after the read-only tests;
  - `TEST_PLAN.md` cases.
- **Acceptance criteria:** Acceptance Criteria 2. Also shown in the run
  record: no serial-group test starts before the last read-only test ends.
- **Dependencies:** TFP-155.

### TFP-157 — Worker limits and a request cap by host; ownership lifts both

- **Phase:** 39 · **Priority:** P1 · **Labels:** `enhancement`, `run`
- **Problem it solves:** Standard and Comprehensive follow different
  politeness rules on the same site, and neither scales.
- **Scope:** Decisions 3 and 4.
- **Deliverables:**
  - the host table, replacing Phase 35 Decision 2's one-worker rule and
    `calculateWorkerCount`'s fixed 4 and 2;
  - the shared request cap, with its wait count recorded;
  - the run record's worker count, host row and confirmation flag;
  - an extended request-recording test;
  - `TEST_PLAN.md` cases.
- **Acceptance criteria:** Acceptance Criteria 3.
- **Dependencies:** TFP-155. The ownership row is tested with a stub
  confirmation until Phase 35 Decision 8 is built.

### TFP-158 — Measure 1 worker against N

- **Phase:** 39 · **Priority:** P2 · **Labels:** `measurement`
- **Problem it solves:** the speed-up is an estimate until it's measured.
- **Scope:** Decision 6.
- **Deliverables:**
  - the runs on the fixture, local Toolshop and the-internet copies, and
    practicesoftwaretesting.com;
  - Phase 38's missing before and after on the local the-internet copy;
  - the keep or revert rule applied as written;
  - a report under `docs/decisions/`.
- **Acceptance criteria:** Acceptance Criteria 5.
- **Dependencies:** TFP-156, TFP-157. The local Toolshop copy needs Docker on
  Emil's machine.

## Recommended Execution Order

1. TFP-155.
2. TFP-156 and TFP-157, in either order.
3. TFP-158.

## Suggested Milestone Gates

### Gate A — Split and serial
- TFP-155 and TFP-156 landed and independently verified.
- Each test's body is unchanged on the 166 fixed inputs.
- With one worker, the fixture gives the same results as before the phase.

### Gate B — Limits and measurement
- TFP-157 and TFP-158 landed and independently verified.
- The request cap is shown held by a recording test.
- The keep or revert rule is applied and recorded.
