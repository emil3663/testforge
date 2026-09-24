# Phase 31 Decision Record — Local Model Tuning (Rules Fix + Baseline)

Date: 2026-09-24
Scope: Fix the local (Ollama) generation path's diagnosed accessibility-matcher
defect through a local-only prompt/rules layer, and establish a real baseline
across every best-practice category — without touching the OpenAI path.
Status: Approved and in implementation (TFP-106 unblocked; TFP-107 sequenced
behind it)

## Context

Phase 30 built the local generation path and closed Gate A with a
type-check-then-fallback safety net (TFP-103's `findTypeErrors`): a suite
that doesn't compile against `@playwright/test` is never labelled model
output. That gate is a safety net, not a fix — it makes the failure safe,
not less frequent. Phase 30 explicitly deferred two follow-ups for later:
trying lighter/alternative local models, and further tuning for speed or
accuracy. This phase picks up the accuracy half, at Emil's request
("let's do the tuning first").

Real evidence already collected, not assumed:

- Three separate live accessibility-worded requests against
  `testforge-qwen7b` all produced `expect(locator).toBeAccessible()`, which
  is not a real Playwright matcher. All three were caught by TFP-103's
  validator and returned as the labelled template
  (`fallbackReason: "invalid_output"`).
- One live functional-worded request in the same session passed cleanly —
  `generatedBy: "ollama"`, fence-free, and it also passes a standalone
  strict `tsc`.
- No other best-practice category (responsive, performance, security,
  usability, SEO, cookie, database) has been tested live yet. Whether
  accessibility is the only category with this problem, or one of several,
  is genuinely unknown — three accessibility samples and one functional
  sample is not a survey.

Emil's own framing across this session ("give it rules or update skills for
it", "if we can get all the skills and rules into the local model") points
at prompt/rules-level tuning as the mechanism — not fine-tuning the model
itself or a retrieval layer. That's the working approach for this phase:
teach the model, through what it's told at request time, to use real
Playwright APIs instead of inventing them.

**Standing policy for this phase:** same as every phase since 18 — a
defect found while building or verifying a ticket is fixed in that ticket,
not deferred; `TEST_PLAN.md` updates land in the same commit as the code.

## Decisions

1. Tuning happens through a local-only rules layer, not the shared
   `SYSTEM_PROMPT`.
- Additional guidance — naming the real Playwright accessibility
  assertions available (e.g. `toHaveRole`, `toHaveAccessibleName` on a
  locator) — is appended only when generating through the Ollama path.
- `src/lib/generate/prompt.ts`'s `SYSTEM_PROMPT` and
  `BEST_PRACTICE_GUIDANCE` are not edited by this phase. Phase 28's
  already-hardened, already-tested OpenAI prompt stays exactly as it is —
  a defect specific to one local model is not a reason to touch a path
  that isn't even funded right now.

2. This phase stays scoped to `qwen2.5-coder:7b`; lighter or alternative
   models are not revisited here.
- `qwen2.5-coder:3b` and any other candidate remain explicitly out of
  scope, per Phase 30's own deferral. 7b has one known defect class
  (invented accessibility APIs); 3b had worse ones (a hallucinated API
  *and* duplicate-named tests) in the original spike, before any rules
  layer existed — reopening it is a separate follow-up once 7b's accuracy
  is established, not this phase's job.

3. The fix targets the diagnosed accessibility-matcher defect specifically,
   verified against a real baseline across every best-practice category.
- The rules layer's job is narrow: stop the model inventing
  `toBeAccessible()`-style APIs and use a real Playwright assertion
  instead.
- Acceptance requires generating one real sample per best-practice
  category (functional, responsive, performance, security, accessibility,
  usability, SEO, cookie, database) against the real local model, through
  TFP-103's validator, to find out whether accessibility is the only
  affected category or one of several — cheap to do now that the
  validator exists, and this phase is the right time to find out rather
  than guess.

4. Success is measured against repeated real Ollama runs, not a single
   passing sample.
- Three consecutive real accessibility-worded requests against
  `testforge-qwen7b` (matching the sample size that already established
  the defect) must return `generatedBy: "ollama"`, not
  `fallbackReason: "invalid_output"`, after the rules layer lands. One
  lucky pass doesn't count as fixed.

## Acceptance Criteria

1. Accessibility requests generate real code, not the fallback template
- Three consecutive real accessibility-worded requests against a running
  Ollama with `testforge-qwen7b` return `generatedBy: "ollama"`.
- Each returned suite passes both TFP-103's `findTypeErrors` and a
  standalone strict `tsc` check — the same standard Phase 30 used for
  GEN-21.

2. No category regresses, and the baseline is known
- One real generation per best-practice category, run against the real
  local model and checked with the validator, with pass/fail recorded per
  category in `TEST_PLAN.md` — a documented baseline, not a guess.
- The functional-request result Phase 30 already proved (GEN-21) still
  passes after the rules layer is added.

3. The OpenAI path is provably unaffected
- `git diff` on `src/lib/generate/prompt.ts` between this phase's start
  and end is empty — the rules layer lives in its own file, referenced
  only from `generateWithOllama`.
- TFP-083's existing OpenAI-path tests still pass unchanged.

## Regression Policy

- `TEST_PLAN.md` gets a new case (or amends GEN-21/26) recording the fixed
  accessibility behavior and the per-category baseline, in the same commit
  as the code, per standing policy.

## Related, deferred (not this phase)

- **The deterministic-vs-local comparison Emil wants to see** stays
  connected to Phase 21, but Phase 21's `TFP-099` is currently scoped and
  blocked on `TFP-098`'s funded-OpenAI requirement. Running that
  comparison against the local path instead of OpenAI doesn't have that
  money blocker — but it means rescoping `TFP-098`/`TFP-099` (or opening a
  new ticket under Phase 21 or a new phase) to target `testforge-qwen7b`
  rather than OpenAI's candidate list. That's a real decision, not assumed
  here, and it's better made once this phase gives the local path a known,
  stable baseline — so the comparison measures the model at its best, not
  against a defect this phase is about to fix.
- Lighter/alternative local models (Decision 2) and any exposure/product
  decision about the local path (Phase 21's own boundary) remain out of
  scope here.

## Backlog

**Ticket numbers below are estimates** — confirm the next real free number
against the actual backlog before filing (TFP-105 was Phase 30's last
issued number as of this record).

### TFP-106 — Add a local-only rules layer fixing the accessibility-matcher defect

- **Phase:** 31
- **Priority:** P2
- **Suggested labels:** `enhancement`, `generate`, `local`
- **Problem it solves:** `testforge-qwen7b` invents
  `expect(locator).toBeAccessible()`, a Playwright API that doesn't exist,
  on every accessibility-worded request tested so far. TFP-103's validator
  catches it safely, but every such request currently falls back to the
  template instead of generating real coverage.
- **Scope:** A local-only rules addition (e.g. a new constant/file
  referenced only from `generateWithOllama`'s message construction) naming
  the real Playwright accessibility assertions available. Does not touch
  `src/lib/generate/prompt.ts`'s shared `SYSTEM_PROMPT` or
  `BEST_PRACTICE_GUIDANCE`. Regression test: force an accessibility-worded
  prompt against a fake local server and assert the rules text is actually
  included in the outgoing request (a unit test can't force real model
  behavior, but it can prove the rules are wired in).
- **Deliverables:** New rules file/constant; wiring in
  `src/app/api/generate/route.ts`; regression test; `TEST_PLAN.md` update.
- **Acceptance criteria:** As stated in Acceptance Criteria 1 and 3 above.
- **Dependencies:** TFP-103 (validator) landed.

### TFP-107 — Baseline per-category defect survey against the real local model

- **Phase:** 31
- **Priority:** P2
- **Suggested labels:** `test`, `generate`, `local`
- **Problem it solves:** only one functional and three accessibility live
  samples exist against the real local model. Whether other best-practice
  categories have hidden invented-API defects is genuinely unknown.
- **Scope:** Generate one real suite per best-practice category
  (functional, responsive, performance, security, accessibility,
  usability, SEO, cookie, database) against `testforge-qwen7b` through a
  running Ollama, run each through TFP-103's validator, record pass/fail
  per category.
- **Deliverables:** `TEST_PLAN.md` baseline entry; this record's
  Implementation status section updated with the actual per-category
  results.
- **Acceptance criteria:** As stated in Acceptance Criteria 2 above.
- **Dependencies:** TFP-106 landed (so accessibility is tested post-fix,
  not pre-fix).

## Recommended Execution Order

1. TFP-106 → TFP-107.

## Suggested Milestone Gate

### Gate A — Accessibility fixed, baseline known, OpenAI path untouched
- TFP-106 lands with three consecutive real accessibility passes against
  `testforge-qwen7b`, TFP-107's per-category baseline is recorded in
  `TEST_PLAN.md`, and `src/lib/generate/prompt.ts` shows no diff from
  where Phase 28 left it.
