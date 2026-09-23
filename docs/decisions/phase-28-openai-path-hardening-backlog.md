# Phase 28 — Harden the OpenAI-Backed Generation Path

**Version:** 1.0
**Date:** 2026-09-23
**Status:** Draft — for review, not yet started

## Context

`TEST_PLAN.md`'s Known Limitations item 5 and `docs/decisions/product-roadmap.md`'s
Phase 21 both describe the same untested surface: when `OPENAI_API_KEY` is
set, `POST /api/generate` (`src/app/api/generate/route.ts`) calls
`gpt-4o` instead of `mockGenerate`, and that path has never run in CI —
only the template-based generator has real automated coverage.

Phase 21's own scope, as written, is bigger than a reliability fix: "given
CI coverage, and evaluated against the deterministic generator on the same
sites using Phase 17's run persistence and diffing" — i.e. bring the path
into active development, build the comparison tooling, and make a product
decision (default / opt-in / user's choice) from the result. Checked
directly against the actual route on 2026-09-23: the code-level problem
sitting underneath that untested status is smaller and more urgent than
the full evaluation Phase 21 describes.

**What's actually there right now (`src/app/api/generate/route.ts:49-66`):**
the `req.json()` parse two lines above it is already guarded
(`.catch(() => ({}))`, the same TFP-067 pattern applied to the other five
POST handlers in Phase 24) — but the `client.chat.completions.create(...)`
call immediately below has no try/catch, no timeout, and no fallback to
`mockGenerate`. A thrown error (bad key, rate limit, OpenAI outage,
network failure) is an unhandled rejection in the route handler, which
Next.js turns into a raw 500 — the exact failure shape TFP-067 fixed for
malformed request bodies, just one call deeper in the same file. There is
also no timeout, so a hung request blocks the response indefinitely. And
if the response comes back malformed (`chat.choices[0]?.message?.content`
missing), the route currently falls through to
`?? ""` and returns **200 with an empty `code` string** — silently
"successful" with nothing usable in it, worse than a clean error would be.

Emil's steer (2026-09-23): concentrate on a stable working model for
TestForge rather than opening new scope. This phase is scoped to match
that — it closes the reliability gap in the path that already exists and
already ships (anyone with an `OPENAI_API_KEY` set hits this code today),
the same class of fix as Phase 24's TFP-065/066/067. It deliberately does
**not** attempt Phase 21's CI-coverage-and-comparison work, which stays
exactly where `product-roadmap.md` already has it: a separate, larger,
not-yet-started phase, unblocked by this one but not advanced by it
either.

## Scope (this phase)

### In scope
1. Guard the OpenAI call in `src/app/api/generate/route.ts` against
   failure, timeout, and malformed responses, without changing behavior
   for the already-working no-key (`mockGenerate`) path.
2. A real regression test that forces each failure mode and asserts the
   route degrades cleanly.
3. Correct `TEST_PLAN.md`'s Known Limitations item 5 and the Feature
   Status table's "Generate" row to describe what this phase actually
   closes — not the full Phase 21 evaluation.

### Out of scope
- CI coverage that actually exercises a real OpenAI call (that requires a
  real key in CI, a cost/secrets decision Emil hasn't made — separate from
  this phase).
- Any comparison against the deterministic generator, run-persistence
  diffing, or the default/opt-in product decision — all still Phase 21,
  untouched by this ticket.
- Any change to the no-key `mockGenerate` path or its output.

## Backlog

### TFP-083 - Guard, time out, and fall back the OpenAI generation call

- **Phase:** 28
- **Priority:** P1
- **Suggested labels:** `bug`, `reliability`
- **Problem it solves:** `POST /api/generate` currently has three distinct
  failure modes once `OPENAI_API_KEY` is set, none of them handled: (1) any
  thrown error from `client.chat.completions.create(...)` — bad key, rate
  limit, network failure, OpenAI outage — reaches the client as a raw,
  unlabeled 500, the same shape TFP-067 already fixed one call earlier in
  this exact file; (2) no timeout, so a hung request never resolves,
  leaving the caller waiting indefinitely with no way to know it's stuck;
  (3) a malformed/empty completion currently returns HTTP 200 with
  `{ code: "" }` — indistinguishable from success until whatever consumes
  it tries to use an empty suite.
- **Scope:**
  - Wrap the `client.chat.completions.create(...)` call in try/catch. On
    failure, fall back to `mockGenerate(...)` with the same arguments
    already computed earlier in the handler (same pattern the route
    already uses for the no-key case — reuse it rather than adding a
    second code path), and include a header or field on the response
    (e.g. `{ code, generatedBy: "fallback" }`) so the caller can tell the
    difference. Do not silently return AI-labeled output that's actually
    the template generator's.
  - Add a timeout on the OpenAI call (e.g. `AbortSignal.timeout(30_000)`,
    or the SDK's own `timeout` option if `openai` exposes one — check
    before hand-rolling `AbortController`) long enough for a real `gpt-4o`
    response, short enough not to hang a UI indefinitely. A timeout is
    just another failure mode into the same try/catch → fallback path
    above, not a separate branch.
  - Treat an empty/missing `chat.choices[0]?.message?.content` as a
    failure, not a success — route it into the same fallback path rather
    than returning 200 with empty `code`.
  - Add a regression test in `src/app/api/generate/route.test.ts`
    (extends the existing TFP-067 file, doesn't replace it) covering: a
    forced OpenAI rejection falls back to `mockGenerate` output rather
    than 500ing; a forced timeout does the same within a bounded test
    time (mock the client, don't actually wait out a real timeout); an
    empty completion falls back rather than returning 200 with empty
    code.
  - Update `TEST_PLAN.md`: Known Limitations item 5 to state plainly that
    the path now degrades safely on failure/timeout (this phase) but is
    still not evaluated against the deterministic generator or covered in
    CI with a real key (still open, still Phase 21) — don't let the
    "untested in CI" framing imply this phase secretly finished Phase 21.
    Also correct the Feature Status table's "Generate" row note to match.
- **Deliverables:**
  - Fixed `src/app/api/generate/route.ts`.
  - Extended `src/app/api/generate/route.test.ts` with the three new
    cases above.
  - Updated `TEST_PLAN.md` (Known Limitations item 5, Feature Status
    table).
- **Acceptance criteria:**
  - A forced OpenAI failure, a forced timeout, and a forced empty
    completion each result in a 200 response carrying `mockGenerate`'s
    output (or an equivalently clean, explicit error — Code's call on
    which, but not a raw 500 and not a silent empty-string 200), proven
    by the new tests actually running and passing, not by reading the
    diff.
  - The no-key path (`mockGenerate` called directly, no OpenAI client
    involved) is unaffected — existing tests for it still pass unchanged.
  - `TEST_PLAN.md` no longer implies this phase did Phase 21's evaluation
    work.
- **Dependencies:** None.

## Recommended Execution Order

Single ticket.

## Suggested Milestone Gates

### Gate A - The existing OpenAI path fails safely
- TFP-083 lands with real tests proving all three failure modes degrade
  cleanly, and `TEST_PLAN.md` accurately separates "hardened" (this
  phase) from "evaluated as a product option" (still Phase 21, still not
  started).
