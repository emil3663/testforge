# Phase 37 Decision Record — Gap-Fill Prompt Fix and Two New Model Gates

Date: 2026-09-30
Scope: Restore the local model's category quality on the gap-fill path, and
catch two known model failures mechanically, before Phase 35 relies on the
model.
Status: Approved (Emil, 2026-09-30).

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

### TFP-129 — Gate: a Promise passed to a plain matcher

- **Phase:** 37 · **Priority:** P1 · **Labels:** `enhancement`, `generate`
- **Problem it solves:** a test that can never pass gets through both gates.
- **Scope:** Decision 2.
- **Deliverables:** New check in `validate.ts`; wired into the local path's
  gates; unit tests; `TEST_PLAN.md` case.
- **Acceptance criteria:** Acceptance Criteria 2, first and third bullets.
- **Dependencies:** None.

### TFP-130 — Gate: duplicate test bodies

- **Phase:** 37 · **Priority:** P2 · **Labels:** `enhancement`, `generate`
- **Problem it solves:** GEN-32's duplication, still open since Phase 33.
- **Scope:** Decision 3.
- **Deliverables:** New check; wired into the gates; unit tests;
  `TEST_PLAN.md` case, and GEN-32 updated.
- **Acceptance criteria:** Acceptance Criteria 2, second and third bullets.
- **Dependencies:** None.

### TFP-131 — Measure the fix

- **Phase:** 37 · **Priority:** P1 · **Labels:** `measurement`, `local`
- **Problem it solves:** the fix must be shown to work, not assumed.
- **Scope:** Decision 4.
- **Deliverables:** `benchmarks/<date>-gap-fill-fix/`; report section;
  GEN-54 update.
- **Acceptance criteria:** Acceptance Criteria 3.
- **Dependencies:** TFP-128, TFP-129, TFP-130 (so the measurement sees the
  final gates).

## Recommended Execution Order

1. TFP-128, TFP-129 and TFP-130, in any order.
2. TFP-131 last.

## Suggested Milestone Gate

### Gate A — Prompt fixed, gates added, fix measured
- TFP-128 to 131 landed and independently verified, with the Decision 4
  rule applied and its result recorded either way.
