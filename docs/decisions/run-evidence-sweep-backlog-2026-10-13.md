# Backlog — Before Phase 42: the Evidence Sweep (GitHub issue #2) and the Guard's Beacons

Date: 2026-10-13
Source: https://github.com/emil3663/testforge/issues/2, filed 2026-09-23 by
hugo76 at Martin's request ("sweep deletes evidence for defects the newer run
never tested"). Read with Emil on 2026-10-13; every problem in it is still in
`src/lib/run/persistence.ts` at `e5b1add`.
Status: Approved by Emil 2026-10-13. TFP-198 and TFP-199 are built as one
batch after Phase 41's Gate B (passed 2026-10-13), before Phase 42.

## Why before Phase 42

Phase 42 builds on run history: site suites retire tests on purpose, and a
retired test looks exactly like "not run" to today's sweep. Phase 42 would
make the bug fire more often, not less.

## Decisions (Emil, 2026-10-13)

1. **Only positive evidence clears a failure.** An older run's failing test
   counts as fixed only if a test with the same title ran and passed in the
   newer run. A title that is absent, skipped or Not run keeps the older run
   exempt. The issue's option 1.
2. **Only compare like with like.** Runs are grouped by base URL plus a
   suite-identity signal (the selected practices and run type), so an
   unrelated audit never supersedes another. Phase 42's site suites supply a
   stronger identity later. The issue's option 2.
3. **Run storage assumes one TestForge process at a time,** written down
   where persistence is documented. No locks are added.

## Backlog

### TFP-198 — The sweep keeps evidence until a defect is shown fixed

- **Priority:** P0 · **Labels:** `bug`, `run`, `data-loss`
- **Scope:** Decisions 1 to 3, plus the issue's smaller findings.
- **Deliverables:**
  - `sweepAutomaticArchiving()` changed per Decisions 1 and 2;
  - the issue's drop-in failing test added unchanged as a regression case
    (it fails on today's code), plus decision-table cases: same title passed
    (clears), same title failed (still open), title absent (still open),
    title skipped or Not run (still open), different practices (never
    compared);
  - `writeRunRecord` made atomic: write a temporary file, then rename;
  - `persistRunJob`'s artifact-root check compares against the root plus a
    path separator (`artifacts-run1` never matches `artifacts-run10`), with a
    unit case;
  - the single-process assumption written down (Decision 3);
  - a `TEST_PLAN.md` case.
- **Acceptance criteria:**
  - the issue's test fails on `e5b1add`'s logic and passes after;
  - every existing sweep test still passes;
  - a run whose record write is interrupted is never left as truncated JSON
    (a unit case simulating the failure);
  - the commit references the issue (`Refs #2`); the issue is closed only
    once Emil has seen the verification.
- **Dependencies:** none. After Phase 41's Gate B, before Phase 42.
- **Done (2026-10-13), not yet verified: `15e0205`** (`Refs #2`; the issue
  is open). The issue's test fails on the previous sweep and passes; with
  the decision table, the interrupted-write case and the prefix case, the
  four new tests fail on the previous code and the ten existing ones pass on
  both. RUN-28.

### TFP-199 — The read-only guard notes site beacons instead of failing

- **Priority:** P1 · **Labels:** `bug`, `run`, `gates`
- **Problem it solves:** Phase 41 Gate B (T33). On the hosted Toolshops,
  Cloudflare's analytics beacon (`POST /cdn-cgi/rum`) fires as a page
  navigates. The guard rightly aborts it but fails the test as a breach, so
  the link check fails on the clean site too, and bug 29 is lost there. Many
  real sites send beacons (Cloudflare, Google Analytics and the like).
- **Decision (Emil, 2026-10-13):** beacons are still aborted, so nothing
  leaves the browser and the gate stays read-only, but they are reported as
  a note, not a breach:
  - requests the browser sends as beacons (`navigator.sendBeacon` and a
    link's `ping`, whatever resource type Chromium gives them; confirm which
    one Cloudflare's is first);
  - plus a short, named list of known analytics paths, for beacons sent
    with ordinary `fetch` (`/cdn-cgi/rum` first).
  Every other blocked non-safe request, and every form submission, still
  fails the test as now.
- **Acceptance criteria:**
  - a fixture page whose navigation sends a `sendBeacon` POST: the link
    check passes, the beacon is aborted and named in a note;
  - a fixture control that POSTs on click still fails as a breach;
  - the hosted link check, re-run alone on both Toolshops: bug 29 found on
    with-bugs, the clean site passes.
- **Dependencies:** none. Built with TFP-198.
- **Done (2026-10-13), not yet verified: `3a8f420`.** Measured first: one
  link followed on the hosted clean site sends two POSTs to `/cdn-cgi/rum`,
  typed `ping` and `xhr`; both are now beacons (`ping`, and the named path).
  Fixture: the beacon case passes with both named in a note; the POST
  control and form submissions still fail. **Hosted re-run on `3a8f420`**
  (`benchmarks/2026-10-13-tfp199/`): with-bugs fails naming bug 29 (`"Home"
  on /#/ leads to /contact`), 9 beacons noted; the clean site passes, 19
  beacons noted.
