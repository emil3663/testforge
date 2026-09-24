# Phase 33 Decision Record — Local Model Category Coverage

Date: 2026-09-24
Scope: Teach the local (Ollama) generation path real, category-specific
coverage for the five best-practice areas Phase 31's baseline found thin
or broken (performance, SEO, database, reliability, security), and close
Phase 32's one open question — whether the route should reject or repair
suites with unawaited checks.
Status: Approved and in implementation (TFP-110 unblocked now; TFP-111,
TFP-112, TFP-113 unblocked, no dependency between them or on TFP-110)

## Context

Phase 31's baseline (GEN-28) generated one real suite per best-practice
area against `testforge-qwen7b` and read each one, not just compiled it.
Five categories fell short of what `src/lib/generate/prompt.ts`'s own
`BEST_PRACTICE_GUIDANCE` already asks for — guidance already sent to the
local model, same as the OpenAI path, so this isn't a case of the model
never being told:

- **Performance/load** — guidance asks for "lightweight browser timing
  assertions"; the suite asserted HTTP 200 and measured no time at all.
- **SEO/content** — guidance asks for "title, meta description, heading
  structure, and critical content"; the suite had one visibility-only
  test.
- **Database** — guidance asks to "validate data persistence indirectly
  through user-visible create/read/update flows"; the suite had one
  visibility-only test, no create/read/update flow.
- **Security** — guidance asks for "HTTPS, invalid-input handling,
  auth/session behavior, and visible security errors"; the invalid-input
  check was real, but the HTTPS check asserted `https://` against an
  `http://` base URL, and (Phase 32, GEN-29) was missing its `await`, so
  it never even ran.
- **Reliability** — not in `BEST_PRACTICE_GUIDANCE`'s prose at all.
  `src/app/_lib/constants.ts`'s `BEST_PRACTICE_OPTIONS` defines it as
  "Graceful degradation when a dependency or local storage fails," and
  the deterministic generator (`src/lib/generate/mock/dependency-failure-injection.ts`)
  implements it with `page.route()` interception against specific
  dependencies discovered during introspection — a real, fairly advanced
  Playwright technique, not standard testing vocabulary. The local
  model's suite had only a title check and a focus check — consistent
  with a model that was never told what "reliability" means here, not
  one that understood and skipped it.

Accessibility (Phase 31, TFP-106) proved the fix for "the model was told
in prose and didn't comply": a concrete, copy-ready worked example, not
more prose. Phase 32 (TFP-109/GEN-30) then found two things that change
how those examples must be built:

1. A worked example's data leaks verbatim if it looks like real data —
   9 of 10 GEN-28 suites reused the accessibility example's exact
   `/login` path even though no request mentioned it.
2. The model copies an example's *structure*, not just its literals —
   even once the URL stopped leaking (GEN-30), suites built with the
   leak-prone wording reused the example's test names word for word and
   extended its pattern, including one near-tautological check.

Phase 32's record already states the resulting rule for every example
this phase writes: use only placeholder data, write the example as
exactly the tests that should be copied (because they will be), and test
new examples with wording chosen to expose copying, not wording that
happens to avoid it.

Phase 32 also left one question open: `findUnawaitedAssertions` (TFP-108)
can detect a suite with an unawaited check, but the route doesn't act on
it yet — it's a rule, not a gate.

**Standing policy for this phase:** same as every phase since 18 — a
defect found while building or verifying a ticket is fixed in that
ticket, not deferred; `TEST_PLAN.md` updates land in the same commit as
the code.

## Decisions

1. An unawaited assertion is rejected the same way an invented API is —
   extend the existing gate, don't build a repair step.
- `generateWithOllama` calls `findUnawaitedAssertions` alongside
  `findTypeErrors` before labelling a suite `generatedBy: "ollama"`; any
  result from either fails the suite into the same `fallback()` path,
  with a reason that distinguishes which check failed
  (`invalid_output` vs. a new `unawaited_assertion`).
- Rejecting, not auto-inserting `await`, because every gate this pipeline
  has built (TFP-103, TFP-108) detects and falls back; none of them
  rewrites the model's output. Auto-repair would be new, riskier surface
  (where exactly to insert `await` inside `.not`/`expect.soft`/chained
  expressions is exactly the complexity `isHandled` already has to
  reason about) to fix something TFP-108's audit found only once in 18
  real suites. Not worth the new risk for a rare case a template fallback
  already handles safely.

2. Each of the five categories gets its own worked example, built to
   Phase 32's three rules — placeholder data only, written as exactly the
   tests that should be copied, measured with wording chosen to expose
   copying.
- The category's definition is the one already in `BEST_PRACTICE_GUIDANCE`
  / `BEST_PRACTICE_OPTIONS` — not reinvented here. The model was already
  told; a concrete example is the fix, the same lever that worked for
  accessibility, not new prose explaining the category again.

3. Reliability is built first, on its own, and treated as the highest-risk
   category in this phase.
- Unlike the other four, "graceful degradation when a dependency or local
  storage fails" is TestForge-specific meaning, not general testing
  knowledge, and the deterministic generator's own implementation uses
  `page.route()` interception against a discovered dependency — a
  technique the model has to be taught, not reminded of.
- This phase does not assume it will work as cleanly as accessibility
  did. If the model can't reliably produce a working `page.route()`-based
  suite even with a worked example, that's a real, recordable result —
  not a reason to lower the bar or fake a pass.

4. Performance, SEO, and database are grouped into one ticket — each gets
   its own example, but they're comparable in shape and difficulty (a
   single concrete pattern to demonstrate, using standard Playwright
   APIs the model already handles correctly elsewhere).

5. Security is a refinement, not a rebuild.
- The invalid-input check already works. Scope is fixing the specific
  HTTPS-protocol assumption (asserting `https://` against whatever
  protocol the target's base URL actually uses) and, within what
  `BEST_PRACTICE_GUIDANCE` already asks for, broadening beyond the one
  check that currently exists — not redesigning the category.

## Acceptance Criteria

1. Unawaited assertions are rejected, not just detected
- A suite with an unawaited web-first assertion returns the labelled
  template with `fallbackReason: "unawaited_assertion"`, proven against a
  fake local server the same way TFP-103/106 proved their own gates.
- The existing `invalid_output` case is unaffected — an unawaited
  assertion and an invented API are distinct, both caught.

2. Each category demonstrates genuine, category-specific coverage
- Three consecutive real generations per category against
  `testforge-qwen7b`, checked by reading the suite (not just compiling
  it) for a check that actually belongs to that category, matching
  `BEST_PRACTICE_GUIDANCE`'s own description of it.
- Reliability's bar is specifically a working `page.route()`-based (or
  equivalent) failure-simulation test, not a generic assertion — the
  actual trait that defines the category. If three consecutive attempts
  don't produce one, that's recorded as the result, not smoothed over.
- Every suite still passes `findTypeErrors` and `findUnawaitedAssertions`
  clean, and uses only the request's own data — checked against Phase
  32's leak lesson, the same way GEN-30 did.

3. `TEST_PLAN.md` and this record reflect the real per-category outcome
- Each category's entry states what it now actually checks, not "works"
  as a blanket claim — same standard GEN-28 already set.

## Regression Policy

- `TEST_PLAN.md` gets a case for the `unawaited_assertion` gate and an
  entry per category recording its fixed (or not-yet-fixed) state, in the
  same commit as the code, per standing policy.

## Related, deferred (not this phase)

- **The deterministic-vs-local comparison** (Phase 21, TFP-099 retargeted)
  stays deferred until this phase's real per-category outcome is known —
  including reliability's, since that's the category most likely to still
  need more work after this phase, not less.
- **Lighter/alternative local models** remain out of scope, per Phase 31
  Decision 2, unchanged.

## Backlog

**Ticket numbers below are estimates** — confirm the next real free number
against the actual backlog before filing (TFP-109 was Phase 32's last
issued number as of this record).

### TFP-110 — Reject suites with unawaited assertions

- **Phase:** 33
- **Priority:** P2
- **Suggested labels:** `bug`, `generate`, `local`
- **Problem it solves:** `findUnawaitedAssertions` (TFP-108) can detect
  the defect but the route doesn't act on it — a suite with a silent
  no-op assertion can still be labelled `generatedBy: "ollama"`.
- **Scope:** Call `findUnawaitedAssertions` in `generateWithOllama`
  alongside `findTypeErrors`; route a non-empty result into `fallback()`
  with a new `unawaited_assertion` reason. Regression test against a fake
  local server.
- **Deliverables:** Updated `route.ts`; regression test; `TEST_PLAN.md`
  update.
- **Acceptance criteria:** As stated in Acceptance Criteria 1 above.
- **Dependencies:** TFP-108 (the check itself) landed.

### TFP-111 — Reliability: a real dependency/storage failure-injection example

- **Phase:** 33
- **Priority:** P2
- **Suggested labels:** `enhancement`, `generate`, `local`
- **Problem it solves:** the local model produced only a title and focus
  check for "reliability" — it was never taught what the category means
  in this codebase.
- **Scope:** A worked example demonstrating `page.route()`-based (or
  equivalent) failure simulation against a placeholder dependency, built
  to Phase 32's three rules; rule text explaining what "reliability"
  means here, since it isn't standard vocabulary.
- **Deliverables:** New example/rules in `local-rules.ts` (or a
  category-specific file if that reads better once written); unit test
  checking the example itself is a real, awaited, type-checking
  `page.route()` pattern; `TEST_PLAN.md` update with the honest result.
- **Acceptance criteria:** As stated in Acceptance Criteria 2 above
  (reliability's specific bar).
- **Dependencies:** None.

### TFP-112 — Performance, SEO, and database: real category-specific examples

- **Phase:** 33
- **Priority:** P2
- **Suggested labels:** `enhancement`, `generate`, `local`
- **Problem it solves:** all three currently produce visibility-only or
  no-signal suites despite `BEST_PRACTICE_GUIDANCE` already describing
  what each should check.
- **Scope:** One worked example per category (timing assertion for
  performance; title/meta/heading checks for SEO; a create/read/update
  flow for database), built to Phase 32's three rules.
- **Deliverables:** New examples/rules; unit tests per example;
  `TEST_PLAN.md` update per category.
- **Acceptance criteria:** As stated in Acceptance Criteria 2 above.
- **Dependencies:** None.

### TFP-113 — Security: fix the protocol assumption, broaden within existing guidance

- **Phase:** 33
- **Priority:** P2
- **Suggested labels:** `bug`, `enhancement`, `generate`, `local`
- **Problem it solves:** the HTTPS check asserts a protocol the target's
  own base URL may not use; coverage beyond invalid-input handling is
  thin.
- **Scope:** Fix the protocol assumption (assert against the base URL's
  actual scheme, or make the check conditional); extend within
  `BEST_PRACTICE_GUIDANCE`'s existing security description
  (auth/session behavior, visible security errors) — not a new category
  definition.
- **Deliverables:** Updated rules/example; unit test; `TEST_PLAN.md`
  update.
- **Acceptance criteria:** As stated in Acceptance Criteria 2 above.
- **Dependencies:** None.

## Recommended Execution Order

1. TFP-110 can land any time — no dependency on the category work.
2. TFP-111 (reliability) first among the category tickets, since it's the
   highest-risk and its result may change how much confidence the phase
   has in the approach; TFP-112 and TFP-113 can follow in either order.

## Suggested Milestone Gate

### Gate A — Every category checked, the honest result recorded either way
- TFP-110 lands with a proven gate.
- TFP-111, TFP-112, TFP-113 each land with three consecutive live results
  read and recorded — a category that still falls short after this phase
  says so in `TEST_PLAN.md`, rather than the bar being lowered to close
  the gate.
