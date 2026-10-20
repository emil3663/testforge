# Phase 39 Measurement Report — Where the Run Time Goes (TFP-211)

Date: 2026-10-20
Ticket: TFP-211 (Phase 39 Decision 1, Acceptance Criteria 1)
Evidence: `benchmarks/2026-10-19-tfp211/`. For each site: the crawl and
selection, the three suites, and for each run its records and its raw
timing. `analysis.md` has every number below, with its spread.
Code: the timing record is `684dc0a` (the reporter, RUN-38) and `afa8d4f`
(naming a link check's targets from the suite). The runs started on
`160606e`; `afa8d4f` changed only the summary, which is recomputed from the
raw timing at that commit.
Setup: Emil's machine (Windows, i5-12450H, 12 logical cores, 40 GB). Chromium,
one worker, `--timeout=30000`, the read-only gate. Machine load at the start:
70 Chrome processes, Ollama, Docker Desktop with Emil's Plane stack (8
containers) running (`logs/machine-at-start.txt`).
For Emil to lock: the targets in the last section, before TFP-212 starts.

## Bottom line

- **Page visits are where the time goes.** A visit costs about 1.45 s on
  the local Toolshop (a 0.35 s load and a 1.1 s settle wait) and 0.81 s on
  the static fixture. Loads and settle waits are 55 to 57% of a Standard run
  and 71 to 74% of a Comprehensive security run. Standard visits each
  selected page about 60 times (with-bugs 563 loads, clean 474, over 8
  pages).
- **The settle cap is not the cost; the settle floor is.** Playwright's
  network-idle wait needs 500 ms with no request. The fixture's median
  settle is 503 ms, the floor itself; the Toolshop's is 904 ms, the floor
  plus the app's own API calls. At most 4 visits a run reached the 5 s cap
  (17 s at most). So Decision 6's settle-cap change can save at most about
  1% of a Standard run. Decision 2's fewer visits are the lever.
- **Failing tests cost more than their failed steps.** On with-bugs, the 84
  failing tests take 468 s of test time, 137 s of it in the steps that
  failed (assertions waiting out their 5 s). Outside any test, 136 s more
  goes on restarting the worker: Playwright starts a fresh worker after each
  failed test, about 1.6 s each. Decisions 2 to 6 don't touch that
  restart cost.
- **The four link checks barely overlap.** They share 3 targets on with-bugs
  and 2 on clean. Their cost is their visits: on with-bugs, 115 s for the
  linked-routes check (fresh documents by design), 98 s for the
  navigation-link check, 47 s for TFP-205's link tests, and 7 s for link
  health, which only sends requests.
- **Runs agree closely within a session but drift between sessions.**
  Standard's three runs spread 3% on with-bugs (1,464 to 1,511 s) and 5% on
  clean (1,192 to 1,252 s). But the same code ran 14% slower on with-bugs
  and 19% slower on clean than at TFP-208 (2026-10-16). A fixture run made
  afterwards without the timing reporter took 208 s, against 177 to 178 s
  with it. So the reporter isn't the cost; the machine's state is. Targets
  have to be judged before against after in one session.
- **One check is unstable on clean.** "sort options order the items" failed
  on `/` in all three runs, and on `/category/hand-tools` in run 2 only. It
  passed both at TFP-208. Not investigated: this ticket only measures.
  Raised below.

## Durations

"Run" is the Playwright process, timed by the driver. Each cell is the
median of three runs, with min to max in brackets when they differ. Times
are in seconds.

| Site, suite | Tests | Run | Loads (count) | Loads (s) | Settle (s) | Failing tests (s) | Failed steps (s) | Outside tests (s) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixture, Standard | 123 | 178 (177–178) | 125 | 39 | 62 | 23 | 15 | 11 |
| Fixture, security | 20 | 22 | 19 | 7 | 10 | 0 | 0 | 2 |
| Fixture, accessibility | 12 | 16 | 12 | 4 | 6 | 0 | 0 | 2 |
| with-bugs, Standard | 483 | 1,486 (1,464–1,511) | 563 (561–566) | 202 (200–210) | 608 (605–612) | 468 (454–477) | 137 | 136 |
| with-bugs, security | 122 | 240 (239–247) | 121 | 43 | 124 (123–126) | 12 | 0 | 9 |
| with-bugs, accessibility | 80 | 245 (237–247) | 80 | 27 | 83 (78–86) | 117 (113–118) | 0 | 58 |
| clean, Standard | 472 | 1,231 (1,192–1,252) | 474 | 147 (139–147) | 550 (538–557) | 222 (216–229) | 96 | 97 |
| clean, security | 122 | 229 (223–233) | 121 | 38 | 131 (124–133) | 4 | 0 | 9 |
| clean, accessibility | 80 | 245 (228–283) | 80 | 24 | 90 (84–101) | 75 (70–86) | 0 | 42 |

- **Loads** are `Navigate to` steps: a test's own visits and the link
  checks'. TFP-165's `about:blank` before a hash route is counted apart:
  357 loads and 6 s on with-bugs, none on clean.
- **Results don't move between runs.** with-bugs Standard: 379 passed, 84
  failed, 20 not run, the same 84 in every run (Comprehensive the same). clean
  Standard: 47 failures in every run, plus the sort check on hand-tools in
  run 2. The fixture is the same in every run.
- **Against TFP-208:** clean's failure set is TFP-208's plus the sort check on
  `/`. Four other differences are only the product ID: the clean copy seeds
  new IDs on every start, so the same checks on the first product carry
  another address. with-bugs' is TFP-208's.
- **Settle cap reached:** with-bugs Standard 3 (0 to 4) visits, clean 0 (0 to
  2), Comprehensive never.

## Where a Standard run's visits go (run 1)

Loads by area, over the 8 selected pages:

| Area | with-bugs | clean |
| --- | --- | --- |
| Functional | 329 | 244 |
| Accessibility | 72 | 72 |
| Usability | 55 | 47 |
| SEO and content | 50 | 50 |
| Security (passive) | 32 | 32 |
| Reliability | 17 | 18 |
| Performance | 6 | 6 |
| Responsive | 4 | 4 |
| Cookie and session | 1 | 1 |
| **All** | **566** | **474** |

- **Each selected page is loaded 37 to 55 times** (clean, for example: hand-tools 55, register
  53, product 49, contact 47, login 45, forgot-password 41, rentals 37). The
  start page is loaded more often (147 on clean): the site-wide checks begin
  there.
- **Naming, a limit of the data.** Playwright names a load of an absolute
  address by its path alone, with no fragment (`afa8d4f`). The linked-routes
  check's loads are named from its route list (66 on with-bugs). Another 143
  loads on with-bugs are absolute addresses named `/`, so the per-page split
  is less sure on with-bugs than on clean. The per-area counts and all the
  times are exact.

## The link checks (run 1, every run within 10%)

| Check | with-bugs: tests, loads, requests, time | Targets | clean: tests, loads, requests, time | Targets |
| --- | --- | --- | --- | --- |
| Navigation links (`navigation link health:`) | 24, 48, 8, 98 s | 3 | 24, 24, 24, 44 s | 2 |
| Linked routes (TFP-165) | 8, 66, 0, 115 s | 12 | none (path routing) | |
| TFP-205's link tests and card tests | 22, 22, 0, 47 s | 0 loaded | 21, 21, 0, 44 s | 0 loaded |
| Link health (requests only) | 8, 0, 34, 7 s | 6 | 8, 0, 132, 8 s | 30 |

- **Shared targets:** 3 on with-bugs (`/` by navigation links and link health;
  hand-tools and contact by navigation links and linked routes), 2 on clean.
  TFP-205's link tests load no target of their own on either copy (link
  health or the routes check already does, as designed). Each link test's
  cost is its own page visit.
- **The linked-routes check** loads each route as a fresh document in its own
  page. Its missing-route probe loaded 8 times on with-bugs, once per test:
  each of those tests followed a failure, so each ran in a fresh worker.

## Controls by Decision 3's kinds (inspection, for Emil's later look)

Inspection can't tell a single-page app's path routes from a multi-page
site's links, so same-origin path links are counted as their own kind,
"path navigation", not guessed.

| Page | with-bugs: in place / in-app / path / unclear | clean: in place / in-app / path / unclear |
| --- | --- | --- |
| Home | 24 / 17 / 1 / 9 | 16 / 0 / 19 / 10 |
| Product | 3 / 14 / 1 / 12 | 4 / 0 / 16 / 13 |
| Hand tools | 19 / 17 / 1 / 6 | 17 / 0 / 19 / 6 |
| Register | 2 / 8 / 1 / 19 | 3 / 0 / 10 / 20 |
| Contact | 2 / 8 / 1 / 13 | 3 / 0 / 10 / 14 |
| Login | 2 / 10 / 1 / 10 | 3 / 0 / 12 / 11 |
| Forgot password | 2 / 8 / 1 / 8 | 3 / 0 / 10 / 9 |
| Chainsaws (with-bugs) / Rentals (clean) | 2 / 8 / 1 / 5 | 3 / 0 / 10 / 6 |

The Toolshop is one single-page app with two routings. Its in-app links
are hash routes on with-bugs and path links on clean. "Unclear" is mostly
form fields and plain buttons.

## Proposed targets (for Emil to lock before TFP-212)

All are judged the same way. Before and after are measured in one session
and interleaved, three runs each, and their medians compared. One worker,
the local Toolshop copies, and the suites generated once per side, as here.
Between sessions the same code drifted 14 to 19%, more than any target
below, so a target can't be judged against this report's numbers.

1. **Gate B: shared read-only visits, the shared-page rules (TFP-212,
   TFP-213), and the settle and timeout tuning (TFP-215), together.**
   - **Standard is at least 20% faster on each copy (median).**
     - Basis: Accessibility, usability, SEO, passive security and
       reliability load the pages 226 times on with-bugs and 219 on clean.
     - One visit per page for them is 8 visits. That saves about 218
       visits at 1.45 s, about 316 s: 21% on with-bugs (1,486 s) and 25% on
       clean (1,231 s).
     - Functional's read-only checks sharing the visit too would add to
       that. Some of these tests interact and keep their own page under
       Decisions 4 and 5, so 20% is a target the measurements support, not
       a guess.
   - **Comprehensive security and accessibility are each at least 30% faster
     (median, each copy).**
     - Basis: security loads its 20 pages 121 times, about 101 visits
       over one per page, at 1.39 s: about 140 s of 240 s.
     - Accessibility: 60 visits over one per page, about 84 s of 245 s.
   - **Decision 7's proof holds.** The fixture gives every test the same
     result shared and one-page-per-test. On both copies the failure set
     is this report's, test by test, apart from differences explained one
     by one (the sort check below included). The Toolshop score is
     unchanged.
   - Not met: the change is reverted, and the result recorded either way.

2. **TFP-215 alone: each value it changes must save at least 5% of the
   Standard median on with-bugs, or it is reverted.** 5% is the
   within-session spread; less can't be seen in three runs.
   - The settle cap can't reach 5%: it was reached by at most 4 visits,
     17 s.
   - The failed steps' 5 s waits might: 137 s on with-bugs is 9%.
   - **For Emil:** narrow TFP-215 to the read-only assertion timeouts, and
     leave the settle cap at 5 s. Decision 6 already keeps what counts as
     settled.

3. **Gate C: functional checks by kind of control (TFP-214): at least a
   further 10% on Standard (median, each copy), measured against Gate B's
   code.**
   - Basis: functional is 244 to 329 of Standard's loads.
   - Of those, the linked-routes check's 66 fresh documents stay as they
     are by design. The navigation-link and link tests are about 46 to
     70 visits.
   - The rest depends on the kinds Emil looks at (the control counts
     above), so this is the lowest of the three. Emil may set it after
     that look.

4. **Decision 13 (1 worker against the machine limit, 6 workers here):
   keep 40%.** It stays measured on Comprehensive, every area, on the local
   Toolshop, after Gates B and C, and medians of three each side.
   - After Gate B a Comprehensive run should be about 100 to 160 s, so
     worker start-up weighs more than now. On the other side, the
     per-failure worker restarts (42 to 58 s of an accessibility run
     today) spread over the workers.
   - Nothing here argues for moving the 40%. The local copies' API, in
     Docker on Windows, answered in 0.4 to 1 s while measuring. Six workers
     may queue on it, and Decision 13's run will show whether they do.

## Raised, not fixed

- **The sort check is unstable on clean.** "sort options order the items on
  /" failed in all three runs ("Drawer Tool Cabinet" 89.55 before "Tool
  Cabinet" 86.71 sorting by price, low to high). It passed at TFP-208. On
  `/category/hand-tools` it failed in run 2 only. The clean copy's sorting is
  not one of its known bugs, so this looks like a check reading the list
  before the sorted page has drawn. For Emil: a ticket before Gate B, since
  Decision 7's proof reads failure sets test by test.
- **The worker restart after each failure** is about 1.6 s a failure (136 s
  of with-bugs' Standard run, 58 s of its accessibility run). Decisions 2 to
  6 don't touch it. It is Playwright's own behaviour, so it is recorded
  here and not proposed as work.
- **The step names' limit.** A load or request of an absolute address is
  named by its path alone. The run record names the link checks' targets
  from the suite (`afa8d4f`), but on a hash-routed site the per-page split
  of other loads is approximate. Fixing that would mean `--trace`, which
  slows the run it measures.
