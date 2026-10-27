# Ruling 4's capped experiment (Gate D's re-measurement ruling 4, 2026-10-27)

The ruling (`docs/decisions/phase-39-run-concurrency-decision-record.md`, "Re-measurement ruling"): the mean slot wait on
the hosted site (2.84 s) is longer than a shared check's 2 s assertion wait (TFP-215), so the cap itself may fail tests
that would pass uncapped. One last measurement decides ruling 5, with its outcome set in advance:
- **The experiment:** local with-bugs reached through the machine's LAN address, so it gets the capped row, against W1
  uncapped on loopback; Standard, security and accessibility; three rounds; on the new limit's code; a quiet night.
- **Same results** (beyond the tests known to vary, Decision 7): a 60-minute capped budget, and a capped timeout is
  reported Not run, "needs more requests than the request cap allows in its time".
- **Different:** on a capped host, the shared assertion wait and the test timeout are lengthened by the mean slot wait
  measured in that run, re-checked once in the same session; any test still different is reported Not run under the
  request cap. The budget is 60 minutes.

**Status: prepared and dry-run; the three-round session is on hold for the owner's ruling (2026-10-28, 00:15).** The dry
run raised the design questions below.

## What runs

| Variant | Site | Workers | Cap |
| --- | --- | --- | --- |
| W1 | `http://localhost:4200` (loopback: the local row) | 1 | none |
| CAP | `http://<LAN address>:4200` (the capped row; port 4200 listens on 0.0.0.0, so no forwarder) | 3 (the capped row's) | 5 requests per second, TFP-157's slot server |

- **One crawl, inspection and generation, on loopback.** CAP runs the same suites with the page origin rewritten to the
  LAN address, nothing else (`logs/rewrite.txt`; checked: CAP's Standard suite mapped back is byte-identical to W1's).
- **What the cap counts:** the app calls its API at `http://localhost:8091` whatever host its pages come from (checked
  in a real browser: through the LAN address the app draws its 27 product cards and the API answers; Chromium blocks
  nothing). Counting only the LAN address, as the app would, leaves the API uncapped, where on the hosted site the API
  is under the site's domain and capped. So `run.mts` counts every request (`CAP_DOMAIN=""`), which also counts the
  page's two `cdnjs.cloudflare.com` requests: slightly more than the hosted site counts, not less.
- Interleaved per round: W1 then CAP, Standard, security, accessibility (`run.mts`). The passes are the
  re-measurement's (units, then the serial group on one worker; Playwright `--timeout=30000`).

## The dry run (2026-10-27 22:05:31 to 2026-10-28 00:11:56, 2 h 06 min)

`DRY=1`, one round, on `57bcc76`, on a machine in use (Plane running, VS Code, Claude); `dry/analysis.md`,
`dry-run-all.out`. Every step exited 0; the Toolshop was stopped at the end. Its times are the harness's check, not
measurements.

| Suite | W1 | CAP | Failed, W1 / CAP | CAP timeouts | CAP slots | Mean slot wait | Slots per second |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Standard | 618 s | 4322 s | 84 / 348 | 334 | 22,273 | 6.15 s | 5.15 |
| security | 82 s | 1401 s | 3 / 108 | 105 | 7,431 | 6.22 s | 5.30 |
| accessibility | 120 s | 932 s | 41 / 76 | 73 | 4,928 | 6.25 s | 5.29 |

- W1's failures match the re-measurement's (84, 3, 41, every round).
- **Differs in every suite,** by hundreds of tests; with one round no test can be marked as varying, but the gap is far
  beyond what Gate D found varying on with-bugs (5 tests in Standard, none elsewhere). Three rounds can't make them the
  same: ruling 4's "different" branch applies either way.
- **The local copy is heavier to cap than the hosted site:**
  - Per test, CAP took about 46 slots (22,273 for 483 Standard tests). The hosted capped run took about 12 (5,731
    for 486).
  - One home-page load, counting what each run's cap counts: local 73 requests (66 to the page origin, 5 to the API,
    2 to cdnjs), hosted 44 (38 to the site, 6 to `api.`; 1 to `static.cloudflareinsights.com` not counted). That is
    1.66 times as many.
  - The local copy is a Vite development server (`/@vite/client`, unbundled scripts). That the rest of the gap is
    development-build modules re-requested on each navigation, where hosted assets are cached, is a guess, not
    measured.
  - So the mean slot wait here (6.18 s over every CAP pass) is more than twice the hosted 2.84 s, and lengthening
    waits by it would overshoot the hosted case.
- **Slots per second above the cap:** 5.15 to 5.30 over each CAP pass, against 5 (hosted: 4.19 to 4.79). Either more
  than 5 requests reached the server in some seconds, or slots were counted for requests that never reached it (for
  example, aborted when a page closed). Not checked: this run doesn't record arrivals at the server.
- **Projected length of the three-round session:** 6 h 17 min (three rounds of 7,475 s; start, crawl, inspect and
  generate 1.5 min; Plane about 1 min).
- The noise check flagged 3 processes at the start: the dry run's own watch (`watch-run.sh` and its two wrapper
  shells), as designed. Each 30-minute Monitor expiry left its `watch-run.sh` running; each was killed by PID before
  re-arming (2288, 9112, 47020, 18920).

## Run

From the repo root, in Git Bash, with Docker Desktop running and a quiet machine:

1. `bash benchmarks/2026-10-27-ruling-4-capped/run-all.sh` (`DRY=1` for the dry run; `CAP_DOMAIN=<host>` to count
   only that host).
2. `node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types benchmarks/2026-10-27-ruling-4-capped/analyse.mts > benchmarks/2026-10-27-ruling-4-capped/analysis.md`.

| File | What |
| --- | --- |
| `run-all.sh` | The session: machine state (with the noise warning), Plane stopped, with-bugs started, crawled, inspected and generated on loopback, CAP's suites rewritten, the runs, the Toolshop stopped, Plane restarted |
| `run.mts` | The interleaved runs, W1 on loopback and CAP on the LAN address |
| `analyse.mts` | Same results test by test (Gate B's method; the timed checks Not run under the cap listed apart), times, timeouts, slots and the mean slot wait, and the pre-set outcome |
| `dry/` | The dry run |
