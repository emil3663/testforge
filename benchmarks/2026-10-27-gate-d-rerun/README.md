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
