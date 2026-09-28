# TestForge Product Roadmap

**Version:** 1.0
**Date:** 2026-08-28
**Status:** Draft — phase outlines only; each phase is locked by its own decision
record before implementation starts

This document is the map across phases. It does not replace
`docs/decisions/phase-16-local-first-decision-record.md` or
`docs/decisions/phase-16-implementation-backlog.md`, which remain the locked,
ticket-level source for the work in progress now. Phases 17–21 below are
intentionally one paragraph each — they get their own decision record and
backlog when they are actually picked up, in the same style as Phase 16.

## Product Vision

TestForge tests any website with reproducible results, and shows what was
tested and how — not just what passed. A tester describes what to check in
plain English or picks from best-practice coverage areas; TestForge crawls the
site, inspects what's actually on each page, and generates a deterministic
Playwright suite from that inspection — no AI required for the core product.
Runs, evidence and coverage are persisted so two runs of the same site can be
compared and trusted. Later phases extend this to the dependencies a page
talks to, the paths a user can walk through it, and the logged-in state where
most real functionality lives. An AI-assisted generation path and a hosted
SaaS version are both deliberate, deferred extensions of this same foundation
— not the foundation itself.

## Current Functionality (Baseline, pre-Phase 16)

- Next.js UI; crawl, introspect, generate, run and report as five API routes.
- Deterministic suite generation from crawled/introspected pages plus
  best-practice coverage selection — no OpenAI key required.
- Optional OpenAI-backed generation as an alternate path (untested in CI,
  deferred as a product priority — see Phase 21).
- Async run lifecycle with live progress, cancellation, targeted rerun, and a
  seven-tab report with HTML export.
- Run state is in-memory only; nothing persists across a server restart.
- Coverage is computed from the tests that ran, not against a discovered
  surface — see Phase 17.
- Legacy FastAPI backend and a backend-proxy layer, both being removed in
  Phase 16.

## Scope

### In scope (locked for Phase 16, in progress)
1. Local-only posture; no deployment surface.
2. Removal of the FastAPI backend and the proxy layer.
3. Chromium-only execution scope.
4. Decomposition of the three oversized source files.
5. Documentation that matches the shipped product.

### In scope (roadmapped, not yet locked)
1. Persisted, comparable runs with an honest coverage denominator (Phase 17).
2. Integration-point mapping and dependency failure-injection tests (Phase 18).
3. Site path and user-journey mapping (Phase 19).
4. Authenticated testing via a dedicated automation account and a cached
   Playwright `storageState` (Phase 20).
5. AI-assisted generation evaluated against the deterministic baseline
   (Phase 21).

### Explicitly out of scope
- A deployed or hosted version of TestForge (deferred; see
  `docs/decisions/saas-prerequisites.md`, itself deferred to Phase 16D).
- Fully autonomous discovery of arbitrary login flows. Phase 20 is
  config-driven: the site owner supplies the login URL and field selectors
  once. General-purpose login-form discovery is a distinct, harder problem
  and is not assumed by this roadmap.
- Interactive tests that submit, mutate or trigger side effects by default on
  a live site. These are generated but skipped unless explicitly enabled per
  run (locked direction, formalized when Phase 18/19 tickets are written).
- API contract testing (asserting response shapes don't drift between runs).
  A natural extension of Phase 17's run persistence, but it turns TestForge
  into a contract-testing tool as well and is not assumed here.

## Development Phases

### Phase 17 — Run persistence and honest coverage
Runs get identity and land on disk: the config that produced the suite, the
suite itself, the result, and the captured evidence. Coverage is recomputed
against the discovered surface from crawl and introspect — pages, actionable
elements, selected practice areas — instead of against the tests that
happened to run, and the report gains a "not tested, and why" section.
Persisted runs unlock diffing two runs of the same site against each other.
This is the foundation every later phase depends on, including making the
AI-vs-deterministic comparison in Phase 21 measurable rather than a guess.

The pre-lock walkthrough this section's own Sequencing note calls for has
run: TFP-040/041/042 (`examples/`) exercised the real generator against
`test-assist`, compared against a hand-authored suite and against
`test-assist`'s own mature suite. Findings are scoped into tickets at
`docs/decisions/phase-17-walkthrough-backlog.md` — read that before drafting
this phase's decision record, not just this outline.

### Phase 18 — Integration mapping and failure injection
During crawl and introspect, TestForge records every outbound dependency a
page talks to — XHR/fetch targets, form action hosts, third-party scripts,
iframes, auth redirects, cookies set — and aggregates it into a dependency
map per site. Generated tests use Playwright's `page.route()` to block or fail
each dependency in turn and assert the page degrades gracefully rather than
breaking. This is observation plus deterministic testing, consistent with the
product's core thesis, and requires no AI. Depends on Phase 17 for the map to
extend the coverage denominator rather than living outside it.

**Scope addendum (TFP-062, confirmed):** the paragraph above, read literally,
only covers outbound network dependencies — `page.route()` can block or fail
a fetch, a redirect, a third-party script, but it cannot inject a local
browser-API failure. TFP-042's real comparison against `test-assist` found
its own suite covers exactly that other class: a session saved under an old
schema is discarded rather than half-read, and the app still works
(degraded) when `IndexedDB` itself is unavailable — neither reachable by
blocking a network request. This phase's scope is widened to include local
storage-API failure injection alongside the outbound-dependency map above:
seeding a corrupted/old-schema value before load, and mocking `indexedDB.open`
(or the equivalent storage entry point) to fail, asserting the app degrades
rather than crashing or half-reading. Sized the same way the rest of this
phase already is — deterministic, no AI, an extension of the same
degrade-gracefully thesis — not a general chaos-testing expansion. This
addendum is itself Phase 18's scope answer, not a placeholder for one: this
phase's own decision record, when drafted, locks the specifics (which
storage entry points, which corruption shapes) but does not need to
re-litigate whether local failure injection is in scope at all.

### Phase 19 — Path and journey mapping
The page graph from crawl and the actionable elements from introspect combine
into a walkable graph of the site. TestForge surfaces likely user journeys —
sequences of pages and actions — for review, and generates tests that walk
selected paths end to end rather than page by page. Independent of Phase 18;
sequencing between the two is a scheduling choice, not a dependency.

### Phase 20 — Authenticated testing
A site owner provisions a dedicated automation account, following setup
instructions TestForge ships with the product (the same pattern used for
Selenium automation accounts: exempted from lockout, rate-limiting, MFA
interruption and new-sign-in alerts). TestForge drives a config-supplied login
flow once per run and caches the resulting Playwright `storageState`; every
generated test in that run starts already authenticated. Credentials are
referenced by name from environment or a local secret store, never inlined in
generated code, and never captured in traces, screenshots or the HTML report.
Deliberately sequenced after Phases 17–19 are proven on public surface, where
the blast radius of a mistake is zero.

### Phase 21 — AI-assisted generation as a measured alternative
The existing OpenAI-backed generation path is brought back into active
development: given CI coverage, and evaluated against the deterministic
generator on the same sites using Phase 17's run persistence and diffing.
The product decision — default generator, opt-in, or user's choice per run —
is made from that comparison rather than in advance of it.
**Decided 2026-09-28 (TFP-100): Option B, additive gap-filling.** Retargeted
at the local (Ollama) model, since the OpenAI account is unfunded. The
deterministic template stays the default and always generates; the local
model is opt-in and fills only selected areas where the template wrote no
tests, with its tests labelled separately. Built in Phase 34, which first
gives the template its own performance, security and database coverage.

### Phase 35 — Comprehensive testing (outline, added 2026-09-28; not locked)
The best-practice suite is breadth: the same checks for every site, a few
tests per area, safe to run anywhere. A deep dive is depth: a separate run
the user starts for one area they are concerned about, such as security,
that goes as far into that area as the site allows. It is tailored to the
site (every page, every form, the journeys from Phase 19, the logged-in
state from Phase 20), writes many more tests, takes longer, and may need a
person to review what it finds. It is organised in levels of intrusiveness,
each opted into separately. For security, as the first example: **passive**
(read-only, safe on any site: headers and cookies on every page and after
login, mixed content, sensitive data in URLs, error pages that leak server
details); **authenticated** (needs the Phase 20 automation account: logout
really ends the session, logged-out users cannot reach logged-in pages, the
session cookie changes at login, and with two accounts one user cannot see
another's data); **active** (attack-shaped input into every field and URL
parameter, open redirects, probing for exposed files, login rate limiting).
Active testing of a site the user does not own or have written permission
to test is unauthorised security testing, which is illegal in most
countries, including South Africa. That level therefore requires an
explicit ownership or permission confirmation, recorded with the run. The
deterministic template supplies each level's core checks; this is where the
local model earns a role Option B could not give it after Phase 34: writing
site-specific scenarios on top of that core, behind the same gates, with its
tests labelled. Deep dives produce more ambiguous failures, so Phase 34's
deferred failure-triage gate becomes relevant here. Other areas follow the
same shape (performance: every page, repeated runs, a throttled network;
accessibility: a full automated scan and keyboard traversal of every page;
database: full create/read/update/delete per form). 

Direction so far (Emil, 2026-09-28; to be locked in the decision record):
- **Name:** "Comprehensive testing", beside the "Standard" best-practice
  run. This also avoids a clash with the existing "Deep" link-audit mode.
- **Order of areas:** security first, then SEO, then whichever areas prove
  highest-risk or most error-prone. The last should be decided from run
  history (which areas produce the most real failures), with reliability a
  candidate once GEN-32 is fixed. Still to discuss.
- **Reports:** comprehensive testing of a single area reports only that
  area. Comprehensive testing of all areas produces the summary report plus
  a per-area report for whoever wants the detail behind each issue.
- **Security standards (proposed):** OWASP ASVS 5.0 (May 2025) defines what
  is checked, the OWASP Web Security Testing Guide (v4.2) describes how, and
  findings are grouped in the report by OWASP Top 10:2025 category. The
  coverage statement lists which requirements were tested and which cannot
  be verified from a browser, the same "not tested and why" rule as Phase 34.
- **Active level (proposed):** drive ZAP (free, open source, Apache 2.0,
  runs headless in Docker) rather than build a scanner. TestForge scopes the
  scan, supplies the Phase 20 logged-in session, requires the ownership or
  permission confirmation, and translates ZAP's alerts into its own report.
- **Still open:** timing. A standard run on a real site measured about 70-80
  s for ~30 tests (2-5 s per test); comprehensive runs will be far longer, so
  the phase measures real durations for one area and for all areas, and
  decides whether all-areas runs are offered as a scheduled or overnight
  run, each area as its own job so partial results survive.

---

## Sequencing note

Phase 16 is followed by a live walkthrough of what it actually produced —
stepping through the crawl, introspect, generate and run flow against a real
target — before Phase 17's decision record is drafted. Phase 17's scope above
is a starting outline, not a lock; the walkthrough may change what "honest
coverage" needs to mean in practice before that phase is locked.

## Standing execution policy (from Phase 18 onward)

Two rules, set by Emil on 2026-09-23 after repeated stale-doc cleanup
passes cost real time across Phases 17-27 (headers claiming "Draft — not
started" for work that had actually shipped, found and fixed in bulk
during a 2026-09-23 verification pass rather than caught as each phase
landed):

1. **A defect found while building or verifying a ticket is fixed
   immediately, in that ticket** — not logged for a later cleanup phase.
   Phase 24 already drew this line for its two critical findings
   (TFP-065/066, fixed ahead of everything else in flight); it now
   applies to any defect found during Phase 18, 19, 20, or later, not
   only a dedicated audit pass.
2. **Documentation lands in the same commit as the work it describes.**
   `TEST_PLAN.md`, this roadmap, and any phase decision record are
   updated as part of the ticket that changes what they describe, not
   appended afterward. A phase decision record's own Backlog section
   states this per-ticket (see Phase 18/19/20's records) so it's visible
   at the point of work, not only here.

Both rules bind every phase from Phase 18 onward. They don't retroactively
apply to Phases 16-17, which are already shipped.
