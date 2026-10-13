# TFP-188: the re-score with Phase 41's checks (Gate B)

Phase 41 Decision 6, applied on the local Toolshop copies, then the hosted
sites re-scored beside their earlier scores. The scores, run times, keep-rule
outcome per check and the new labels are in
`docs/decisions/known-bug-benchmark-report-2026-10-06.md` ("Re-score with
Phase 41's checks") and the Phase 41 record's TFP-188 entry.

**Code under test:** `f3fcf9a` (`src/` unchanged since `9a9ac3b`). Both run
scripts refuse to start with uncommitted changes under `src/`, `scripts/`
or `package*.json`. Read-only gate, one worker, Chromium; TFP-154's committed
scoring rule; Phase 40's selection, unedited.

| File | What it is |
| --- | --- |
| `run-local.sh` | One local copy: crawl through the app's route, Phase 40's selection, then Standard, Comprehensive security and accessibility - TFP-180's script, writing here |
| `run-hosted.sh` | Both hosted sites, the same way - TFP-175's script, writing here |
| `runs/`, `runs-hosted/` | Each run's crawl, selection, suite, Playwright report and records |
| `evidence.mjs` | For each of the 37 scored bugs, the with-bugs items that could be its evidence, marking any the clean copy shares (TFP-154's control) |
| `evidence.txt`, `evidence-hosted.txt` | Its output, local and hosted |
| `score-local.md`, `score-hosted.md` | The verdicts, bug by bug, with the evidence each rests on |
| `keep.mjs` | For each Phase 41 check, its failures and findings on both copies, and the guard's breaches |
| `new-items.mjs` | Failures and findings new since Gate A (local) or TFP-175 (hosted), the page taken out, each to be a scored bug or labelled |

## The local copies

- **with-bugs** was started with `6897b1e`'s script (2026-10-13 02:30). Its
  composer service ran for 10.5 minutes, past that script's 600 s wait, and
  re-owned the log folder after the script had given it to php-fpm, so
  `/products` answered 500 and the start script stopped. Confirmed by hand
  (composer had exited 2 s before the check; the folder was uid 82), the
  folder was given to php-fpm's user again (`/products` 200, a fresh log
  line), and the script was fixed in `f3fcf9a` before any run.
- **clean** was started with `f3fcf9a`'s script.
- One copy at a time; the crawls match Gate A's (with-bugs 34 pages, clean 49,
  nine types each, the same Standard pages).

## Reproduce

From the repo root, in Git Bash, with Docker Desktop running:
1. `.\scripts\toolshop-local\start-toolshop.ps1 -Sprint sprint5-with-bugs`, then `bash benchmarks/2026-10-13-tfp188/run-local.sh with-bugs`.
2. The same with `-Sprint sprint5` and `clean`.
3. `bash benchmarks/2026-10-13-tfp188/run-hosted.sh`.
4. From `runs/`: `node ../evidence.mjs`, `node ../keep.mjs`, `node ../new-items.mjs with-bugs`;
   from `runs-hosted/`: the same, with `../../2026-10-07-tfp175-selection/runs` as `new-items.mjs`'s baseline.
