# TFP-211: where the run time goes

Phase 39 Decision 1 (`docs/decisions/phase-39-run-concurrency-decision-record.md`).
The report is `docs/decisions/phase-39-tfp211-measurement-report.md`.

| File | What it is |
| --- | --- |
| `run-all.sh` | Every run, one after another: the fixture, then the local Toolshop with-bugs, then clean |
| `measure.mts` | One site: Standard and Comprehensive security and accessibility, generated once, run three times each, interleaved, with the timing reporter |
| `analyse.mts`, `analysis.md` | Every run summarized again from its raw timing at `afa8d4f`, with each number's spread |
| `runs/<label>-selection.json`, `-crawl.json` | The crawl and Phase 40's selection |
| `runs/<label>-<kind>-suite.spec.ts`, `<label>-standard-profile.json` | The suites, and Standard's inspection |
| `runs/<label>-<kind>-run<n>-records.json` | Each test's status and message, and the run's time |
| `runs/<label>-<kind>-run<n>-timing.json` | The timing reporter's raw record (`src/lib/run/timing.ts`) |
| `logs/` | Each step's output, start and end in epoch seconds, the commit, and the machine at the start |

The `-summary.json` files `measure.mts` wrote were removed. They came from
`160606e`'s summary, which named the link checks' targets from Playwright's
step names; on with-bugs those collapse hash routes to `/` (fixed in
`afa8d4f`). `analyse.mts` recomputes every summary from the raw timing.

## Reproduce

From the repo root, in Git Bash, with Docker Desktop running:

1. `bash benchmarks/2026-10-19-tfp211/run-all.sh` (3 h 38 min on 2026-10-19).
2. `node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types benchmarks/2026-10-19-tfp211/analyse.mts > benchmarks/2026-10-19-tfp211/analysis.md`.
