# Phase 41 batch 1: the new checks on the local Toolshops (TFP-182 to TFP-185)

Each check of batch 1, run alone on both local copies (TFP-179,
`scripts/toolshop-local/`; Testsmith's repository at `5a6ccc26`), at the
read-only gate, one worker, Chromium. The full re-score with Phase 40's
selection is TFP-188's; these runs prove each ticket's acceptance criteria.

- `run-checks.ts`: generates the suite and runs only the new checks (a
  `--grep`), from a committed inspection profile or a fresh inspection.
- `slim.mjs`: reduces Playwright's JSON report to each test's title, page,
  status, message, findings and probe notes.
- `runs/`: one file per run, named by ticket and copy.

**The clean copy re-seeds its database on every start, so its ULIDs
change.** The committed clean profile
(`benchmarks/2026-10-07-phase41-local/runs/clean-standard-profile.json`)
names a product that no longer exists after a restart, so clean product
pages are inspected afresh (`-`). The with-bugs copy's ids are integers and
stable.

## TFP-182: controls

| Run | File | Result |
| --- | --- | --- |
| with-bugs, the committed profile's 8 pages | `runs/tfp182-with-bugs.json` | 6 failed, 4 passed: sort on home and category (2), the price range's maximum not sent (27), "+" doing nothing (40), the contact subject's error entries (60), "Home" leading to contact (29) |
| clean, the committed profile | `runs/tfp182-clean.json` | 9 passed; the stepper Not run (its product address no longer exists) |
| clean, a current product | `runs/tfp182-clean-product.json` | the stepper passed |

The link check's with-bugs failure also names "Contakt", whose destination
("Contact") shares no word with it: bug 31's misspelling, seen by this
check.
