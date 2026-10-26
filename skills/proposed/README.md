# Proposed skills — for review, not for use

Sixteen skills distilled from the Google SRE book and DORA's research, plus two
reference files. **None of this is Phase 17/18/20 work.** It arrived after those
scopes were set, so it sits here rather than in `skills/testing/` or
`skills/engineering/`, and the directory deletes cleanly if it isn't wanted.

This is Martin's version of an exercise Emil has already done. `ROADMAP.md` shows
four SRE chapters already mined — ch. 6, 17, 21-22, and ch. 8 deliberately skipped
as covered elsewhere. This set worked the same book end to end instead of
selecting from it. **The overlaps are a second opinion, not a correction; the rest
is coverage that wasn't there.** What, if anything, is worth keeping is an owner decision.

## Read these first, if you read any

Martin's pick of what's most likely to earn its place here:

| | Why this one |
|---|---|
| `sre-code` | Intent-based APIs, config-as-spec-sheet, and "language is code" — prompts, skill files and model versions treated as source. Directly about how a tool like this is built. |
| `sre-architecture` | Design-time structure: failure domains, dependency direction, designed degradation. A 12-point design-review checklist. |
| `sre-testing` | Test taxonomy, how much testing is enough, and evals as the test layer for nondeterministic components. |
| `sre-agents` | How agent and human capacities actually differ, and what work belongs to which. |
| `sre-cost` | Budgeting and bounding spend the way SLOs budget reliability. |
| `sre-toil` | Identifying repetitive work worth eliminating, and why the 50% cap stopped enforcing itself. |

## How this overlaps what's already built

Checked against `skills/README.md` and `ROADMAP.md` as of Phase 20.

**Direct overlap — same chapters, independently worked:**

| Already built | This set | Relationship |
|---|---|---|
| `reliability-audit` (ch. 21-22) | `sre-overload` | Same chapters. `reliability-audit` audits three signals in existing code; `sre-overload` is design-time plus an active-incident checklist. Different jobs from one source. |
| `observability-check` (ch. 6) | `sre-monitoring` | Same chapter. `observability-check` asks "would anyone notice"; `sre-monitoring` covers alert-rule construction and why pagers get noisy. |
| `failure-mode-tests` (ch. 17) | `sre-testing` | Same chapter. `failure-mode-tests` writes the tests; `sre-testing` decides what to test and how much. Complementary rather than competing. |
| `verified-release-pipeline` (account skill, ch. 8 skipped) | `sre-release` | The skip looks right for pipelines. `sre-release` also carries launch coordination and progressive rollout, which that skill doesn't cover. |

**TFP-052 (Phase 23) trialled that gap against a real project, not hypothetically.**
`sre-release`'s launch-coordination/rollout material and `sre-toil`'s six-property
test were run against `test-assist`'s actual update/rollback situation — both
builds had zero rollback mechanism, confirmed by reading `update_check.py` and
`pages.yml` directly. Toil-classified (desktop: 5-6/6 depending on task; browser:
5/6, honestly not O(n) for a single-maintainer site) and two proposals scoped to
what a manual-update, no-telemetry, solo-maintainer project actually supports —
not the canary/feature-flag material `sre-release` assumes for a continuously
operated service. Desktop proposal implemented (a `KNOWN_GOOD:` marker read
through `UpdateChecker.interpret()`'s existing pure seam, 9 new tests); browser
proposal is a timed runbook, no workflow change. Full findings:
[`test-assist/docs/RELEASE_ROLLBACK_TRIAL.md`](https://github.com/emil3663/test-assist/blob/docs/ta-250-release-rollback-trial/docs/RELEASE_ROLLBACK_TRIAL.md),
[`test-assist#24`](https://github.com/emil3663/test-assist/pull/24) (open).

**No overlap — chapters not yet mined:**
ch. 3-5 (risk, SLOs, toil) · ch. 7 (automation safety) · ch. 9 (simplicity) ·
ch. 12-16 (troubleshooting, incident command, postmortems) · ch. 18 (software
engineering) · ch. 23-27 (consensus, cron, pipelines, data integrity, launches).

**Not in the book at all:** `sre-agents`, `sre-cost`, `dora`, `dora-capabilities`.

## Something worth knowing either way

**A 2nd edition of the SRE book is coming** — Beyer, Jones, Leng, Huska, Petoff,
Murphy, 771pp, **published 27 October 2026**. It is not out yet; chapters are
visible in early release on O'Reilly, which means the text can still change.
Everything in `skills/` and everything here was built from the **1st** edition,
the one published free at `sre.google/sre-book`.

Two things to know before mining the book further:

- **It is a restructure, not an appendix.** The 2nd edition's chapters are
  differently titled and differently ordered — sociotechnical foundations,
  situational awareness, continuous preparedness, infrastructure design,
  resilient products, emergent reliability — plus material with no 1st-edition
  ancestor ("Safety Engineering for Software: Beyond Reacting to Failure",
  ch. 3, and a chapter on AI and SRE). So the chapter numbers in the overlap
  table above are **1st-edition numbers** and will not map across.
- **Waiting is cheap.** Six weeks, and the early-release text may move under
  anyone who mines it now.

Neither of us has read it. This is from the publisher's listing, not the book.

## What to be sceptical about

- **The format doesn't match the house convention.** These are
  `<name>/SKILL.md` with YAML frontmatter, written for Claude Code's `Skill`
  discovery — not `cah-pwa/skills/`'s *What this skill is for / Inputs / Output
  format / Rules / Worked example / How to invoke this skill*. Anything
  promoted needs rewriting into that shape first. That's a real cost and it's
  deliberate to leave it visible rather than half-convert them.
- **Related: the frontmatter is why these would be discovered.** The open
  question in `README.md` about `skills/` not being auto-discovered is about
  location (`.claude/skills/`), not format — but these carry the `name` +
  `description` frontmatter that discovery matches on, if that's useful data.
- **None have been run in anger.** They were written against two published
  sources and reasoned about. Unlike `honest-coverage` or
  `dont-stub-what-you-prove`, none generalizes from a real incident anyone here
  had, and there is no equivalent of `CALIBRATION.md` behind them.
- **The provenance is reading, not experience.** Every claim traces to a cited
  chapter or to DORA, which is a weaker foundation than TA-227 or TA-230.
- **Material added beyond the sources is marked `[extension]`, and material
  correcting them `[supersedes]`.** Those markers are the honest boundary —
  roughly a quarter of the content is one or the other, including all of
  `sre-agents` and `sre-cost`.
- **One DORA claim is marked `[unverified]`** — that the 2025 research retired
  the Elite/High/Medium/Low tiers for team archetypes. Secondary sources say so;
  dora.dev's own 2025 material is gated and it couldn't be confirmed.
- **Most of the runtime set doesn't apply to a local-only tool.** TestForge
  isn't deployed, so SLOs, incident command, on-call, data integrity and
  cascading-failure work have little to bite on here. They're included because
  the ask was the whole set, not because all of it fits.

## A suggested first run

Narrow, against something real, printing rather than changing anything:

> "Run `sre-architecture`'s design-review checklist against `src/lib/` and print
> the findings — don't file issues or change code."

`sre-code`'s review questions against `src/lib/generate/prompt.ts` would be the
other useful one, since that file is the tool's own prompt — which is exactly
what its "language is code" section argues should be versioned, reviewed,
pinned to a model version, and covered by evals.

## Contents

Sixteen skills. Each states its source chapters at the top and ends with the
artifact it produces.

**Router**

- **`sre`** — routing table, the core tenets (error budgets, the 50% cap, three
  valid monitoring outputs), an argument about which practices lost the cost
  that used to enforce them, and an explicit list of what the 1st edition gets
  wrong.

**Design-time** — building it

- **`sre-code`** — intent-based APIs (declare *what*, not *how*), negative lines
  of code, minimal APIs, launch-and-iterate, configuration as a spec sheet
  rather than as code, and "language is code": prompts and skill files treated
  as source, with the model version pinned or the build isn't reproducible.
- **`sre-architecture`** — dependency direction (always downward), failure
  domains and hidden shared fate, designed degradation paths, where state lives,
  which problems genuinely require consensus, dependencies as a portfolio you
  can't page. Ends in a 12-point design-review checklist.
- **`sre-testing`** — the test taxonomy (unit/integration/system, plus
  configuration, stress and canary as production tests), how much testing is
  enough, why a flaky test is worse than no test, and evals as the test layer
  for nondeterministic components.

**Runtime** — it exists and has users

- **`sre-slo`** — SLI/SLO/SLA kept straight, why latency SLOs must never be
  means, the six-part measurement spec, choosing targets, error-budget maths,
  and splitting budget burn into self-inflicted versus inherited from vendors.
- **`sre-monitoring`** — the four golden signals, symptom-versus-cause (the
  rule that decides what pages), five questions every alert rule must answer,
  and rule construction that doesn't flap.
- **`sre-release`** — hermetic builds, progressive rollout and canarying,
  feature flags, the pipeline as a reviewable artifact, and a launch
  coordination checklist.
- **`sre-incident`** — stop the bleeding before diagnosing, the diagnose loop
  (what touched it last, bisect, simplify and reduce), the four incident roles,
  and two cases the book didn't anticipate: vendor outages where troubleshooting
  is unavailable, and nondeterminism breaking bisection.
- **`sre-postmortem`** — trigger criteria, blameless phrasing with worked
  rewrites, a full template, and tracking outages across incidents.
- **`sre-overload`** — an active-cascading-failure checklist first, then retry
  budgets (4 layers x 3 retries = 64 attempts), deadline propagation, load
  shedding, criticality levels, and load-balancing policy.
- **`sre-data-integrity`** — backups versus archives ("what people really want
  are restores"), three defense-in-depth layers, consensus deployment, and
  idempotent scheduling.
- **`sre-toil`** — the six properties that make work toil, the 50% cap and why
  it stopped enforcing itself, the automation ladder, and the safety
  requirements for destructive automation.

**Cross-cutting** — not in the book

- **`sre-agents`** — how agent and human capacities actually differ, and the
  division of labour that follows: agents take the documented, humans take the
  novel. Escalation by enforced tripwire rather than self-assessment.
- **`sre-cost`** — a cost budget with the error budget's mechanics, bounding
  everything that can scale on its own, and saturation as a financial signal.

**Delivery** — DORA

- **`dora`** — the five metrics (there are five now, not four), how to compute
  each from git and CI, benchmarks, how they get misused, and which signals a
  repository can and cannot tell you.
- **`dora-capabilities`** — symptom-to-capability diagnosis, and why
  "trunk-based development" is better stated as small batches integrated often.

**Reference files** — `sre-postmortem/reference/template.md` (postmortem
structure), `sre-release/reference/launch-checklist.md`.

Provenance: Google SRE book, 1st edition (`sre.google/sre-book`, free) and
DORA (`dora.dev`), both trawled September 2026.
