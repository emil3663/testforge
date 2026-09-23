# Phase 25 — Dogfooding Against cah-pwa Backlog

**Version:** 1.0
**Date:** 2026-09-22
**Status:** Draft — for review, not yet started

## Context

Phase 19 (`docs/decisions/phase-19-dogfooding-backlog.md`) established a
repeatable pattern — run TestForge's own app against a real external
target, run a skill directly against the same target with no app
involved, then compare both to a real baseline — and `examples/README.md`
explicitly says this "repeats for every future skill against the same
target, so results stay comparable over time." That's held true for new
*skills* against `test-assist`; this phase is the first time it's applied
to a second *target*, `cah-pwa`.

`cah-pwa` is a better test of the pattern than a second run against
`test-assist` would be, for two reasons:

- It's genuinely reachable: a no-build-step vanilla-JS PWA, served
  locally via `python3 -m http.server 8000` per its own
  `GETTING_STARTED.md`. No desktop-build exclusion like Phase 19 had to
  carve out.
- It already has **its own automated generator** — `scripts/generate_playwright_tests.js`,
  producing the suite under `tests/generated/` — plus a hand-authored
  stability matrix (`AUTOMATION_TEST_PLAN.md`, rating each area
  Stable/Moderate/Flaky/Blocked with named reasons). Phase 19's
  comparison was TestForge-generated vs. skill-generated vs.
  hand-written, because `test-assist` had no generator of its own to
  compare against. This phase can additionally compare TestForge's and
  the skill's output against *another automated approach* on the same
  app — a comparison Phase 19 structurally couldn't make.

**Stated plainly so it isn't assumed later:** `cah-pwa`'s real gameplay
(room creation, chat, AI-driven card behavior) sits behind Firebase-backed
realtime state, and prompt-driven card behavior calls Gemini at runtime.
TestForge's crawl is unauthenticated same-origin BFS. Whether that reaches
past the landing/auth surface into real gameplay is not assumed here
either way — it's exactly what TFP-074 discovers and states as fact,
the same way Phase 19 discovered (rather than assumed) the
browser/desktop build split in `test-assist`. If it turns out gameplay is
reachable without real credentials (e.g. an anonymous session), record
that; if not, record the specific wall hit and don't treat it as a defect
in this phase — TestForge's own authenticated-testing support is a
separate, already-tracked roadmap item, not something to silently pull
into this ticket's scope.

## Scope (this phase)

### In scope
1. Run TestForge's actual app (crawl → generate → run) against `cah-pwa`,
   served locally.
2. Run `write-playwright-test` directly against `cah-pwa`, with no
   TestForge app involved.
3. Compare all four things that now exist for the same app: TestForge's
   generated suite, the skill's generated suite, `cah-pwa`'s own
   `scripts/generate_playwright_tests.js` output, and its hand-authored
   stability matrix as context.
4. Extend `examples/README.md`'s target list to include `cah-pwa`
   alongside `test-assist`, following the pattern it already documents
   rather than special-casing this run.

### Out of scope
- Building the automation-login-account pattern TestForge's own roadmap
  already names as not-yet-built, even if gameplay turns out to need it.
- Modifying `cah-pwa` itself.
- Testing anything behind real multiplayer/Firestore realtime state —
  out of reach for the same structural reason Phase 19 excluded
  `test-assist`'s desktop build, unless TFP-074's own discovery finds
  otherwise.

## Backlog

### TFP-074 - Run TestForge's app against cah-pwa's browser build

- **Phase:** 25
- **Priority:** P1
- **Suggested labels:** `dogfooding`, `integration`
- **Problem it solves:** confirms how TestForge's decomposed pipeline
  behaves against a target with real external dependencies (Firebase,
  Gemini) it may not fully reach — a harder, more realistic case than
  `test-assist`'s browser build, and the first time this is checked
  rather than assumed.
- **Scope:**
  - Serve `cah-pwa` locally: `python3 -m http.server 8000`, per its own
    `GETTING_STARTED.md`.
  - Start TestForge's own dev server.
  - Run the full pipeline against it through TestForge's actual UI or
    API, not a script that bypasses it.
  - Explicitly record what the crawl actually reaches — state the real
    boundary (e.g. "crawl reached N pages, stopped at the room-creation
    screen because X") rather than assuming it matches `GETTING_STARTED.md`'s
    full sign-in → room → game flow.
  - Capture the generated suite and the structured report as real files.
- **Deliverables:**
  - `examples/testforge-app/cah-pwa/` — the generated suite, the run
    report, and a `notes.md` stating what was and wasn't reachable, and
    why.
- **Acceptance criteria:**
  - The generated suite actually ran, with real pass/fail results
    captured.
  - The reachability boundary is stated as a specific, checkable fact.
- **Dependencies:** None.

### TFP-075 - Run write-playwright-test directly against cah-pwa

- **Phase:** 25
- **Priority:** P2
- **Suggested labels:** `dogfooding`, `skills`
- **Problem it solves:** continues the repeatable per-skill-per-target
  pattern `examples/README.md` already commits to, this time against a
  target that has its own competing automated generator — so the
  skill's judgment can be compared to another tool's output, not only to
  a hand-written baseline.
- **Scope:**
  - Apply `write-playwright-test` (via Claude Code, no TestForge app
    involved) directly against `cah-pwa`'s source and served instance.
  - Capture the resulting test file(s) as-is.
  - Update `examples/README.md`'s target list to name `cah-pwa`
    explicitly alongside `test-assist`, per its own stated pattern.
- **Deliverables:**
  - `examples/skills/write-playwright-test/cah-pwa/`
  - Updated `examples/README.md`.
- **Acceptance criteria:**
  - Output captured as a real file, not summarized.
  - `examples/README.md` accurately reflects two targets, not one.
- **Dependencies:** None (can run in parallel with TFP-074).

### TFP-076 - Compare four suites on the same app

- **Phase:** 25
- **Priority:** P2
- **Suggested labels:** `dogfooding`, `analysis`
- **Problem it solves:** four things now claim to test the same app —
  TestForge's, the skill's, `cah-pwa`'s own generator, and its
  hand-authored stability matrix. Without a direct, specific comparison,
  having four teaches nothing. This includes the one comparison Phase
  19 structurally couldn't make: automated generator vs. automated
  generator, not just automated vs. hand-written.
- **Scope:**
  - Run all applicable suites against the same served instance where
    runnable.
  - Record, per suite: what it catches that the others miss, false
    positives, and category weaknesses (functional, responsive,
    accessibility, etc.).
  - Specifically name at least one concrete point where TestForge's/the
    skill's output diverges from `cah-pwa`'s own generator on the same
    page or feature.
- **Deliverables:**
  - `examples/comparison-cah-pwa.md`.
- **Acceptance criteria:**
  - Findings are specific (named test, named gap), not "roughly similar
    coverage."
  - At least one named generator-vs-generator divergence.
- **Dependencies:** TFP-074, TFP-075.

## Recommended Execution Order

1. TFP-074 and TFP-075 (can run in parallel)
2. TFP-076

## Suggested Milestone Gates

### Gate A - cah-pwa dogfooding pass complete
- TFP-074 and TFP-075 both have real, saved output in `examples/`.
- TFP-076's comparison names at least one concrete, specific gap or
  strength in each of the four arms, including the generator-vs-generator
  divergence.

## Aside, not part of this phase's scope

While confirming `cah-pwa` was a viable target, a real reliability gap
turned up in `js/gemini.js`: the Gemini API call (line 16) has no
timeout, no retry/backoff, and no `catch` anywhere in the file. Not
actioned here — flagged so it isn't lost. Worth its own ticket if a
`reliability-audit`-style pass on `cah-pwa` is wanted later, the same way
Phase 24 did for `testforge` itself.
