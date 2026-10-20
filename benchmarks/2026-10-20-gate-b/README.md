# Phase 39 Gate B: TFP-212, TFP-213 and TFP-215 against the locked targets

The report is `docs/decisions/phase-39-gate-b-report.md`. The numbers are in `analysis.md`.

Run on 2026-10-20, 08:28 to 13:58, on a quiet machine (`logs/machine-at-start.txt`):
- browsers, PowerShell windows and Ollama closed (Emil);
- Emil's Plane stack stopped for the session, its 8 containers listed in `logs/plane-stopped.txt`, and restarted at
  14:15 (`logs/plane-restarted.txt`);
- the local Toolshop the only containers, one version at a time.

| Variant | Commit | What |
| --- | --- | --- |
| A | `4a85f1f` | Before: the commit before TFP-212 |
| B | `be94bff` | TFP-212 and TFP-213 |
| C | `2be975c` | B with TFP-215 |

| File | What it is |
| --- | --- |
| `run-all.sh` | The session: the worktrees, then per copy (with-bugs, then clean) start, crawl, inspect once, every variant generates from that one inspection, run |
| `inspect.mts`, `generate.mts`, `run.mts` | Standard's inspection once per copy; a variant's suites, generated in its own worktree; the interleaved runs |
| `runs/shared/` | Each copy's crawl, selection and inspection, given to every variant |
| `runs/<A,B,C>/` | Each variant's suites, and each run's records and raw timing |
| `run-bug46.sh`, `runs/bug46/`, `bug-46.md` | Bug 46's evidence, A against C, after the session |
| `analyse.mts`, `analysis.md` | Run times against the targets; failures and findings A against C, test by test; the score's evidence |
| `logs/` | Each step's output and times, the commits, the machine's state |

What didn't go to plan, recorded:
- **The with-bugs half's records have no `issues` (manual-review items).** `run.mts` kept none until `edc67c0`, which was
  made at 08:59, after that half had started. The clean half's records have them.
  - Bug 46, found by a manual-review item, was checked after the session from the axe scans alone (`bug-46.md`).
- **The session's wrapper was stopped at 08:59,** while trying to restart the session with the fix. The sandbox refused
  `taskkill` on its processes, and stopping the background task ended only the wrapper, so `run-all.sh` went on
  unchanged.
  - The wrapper held the Plane restart, so Plane was restarted by hand at 14:15.
  - `logs/all.end` was never written; `run-all.out`'s last line marks the end.
- **The clean half ran `run.mts` as of `d964785`:** the `issues` field and an optional `--grep`, which it didn't use.
  The records' `commit` says `25c2f60`, the commit when the session started; the suites under test are the variants'
  own.

## Reproduce

From the repo root, in Git Bash, with Docker Desktop running and a quiet machine:

1. `bash benchmarks/2026-10-20-gate-b/run-all.sh 4a85f1f be94bff 2be975c` (5 h 30 min).
2. `bash benchmarks/2026-10-20-gate-b/run-bug46.sh` (15 min).
3. `node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types benchmarks/2026-10-20-gate-b/analyse.mts > benchmarks/2026-10-20-gate-b/analysis.md`.
