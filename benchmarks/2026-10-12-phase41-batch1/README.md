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

## TFP-183: tab order and grouping

| Run | File | Result |
| --- | --- | --- |
| with-bugs, Standard, the committed profile's 8 pages | `runs/tfp183-with-bugs-standard.json` | register fails tab order (53); home fails grouping (94); category fails grouping (R19); contact and login fail tab order (R20) |
| with-bugs, Comprehensive, 8 pages | `runs/tfp183-with-bugs-comprehensive.json` | the same outcomes as Standard, page for page |
| clean, Comprehensive, 8 pages | `runs/tfp183-clean-comprehensive.json` | tab order passes on every form; grouping passes on home and fails on category (R19) |

R19 and R20 are labelled in `docs/decisions/data/labelled-failures.md`: both
real, R19 shared by both versions, R20 with-bugs only and outside the
answer key.

## TFP-184: known paths and guessable ids

| Run | File | Result |
| --- | --- | --- |
| with-bugs, Comprehensive security, 8 pages | `runs/tfp184-185-with-bugs.json` | the probe fails on `http://localhost:8091/logs/laravel.log` (80); `/#/product/:id` ids recorded on home, category and product (82); also TFP-185's findings (75) |
| clean, Comprehensive security, 8 pages | `runs/tfp184-clean.json` | the probe passes on `http://localhost:4200` and `http://localhost:8091`; no id finding |

The with-bugs run was made with the probe judging "not a page" by the body:
the first run, which also trusted the `text/html` content type, missed the
log, which the Toolshop sends as `text/html`.

## TFP-185: undisplayed internal API fields

| Run | File | Result |
| --- | --- | --- |
| with-bugs, Comprehensive security, 8 pages (TFP-184's checks too, final code) | `runs/tfp184-185-with-bugs-final.json` | `stock` recorded on home, category and product (75); and TFP-184's 80 and 82 again |
| clean, Comprehensive security, 8 pages | `runs/tfp185-clean.json` | no finding |

`runs/tfp184-185-with-bugs.json` is the earlier with-bugs run, from before
TFP-184 read the site's origin from the loaded page; the final run repeats
it on the committed code.
