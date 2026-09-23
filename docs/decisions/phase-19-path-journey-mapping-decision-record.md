# Phase 19 Decision Record — Path and Journey Mapping (Locked)

Date: 2026-09-23
Scope: Combine the crawl page graph and introspect's actionable elements
into a walkable site graph, surface candidate user journeys for review,
and generate end-to-end tests that walk selected paths.
Status: Approved, implemented, Gate B met 2026-09-23 (`a9df7af`) — TFP-096 remains, not gating

## Context

`docs/decisions/product-roadmap.md`'s Phase 19 paragraph is one sentence
of intent, not a spec — thinner than Phase 18's, which already had a
confirmed addendum to build from. Rather than invent journey-selection
heuristics or review-UI mechanics that were never decided, this record
locks what's already true (independent of Phase 18; builds on data
Phase 17/prior crawl work already produces) and marks the genuine open
questions `[PLACEHOLDER]` for Emil to answer before the affected tickets
start. TFP-088 (the graph itself) does not depend on any of them and can
start immediately; TFP-089–091 were blocked until they're answered.
Decisions 4-6 are now resolved (Emil, 2026-09-23) — see below. All three
were answerable without TFP-088's output (product/UX calls, not
implementation details), except Decision 6's exact numbers, which are
deliberately marked as a starting default rather than a tuned one; see
Decision 6.

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

4. A candidate journey is either an automatically-detected form-submit
   path or an explicitly named config-supplied flow.
- Resolved (Emil, 2026-09-23): two sources, both real, neither guessed.
  Automatic: any path through the graph that ends in a form-submit
  action is a candidate — no config required, works on any site out of
  the box, mirrors how TFP-085's dependency tests need no per-site
  config either. Explicit: the run config may also name specific flows
  by label (e.g. `"signup"`, `"checkout"`) as an entry page + exit page
  pair; TFP-089 finds the path between them the same way it finds any
  other path (see Decision 6's length cap).
- Ranking: a named-flow match always ranks above an automatic match —
  it's explicit intent, not a guess, the same principle Phase 18's
  Decision 4 correction landed on (don't treat an inferred label as
  equivalent to a stated one). Among automatic matches, shorter paths
  rank above longer ones (fewer hops is a stronger "this looks like a
  real journey" signal than a long incidental one).
- Duplicate paths (same page sequence found both ways) are surfaced
  once, keeping the higher rank.
- Amended (Emil, 2026-09-23, during TFP-088 verification): a named
  flow's `exitPath` doesn't have to be a graph node. TFP-088 confirmed
  the graph stops at a form-submit edge, because introspect never
  submits a form - it observes, it doesn't act (real live-target
  evidence: `the-internet.herokuapp.com`'s `/login` -> `/authenticate`
  is an edge, but the post-login redirect to `/secure` is not, since
  nothing actually logs in during introspection). A login-style named
  flow (entry `/login`, exit `/secure`) would never resolve under a
  strict "exit must be a graph node" reading of the decision above.
  Resolved: TFP-089 matches a named flow as far as the graph goes (the
  form-submit edge counts as reaching it) and carries the declared
  `exitPath` on the candidate as unverified. TFP-091 - which already
  submits the form, since journey tests are interactive/side-effecting
  per Decision 2 - makes reaching the declared `exitPath` part of its
  generated test's assertion. This keeps introspection read-only (no
  new side effects added at graph-build time) and puts exit
  verification exactly where side effects are already permitted, rather
  than adding a new form-submitting introspection pass (rejected: would
  break the read-only model Decisions 1 and 2 both rely on) or requiring
  every named flow's exit to already be a graph node (rejected: would
  silently fail to find the login/checkout-style flows named flows exist
  for in the first place).

5. Candidate journeys are surfaced through a new UI screen, not a
   report-only list.
- Resolved (Emil, 2026-09-23): a dedicated screen lists ranked
  candidates from TFP-089 with a per-journey select control and a
  "Generate selected" action, mirroring the existing best-practice-area
  selection UI already in the app. Selecting and generating writes the
  selection into run config for TFP-091 to read — not a report the user
  reads and manually re-runs `generate` against.
- This makes TFP-090 a UI ticket, not a report-section ticket.

6. Starting caps: max path length 6 hops, max 20 journeys surfaced.
- Resolved (Emil, 2026-09-23) as a starting default, explicitly
  revisable once TFP-088 shows real graph sizes on an actual target —
  not a final, data-backed number.
- No separate graph-size cap is needed: `MAX_CRAWL_PAGES` already bounds
  crawl output to 100 pages (`src/app/api/crawl/route.ts`), so TFP-088's
  graph is already bounded to at most 100 nodes before Phase 19 adds
  anything. The two caps that actually need a Phase-19-specific number
  are journey path length and how many ranked candidates get surfaced.
- Max path length 6: long enough for a realistic multi-step flow
  (landing → category → detail → cart → checkout → confirmation is 5
  hops) without walking into combinatorial path counts on a 100-node
  graph. Max 20 journeys surfaced: keeps TFP-090's review screen a list
  a person can actually read, not a data dump.
- Both numbers are configuration, not architecture — TFP-089 should
  read them as constants it can tune, not something hardcoded three
  layers deep, so the "revisit after real data" step is cheap.

## Acceptance Criteria

1. Site graph (TFP-088 — not gated on the placeholders above)
- Against a real multi-page target, the graph's edges match actual
  navigable actions on that target (a link or form-submit that really
  leads from page A to page B), not an inferred or assumed connection.

2. Journey identification (TFP-089)
- Against a real target with a known multi-step form-submit flow (e.g.
  a 2-3 page checkout or signup), that exact path is surfaced as a
  ranked candidate, naming its actual pages and the actionable element
  connecting each step - not an inferred or assumed sequence.
- A config-named flow (entry page + exit page pair) produces the
  matching path and ranks above any automatically-detected candidate
  covering the same pages.
- No candidate exceeds the 6-hop path-length default; no more than 20
  candidates are surfaced.

3. Review and selection (TFP-090)
- Candidate journeys from TFP-089 appear listed in the new UI screen,
  each with a select control.
- Selecting one or more journeys and using "Generate selected" carries
  exactly that selection into run config - not every candidate, and not
  none.

4. Generation (TFP-091)
- Against a real target, a selected multi-step journey runs as one
  generated test that asserts each step in sequence (not a bare "page
  loaded" check), and is skipped by default per Decision 2 like any
  other interactive test.
- For a named-flow journey with a declared `exitPath` beyond the graph
  (Decision 4's amendment), the generated test's final assertion is
  that the app actually reaches `exitPath` after submitting - not just
  that the submit produced no error.
- A selected journey joins the functional discovered surface for
  coverage purposes, same as any other discovered element: generated
  and run counts as covered; generated but skipped (interactive tests
  not enabled for the run) is bucketed under a dedicated
  `interactive-skipped` reason, never silently "covered" and never
  conflated with `generator-gap`; not selected at all is `not-selected`.
- Verifying this against a real run surfaced a pre-existing defect,
  fixed in the same ticket: discovered-coverage matched executed test
  titles against title builders that omit the `TFxx-000:` id prefix a
  real Playwright run reports, so every discovered element across
  functional, accessibility, reliability, and storage matching alike
  came back uncovered/generator-gap on any real run, undetected because
  RUN-10/RUN-11's unit tests used bare titles. See `TEST_PLAN.md`'s
  RUN-15 for the live probe and the fix; GEN-19 covers the
  `interactive-skipped` bucket specifically.

## Regression Policy

- `TEST_PLAN.md` gets a case for the graph matching a real target's
  actual navigable structure as soon as TFP-088 lands.
- Once TFP-089 lands: a case proving a real target's known form-submit
  flow is found and correctly ranked, and a case proving a path beyond
  the 6-hop default is excluded (not silently truncated into a shorter,
  wrong candidate).
- Once TFP-090 lands: a case (in the self-test smoke or regression
  suite, per this repo's existing UI-testing pattern) proving a
  selection made on the review screen reaches run config unchanged.
- TFP-091 landed (GEN-19, RUN-15): a case proving a real selected
  journey runs as one test asserting every step, against a real target,
  plus the coverage-bucketing case for `interactive-skipped` and the
  id-prefix matching defect found and fixed while verifying it.
- All landed in the same commit as the code they describe, per this
  phase's standing policy.

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
- **Priority:** P2
- **Suggested labels:** `feature`
- **Problem it solves:** turns the raw graph (TFP-088) into a bounded,
  ranked list of journeys worth showing someone — without this, the
  graph is data, not a feature.
- **Scope:**
  - Automatic candidates: walk TFP-088's graph for every path ending in
    a form-submit edge, up to Decision 6's 6-hop default.
  - Named-flow candidates: read an optional list of `{ label, entryPath,
    exitPath }` entries from run config; find the path from entryPath as
    far as the graph goes (same traversal, same length cap) - a
    form-submit edge counts as reaching the flow, per Decision 4's
    amendment, even when exitPath itself isn't a graph node yet.
    exitPath is carried on the candidate as declared-but-unverified;
    TFP-091 is what actually verifies it.
  - Dedupe identical page sequences found by both sources, keeping the
    higher-ranked (named-flow) entry.
  - Rank: named-flow candidates first, then automatic candidates by
    ascending path length (shorter first).
  - Cap the ranked list at 20 candidates (Decision 6's default); both
    the length cap and the count cap are named constants, not buried
    magic numbers, so they're cheap to retune after real data comes in.
- **Deliverables:**
  - Journey-identification module + a `CandidateJourney` type (path,
    source: automatic/named, rank).
  - `TEST_PLAN.md` cases per Acceptance Criteria §2 above.
- **Acceptance criteria:** per Acceptance Criteria §2 above.
- **Dependencies:** TFP-088.

### TFP-090 — Surface candidate journeys for review

- **Phase:** 19
- **Priority:** P2
- **Suggested labels:** `feature`, `ui`
- **Problem it solves:** without a review step, TestForge would generate
  tests for journeys nobody asked to see — the roadmap's own text says
  "for review," not "automatically."
- **Scope:**
  - New screen listing TFP-089's ranked candidates: path (page
    sequence), source (automatic vs. named-flow, per Decision 4), and a
    per-journey select control - same interaction shape as the existing
    best-practice-area selection UI.
  - A "Generate selected" action that writes exactly the selected
    journeys into run config, for TFP-091 to read.
  - No selection means no journey tests generated - same default-off
    posture Decision 2 already applies to interactive tests generally.
- **Deliverables:**
  - New review screen + selection-to-run-config wiring.
  - A self-test case (smoke or regression suite, matching this repo's
    existing UI-testing pattern) proving a made selection reaches run
    config unchanged.
- **Acceptance criteria:** per Acceptance Criteria §3 above.
- **Dependencies:** TFP-089.

### TFP-091 — Generate end-to-end tests for selected journeys

- **Phase:** 19
- **Priority:** P2
- **Suggested labels:** `feature`, `generate`
- **Problem it solves:** the actual deliverable the roadmap paragraph
  promises — tests that "walk selected paths end to end rather than
  page by page."
- **Scope:**
  - Read TFP-090's selected journeys from run config; generate one
    end-to-end test per selected journey, walking the path's actual
    pages/actions in sequence.
  - For a named-flow journey whose declared `exitPath` (Decision 4's
    amendment) isn't a graph node - i.e. it sits beyond the flow's last
    form-submit - the generated test's final assertion is that the app
    actually reaches `exitPath` after submitting, not just that the
    submit didn't error. This is where the flow's exit is verified for
    real, since TFP-089 only recorded it as declared.
  - Skipped by default per Decision 2 (inherited interactive-test rule),
    explicitly enabled per run like other interactive tests.
  - Counted toward discovered-surface coverage the same way TFP-085's
    dependency tests are (Phase 18's precedent), rather than living in a
    separate report section.
- **Deliverables:**
  - Generator changes producing journey tests from TFP-090's selection.
  - `TEST_PLAN.md` case proving a real journey test walks a real
    multi-step path against a real target and produces a specific,
    named pass/fail.
- **Acceptance criteria:** per Acceptance Criteria §4 above.
- **Dependencies:** TFP-090.

### TFP-096 — Named-flow entry in the run-config UI

- **Phase:** 19
- **Priority:** P3
- **Suggested labels:** `feature`, `ui`
- **Problem it solves:** TFP-089 reads named flows (Decision 4) from an
  optional `namedFlows` body field on `/api/introspect`, but nothing in
  the app lets a user enter one — named flows are API-only today.
  Flagged by Claude Code while building TFP-089, and confirmed against
  the real UI before answering: `src/app/page.tsx` already has exactly
  this shape of field (`contentPathsInput`, `requiredHeadingsInput`,
  `requiredTextInput`, `forbiddenTextInput`), free-text lists under a
  collapsible advanced section (`isContentRulesCollapsed`) — a named-
  flow field fits that same slot.
- **Scope:**
  - A free-text input in that same advanced section, parsed into
    `{ label, entryPath, exitPath }` entries and passed as
    `/api/introspect`'s `namedFlows` field — same parsing shape as the
    existing content-rule inputs, not a new form-building pattern.
  - Resolved (Emil, 2026-09-23): this is its own small ticket, not part
    of TFP-090's scope. TFP-090 reviews whatever journeys TFP-089
    already produced, automatic or named, regardless of how a named one
    was defined — it doesn't need to know or care.
- **Deliverables:**
  - Input field + parsing + wiring into the introspect request.
  - `TEST_PLAN.md` case proving a named flow entered through the UI
    produces the same ranked candidate a direct API call with that flow
    would.
- **Acceptance criteria:**
  - A named flow entered in the UI appears in TFP-090's review screen
    exactly as it would if supplied directly to the API.
- **Dependencies:** TFP-089 (reads the field); independent of TFP-090
  and TFP-091 — can be built in parallel with either, or after.
- **Landed:** one flow per line as `label: /entry -> /exit` (`=>` and the
  arrow character also accepted), in the Content Rules section beside the
  other free-text lists. Unlike those lists it splits on newlines only,
  since a label may contain a comma. A line that does not parse is named
  in an inline message rather than silently dropped. Editing the flows
  after generating makes the suite stale, like the other content-aware
  inputs. Real credentials for a flow are Phase 20's (stored, never
  inline); this field carries only the entry and exit paths.

## Recommended Execution Order

1. TFP-088 (unblocked, start now)
2. ~~Emil answers Decisions 4–6~~ — done, 2026-09-23, before TFP-088
   landed.
3. TFP-089 → TFP-090 → TFP-091, in sequence (each genuinely depends on
   the previous one's output, unlike Phase 18's parallel tickets)
4. TFP-096, any time after TFP-089 — doesn't block or depend on
   TFP-090/091, so it can slot in wherever's convenient, including in
   parallel with them.

## Suggested Milestone Gates

### Gate A — Graph built
- TFP-088 landed with a real `TEST_PLAN.md` case against a real target.

### Gate B — Phase 19 complete
**Met, 2026-09-23 (`a9df7af`).**
- Decisions 4–6 answered, 2026-09-23, before TFP-088 landed.
- TFP-089–091 landed against real targets, each with a `TEST_PLAN.md`
  case proving real (not assumed) behavior: GEN-18 (review screen,
  fixture site), GEN-19 (journey generation, fixture site +
  `the-internet.herokuapp.com` live), INT-09 (journey identification,
  same live target). RUN-15 covers the coverage-bucketing side
  specifically, including the id-prefix defect found and fixed while
  verifying TFP-091 — see Acceptance Criteria §4.
- TFP-096 (named-flow UI entry) is not required for this gate — named
  flows work end-to-end via the API today, and TFP-096 only closes the
  UI gap. Land it whenever convenient; don't hold the phase open for it.
