# Phase 23 — sre-release + sre-toil Trial: test-assist's Update/Rollback Path

**Version:** 1.0
**Date:** 2026-09-16
**Status:** Draft — for review, not yet started

## Context

Reviewing `skills/proposed/`'s overlap table raised a specific question:
`verified-release-pipeline` (the existing account skill) and `sre-release`
(Martin's proposed candidate) were flagged as overlapping on ch. 8, with
`sre-release` also carrying "launch coordination and progressive rollout"
that the existing skill doesn't cover. Checked precisely, not by
inference — read both skills' full text. The line is exact:
`verified-release-pipeline` proves a built artifact runs correctly before
it's attached to a release and stops there; `sre-release` continues past
that point into staged rollout, canarying, feature flags, and rollback.

Checked against `test-assist`'s real setup (not hypothetically) because
Emil described this as an actual, felt pain point — "frustrating trying to
get a proper update or rollback working" — not a theoretical gap:

- **`release.yml`** (desktop/PySide6 build) already implements
  `verified-release-pipeline` properly — tag-triggered, `workflow_dispatch`
  for rehearsal, and a real verify step (`--version`/`--selftest` probes
  written to file, since the windowed build has no usable stdout). No gap
  on the "does the build actually work" front.
- **`python/update_check.py`** is deliberately manual: no on-launch poll, no
  telemetry, no auto-download, stated explicitly in its own docstring as a
  constraint (corporate-machine QA tool; an app that phones out gets
  banned from the estate). This means `sre-release`'s thundering-herd/
  jitter material doesn't apply — there's no automatic polling to
  stampede.
- **There is no rollback mechanism at all, for either build.** Desktop: an
  old `.zip` sits on the GitHub Releases page; `UpdateChecker` only ever
  checks `releases/latest`, with no way to mark a release bad or point
  users back. Browser build: `pages.yml` deploys to every visitor
  instantly on every push to `main`, no staging, no canary; reverting
  means reverting the commit and waiting for a full CI run.

## Scope (this phase)

### In scope
1. Apply `sre-release`'s rollback/staged-rollout material and `sre-toil`'s
   toil-ledger framework to `test-assist`'s real update/rollback
   situation — both builds, findings printed and recorded, same pattern
   as TFP-039's `CALIBRATION.md` and TFP-036's
   `INTROSPECT_CRAWL_SPIKE.md`.
2. Propose (not necessarily fully build) a concrete rollback path for
   each build, scoped to what actually fits a manual-update, no-telemetry,
   corporate-constrained tool — not a generic "add feature flags"
   prescription that assumes infrastructure this project doesn't have
   and, per its own stated constraints, shouldn't.

### Out of scope
- Implementing full staged/canary rollout infrastructure — that's a
  larger lift than this ticket's trial scope; a follow-up ticket if the
  findings justify it.
- Any change to `update_check.py`'s manual-only design constraint — that
  was a deliberate decision, not an oversight, and isn't being
  second-guessed here.
- Promoting `sre-release` or `sre-toil` into `skills/testing/` or
  `skills/engineering/` — this is a trial, same as the earlier
  `sre-code`/`sre-architecture` read-only pass, not a promotion decision.

## Backlog

### TFP-052 - Trial sre-release + sre-toil against test-assist's real update/rollback gap

- **Phase:** 23
- **Priority:** P2
- **Suggested labels:** `investigation`, `skills`, `test-assist`
- **Problem it solves:** a real, felt pain point (getting a proper update
  or rollback working) has no owner — `verified-release-pipeline` doesn't
  cover it by design, and nothing else in this repo currently addresses
  it either.
- **Scope:**
  - **Toil ledger, `sre-toil`'s six-property test, applied to the actual
    current process** for handling a bad release: what happens today,
    step by step, when `v1.4.0` turns out to be broken, for each build.
    Classify it — this is very likely toil (manual, repetitive if it
    recurs, automatable, no enduring value), but do the actual
    classification rather than assume it.
  - **Desktop build rollback, scoped to what fits:** `UpdateChecker`
    already has a clean seam (`interpret()` is pure, already tested with
    literal payloads per its own docstring) — propose the minimal
    addition that lets a release be marked bad without violating the
    manual-only constraint (e.g., checking a small denylist/known-good
    marker alongside `releases/latest`, still only on explicit user
    action, still no telemetry). Print the proposal; only implement it if
    it's genuinely minimal and doesn't expand the update checker's
    footprint beyond what its own docstring commits to.
  - **Browser build rollback, scoped to what fits:** `pages.yml` has no
    staging today. Propose the smallest real fix — this could be as
    simple as documenting a fast revert-and-redeploy runbook (time it for
    real, don't estimate), or, if genuinely cheap, a manual approval gate
    before `deploy-pages` for anyone who wants a pause-point. Don't
    propose a canary/staged-rollout system sized for a team when this is
    a single-maintainer static site — match the fix to the actual
    scale.
  - Findings and proposal go in a new doc,
    `docs/RELEASE_ROLLBACK_TRIAL.md` in `test-assist` (not `testforge` —
    this is about `test-assist`'s real release process, the same pattern
    TFP-036 used for a `testforge`-side finding about `testforge`'s own
    code).
- **Deliverables:**
  - `test-assist/docs/RELEASE_ROLLBACK_TRIAL.md` — the toil
    classification, the current-process walkthrough, and the two scoped
    proposals (desktop, browser).
  - A one-line pointer from `testforge/skills/ROADMAP.md`'s `sre-release`/
    `sre-toil` overlap notes to this finding, so it isn't lost the way
    TFP-036 sat unresolved for a full engagement's length.
- **Acceptance criteria:**
  - The toil classification is a real application of the six properties
    to the actual current process, not a restatement of "this seems
    annoying."
  - Both proposals are scoped to what this specific project's actual
    constraints (manual-only updates, no telemetry, single maintainer)
    can support — not generic best-practice advice that assumes a team
    and infrastructure that doesn't exist here.
  - If either proposal is implemented as part of this ticket (optional,
    only if genuinely minimal), it's covered by a real test the same way
    `update_check.py`'s existing pure functions already are.
- **Dependencies:** None.

## Recommended Execution Order

Single ticket.

## Suggested Milestone Gates

### Gate A - The felt pain point has an actual answer
- `RELEASE_ROLLBACK_TRIAL.md` exists with real findings, not a still-open
  question.
