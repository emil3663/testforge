# Phase 39 Gate D: one overnight session (TFP-158)

**Run on 2026-10-21 17:27:52 to 2026-10-22 06:07:18 (12 h 39 min 26 s).** The numbers are in `analysis.md`.
- **The machine:** VS Code, Docker Desktop and Claude; Ollama not running; WhatsApp (2 processes) still open at the
  start (`logs/machine-at-start.txt`), and the 6 `msedgewebview2` processes Gates B and C had.
- **Plane:** its 8 `testforge-plane-*` containers were stopped at 17:27 (`logs/plane-stopped.txt`) and started again
  at 06:07 (`logs/plane-restarted.txt`, 8 up).
- **Steps:** fixture 7 min; with-bugs start 947 s, runs 87 min; clean start 389 s, runs 78 min; the-internet setup
  1 min 44 s, runs 55 min; practicesoftwaretesting.com setup 1 min 50 s, runs 8 h 23 min (Standard alone 29,340 s,
  below). Every run reported; none failed to.
- **Against the rules** (`analysis.md`):
  - Decision 12 on the fixture: the same results with 1 and 6 workers, every suite.
  - Decision 13, Comprehensive (security + accessibility), medians of three: with-bugs W1 262 s, WN 158 s, **39.7%**
    faster against 40%; clean W1 211 s, WN 386 s, **82.9% slower**. Not met on either copy.
  - Acceptance Criteria 7: with-bugs and the-internet the same with 1 and 6 workers; **clean differs** in every
    suite. With 6 workers the clean copy's pages and API came too slowly (API GETs over 4 s, content missing at
    2 s waits, 8, 7 and 17 test timeouts in Standard's three runs; counted again from the records on 2026-10-27,
    with teardown and hook timeouts too, 8, 10 and 22, and in security 7, 10 and 9, in accessibility 17, 7 and 6:
    `../2026-10-27-gate-d-rerun/README.md`); W1, running before each WN run, stayed at its
    Gate C times, so it is load, not a copy that slowed down. The with-bugs copy, on the same stack, kept up.
  - Gate C's accessibility gap: A 215 s, WN 60 s, 72.1% faster against 30%: closed.
  - Phase 38's before and after on the local the-internet: d90de57 218 s, d202315 242 s, no timeouts, all five
    paths inspected by both.
- **The hosted capped run** (recorded): security 698 s at 2.8 requests per second, 5 timeouts; accessibility 170 s
  at 3.7 per second, none; **Standard collapsed**: 29,340 s, 466 of 484 tests timed out, 902 slots in 8 hours
  (0.03 per second). Measured afterwards: TFP-157's slot server gives a freed slot to a waiter whose connection has
  already gone, and holds it for the 60 s lease (five abandoned waiters, then the next request waited 61,007 ms
  instead of about 1 s). A test that times out, or a worker Playwright restarts after a failure, abandons its
  waiters, so Standard's early failures fed the leak until almost nothing ran. A defect of TFP-157, for Emil.
  The app's own fast-mode budget (1,800 s) would have stopped this run at 30 min anyway.

The plan is the record's (`docs/decisions/phase-39-run-concurrency-decision-record.md`, Decision 13,
Gate A target 4, "Gate D"): 1 worker against the machine's limit, interleaved in one session, three runs each, on a
quiet machine. The numbers go to `analysis.md`.

Gate D's variants differ by workers, not code (Decision 13: both sides on the code after Decisions 2 to 6), so the
runner takes a worker count per variant (`run.mts`, `VARIANTS`) and only the older code gets worktrees.

| Variant | Code | Workers | What |
| --- | --- | --- | --- |
| W1 | this repo | 1 | Decision 13's before |
| WN | this repo | the machine's limit (6 here: half of 12 cores) | Decision 13's after, as the app runs a local host |
| CAP | this repo | 3, sharing 5 requests per second (TFP-157) | the capped host, as the app runs it |
| A | `4a85f1f` | 1 | before TFP-212: Gate C's with-bugs accessibility gap (Gate C ruling 2: "Gate D's workers may close the rest") |
| P38B | `d90de57` | 1 | Phase 38's before, inspecting with its own code (TFP-150) |
| P38A | `d202315` | 1 | Phase 38's after, likewise |

W1, WN and CAP run as the app runs them: units, the read-only ones on the variant's workers, then the serial group on
one. A, P38B and P38A run their one file, as their own code did.

| Target | Variants and suites | Rounds | Judges |
| --- | --- | --- | --- |
| The comparison fixture (`127.0.0.1:4471`) | W1, WN: Standard, security, accessibility | 3 | Decision 12: every test the same result with 1 and N workers (Decision 13's second condition) |
| Toolshop with-bugs (local) | W1, WN: all three; A: accessibility | 3 | **Decision 13: Comprehensive, every area (security + accessibility), WN at least 40% faster than W1**; Gate C's accessibility gap; Acceptance Criteria 7 |
| Toolshop clean (local) | W1, WN: all three | 3 | Decision 13, as above; Acceptance Criteria 7 |
| the-internet (local, `localhost:7080`) | W1, WN: all three; P38B, P38A: Standard on `/`, `/login`, `/checkboxes`, `/dropdown`, `/tables` | 3 | recorded (Decision 13's list); Phase 38's missing before and after |
| practicesoftwaretesting.com (hosted) | CAP: all three | 1 | recorded, not judged: its time and requests per second, its timeouts on heavy pages, the timed checks Not run |

The hosted run is last, so if it runs long the judged measurements are already done.

**the-internet's local copy** (`scripts/the-internet-local/`): built straight from
`github.com/saucelabs/the-internet` at `92ce1d1` with its own Dockerfile (Apache-2.0). Docker fetches the source inside
Docker Desktop's WSL Linux VM and copies it into the image: no Windows checkout and nothing mounted from Windows, so the
register's standing rule is met without installing a WSL distribution (Emil, 2026-10-21). First build 101 s; a start
3 s. It is newer than the hosted copy (it has `/large_form`, `/two_factor`, `/users/:id`); the crawl found 100 pages
of 65 types in 76 s, and selects 8 Standard and 20 Comprehensive pages.

## Projected length

From Gate C's medians on the final code (one worker: with-bugs Standard 727 s, accessibility 151 s; clean 407 s,
101 s), Gate B's security (about 110 s), the Toolshop's measured starts (with-bugs 863 to 1,070 s, clean 381 to
391 s), and guesses where nothing is measured yet (marked).

| Step | Projected |
| --- | --- |
| Machine state, Plane stopped, worktrees | 2 min |
| The fixture (3 rounds) | 8 min (the dry run: 2 min 46 s a round) |
| Start with-bugs, crawl, inspect, generate | 20 min |
| With-bugs runs (3 rounds: W1 about 990 s, WN about 400 s (guess), A about 210 s a round) | 80 min |
| Start clean, crawl, inspect, generate | 9 min |
| Clean runs (3 rounds: W1 about 615 s, WN about 260 s (guess) a round) | 45 min |
| the-internet: start, crawl, inspect, generate (3 trees) | 2 min (the dry run: 1 min 43 s) |
| the-internet runs (3 rounds; the dry run's round about 1,300 s: W1 Standard 361 s, WN 128 s, P38B 243 s, P38A 276 s, Comprehensive W1 176 s, WN 116 s) | 65 min |
| practicesoftwaretesting.com, capped: crawl, inspect, one round | 60 to 90 min (guess; Phase 38's uncapped 1-worker Standard took 926 s on 5 pages) |
| Stop everything, remove the worktrees, restart Plane | 3 min |
| **Total** | **about 5 to 5½ hours** |

| File | What it is |
| --- | --- |
| `run-all.sh` | The session: the machine's state, Plane stopped, the worktrees, then per target crawl and select, inspect once, generate, run; then the worktrees removed and Plane restarted |
| `generate.mts` | A variant's suites, in its own tree; Standard, Comprehensive security and accessibility; Phase 38's variants with their own inspection |
| `run.mts` | The interleaved runs, each in a run folder of its own, with each variant's workers and, for CAP, TFP-157's request cap |
| `analyse.mts` | The rules: Decision 13's 40%, Decision 12's same results, Gate C's gap, Phase 38's before and after, the capped run's record |
| `lan-forward.mjs` | The dry run only: the fixture behind this machine's LAN address, a host Decision 10 caps |
| `dry/` | The dry run |

## Before the session (2026-10-21)

- **The dry run** (`DRY=1`, one round, 15:44 to 16:12, 27 min 50 s, `dry/analysis.md`): the fixture, the capped
  variant on the fixture behind this machine's LAN address, and the-internet's local copy with both Phase 38 trees.
  - Every variant generated and ran. W1 and WN gave the same results on the fixture and on the-internet, every suite.
  - CAP ran on 3 workers with the cap held (Standard: 110 slots, 50 waited), the 4 timed checks Not run with their
    reason. Its other differences from the uncapped fixture come from the stand-in being a second, plain-HTTP host,
    not from the cap: the password-over-HTTP check applies there, and the form-action injection blocks the
    stand-in's own form.
  - Phase 38's trees each inspected all five paths with their own code (at TFP-150 the hosted copy lost 2 or 3).
  - The worktrees were removed, no run folder was left, and the-internet's container was removed.
  - Its times are the harness's check, not measurements: one round, on a machine in use.
- **The unit suite on the code under test** (`e9efaa0`): 601 of 601, 0 skipped, 1,161 s. Two earlier full runs that
  day each had one failure, neither from the code under test:
  - `a969cbf`, 600 of 601: `route.inspect.test.ts`'s closed-port race (register D23);
  - `a969cbf`, 601 of 602: `host-limits.test.ts` read its run before it was saved, fixed in `e9efaa0`.

## Run

From the repo root, in Git Bash, with Docker Desktop running and a quiet machine (browsers and Ollama closed):

1. `bash benchmarks/2026-10-21-gate-d/run-all.sh 4a85f1f d90de57 d202315`. It stops Plane's `testforge-plane-*`
   containers first (`logs/plane-stopped.txt`) and starts them again at the end (`logs/plane-restarted.txt`). Docker
   Desktop is not updated.
2. `node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types benchmarks/2026-10-21-gate-d/analyse.mts > benchmarks/2026-10-21-gate-d/analysis.md`.
