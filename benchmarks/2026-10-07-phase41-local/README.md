# Phase 41's Gate A evidence: presence and a local baseline (TFP-180)

Both Toolshop versions, run locally (TFP-179, `scripts/toolshop-local/`;
Testsmith's repository at `5a6ccc26`). The results are recorded in:
- the answer key's "Local presence" section
  (`benchmarks/2026-10-06-toolshop-known-bugs/answer-key.md`);
- the benchmark report's "Local baseline" section
  (`docs/decisions/known-bug-benchmark-report-2026-10-06.md`).

**Presence of the 28 target bugs (the re-score's 24 missed, 4 hinted):**
25 present, 2 not visible in Chromium (22, 23), 1 absent (54).

**Local baseline:** 9 found, 4 hinted, 24 missed, the same as the hosted
scores. Standard took 1,118 s (with-bugs) and 884 s (clean).

| File | What it is |
| --- | --- |
| `presence-probe.mts` | One read-only check per target bug in Chromium, plus GETs to the API, against the running copy |
| `presence/with-bugs.json`, `presence/clean.json` | The probe's readings: each bug, whether it shows, and what was read |
| `run-local.sh` | Crawl, select and run one local copy with TFP-175's scripts, unchanged |
| `runs/` | The crawls, selections, suites, Playwright reports and records |
| `diff-runs.mjs` | TFP-175's with-bugs-against-clean diff, also reading a development build's selectors |
| `new-failures.mjs` | Local failures that the same version's hosted TFP-175 run didn't have |

## Reproduce

From the repo root, with Docker Desktop running:
1. `.\scripts\toolshop-local\start-toolshop.ps1 -Sprint sprint5-with-bugs`
2. `node --experimental-strip-types benchmarks/2026-10-07-phase41-local/presence-probe.mts with-bugs benchmarks/2026-10-07-phase41-local/presence/with-bugs.json`
3. `bash benchmarks/2026-10-07-phase41-local/run-local.sh with-bugs`
4. Repeat steps 1 to 3 with `-Sprint sprint5` and `clean`.
5. From `runs/`: `node ../diff-runs.mjs` and `node ../new-failures.mjs`.
