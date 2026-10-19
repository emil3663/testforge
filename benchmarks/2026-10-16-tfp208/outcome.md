# TFP-208: flakes, the regression web server, and a listing's cards (review R2)

Run on 2026-10-16. No Claude Code calls, gap writer off.

- **Code under test:** `4c0aca0` for `run-all.sh` (units, regression, both
  Toolshop copies; `logs/commit.txt`). `139f8df` then fixed a defect the
  third regression attempt found, in the app's run code; the unit and
  regression criteria were taken again on it with `run-tests.sh`
  (`logs/63a69e5/`). The Toolshop runs stand on `4c0aca0`: the benchmark
  driver runs Playwright itself and never goes through the code `139f8df`
  changes.
- **Steps one after another,** none loading another. An earlier start on
  `21933f7` was stopped after its first unit run found a new flake
  (`logs/aborted-21933f7-unit1.log`, fixed in `4c0aca0`).

## The commits

| Commit | What |
| --- | --- |
| `decbfad` | The two unit flakes R1 saw: each unit test's Playwright in its own folder; the beacon case split |
| `60aac09` | The regression suite builds before Playwright starts the web server |
| `21933f7` | A listing's cards: one test by position, not one per card (the ruling, below) |
| `4c0aca0` | A test that starts a run waits until it is saved (a flake found by the first unit run here) |
| `139f8df` | The app: an artifact asked for while its run is being saved waits for the save (found by regression attempt 3) |
| `d3a13c3`, `63a69e5` | The run scripts, committed before the runs |

## 1. The unit flakes

| Flake | R1 | Cause | Fix |
| --- | --- | --- | --- |
| `cookie-scope.test.ts:90` (and api-fields' earlier "no record") | 1 of 3 | Playwright walks the config's whole `testDir`, the shared `.playwright-runs`, at start-up; a folder another run removes mid-walk fails it (`ENOENT ... scandir`), and the run executes nothing. Named by the new helper on its first run. Not reproduced by 32 concurrent runs sharing `test-results`, nor 112 parallel copies of the case alone. | `decbfad`: every unit test's spec runs in its own folder under `.playwright-unit-runs/`, with the repo config and `testDir` set to it. A report with no test fails naming its exit code, errors and error output. |
| `read-only-guard.test.ts:168` (TFP-199's beacons) | 1 of 3 | Reproduced: 15 of 350 runs under 10 to 14 parallel copies noted one beacon or none. Timed in 320: Chromium failed both (`net::ERR_ABORTED`, old page torn down) within 1 ms of issuing them, before Playwright handed them to the guard's route. In all 320: passed, nothing reached the server, no beacon after the guard returned. | `decbfad`: the link case checks only that what its note names is one of the two; a second case sends both while the page stays and requires both, by type. |
| `hardening.test.ts:189` | 0 of 3 (new) | The test returned at the run's result; `run.json` was written after, into the file's cleanup (`ENOENT ... rename 'run.json.tmp'`). Same wait in 4 more places. | `4c0aca0`: `waitForSavedRun` waits for the result and the save; all five use it. |
| `comprehensive-scenarios.test.ts:85`, `performance-bands.test.ts:67`, `api-fields.test.ts:65` | 3 of 3 passed | Shared cause looked for: all three ran the CLI on the shared `testDir`, as above (api-fields' failure was the same "no record"). | `decbfad` moves them too. |
| TFP-169 (`ECONNRESET` at the fixture's control) | not seen | Not seen in R1's 3 runs or the 6 here; `3b44370`'s diagnostics stay. | Open, unchanged. |

**Three full unit runs on `4c0aca0`, in a row (`logs/4c0aca0/`):** 574/574,
574/574, 574/574; 0 skipped; 687 s, 646 s, 699 s.

**On `139f8df`, three full unit runs in a row (`logs/63a69e5/`):** 575/575,
575/575, 575/575 (one more test: RUN-37's); 0 skipped; 731 s, 659 s, 701 s.

## 2. The regression suite's web server

`60aac09`: `test:regression` builds first; `webServer` only starts. The
build's own time isn't logged separately (the logs show `Compiled
successfully in 8.9s`, the compile step only); each attempt's total is.

**On `4c0aca0`, three attempts in a row:** each server started within its
120 s and the suite ran (414 s, 403 s, 409 s). Attempts 1 and 2: 57 passed.
Attempt 3: 56 passed, 1 failed, "captures session evidence artifacts for
failed generated runs" (404 downloading the evidence): a defect in the app,
fixed in `139f8df` (RUN-37).

**On `139f8df`, three attempts in a row (`logs/63a69e5/`):** each server
started within its 120 s; 57 passed, 57 passed, 57 passed (6.4 min each;
412 s, 411 s, 410 s with the build).

## 3. The 5 hand-tools failures

- **The answer key:** no listed bug varies the listing. Both versions page a
  category with `paginate(9)` and no `ORDER BY`, so the order is
  unspecified. Measured: asked ten times in a row on a freshly seeded
  database, each copy's API returned the same 9 (`logs/window-*.log`). What
  moved R1's window between its inspection and its run isn't reproduced.
  The ruling doesn't depend on it. This run's window was another one again:
  the axe item cites `product-6` where R1's cited `product-1`.
- **The design (`21933f7`, ruling for Emil to confirm in the Phase 42
  record):** a card group (3 or more links to one address but an id) gets
  one test on its page, by position; no test per card.

## 4. Standard on both copies, one worker, R1's driver (`analysis.txt`)

| | with-bugs | R1 | clean | R1 |
| --- | --- | --- | --- | --- |
| Tests | 483 | 500 | 472 | 489 |
| Failed | 84 | 89 | 46 | 46 |
| New failures against R1 | 0 | | 0 | |
| R1's failures not failing now | the 5 hand-tools cards | | 0 | |
| Link tests (time) | 18 (31 s) | 38 (102 s) | 17 (28 s) | 37 (65 s) |
| Card tests (time) | 3, passed (5 s) | | 3, passed (5 s) | |
| Links on the gap list | 0 | 0 | 0 | 0 |
| Run | **1,306 s** | 1,535 s | **1,031 s** | 1,131 s |

- **Run time:** with-bugs 229 s faster, now 494 s under its 1,800 s
  limit (265 s at R1); clean 100 s faster. The link and card tests account
  for 66 s and 32 s of that. The rest is a run faster all round than R1's,
  which R1 found about 15% slower than Gate B's; one run per side can't
  separate it further.
- **Link counts** use R1's pattern unchanged, which misses the external-link
  title form (R1's correction: 39 and 38). Like for like.
- **Score:** `evidence.mjs` (TFP-188's, patterns unchanged, R1's copy) on
  these runs: the same 63 bug-and-check pairs as R1, so every bug's
  evidence comes from the same checks on the same pages. **30 found, 0
  hinted, 7 missed**, as R1.
- **`check:template-unchanged` against `980346f`:** 166 of 166 identical (the
  fixed inputs have no card group; no baseline change).

## Raised, not fixed

- **The app's own runs walk `.playwright-runs` too.** The executor,
  `gap-run.ts` and `stale-recheck.ts` use the repo config, and the executor
  creates and removes per-run auth folders there. Two runs at once in the app
  can hit the walk race the unit tests had. For Emil: fix with Phase 39
  (which changes how runs are laid out), or as its own ticket.
- **Stopping a background job on this machine** stops only its wrapper
  shell. The first start's driver went on and overlapped the second's
  units, which were thrown away; both were stopped by process ID.
