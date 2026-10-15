# TFP-207: the full regression after Phase 42

Post-Phase 42 review R1 (`docs/decisions/post-phase-42-review-plan.md`). The
outcome is in `outcome.md`.

| File | What it is |
| --- | --- |
| `logs/unit1.log` to `unit3.log` | The three full unit runs, raw (`npm run test:unit`) |
| `logs/regression.log` | The regression suite, raw; `regression-attempt1-webserver-timeout.log` is the attempt whose web server didn't start in time |
| `logs/template.log` | `check:template-unchanged` against `18b47d8` |
| `logs/start-*.log`, `logs/bench-*.log` | The copies' starts and the benchmark runs |
| `logs/*.start`, `*.end`, `commit.txt` | Epoch seconds of each step, and the commit under test |
| `run-local.sh` | One copy: a crawl, Phase 40's selection, then Standard with TFP-175's driver (Gate B's script, Standard only) |
| `runs/` | Each copy's crawl, selection, page data, suite, Playwright report and records |
| `evidence.mjs`, `evidence.txt` | TFP-188's evidence script with its bug patterns unchanged, Standard only, and its output |
| `analyse.mts`, `analysis.txt` | TFP-205's link tests, the in-context gap list, and the failures against Gate B, per copy |

## Reproduce

From the repo root, in Git Bash, with Docker Desktop running:
1. `npm run test:unit`, three times; `npm run test:regression`; `npm run check:template-unchanged -- 18b47d8`.
2. `.\scripts\toolshop-local\start-toolshop.ps1 -Sprint sprint5-with-bugs`, then `bash benchmarks/2026-10-15-tfp207-regression/run-local.sh with-bugs`.
3. The same with `-Sprint sprint5` and `clean`.
4. From `runs/`: `node ../evidence.mjs > ../evidence.txt`. From the repo root: `analyse.mts` as its header says.
