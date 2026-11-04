# Phase 18 Decision Record — Integration Mapping and Failure Injection (Locked)

Date: 2026-09-23
Scope: Record every outbound dependency a page talks to, generate `page.route()`
failure-injection tests against each one, and generate generic local
storage-API failure-injection tests — extending Phase 17's discovered-surface
coverage denominator rather than living outside it.
Status: Complete. TFP-084/085 `1b6a4f3` and TFP-086 `5cb1fc8` (2026-09-23). Decision 3 resolved 2026-09-23; Decision 4 resolved and then revised the same day (see below). Reconciled with git 2026-09-29.

## Context

`docs/decisions/product-roadmap.md`'s Phase 18 section, plus its TFP-062
scope addendum (confirmed, `eb4ad3f`), already lock the shape of this phase.
This record turns that paragraph into buildable decisions and a real
backlog — it does not re-open what the addendum already settled.

Two things were genuinely undecided when this record was first written and
were marked `[PLACEHOLDER]`: how corrupted/old-schema *seeding* generalizes
to a target site TestForge has no schema knowledge of, and whether
auth-critical dependencies (login redirects, session cookies) get excluded
from blanket blocking. Both are now resolved (Emil, 2026-09-23, after
TFP-084–086 had already landed) — see Decisions 3 and 4 below. Decision 4
was resolved once, then corrected the same day after Emil pushed back on
a blanket, unpinpointed exclusion; the correction stands. Everything else
in this record is derived directly from the roadmap paragraph, the
addendum, and rules the roadmap has already locked elsewhere (the
interactive-test skip-by-default rule).

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
- Resolved (Emil, 2026-09-23): schema/corrupted-value *seeding* is
  deferred, not built in Phase 18. TestForge has no generic way to infer
  a target's storage schema, so this stays a manual/config-supplied
  capability (the site owner names a storage key and a "known-bad"
  shape) for a later phase. TFP-086 already shipped scoped this way
  (generic entry-point-unavailable case only) — this decision confirms
  that scoping rather than changing it.

4. No dependency is excluded from `page.route()` blocking for
   auth-related reasons — the risk that would justify one doesn't exist
   in this codebase yet.
- First resolved (Emil, 2026-09-23) as a blanket default: exclude the
  whole `redirect` kind (the map's closest stand-in for "login-flow
  redirect") from blocking by default, on the theory that blocking one
  could invalidate every later test in the same run. Implemented the
  same day in TFP-085.
- Revised (Emil, 2026-09-23, same day): that exclusion was a guess, not
  a pinpointed reason, and Emil asked for the real mechanism instead of
  a blanket carve-out. Checking the actual generated-suite architecture
  settles it: `playwright.config.ts` sets no `storageState` and nothing
  in `src/lib/generate` shares session state across tests — every
  generated test already runs in its own isolated Playwright
  page/context. Blocking a redirect inside one test's `page.route()`
  cannot reach any other test in the run, today. The cascade risk that
  motivated the exclusion is real only once Phase 20 introduces a
  run-wide cached `storageState` shared across every generated test —
  it does not exist yet, so there is nothing to exclude yet.
- Corrected default: every routable dependency, `redirect` included,
  gets a failure-injection test by default, exactly like
  xhr-fetch/form-action/third-party-script/iframe. `cookie` remains
  excluded, but for its own unrelated, mechanical reason — it isn't a
  routable network request at all, not because it's auth-critical.
- Forward note for Phase 20: when a run-wide cached `storageState`
  lands, revisit this decision. The correct fix then is a *pinpointed*
  exclusion — matching the specific dependency whose host equals Phase
  20's configured login URL — not a kind-wide exclusion of every
  `redirect`. That's new scope for a Phase 20 ticket to define, not
  something this record decides in advance.
- TFP-085 and its tests were reverted the same day to match this
  correction; see the commit that follows this record.

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

#### INT-07 evidence

Moved word for word from [`docs/test-plan/INT.md`](../test-plan/INT.md) by TFP-253; the case's row there links here.

**Test:** Per-`baseUrl` dependency map: XHR/fetch, form-action, third-party-script, iframe, redirect, and cookie dependencies, deduped by (host, kind) — cookies further deduped by name so distinctly-named cookies on one host don't collapse to one row (TFP-084, automated: `npm run test:unit` — `src/lib/introspect/dependency-map.test.ts`, "a same-origin script is not recorded...", "a third-party script is recorded with its host and kind...", "a same-origin fetch is tagged sameOrigin: true, not misclassified...", "distinctly-named cookies on the same host are separate rows...")

**Expected result:** `inspectPages` returns a `dependencyMap` naming each real outbound dependency by host and kind; a same-origin script is never recorded, a same-origin fetch is recorded but tagged `sameOrigin: true`. Verified live, called directly (not through the manually-running dev server on :3000, which independently fails to launch headless Chromium in its current process — reproduces on unmodified `main` too, a pre-existing environment issue, not a TFP-084 regression): introspecting `cah-pwa` (`http://localhost:8001`) names `www.gstatic.com` as `third-party-script` (3 Firebase SDK `<script src>` tags, deduped to 1 row, `sameOrigin: false`); introspecting `https://the-internet.herokuapp.com/login` names `298279967.log.optimizely.com` as `xhr-fetch` (`sameOrigin: false`), 5 distinctly-named cookies on `the-internet.herokuapp.com` as 5 separate `cookie` rows (`sameOrigin: true`), and `the-internet.herokuapp.com` as `form-action` to `/authenticate` (`sameOrigin: true`).

#### RUN-13 evidence

Moved word for word from [`docs/test-plan/RUN.md`](../test-plan/RUN.md) by TFP-253; the case's row there links here.

**Test:** Reliability: one `page.route()` failure-injection test per routable dependency from TFP-084's map, folded into the same discovered-coverage denominator as functional/accessibility (not a separate report tab); cookie-kind dependencies are `excluded-by-generator` since a cookie isn't a routable request. Decision 4 (revised): redirect-kind dependencies are tested by default, same as any other routable kind — each generated test runs in its own isolated Playwright context with no shared `storageState` today, so blocking one can't affect any other test in the run; that risk only becomes real once Phase 20 introduces a run-wide cached `storageState`, and the fix at that point must be pinpointed to the specific dependency matching the configured login URL, not a blanket kind-wide exclusion (TFP-085, automated: `npm run test:unit` — `src/lib/report/discovered-coverage.test.ts`, "TFP-085: reliability folds into the same discovered-coverage denominator...", "TFP-085: a cookie-kind dependency is excluded-by-generator...", "Decision 4 (revised): a redirect-kind dependency is tested by default like any other routable dependency, not excluded..."; `src/lib/generate/mock/dependency-failure-injection.test.ts`, "routes by host + pathname, not the full sampleUrl...", "a form-action dependency with a known raw action attribute actually submits the form once blocked...", "cookie is not a routable dependency kind; every other kind, including redirect, is...")

**Expected result:** Blocking a real recorded dependency and running the generated test against it produces a named pass or a named failure, never a bare Playwright timeout. A `form-action` test also calls `requestSubmit()` on the located form once its endpoint is blocked, so the block is actually exercised on a page whose dependency only fires on submit, not just present during an inert reload — still read-only from the target's point of view, since the abort happens client-side before the request leaves the browser. Verified live: `https://the-internet.herokuapp.com/login` — blocking its Optimizely `xhr-fetch` beacon and its `/authenticate` `form-action` (submitted via `requestSubmit()`) both pass, a real graceful-degradation result; `cah-pwa` (`http://localhost:8001`) — blocking `www.gstatic.com`'s Firebase SDK script (`third-party-script`) produces a named failure citing the exact console errors (`Cannot read properties of undefined (reading 'INTERNAL')`, `firebase is not defined`), a real defect this test correctly surfaces rather than a timeout.

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

#### RUN-14 evidence

Moved word for word from [`docs/test-plan/RUN.md`](../test-plan/RUN.md) by TFP-253; the case's row there links here.

**Test:** Reliability: generic storage-entry-point failure injection — introspect runs a real behavioral probe (an instrumented getter/`indexedDB.open` wrapper the page's own scripts actually execute through, not a static source grep) to detect which of `localStorage`/`sessionStorage`/`indexedDB` a page touches at all; one generated test per detected (page, kind) mocks that entry point to throw and asserts the app degrades rather than crashing. Schema/corrupted-value seeding is explicitly out of scope (Decision 3, resolved: deferred — TestForge has no generic way to infer a target's storage schema, so this stays a manual/config-supplied capability for a later phase, not built in Phase 18) — this is the generic entry-point-unavailable case only (TFP-086, automated: `npm run test:unit` — `src/lib/generate/mock/storage-failure-injection.test.ts`, "a target that doesn't touch storage at all generates no storage-failure test...", "one test per detected (page, storage kind)..."; `src/lib/report/discovered-coverage.test.ts`, "TFP-086: storage failure injection folds into the same reliability row as TFP-085's dependency tests...", "TFP-086: a page with no detected storage usage contributes nothing...")

**Expected result:** A target that doesn't touch storage at all generates no storage-failure test (no false-positive coverage claim); a target that does gets one test per kind actually detected, folded into the same "Reliability" coverage row TFP-085 established. Verified live against `cah-pwa` (`http://localhost:8001`), which really does use `localStorage` (confirmed independently via its `app.js`): the behavioral probe detected all three kinds in use — `localStorage`/`sessionStorage` from the app's own code, `indexedDB` from the Firebase Firestore SDK's own offline-persistence layer, a real finding the probe caught that a source grep of the app's own code would have missed. All three generated tests pass — the app's initial load degrades gracefully even with each storage entry point mocked to throw. Verified the negative case against `https://the-internet.herokuapp.com/login`, which touches none of the three: the probe reports all-false and zero storage-failure tests are generated for it.

## Recommended Execution Order

1. TFP-084 (the map everything else reads)
2. TFP-085 and TFP-086 in parallel (different failure classes, no shared
   files)

## Suggested Milestone Gates

### Gate A — Phase 18 complete
- TFP-084–086 all landed against a real target, each with `TEST_PLAN.md`
  cases proving real (not assumed) behavior, and both placeholder
  decisions resolved (2026-09-23): Decision 3 (schema/corrupted-value
  seeding deferred, not built) and Decision 4 (no auth-related exclusion
  today — every routable dependency, `redirect` included, is tested by
  default; a pinpointed, host-specific exclusion is real future scope
  for Phase 20, not built now), with TFP-085 and `TEST_PLAN.md` updated
  to match in the same commits. **Met.**
