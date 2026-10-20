# Phase 46 Decision Record — App Screens: Site Lookup, the Confirmation, Promotion and the Active Switch

Date: 2026-10-20
Scope: Give the app screens for settings that are API-only today:
- a **site lookup**: search one site by its URL to see and change its
  ownership confirmation (Phase 43) and gap-writer opt-in (Phase 42). There
  is no list of sites;
- a **promotion screen** for candidates (Phase 42);
- the **active switch** in the run form (Phase 43).

What Emil sees and approves is decided here. TestForge still never writes
into the repo.

Status: **Locked (Emil, 2026-10-20). Not started.** Decisions, acceptance criteria and tickets approved; AC1 revised to a site lookup at his request.
- This is R5's second decision record (`post-phase-42-review-plan.md`).
- Its build order: straight after Phase 43, before D1
  (`deferred-work-register.md`).
- Tickets TFP-232 to TFP-235.

## Context

- **API only today:**
  - the gap-writer opt-in (`/api/site-settings`, TFP-194);
  - candidate promotion (`/api/candidates`, TFP-196);
  - Phase 43's confirmation (TFP-218).

  Phase 42's batch 2 ruling 3 left their screens for this review.
- **Phase 20's login config** got its screen in TFP-097. This phase follows
  that pattern: the API stays the source of truth, and the screen calls it.
- **Promotion is a library commit through Claude Code** (Phase 42 Decision
  8; `src/lib/candidates/promotion.ts`).
  - `promoteApproved` writes the approved entries, and Claude Code commits
    them.
  - Only a candidate that meets the rule is offered. A rejection is kept
    with its reason.
- **Phase 43's run switch** (`TESTFORGE_ACTIVE`) is a choice made per run,
  like interactive.

## Decisions

1. A site lookup, not a list (Emil, 2026-10-20).
- **Why:** a list of every site, with its confirmation, would show what's
  being tested, and by whom, to anyone at the screen. Per-site settings are
  reached by naming the site.
- **The search field:**
  - the tester types or pastes a URL;
  - TestForge reduces it to its site (scheme, host and port: the origin, as
    `/api/site-settings` does today);
  - it shows that site's entry only.
- **Exact match only:**
  - no suggestions;
  - no partial matches;
  - no "all sites", in the app or in the API.

  A site with no data shows "nothing saved for this site", the same as one
  never seen, plus the actions below.
- **The entry shows:**
  - **confirmation:** none, valid (until when), expired or withdrawn; its
    hosts, basis, name and scopes;
  - **contact email:** masked, e.g. `e***@gmail.com`. The full address is
    only in the local file;
  - **gap writer:** off, Claude Code or the local model;
  - its saved suites, with when each was last run.
- **What can be done from the entry:**
  - create or renew a confirmation;
  - withdraw it, after a second "withdraw" click;
  - set the gap writer.
- **A new confirmation or setting** is written into the same results area,
  as if the site had just been searched. The tester sees the saved entry
  straight away, read back from the API.
- **The run form** opens the lookup with the target's URL already searched.
  Searching is the act of naming a site. The confirmation's own host field
  still starts empty (Decision 2).
- **Later, with users (the SaaS phase, `saas-prerequisites.md`):** only the
  person who confirmed a site, or someone they share it with, sees its
  entry. Deferred: TestForge has no user identity yet.

2. The confirmation form keeps its friction (Emil, 2026-10-20).
- **Hosts are typed by hand,** one per line. Never pre-filled from the URL
  field: typing them is the act of naming what's covered.
- **The basis** is chosen: "I own this site", or "I have written permission
  to test it".
- **The full statement** is shown and must be ticked. It includes:
  - the legal note (Phase 35 Decision 8);
  - the practice-site rule (Phase 43 Decision 12).
- **Name and contact email** are required.
- **Expiry** defaults to 90 days, with a date picker that can't go past 1
  year.
- **The active and load-testing ticks** are off by default. Each says what
  it allows.
- **Refusals come from the API.** The screen shows them as returned
  (Phase 43 Decision 13). It doesn't duplicate the rules.

3. The promotion screen: approve, then Claude Code commits (Emil,
   2026-10-20).
- **It lists the candidates the rule offers.** For each one:
  - its pattern;
  - its code, read-only;
  - its evidence: the sites and runs, gates passed, real defects caught,
    unlabelled failures (`promotionVerdict`'s reasons, in words);
  - **every site it ran on, named by host,** in plain view, so evidence
    across several sites can be compared quickly (Emil, 2026-10-20).
    Promotion is Emil's own decision on a candidate, not a browse of
    sites.
- **Approve or reject.**
  - A rejection needs a reason, kept with it (Phase 42).
  - Candidates below the rule aren't offered, so they can't be approved.
- **Approved candidates** are listed as "waiting to be committed", with the
  one-line pointer to give Claude Code. Claude Code runs `promoteApproved`
  and commits the entries, reviewed like any code.
- The app never writes into the repo.

4. The active switch in the run form (Emil, 2026-10-20).
- **Where:** next to the interactive toggle, labelled with what it sends:
  attack-shaped input.
- **On a remote host without a valid confirmation that has the active
  tick:**
  - the switch is disabled;
  - it shows why (none, expired, withdrawn, host not covered, no active
    tick), using Phase 43's reasons;
  - it links to the site's entry in the site lookup.
- **On a local host:** always available (Phase 43 Decision 7).
- **The API still decides.** A run started through the API with the switch
  on but no cover gets Phase 43 Decision 8's Not-run reasons, whatever the
  screen showed.

5. Scenario tests and candidates in the report keep their own sections.
- They are unchanged in shape, outside the verdict.
- This phase adds no new report screen.

## Acceptance Criteria

1. Site lookup
- **The lookup:** a site's URL, in any form (path, query, trailing slash),
  finds its entry.
- **No list:** a partial host, or another site's path, finds nothing.
  Neither the app nor the API offers any way to list sites. A test checks
  the API has no listing route for sites or confirmations.
- **Email masked:** the contact email is shown masked.
- **Results area:** a new confirmation or setting appears in the results
  area at once, read back from the API.
- **Through the API:** creating, renewing and withdrawing a confirmation,
  and changing the gap writer, each go through the API. The result shows
  after a reload.
- **Withdrawal:** needs the second click.

2. Confirmation form
- **Hosts:** the host field is empty when opened from a run whose URL is
  set.
- **Required:** the statement must be ticked; name and email are required.
- **Expiry:** the picker stops at 1 year, and 90 days is preselected.
- **Ticks:** active and load are off when opened.
- **API refusals:** each one (a wildcard, an invalid email, an expiry too
  long) is shown with its reason.

3. Promotion
- **What's offered:** only candidates meeting the rule are listed. Each
  shows its pattern, code and evidence reasons, with every site it ran on
  named by host.
- **Rejecting:** a rejection without a reason is refused.
- **Approving:** an approval moves the candidate to "waiting to be
  committed", with the pointer for Claude Code.
- **No repo writes:** the app writes nothing into the repo. A test checks
  the working tree is unchanged after an approval.

4. Active switch
- **Remote, uncovered:** disabled, with the right reason for each of the
  five cases.
- **Remote, covered:** available with a valid confirmation that has the
  active tick.
- **Local:** always available.
- **The API decides:** a run through the API with the switch on and no
  cover gets Phase 43's Not-run reasons.

5. Unchanged
- **Regression suite:** passes, with new cases for each screen.
- **Template:** `check:template-unchanged` reports every fixed input identical against
  the recorded baseline (`TEMPLATE_BASELINE`). The count is whatever the
  check's input set holds at the time, 166 when this was written, not a
  fixed number.

## Regression Policy

- **`TEST_PLAN.md` cases:**
  - the site lookup: exact match, no partial match, no listing route, the
    masked email, results written in place;
  - each confirmation-form rule;
  - the promotion screen's offer, reject and approve;
  - the "waiting to be committed" list;
  - each active-switch state.
- **The regression suite** covers each screen, as Phase 20's login screen
  is covered.

## Related, deferred (not this phase)

- **A screen for scenario-test results,** beyond the report's section. Only
  if Phase 44's results need more than the report shows.
- **Load testing's run option.** With D24.
- **A screen for library entries** (browse or retire). Not asked for.

## Dependencies and order

- **Phase 43:** the confirmation API and the run switch.
- **The promotion screen** needs only Phase 42's API, so it can be built
  first.
- **In the build order:** straight after Phase 43, before D1. That way the
  confirmation doesn't stay API-only while the Standard sets are built.

## Backlog

### TFP-232 — The site lookup

- **Phase:** 46 · **Priority:** P2 · **Labels:** `ui`
- **Scope:** Decision 1. Acceptance Criteria 1.
- **Deliverables:**
  - the search field and the entry, calling the existing APIs by site;
  - the email masked on screen. Phase 43's API reads by site only, and it
    gains no listing route;
  - regression and `TEST_PLAN.md` cases.
- **Dependencies:** Phase 43's TFP-218.

### TFP-233 — The confirmation form

- **Phase:** 46 · **Priority:** P2 · **Labels:** `ui`, `security`
- **Scope:** Decision 2. Acceptance Criteria 2.
- **Deliverables:**
  - the form;
  - regression and `TEST_PLAN.md` cases.
- **Dependencies:** TFP-232.

### TFP-234 — The promotion screen

- **Phase:** 46 · **Priority:** P2 · **Labels:** `ui`
- **Scope:** Decision 3. Acceptance Criteria 3.
- **Deliverables:**
  - the screen;
  - the waiting list and pointer;
  - regression and `TEST_PLAN.md` cases.
- **Dependencies:** none (Phase 42's API).

### TFP-235 — The active switch in the run form

- **Phase:** 46 · **Priority:** P2 · **Labels:** `ui`, `security`
- **Scope:** Decision 4. Acceptance Criteria 4 and 5.
- **Deliverables:**
  - the switch, its states and reasons, and the link;
  - regression and `TEST_PLAN.md` cases.
- **Dependencies:** Phase 43's TFP-219; TFP-232.

## Recommended Execution Order

1. TFP-234.
2. TFP-232.
3. TFP-233.
4. TFP-235.

## Suggested Milestone Gates

### Gate A — Settings on screen
- TFP-232 to TFP-234 landed and independently verified.

### Gate B — The run form
- TFP-235 landed and independently verified.
- A walkthrough with Emil: confirm a local and a remote site, start a run
  with the switch, and approve a stand-in candidate.
