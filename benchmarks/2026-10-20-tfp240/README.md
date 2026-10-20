# TFP-240: the clean copy's sort check

Phase 39 record, Backlog (added at Gate A, 2026-10-20). "sort options order
the items" failed on the clean local Toolshop's `/` in all three of TFP-211's
runs, and on `/category/hand-tools` in one, after passing at TFP-208.

## The cause (`diagnose.mts`, `diagnose-clean-home.log`)

The check chose a sort option, waited for `tfSettle`, and read the list once.
- **The race:** on the clean copy, the sort's API request starts inside
  `selectOption`, before `tfSettle` attaches its listeners (for example,
  started at 4,019 ms, `selectOption` returned at 4,023 ms). So `tfSettle`
  never counts it, and returns on 500 ms of quiet, whether or not the
  response has come. Once it returned 13 ms after the response finished.
- **What TFP-211 read:** its failure, "Drawer Tool Cabinet" (89.55) before
  "Tool Cabinet" (86.71) sorting low to high, is the top of the high-to-low
  list, the option checked just before. That is the previous order, as
  this race predicts when the API answers slowly, as it did on TFP-211's
  loaded machine.
- Not a defect in the clean copy: every read 3 s later was in order.

## The fix (`961f0d8`), and the baseline (`cf80da5`)

- **The fix:** the check reads the list until it shows the order asked for,
  for up to 5 s, then fails as before if it's still out of order.
- **Fixture:** a new `controls-sort-late` (the sorted list 1.5 s late). It
  passes on the fix and fails on the code before it, reading the previous
  order. `controls-sort-reversed` still fails, named as before.
- **Template:** `check:template-unchanged` 980346f -> 961f0d8: 162 of 166
  identical. The 4 that differ do so by the new block alone, and the
  baseline moves to `961f0d8` (`template-baseline.md`, the nightly's
  `TEMPLATE_BASELINE`).

## Stable on both copies (`run-stability.sh`, on `579b4f1`)

Standard, one worker, on 2026-10-20, 04:05 to 06:17 (7,928 s).
- **The order:** clean, then with-bugs, one version at a time.
- **On each copy:** a fresh start (reseeded), crawl and selection, then the
  suite generated once and run three times (TFP-211's `measure.mts`).
- **The machine:** in TFP-211's state (64 Chrome processes, Ollama;
  `logs/machine-at-start.txt`), the load the race showed under.

| Copy | Run | Time | Passed / failed / not run | Sort check on `/` | Sort check on hand-tools |
| --- | --- | --- | --- | --- | --- |
| clean | 1 | 1,034 s | 408 / 46 / 18 | Passed | Passed |
| clean | 2 | 1,003 s | 408 / 46 / 18 | Passed | Passed |
| clean | 3 | 1,014 s | 408 / 46 / 18 | Passed | Passed |
| with-bugs | 1 | 1,407 s | 379 / 84 / 20 | Failed | Failed |
| with-bugs | 2 | 1,536 s | 379 / 84 / 20 | Failed | Failed |
| with-bugs | 3 | 1,511 s | 379 / 84 / 20 | Failed | Failed |

- **The same result in every run, on both copies.** Each copy's failures
  are the same tests in all three runs, counted test by test, with product
  IDs set aside since the clean copy reseeds them.
- **clean** passes the sort check everywhere. Against TFP-211's run 1, its
  failures are the same 46, less "sort options order the items on /".
- **with-bugs** fails it on both pages in every run, as at TFP-211:
  `sorting by "Name (A - Z)" on /#/ puts "Wood Saw" before "Thor Hammer"`.
  The with-bugs name sort is wrong, so a real sort bug still fails. Its 84
  failures are TFP-211's, test by test.
