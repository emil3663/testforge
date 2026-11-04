# Phase 37 Decision Record — Gap-Fill Prompt Fix and Two New Model Gates

Date: 2026-09-30
Scope: Restore the local model's category quality on the gap-fill path, and
catch two known model failures mechanically, before Phase 35 relies on the
model.
Status: Complete 2026-09-30. Gate A met and independently verified; TFP-128 to 131 pushed (`b684c00`, `a3c52fc`, `9a08267`, `c3eafb9`). Approved by Emil 2026-09-30.

## Context

The Phase 33 category check on C8 (`benchmarks/2026-09-30-phase33-c8/`,
TEST_PLAN GEN-54) found reliability at 1/3 and database at 1/3, where Phase
33 had 3/3. The six-call diagnostic (`d59c2cf`) showed the drop follows the
prompt, not the model. The same model, sent Phase 33's full-generation
request, gave reliability 2/3 and database 3/3.

The only difference between the two requests is one sentence the gap-fill
path appends to the user message (`src/lib/generate/messages.ts`): "Write
tests only for these coverage areas: <areas>. The other areas are already
covered by another generator - do not write tests for them." The full
request reproduces the worked examples closely, down to their test titles;
the gap-fill request drifts from them.

The hand-read check also found two failures a check can catch without
judgement:

- `reliability-3` passes both gates but can never pass: it hands a Promise
  to a plain matcher (`expect(locator.isDisabled()).toBe(true)`). The
  unawaited-assertion gate looks only for unawaited web-first assertions.
- `reliability-2` has three tests with identical bodies under three
  different titles. This is GEN-32 (Phase 33), still open.

Two failures need judgement and are not gated here: a database test that
never reloads, and a functional test asserting a guessed `/dashboard`
destination.

## Decisions

1. The gap-fill request names the gap areas as its selected areas, and the
   extra sentence is removed.
- The user message is built exactly as a full-generation request would be
  for those areas alone, so a single-area gap sends Phase 33's request.
- The model is still told nothing about areas it is not writing. The other
  areas never appear in the request.
- Rejected: rewording the sentence. Any new wording is one more thing to
  tune, and the diagnostic shows the plain request already works.

2. A new gate rejects a Promise passed to a plain matcher.
- Using the TypeScript type checker, as `findUnawaitedAssertions` does: an
  `expect(x)` whose argument type is a Promise, followed by a matcher that
  is not a web-first (auto-retrying) assertion, rejects the suite.
- `await expect(promise).resolves...` and `.rejects...` are not flagged.
- The verdict is recorded like the other gates (bar, measured, verdict,
  evidence), and a rejected suite falls back to the template.

3. A new gate rejects a suite whose tests are duplicates.
- Two or more tests in one suite whose bodies are identical after
  normalising whitespace and comments reject the suite, whatever their
  titles. This closes GEN-32's duplication half.
- Rejected: dropping the duplicates and keeping the rest. The gates detect
  and fall back; they never rewrite model output (Phase 30).
- GEN-32's naming half (titles that don't match the body) is not gated. It
  needs judgement.

4. The fix is measured the same way the drop was found.
- All seven categories, three calls each, on the gap-fill path with the new
  request, on the adopted model (`testforge-qwen7b`, `num_gpu 29`),
  `autoInspect: false`, each suite read by hand against Phase 33's bar.
- The fix is kept only if reliability and database reach at least the
  diagnostic's full-request result (reliability 2/3, database 3/3), and no
  other category drops below its 2026-09-30 C8 result.
- If it falls short, the result is recorded as it is and nothing is tuned
  in this phase.

## Acceptance Criteria

1. Prompt
- A single-area gap-fill request's messages are identical to a
  full-generation request for that area alone. A route test compares them.
- A multi-area request with one gap sends only the gap area, and no request
  contains the removed sentence.

2. Gates
- `reliability-3.spec.ts` from the 2026-09-30 run is rejected by the Promise
  gate; every suite the current gates accept from that run and from the
  Phase 36 benchmark is otherwise unaffected.
- `reliability-2.spec.ts` is rejected by the duplicate gate; tests with the
  same body but different setup are not.
- Both gates' verdicts appear in the saved run and its report.

3. Measurement
- 21 suites, read by hand, recorded in TEST_PLAN GEN-54 and the measurement
  report, with the Decision 4 rule applied.

## Regression Policy

- `TEST_PLAN.md` gets cases for the new request shape and each new gate,
  landed with their code.
- The template generator's output is unchanged; measured on fixed inputs,
  as in earlier phases.

## Related, deferred (not this phase)

- A database test that never reloads, and guessed destinations such as
  `/dashboard`: judgement calls, left to the failure-triage gate deferred in
  Phase 34 and to Phase 35's design.
- Phase 35's decision record follows this phase.

## Backlog

TFP-127 was the last issued ticket.

### TFP-128 — Gap-fill request as a plain request for the gap areas

- **Phase:** 37 · **Priority:** P1 · **Labels:** `bug`, `generate`, `local`
- **Problem it solves:** one appended sentence halves reliability and
  database quality on the gap-fill path.
- **Scope:** Decision 1.
- **Deliverables:** `messages.ts` change; route tests; `TEST_PLAN.md` case.
- **Acceptance criteria:** Acceptance Criteria 1.
- **Dependencies:** None.
- **Status:** Landed `b684c00` (TEST_PLAN GEN-55). Independently verified and pushed 2026-09-30.

#### GEN-55 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** The gap-fill request is a plain request for the gap areas (TFP-128, Phase 37 Decision 1; route: `src/app/api/generate/route.local.test.ts` "Phase 37: a single-area gap-fill request is exactly the full-generation request for that area", "Option B: the local model is asked only for the gap areas, with only their guides")

**Expected result:** Phase 34's gap-fill request appended "Write tests only for these coverage areas: <areas>. The other areas are already covered by another generator - do not write tests for them." On the same C8 model that one sentence took reliability and database from 3/3 to 1/3 (GEN-54's diagnostic). `buildGapFillMessages` now returns exactly `buildGenerationMessages` for the gap areas: the areas are the selected coverage, and the sentence is gone. Areas the template covered still never appear in the request. **Route test:** the same request sent through the OpenAI path (full generation) and through the gap-fill path gives an identical user message, and system messages that differ only by the local rules, as they always have; it fails on the previous code. A multi-area request with one gap names only that area and contains no part of the sentence. **Measured:** for all 10 single areas and two multi-area gaps, the gap-fill messages are now identical to the full-generation ones, and before the change each differed only by that sentence; system messages unchanged. Template output: 264/264 fixed inputs byte-identical. Whether this restores quality is measured separately (TFP-131, GEN-54).

### TFP-129 — Gate: a Promise passed to a plain matcher

- **Phase:** 37 · **Priority:** P1 · **Labels:** `enhancement`, `generate`
- **Problem it solves:** a test that can never pass gets through both gates.
- **Scope:** Decision 2.
- **Deliverables:** New check in `validate.ts`; wired into the local path's
  gates; unit tests; `TEST_PLAN.md` case.
- **Acceptance criteria:** Acceptance Criteria 2, first and third bullets.
- **Dependencies:** None.
- **Status:** Landed `a3c52fc` (TEST_PLAN GEN-56). Rejects only reliability-3 among the 210 suites on disk the earlier gates keep. Independently verified and pushed 2026-09-30.

#### GEN-56 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** Gate: a Promise handed to a plain matcher is rejected (TFP-129, Phase 37 Decision 2; unit: `src/lib/generate/validate.test.ts` [findPromisesToPlainMatchers]; route: `route.local.test.ts` "Phase 37: a Promise handed to a plain matcher …"; report: `src/lib/report/empty-areas.test.ts` "Phase 37: a promise_to_plain_matcher rejection …")

**Expected result:** `expect(locator.isDisabled()).toBe(true)` compares the Promise object, not the value it resolves to, so the test can never pass (with `toBeTruthy` it can never fail). It type-checks and is awaited, so neither earlier gate saw it: GEN-54's reliability-3 passed both. `findPromisesToPlainMatchers` uses the type checker, as `findUnawaitedAssertions` does: an `expect(x)` whose argument is thenable, followed by a matcher that returns no promise, is flagged, through `.not`, `expect.soft` and whether awaited or not. Web-first matchers return a promise and are never flagged, nor are `.resolves` / `.rejects`, `expect(await …)` or `expect.poll`. It runs after the await gate; a hit returns the template with `fallbackReason: "promise_to_plain_matcher"` and a `promise to plain matcher` gate verdict (bar, measured, verdict, and the offending lines as evidence), and fails closed. The verdict is saved with the run and shown in the HTML report, and the empty area names the reason. `docs/LOCAL_MODEL_SETUP.md` lists the new reason. **Measured:** reliability-3 is rejected on all 9 `isDisabled()` lines. Of the 219 model suites on disk (the Phase 36 benchmark and both 2026-09-30 runs), 210 pass the earlier gates, and the new gate rejects only reliability-3 among them. The template generator's suites are clean for every area, and its output is 264/264 byte-identical.

### TFP-130 — Gate: duplicate test bodies

- **Phase:** 37 · **Priority:** P2 · **Labels:** `enhancement`, `generate`
- **Problem it solves:** GEN-32's duplication, still open since Phase 33.
- **Scope:** Decision 3.
- **Deliverables:** New check; wired into the gates; unit tests;
  `TEST_PLAN.md` case, and GEN-32 updated.
- **Acceptance criteria:** Acceptance Criteria 2, second and third bullets.
- **Dependencies:** None.
- **Status:** Landed `9a08267` (TEST_PLAN GEN-57, GEN-32 updated). Rejects only reliability-2 among the same 210. Independently verified and pushed 2026-09-30.

#### GEN-57 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** Gate: tests that repeat one body are rejected (TFP-130, Phase 37 Decision 3; closes GEN-32's duplication half; unit: `src/lib/generate/validate.test.ts` [findDuplicateTests]; route: `route.local.test.ts` "Phase 37: tests repeating one body under different titles …")

**Expected result:** GEN-54's reliability-2 had three tests with one body under titles naming three different fields, so it claimed three checks and made one. `findDuplicateTests` compares each test's body as a token sequence (TypeScript's scanner, whitespace and comments skipped, so layout never makes two bodies differ), together with the setup that applies to it: `test.use`, `beforeEach` and `beforeAll` in the enclosing blocks. Titles play no part. Two or more tests with the same body and setup reject the suite as `duplicate_tests`, with a `duplicate tests` gate verdict whose evidence names the lines and titles; it fails closed. Rejected, not trimmed: the gates detect and fall back, never rewrite (Phase 30). The same body under a different `test.use` viewport or a `beforeEach` that blocks the API is not a duplicate. **Measured:** reliability-2 is rejected ("lines 4, 14, 24: 3 tests share one body"); the diagnostic's full-request reliability suites, with three different failures, are clean. Of the 219 model suites on disk, 210 pass the earlier gates, and this gate rejects only reliability-2 among them. Template output 264/264 byte-identical. The verdict is saved and reported the same way as GEN-56's.

### TFP-131 — Measure the fix

- **Phase:** 37 · **Priority:** P1 · **Labels:** `measurement`, `local`
- **Problem it solves:** the fix must be shown to work, not assumed.
- **Scope:** Decision 4.
- **Deliverables:** `benchmarks/<date>-gap-fill-fix/`; report section;
  GEN-54 update.
- **Acceptance criteria:** Acceptance Criteria 3.
- **Dependencies:** TFP-128, TFP-129, TFP-130 (so the measurement sees the
- **Status:** Run 2026-09-30 (`benchmarks/2026-09-30-gap-fill-fix/`, GEN-54, measurement report "After the fix"). Reliability 2/3, database 3/3, performance, SEO, security and accessibility 3/3, functional 0/3 clean. Decision 4 rule met: the fix is kept. Reliability's second suite has misleading titles, and accessibility now checks labels and focus instead of roles and names; both recorded. Independently verified and pushed 2026-09-30.
  final gates).

#### GEN-54 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** Phase 33's category bar on C8, the adopted local model (Phase 36; live, 2026-09-30; evidence: `benchmarks/2026-09-30-phase33-c8/`; report: `docs/decisions/phase-36-local-model-measurement-report.md`)

**Expected result:** The rebuilt `testforge-qwen7b` (`num_gpu 29`, 100% GPU, context 16384). Three consecutive generations per category through the production gap-fill call for that one area (`buildGapFillMessages` + `generateLocalSuite`, the route's own gates), with Phase 33's wordings and no page data. Each suite was read by hand; each accepted one also passed a standalone strict `tsc`; none contains example data. **Performance ✅ 3/3** (load, first byte, DOM ready against the example's budgets). **SEO ✅ 3/3** (title, meta description, one `h1`, every suite). **Security ✅ 3/3** (HTTPS behind the positive skip, invalid input, script dialog; all three checks every time). **Accessibility ✅ 3/3** (role and accessible name per control; no focus check, which the Phase 31/33 suites had). **Reliability ❌ 1/3:** one rejected at the type-check gate; one real `'**/api/**'` abort with a survival check, but three identical tests under titles naming "disabled" fields and one failure kind of three; one passes the gates but can never pass (`expect(locator.isDisabled()).toBe(true)` compares a Promise) and expects fields to be disabled. Phase 33 had 3/3 with the trait. **Database ❌ 1/3:** one genuine save-reload-check; one never reloads; one asserts the form keeps its typed values after a reload and waits for an invented thank-you text. Phase 33 had 3/3. **Functional ⚠️ 0/3 clean:** all three fill and submit, and all three assert a guessed `/dashboard` destination, as the one Phase 33 functional suite also did. **Caveats:** at temperature 0.2 the three suites are near-identical in four categories, so 3/3 there is one answer three times. Two things changed since Phase 33, the model settings (C8) and the prompt (Phase 34's gap-fill messages; the local rules are unchanged). With page data the template writes reliability, and database where a form fits, itself, so the model covers those areas only when the template wrote nothing. **Diagnostic (owner decision, 2026-09-30): the drop follows the prompt, not the model.** Reliability and database again, 3 calls each on the same C8 model, with Phase 33's full-generation request (`buildGenerationMessages`, unchanged inputs since `4215d82`). Measured: its system message is identical to the gap-fill run's, and the gap-fill user message is it plus one sentence ("Write tests only for these coverage areas: <area>. The other areas are already covered by another generator - do not write tests for them."). **Reliability ✅ 2/3** (two identical genuine suites covering API, third-party and `localStorage` failures under accurate titles; one rejected at the type check with the same invented "disabled field" tests), against 1/3 with gap-fill. **Database ✅ 3/3** genuine save-reload-check, against 1/3. Three calls per cell at temperature 0.2: the direction is clear, the size is not. No prompt or rule was changed. Evidence: `*-full-*` files beside the first run. **After the fix (Phase 37, TFP-131, 2026-09-30; evidence: `benchmarks/2026-09-30-gap-fill-fix/`):** the gap-fill request made a plain request for the gap areas (GEN-55) and the two new gates in place (GEN-56, GEN-57); same model, wordings and method, 21 suites read by hand. **Reliability ✅ 2/3** (one worked-example suite with all three failures under accurate titles; one aborting `'**/api/**'` in every test with two misleading titles; one rejected by the new Promise gate, which also routed invented element URLs). **Database ✅ 3/3.** Performance, SEO, security ✅ 3/3 as before. **Accessibility ✅ 3/3, but now label and focus checks instead of role and name.** Functional ⚠️ 0/3 clean as before (guessed `/dashboard`). **Decision 4 rule applied as written: the fix is kept** - reliability and database reach the diagnostic's 2/3 and 3/3, and no other category is below its earlier C8 result. Counted by the diagnostic's quality (accurate titles), reliability is 1/3.

## Recommended Execution Order

1. TFP-128, TFP-129 and TFP-130, in any order.
2. TFP-131 last.

## Suggested Milestone Gate

### Gate A — Prompt fixed, gates added, fix measured
**Verified independently and pushed 2026-09-30** (`b684c00`, `a3c52fc`, `9a08267`, `c3eafb9`): route, gate and report tests pass; template output unchanged with and without page data; reliability-3 rejected by the Promise gate, reliability-1 correctly not a duplicate. The Decision 4 rule keeps the fix. Phase 37 is complete.
- TFP-128 to 131 landed and independently verified, with the Decision 4
  rule applied and its result recorded either way.
