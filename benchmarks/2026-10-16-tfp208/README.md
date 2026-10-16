# TFP-208: flakes, the regression web server, and a listing's cards

Post-Phase 42 review R2 (`docs/decisions/post-phase-42-review-plan.md`).
The outcome is in `outcome.md`, written after the runs.

| File | What it is |
| --- | --- |
| `run-all.sh` | Every acceptance run, one after another: three full unit runs, three regression attempts, then both local Toolshop copies |
| `run-local.sh` | One copy: R1's script (`benchmarks/2026-10-15-tfp207-regression/run-local.sh`), changed only in where it writes |
| `logs/unit1.log` to `unit3.log`, `regression1.log` to `regression3.log` | The runs, raw |
| `logs/window-*.log` | Page 1 of hand-tools asked of each copy's API ten times: the answer key, measured |
| `logs/start-*.log`, `logs/bench-*.log`, `logs/stop.log` | The copies' starts, the benchmark runs, the stop |
| `logs/*.start`, `*.end`, `commit.txt` | Epoch seconds of each step, and the commit under test |
| `runs/` | Each copy's crawl, selection, page data, suite, Playwright report and records |

## Reproduce

From the repo root, in Git Bash, with Docker Desktop running:
`bash benchmarks/2026-10-16-tfp208/run-all.sh`.
