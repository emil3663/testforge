# Phase 39 Gate D's re-measurement (Gate D ruling 4)

Gate D's ruling (2026-10-26, `docs/decisions/phase-39-run-concurrency-decision-record.md`):
- **4.** One overnight session, after rulings 1 to 3 (TFP-157's leak fix `66cd0c0`; Decision 13 left open; D26, the
  Toolshop copies in WSL, `eed5cac`), re-runs Gate D's Toolshop part (W1 against WN, both copies, Comprehensive and
  Standard) and the capped hosted practicesoftwaretesting.com run. If clean still overloads or gives different results
  with 6 workers, a lower local-host limit (for example 3) is measured in the same session as a further variant.
- **5.** The capped run's time budget is decided on that re-measured number.

## What runs

| Target | Variants and suites | Rounds | Judges |
| --- | --- | --- | --- |
| The comparison fixture (`127.0.0.1:4471`) | W1, WN: Standard, security, accessibility | 3 | Decision 13's condition (Decision 12): every test the same result with 1 and N workers, on this code |
| Toolshop with-bugs (local, WSL) | W1, WN, W3: all three | 3 | **Decision 13: Comprehensive (security + accessibility), WN at least 40% faster than W1**; Acceptance Criteria 7 |
| Toolshop clean (local, WSL) | W1, WN, W3: all three | 3 | as above |
| practicesoftwaretesting.com (hosted) | CAP: all three | 1 | recorded: its time, requests per second and timeouts, with TFP-157's leak fix in: ruling 5's number |

| Variant | Workers | What |
| --- | --- | --- |
| W1 | 1 | Decision 13's before |
| WN | the machine's limit (6: half of 12 cores) | Decision 13's after, as the app runs a local host |
| W3 | 3 | ruling 4's lower local-host limit (run when `W3=1`) |
| CAP | 3, sharing 5 requests per second | the capped host, as the app runs it |

As at Gate D: one Docker site at a time; the variants on this code run as the app runs them (units, then the serial
group on one worker); each pass is the executor's Playwright call. Unlike Gate D:
- **The fixture is re-run,** although the ruling names only the Toolshop part: Decision 13's verdict needs the
  fixture's same results, and this measures them on the same code (about 8 minutes).
- **Each Toolshop copy is crawled, inspected and generated on its own start** (`run-all.sh`): the clean copy reseeds
  its product ids on every start (D26), so a suite holds only for the start it was crawled on.
- **No A, P38B or P38A, and no the-internet:** Gate D closed those.
- **The runner** is Gate D's `run.mts` with W3 added; `analyse.mts` is Gate D's with W3 and Gate D's numbers beside
  each. Run on Gate D's own runs, it gives Gate D's verdicts (39.7%; clean 82.9% slower; Standard 734 to 365 s).

## The dry run (2026-10-27)

`DRY=1 W3=1`, one round, 04:53:10 to 05:59:44 (66 min 34 s), on a machine in use (Plane running, VS Code, Claude);
`dry/analysis.md`, `dry-run-all.out`. Every step exited 0, no run folder was left, the Toolshop was stopped at the end.

| Copy | Suite | W1 | WN (6) | W3 |
| --- | --- | --- | --- | --- |
| fixture | Standard / security / accessibility | 85 / 13 / 7 s | 35 / 10 / 5 s | - |
| with-bugs | Standard | 688 s | 383 s | 280 s |
| with-bugs | Comprehensive (security + accessibility) | 232 s | 144 s (37.9% faster) | 142 s (38.8%) |
| clean | Standard | 323 s | 432 s, 7 more failures, 6 timeouts | 180 s |
| clean | Comprehensive | 164 s | 366 s, 9 more security failures, 15 timeouts | 146 s (11.0%) |

- **Clean still overloads with 6 workers,** in WSL as on Windows: slower than W1 in every suite, with failures W1
  doesn't have (Standard: link health, keyboard, viewport, LCP, the API-failure injection, cookies; security: 9 tests
  whose context teardown or `afterAll` hook ran past 30 s) and 21 timeouts in all. **So the session runs W3 (`W3=1`), as
  ruling 4 provides.** W3 gave W1's results test by test on all three clean suites, with no timeouts.
- **Timeouts are counted by `analyse.mts`,** from the records: `run.mts` counts a test's, an action's or a
  navigation's running out of time, not a fixture teardown's or a hook's, so it counted 6 of the dry run's 21. Gate D's
  clean WN was undercounted the same way: counted again, Standard had 8, 10 and 22 (its record says 8, 7 and 17) and
  security 7, 10 and 9 (recorded as none), accessibility 17, 7 and 6 (`run.mts`: 5, 0 and 3). W1, with-bugs and the
  fixture had none either way.
- **with-bugs:** failures the same with 1, 3 and 6 workers in every suite. Standard "differs" in findings only, all of
  them items that vary per load (bug 4's card titles, which with-bugs misaligns at random; how many routes the link
  check reaches in its 14 s). With one round the analysis can't mark tests that vary between runs of one variant (it
  needs two); with three it does, as at Gate D, where with-bugs came out the same.
- **The fixture:** the same results with 1 and 6 workers in every suite (Decision 13's condition).
- **CAP on the fixture** (through this machine's LAN address): the cap held (Standard 110 slots, 54 waited, 2.5 per
  second), the 4 timed checks Not run, no timeouts; Gate D's dry run had 110 slots and 50 waits.
- **Its times are the harness's check, not measurements:** one round, on a machine in use.

## The session (2026-10-27)

`W3=1`, three rounds, 16:54:16 to 20:31:47 (3 h 37 min; projected 4 to 5 h), on `abc227c`. Every step exited 0
(`run-all.out`). `analysis.md` is step 2's output. The numbers below come from it, and from the records'
`startedAt` and the timing files where noted. Times are local (SAST, UTC+2).

### Against Gate D's ruling: medians of three

| Rule | W1 | WN (6) | W3 | Result | Gate D |
| --- | --- | --- | --- | --- | --- |
| Decision 12, fixture: same results, W1 against WN | Std 74, sec 10, acc 6 s | 33, 7, 4 s | - | **same, all three suites** | same |
| Decision 13, with-bugs: Comprehensive (sec + acc) | 217 s (234, 213, 217) | 123 s (147, 123, 122) | 124 s (139, 124, 119) | WN **43.3% faster: met**; W3 42.9% | 39.7%, not met |
| Decision 13, clean: Comprehensive | 158 s (158, 158, 161) | 367 s (367, 349, 418) | 156 s (131, 172, 156) | WN **132.3% slower: not met**; W3 1.3% | 82.9% slower |
| Acceptance Criteria 7, with-bugs | | same in all three | same in all three | met | same |
| Acceptance Criteria 7, clean | | Std and sec differ (1 steady test each), acc same | same in all three | WN not met; W3 met | differs in all three |
| Standard, recorded | with-bugs 651, clean 337 s | 311 (52.2%), 342 s (1.5% slower) | 297 (54.4%), 180 s (46.6%) | | 734/365; 403/519 |

**with-bugs now meets Decision 13** (Gate D: 39.7%). Clean still overloads with 6 workers, as the dry run showed.
With 3 workers clean gives W1's results test by test but is not faster in Comprehensive (1.3%).

### Timeouts: from the records, teardown and `afterAll` included (`run.mts`'s count in brackets)

Only clean WN and the capped run have any. Every W1 and W3 pass, all of with-bugs and the fixture: 0.

| Clean WN | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| Standard | 1 (0) | 11 (5) | 3 (0) |
| security | 7 (0) | 10 (0) | 9 (0) |
| accessibility | 6 (6) | 5 (5) | 7 (7) |

### Clean round 2

- **Overlapped by the monitor's repo scan** (a repo-wide `find -newermt`, 19:13:08 to 19:15:36, `leftover-monitors.txt`):
  - **WN Standard round 2** (19:02:27 to 19:15:07, 760 s): its last 120 s.
  - **W3 Standard round 2** (19:15:07 to 19:19:43, 276 s): its first 28 s.
  - No other pass overlaps it.
- **Leftover monitor loops during each clean pass:** the same for every clean pass, 18:31:31 to 19:56:08:
  - 15 `tail -F | grep` pipelines from Gate D's own session (2026-10-21/22). Together they used about 6% of one core.
  - 1 of today's `watch.sh` loops (it reads `runs/` and `run-all.out` every 10 s). There were 0 for up to 7 s while
    the Monitor was re-armed at 18:56:23 (in W3 accessibility round 1) and 19:26:33 (in W1 accessibility round 2).
  - Today's 4 orphaned loops were killed at 18:29:34, before clean began. During with-bugs, 1 to 5 of today's loops
    ran: round 1 had 1 to 2, round 2 had 2 to 4, round 3 had 4 to 5. with-bugs WN Standard was 305, 311 and 317 s.
- **So the leftovers don't explain round 2:** every round of clean had the same 16 loops.
- **The scan explains little of it either:**
  - Remove all 120 s of overlap and WN Standard round 2 is still 640 s, against 342 and 276 s.
  - The pass was slow before the scan began. It had 6 timeouts in its first minute (each 60 s; round 3 had 3 of
    about 40 s), and from 19:07:32 to 19:10:32 it started 53 tests. The 2 minutes the scan overlapped were its fastest
    (43 tests at a mean of 1.3 s).
  - Its median passed test took 0.43 s, against 0.15 and 0.12 s.
- **The slowdown spans the whole round:**
  - W3 Standard round 2 took 276 s against 180 and 160 s (median test 0.15 against 0.08 and 0.07 s), with 28 s of
    overlap.
  - W3 security round 2 took 106 s against 71 and 70 s, at 19:23:28 to 19:25:14, with no overlap at all.
  - W1 round 2 was unaffected (339, 77 and 81 s).
  - So something slowed the multi-worker passes from about 19:02 to 19:25. **The records don't say what.**
- **Decision 13, clean, with and without round 2** (without it, the median of two is their mean):

  | | W1 | WN | WN against W1 | W3 | W3 against W1 |
  | --- | --- | --- | --- | --- | --- |
  | All three rounds | 158 s | 367 s | 132.3% slower, **not met** | 156 s | 1.3% faster |
  | Without round 2 | 159.5 s | 392.5 s | 146.1% slower, **not met** | 143.5 s | 10.0% faster |

  **It does not flip.** Round 2's WN Comprehensive (349 s) was its fastest, so dropping it makes WN look worse. No
  re-run of the cell is needed for Decision 13. Without round 2, clean Standard (recorded) is WN 7.6% and W3 49.2%
  faster, against 1.5% slower and 46.6% faster with it.

### Session noise

- **Edge:** `machine-at-start.txt` and `machine-at-end.txt` both show 7 `msedge` processes (plus 6
  `msedgewebview2`), so they ran the whole session. The snapshot records counts only; about 350 MB is the owner's
  figure. Edge's Startup boost and background apps are now off.
- **Leftover pipelines:** the same snapshots show `grep 15` and `tail 15`, the pipelines from Gate D's session. They
  were in the record from the start, and nothing flagged them. `run-all.sh`'s machine-state step now warns about both.
- Gate D's own session ran with these pipelines building up from 1 to 14 over its night.

### The capped hosted site (practicesoftwaretesting.com, 3 workers sharing 5 requests per second)

| Suite | Time | Tests | Timeouts | Slots | Waited (total, mean) | Requests per second | Gate D |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Standard | 1369 s (22 m 49 s) | 486: 303 passed, 153 failed, 30 not run (4 timed checks not judged) | 28 | 5731 | 5656 (16,065 s, 2.84 s) | 4.19 | 29,340 s; 466 of 484 timed out; 902 slots; mean wait 954 s; 0.03 per s |
| security | 478 s | 122: 87 passed, 35 failed | 1 | 2055 | 1787 (3810 s, 2.13 s) | 4.30 | 698 s, 5 timeouts, 2.80 per s |
| accessibility | 140 s | 80: 24 passed, 18 failed, 38 not run | 0 | 670 | 662 (1895 s, 2.86 s) | 4.79 | 170 s, 0, 3.67 per s |

- **TFP-157's leak fix holds:**
  - The rate stayed under the cap (4.19 to 4.79 per second against 5).
  - The mean wait was about 2 to 3 s, against Gate D's 954 s.
  - Throughput did not decay. Standard's timeouts per 2 minutes were 4, 2, 2, 2, 4, 7, 2, 2, 2, 0, 0, 0, and its
    last 6 minutes started 155 tests with none. Gate D's timed out 126 of the 140 tests it started in its first 30 minutes, and 340 of the 344 after.
- **Standard's 28 timeouts are per-test budget, not the leak:**
  - 8 link-health and 8 keyboard-navigation checks, which need more requests than 30 s allows at a shared 5 per
    second.
  - 4 sort or navigation checks, 3 form checks, and 5 single-page checks.
- **Ruling 5's number:** the three suites took 1987 s (33 min), plus crawl, inspect and generate (2 min 20 s).

### Plane

`docker ps` at 20:51:45: all 8 `testforge-plane-*` containers up 20 minutes. Only 3 define a health check (`space`,
`db`, `web`), and all 3 report healthy. The other 5 (`api`, `worker`, `beat-worker`, `redis`, `minio`) show only
"Up", as they did before the session.

## Projected length

From the dry run's round (fixture 2 min; with-bugs W1 920 s, WN 527 s, W3 422 s; clean W1 487 s, WN 798 s, W3 326 s),
the measured starts (38 to 83 s) and crawls (about 1 to 2 minutes a copy), and Gate D's capped run where nothing newer
exists (security 698 s, accessibility 170 s).

| Step | Projected |
| --- | --- |
| Machine state, Plane stopped | 1 min |
| The fixture (3 rounds) | 7 min |
| with-bugs: start, crawl, inspect, generate; 3 rounds of W1, WN, W3 | 95 min |
| clean: the same | 83 min |
| practicesoftwaretesting.com, capped: crawl, inspect, one round | 60 to 120 min (a guess: Gate D's security and accessibility took 14.5 min; its Standard collapsed, so there is no Standard number with the leak fixed) |
| Stop the Toolshop, restart Plane | 2 min |
| **Total** | **about 4 to 5 hours** |

## Run

From the repo root, in Git Bash, with Docker Desktop running (Ubuntu under WSL, its integration on) and a quiet
machine (browsers and Ollama closed):

1. `W3=1 bash benchmarks/2026-10-27-gate-d-rerun/run-all.sh`. It stops Plane's `testforge-plane-*` containers first
   (`logs/plane-stopped.txt`) and starts them again at the end (`logs/plane-restarted.txt`). Docker Desktop is not
   updated.
2. `node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types benchmarks/2026-10-27-gate-d-rerun/analyse.mts > benchmarks/2026-10-27-gate-d-rerun/analysis.md`.

| File | What |
| --- | --- |
| `run-all.sh` | The session: the machine's state, Plane stopped, then per target crawl, inspect, generate and run; Plane restarted |
| `run.mts` | The interleaved runs (Gate D's, with W3) |
| `analyse.mts` | The rules, beside Gate D's numbers |
| `dry/` | The dry run |
