# Phase 30 Decision Record — Local (Ollama) Test Generation Path

Date: 2026-09-24
Scope: Add an Ollama-backed local generation path alongside the existing
deterministic and OpenAI paths, using a real-tested model and configuration
rather than an assumed one.
Status: Approved and in implementation (all decisions locked; TFP-103,
TFP-104, TFP-105 unblocked)

## Context

Phase 28 hardened the OpenAI path; Phase 21 evaluates it against the
deterministic generator. Both assume a funded OpenAI account. Emil's does
not have one and can't fund it right now, so this phase adds a third path
that costs nothing per request and runs entirely on his machine.

This isn't a guess at feasibility — it was spiked for real this session,
against Emil's actual hardware (RTX 2050, 4GB VRAM) and actual downloaded
models, using TestForge's real `SYSTEM_PROMPT` (imported from the repo, not
retyped) against a realistic-sized fake page profile:

- `llama3.1:8b` (general model, already on the machine): 54.5s, valid
  Playwright code, wrapped in a markdown fence despite the prompt saying not to.
- `qwen2.5-coder:3b` (1.9GB, fits fully in 4GB VRAM): 53.5s. Output used
  `expect(page).toHaveAccessibleRole(...)`, which does not appear to be a
  real Playwright assertion (the real one is `toHaveRole`, and it's a
  locator assertion, not a page-level one) — and produced four tests, two
  of them byte-for-byte duplicates, all four sharing the name "Login page
  is accessible."
- `qwen2.5-coder:7b` (4.7GB, same VRAM-ceiling class as llama3.1:8b): 73.9s.
  No invented APIs, no duplicate names, correctly split functional and
  accessibility into separate `test.describe` blocks per the
  `SYSTEM_PROMPT`'s own instruction. Also fence-wrapped.

Emil chose `qwen2.5-coder:7b` on this evidence, explicitly over the faster
3B, and explicitly deferred exploring lighter/alternative models until a
working local path exists — that's future work (see "Deferred" below), not
this phase's job.

Separately, two mechanical facts came out of the spike, confirmed against
Ollama's own documentation, not just observed once:

- Ollama's OpenAI-compatible endpoint (`/v1/chat/completions`) **silently
  discards `num_ctx`** from the request body — the endpoint's request
  struct has no such field, so it's dropped during JSON decoding and an
  automatic, VRAM-based context size is used instead. The only way to
  guarantee TestForge's real prompt (which can carry a large page-inspection
  JSON profile) isn't silently truncated is to bake the context size into
  a custom Modelfile-defined model, not pass it per request.
- The 30-second timeout TFP-083 just shipped for the OpenAI path is far too
  short for a local model — real measurements this session were 53-74s for
  one generation. Reusing that number here would make every local request
  fail before the model finishes.

**Standing policy for this phase:** same as every phase since 18 — a defect
found while building or verifying a ticket is fixed in that ticket, not
deferred; `TEST_PLAN.md` updates land in the same commit as the code they
describe.

## Decisions

1. The local path targets `qwen2.5-coder:7b`, reached through Ollama's
   OpenAI-compatible endpoint.
- Default endpoint is `http://localhost:11434/v1`, overridable via
  `TESTFORGE_OLLAMA_BASE_URL`. (Amended during TFP-103: this line
  originally deferred the name to Decision 5, which never named one.)
- Reuses the existing `openai` SDK client construction TFP-083 already
  built (`new OpenAI({ apiKey, baseURL, maxRetries: 0 })`) — a different
  `baseURL` and a placeholder API key, not a new HTTP client.

2. The model is never called by its raw pulled name — only through a
   custom Modelfile-defined variant that pins its context and output size.
- `num_ctx` and `num_predict` are set in a Modelfile (e.g.
  `FROM qwen2.5-coder:7b` / `PARAMETER num_ctx 16384` /
  `PARAMETER num_predict 4096`), built with `ollama create`, because the
  OpenAI-compatible endpoint cannot receive these per request.
- The exact custom model name TestForge's code expects is fixed and
  documented in the setup doc (Decision 6's deliverable) — not left as
  "whatever you happened to name it when spiking."

3. The local path times out at 180 seconds, independent of the OpenAI path's.
- Chosen with margin over the spike's measured 53-74s range: local calls
  cost nothing, so a premature timeout on a generation that would have
  succeeded is worse than the wait — but it stays bounded so nothing hangs
  indefinitely. A real TestForge prompt (full best-practice coverage,
  longer descriptions) could run longer than the spike's single-category
  test, which is the other reason for the margin.
- Env var: `TESTFORGE_OLLAMA_TIMEOUT_MS`, same override pattern as
  `TESTFORGE_OPENAI_TIMEOUT_MS`, defaulting to 180000ms.
- On timeout or any other failure, the same fallback-to-template pattern
  TFP-083 already built applies here too — no new failure-handling code
  path, the existing `fallback()` helper and `generatedBy`/`fallbackReason`
  shape are reused.

4. The route strips a leading/trailing markdown code fence from the local
   model's response before using it as the generated code.
- Confirmed necessary, not speculative: every model tested this session
  (llama3.1:8b, qwen2.5-coder:3b, qwen2.5-coder:7b) wrapped its response in
  a fence despite the `SYSTEM_PROMPT` explicitly saying not to.
- This is a small, generic string operation (strip a leading ` ```<lang>?`
  and trailing ` ``` ` if present) — not model-specific parsing.

5. A run opts into the local path by environment-variable presence, the
   same mechanism the OpenAI path already uses — no new UI in this phase.
- Priority order: `TESTFORGE_OLLAMA_MODEL` set → local path; else
  `OPENAI_API_KEY` set → OpenAI path; else → template (`mockGenerate`).
- `TESTFORGE_OLLAMA_MODEL` holds the custom Modelfile-defined model name
  (Decision 2), not the raw pulled name — its presence is both the opt-in
  signal and the model selector.
- A visible generation-mode selector in the run-config UI, if wanted
  later, is separate scope, not this phase's job.

6. Ollama being unreachable (not running, wrong port, custom model never
   `ollama create`-d) reuses TFP-083's existing `fallback()` shape with a
   distinct `fallbackReason`.
- No new code path — same `generatedBy: "fallback"` response shape as an
  OpenAI rejection.
- Distinct reason strings so the failure class is visible in logs/UI
  without guessing: `"ollama_unreachable"` (connection refused/no
  response) vs `"ollama_model_missing"` (reachable, but the custom model
  name isn't present); existing timeout/empty-completion reasons are
  reused as-is for those cases.
- Amended during TFP-103, two gaps this decision didn't cover:
  - A third reason, `"ollama_error"`: Ollama answered, but with an error
    (e.g. HTTP 500 when the model fails to load). Labelling that
    `ollama_unreachable` would send someone to restart a server that is
    running; reusing TFP-083's `"openai_error"` would name the wrong
    service.
  - "Model missing" matches an untagged name against its `:latest` entry.
    Ollama's `/v1/models` lists `testforge-qwen7b:latest`, never the bare
    `testforge-qwen7b`, so TFP-083's exact-id rule alone would have
    reported a model that is present as missing. That is the only rule
    added; there is no prefix or pattern matching.

## Acceptance Criteria

1. Local generation works end-to-end against a real Ollama instance
- A real `/api/generate` call (not a mocked one) against a running Ollama
  with `testforge-qwen7b` created produces valid Playwright TypeScript,
  with no markdown fence in the stored `code` field, proven by an actual
  run, not by reading the diff.
- The response records `generatedBy` and the model name used, matching the
  pattern already established for the OpenAI and fallback cases.

2. Failure modes degrade cleanly, matching TFP-083's standard
- Ollama unreachable, the custom model missing, and a timeout each result
  in the same clean fallback shape TFP-083 already proved for the OpenAI
  path — no raw 500, no silent empty-`code` 200.
- Regression tests force each of these three cases against a fake local
  server, the same way TFP-083's tests do for the OpenAI path.

3. Setup is documented, not assumed
- A setup doc (matching Phase 20's `AUTOMATED_ACCOUNT_SETUP.md` precedent)
  covers: which model to pull, the exact Modelfile content, the exact
  `ollama create` command and custom model name TestForge's code expects,
  and how to point TestForge at it.
- `TEST_PLAN.md`'s Feature Status table and Known Limitations both
  accurately describe the local path once it lands — including that model
  selection/tuning beyond `qwen2.5-coder:7b` is explicitly out of scope for
  this phase (see Deferred, below).

## Regression Policy

- `TEST_PLAN.md` gets real regression cases for the local-path success case
  and its three failure modes (unreachable, missing model, timeout), added
  in the same commit as the code they describe — same standing policy every
  phase since 18 has followed.

## Deferred (explicitly, not silently)

- **Trying lighter or alternative local models**, and any further Modelfile
  tuning for speed or accuracy, is out of scope for this phase by Emil's
  own framing ("once we have a working model locally we can have a look at
  lighter models"). This phase's job is one real, working path — not the
  best possible one. A follow-up ticket/phase picks this up once TFP-103
  lands.
- **Comparing the local path against the deterministic or OpenAI paths**
  stays Phase 21's job (TFP-099), not this phase's — same boundary Phase 28
  already drew for the OpenAI path. TFP-099 can be extended to score a
  local-model candidate the same way it scores OpenAI candidates, but that
  extension is Phase 21's ticket to pick up, not implied here.

## Backlog

**Ticket numbers below are estimates** — confirm the next real free number
against the actual backlog before filing (TFP-102 was Phase 29's last
issued number as of this record).

### TFP-103 — Build the Ollama-backed local generation path

- **Phase:** 30
- **Priority:** P2
- **Suggested labels:** `feature`, `generate`, `local`
- **Problem it solves:** TestForge's only non-deterministic generation
  option requires a funded OpenAI account. This adds a genuinely free,
  local alternative, using a model and configuration already proven to
  work against TestForge's real prompt shape.
- **Scope:** Point a new branch of `/api/generate` at Ollama's
  OpenAI-compatible endpoint using the existing `openai` SDK client
  pattern; strip a markdown fence from the response before treating it as
  code; apply the local-specific timeout from Decision 3; fall back per
  Decision 6 on any failure; opt-in mechanism per Decision 5.
- **Deliverables:** Updated `src/app/api/generate/route.ts`; the
  Modelfile(s) and setup doc from Decision 2/Acceptance Criterion 3;
  regression tests for the success case and the three failure modes;
  `TEST_PLAN.md` updates.
- **Acceptance criteria:** As stated above.
- **Dependencies:** None (Decisions 3, 5, 6 locked above).

### TFP-104 — Setup documentation for the local path

- **Phase:** 30
- **Priority:** P2
- **Suggested labels:** `docs`
- **Problem it solves:** Without a documented `ollama pull`/`ollama create`
  sequence and exact model name, this only works on the machine that
  spiked it.
- **Scope:** A setup doc matching Phase 20's `AUTOMATED_ACCOUNT_SETUP.md`
  precedent — exact commands, exact Modelfile content, how to verify it's
  working.
- **Deliverables:** New setup doc under `docs/`.
- **Acceptance criteria:** Someone other than Emil could follow it and get
  a working local path.
- **Dependencies:** TFP-103.

### TFP-105 — Regression coverage for the local path's failure modes

- **Phase:** 30
- **Priority:** P2
- **Suggested labels:** `test`, `generate`
- **Problem it solves:** Acceptance Criterion 2 requires proof, not an
  assumption that TFP-083's pattern "just works" the same way here.
- **Scope:** Regression tests forcing Ollama-unreachable, missing-model,
  and timeout cases against a fake local server, extending the existing
  `route.test.ts` file rather than a new one.
- **Deliverables:** Extended `src/app/api/generate/route.test.ts`.
- **Acceptance criteria:** All three failure modes proven to degrade
  cleanly, the same standard TFP-083 already met for the OpenAI path.
- **Dependencies:** TFP-103.

## Recommended Execution Order

1. TFP-103 → TFP-105 (regression can land alongside 103, not strictly
   after) → TFP-104.

## Suggested Milestone Gate

### Gate A — Local generation path works and degrades safely
- TFP-103 and TFP-105 land against a real running Ollama instance (not
  just mocked tests), TFP-104's setup doc exists, and `TEST_PLAN.md`
  accurately separates "a working local path exists" (this phase) from
  "compared against the other two paths" (still Phase 21) and "tuned for
  speed/accuracy beyond the 7B baseline" (explicitly deferred, above).
