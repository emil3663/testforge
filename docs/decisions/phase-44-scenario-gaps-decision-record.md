# Phase 44 Decision Record — Scenario Gaps: What the Gap Writer Is For

Date: 2026-10-20
Scope: Redefine the gap writer's purpose: from inventory gaps (Phase 42) to
*scenario gaps*. A scenario gap is a behaviour or edge case nothing in the
suite exercises, such as a double submit or a resubmit after "back".
- **TestForge supplies the mechanics** as a vetted harness.
- **Claude Code supplies the judgement:** which scenarios apply to which of
  a site's flows, and what outcome must hold.
- **Every scenario type is proven able to fail** on a fixture with that
  defect planted before it is used on a real site.
- **Scenario tests stay outside the verdict** until measurement earns them a
  place (D6).

Slice 1 is scenarios 1, 2 and 6 of `scenario-gap-candidates-2026-10-19.md`.

Status: **Locked (Emil, 2026-10-20). Not started.** Decisions, acceptance criteria and tickets approved.
- This is R5's third decision record (`post-phase-42-review-plan.md`).
- Its build order: after D3 and before D10, with D19
  (`deferred-work-register.md`).
- It also needs Phase 43 (the confirmation) and Phase 45 (the sandbox).
- Tickets TFP-223 to TFP-227.

## Context

- **Phase 42's gap writer was not kept as a bug finder** (Gate B, 2026-10-15,
  TFP-197).
  - It scored 0 of 4.
  - What it wrote were checks that couldn't fail: a link is visible, has an
    `href`, and the `href` equals itself.
  - It wrote both *what* to test and *how*. It then revised each test until
    it passed on its own site, so it confirmed the site rather than testing
    it.
- **Emil's distinction (2026-10-15):**
  - an *inventory gap* (an element no test checks) is the template's job,
    closed deterministically (TFP-205);
  - a *scenario gap* is what a model's judgement is for.
- **Emil's ten scenarios** (`scenario-gap-candidates-2026-10-19.md`): none
  is covered today.
  - 1, 2 and 6 share one mechanism: control the network, then count the
    requests and the records that result.
  - 3, 4 and 9 need signed-in state.
  - 5, 7 and 10 need facts or time a single black-box run doesn't have.
  - 8 is deterministic and sits in D7.
- **What stays from Phase 42:**
  - the hardening (TFP-202);
  - the opt-in per site;
  - the default limit of 5 per generation;
  - site suites, reuse, candidates and promotion;
  - the coverage map.

## Decisions

1. A scenario test is built from a vetted harness, with Claude Code's
   judgement (Emil, 2026-10-20).
- **The harness** is TestForge code, reviewed and unit-tested like the
  template. Slice 1's helpers:
  - slow a chosen request;
  - submit twice;
  - go back and resubmit;
  - let a request reach the server, then drop its response;
  - count the requests a step sent;
  - count matching records on a read-only page or GET endpoint.
- **Claude Code decides:**
  - which catalogue scenarios apply to which of the site's flows;
  - where the result can be read back (an order history, a list page, a
    GET endpoint);
  - what outcome must hold.

  It writes the test using the harness only.
- **The code check refuses** any network control or request counting not
  done through the harness: `page.route` and its kin outside the helpers.
  The rest of TFP-202's check is unchanged.

2. A scenario test must be able to fail (Emil, 2026-10-20).
- **Per scenario type:** before a scenario type is used on any real site,
  the scenario fixture (TFP-223) proves it.
  - The fixture has a clean variant and a variant with that scenario's
    defect planted. Example: a double submit creates two records.
  - A test written for it must fail on the planted variant and pass on the
    clean one.
- **Per test, on a real site:** at least one assertion must rest on a
  harness observation. That means a request count, a record count read
  back, a response's status, or the page's state after a reload.
- **The code check also refuses tautologies:**
  - an assertion comparing a value with itself;
  - comparing it with the attribute or locator that found it;
  - a test whose only assertions are on the element it just acted on.
- **A test is not revised until it passes.** If it fails on its own site
  after the gates, it is reported as a finding, "failed: needs review",
  not rewritten to agree with the site. Revisions are allowed only for
  errors in the test itself: syntax, a locator that matched nothing, the
  code check.

3. How a scenario gap is found.
- **A catalogue** (`src/lib/scenarios/`) lists each scenario with:
  - its harness;
  - its gate (Decision 5);
  - its applicability rule.

  Example rule: "a form that creates a record" for 1, 2 and 6.
- **The candidate flows come from data TestForge already has:** the
  coverage map (Phase 42), the journeys (Phase 19) and the inspection's
  forms.
- A scenario gap is a pair, a catalogue scenario and an applicable flow,
  with no scenario test.
- **The report lists every pair:** tested, not tested and why (gate
  closed, no read-back found, writer off, limit reached). This is the
  `honest-coverage` rule.

4. Slice 1, then slice 2 (Emil, 2026-10-20).
- **Slice 1 (this phase):**
  - 1, double submit;
  - 2, back then resubmit;
  - 6, retry after a timeout: did the first request go through?
- **Slice 2, designed with D10 (authenticated and active security):**
  - 3, two tabs on one account;
  - 4, session expiry mid-flow.
- **Elsewhere:**
  - 8 (valid but unusual data): D7.
  - 9 (permissions removed): D10.
  - 5, 7 and 10 wait. They need an offer's end time from the owner, a
    later check of an inbox, or a record from an earlier release.

5. Gates (Emil, 2026-10-20).
- **Scenario tests change data on purpose:** duplicate or half-saved
  records.
- They run only in Comprehensive, at the interactive gate
  (`TESTFORGE_INTERACTIVE=1`).
- **On a remote host they also need Phase 43's ownership confirmation**
  covering the host. They aren't attack-shaped, so they don't need
  `TESTFORGE_ACTIVE`. But a tester shouldn't create duplicate orders on a
  site nobody confirmed.
- **On a local host,** the interactive gate alone.
- **Without the confirmation on a remote host,** each is Not run with the
  reason, as Phase 43 Decision 8 does.
- Under Phase 39 Decision 5 they keep their own fresh page, and they run in
  the serial group (Phase 39 Decision 9).

6. Outside the verdict until measured. This is D6 (Emil, 2026-10-20).
- Scenario tests are reported in their own section, "scenario tests". They
  never fail the run and change no count, as candidates are today.
- **A scenario type joins the verdict** only when its measurement shows
  both:
  - every planted defect of that type found on the fixture;
  - no unlabelled failure on the clean fixture, on clean Toolshop, or on 3
    real sites where it applies.

  Emil approves each type. The decision is recorded here.
- This answers D6 for model-written tests: they count when their type has
  earned it, never as a block.

7. The writer: Claude Code, opt-in per site, inside the sandbox.
- **The writer** is Claude Code, opt-in per site (Phase 42 Decision 6,
  unchanged), with TFP-202's hardening.
- **The sandbox:** scenario tests, and the candidates made from them, run
  only inside Phase 45's Docker sandbox. They are code a model wrote from
  text a site supplied.
- **Each test also yields a candidate** (Phase 42 Decision 8), bound by
  catalogue scenario and flow pattern. Promotion follows Phase 42's rule
  and Emil's approval.
- **The limit:** the default stays 5 scenario tests per generation.

8. Measured, and kept only if it clears the bar (Emil, 2026-10-20).
- **On the scenario fixture:**
  - each of slice 1's planted defects is found;
  - no failure is added on the clean variant.
- **Then on both local Toolshop copies:**
  - no unlabelled failure on clean;
  - every with-bugs failure is labelled.
- **Below the bar,** the scenario writer isn't kept, as at Phase 42's
  Gate B. The harness and the fixture stay. Recorded either way.

## Acceptance Criteria

1. The fixture
- **Variants:** for each slice-1 scenario, a clean and a planted variant,
  switchable.
- **Answer key:** says where each defect is and how it shows.

2. The harness
- **Coverage:** each helper is unit-tested on the fixture.
- **Deterministic:** the same result in 3 runs.
- **Read-only where it must be:** read-backs are GET-only, under the
  read-only guard.

3. The catalogue and the gaps
- **Pairs:** on the fixture and on local Toolshop, the report lists every
  scenario-flow pair with its state and reason.
- **Applicability:** a flow that creates nothing (a search, say) is not
  listed for 1, 2 or 6.

4. The writer and its checks
- **Only the harness:** a test using `page.route` outside the harness is
  refused before running.
- **Tautologies:** each refused form is refused with its reason.
- **An observation required:** a test with no assertion on a harness
  observation is refused.
- **Proof per type:** a test that passes on the planted variant isn't
  accepted for that type.
- **No revising to pass:** a failure after the gates is reported, not
  revised (shown by a stand-in writer).
- **Sandbox:** every scenario test runs inside Phase 45's sandbox (shown by
  its run record).

5. The gates
- **Remote, no confirmation:** each test is Not run with the reason.
- **Remote, with confirmation:** they run.
- **Local:** interactive alone.
- **Standard:** never runs them.
- **Verdict:** a failing scenario test changes no count.

6. Measurement (Gate B)
- **Recorded:** Decision 8's runs, with the writer's cost and time.
- **Applied:** the keep rule, as written.

## Regression Policy

- **`TEST_PLAN.md` cases:**
  - each harness helper;
  - each fixture variant;
  - catalogue applicability;
  - each code-check refusal;
  - the observation rule;
  - no revising to pass;
  - each gate case;
  - the report's scenario section;
  - the section staying outside the verdict.
- **Fixture documentation:** the fixture's new variants are documented
  beside its existing defects.

## Related, deferred (not this phase)

- **Slice 2:** scenarios 3 and 4, with D10.
- **Scenarios 5, 7 and 10:** owner facts, a later inbox check, or records
  across releases.
- **Scenario types joining the verdict:** per type, after measurement
  (Decision 6).
- **Practice sites:** SauceDemo and ParaBank as real sites for Decision 6's
  3-site rule (`practice-site-targets-2026-10-19.md`).

Each has a line in `deferred-work-register.md`.

## Dependencies and order

- **Phase 43:** the confirmation, for remote hosts.
- **Phase 45:** the sandbox. The harness and the fixture (TFP-223,
  TFP-224) can be built before it; the writer (TFP-226) can't run on a
  real site without it.
- **In the build order:** after D3, beside D19, before D10.

## Backlog

### TFP-223 — The scenario fixture, slice 1

- **Phase:** 44 · **Priority:** P1 · **Labels:** `test`, `fixture`
- **Problem it solves:** no fixture has a scenario defect. TFP-197's
  benchmark couldn't tell a useful gap test from a useless one.
- **Scope:** Decision 2 (per type). Acceptance Criteria 1.
- **Deliverables:**
  - the clean and planted variants for scenarios 1, 2 and 6;
  - the answer key;
  - `TEST_PLAN.md` cases.
- **Dependencies:** none.

### TFP-224 — The scenario harness

- **Phase:** 44 · **Priority:** P1 · **Labels:** `enhancement`, `generate`
- **Problem it solves:** without vetted mechanics, the writer writes its
  own, and its own can't be trusted.
- **Scope:** Decision 1's helpers. Acceptance Criteria 2.
- **Deliverables:**
  - the helpers, each unit-tested on TFP-223's fixture;
  - `TEST_PLAN.md` cases.
- **Dependencies:** TFP-223.

### TFP-225 — The catalogue and scenario gaps in the report

- **Phase:** 44 · **Priority:** P1 · **Labels:** `enhancement`, `report`
- **Problem it solves:** nothing says which scenarios a site's flows were
  never tested for.
- **Scope:** Decision 3. Acceptance Criteria 3.
- **Deliverables:**
  - the catalogue;
  - the applicability rules;
  - the pairs, with their states;
  - the report section;
  - `TEST_PLAN.md` cases.
- **Dependencies:** TFP-224.

### TFP-226 — Claude Code writes scenario tests

- **Phase:** 44 · **Priority:** P1 · **Labels:** `ai`, `security`, `generate`
- **Problem it solves:** the gap writer's purpose, redefined.
- **Scope:** Decisions 1, 2, 5, 6 and 7. Acceptance Criteria 4 and 5.
- **Deliverables:**
  - the prompt: page data marked untrusted; harness only; one catalogue
    scenario per test;
  - the code-check additions;
  - the observation rule;
  - no revising to pass;
  - the gates;
  - the report section outside the verdict;
  - candidates;
  - `TEST_PLAN.md` cases.
- **Dependencies:** TFP-225; Phase 43; Phase 45.

### TFP-227 — Measure the scenario writer (Gate B)

- **Phase:** 44 · **Priority:** P1 · **Labels:** `measurement`, `benchmark`
- **Scope:** Decision 8. Acceptance Criteria 6.
- **Deliverables:**
  - the fixture and Toolshop runs;
  - the cost and time;
  - an `outcome.md`;
  - the keep rule applied.
- **Dependencies:** TFP-226.
- **Stop at Gate B.**

## Recommended Execution Order

1. TFP-223 and TFP-224.
2. TFP-225.
3. TFP-226.
4. TFP-227.

## Suggested Milestone Gates

### Gate A — Mechanics proven
- TFP-223 to TFP-225 landed and independently verified.
- Every harness helper is proven on the fixture, and the report lists the
  pairs.

### Gate B — Writer measured
- TFP-226 and TFP-227 landed and independently verified.
- The keep rule is applied and recorded.
