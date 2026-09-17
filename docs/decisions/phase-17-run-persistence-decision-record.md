# Phase 17 Decision Record (Draft)

Date: 2026-09-17
Scope: Give runs durable identity and persist them to disk; recompute coverage
against the discovered surface from crawl/introspect instead of the tests
that happened to run; add a "not tested, and why" report section; support
diffing two persisted runs of the same site.
Status: Draft — two decisions below are flagged for confirmation before this
locks to "Approved and in implementation"

## Context

`docs/decisions/product-roadmap.md`'s own Sequencing note called for a live
walkthrough of what TestForge actually produces before this phase's decision
record was drafted. That walkthrough ran (TFP-040/041/042,
`examples/comparison-test-assist.md`) and its findings are scoped in
`docs/decisions/phase-17-walkthrough-backlog.md`. Phase 16 Gate D is closed
(TFP-005/030/031/032 landed) — this document is what that gate was blocking.

Confirmed directly against the current code before writing any decision
below, not assumed from the roadmap outline:

- `runJobs` (`src/lib/run/jobs.ts`) is a process-global, in-memory `Map` —
  gone on restart. `finalizeRunJob` actively `unlink()`s the generated test
  file, the JSON report file, and the reporter file once a run finishes;
  nothing about a completed run survives except what's sitting in that
  in-memory job until the process recycles it.
- Evidence artifacts (trace/video/screenshot) are **not** currently deleted —
  they're written by Playwright itself into `playwright.config.ts`'s
  `outputDir` and `collectArtifactFiles()` (`src/lib/run/output.ts`) reads
  them back by path. They physically persist today; they're just not tracked
  anywhere durable, and a later run reusing the same `outputDir` can
  overwrite them.
- `buildCoverageMatrix` (`src/lib/report/coverage.ts`) computes coverage
  entirely from `selectedPractices` × the executed suite's own
  `ExecutionRecord[]` — one row per selected practice area, "covered" if
  every test in that area passed. It never touches crawl or introspect
  output. This is the exact, literal mechanism behind the roadmap's "coverage
  is computed from the tests that ran, not against a discovered surface"
  problem statement — confirmed by reading the 59-line file, not inferred.
- No database dependency exists anywhere in `package.json`
  (`@playwright/test`, `next`, `openai`, `react` are the only runtime deps).
  The project's stated posture throughout Phase 16 is deliberately minimal
  and local-only.
- Discovered elements already carry a natural composite identity — the same
  fields `dom-snapshot.ts` already uses to deduplicate them
  (`elementType` + `containerLabel` + `locator.id` + `locator.name`, falling
  back to `text`) are also embedded in every generated test's own title via
  `buildActionableElementTests`. Coverage matching against the discovered
  surface can reuse this without inventing a new ID scheme.

## Decisions

1. Runs get durable identity and land on disk as flat files, not a database.
- A finished run writes to `runs/<runId>/` at the repository root:
  `run.json` (the config that produced it — `baseUrl`, `description`,
  `selectedPractices`, `auditMode`, `createdAt`, `finishedAt` — plus the
  full `RunResultPayload`/`RunReport`), `suite.spec.ts` (the exact code that
  was executed, copied before `finalizeRunJob`'s existing cleanup deletes the
  transient copy), and `evidence/` (trace/video/screenshot files **moved**,
  not copied, out of Playwright's shared `outputDir` into this run-scoped,
  stable location, so a later run cannot overwrite them).
- `runs/` is gitignored, same pattern as `artifacts/`.
- No new dependency is added. A run is discovered by listing `runs/`;
  `run.json` is self-describing. This is a deliberate choice against a
  database, consistent with the project's local-first, single-developer
  posture — not an oversight.
- `runJobs` (the in-memory `Map`) is not removed. It continues to hold
  *in-flight* run state for live progress polling, which genuinely needs
  low-latency in-process access; persistence happens once at
  `finalizeRunJob`, when a run reaches a terminal status.

2. Coverage is recomputed against the discovered surface, not just executed tests.
- `buildCoverageMatrix` (or a new function alongside it) additionally takes
  the crawl/introspect output for the run's `baseUrl` — pages, actionable
  elements, link details.
- An element counts as covered only if it was the actual subject of an
  executed test, matched by its composite identity (above) — not merely
  because some test in the same named category happened to pass.
- Each practice-area row's covered/partial/uncovered rollup is now
  denominated against the number of discovered elements relevant to that
  area, not against however many tests happened to exist for it.

3. The report gains a "not tested, and why" section.
- Every discovered element with no matching executed test is listed under
  one of three reasons: **not selected** (its practice area wasn't chosen
  for this run), **excluded by generator logic** (a known, named skip
  pattern in the generator itself), or **generator gap** (no test covers it
  and no known reason) — the third bucket is the honest one and is not
  allowed to silently absorb the first two.
- This section is part of the persisted `run.json`'s report, not a
  UI-only computation, so a stored run's report is complete on its own.

4. Two persisted runs of the same site can be diffed.
- Given two `runId`s sharing the same `baseUrl`, a diff shows: tests that
  passed in one but not the other, the coverage-percentage delta per
  practice area, and elements newly discovered or newly missing between the
  two runs' introspection snapshots.
- Phase 17 delivers the data and an API for this. A polished diff UI is
  explicitly deferred — out of scope for this phase's lock, not forgotten.

5. Retention is manual, not automatic.
- No automatic pruning ships in this phase. A run's directory, evidence
  included, stays on disk until the user deletes it themselves.
- `README.md` documents this as a stated disk-usage tradeoff, the same way
  it already states the local-only security model plainly rather than
  leaving it implicit.

6. This phase does not wait on the `phase-17-walkthrough-backlog.md`
   generator-hardening tickets (TFP-053–063).
- Run persistence and coverage recomputation are decoupled from whether
  individual generated assertions are correct or how rich the best-practice
  templates are — a false-positive test still counts as "this element was
  tested," which is a generation-quality question, not a persistence
  question.
- TFP-053–063 continue as a separate, parallel track and are not
  re-scoped into this phase.

## Acceptance Criteria

1. Persistence
- Restarting the dev server after a completed run still allows that run's
  full report to be read back from `runs/<runId>/run.json`.
- The generated suite that produced a run is readable afterward from
  `runs/<runId>/suite.spec.ts`, byte-for-byte identical to what was executed.
- Evidence files referenced by a persisted run's report resolve to files
  that still exist under `runs/<runId>/evidence/`, including after a second,
  unrelated run has completed.

2. Coverage
- Running the same suite against a target with more discovered actionable
  elements than tests written produces a coverage percentage below 100%,
  even when every written test passes — this is the specific, observable
  behavior change from today's category-only computation.
- The coverage matrix's "uncovered" list names specific discovered elements,
  not just practice-area labels.

3. Not-tested reporting
- Every element in the "not tested, and why" section carries exactly one of
  the three named reasons.
- The "generator gap" bucket is non-empty on at least one real target known
  to have generator gaps (`test-assist`, per `examples/comparison-test-assist.md`),
  proving the bucket isn't vacuous by construction.

4. Diffing
- Given two runIds for the same `baseUrl`, the diff API returns a
  structured result naming specific tests and specific coverage deltas, not
  a percentage-only summary.

5. Retention
- `README.md`'s documentation of manual retention is present and named
  in the same section style as the existing Security Model statement.

## Regression Policy

- Add explicit `TEST_PLAN.md` cases for: a run surviving a server restart
  (persistence), coverage dropping below 100% on a target with undiscovered-
  but-untested elements (honest coverage), the "not tested, and why" section
  populating all three reason buckets against a real target, and a two-run
  diff against the same `baseUrl` with a known, deliberate difference between
  them (e.g. a regenerated suite with one fewer test).
- Existing regression cases that assert on `buildCoverageMatrix`'s current
  category-only shape must be updated to the new discovered-surface shape as
  part of this phase, not left passing against stale behavior.

## Open before this locks

1. **[PLACEHOLDER: confirm Decision 6]** — proceeding with this phase now,
   in parallel with the `phase-17-walkthrough-backlog.md` generator-hardening
   tickets rather than after them, reverses that backlog's own stated
   readiness gate ("Ready to draft Phase 17's decision record" named
   TFP-053/054/055/057/062 as prerequisites). The reasoning above is that
   persistence/coverage-recomputation and generation-quality are genuinely
   decoupled — but that gate was written deliberately and only you can waive
   it. Confirm, or hold this record until those tickets land.
2. **[PLACEHOLDER: confirm Decision 5]** — manual-only retention is the
   simplest option and matches the project's local-first posture, but
   `evidence/` can include videos and traces that add up over repeated runs.
   Confirm manual-only is acceptable, or specify a cap (e.g. keep the last N
   runs per `baseUrl`) to add to this phase's scope instead.
