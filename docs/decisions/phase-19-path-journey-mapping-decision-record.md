# Phase 19 Decision Record — Path and Journey Mapping (Locked)

Date: 2026-09-23
Scope: Combine the crawl page graph and introspect's actionable elements
into a walkable site graph, surface candidate user journeys for review,
and generate end-to-end tests that walk selected paths.
Status: Approved and in implementation

## Context

`docs/decisions/product-roadmap.md`'s Phase 19 paragraph is one sentence
of intent, not a spec — thinner than Phase 18's, which already had a
confirmed addendum to build from. Rather than invent journey-selection
heuristics or review-UI mechanics that were never decided, this record
locks what's already true (independent of Phase 18; builds on data
Phase 17/prior crawl work already produces) and marks the genuine open
questions `[PLACEHOLDER]` for Emil to answer before the affected tickets
start. TFP-088 (the graph itself) does not depend on any of them and can
start immediately; TFP-089–091 are blocked until they're answered.

**Standing policy for this phase:** same as Phase 18 — defects found
while building or verifying a ticket are fixed in that ticket, not
deferred; `TEST_PLAN.md` and doc updates land in the same commit as the
code they describe. See `product-roadmap.md`'s Sequencing note.

## Decisions

1. The walkable graph is built from data that already exists.
- Nodes are pages from the existing crawl page graph; edges are the
  actionable elements introspect already discovers (links, form
  submits, and other navigating actions) that connect one crawled page
  to another.
- No new discovery mechanism — this is composition of Phase 16/17's
  existing crawl and introspect output, not a new crawl pass.

2. Journey tests are interactive by the roadmap's own existing rule.
- Walking a journey end to end almost always means submitting forms or
  triggering side effects on the live site — the "interactive tests
  skip unless explicitly enabled per run" rule
  (`product-roadmap.md`'s "Explicitly out of scope" list, already
  locked) applies here directly. This is inherited, not a new decision:
  journey tests are generated but skipped by default, the same as any
  other side-effecting test.

3. Phase 19 is independent of Phase 18, confirmed by the roadmap's own
   text — sequencing between them is a scheduling choice, not a
   dependency, and this record doesn't change that.

4. `[PLACEHOLDER: what makes a path a "likely user journey" worth
  surfacing, out of however many paths a real site graph contains?
  Candidates: shortest path between two named entry/exit pages, any
  path ending in a form-submit action, paths matching a config-supplied
  list of named flows (e.g. "signup", "checkout"), or some combination.
  This is a real product decision, not an implementation detail — it
  determines what TestForge claims to have found, the same way the
  generator's best-practice-area selection already does. Needs an
  answer before TFP-089 starts.]`

5. `[PLACEHOLDER: how are candidate journeys "surfaced... for review"?
  A new UI screen listing candidates with a select/generate action
  (mirrors the existing best-practice-area selection UI), or a report
  section the user reads and re-runs generate against manually? This
  determines whether TFP-090 is a UI ticket or a report-only one. Needs
  an answer before TFP-090 starts.]`

6. `[PLACEHOLDER: is there a cap on graph size / journey count / path
  length? An uncapped walkable graph on a real multi-page site can
  produce a combinatorial number of paths — TestForge needs a stated
  bound (e.g. max path length, max journeys surfaced) before TFP-089 can
  be acceptance-tested against a real target rather than a toy one.]`

## Acceptance Criteria

1. Site graph (TFP-088 — not gated on the placeholders above)
- Against a real multi-page target, the graph's edges match actual
  navigable actions on that target (a link or form-submit that really
  leads from page A to page B), not an inferred or assumed connection.

2. Journey identification and review, generation (TFP-089–091 — gated on
   Decisions 4–6 being answered)
- Acceptance criteria for these are written when those tickets are
  unblocked, since they depend directly on the placeholder answers —
  writing them now would mean inventing the same specifics this record
  is deliberately not inventing.

## Regression Policy

- `TEST_PLAN.md` gets a case for the graph matching a real target's
  actual navigable structure as soon as TFP-088 lands. Cases for
  journey identification, review, and generated end-to-end tests are
  added when TFP-089–091 are unblocked and built — not stubbed in now
  against a spec that doesn't exist yet.

## Backlog

### TFP-088 — Build the walkable site graph from crawl + introspect output

- **Phase:** 19
- **Priority:** P2
- **Suggested labels:** `feature`, `crawl`
- **Problem it solves:** nothing today combines the page graph and
  actionable-element data into a single walkable structure — every
  later Phase 19 ticket needs this and it has no open design questions,
  so it can start now rather than waiting on Decisions 4–6.
- **Scope:**
  - Build a graph type: nodes are crawled pages, edges are the specific
    actionable element (link, form submit, or other navigating action)
    that connects them, sourced from existing crawl/introspect output —
    no new crawl pass.
  - Persist it alongside the existing per-`baseUrl` introspect/coverage
    data so later tickets can read it without recomputing.
- **Deliverables:**
  - Graph-building code + type.
  - `TEST_PLAN.md` case proving the graph's edges match a real target's
    actual navigation (pick a target with at least one multi-page flow).
- **Acceptance criteria:**
  - Against a real target, a known two-page navigation (e.g. a link from
    the landing page to a detail page) appears as an edge naming the
    actual element that produces it.
- **Dependencies:** None.

### TFP-089 — Identify and rank candidate journeys

- **Phase:** 19
- **Priority:** P3 (blocked)
- **Suggested labels:** `feature`, `blocked`
- **Problem it solves:** turns the raw graph (TFP-088) into a bounded,
  ranked list of journeys worth showing someone — without this, the
  graph is data, not a feature.
- **Scope:** Defined once Decisions 4 and 6 are answered — the ranking
  heuristic and the size/length bound are exactly what this ticket
  implements, and writing its scope before those answers exist would
  mean guessing the product decision this record deliberately left open.
- **Deliverables:** TBD, set when unblocked.
- **Acceptance criteria:** TBD, set when unblocked.
- **Dependencies:** TFP-088; Decisions 4 and 6 above answered.

### TFP-090 — Surface candidate journeys for review

- **Phase:** 19
- **Priority:** P3 (blocked)
- **Suggested labels:** `feature`, `ui`, `blocked`
- **Problem it solves:** without a review step, TestForge would generate
  tests for journeys nobody asked to see — the roadmap's own text says
  "for review," not "automatically."
- **Scope:** Defined once Decision 5 is answered (UI screen vs.
  report-only) — that answer determines whether this is a UI ticket or
  a report-section ticket, which are different shapes of work.
- **Deliverables:** TBD, set when unblocked.
- **Acceptance criteria:** TBD, set when unblocked.
- **Dependencies:** TFP-089; Decision 5 above answered.

### TFP-091 — Generate end-to-end tests for selected journeys

- **Phase:** 19
- **Priority:** P3 (blocked)
- **Suggested labels:** `feature`, `generate`, `blocked`
- **Problem it solves:** the actual deliverable the roadmap paragraph
  promises — tests that "walk selected paths end to end rather than
  page by page."
- **Scope:**
  - Generate one end-to-end test per selected journey, walking the
    path's actual pages/actions in sequence.
  - Skipped by default per Decision 2 (inherited interactive-test rule),
    explicitly enabled per run like other interactive tests.
  - Counted toward discovered-surface coverage the same way TFP-085's
    dependency tests are (Phase 18's precedent), rather than living in a
    separate report section.
- **Deliverables:**
  - Generator changes producing journey tests from selected paths.
  - `TEST_PLAN.md` case proving a real journey test walks a real
    multi-step path against a real target and produces a specific,
    named pass/fail.
- **Acceptance criteria:**
  - Against a real target, a selected two-step journey (e.g.
    landing → form submit → confirmation) runs as one test asserting
    each step, not a bare "page loaded" check.
- **Dependencies:** TFP-090.

## Recommended Execution Order

1. TFP-088 (unblocked, start now)
2. Emil answers Decisions 4–6
3. TFP-089 → TFP-090 → TFP-091, in sequence (each genuinely depends on
   the previous one's output, unlike Phase 18's parallel tickets)

## Suggested Milestone Gates

### Gate A — Graph built
- TFP-088 landed with a real `TEST_PLAN.md` case against a real target.

### Gate B — Phase 19 complete
- Decisions 4–6 answered; TFP-089–091 landed against a real target, each
  with a `TEST_PLAN.md` case proving real (not assumed) behavior.
