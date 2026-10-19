# TFP-208: flakes, the regression web server, and a listing's cards

Post-Phase 42 review R2 (`docs/decisions/post-phase-42-review-plan.md`).
The outcome is in `outcome.md`.

| File | What it is |
| --- | --- |
| `run-all.sh` | Every acceptance run, one after another: three full unit runs, three regression attempts, then both local Toolshop copies (on `4c0aca0`) |
| `run-tests.sh` | The unit and regression criteria again, on a later commit, into `logs/<commit>/` (on `139f8df`) |
| `run-local.sh` | One copy: R1's script (`benchmarks/2026-10-15-tfp207-regression/run-local.sh`), changed only in where it writes |
| `logs/4c0aca0/`, `logs/63a69e5/` | The unit runs and regression attempts on each commit (`63a69e5` is `139f8df` plus the re-run script, the same code under test), raw, with `*.start`/`*.end` in epoch seconds |
| `logs/aborted-21933f7-unit1.log` | The first start's first unit run, which found the `hardening.test.ts` flake; that start was stopped |
| `logs/window-*.log` | Page 1 of hand-tools asked of each copy's API ten times: the answer key, measured |
| `logs/start-*.log`, `logs/bench-*.log`, `logs/stop.log` | The copies' starts, the benchmark runs (on `4c0aca0`), the stop |
| `runs/` | Each copy's crawl, selection, page data, suite, Playwright report and records |
| `analyse.mts`, `analysis.txt` | Each copy against R1: tests, run time, link and card tests with their time, the gap list, failures new and gone |
| `evidence.txt` | R1's copy of TFP-188's evidence script (`../2026-10-15-tfp207-regression/evidence.mjs`), run on `runs/` |

## Reproduce

From the repo root, in Git Bash, with Docker Desktop running:

1. `bash benchmarks/2026-10-16-tfp208/run-all.sh` on `4c0aca0`, then
   `bash benchmarks/2026-10-16-tfp208/run-tests.sh` on `139f8df`.
2. `node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types benchmarks/2026-10-16-tfp208/analyse.mts > benchmarks/2026-10-16-tfp208/analysis.txt`.
3. From `runs/`: `node ../../2026-10-15-tfp207-regression/evidence.mjs > ../evidence.txt`.
