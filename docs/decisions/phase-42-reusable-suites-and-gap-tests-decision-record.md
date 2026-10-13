# Phase 42 Decision Record — Reusable Suites, a Test Library and Gap Tests

Date: 2026-10-12
Scope: Keep each site's Standard tests and reuse them on later runs; keep
Comprehensive tests in a library of tests written against component
patterns, applied to any site that has the pattern; map which element and
flow every test covers; and write new tests only for what the map shows is
uncovered, so analysis time goes to the outliers instead of the standard
things.
Status: Locked 2026-10-12. Every decision confirmed by Emil the same day.
Starts after Phase 41's Gate B. Tickets TFP-190 to TFP-197.

## Context

- **Today every run starts from scratch.** The template generator writes
  the whole suite each time. `save-suite` saves a suite under the run's
  description, not the site, so nothing is reused.
- **Pieces that already exist:**
  - run persistence and run diffing (Phase 17);
  - page types with a structural signature for every page (Phase 40), a
    fingerprint of what changed since a site's last run;
  - gap-filling (Phase 34, Option B): the template first, a local model for
    areas the template left with no tests at all. "Gap" means a whole empty
    area, which is far coarser than this phase needs;
  - the checks Phase 41 adds, which become the library's first entries.
- **The local model's record:** Phase 36's best setup writes a suite in a
  median 39.5 s on Emil's GPU; it once ignored the interactive rule and
  submitted a real login form (GEN-43), which is why its block only runs
  with interactive tests on.

## Decisions

1. Reuse each site's Standard tests (Emil, 2026-10-12).
- A site's Standard suite is saved with the fingerprint (Phase 40 page type
  and structural signature) of every page type it was written for.
- On a later run the site is crawled first and compared:
  - unchanged page types reuse their tests as they are;
  - new or changed page types get new tests;
  - page types that are gone retire their tests.
- **A reused test that fails on a page whose fingerprint changed is
  regenerated and re-run before its result is reported (Emil,
  2026-10-12).** Only the re-run's result counts; the report says the test
  was regenerated and why.
- The report says what was reused, regenerated and retired.
- A test edited by hand is kept and marked as edited; it is never
  regenerated silently. If its page changed, the report says so.

2. A library of Comprehensive tests, written against patterns (Emil,
2026-10-12).
- Each library entry is written for a component pattern (a login form, a
  sort control, a quantity stepper, a product listing, a checkout), not a
  site.
- Applying the library means matching the patterns inspection finds and
  binding that site's selectors and pages.
- Each entry records its pattern, its ISTQB technique, its gate, and the
  benchmark bugs it has caught.

3. A coverage map at element and flow level, indexed (Emil, 2026-10-12).
- For every run: each element and flow inspection found, and the tests that
  touch it. What no test touches is the gap list.
- **Indexed for selection, not only for gaps (Emil):** the same index answers
  "which tests touch this element", so a run can pick the tests for what
  changed, and a test can be allocated to a page quickly.
- The report shows coverage per page type and names what is uncovered.

4. Where things live (Emil, 2026-10-12).
- **The library** is generic and lives in the repo, reviewed like code.
- **Site suites** hold one site's selectors, pages and fingerprints, so they
  live in TestForge's local data folder, outside the repo (local-first).

5. Nothing joins the library or a site suite unchecked (Emil, 2026-10-12).
- A written test is promoted only after it passes the generation gates and
  runs behind the gates (read-only by default, with Phase 41's request
  guard), and proves itself: it finds what it was written for on the local
  benchmark copies and adds no unlabelled failure on the clean copy.
- Model-written tests never write to the library directly.

6. Who writes gap tests: Claude Code (Emil, 2026-10-12).
- **Claude Code, once per gap, not on every run.** It writes a
  test for an uncovered element or flow, runs it, reads the result and
  revises it, which is the deeper analysis the gaps need. Its tests are
  saved into the site suite (Decision 1) and reused on later runs, so the
  cost is paid once per gap, and a run whose site hasn't changed costs
  nothing.
- **Opt-in per site:** it sends page structure off the machine, which a
  local-first tool shouldn't do by default.
- **The local model stays as the offline option,** not the default: at
  Phase 36's speed it can write a test, but it can't afford to run and
  revise one on this machine.
- Rejected as the default: OpenAI, which writes once without running the
  test, the same as the local model, with data off the machine as well.

7. Measured like everything else.
- The gap writer's targets are the benchmark bugs still missed after
  Phase 41's Gate B, on the local copies.
- Kept if it finds some of them, adds no unlabelled failure on the clean
  copy, and a re-run of an unchanged site reuses everything (no new tests,
  no writer cost). Recorded either way.

8. Candidates: gap tests on their way to the library (Emil, 2026-10-12).
- **Why:** a gap Claude Code fills on one site is often a component other
  sites will have too. A new way of building a WordPress block, say, met on
  one site, should already have tests waiting when the next site using it is
  tested.
- **Two outputs per gap.** Claude Code writes:
  - the **site test**, bound to that site's selectors and pages, saved in
    the site suite (Decision 1) once it passes the gates;
  - a **candidate**: the same test generalised to the component's pattern
    (its structural signature, the way Decision 2's entries are written),
    with its binding left open.
- **The candidate pool** sits in TestForge's local data folder, beside the
  site suites, until promotion. Each candidate records the pattern it
  matches, the site and run it came from, its gate and technique, and every
  later run it took part in.
- **On a new site,** a candidate whose pattern matches is bound and run like
  a library entry, but **outside the verdict**: reported in its own section
  ("candidate tests"), never failing the run, as Comprehensive scenarios are
  today. Each run adds to its evidence.
- **Before writing a new gap test,** Claude Code checks the pool: a
  candidate that already matches is used instead of writing another, and
  two candidates for one pattern are merged, not kept side by side.
- **Promotion** is a library commit through Claude Code, reviewed like any
  code. **The promotion rule (Emil, 2026-10-12):** a candidate is promoted
  when it has passed the gates on every run, **and** either caught a real
  defect (a benchmark bug or a failure labelled real) or run on 3 sites with
  the pattern with no unlabelled failure, **and** Emil has approved the
  promotion. Rejected candidates are kept with the reason, so the same test
  isn't proposed again.
- **Candidates run by default in Comprehensive, not in Standard (Emil,
  2026-10-12):** Standard stays the critical working path (Phase 38
  Decision 2).

## Order (draft)

1. Site suites and reuse (Decision 1).
2. The coverage map and index (Decision 3).
3. The library: Phase 41's checks moved into pattern entries (Decision 2).
4. The gap writer, the candidate pool and promotion (Decisions 5, 6
   and 8).
5. Measurement (Decision 7).

## Dependencies

- After Phase 41's Gate B: its checks seed the library, and its remaining
  misses are the gap writer's targets.
- After TFP-198 (`run-evidence-sweep-backlog-2026-10-13.md`): site suites
  retire tests, which today's sweep would read as defects fixed.
- Phase 39's workers and Phase 41's request guard apply to every test this
  phase runs.
- Claude Code as the gap writer needs it installed and signed in on Emil's
  machine, and network access; a site with the opt-in off never calls it.

## Backlog

Ticket prefix TFP-. Built in batches, ticket by ticket with targeted tests;
the full unit suite, the regression suite and `check:template-unchanged`
run once at the end of each batch, which stops for verification (Emil,
2026-10-07). Every new test names its ISTQB technique and its gate. Measured
on the local Toolshop copies (Phase 41 Decision 7).

### TFP-190 — Site suites: save, fingerprint and reuse Standard tests

- **Priority:** P1 · **Labels:** `run`, `storage`
- **Scope:** Decisions 1 and 4.
- **Deliverables:** a site suite store in TestForge's local data folder,
  keyed by the site's origin; each test saved with the page type and
  structural signature it was written for; on a run, the crawl compared with
  the saved fingerprints, unchanged types reusing their tests, new or changed
  types generating, gone types retiring; hand-edited tests marked and never
  regenerated silently; the report's reused, regenerated and retired counts.
- **Acceptance criteria:** on the fixture, a second run of an unchanged site
  reuses every test and generates none; changing one page's structure
  regenerates only that type's tests; removing a page retires its tests; a
  hand-edited test survives a change and is flagged; nothing is written
  inside the repo.
- **Dependencies:** Phase 41 Gate B.

### TFP-191 — A stale reused test is regenerated and re-run before it counts

- **Priority:** P1 · **Labels:** `run`
- **Scope:** Decision 1's stale-test rule.
- **Acceptance criteria:** on the fixture, a reused test that fails on a page
  whose fingerprint changed is regenerated and re-run, only the re-run's
  result is reported, and the report names the regeneration and its reason;
  a reused test failing on an unchanged page is reported as it is.
- **Dependencies:** TFP-190.

### TFP-192 — The coverage map and its index

- **Priority:** P1 · **Labels:** `report`, `selection`
- **Scope:** Decision 3.
- **Deliverables:** for every run, each element and flow inspection found and
  the tests that touch it; an index answering "which tests touch this
  element" and "what touches nothing"; the report's coverage per page type
  with the uncovered elements named.
- **Acceptance criteria:** on the fixture, every test maps to the elements it
  touches and an element with no test is listed as uncovered; on the local
  Toolshop, the uncovered list is recorded; the index selects the tests for
  one changed element.
- **Dependencies:** TFP-190.
- **Stop for verification after TFP-190 to TFP-192 (batch 1).**

### TFP-193 — The library: pattern entries, seeded from Phase 41

- **Priority:** P1 · **Labels:** `generate`, `library`
- **Scope:** Decision 2.
- **Deliverables:** a library format in the repo (pattern, binding, ISTQB
  technique, gate, the benchmark bugs it has caught); Phase 41's checks
  moved into entries; applying the library by matching patterns inspection
  finds.
- **Acceptance criteria:** the generated Comprehensive suite on the fixtures
  and the local Toolshops is unchanged in what it checks (the same tests,
  shown by `check:template-unchanged` and the local score); each entry lists
  its caught bugs.
- **Dependencies:** TFP-192.

### TFP-194 — Claude Code writes gap tests, once per gap, opt-in per site

- **Priority:** P1 · **Labels:** `generate`, `ai`
- **Scope:** Decisions 5 and 6.
- **Deliverables:** a per-site opt-in, off by default; for each uncovered
  element or flow, Claude Code writes a test, runs it behind the gates and
  Phase 41's request guard, and revises it; a test that passes the gates
  joins the site suite; the local model as the offline option; the report
  says which tests Claude Code wrote and what it cost.
- **Acceptance criteria:** with the opt-in off, nothing leaves the machine
  and no gap test is written; with it on, gap tests are written only for
  uncovered elements; a re-run of an unchanged site writes nothing new; a
  written test that breaches a gate is rejected and never saved.
- **Dependencies:** TFP-193.

### TFP-195 — The candidate pool

- **Priority:** P1 · **Labels:** `library`, `ai`
- **Scope:** Decision 8's pool, matching and trial runs.
- **Deliverables:** for each gap, a generalised candidate saved beside the
  site suites; matching candidates bound and run on other sites in
  Comprehensive, outside the verdict, in their own report section; each
  candidate's evidence recorded; the pool checked before a new gap test is
  written; candidates for one pattern merged; rejected candidates kept with
  their reason.
- **Acceptance criteria:** on two fixture sites sharing a component, a
  candidate written on the first runs on the second without a new gap test,
  is reported outside the verdict, and gains a run of evidence; Standard
  never runs candidates.
- **Dependencies:** TFP-194.

### TFP-196 — Promotion

- **Priority:** P2 · **Labels:** `library`
- **Scope:** Decision 8's promotion rule.
- **Deliverables:** a list of candidates that meet the rule (gates passed on
  every run, and a real defect caught or 3 clean sites with the pattern), for
  Emil's approval; promotion as a library commit through Claude Code; a
  rejection recorded with its reason.
- **Acceptance criteria:** a candidate below the rule is never offered; an
  approved one becomes a library entry with its evidence; a rejected one is
  not proposed again.
- **Dependencies:** TFP-195.
- **Stop for verification after TFP-193 to TFP-196 (batch 2).**

### TFP-197 — Measure the gap writer (Gate B)

- **Priority:** P1 · **Labels:** `measurement`, `benchmark`
- **Scope:** Decision 7.
- **Acceptance criteria:** on the local copies, the gap writer's tests scored
  against the benchmark bugs still missed after Phase 41's Gate B, with
  TFP-154's rule; no unlabelled failure on the clean copy; a re-run of an
  unchanged site reuses everything and writes nothing; Claude Code's cost
  and run time recorded; the outcome recorded either way.
- **Dependencies:** TFP-196.
- **Stop at Gate B.**

## Recommended Execution Order

1. Batch 1: TFP-190, TFP-191, TFP-192.
2. Batch 2: TFP-193, TFP-194, TFP-195, TFP-196.
3. TFP-197. **Gate B.**

## Gates

### Gate A — Reuse and coverage
- TFP-190 to TFP-192 landed and verified: an unchanged site reuses
  everything, and the coverage map names what nothing tests.

### Gate B — Gap tests measured
- TFP-193 to TFP-197 landed and verified; Decision 7 applied and recorded.
