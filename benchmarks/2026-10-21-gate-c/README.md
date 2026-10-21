# Phase 39 Gate C: one overnight session

The plan is the record's ("Gate C", `docs/decisions/phase-39-run-concurrency-decision-record.md`): every variant in one
session, interleaved, three runs each, one worker, on a quiet machine. The numbers go to `analysis.md`.

| Variant | Commit | What |
| --- | --- | --- |
| A | `4a85f1f` | Before TFP-212 |
| C | `2be975c` | Gate B's code |
| C1 | `3b1210c` | With TFP-241 |
| C2 | `d3e197e` | With TFP-214 (and its axe-order switch, default order) |
| F | `7599789` | The final code: TFP-222, TFP-155, TFP-156, run as the app runs it (units, the serial group second) |
| FL | `7599789` | F with the axe scan last (TFP-214's switch, Emil 2026-10-21) |

What each comparison judges, and which runs it needs (the record's trimming rule: nothing a target doesn't need):

| Comparison | Judges | Target | Runs |
| --- | --- | --- | --- |
| C against C1 | TFP-241's cost | under 5%, or the video is dropped | with-bugs Standard |
| C1 against C2 | TFP-214 | at least 10% faster | Standard, each copy |
| A against C2 | accessibility (moved from Gate B) | at least 30% faster | accessibility, each copy |
| C2 against F | TFP-222, TFP-155, TFP-156 | the same results; no slower beyond 5% | Standard and accessibility, each copy |
| F against FL | where the axe scan runs | identical axe findings and faster, or the built order stays | accessibility, each copy |

So, per round: with-bugs Standard C, C1, C2, F and accessibility A, C2, F, FL; clean Standard C1, C2, F and
accessibility A, C2, F, FL. Comprehensive security is left out: no comparison judges it.

Projected length, from Gate B's measured medians (with-bugs Standard C 854 s, clean 513 s; accessibility 204 s and
170 s) and the targets for the variants not yet measured:

| Step | Projected |
| --- | --- |
| Start with-bugs (Gate B: 1,070 s), crawl, inspect, generate | 22 min |
| With-bugs runs (3 rounds: Standard about 3,250 s, accessibility about 630 s a round) | 3 h 15 min |
| Start clean (Gate B: 381 s), crawl, inspect, generate | 10 min |
| Clean runs (3 rounds: Standard about 1,450 s, accessibility about 550 s a round) | 1 h 40 min |
| Stop the Toolshop, remove the worktrees, restart Plane | 3 min |
| **Total** | **about 5 h 30 min** |

| File | What it is |
| --- | --- |
| `run-all.sh` | The session: the machine's state, Plane stopped, the worktrees, then per copy start, crawl, inspect once, every variant generates from that one inspection, run; then Plane restarted |
| `generate.mts`, `run.mts` | A variant's suites, generated in its own worktree (FL in F's, with the axe scan last); the interleaved runs, each in a run folder of its own, F's and FL's as units with the serial group as a second pass |
| `analyse.mts` | The comparisons against their targets, Decision 7's proof in each, and the with-bugs / sort check's message, every run |
| `sweep-hooks.mts` | Before the session: the describes TFP-156 puts in both files, and their hooks |
| `dry/` | The dry run on the comparison fixture (2026-10-21, 04:23 to 04:29): all six variants, one round |

Before the session (2026-10-21):
- **The dry run** (`DRY=1`, on the comparison fixture, one round) went end to end in 6 min:
  - every variant generated and ran: F as 12 units in 2 passes, 2 tests in its serial group;
  - `analyse.mts` wrote every comparison and the five Decision 7 sections, each with the same results;
  - the worktrees were removed and no run folder was left.
  - Its times are the harness's check, not measurements: three pages, one round, a busy machine.
- **The hook sweep** (`sweep-hooks.mts`, on `check:template-unchanged`'s 166 inputs):
  - 4 inputs have a serial group;
  - 2 describes are in both files (`Security Coverage`, in the page-data security inputs);
  - they hold no hooks.
  - Across the generator, the only hook it writes is each page group's `afterAll`, which ends the shared visit, and a
    page group never holds a serial test. A model-written block goes to the serial file whole, so its hooks are never
    in two files.
- **The unit suite on the final code** (`7599789`): 594 of 594, 0 skipped, 805 s.

## Run

From the repo root, in Git Bash, with Docker Desktop running and a quiet machine (browsers and Ollama closed):

1. `bash benchmarks/2026-10-21-gate-c/run-all.sh 4a85f1f 2be975c 3b1210c d3e197e 7599789` (about 5 h 30 min). It stops
   Plane's `testforge-plane-*` containers first (`logs/plane-stopped.txt`) and starts them again at the end
   (`logs/plane-restarted.txt`). Docker Desktop is not updated.
2. `node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types benchmarks/2026-10-21-gate-c/analyse.mts > benchmarks/2026-10-21-gate-c/analysis.md`.
