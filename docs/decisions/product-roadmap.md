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
**Measured 2026-09-28 (Phase 34, TFP-120): with page data, gap-filling calls
the model on neither target.** The template now covers every area, or
reports it not applicable, on the fixture and on the-internet, and it catches
5 of the fixture's 6 defects (2 of 6 in Phase 21). The one remaining gap,
database without page data, gave one caught defect on the biased fixture and
one false failure on the real site. No UI control, confirmed by Emil; gap-filling
stays an env-var opt-in (`phase-34-option-b-measurement-report.md`). Phase 34
then closes that gap and the template's one missed defect directly: generation
inspects pages itself when none are supplied (TFP-122), and the accessibility
template checks every form field has an accessible name (TFP-121). A depth role for
the local model is Phase 35's question, not a wider definition of a gap.

### Phase 35 — Comprehensive testing (outline added 2026-09-28; first slice locked 2026-09-30)
**First slice locked 2026-09-30** (`phase-35-comprehensive-testing-decision-record.md`):
- a Comprehensive run for one chosen area, beside the unchanged Standard run;
- passive security on every inspected page;
- an axe-core WCAG 2.2 scan;
- the local model's scenarios labelled and kept out of the verdict;
- a fixed "what this run did not test" statement closing every report.

**Gate A verified 2026-10-01:** the Comprehensive run mode (TFP-132), with
the Standard run's output proved unchanged by the committed check (TFP-137).
TFP-138 (the Standard HTML export's tabs) was added at the gate.

**Gate B verified 2026-10-01: the first slice is complete.** It covers
passive security (TFP-133), the axe-core scan (TFP-134), and the model's
scenarios kept outside the verdict (TFP-135), measured on the fixture and
on the-internet (TFP-136). There is no unexplained failure on the real
site. Two follow-ups were added at the gate: TFP-139 (a model accessibility
suite that imports axe) and TFP-140 (server-error pages checked for leaks).

The permission confirmation for active testing is decided (a typed domain,
saved with the run) and will be built with the active level. The outline
below remains the longer-term direction.

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
- **Timing, measured 2026-10-01** (TFP-136,
  `phase-35-first-slice-measurement-report.md`). This replaces the earlier
  estimate (a Standard run of about 70-80 s for ~30 tests, with
  comprehensive runs expected to be "far longer"). At the default 20-page
  cap on the-internet, Comprehensive security took 224 s and accessibility
  155 s: about 11 s and 8 s a page, one test at a time. On the 3-page
  fixture each took about 5 s. Whether all-areas runs are offered as
  scheduled or overnight jobs, each area its own job so partial results
  survive, is still to be decided; they were not measured.

### Phase 36 — Trust in results, and measuring the local model (locked 2026-09-29)
Before comprehensive testing leans on the local model, TestForge stops
turning healthy sites red and finds out what the model can do on this
machine. Four suspected false failures on the-internet are resolved, not
suppressed; optional SEO items become findings; three small defects are
fixed. A committed benchmark then measures seven model and settings
configurations for speed, memory fit and code quality, and picks a winner
by a rule fixed in advance. See
`phase-36-trust-and-local-model-measurement-decision-record.md`.

### Phase 37 — Gap-fill prompt fix and two new model gates (locked 2026-09-30)
Phase 36's hand-read check found the local model's reliability and database
suites dropped from 3/3 to 1/3, and a six-call diagnostic traced the drop to
one sentence the gap-fill request appends. The request now names only the
gap areas, as a plain request would. Two failures the gates missed are now
caught mechanically: a Promise handed to a plain matcher, and tests with
identical bodies under different titles (GEN-32). The fix is measured by the
same hand-read check before Phase 35 relies on the model. See
`phase-37-gap-fill-prompt-and-model-gates-decision-record.md`.

### Phase 38 — Standard run: three gates, shared conformance checks, performance bands (complete; Gate A passed 2026-10-05, Gate B passed 2026-10-06)
The coverage proposal measured the Standard run against the published standards and found it broad but shallow. This phase makes three changes.

- **Three gates:** read-only, interactive, and active (behind the typed ownership confirmation).
- **Working path versus breaking:** Standard tests the critical working path; Comprehensive tries to break it.
- **Shared conformance checks:** Phase 35's read-only passive security checks and the axe scan join Standard through one implementation shared with Comprehensive. Performance is graded with Core Web Vitals' bands, where "needs improvement" is a finding and "poor" fails.

All eight decisions are locked (Emil, 2026-10-05). Until the ownership confirmation exists, the script-payload test is Not run (Decision 6). Builds after TFP-145. See `phase-38-standard-run-gates-and-conformance-decision-record.md`.


### Phase 39 — Run concurrency (locked 2026-10-06, not started)
Standard and Comprehensive spread their tests over several workers from a
shared queue. Each area gets its own file, or one per page for page-level
areas. Tests that change data run one at a time.

The worker limit depends on the host:
- local hosts are limited only by the machine;
- other hosts get a worker maximum and a shared requests-per-second cap;
- with the owner's sign-off on Comprehensive testing (Phase 35 Decision 8)
  the caps are removed with no separate ask, and the run goes all out
  (Emil, 2026-10-06).

This replaces Phase 35's one-worker rule and Standard's fixed 4 and 2.

Values (Emil, 2026-10-06): at most 3 workers and 5 requests per second on
other hosts; otherwise half the CPU cores. Tickets TFP-155 to TFP-158;
starts after Phase 38 Gate B. See
`phase-39-run-concurrency-decision-record.md`.


### Phase 40 — Page-type selection (complete 2026-10-07)
Group a site's crawled pages into types (templates) by address pattern and
page outline, and test one page of every type. Pages are no longer chosen
in crawl order.
- **Standard:** one page per type, not capped at 5 (Emil, 2026-10-06); the
  cap is 8 (Emil, 2026-10-07). Home, form pages and the biggest type are
  never dropped; content pages go first. Types are grouped by exact
  structural signature and ranked by ordered rules, not weights.
- **Comprehensive:** covers every type before a second page of any.
- **The report:** names the types found, covered and skipped, with each page's
  full URL, and ends with a copyable list. Pasted into the URL field (one per
  line), the list re-runs exactly those pages (Emil, 2026-10-06).
- **Measurement:** scored against the Toolshop answer key, beside TFP-154's
  hand-picked list, under a keep rule written before measuring.
- **Order:** before Phase 39, on one worker. Tickets TFP-170 to TFP-175.

See `phase-40-page-type-selection-decision-record.md`.

### Phase 41 — Check gaps (locked 2026-10-07, not started)
New checks for the known bugs TestForge reaches but misses at the read-only
gate (24 of 37): layout consistency, overlap and unrendered images; spelling
of interface text; controls that don't do their job (with the read-only gate
widened to GET-only interactions behind a request guard); tab order and
grouping; known-path probes, guessable ids and API fields that expose
internals. Built and measured on local copies of both Toolshops first, then
the hosted sites. Tickets TFP-179 to TFP-189.

See `phase-41-check-gaps-decision-record.md`.

### Before Phase 42: TFP-198 (the evidence sweep, GitHub issue #2) and TFP-199 (the guard's beacons), done 2026-10-13
The automatic archiving deleted an older run's evidence when a newer run
simply didn't run the failing test. Fixed first: only a test that ran and
passed clears a failure, and only runs of the same kind are compared. See
`run-evidence-sweep-backlog-2026-10-13.md`. TFP-199: the read-only guard
notes site beacons (Cloudflare's `/cdn-cgi/rum`) instead of failing on them.

### Phase 42 — Reusable suites, a test library and gap tests (locked 2026-10-12, in progress)
Each site's Standard tests are saved and reused, regenerated only for page
types that changed; Comprehensive tests live in a library written against
component patterns; a coverage map at element and flow level shows what no
test touches, and Claude Code (opt-in per site) writes tests only for those
gaps, once per gap. Each gap also yields a candidate for the library, run on
other sites outside the verdict until it earns promotion with Emil's
approval. Tickets TFP-190 to TFP-197. Starts after Phase 41's Gate B.

See `phase-42-reusable-suites-and-gap-tests-decision-record.md`.

### After Phase 42 (Emil, 2026-10-13), in this order
1. **A full review of everything built so far:** each phase's claims checked
   against the code and the measurements, the docs brought up to date, and
   what's left open listed.
2. **GitHub issue #2:** read with Emil 2026-10-13 and moved ahead of
   Phase 42 as TFP-198 (above); the review confirms it closed.
3. **The skills, relooked:** the skills TestForge and its build work rely on
   (`docs/CLAUDE_SKILLS.md`, Martin's draft QA/SRE skills, and the Cowork
   skills) adjusted for what Phases 38 to 42 changed, and new skills added
   where the work has a repeatable procedure worth capturing.

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
