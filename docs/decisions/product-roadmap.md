# TestForge Product Roadmap

**Version:** 1.1
**Date:** 2026-08-28; header and Phase 39 status refreshed 2026-10-27
**Status:** Living ledger. Each phase is locked by its own decision record
before implementation starts; this file carries each phase's outline and
current status in its heading.

This document is the map across phases. For every record, report and
backlog by phase, see the [decisions index](README.md); for what TestForge
does today, `../APPLICATION_OVERVIEW.md`; for everything deferred and the
build order after Phase 39, `deferred-work-register.md`.

Phases 22–34 were short and have records but no section here; the index
lists them. The baseline and scope sections below are kept as they were
written on 2026-08-28, as the starting point Phase 16 was planned from.

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

## Current Functionality (Baseline, pre-Phase 16, as written 2026-08-28)

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


### Phase 39 — Run speed: fewer page visits, then workers (complete 2026-10-31: Gate D closed; 3 workers at most; cap-starved tests reported Not run; the cap proven at the server)
Amended 2026-10-16 (Emil). R1 (TFP-207) found that almost every test loads its
page afresh, and that Standard on with-bugs takes 1,535 s of its 1,800 s
limit. So the phase now cuts page visits before adding workers, in this
order:
1. **Measure first** where run time goes, three runs per site. The
   keep-or-revert targets are set from the numbers and locked by Emil before
   anything is built.
2. **One visit per page for read-only checks,** across areas, each check
   still its own test and result.
3. **Rules for shared pages:**
   - reload after a failure, and after a test that left the page;
   - typed text cleared;
   - a failure re-run on a fresh page only when a state-changing test ran
     before it on the same visit.
4. **Functional checks share pages by kind of control** (in place, in-app
   navigation, full navigation).
5. **The settle wait and read-only timeouts tuned** from the measurements.
6. **Workers,** as locked on 2026-10-06:
   - local hosts are limited only by the machine;
   - other hosts get at most 3 workers and 5 requests per second, shared;
   - the owner's sign-off on Comprehensive testing (Phase 35 Decision 8)
     removes the caps with no separate ask;
   - data-changing tests run one at a time, after the read-only ones.

   This replaces Phase 35's one-worker rule and Standard's fixed 4 and 2.

Performance, responsive, cookie and session checks, and everything at the
interactive or active gates, keep their own fresh page. Results must not
change, only run time. Tickets TFP-211 to TFP-215, then TFP-155 to TFP-158.
No new Standard check is added until TFP-211 has measured. See
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

### Phase 41 — Check gaps (complete 2026-10-13)
New checks for the known bugs TestForge reaches but misses at the read-only
gate (24 of 37): layout consistency, overlap and unrendered images; spelling
of interface text; controls that don't do their job (with the read-only gate
widened to GET-only interactions behind a request guard); tab order and
grouping; known-path probes, guessable ids and API fields that expose
internals. Built and measured on local copies of both Toolshops first, then
the hosted sites. Tickets TFP-179 to TFP-189.

Gate B passed 2026-10-13 (Emil): local copies 33 found, 0 hinted, 4 missed of
37, with Standard plus Comprehensive security and accessibility (TFP-188).
Standard alone, re-measured in the review's R1 (TFP-207, 2026-10-16): 30
found. The 3 differences are found only by Comprehensive security.

See `phase-41-check-gaps-decision-record.md`.

### Before Phase 42: TFP-198 (the evidence sweep, GitHub issue #2) and TFP-199 (the guard's beacons), done 2026-10-13
The automatic archiving deleted an older run's evidence when a newer run
simply didn't run the failing test. Fixed first: only a test that ran and
passed clears a failure, and only runs of the same kind are compared. See
`run-evidence-sweep-backlog-2026-10-13.md`. TFP-199: the read-only guard
notes site beacons (Cloudflare's `/cdn-cgi/rum`) instead of failing on them.

### Phase 42 — Reusable suites, a test library and gap tests (complete 2026-10-15)
Each site's Standard tests are saved and reused, regenerated only for page
types that changed; Comprehensive tests live in a library written against
component patterns; a coverage map at element and flow level shows what no
test touches, and Claude Code (opt-in per site) writes tests only for those
gaps, once per gap. Each gap also yields a candidate for the library, run on
other sites outside the verdict until it earns promotion with Emil's
approval. Tickets TFP-190 to TFP-197, then TFP-200 to TFP-205.

Gate B passed 2026-10-15 (Emil): the gap writer is not kept as a bug finder.
Its code stays, off unless a site opts in. Phase 42 closed when TFP-205 (a
template test for every link on the selected pages) was verified,
2026-10-15.

See `phase-42-reusable-suites-and-gap-tests-decision-record.md`.

### After Phase 42 (Emil, 2026-10-13), in this order
Planned 2026-10-15 as `post-phase-42-review-plan.md` (R1 to R6).
- **Done (2026-10-16):** R1 (TFP-207) is verified, R3's findings are listed
  and its doc fixes are made (`post-phase-42-review-findings.md`), and the
  Phase 39 amendment is locked.
- **Order for Code (Emil, 2026-10-16):**
  1. TFP-208;
  2. TFP-210;
  3. Phase 39, measurement first;
  4. TFP-206 and TFP-209 after it, or between its gates.

  R5's decisions and R6's skills relook run in Cowork alongside Phase 39.
1. **A full review of everything built so far:** each phase's claims checked
   against the code and the measurements, the docs brought up to date, and
   what's left open listed.
2. **GitHub issue #2:** read with Emil 2026-10-13 and moved ahead of
   Phase 42 as TFP-198 (above); closed, as the review confirmed.
3. **Also for the review (2026-10-14):** a real sandbox for gap and
   candidate tests (run inside Docker), and app screens for the gap-writer
   opt-in and candidate promotion (API routes only so far).
   Added 2026-10-15: Claude Code as gap writer still loads the user's
   CLAUDE.md, memory and hooks (`--safe-mode` would turn them off), and the
   trimmed run environment drops proxy settings.
   Added after Gate B (2026-10-15): a decision record for *scenario gaps*
   (behaviour and edge cases the suite doesn't exercise) as the gap
   writer's redefined purpose, with how scenarios are found and measured
   and a prompt rule against self-confirming checks; the full Toolshop
   benchmark re-run after TFP-205 (TFP-205 verified 2026-10-15, Phase 42
   complete); TFP-206; the load flakes (`comprehensive-scenarios`,
   `performance-bands`, a Comprehensive security case), and the first
   clean full unit run since TFP-205. The re-run and the unit runs were R1
   (TFP-207). The flakes it actually found, two different ones, are in
   TFP-208 with these three.
4. **The skills, relooked:** the skills TestForge and its build work rely on
   (`docs/CLAUDE_SKILLS.md`, Martin's draft QA/SRE skills, and the Cowork
   skills) adjusted for what Phases 38 to 42 changed, and new skills added
   where the work has a repeatable procedure worth capturing.

### After Phase 39: the triaged build order (Emil, 2026-10-19; updated 2026-10-20)
`deferred-work-register.md` has each step described, with what it waits on:
1. D26, the local copies into WSL;
2. Phase 43;
3. Phase 46;
4. D29, retention for saved runs and their evidence;
5. the SEO Standard set;
6. the APG patterns, with INP;
7. the rest of accessibility and security Standard;
8. failure triage;
9. D27, TestForge measured against an outside QA tool on local Toolshop,
   once Standard is complete;
10. D28, a security sweep of the model-code paths;
11. Phase 45;
12. Phase 44;
13. authenticated and active security;
14. Comprehensive negative tests;
15. Comprehensive SEO;
16. all-areas runs;
17. load testing.

### Phase 43 — Ownership confirmation, once per site, and the active gate (locked 2026-10-19, not started)
A tester confirms once per site, by API, that they own the site or have
written permission:
- exact hosts;
- a contact email, kept locally and never in reports;
- an expiry of 90 days by default, at most 1 year;
- an active tick and a load-testing tick.

A valid confirmation does three things:
- it lifts Phase 39's caps;
- with a run's `TESTFORGE_ACTIVE` switch on, it opens the active gate, so
  the script-payload test runs again;
- it stores the tick the load-testing run (D24) needs.

When it doesn't cover a run, the run still runs and its active tests are
Not run, with the reason. Tickets TFP-218 to TFP-221.

See `phase-43-ownership-confirmation-decision-record.md`.

### Phase 44 — Scenario gaps, slice 1 (locked 2026-10-20, not started)
The gap writer's new purpose: behaviour and edge cases nothing exercises.
- **Slice 1:** double submit, back-and-resubmit, and retry after a timeout.
- **How the tests are built:** TestForge's vetted harness does the
  mechanics, and Claude Code judges which scenarios apply where and what
  must hold.
- **Proof:** each scenario type must fail on a planted-defect fixture
  first.
- **Verdict:** outside it until measured, per type (D6).
- **Gates:** interactive, plus the confirmation on remote hosts.
- Tickets TFP-223 to TFP-227.

See `phase-44-scenario-gaps-decision-record.md`.

### Phase 45 — The Docker sandbox for model-written tests (locked 2026-10-20, not started)
Gap tests, candidates and scenario tests run in a container:
- the image pinned to the repo's Playwright version;
- read-only mounts, no secrets, a non-root user;
- network only to the run's target hosts;
- results read back as data;
- no Docker, no model-written tests;
- at most 60 s per run.

Tickets TFP-228 to TFP-231.

See `phase-45-docker-sandbox-decision-record.md`.

### Phase 46 — App screens (locked 2026-10-20, not started)
- **A site lookup by URL:** exact match only, no list of sites, the email
  masked.
- **The confirmation form:** hosts typed by hand.
- **Candidate promotion:** approve, then Claude Code commits.
- **Phase 43's active switch** in the run form.

Tickets TFP-232 to TFP-235.

See `phase-46-app-screens-decision-record.md`.

---

### Phase 47 — TestForge in a target's CI pipeline (locked 2026-10-27, not started; after Phase 39, before Phase 43)

A command crawls, generates and runs against a target with no UI and no
server, and ends with an exit code, JUnit and HTML. A second run compares
with the first, so known failures don't fail the build. First scope:
Standard at the read-only gate, against an app the CI job starts on
`localhost`; a deployed URL runs capped until Phase 43. The crawl and
generate logic first moves out of the API routes into `src/lib/pipeline/`,
shared by the UI and the CLI. Shipped as a pinned Docker image and a GitHub
Action. Phase 16 Decision 1 is amended: a team's own CI runner counts as
local. Record: `phase-47-ci-integration-decision-record.md`; tickets TFP-263,
TFP-245 to TFP-249.

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
