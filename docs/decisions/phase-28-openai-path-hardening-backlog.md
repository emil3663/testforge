# Phase 28 — Harden the OpenAI-Backed Generation Path

**Version:** 1.0
**Date:** 2026-09-23
**Status:** TFP-083 landed (`8308b0b`); Gate A open — the live catalog check passed, but no live completion has succeeded yet (see "Live-check result" below)

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

**Added 2026-09-23, from a narrow `sre-code` trial (`skills/proposed/`):**
run read-only against this same file per the skill's own "language is
code" section, on Emil's steer to try a cheap trial rather than promote
the set wholesale. One more real, concrete finding, same shape as the
three above: `route.ts:52` calls `model: "gpt-4o"` — a floating alias, not
a pinned snapshot (e.g. `gpt-4o-2024-08-06`). OpenAI can move what
`gpt-4o` resolves to with no diff anywhere in this repo, which is exactly
the "build is not hermetic" failure `sre-code` names — generated-suite
quality could drift silently, with nothing to bisect against. Folded into
this ticket rather than filed separately since it's the same file, same
call, same fix motion.

**Added 2026-09-24, from a Cowork research pass (not a repo read — this
needed live/current information, not code):** a second, more urgent
finding on the exact same call. Checking OpenAI's own current pricing and
deprecation pages, `gpt-4o` no longer appears in the current pricing table
at all, and multiple sources (OpenAI's own retirement announcements,
third-party coverage) describe GPT-4o API access being wound down through
2026. The exact retirement date and the specific recommended replacement
model string were inconsistent across every source checked — this space
is moving too fast for a web search alone to be the source of truth — so
this finding does **not** hand down a replacement model string to
hardcode. What it does establish: pinning `gpt-4o` to a dated snapshot (as
originally scoped below) may be pinning something that no longer resolves
at all. **The first concrete step of TFP-083, before any pinning decision,
is a live check against the real OpenAI API** (a models-list call, or one
minimal real request with a real key) to find out what `gpt-4o` currently
does and what the actual available model catalog looks like today — not
another round of public-doc research.

## Scope (this phase)

### In scope
0. **Live-check the real OpenAI model catalog, then define a short
   ordered candidate list from it** — a models-list call (or one minimal
   real request) with a real key, to see what's actually callable today.
   Don't assume any specific model name going in — 2026-09-24 research
   found today's names unreliable to guess from public docs alone (see
   the note above). From the real live output, define 2-3 candidates in
   an explicit, version-controlled config, ordered cheapest-adequate tier
   first with a known-working fallback second — not a single hardcoded
   string, and not name-pattern matching (e.g. "anything with 'mini' in
   it"), which breaks silently on the next OpenAI rename, the exact
   failure this whole finding is about. Check the live catalog against
   the candidate list and pick the first one actually present; record
   which one was picked. Added 2026-09-24 (Cowork, at Emil's request) —
   Phase 21's TFP-099 later scores every candidate in this list against
   real comparison data and can reorder/prune it; this phase only needs
   the mechanism and a reasonable starting list.
1. Guard the OpenAI call in `src/app/api/generate/route.ts` against
   failure, timeout, and malformed responses, without changing behavior
   for the already-working no-key (`mockGenerate`) path.
2. A real regression test that forces each failure mode and asserts the
   route degrades cleanly.
3. Correct `TEST_PLAN.md`'s Known Limitations item 5 and the Feature
   Status table's "Generate" row to describe what this phase actually
   closes — not the full Phase 21 evaluation.

### Out of scope
- **Scoring which candidate is actually best** for this kind of work.
  This phase builds the mechanism (an ordered candidate list, live-checked,
  first-match-wins) and a reasonable initial list — it does not run
  Phase 21's four-dimension comparison (coverage delta, pass/fail
  agreement, defect-detection difference, cost & latency) to prove one
  candidate beats another. That's TFP-099, extended to score every
  candidate in this list, not a single AI path — see
  `phase-21-ai-assisted-generation-decision-record.md`. This phase's job
  is a working call on *some* real, currently-resolving model with a
  visible, reviewable list; Phase 21 reorders or prunes that list from
  real data without touching this phase's guard/timeout/fallback logic.
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
  - **Live-check the real OpenAI model catalog and define a short ordered
    candidate list from it** (2026-09-24 research found `gpt-4o` missing
    from OpenAI's current public pricing table and described as being
    retired through 2026 across multiple sources, with inconsistent exact
    dates/replacement names across them — not reliable enough to hardcode
    from). A models-list call or one real minimal request with a real key
    settles what's actually callable in seconds, where more web research
    won't. Build the candidate list from that real output — 2-3 entries,
    cheapest-adequate tier first, a known-working fallback second — not a
    single guessed string and not name-pattern matching, which breaks
    silently on the next rename. Put the list in an explicit,
    version-controlled config (e.g. `src/lib/generate/models.ts`), not
    env vars or inline in the route, so it's a visible artifact Phase
    21's TFP-099 can later read and reorder. At request time, pick the
    first candidate present in the live catalog instead of the floating
    `gpt-4o` alias, and record the resolved model string alongside the
    response (fits naturally next to the `generatedBy` field above) so a
    future output can be traced back to what actually produced it.
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
  - New candidate-model-list config (e.g. `src/lib/generate/models.ts`).
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
  - The OpenAI call uses a model string chosen from an explicit,
    version-controlled candidate list — not a single guessed snapshot
    name, not name-pattern matching — where the chosen candidate is
    confirmed live against the real OpenAI API to actually resolve today,
    and the response records which model string produced it.
  - `TEST_PLAN.md` no longer implies this phase did Phase 21's evaluation
    work.
- **Dependencies:** None.

## Recommended Execution Order

Single ticket.

## Suggested Milestone Gates

### Gate A - The existing OpenAI path fails safely
- TFP-083 lands with real tests proving all three failure modes degrade
  cleanly, a real live-check confirms a working model from an explicit
  candidate-list config (not a guessed string), and `TEST_PLAN.md`
  accurately separates "hardened" (this phase) from "evaluated as a
  product option" (still Phase 21, now unblocked and ready to start).

## Live-check result (2026-09-24)

`npm run check:openai-models`, run with a real key from `.env.local`:

- **Catalog:** 126 models listed. All three candidates in
  `src/lib/generate/models.ts` are exact entries: `gpt-4.1-mini`,
  `gpt-4o-mini`, `gpt-4o`. The order is kept; the route picks
  `gpt-4.1-mini`. (`gpt-4o` still resolves on this account today,
  despite the retirement coverage noted above.)
- **Completion:** refused with `429 You have no credits remaining` — a
  billing state on the account, not a model or request-shape problem. So
  it is not yet shown that `gpt-4.1-mini` accepts the route's request
  (`temperature: 0.2` included).
- **Fallback, against the real API:** calling the route handler with the
  same key returned 200 with the template labelled
  `generatedBy: "fallback"`, `fallbackReason: "openai_error"` in ~2.4s —
  not a 500.

**Gate A stays open** until the check is re-run on a funded account and
the completion succeeds. That's a re-run, not new work: if it passes, the
list needs no change; if `gpt-4.1-mini` rejects the request, reorder
`models.ts` from the output. TFP-098 should reuse that same re-run,
not duplicate it.
