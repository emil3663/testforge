# Phase 17 Decision Record (Locked)

Date: 2026-09-17
Scope: Give runs durable identity and persist them to disk with a tiered
retention scheme; recompute coverage against the discovered surface from
crawl/introspect instead of the tests that happened to run; add a "not
tested, and why" report section; support diffing two persisted runs of the
same site.
Status: Complete. TFP-064 `482454d` (2026-09-17), TFP-071/072 `8cd901f` and TFP-073 `6a0ca45` (2026-09-22); independently re-verified 2026-09-22. The hold on TFP-053-063 (Decision 6) was met first. Reconciled with git 2026-09-29.

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

5. Runs have a tiered retention state: full, archived, and pinned.
- `run.json` gains three fields: `pinned` (boolean, default `false`),
  `retention` (`"full" | "archived"`, default `"full"` at creation), and
  `lastAccessedAt` (timestamp, `null` until the run's report is actually
  read via the API/UI — this is the "has this even been looked at" signal,
  surfaced in the run listing, and is informational only in this phase: not
  being accessed is not by itself a reason to delete something).
- **Pinning** is an explicit user action (API/UI) and is a hard override —
  a pinned run is never auto-archived regardless of any other rule. This is
  the "flag important runs to keep" mechanism.
- **Archiving** (manual or automatic) deletes only `evidence/` (traces,
  videos, screenshots) for a run — `run.json` and `suite.spec.ts` are kept
  in full, so history, coverage numbers, and diffing all keep working for
  an archived run. Nothing about a run's pass/fail record or config is ever
  deleted by archiving; only the heavy replay evidence is.
- **Manual archiving**: a run can be archived on request at any time,
  regardless of the automatic rule below.
- **Automatic archiving eligibility** — a run becomes eligible when *all*
  of the following hold: (a) it is not pinned; (b) a newer run exists for
  the same `baseUrl`, i.e. it has been superseded; (c) none of its failed
  tests, if any, are still failing in the newest run for that `baseUrl` —
  in plain terms, it isn't the current evidence for a bug that's still
  open. A same-day regression run that passed cleanly and was later
  superseded is exactly what this prunes automatically; a run capturing a
  reproducing, not-yet-fixed defect is exempted until a later run shows
  that specific test passing.
- This deliberately folds "was this a minor run" into the same mechanism
  rather than adding a separate tag: a run that added nothing new and was
  immediately superseded is, definitionally, what the automatic rule
  archives — a distinct "minor" flag would just be a second name for the
  same condition.
- Automatic archiving runs as an on-demand sweep (triggered by an API call
  or a manual command), not a continuous background process — this phase
  does not add a scheduler or daemon.
- `README.md` documents the tiered scheme and the automatic rule in plain
  language, the same way it already states the local-only security model
  rather than leaving retention behavior implicit.

6. This phase is sequenced after the `phase-17-walkthrough-backlog.md`
   generator-hardening tickets (TFP-053–063) land, not in parallel with them.
- Emil's stated preference: complete the generator-hardening backlog first,
  so the product is as complete as it can be before taking on more backlog
  — a product-priority call, not a technical dependency (the reasoning in
  the prior draft, that persistence and generation-quality are decoupled,
  still holds technically; it just isn't the deciding factor here).
- This record's decisions (1–5 above) are locked now so implementation
  can start the moment TFP-053–063 close, without a second planning pass.
- Implementation of this phase does not begin until
  `phase-17-walkthrough-backlog.md`'s own milestone gate is met.

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
- Archiving a run (manual or automatic) removes `runs/<runId>/evidence/`
  while `run.json` and `suite.spec.ts` remain readable and that run still
  appears correctly in coverage history and diffing.
- Pinning a run and then running the automatic-archiving sweep leaves that
  run's `evidence/` untouched, even when it would otherwise qualify.
- A run whose only failure is later fixed (a subsequent run shows that same
  test passing) becomes eligible for automatic archiving on the next sweep,
  where it was not eligible before the fix.
- `lastAccessedAt` is `null` on a freshly persisted run and is set the
  first time that run's report is read back.
- `README.md` documents the tiered retention scheme (full/archived/pinned)
  and the automatic rule, in the same section style as the existing
  Security Model statement.

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

## Resolved before lock

Both placeholders in the prior draft were confirmed directly by Emil rather
than assumed:

1. **Sequencing (Decision 6).** Complete `phase-17-walkthrough-backlog.md`'s
   TFP-053–063 first — a product-completeness preference ("as complete a
   product as possible before stepping into more backlog"), not a reversal
   of the technical reasoning that persistence and generation-quality are
   decoupled. This record's decisions are locked now so implementation can
   start immediately once that backlog's own milestone gate is met, without
   redrafting this document then.
2. **Retention (Decision 5).** Not manual-only. A tiered scheme: pin
   important runs explicitly; archive (evidence only, not the record)
   everything else once superseded, automatically, unless it's the live
   evidence for a still-open, specifically-tracked defect. This is what the
   original manual-only draft under-specified — Emil's actual requirement
   was closer to "don't make me manually decide on routine same-day
   regression runs, but never touch a run I've flagged or one that's the
   only evidence for a live bug."
