# TFP-197: the gap writer measured (Phase 42 Gate B)

Phase 42 Decision 7 on the local Toolshop copies, with real Claude Code calls.
The plan was approved by Emil on 2026-10-15:
- Standard only;
- one data folder, fresh and outside the repo, shared by both copies, clean first;
- Phase 40's selection, unedited;
- gap limit 50, not the default 5. At 5, a re-run of an unchanged site asks for the next 5 of the clean copy's 36 gaps. The dry run on the comparison fixture showed it: the second run reused all 80 tests, generated none, and still asked for 5 more of 13 gaps.

| Run | Copy | What it shows |
| --- | --- | --- |
| 1 `run1-clean` | clean | gap tests written for every gap on the Standard pages, each run and saved; the run has no unlabelled failure |
| 2 `run2-clean` | clean, unchanged | everything reused, nothing generated, 0 Claude Code calls |
| 3 `run3-with-bugs` | with-bugs, same data folder | the saved suite reused where page types hold, new gaps written for new types, pool candidates bound where they pass |
| 4 `run4-with-bugs` | with-bugs, unchanged | the reuse check again |

**Code under test:** the commit in each `runs/*-records.json` (`commit`).
`run-local.sh` refuses to start with uncommitted changes under `src/`,
`scripts/` or `package*.json`. Every run uses the read-only gate, one
worker and Chromium, with TFP-202's run environment.

| File | What it is |
| --- | --- |
| `run-local.sh` | One run of one copy: on a copy's first run, the crawl and Phase 40's selection (TFP-175's `crawl-and-select.mts`); then `run.mts` |
| `run.mts` | Generation through `POST /api/generate` (site suite, candidates, promoted entries, the gap writer opted in for `http://localhost:4200`), then the suite run as TFP-175's driver runs it |
| `claude-logger.mjs` | A pass-through in front of `claude.exe`: TestForge's call path is unchanged, and each call's arguments, prompt, reply, cost and time are kept (`runs/*-claude-calls.jsonl`) |
| `runs/` | Each run's selection, suite, the route's answer, Playwright's report, the records, the Claude Code calls, and the data folder's site suite and candidate pool as they stood after it. `run1a-*` and `run3a-*` are the first attempts, each cut short by a bug the run found (`outcome.md`) |
| `analyse.mjs`, `analysis.txt` | The measures Emil asked for, read from `runs/`, and their output |
| `outcome.md` | The score, the acceptance criteria, the second measure, the hints, cost and time, what the runs found, and Gate B by Decision 7 |

## As run

Run 1 was redone, after `394a096`, in a fresh data folder. Run 3 was
redone after `31c0afd`, in a fresh data folder seeded with run 2's
candidate pool byte for byte and no site suite (Emil, 2026-10-15). The
with-bugs copy then counts as a first run; run 3a measured what became of
clean's site suite. Code under test (each record's `commit`): run 1a on
`ae88e0b`; runs 1, 2 and 3a on `394a096`; runs 3 and 4 on `31c0afd`.

## Reproduce

From the repo root, in Git Bash, with Docker Desktop running and a fresh,
empty `TESTFORGE_DATA_DIR` outside the repo:

1. `.\scripts\toolshop-local\start-toolshop.ps1 -Sprint sprint5`, then:
   - `bash benchmarks/2026-10-15-tfp197-gap-writer/run-local.sh clean run1-clean`
   - `bash benchmarks/2026-10-15-tfp197-gap-writer/run-local.sh clean run2-clean`
2. `.\scripts\toolshop-local\start-toolshop.ps1 -Sprint sprint5-with-bugs`, then the same with `with-bugs run3-with-bugs` and `with-bugs run4-with-bugs`.
