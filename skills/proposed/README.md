# Proposed skills — for review, not for use

Sixteen skills distilled from the Google SRE book and DORA's research, plus two
reference files. **None of this is Phase 17/18/20 work.** It arrived after those
scopes were set, so it sits here rather than in `skills/testing/` or
`skills/engineering/`, and the directory deletes cleanly if it isn't wanted.

This is Martin's version of an exercise Emil has already done. `ROADMAP.md` shows
four SRE chapters already mined — ch. 6, 17, 21-22, and ch. 8 deliberately skipped
as covered elsewhere. This set worked the same book end to end instead of
selecting from it. **The overlaps are a second opinion, not a correction; the rest
is coverage that wasn't there.** Emil decides what, if anything, is worth keeping.

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

**No overlap — chapters not yet mined:**
ch. 3-5 (risk, SLOs, toil) · ch. 7 (automation safety) · ch. 9 (simplicity) ·
ch. 12-16 (troubleshooting, incident command, postmortems) · ch. 18 (software
engineering) · ch. 23-27 (consensus, cron, pipelines, data integrity, launches).

**Not in the book at all:** `sre-agents`, `sre-cost`, `dora`, `dora-capabilities`.

## Something worth knowing either way

**There is a 2nd edition of the SRE book** — Beyer, Jones, Leng, Huska, Petoff,
Murphy — and it has chapters the 2016 edition doesn't: "Safety Engineering for
Software: Beyond Reacting to Failure" and "AI for SRE". Both of these sets were
built from the **1st** edition, which is the one published free at
`sre.google/sre-book`. The 2nd is paywalled on O'Reilly and neither of us has
read it. Given how much of `skills/` traces to this book, it's probably worth a
look before mining it further.

## What to be sceptical about

- **The format doesn't match the house convention.** These are
  `<name>/SKILL.md` with YAML frontmatter, written for Claude Code's `Skill`
  discovery — not `cah-pwa/skills/`'s *What this skill is for / Inputs / Output
  format / Rules / Worked example / How Emil invokes this skill*. Anything
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

**Router** — `sre` (routing table, core tenets, what the 1st edition gets wrong)

**Design-time** — `sre-code`, `sre-architecture`, `sre-testing`

**Runtime** — `sre-slo`, `sre-monitoring`, `sre-release`, `sre-incident`,
`sre-postmortem`, `sre-overload`, `sre-data-integrity`, `sre-toil`

**Cross-cutting** — `sre-agents`, `sre-cost`

**Delivery** — `dora` (the five metrics, benchmarks, misuse),
`dora-capabilities` (symptom → capability diagnosis)

**Reference files** — `sre-postmortem/reference/template.md`,
`sre-release/reference/launch-checklist.md`

Provenance: Google SRE book, 1st edition (`sre.google/sre-book`, free) and
DORA (`dora.dev`), both trawled September 2026.
