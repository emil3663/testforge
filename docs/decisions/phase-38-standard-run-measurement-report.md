# Phase 38 Measurement Report — The Standard Run

Date: 2026-10-06
Ticket: TFP-150 (Decision 8 as amended 2026-10-06, Acceptance Criteria 4)
Evidence: `benchmarks/2026-10-06-tfp150/`. For each run: the inspected
profile, the generated suite, Playwright's JSON report and a summary, plus
`measure-standard-run.ts`, the driver that made them.
Setup: Emil's machine (Windows), Chromium. Before is `d90de57` (the last
commit before TFP-146), in a git worktree; after is `d202315`. Each run is a
Standard run of all ten areas in fast mode, at the read-only gate
(`TESTFORGE_INTERACTIVE=0`), with one worker. Each real site's before and
after runs were back to back.

## Bottom line

- **practicesoftwaretesting.com: the phase adds one failure, and it is
  real.** The axe scan of `/auth/login` fails on the show-password toggle, an
  icon-only button with no accessible name (R10). The phase removes no
  failure. The other 45 failures were there before the phase. Read by hand,
  22 are template errors (T19 to T23, one cause covers 15 of them), 18 are
  real, and 6 are unclear.
- **the-internet.herokuapp.com was mostly not answering.** 47 of 49 failures
  before and 53 of 55 after are 30 s test timeouts. Inspection couldn't load
  3 of the 5 pages, and `curl` at 03:18 UTC got one 503 after 30.8 s in 9
  requests. Every failure new in the after run is one of those timeouts, so
  none is a finding about a page. The 2 failures that aren't timeouts are
  already labelled (R2, R7).
- **One run went over the 30-minute budget:** the-internet after, 1,914 s.
  Recorded as it is, as Decision 8 asks. It is 11 more tests (the phase's
  new checks) each waiting out 30 s on a host that didn't answer. Nothing
  was tuned.
- **Run time on a site that answers grows by 3 to 12 %:** 926 to 954 s on
  practicesoftwaretesting.com (+26 tests), 69 to 77 s on the fixture
  (+16 tests).

## Durations (Acceptance Criteria 4)

"Run" is the Playwright process, timed by the driver. Inspection and
generation are timed separately. Budget: 1,800 s (the executor's
`maxTimeout`).

| Target | Paths inspected | Commit | Tests | Passed | Failed | Not run | Inspection | Run |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fixture | `/`, `/login`, `/notes` | `d90de57` | 83 | 70 | 9 | 4 | 2 s | 69 s |
| Fixture | as above | `d202315` | 99 | 87 | 9 | 3 | 3 s | 77 s |
| the-internet | 5 asked, 2 loaded (`/dropdown`, `/tables`) | `d90de57` | 56 | 7 | 49 | 0 | 95 s | 1,713 s |
| the-internet | as above | `d202315` | 67 | 12 | 55 | 0 | 95 s | **1,914 s (over)** |
| practicesoftwaretesting | `/`, `/category/hand-tools`, `/category/power-tools`, `/contact`, `/auth/login` | `d90de57` | 255 | 205 | 45 | 5 | 15 s | 926 s |
| practicesoftwaretesting | as above | `d202315` | 281 | 231 | 46 | 4 | 10 s | 954 s |

- These are the first pair. The re-run (below) was also slowed by the
  host, and is not a usable comparison either.
- the-internet's paths were `/`, `/login`, `/checkboxes`, `/dropdown` and
  `/tables`. `page.goto` timed out at 30 s on the first three in both
  inspections, so both runs covered the same 2 pages.
- **One worker, not the app's four.** The app runs a fast-mode Standard run
  with 4 workers (`calculateWorkerCount`). These runs used one, as decided
  for TFP-150. The app's own run time would be shorter.
- The rizonetech.com figure (1,766 s on 2026-10-01) isn't comparable: a
  different site, a different worker count, and before TFP-142's timeout
  fix. Under the 2026-10-06 amendment it was not re-run.
- Not run: 5 to 4 on practicesoftwaretesting.com and 4 to 3 on the fixture.
  This is TFP-146's gates: the script-payload test is now at the active gate.

## New failures, read by hand (Acceptance Criteria 4)

A "new failure" is a test failing after the phase whose title wasn't
failing before it.

### practicesoftwaretesting.com: 1, real

- **`/auth/login passes the WCAG 2.2 A and AA scan`**: `button-name`
  (critical, WCAG 4.1.2) on `.btn-outline-secondary`. Read on the live page,
  it is `<button type="button" class="btn btn-outline-secondary"><fa-icon><svg aria-hidden="true" …></svg></fa-icon></button>`,
  the show-password toggle. Its only content is hidden from the
  accessibility tree, so it has no name: its aria snapshot is `- button`.
  Labelled **R10**.

The phase's other new checks on this site all passed. The axe scans of the
other 4 pages passed, with 2 items each for manual review (`/auth/login`
has 4). The passive security checks passed on all 5 pages, with 10 header
findings per page and the missing-page probe clean. LCP and CLS passed with
no finding, and TBT recorded 47 ms.

### the-internet.herokuapp.com: 10, all host timeouts

The axe scans of `/dropdown` and `/tables`, six passive security checks on
those pages, the TBT check and one extra `:visited` check. Each failed with
"Test timeout of 30000ms exceeded". These are the same timeouts as 47 of
the before run's 49 failures. The cause is the host, not the test:

- Inspection failed on 3 of 5 pages with a 30 s `page.goto` timeout, in both
  runs.
- At 03:18 UTC, `curl` gave 200 in about 0.8 s on 8 of 9 requests, and 503
  after 30.8 s on 1.

They are not added to the labelled set as verdicts. Like the benchmark
suites it leaves out, they aren't a test being right or wrong about a page
(see the set's "Left out on purpose"). The 2 failures that weren't timeouts
are already labelled: `/dropdown`'s unlabelled `<select>` (R7) and
robots.txt with no `Sitemap:` line (R2).

### Fixture: none

The same 9 failures before and after, the same 9 as in TFP-146's gate run
(`benchmarks/2026-10-05-tfp146-gate-run/gate-run.log`): `:visited` styling
(3), the form-action injection on `/login` (T8), canonical (3), and
robots.txt and sitemap (R1).

## the-internet, re-run (2026-10-06, 04:20 to 05:49 UTC)

Asked for once the host was answering again. The same driver, paths and
settings, back to back: `d90de57`, then `d202315` (`HEAD` was `ac9cf44`,
with no code change since `d202315`). Files: `the-internet-rerun-*`.

**Host health, sampled with `curl` over the 5 paths.** 04:19 UTC: 2 of 40
requests got a 503, each after 30.75 s (Heroku's router giving up at
30 s); the rest got 200 in about 0.8 s. 05:50 UTC, after the pair: 1 of 20.
That is better than the first pair's 1 in 9, but a Standard run makes
hundreds of page loads, and each stall costs a test its 30 s.

| Commit | Pages loaded at inspection (of 5) | Tests | Passed | Failed | of which 30 s timeouts | Not run | Inspection | Run |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `d90de57` | 3: `/checkboxes`, `/dropdown`, `/tables` | 76 | 16 | 60 | 54 | 0 | 65 s | **2,072 s (over)** |
| `d202315` | 4: `/login` as well | 121 | 27 | 93 | 87 | 1 | 37 s | **3,223 s (over)** |

- **Still not a usable before/after.** Inspection lost `/` in both runs
  and `/login` in the before run only, so the two suites cover different
  page sets. Timeouts are 90 % of the failures before and 94 % after; the
  after run's 87 timeouts are 2,610 s of its 3,223 s.
- **Both runs went over the 1,800 s budget.** Recorded as they are, nothing
  tuned (Decision 8).

**Failures that were not timeouts, read by hand:**

- "orphan page approximation" (3 before, 4 after): **template error, T24.**
  The check counts links only among the inspected pages. Inspection lost
  `/`, the page that links to every example, so each inspected page looks
  unlinked. It predates the phase; the fourth one after is `/login`,
  inspected only then.
- "no same-origin request fails" (before only): `HTTP 503` on `/`, the
  host.
- Canonical and meta description on `/checkboxes`, and robots.txt with no
  `Sitemap:` line: real, R2.

**New failures in the after run:** 42 titles not failing before. 41 are
30 s timeouts: the phase's new checks (axe scans, passive security, CLS,
TBT) on the pages that loaded, older checks, and 4 form checks on
`/login`, which was inspected only in the after run. The 42nd is the
fourth orphan check (T24), also from `/login`. None is a finding about a
page, and none comes from the phase's code.

## practicesoftwaretesting.com: the failures that predate the phase

The site is new to TestForge. Gate B asks for no unexplained false failure
on the real sites, so all 45 were read on the live pages. All of them also
fail at `d90de57`, so the phase didn't cause any. They are labelled in
`docs/decisions/data/labelled-failures.md`:

| Group | Failures | Verdict | Cause, as read |
| --- | --- | --- | --- |
| T19 | 15 | Template error | "Hand Tools" is in the closed "Categories" dropdown, hidden until opened. Link health and link types (5 pages each) require it visible. Keyboard navigation (5) times out focusing it. |
| T20 | 1 | Template error | At 390 px, "Home" is in the collapsed navbar, behind a visible toggler |
| T21 | 3 | Template error | The "Sort" form check finds the `<select>` by its options' joined text, then counts controls inside the `<select>`: 0 |
| T22 | 2 | Template error | The `/contact` and `/auth/login` form checks look for one element with the whole form's joined label text. None has it |
| T23 | 1 | Template error | The "SearchX Search" accessible-name check asks a plain `<div>` for a name. A generic element has none to give |
| R11 | 5 | Real | With `localStorage` throwing, the app throws uncaught and renders an empty body (0 characters, no products) |
| R12 | 12 | Real | No meta description or canonical link on any of the 5 pages. `/robots.txt` and `/sitemap.xml` answer 200 with the app's HTML shell |
| U2 | 5 | Unclear | No `:visited` rule in 1,826 inspectable rules, as U1 |
| U3 | 1 | Unclear | Footer "explore" card links have the parent's colour and no underline. They are block links with no surrounding text, and which pages show them depends on render timing (the run failed `/category/power-tools`, a later probe failed 3 others) |

The template errors are older than Phase 38 and outside its scope. They
are recorded, not fixed, here.

## `check:template-unchanged`, per ticket (Acceptance Criteria 4)

| Ticket | Commit | Against | Identical of 166 | Differences |
| --- | --- | --- | --- | --- |
| TFP-146 | `245ea6f` | `d90de57` | 12 | the gate annotations and the payload test's gate only |
| TFP-146 | `b9ca79b` | `245ea6f` | 166 | none |
| TFP-152 | `34622b0` | `cdec8e0` | 162 | 4: the accessible-name tests only |
| TFP-152 | `b15714b` | `34622b0` | 162 | 4: the accessible-name tests only |
| TFP-147 | `fc736cc` | `b15714b` | 152 | 14: the Security block and its note only |
| TFP-148 | `12ace9c` | `fc736cc` | 120 | 46: the Accessibility block only |
| TFP-149 | `c4f00df` | `12ace9c` | 110 | 56: the Performance block only |
| TFP-149 | `da2235f` | `c4f00df` | 110 | 56: one line each, the LCP assertion |
| TFP-148 | `73aa393` | `da2235f` | 166 | none (fixture and test only) |
| Phase | `d202315` | `d90de57` | 12 | 154: the sum of the above |

## For Gate B

- TFP-147 to TFP-149 and their follow-ups are verified (the Phase 38
  record).
- Each template diff is confined to its named area (the table above).
- Durations are recorded. Neither of the-internet's pairs is a usable
  before/after: in both, 30 s host timeouts are most of the failures and
  most of the run time, and in the re-run inspection lost different pages
  in each run. On this host, Decision 8's before/after holds only for the
  fixture and practicesoftwaretesting.com. Whether that is enough for Gate
  B, or the-internet is tried again or replaced, is Emil's call.
- Every new failure is explained: 1 real on practicesoftwaretesting.com, 10
  host timeouts on the-internet. The 22 template errors found on
  practicesoftwaretesting.com are false failures, but older than the phase.
  Whether they block Gate B or become tickets is Emil's call.
- Three of the-internet's four runs went over budget, each because of
  host timeouts. Under Decision 8, the split between Standard and
  Comprehensive is revisited.
