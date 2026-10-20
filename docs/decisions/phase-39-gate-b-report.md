# Phase 39 Gate B Report — Fewer Visits (TFP-212, TFP-213, TFP-215)

Date: 2026-10-20
Tickets: TFP-212 (`be94bff`), TFP-213 (`be94bff`), TFP-215 (`2be975c`); the template baseline moved in `f042d11`.
Evidence: `benchmarks/2026-10-20-gate-b/`. `analysis.md` has every number below.
Targets: locked at Gate A (`phase-39-run-concurrency-decision-record.md`, "Gate A — targets locked").
Setup:
- **Comparison:** before (A, `4a85f1f`) against after (C, `2be975c`), with TFP-212 and TFP-213 alone (B, `be94bff`) for
  TFP-215's bar.
- **One session, interleaved:** three runs of each, one worker, the local Toolshop copies (with-bugs, then clean), every
  variant's suites generated from one inspection per copy.
- **A quiet machine:** browsers and Ollama closed, Emil's Plane stack stopped for the session.
For Emil: Gate B's decision, below.

## Bottom line

- **Standard and Comprehensive security are far past their targets on both copies.**

  | Suite | with-bugs | Target | clean | Target |
  | --- | --- | --- | --- | --- |
  | Standard | 36.4% faster | 20% | 50.0% faster | 20% |
  | Security | 45.9% faster | 30% | 46.2% faster | 30% |

  Standard on with-bugs fell from a median of 1,342 s to 854 s.
- **Comprehensive accessibility is not: 1.0% faster on with-bugs and 8.6% on clean, against 30%.** The cause is
  measured, not guessed (below):
  - two of its four checks per page change the page and keep their own (TFP-214's to share);
  - the axe scan, which fails on most pages, runs first of the two that share, and every failure starts a fresh
    worker, so the next check loads the page again.
- **TFP-215 is kept:** C is 7.1% faster than B on with-bugs Standard (919 s to 854 s), against its 5% bar.
- **Decision 7 holds:** the results are the same before and after.
  - Every suite's failures are the same tests, in every run of A and of C, on both copies.
  - Every test that gives the same result in each run of a variant gives the same failures and findings in A and C.
  - The score's evidence has the same number of items for every one of the 37 bugs, and bug 46's manual-review
    evidence is identical (`bug-46.md`).
  - One difference in a failure's message, not in which test fails, is not explained: below.
- **The gate as locked is not met,** since accessibility misses on both copies. The locked rule is "not met: the
  change is reverted". That would give up the Standard and security gains with them, so it is put to Emil, with the
  options below, not applied.

## Run times (seconds; median, then each run)

| Copy | Suite | A (before) | B (TFP-212, 213) | C (+ TFP-215) | A to C | Target |
| --- | --- | --- | --- | --- | --- | --- |
| with-bugs | Standard | 1,342 (1,352, 1,342, 1,326) | 919 (945, 910, 919) | 854 (865, 854, 845) | 36.4% | 20%: met |
| with-bugs | Security | 205 (213, 205, 196) | - | 111 (110, 111, 113) | 45.9% | 30%: met |
| with-bugs | Accessibility | 206 (206, 201, 206) | - | 204 (203, 204, 206) | 1.0% | 30%: not met |
| clean | Standard | 1,025 (1,034, 1,025, 1,018) | - | 513 (510, 516, 513) | 50.0% | 20%: met |
| clean | Security | 197 (197, 197, 196) | - | 106 (106, 103, 106) | 46.2% | 30%: met |
| clean | Accessibility | 186 (188, 185, 186) | - | 170 (165, 171, 170) | 8.6% | 30%: not met |

- **Within the session, a variant's three runs spread 0.5 to 9%** (A's with-bugs security, 196 to 213 s, the most). A's with-bugs Standard took 1,342 s here against
  TFP-211's 1,486 s for the same code: the quiet machine. That is why the targets compare within one session.
- **Page loads, with-bugs Standard, run 1:** A 570, B 318, C 316. On clean: A 474, C 188.
- **TFP-215 alone** cuts the failing tests' time on with-bugs Standard from 381 s (B) to 321 s (C), run 1: about
  27 assertions a run each waiting 2 s, not 5.

## Why accessibility misses (measured, C, clean, run 1)

| Check (per page, 20 pages) | Shares the visit? | Loads |
| --- | --- | --- |
| The axe scan | yes | 20: it fails on 15 pages; the next shared check reloads after each failure |
| Checkboxes and radio buttons grouped | yes | 15 of 20 (after a failed scan it loads again) |
| Every form field has an accessible name | no: it adds a probe element and removes and restores a placeholder | 20 |
| Tabbed through in reading order | no: it presses Tab | 20 |

- **The two that don't share** change the page and put it back. Decision 3's "in place" kind is for exactly these, so
  sharing them is TFP-214's.
- **The two that do** lose most of their saving to failures:
  - Playwright starts a fresh worker after every failed test, so the page's next check loads it again (Decision 4's
    reload after a failure).
  - On with-bugs the scan fails on all 20 pages, so nothing is saved.

## Decision 7: the same results (`analysis.md`)

- **Failures:** the same tests in every run of A and C, on both copies and in all three suites:
  - with-bugs: Standard 84, security 3, accessibility 41;
  - clean: 46, 2 and 19.
- **Failures and findings, A against C:**
  - In the tests that give the same in every run of a variant: 0 differences, in every suite and copy.
  - Five with-bugs Standard tests vary from load to load within a variant, and are compared apart:
    - the linked-routes check, whose 14 s cutoff leaves a different number of routes unchecked;
    - the two pages' card titles, and the component check that compares them, which bug 4 aligns at random;
    - a lab CLS measurement.
- **The score:** TFP-207's `evidence.mjs` on run 1 gives the same number of evidence items for each of the 37 bugs in
  A and C.
  - The differing lines are the varying kinds above, plus which page the script lists first for an item repeated on
    several (broken.png, "Contakt").
  - Bug 46's manual-review evidence is identical in A and C (`bug-46.md`).
- **Not explained: the with-bugs sort check's message on `/`.**
  - The check fails in every run of both variants, but A names "Name (Z - A)" as out of order in all three runs and C
    in none. "Price (Low - High)" varies within A itself (absent in run 1).
  - The sort check doesn't share a visit, so its code is the same in A and C. What changes is when it runs, since the
    shared checks moved to the end of the file.
  - So the likeliest cause is the with-bugs app's own state at that moment, not the check. That is a reading, not a
    measurement.
  - It changes no failure and no score pattern (bug 2's pattern is the A to Z name sort and the price sorts).

## What else changed (for Emil)

- **Evidence of a shared check's failure is a screenshot of the shared page.** Playwright's own per-test trace and video
  (`retain-on-failure`) belong to its page fixture, which a shared check doesn't use.
- **TFP-213's rules are built and proven on a fixture (GEN-102):**
  - reload after a failure and after leaving the page;
  - typed text cleared;
  - the fresh-page re-run after a state-changing check, both results recorded;
  - no re-run on an untouched page.
  The template shares no check that changes the page yet, so the re-run never fires in a template suite. Acceptance
  Criteria 3's in-app navigation case is TFP-214's.
- **Each page's visits are one per worker,** reloaded after a failure: on the fixture, page loads fell by more than
  half (GEN-101).

## For Emil: Gate B

The locked gate is not met: accessibility misses on both copies. Options:
1. **Keep TFP-212, 213 and 215, and move accessibility's target to Gate C,** where TFP-214 shares the two checks that
   change the page and put it back.
   - Standard and security are 36 to 50% faster with the same results.
   - Accessibility is no slower (1% and 9% faster), with the same results.
   - Recommended.
2. **As 1, and first run the axe scan last in each page's group,** so a failing scan costs no reload of the check after
   it. A small change to the pass's ordering, measured against this session's C.
   - Expected: about 15 fewer loads on clean (roughly 20 s, about 12%) and fewer on with-bugs.
   - Not enough for 30% alone.
3. **Apply the rule as locked: revert all three,** and record this result. That gives up the Standard and security
   gains.
