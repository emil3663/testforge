# Phase 18 Decision Record — Integration Mapping and Failure Injection (Locked)

Date: 2026-09-23
Scope: Record every outbound dependency a page talks to, generate `page.route()`
failure-injection tests against each one, and generate generic local
storage-API failure-injection tests — extending Phase 17's discovered-surface
coverage denominator rather than living outside it.
Status: Approved and in implementation

## Context

`docs/decisions/product-roadmap.md`'s Phase 18 section, plus its TFP-062
scope addendum (confirmed, `eb4ad3f`), already lock the shape of this phase.
This record turns that paragraph into buildable decisions and a real
backlog — it does not re-open what the addendum already settled.

Two things are genuinely undecided and are marked `[PLACEHOLDER]` below
rather than invented: how corrupted/old-schema *seeding* generalizes to a
target site TestForge has no schema knowledge of, and whether
auth-critical dependencies (login redirects, session cookies) get excluded
from blanket blocking. Everything else in this record is derived directly
from the roadmap paragraph, the addendum, and rules the roadmap has
already locked elsewhere (the interactive-test skip-by-default rule).

**Standing policy for this phase (Emil, 2026-09-23):** a defect found
while building or verifying any ticket below is fixed immediately, in the
same ticket, not logged for a later cleanup pass. Every ticket's
Deliverables includes the `TEST_PLAN.md` and doc updates its own change
needs — there is no trailing "sync the docs" ticket at the end of this
phase. See `docs/decisions/product-roadmap.md`'s Sequencing note for the
durable version of both rules, which now applies to Phases 18–20 and
whatever follows them.

## Decisions

1. Crawl and introspect record every outbound dependency a page talks to.
- XHR/fetch targets, form `action` hosts, third-party `<script src>`,
  `<iframe src>`, auth redirect targets, and cookies set.
- Aggregated into a dependency map per `baseUrl`, extending the same
  per-site discovered-surface model Phase 17 Group 2 already built
  (`buildDiscoveredCoverageMatrix`) rather than a parallel structure.

2. Generated tests use `page.route()` to block or fail each recorded
   dependency in turn, one test per dependency, asserting the page
   degrades rather than breaking.
- These are read-only from the target's point of view — blocking a
  network call does not submit, mutate, or trigger a side effect on the
  live site — so they run by default, the same as functional and
  accessibility tests. They are not covered by the existing
  "interactive tests skip unless explicitly enabled" rule; that rule
  is for the target's own submit/mutate actions, not TestForge's
  network interception of them.
- Counted toward the discovered-surface coverage denominator, the same
  way functional/accessibility elements are (Phase 17 Groups 2/3) — not
  a separate, siloed report section.

3. Local storage-API failure injection is generic, not schema-aware.
- TestForge mocks the storage entry point itself (`indexedDB.open`, or
  the equivalent `localStorage`/`sessionStorage` access point) to throw,
  and asserts the app degrades rather than crashing or half-reading —
  this needs no knowledge of the target's actual schema.
- `[PLACEHOLDER: seeding a genuinely corrupted/old-schema value, as
  distinct from the entry point failing outright, requires knowing the
  target's storage schema — TestForge has no generic way to infer one.
  Confirm whether this half of the addendum ships in Phase 18 at all,
  or stays a manual/config-supplied capability (the site owner names a
  storage key and a "known-bad" shape) for a later phase.]`

4. `[PLACEHOLDER: are auth-critical dependencies — login-flow redirects,
  session-setting cookies — excluded from blanket page.route() blocking
  by default, since blocking one could invalidate every later test in
  the same run rather than testing graceful degradation? Confirm the
  default; an opt-out list is the likely shape either way.]`

## Acceptance Criteria

1. Dependency map
- For a real target with at least one third-party script and one form
  submission, the generated map names both, with their host and
  dependency kind.
- The map is exercised by a real target during verification (Decision
  1's acceptance is "the map is real," not "the code compiles").

2. Failure-injection tests
- Blocking a real recorded dependency and running the generated test
  against it produces a pass (graceful degradation) or a named failure —
  never a Playwright timeout with no diagnosis.
- These tests appear in the discovered-coverage report, not only in the
  generated `.spec.ts` file.

3. Storage failure injection
- Forcing `indexedDB.open` (or the applicable entry point) to throw on a
  real target results in a generated test that asserts the app's actual
  observed behavior (crash vs. degrade), not an assumed one.

## Regression Policy

- Add explicit `TEST_PLAN.md` cases for: a dependency map matching a
  real target's actual third-party/form/iframe surface; a blocked
  dependency producing a named pass/fail rather than a bare timeout; and
  a forced storage-entry-point failure producing an accurate pass/fail
  on whatever the app actually does. Landed in the same commit as the
  code, per this phase's standing policy above — not appended later.

## Backlog

### TFP-084 — Extend crawl/introspect to build a per-site dependency map

- **Phase:** 18
- **Priority:** P1
- **Suggested labels:** `feature`, `crawl`
- **Problem it solves:** nothing in the crawl/introspect pipeline
  currently records what a page talks to outside itself — Phase 18's
  failure-injection tests (TFP-085) have nothing to target without this.
- **Scope:**
  - During introspect, capture XHR/fetch targets, form `action` hosts,
    `<script src>` (third-party — different origin from `baseUrl`),
    `<iframe src>`, redirect targets observed during navigation, and
    cookies set, per page.
  - Aggregate per-page dependencies into a per-`baseUrl` map, deduped by
    (host, dependency kind), following the same aggregation shape
    `buildDiscoveredCoverageMatrix` already uses for elements.
  - Persist the map alongside the existing introspect output so
    TFP-085/086 and the coverage matrix can read it without re-crawling.
- **Deliverables:**
  - Extended introspect capture + a real dependency-map type.
  - `TEST_PLAN.md` case(s) proving the map matches a real target's known
    dependencies (pick a target with at least one third-party script).
- **Acceptance criteria:**
  - Run against a real target with a known third-party dependency (e.g.
    a font CDN or analytics script): the map names it, by host, with the
    correct dependency kind.
  - A same-origin fetch is not misclassified as a third-party dependency.
- **Dependencies:** None (extends Phase 17's introspect/coverage
  machinery, already landed).

### TFP-085 — Generate `page.route()` failure-injection tests from the dependency map

- **Phase:** 18
- **Priority:** P1
- **Suggested labels:** `feature`, `generate`
- **Problem it solves:** the dependency map from TFP-084 is inert without
  tests that actually exercise it — this is the phase's core "does the
  page degrade gracefully" capability.
- **Scope:**
  - For each dependency in the map, generate one test that blocks or
    fails it via `page.route()` and asserts observable graceful
    degradation (the page doesn't crash, shows some reasonable fallback
    or honest error) rather than a specific hardcoded behavior TestForge
    can't know in advance — the assertion is "didn't break," not "showed
    exactly this."
  - Fold results into the discovered-coverage denominator (Decision 2)
    rather than a separate report tab.
  - Apply Decision 4's exclusion policy once `[PLACEHOLDER]` above is
    resolved — until then, generate tests for every recorded dependency
    and note the open question in the generated suite's header comment,
    not silently.
- **Deliverables:**
  - Generator changes producing one failure-injection test per
    dependency.
  - `TEST_PLAN.md` case(s) proving a blocked dependency produces a named
    pass/fail against a real target.
- **Acceptance criteria:**
  - Against a real target, blocking its one third-party dependency
    (from TFP-084's proof target) produces a test result naming what was
    blocked and what happened — not a bare Playwright timeout.
  - The failure-injection tests are visible in the coverage report's
    denominator, counted the same way functional/accessibility elements
    are.
- **Dependencies:** TFP-084.

### TFP-086 — Generic storage-entry-point failure injection

- **Phase:** 18
- **Priority:** P2
- **Suggested labels:** `feature`, `generate`, `reliability`
- **Problem it solves:** closes the half of TFP-062's addendum that
  doesn't need target-specific schema knowledge — a page that dies
  outright when `indexedDB`/`localStorage` is unavailable is a real,
  generically-detectable defect class (per TFP-042's `test-assist`
  finding), distinct from network-dependency failure.
- **Scope:**
  - Detect, during introspect, whether a page's own scripts touch
    `localStorage`, `sessionStorage`, or `indexedDB` at all (a real
    behavioral probe — actually calling the page with the entry point
    mocked to throw and observing whether anything changes — not a
    static source grep, which the generator's own house style already
    avoids elsewhere).
  - For pages that do, generate one test that mocks the relevant entry
    point to throw and asserts the app degrades (doesn't crash / doesn't
    half-render) rather than a specific fallback UI.
  - Schema/corrupted-value seeding stays out of this ticket per the
    `[PLACEHOLDER]` above — this ticket is the generic
    entry-point-unavailable case only.
- **Deliverables:**
  - Generator changes producing the storage-unavailable test where
    applicable.
  - `TEST_PLAN.md` case(s) proving a forced storage failure produces an
    accurate result against a real target that actually uses storage.
- **Acceptance criteria:**
  - Against a real target that uses `localStorage` or `indexedDB`,
    forcing the entry point to throw produces a test result that
    matches the app's actual observed behavior, not an assumed one.
  - A target that doesn't touch storage at all generates no
    storage-failure test (no false-positive coverage claim).
- **Dependencies:** None (independent of TFP-084/085 — different failure
  class).

## Recommended Execution Order

1. TFP-084 (the map everything else reads)
2. TFP-085 and TFP-086 in parallel (different failure classes, no shared
   files)

## Suggested Milestone Gates

### Gate A — Phase 18 complete
- TFP-084–086 all landed against a real target, each with `TEST_PLAN.md`
  cases proving real (not assumed) behavior, and both `[PLACEHOLDER]`
  decisions above resolved one way or the other before their affected
  ticket (TFP-085's exclusion policy; a follow-up ticket for schema
  seeding, or an explicit decision not to build it).
