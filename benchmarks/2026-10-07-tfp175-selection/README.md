# TFP-175: the automatic selection, scored

Phase 40 Decision 9. TFP-154's answer key, scored with its committed rule
(`../2026-10-06-toolshop-known-bugs/scoring-rule.md`), on pages chosen by the
app. The scores, the run times, the new failures and the keep rule's outcome
are in `docs/decisions/known-bug-benchmark-report-2026-10-06.md`, section
"The automatic selection (TFP-175, 2026-10-07)".

**Outcome: kept.** 9 found, 4 hinted, 24 missed (the same as the re-score).
Standard ran in 1,232 s (with-bugs) and 1,276 s (clean).

## Files

| File | What it is |
| --- | --- |
| `crawl-and-select.mts` | Crawls a site through the app's crawl route and keeps the app's selection, unedited |
| `run-tfp175.ts` | TFP-154's run driver, changed only to run every page given (it took the first 5); refuses anything that isn't a page path |
| `run-all.sh` | Both Toolshops: crawl, then Standard, Comprehensive security and Comprehensive accessibility, one at a time |
| `diff-runs.mjs` | TFP-154's with-bugs-against-clean diff, with every product page read as `/product/:id` |
| `new-failures.mjs` | Failures whose check and cause the re-score didn't have, page taken out; each must be a scored bug or labelled |
| `runs/<site>-crawl.json`, `runs/<site>-selection.json` | The crawl (types, ranking, both selections), and the pages used |
| `runs/<site>-<run>-suite.spec.ts`, `-report.json`, `-records.json` | Each run's suite, Playwright's JSON report, and the slim records scored from |
| `runs/<site>-standard-profile.json` | Standard's page inspection |

Code under test: `7233751`. Read-only gate, one worker, Chromium.

## Reproduce

From the repo root, in Git Bash: `bash benchmarks/2026-10-07-tfp175-selection/run-all.sh`.
Then, from `runs/`: `node ../diff-runs.mjs` and `node ../new-failures.mjs`.

The runner turns off Git Bash's path rewriting (`MSYS_NO_PATHCONV=1`). A
first attempt without it turned each page argument into a Windows path,
opened local files instead of the sites, and was discarded unscored. Live
sites change: the clean catalogue had been reset within an hour of these
runs, so a re-run picks other products.
