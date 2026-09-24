# Phase 21 Decision Record — AI-Assisted Generation as a Measured Alternative (Locked)

Date: 2026-09-24
Scope: Bring the existing OpenAI-backed generation path into active
development — real CI coverage, and evaluated against the deterministic
generator on the same sites using Phase 17's run persistence and diffing.
The product decision (default generator, opt-in, or user's choice per run)
is made from that comparison, not in advance of it.
Status: Approved and in implementation. Retargeted 2026-09-24 (see
Amendment, below) at the local (Ollama) path — TFP-098-100 now compare the
deterministic generator against testforge-qwen7b, not OpenAI. TFP-098
unblocked now, TFP-099/100 sequenced behind it.

## Context

`docs/decisions/product-roadmap.md`'s Phase 21 paragraph already locks this
phase's shape in one sentence. Two things ground it further, confirmed
against the real repo on 2026-09-24 rather than assumed:

- The OpenAI-backed path already exists and already ships — `POST
  /api/generate` (`src/app/api/generate/route.ts`) calls `gpt-4o` today
  when `OPENAI_API_KEY` is set. This is not a build-from-scratch phase.
- `docs/decisions/phase-28-openai-path-hardening-backlog.md` (TFP-083)
  already closes the *reliability* gap in that same code path — try/catch,
  timeout, fallback to `mockGenerate`, a pinned model string — and
  explicitly, deliberately does not attempt this phase's CI-coverage-and-
  comparison work. Phase 28 is a prerequisite in practice, not just
  principle: real comparison data through a path that 500s on a bad key or
  hangs on a timeout is noise, not a measurement. **Updated 2026-09-24:
  this is now stronger than a reliability concern.** Phase 28 itself was
  updated the same day with a finding that the hardcoded `gpt-4o` model
  may not resolve via the OpenAI API at all anymore (public sources
  disagree on the exact date, but agree it's being retired through 2026)
  — meaning the path this phase evaluates may currently be fully
  non-functional, not just unguarded. **TFP-098 cannot produce real
  comparison data until Phase 28's live-check step confirms a working
  model.**

All of this record's placeholders were resolved by Emil on 2026-09-24 —
see Decisions below. No ticket in this phase is blocked on an open
product decision anymore; Phase 28's live-check is the only remaining
gate, and it's an engineering step, not a decision.

**Standing policy for this phase:** same as Phases 18–20 (formalized
repo-wide since 2026-09-23) — a defect found while building or verifying a
ticket is fixed in that ticket, not deferred; `TEST_PLAN.md` and doc
updates land in the same commit as the code.

## Decisions

1. The deterministic generator remains the default; this phase evaluates,
   it doesn't replace.
- Every capability built in Phases 16–20 keeps working unchanged with no
  `OPENAI_API_KEY` set. Nothing in this phase touches that default path.

2. Comparison reuses Phase 17's run diffing, not a new engine.
- Both paths generate against the same target under the same crawl/
  introspect data; the existing run-diff machinery (built for comparing two
  runs of a target over time) is pointed at "deterministic run vs.
  OpenAI-backed run."

3a. **Resolved 2026-09-24** — scheduled cadence (not per-PR), plus a
    manual on-demand trigger for the same job. Bounds routine spend by
    bounding frequency regardless of PR/contributor volume, without
    depending on anyone remembering to run it by hand (the failure mode
    that ruled out pure-manual) — and the manual trigger means Emil isn't
    stuck waiting for the next scheduled slot when he actually wants a
    comparison right now. Concretely: a CI job with both a `schedule`
    trigger and a `workflow_dispatch` (or equivalent on-demand) trigger,
    sharing one capped-budget secret — the schedule is the routine
    cadence, the manual trigger is the same job invoked early, not a
    second code path. Exact cadence (nightly vs. weekly) is an
    implementation detail for whoever builds TFP-098, not a product
    decision — pick one, state it in the ticket's own doc update.

3b. **Resolved 2026-09-24** — product-level cost model, once this ships to
    other site owners: bring-your-own-key now, TestForge-hosted-key-by-
    default later.
- Near-term (buildable now): each site owner supplies their own
  `OPENAI_API_KEY` — the same pattern Phase 20 already uses for login
  credentials. TestForge stays local-only (Phase 16's own locked posture)
  and this needs no new infrastructure.
- Long-term intent, explicitly not this phase: TestForge hosts the key by
  default, with BYOK as an override for anyone who wants their own. This
  is genuinely bigger than Phase 21 (or even Phase 28) — a hosted-by-
  default key anyone can call without supplying credentials needs
  per-user identity to cap spend per user, which
  `docs/decisions/saas-prerequisites.md` already names as a prerequisite
  with "no implementation scheduled" (TestForge is local-only today:
  "whoever can reach the process already has whatever access the process
  has — there is no second party to authenticate against"). Hosted-key-
  by-default is a SaaS-era feature, not a Phase 21 one — recorded here as
  the stated long-term direction and cross-referenced from
  `saas-prerequisites.md`, not scoped into TFP-098–100 below.

4. **Resolved 2026-09-24** — the comparison scores all four dimensions
   together: discovered-surface coverage delta, pass/fail agreement
   between the two paths, defect-detection difference (one path catches
   something the other misses), and cost & latency per run. Where a
   dimension genuinely can't be computed for a given target — e.g.
   defect-detection needs a known, injected defect to test against, which
   not every comparison run will have — the report states which
   dimension was skipped and why, rather than omitting it silently or
   forcing a number that isn't real.

5. **Resolved 2026-09-24** — the exposure mechanism (UI flag vs.
   API-only) is not decided now. TFP-100 decides it from TFP-099's actual
   comparison results, not in advance — consistent with the roadmap's own
   framing that the product decision comes *from* the comparison.

## Acceptance Criteria

1. CI coverage for the real OpenAI path (TFP-098)
- Live-check half: a real, currently-resolving model is confirmed via a
  models-list call or a real minimal request, recorded alongside Phase
  28's own live-check (same finding, don't duplicate the work).
- CI-wiring half: a CI job with both a `schedule` trigger and a manual
  `workflow_dispatch` (or equivalent) trigger exists, shares one
  capped-budget secret, and a manually-triggered run actually produces a
  real comparison result end to end.

2. Comparison report (TFP-099 — gated on TFP-098; Decision 4 answered)
- Against a real target, a completed comparison run scores discovered-
  surface coverage delta, pass/fail agreement, defect-detection
  difference, and cost & latency — or, for any dimension that can't be
  computed for that target, states which one and why, rather than a
  silent omission or a guessed number.

3. Product decision + exposure (TFP-100 — gated on TFP-099's real output)
- Not written in advance — the roadmap is explicit that the decision comes
  *from* the comparison, not before it (Decision 5 confirms this is
  deliberate, not an oversight).

## Regression Policy

- `TEST_PLAN.md` gets a case for the comparison report matching a real
  target's actual diff as soon as TFP-099 lands. No cases stubbed in now
  against placeholders that don't have answers.

## Backlog

Ticket numbers start at TFP-098 (the highest number in use across
`docs/decisions/` as of 2026-09-24 is TFP-097) — confirm against the live
backlog before filing, since other work may have claimed numbers since.

### TFP-098 — Get real CI coverage for the OpenAI-backed path

- **Phase:** 21
- **Priority:** P3 (fully unblocked)
- **Suggested labels:** `feature`, `ci`
- **Problem it solves:** the path has shipped, untested in CI, since before
  Phase 16 — `product-roadmap.md`'s own Current Functionality section
  already names this. Nothing changes until there's a real key and a real
  place for it to run.
- **Scope:** Two parts.
  1. Confirm a real, live-resolving model — the same live-check Phase 28's
     TFP-083 runs first; coordinate rather than duplicate it (whichever
     ticket lands first records the result, the other reads it).
  2. Wire the confirmed model into a CI job with both a `schedule`
     trigger (routine cadence — pick nightly or weekly, state it in the
     doc update) and a manual `workflow_dispatch` trigger (same job, same
     capped-budget secret, invoked on demand), per Decision 3a.
- **Deliverables:** The live-check result (model id, confirmed live
  2026-09-24 or later); the CI workflow file with both triggers; a doc
  note stating the chosen cadence.
- **Acceptance criteria:** A real API call using the confirmed model
  succeeds against a live target; a manually-triggered run of the CI job
  produces a real comparison result without waiting for the schedule.
- **Dependencies:** Phase 28 (TFP-083) landing first, so real comparison
  data isn't noise from an unguarded call.

### TFP-099 — Build the deterministic-vs-OpenAI comparison report

- **Phase:** 21
- **Priority:** P3 (blocked on TFP-098)
- **Suggested labels:** `feature`, `reporting`
- **Problem it solves:** without a comparison, two generators existing
  side by side isn't an evaluation — this is what makes it one.
- **Scope:** Build a report scoring all four Decision-4 dimensions —
  discovered-surface coverage delta, pass/fail agreement, defect-detection
  difference (or the specific, stated reason it was skipped for a given
  target — e.g. no known defect to test against), and cost & latency per
  run. Reuses Phase 17's run-diffing machinery (Decision 2), pointed at a
  deterministic run and, for **each** candidate in Phase 28's ordered
  model-candidate config (`src/lib/generate/models.ts`, TFP-083) — not
  just whichever one happens to be pinned — an OpenAI-backed run of the
  same target, so the report says which candidate is actually best for
  this task, not just whether AI beats deterministic. Added 2026-09-24
  (Cowork, at Emil's request): runs on the same scheduled cadence
  Decision 3a already set up, sharing its trigger and capped-budget
  secret rather than adding a second schedule.
- **Deliverables:** The comparison report itself, scoring every candidate
  in Phase 28's list; a `TEST_PLAN.md` case proving it against a real
  target with a real diff, not a synthetic one; a documented process for
  promoting a different candidate into Phase 28's config from the
  report's results (a manual review of real data, then an ordinary code
  change through Claude Code — not automatic switching).
- **Acceptance criteria:** Against a real target, a completed comparison
  produces all four scored dimensions for every candidate in the list (or
  for any it can't score, a specific stated reason — never a silent
  omission or a guessed number), and the results alone are enough to
  decide whether Phase 28's currently-pinned candidate should change.
- **Dependencies:** TFP-098; Phase 28's candidate-list config existing.

### TFP-100 — Record the default/opt-in/user's-choice product decision

- **Phase:** 21
- **Priority:** P3 (blocked on TFP-099)
- **Suggested labels:** `product`
- **Problem it solves:** the actual deliverable the roadmap paragraph
  names — a decision made *from* real comparison data, not before it.
- **Scope:** Set from TFP-099's real output, per Decision 5 (deliberately
  not written in advance) — the exposure shape (UI flag vs. API-only) is
  chosen based on what the comparison actually shows, not guessed here.
- **Deliverables:** TBD, set from TFP-099's results.
- **Acceptance criteria:** TBD, set from TFP-099's results.
- **Dependencies:** TFP-099.

## Recommended Execution Order

1. Phase 28 (TFP-083) lands, or at minimum its guard/timeout/fallback and
   live-check — not a hard gate on this record, but real comparison data
   through an unguarded or non-resolving call is a false start
2. TFP-098 → TFP-099 → TFP-100, in sequence (TFP-098's live-check half can
   start immediately, in parallel with Phase 28's own)

## Suggested Milestone Gate

### Gate — Phase 21 complete
- TFP-098–100 landed against a real target, with a `TEST_PLAN.md` case
  proving the comparison reflects real (not assumed) behavior on both
  paths, a manually-triggered run proven to work on Emil's machine (see
  Amendment: no CI job exists for this comparison), and the product
  decision recorded in `product-roadmap.md`'s own text.


---

## Amendment (2026-09-24) — Retargeted at the local (Ollama) path

**Why.** Emil's OpenAI account remains unfunded, with no near-term plan to
fund it (Phase 28's live-check found the account rejects any real
completion at $0 balance). Separately, Phases 30-33 built and tuned a
local generation path (`testforge-qwen7b` via Ollama) that now has a real,
honestly-measured baseline across nine of the ten best-practice
categories — only reliability remains partial (Phase 33, GEN-32, recorded
`⚠️`, not fixed, not hidden). Emil's own steer at the end of that work:
retarget this phase's comparison at the local model now that it has a
fair baseline to be measured from, rather than continue waiting on a
funded OpenAI account to do the comparison this record originally
described.

**A technical fact, not a preference, forces one more change.** Ollama
runs only on Emil's own machine and is unreachable from this session's
tools or any hosted CI runner — confirmed repeatedly across Phases 30-33,
where every live check had to run inside Emil's own environment (via the
device bridge or Code directly). Decision 3a's CI-wiring plan (a GitHub
Actions job with a `schedule` and a manual `workflow_dispatch` trigger)
cannot be built for the local path at all, not just deprioritized —
there is no network path from a hosted runner to Emil's GPU. This is
recorded and routed around, not re-decided.

### Decisions (retargeted)

Decisions 1, 2, 4, and 5 above are unchanged and apply to the local path
exactly as written. Decisions 3a and 3b are superseded, for this
comparison specifically, as follows:

3a (retargeted). No CI job exists for this comparison, and none is
planned. It runs on demand, on Emil's own machine, the same way every
Phase 30-33 live check already has — triggered manually by Emil or Code,
not on a schedule. TFP-098's deliverable is a repeatable script/command,
not a workflow file.

3b (retargeted). The bring-your-own-key cost model is moot for the local
path — every run costs $0 by construction, no key, no billing surface.
Cost stays one of the four Decision-4 dimensions the report scores (for
contrast against what the same comparison would show if OpenAI is ever
funded), but needs no BYOK or hosted-key design work to get there.

Decision 4's four dimensions still apply, reweighted in practice: latency
is the dimension that actually differentiates local generation (29-96s
per suite, Phase 33) from the deterministic generator's near-instant
output — OpenAI would have been the fast comparison point instead.
Coverage delta and pass/fail agreement matter most given how much
category-by-category tuning Phase 33 just did. Defect-detection is scored
exactly as originally decided: stated as skipped when there's no injected
defect to test against, never guessed.

**New note on reliability.** TFP-099's report states reliability's
Phase 33 weakness plainly as a caveat on that category's results, rather
than waiting for it to be fixed first. An honest, current baseline for
nine categories is more useful now than a complete one later.

### Backlog (retargeted; same ticket numbers, updated scope)

#### TFP-098 (retargeted) — Build a repeatable local-generation comparison run

- **Scope:** Not CI-wired (Decision 3a, retargeted). A script or command
  that, given a target, runs both the deterministic generator and
  `testforge-qwen7b` against it and produces a comparable pair of runs,
  reusing Phase 17's run-diffing (Decision 2, unchanged).
- **Deliverables:** The script; a short doc note on how Emil or Code runs
  it (matching the pattern `docs/LOCAL_MODEL_SETUP.md` already set).
- **Acceptance criteria:** A manually-triggered run against a real target
  produces a real comparison result end to end, on Emil's machine — not
  mocked.
- **Dependencies:** None — the local path (Phases 30-33) already exists
  and is proven live.

#### TFP-099 (retargeted) — Build the deterministic-vs-local comparison report

- **Scope:** Score all four Decision-4 dimensions (coverage delta,
  pass/fail agreement, defect-detection or a stated skip, latency & cost)
  against `testforge-qwen7b`, reusing Phase 17's diffing. State
  reliability's known weakness as a caveat on its own results rather than
  fixing or hiding it.
- **Deliverables:** The comparison report; a `TEST_PLAN.md` case proving
  it against a real target with a real diff.
- **Acceptance criteria:** A completed comparison against a real target
  produces all four scored dimensions (or a specific stated reason for
  any it can't score), and the report is enough on its own to inform
  TFP-100's decision.
- **Dependencies:** TFP-098.

#### TFP-100 (retargeted) — Record the default/opt-in/user's-choice product decision

- Unchanged in shape from the original ticket above: set from TFP-099's
  real output, not written in advance.
- **Dependencies:** TFP-099.

## Implementation status (2026-09-24)

**A correction to the Amendment's premise.** Ollama is *not* unreachable
from Claude Code's session: every Phase 30-33 live check, and every run in
this phase, ran from Claude Code against Emil's Ollama on localhost. That
changes nothing decided here. A hosted CI runner still can't reach it, so
3a (retargeted) stands, but "needs Emil's machine" means this machine,
reachable by Code, not "only Emil can run it".

**TFP-098: met.** `npm run compare:generators -- --config <file>`
(`scripts/compare-generators.mjs`, `docs/GENERATOR_COMPARISON.md`). One
command per target. Both generators get the same request and introspection
data and go through the real `/api/generate`. Both suites run through
`/api/run`, and the clean pair is diffed with `/api/runs/diff` (Decision 2).
Run end to end against two real targets, nothing mocked. There is no
workflow file, per 3a (retargeted).

**TFP-099: met.** The report is
`docs/decisions/phase-21-comparison-report.md`, with `TEST_PLAN.md` GEN-37.
All four Decision-4 dimensions are scored for every case, or explicitly
skipped with a reason:
- defect detection is skipped on the real site, which has no injected
  defect;
- the run report's coverage is shown with its title-matching bias and
  paired with a title-independent proxy rather than trusted alone.
Reliability's Phase 33 weakness is stated as a caveat, not fixed first.

Two defects were found and fixed along the way:
- `fix(report)`: model-written tests had all been filed under Functional
  (TEST_PLAN RPT-09);
- a bug in the comparison's own fixture, which hid its database defect.

**TFP-100: proposed, not recorded as decided.** See the next section. The
product decision is Emil's, so it is not yet written into
`product-roadmap.md`.
