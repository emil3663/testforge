# Phase 32 Decision Record — Await-Correctness Fix + Example-Leak Diagnostic

Date: 2026-09-24
Scope: Two small, independent follow-ups from Phase 31's per-category
baseline (GEN-28), both sequenced ahead of the broader thin-category
tuning work: fix the missing-`await` defect found in the generated
security suite (and check whether it recurs elsewhere), and test whether
the worked example's concrete URL leaked into 9 of 10 baseline suites.
Status: Approved and in implementation (TFP-108 and TFP-109 both
unblocked, no dependency between them)

## Context

Phase 31's baseline (GEN-28, `docs/decisions/phase-31-local-model-tuning-decision-record.md`)
found two things worth acting on before the bigger thin-category tuning
phase starts:

- The security suite's HTTPS check was `expect(page).toHaveURL('https://…'))`
  with no `await` — meaning the assertion never actually runs. That's a
  different, worse class of problem than a thin category: an unawaited
  `expect()` silently reports nothing rather than failing loudly, so a
  test built on it would look like coverage while checking nothing. Only
  one sample surfaced this (by reading the generated file, not by
  automated detection), so whether it's a one-off or a pattern across the
  other 9 baseline suites is genuinely unknown.
- 9 of the 10 baseline suites navigated to `/login` — the exact path used
  in `local-rules.ts`'s `ACCESSIBILITY_EXAMPLE` — even though none of the
  survey's requests mentioned that path. Code flagged this as likely but
  not proven, since the survey's request wording also varied across
  categories.

Emil's own sequencing decision (2026-09-24): settle the URL-leak question
before the bigger thin-category tuning phase, and fix the await defect
now, separately, rather than folding it into that later work — an
unawaited assertion is an active defect, not just weak coverage.

**Standing policy for this phase:** same as every phase since 18 — a
defect found while building or verifying a ticket is fixed in that
ticket, not deferred; `TEST_PLAN.md` updates land in the same commit as
the code.

## Decisions

1. The missing-`await` defect gets a general rule and a fix, ahead of and
   separate from the broader category-tuning phase.
- A new rule in `LOCAL_MODEL_RULES` (not a category-specific file, since
  an unawaited assertion isn't accessibility- or security-specific):
  every `expect(...)` call must be awaited.
- The other 9 GEN-28 baseline suites are read for the same mistake before
  assuming it was isolated to the one security sample that was already
  checked closely — one occurrence found while reading one file is not
  proof it's the only one.

2. The worked example's URL is neutralized and re-verified against a real
   Ollama, to test the leak hypothesis directly rather than infer it.
- `ACCESSIBILITY_EXAMPLE` in `local-rules.ts` stops using
  `http://localhost:3000/login` and uses something that would be obviously
  wrong to copy verbatim into an unrelated request's suite.
- Re-run the same 3-consecutive-accessibility-request check Phase 31 used
  for GEN-27 (not a full 10-category re-survey — that stays Decision 3,
  below) and check whether the new suites navigate to the request's own
  target instead of the example's former path.
- This is a diagnostic, not a guaranteed fix. If the leak persists even
  with an unmistakable placeholder, that's a bigger finding than a stray
  URL — it would mean the model copies example structure regardless of
  content, which changes how the next phase's category-specific examples
  should be written. Either outcome gets recorded, not just a pass.

3. Broader thin-category tuning (performance, SEO, database, reliability,
   and security's remaining coverage gap beyond the await bug) stays out
   of this phase.
- Sequenced explicitly after this phase's diagnostic result, per Emil's
  own ordering — building that phase's rules and examples before knowing
  whether the model copies examples verbatim would risk repeating the
  same leak five more times.

## Acceptance Criteria

1. Await correctness
- `LOCAL_MODEL_RULES` states, in the shared (not category-specific) rule
  block, that every `expect(...)` call must be awaited.
- `local-rules.test.ts` mechanically checks that `ACCESSIBILITY_EXAMPLE`
  (and any other example added here) awaits every `expect(...)` call —
  not just eyeballed once.
- The other 9 GEN-28 baseline suites are checked for the same
  missing-`await` pattern; the result (found elsewhere, or isolated to
  the one security sample) is recorded either way.

2. Leak diagnostic
- `ACCESSIBILITY_EXAMPLE`'s URL is replaced with an unmistakable
  placeholder.
- Three consecutive live accessibility requests against `testforge-qwen7b`
  (matching GEN-27's own bar) are checked for whether they still reuse the
  example's former path/structure or correctly target the request's own
  page.
- The result — leak confirmed, leak gone, or inconclusive — is recorded in
  `TEST_PLAN.md` and this record's Implementation status, not just
  whichever outcome looks better.

## Regression Policy

- `TEST_PLAN.md` gets a case for the await rule and an update to GEN-27's
  entry (or a new GEN case) recording the leak-diagnostic result, in the
  same commit as the code, per standing policy.

## Related, deferred (not this phase)

- **Broader thin-category tuning** (performance, SEO, database,
  reliability, and security's non-await coverage gap) is Phase 33
  (tentative number) — picked up once this phase's leak diagnostic result
  is known, so that phase's examples are built with the right lesson
  already learned.
- **The deterministic-vs-local comparison** stays exactly where Phase 31
  left it: connected to Phase 21, deferred until the local path has had a
  fair pass at the thin categories, so the comparison measures the
  model's ceiling rather than its current rough edges.

## Backlog

**Ticket numbers below are estimates** — confirm the next real free number
against the actual backlog before filing (TFP-107 was Phase 31's last
issued number as of this record).

### TFP-108 — Add an await-correctness rule and audit the baseline suites for the same defect

- **Phase:** 32
- **Priority:** P2
- **Suggested labels:** `bug`, `generate`, `local`
- **Problem it solves:** the security suite in Phase 31's baseline had an
  unawaited `expect()` — an assertion that silently never runs, which
  looks like coverage while checking nothing. Not category-specific, so
  it could be present in any locally-generated suite, not just security's.
- **Scope:** Add a shared "always await `expect()`" rule to
  `LOCAL_MODEL_RULES`; read the other 9 GEN-28 baseline suites (kept from
  Phase 31, or regenerated if not retained) for the same pattern; record
  findings even if none are found elsewhere.
- **Deliverables:** Updated `local-rules.ts`; updated
  `local-rules.test.ts` with a mechanical await check; `TEST_PLAN.md`
  update recording the audit's result.
- **Acceptance criteria:** As stated in Acceptance Criteria 1 above.
- **Dependencies:** None.

### TFP-109 — Neutralize the worked example's URL and re-verify against a real Ollama

- **Phase:** 32
- **Priority:** P2
- **Suggested labels:** `test`, `generate`, `local`
- **Problem it solves:** 9 of 10 Phase 31 baseline suites navigated to the
  worked example's exact path, suggesting the model may be copying the
  example rather than generalizing from the request — unproven, and worth
  knowing before the next phase writes five more category examples.
- **Scope:** Replace `ACCESSIBILITY_EXAMPLE`'s URL with an unmistakable
  placeholder; re-run 3 consecutive live accessibility requests against
  `testforge-qwen7b` and check whether the leak persists.
- **Deliverables:** Updated `local-rules.ts`; `TEST_PLAN.md` and this
  record's Implementation status updated with the actual result.
- **Acceptance criteria:** As stated in Acceptance Criteria 2 above.
- **Dependencies:** None.

## Recommended Execution Order

1. TFP-108 and TFP-109 can land in either order or together — no
   dependency between them.
2. Both precede Phase 33 (broader thin-category tuning), per Emil's own
   sequencing.

## Suggested Milestone Gate

### Gate A — Await defect fixed and audited, leak question settled
- TFP-108 lands with the shared rule, a mechanical test for it, and a
  recorded audit of the other 9 baseline suites.
- TFP-109 lands with a neutralized example and a recorded, real result —
  leak confirmed or gone — from re-running the live check.
