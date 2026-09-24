# Phase 32 Decision Record — Await-Correctness Fix + Example-Leak Diagnostic

Date: 2026-09-24
Scope: Two small, independent follow-ups from Phase 31's per-category
baseline (GEN-28), both sequenced ahead of the broader thin-category
tuning work: fix the missing-`await` defect found in the generated
security suite (and check whether it recurs elsewhere), and test whether
the worked example's concrete URL leaked into 9 of 10 baseline suites.
Status: Implemented; Gate A met 2026-09-24 (TFP-108, TFP-109 landed; see
"Implementation status" at the end)

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

## Implementation status (2026-09-24)

TFP-108 landed in `190ffdf` and TFP-109 in `d5ab750`. All live runs were
against `testforge-qwen7b` on Emil's machine, through a production build,
with TFP-103's type check and a standalone strict `tsc` on every suite.

**TFP-108: Acceptance Criterion 1 met.**

- The shared block of `LOCAL_MODEL_RULES` requires `await` on every
  `expect(...)`, and a test asserts the rule sits in that block.
- The mechanical check is `findUnawaitedAssertions` in `validate.ts`. It
  walks the AST, and the type checker separates a silent no-op (the
  matcher returns a promise) from an unawaited synchronous `toBe`, which
  still runs. A test asserts the worked example is clean.
- **Audit result: isolated.** The audit ran over all 18 live suites kept
  from Phases 30-31, a superset of the other 9 GEN-28 suites. The security
  sample was the only silent no-op. Performance had two unawaited
  synchronous `toBe` calls, which break the rule but still check. The
  other 16 are clean, and so are all 9 suites generated in this phase.

**TFP-109: Acceptance Criterion 2 met. The leak is confirmed, and the
placeholder removes it.**

This departs from the record's method on purpose. The record asked for
the GEN-27 wording, but that wording never leaked, even with `/login` in
the example (Phase 31's three GEN-27 runs all used the base URL), so it
could not settle the question. The diagnostic instead used the GEN-28
accessibility wording that had leaked, as a controlled pair with only
the example's URL changed:

| Example URL | Suites navigating to `/login` | To the request's base URL | To the placeholder |
| --- | --- | --- | --- |
| `http://localhost:3000/login` (control) | 3/3 | 0/3 | n/a |
| `https://example.invalid/EXAMPLE-ONLY` | 0/3 | 3/3 | 0/3 |

The record's literal bar was also run: three consecutive GEN-27-wording
requests with the placeholder, all `generatedBy: "ollama"`, all on the
base URL.

**The bigger finding Decision 2 anticipated is half true.** The model
does not copy the example's *content* blindly: it replaced the URL
correctly and never copied the placeholder. But it does copy the
example's *structure*. With the GEN-28 wording, all 6 suites reused the
example's test names word for word, extended its pattern to the password
field, and added a near-tautological `getByRole('main')` →
`toHaveRole('main')` check. The GEN-27 wording produced the model's own
test names.

**Implications for Phase 33** (category examples):

1. Put only placeholder data in examples (`example.invalid` URLs,
   obviously generic names), since data that looks real gets copied.
2. Treat an example as a template the model will fill in, not an
   illustration. Its test names and shape will be reused, so each example
   should show exactly the tests we'd want, in the form we'd want them.
3. Measure with the wording that exposes copying (the GEN-28 style), not
   only free-form requests.

**Gate A is met:** the await rule, its mechanical test and the audit are
recorded, and the leak question is settled by a controlled live
comparison.

Left open deliberately: the route does not reject or repair unawaited
assertions. The detector now makes that a few lines of code. Whether to
reject, repair or keep rule-only is Emil's call, and could sit naturally
in Phase 33.
