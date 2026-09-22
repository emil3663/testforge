# Phase 24 — Reliability Audit Findings Backlog

**Version:** 1.0
**Date:** 2026-09-22
**Status:** Approved and in implementation (TFP-065/066 only; TFP-067–070 are roadmapped, not locked for this pass)

## Context

An independent agent audit of TestForge's API/persistence layer, run while
this project was paused, surfaced ten findings. Cowork independently
re-verified every one against the actual repository (not trusted at face
value — two 🔴 findings looked structurally real, and one part of the
audit, the Plane/Docker Compose test-target architecture, looked
suspicious on first read since nothing in this repo's prior docs had
mentioned it; it checked out as real, `docker-compose.yml` genuinely
stands up Plane as a local test target). Every finding below was confirmed
against real line numbers, real code paths, or real config — none of this
backlog is taken on the audit's word alone.

Emil's call: fix the two 🔴 critical findings now (real defects — a
silent-hang failure mode and a path-traversal gap — not feature work to
sequence behind Phase 17). Everything else goes on the roadmap rather than
being fixed in this pass, so it isn't lost and isn't rushed either.

## Decisions

1. TFP-065 and TFP-066 are fixed now, ahead of Phase 17 Group 2 — real
   defects take priority over new feature work already in flight.
2. TFP-067 through TFP-070 are recorded as roadmapped backlog (Sprint 3
   below), not built in this pass.
3. Both TFP-065 and TFP-066 ship with real automated test coverage as part
   of the same commit, not verified once by hand and left uncovered — the
   same gap Phase 17 Group 1 shipped with and had to close in a follow-up
   (`fb905c2`) applies here too, and isn't worth repeating a third time.

## Backlog

### TFP-065 - Guard `JSON.parse` in `finalizeRunJob` against a corrupted Playwright report

- **Phase:** 24
- **Priority:** P0
- **Suggested labels:** `bug`, `reliability`
- **Problem it solves:** `src/lib/run/jobs.ts:126` parses Playwright's JSON
  report with no try/catch, while the `readFile` immediately above it *is*
  wrapped in `.catch(() => "")` — a real asymmetry. Because
  `finalizeRunJob` runs fire-and-forget (`void finalizeRunJob(job)` in
  `executor.ts`), a thrown parse error is an unhandled rejection that's
  silently swallowed: `job.result` never gets set, `job.status` stays
  `"running"` forever, and `useRun`'s 800ms poll (which only stops on
  `snapshot.result`) polls indefinitely. The run looks permanently "in
  progress" in the UI with no way to recover short of restarting the dev
  server.
- **Scope:**
  - Wrap the `JSON.parse(reportText)` call in a try/catch. On failure,
    treat it the same as a missing report (`parsedReport = null`), push a
    warning into `job.outputChunks` so the cause is visible in the run's
    raw output, and let the existing "no report" finalize path run so
    `job.result` and `job.status` are always set.
  - Add a regression test that feeds `finalizeRunJob` a corrupted JSON
    report file and asserts the job reaches a terminal status with a
    result, not that it merely "doesn't throw."
- **Deliverables:**
  - Fixed `src/lib/run/jobs.ts`.
  - A test (Playwright regression or `node:test`, whichever actually
    exercises `finalizeRunJob` — match the existing pattern for that file)
    proving a corrupted report can't hang a run.
- **Acceptance criteria:**
  - A corrupted `job.jsonReportFile` results in `job.result` being set and
    `job.status` reaching a terminal value (not `"running"` forever) —
    proven by a real test run, not by reading the diff.
  - The existing regression suite and `test:unit` both still pass.
- **Dependencies:** None.

### TFP-066 - Validate `runId` before any file-path operation

- **Phase:** 24
- **Priority:** P0
- **Suggested labels:** `bug`, `security`
- **Problem it solves:** `GET /api/run`'s `runId` comes straight from a
  query param with only a truthiness check, then flows into
  `loadRunRecord`/`markRunAccessed`/`runEvidenceDir` (`persistence.ts`),
  which build paths via `join(RUNS_ROOT, runId, ...)` — `path.join`
  resolves `../` segments, so an unvalidated `runId` is a real (if
  locally-scoped, per TestForge's own local-only threat model)
  path-traversal surface. `PATCH /api/runs` (pin/archive) has the same
  gap, and `archiveRun`'s `rm(runEvidenceDir(runId), { recursive: true,
  force: true })` makes a crafted `runId` a real deletion risk, not just a
  read risk, if a matching `run.json` can be placed at the target path.
- **Scope:**
  - Add a shared `isValidRunId` check (real run IDs are `randomUUID()`
    output — validate as a UUID, not a generic "no slashes" blocklist).
  - Apply it in `GET /api/run`, `DELETE /api/run`, and `PATCH /api/runs`
    before any call into `persistence.ts`.
  - Add tests: a path-traversal-shaped `runId` (`../../x`, absolute path,
    embedded null byte if relevant to this runtime) must be rejected with
    400, not reach the filesystem at all.
- **Deliverables:**
  - The shared validator (co-located with `persistence.ts` or
    `src/lib/run/` — Code's call on the exact file).
  - Updated route handlers.
  - Tests proving rejection, not just proving the happy path still works.
- **Acceptance criteria:**
  - A `runId` that isn't a valid UUID is rejected with 400 before any
    `fs` call, for every affected route.
  - A legitimate run (real UUID) is unaffected — existing `test:unit` and
    the regression suite both still pass.
- **Dependencies:** None.

## Roadmap (not built in this pass)

### TFP-067 - Add `req.json()` error handling to all POST handlers

- **Phase:** 24
- **Priority:** P1
- **Suggested labels:** `bug`, `reliability`
- **Problem it solves:** `src/app/api/run/route.ts:27`,
  `generate/route.ts:14`, `crawl/route.ts:337`, `introspect/route.ts:58`,
  and `save-suite/route.ts:22` all call `await req.json()` unguarded. A
  malformed body (empty, truncated, wrong Content-Type) throws, and
  Next.js turns that into a raw 500 instead of a clean 400 — the correct
  pattern already exists in the same codebase (`runs/route.ts`,
  `run/route.ts`'s own `DELETE` handler: `await req.json().catch(() => (...))`).
- **Scope:** Apply the existing in-repo pattern to the five unguarded
  handlers. Mechanical, low-risk — no design decision needed.
- **Deliverables:** Five fixed route handlers.
- **Acceptance criteria:** A malformed JSON body against any of the five
  routes returns 400 with a JSON error body, not a 500.
- **Dependencies:** None.

### TFP-068 - Polling hook resilience: retry/backoff, and a terminal-status safety net

- **Phase:** 24
- **Priority:** P1
- **Suggested labels:** `reliability`, `ux`
- **Problem it solves:** `useRun.ts` and `useCrawl.ts` both abandon
  polling on the first failed `fetch()` (network blip, dev-server
  restart) — the backend job keeps running, but the user loses all
  visibility and sees an error, with no retry. Separately, both hooks
  only stop polling by checking `snapshot.result` truthy, not by checking
  a terminal `runStatus` as a second signal — currently safe only because
  `finalizeRunJob` always sets `result`, which is exactly the kind of
  single-point-of-failure assumption TFP-065 just showed can break.
- **Scope:**
  - Add a bounded retry with backoff (e.g. 3 attempts, 500ms → 1s → 2s)
    before a poll failure surfaces as a user-visible error.
  - Also check terminal `runStatus` values as a second stop condition,
    not only `result`.
- **Deliverables:** Updated `useRun.ts`, `useCrawl.ts`.
- **Acceptance criteria:** A single simulated fetch failure during polling
  does not abandon an in-flight run/crawl; polling resumes and completes
  normally once the transient failure clears.
- **Dependencies:** None. (Pairs naturally with TFP-065 since both touch
  run-finalization robustness, but neither blocks the other.)

### TFP-069 - Tighten CSP for production; drop `unsafe-eval`

- **Phase:** 24
- **Priority:** P2
- **Suggested labels:** `security`, `technical-debt`
- **Problem it solves:** `next.config.ts`'s `script-src` carries both
  `'unsafe-inline'` and `'unsafe-eval'`. `'unsafe-eval'` is a dev-mode/HMR
  requirement, not a production one; `'unsafe-inline'` could move to a
  nonce-based approach. The rest of the security header set is already
  strong (`X-Frame-Options: DENY`, `frame-ancestors 'none'`, restrictive
  `Permissions-Policy`) — this closes the one real gap in it.
- **Scope:** Make `unsafe-eval` conditional on `NODE_ENV !== "production"`
  (or the build-mode equivalent); evaluate a nonce-based `script-src` for
  inline scripts as a stretch goal, not a requirement of this ticket.
- **Deliverables:** Updated `next.config.ts` CSP header logic.
- **Acceptance criteria:** A production build's CSP header does not
  include `unsafe-eval`; dev mode is unaffected.
- **Dependencies:** None.

### TFP-070 - Small cleanups: dead env var, default base URL, hardcoded per-test timeout

- **Phase:** 24
- **Priority:** P3
- **Suggested labels:** `technical-debt`, `documentation`
- **Problem it solves:** Three low-severity findings, grouped because
  each is a one-line fix or a documentation note, not because they're
  related in cause:
  - `playwright.config.ts`'s `outputDir` reads
    `process.env.TESTFORGE_PLAYWRIGHT_OUTPUT_DIR`, which is never set
    anywhere in the codebase — dead reference; the executor's `--output`
    CLI flag overrides it in practice, so this is confusing rather than
    broken.
  - Four files hardcode `http://localhost:3000` (TestForge's own URL) as
    the default base URL when none is provided — correct only when
    TestForge is testing itself; for any other target (Plane on `:80`,
    test-assist on `:4321`) the user must know to override it. Worth a
    clearer default or at least a documented callout, not necessarily a
    behavior change.
  - `docker-compose.yml`'s `PLANE_SECRET_KEY=change-me-before-production`
    default is fine for the documented local-only use, but isn't yet
    stated as a hard requirement anywhere if this ever runs beyond a
    single local machine.
- **Scope:** Remove or wire up the dead env var; add a one-line README/
  comment callout on the default base URL and the Plane secret key
  default — no behavior change required for any of the three.
- **Deliverables:** Small diffs across the three files, plus a short
  README note.
- **Acceptance criteria:** No dead config reference remains unexplained;
  the default-base-URL and default-secret-key caveats are documented
  where a new contributor would actually see them.
- **Dependencies:** None.

## Recommended Execution Order

1. TFP-065 and TFP-066 (parallel — no shared files, both P0, fix now)
2. TFP-067 (mechanical, low risk)
3. TFP-068 (pairs conceptually with TFP-065)
4. TFP-069
5. TFP-070

## Suggested Milestone Gates

### Gate A - Critical findings closed
- TFP-065 and TFP-066 both landed, each with a real regression/unit test
  proving the failure mode is closed, not just a manual verification
  claim.

### Gate B - Reliability audit backlog closed
- TFP-067 through TFP-070 all landed, whenever they're picked up.
