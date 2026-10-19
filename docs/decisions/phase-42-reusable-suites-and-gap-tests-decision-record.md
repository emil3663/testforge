# Phase 42 Decision Record — Reusable Suites, a Test Library and Gap Tests

Date: 2026-10-12
Scope: Keep each site's Standard tests and reuse them on later runs; keep
Comprehensive tests in a library of tests written against component
patterns, applied to any site that has the pattern; map which element and
flow every test covers; and write new tests only for what the map shows is
uncovered, so analysis time goes to the outliers instead of the standard
things.
Status: Locked 2026-10-12. Every decision confirmed by Emil the same day.
Starts after Phase 41's Gate B. Tickets TFP-190 to TFP-197, plus TFP-200 and TFP-201 from Gate A.
**Complete 2026-10-15** (TFP-205 verified; TFP-206 moves to the post-Phase 42 review).
Corrections from the review's claims audit (R3, 2026-10-16) are marked
**Correction (R3, 2026-10-16)** where they apply. The history above them is
left as written. Findings: `post-phase-42-review-findings.md`.

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
  - **Correction (R3, 2026-10-16):** Phase 39 was never started, so no
    test in this phase ran on its workers. Phase 41's request guard does
    apply. Phase 39 (amended and locked 2026-10-16) keeps gap-writer and
    candidate tests on a fresh page of their own.
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
- **Decided while building (Emil, 2026-10-13):**
  - **The data folder** is the OS app-data folder: `%LOCALAPPDATA%\TestForge`
    on Windows, `~/Library/Application Support/TestForge` on macOS,
    `$XDG_DATA_HOME/testforge` (or `~/.local/share/testforge`) elsewhere;
    `TESTFORGE_DATA_DIR` overrides it, and every test sets it to a
    temporary folder.
  - **Site-wide tests** (a test that visits no inspected page, or pages of
    several types) are reused while the site has the same set of page
    types.
  - **Scope:** Standard and Comprehensive runs both keep a site suite, one
    per suite identity (run type, Comprehensive area, practices, audit
    mode), so a links run never retires an accessibility suite's tests.
    Tests from OpenAI and the local model's blocks are not saved.
  - **TFP-191's stale-test check** re-reads the page on failure (below).
- **Built:** `src/lib/site-suites/` and `src/lib/storage/data-dir.ts`. A
  test is matched across runs by its describe chain, its title without the
  id, and the pages it visits; position alone would match a removed page's
  per-page checks to the next page's. A saved test the generator no longer
  writes is retired even when its page type is unchanged: the signature is
  coarse, and such a test tests something that is gone (a link taken off a
  page). Only a hand-edited test outlives that.

### TFP-191 — A stale reused test is regenerated and re-run before it counts

- **Priority:** P1 · **Labels:** `run`
- **Scope:** Decision 1's stale-test rule.
- **Acceptance criteria:** on the fixture, a reused test that fails on a page
  whose fingerprint changed is regenerated and re-run, only the re-run's
  result is reported, and the report names the regeneration and its reason;
  a reused test failing on an unchanged page is reported as it is.
- **Dependencies:** TFP-190.
- **Decided while building (Emil, 2026-10-13):** when a reused test that
  wasn't edited by hand fails, its page is read again and its structural
  signature compared with the saved one. If it differs, that page type's
  tests are regenerated from a fresh inspection and re-run, and only the
  re-run's results count; the report names the regeneration and the
  signature change. If it is the same, the failure stands.
- **Built:** `src/lib/site-suites/stale.ts`, run from the executor once
  Playwright closes and before the run is finalized. The page is read again
  with the same inspection that saved its signature. A reused test is one
  written before this generation (each saved test records when it was
  written). Site-wide tests are not read again: their failures stand. The
  re-run covers what the run ran of that type, plus the type's new tests,
  so a run of selected tests stays one; hand-edited tests keep their
  result. The site suite saves its generation inputs and page data for
  this.

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
- **Built:** `src/lib/report/coverage-map.ts`, in every run's report and
  its HTML export. What a test touches is read from its code: an element
  is touched by a test on its page that uses the locator the generator
  writes for it (a form without an id as the form check finds it), a link
  likewise or by a site-wide link check that requests its URL, a flow by
  its journey test. A whole-page check (the WCAG scan, headings) touches
  the page, not each element, so it makes no element covered. The map is
  static: an element counts as touched whether or not the test ran or
  passed.
- **Stop for verification after TFP-190 to TFP-192 (batch 1).**

- **Batch 1 done, verified 2026-10-14 (Cowork):** TFP-190 (`4841a7a`),
  TFP-191 (`73604e0`), TFP-192 (`dd9d9b8`), the Toolshop coverage map
  (`612b144`, run on `dd9d9b8`). Site suites live in the OS app-data folder;
  saved tests are matched by describe chain, title and the pages they visit.
  End checks: unit 530/530, regression 57/57, `check:template-unchanged`
  166/166.

### Gate A rulings (Emil, 2026-10-14)

1. **Coverage is reported in two tiers, and a repeated link counts once.**
   The Toolshop map read 243 of 243 because a site-wide link check that
   requests a URL counted every link as touched; only 16 of 132 links had an
   on-page check. But the 132 are 37 distinct links: 17 repeat across pages
   (header and footer) and make up 112 of the entries.
   - **Reachability:** a link's URL was requested and answered.
   - **In context:** the link was found and checked on its page.
   - A link with the same text and target in a shared region of several
     pages is one item, covered in context when checked on any one of
     them. The gap list (and TFP-194's targets) is the in-context tier.
   - Built first in batch 2 as TFP-201, before TFP-193.
2. **The label-wrapped `<select>` naming bug is ticketed (TFP-200),** with a
   fixture case of a bare label-wrapped list marked as a known failure until
   the fix, and the coverage map naming the pattern as a known blind spot.
   The fix changes template output, so it is its own commit, the change to
   `check:template-unchanged` accepted deliberately.
3. **Accepted:** template runs no longer show "no local model result was
   recorded" (they carry a generation record; a test pins it).
4. **Accepted:** site-wide tests are not re-read after a run, so their
   failures stand. The report says so: a real site change can show up as a
   site-wide failure that isn't re-checked for staleness.

### TFP-201 — Coverage in two tiers, a repeated link counted once

- **Priority:** P1 · **Labels:** `report`, `selection`
- **Scope:** Gate A ruling 1.
- **Acceptance criteria:** on the fixture, a link checked only by a
  site-wide request is reachability-covered and uncovered in context; a
  header link present on three pages and checked on one is one item,
  covered in context; the Toolshop map, re-read from `612b144`'s suite,
  reports both tiers with the distinct-link count; the index and the gap
  list use the in-context tier.
- **Dependencies:** TFP-192. Before TFP-193.
- **Built:** `src/lib/report/coverage-map.ts`. A link's site-wide request
  is its reachability tier (`reachedBy`); only a check that finds it on a
  page is in context (`tests`), which the index, the gap list and the
  headline's first count use. The inspection records no page region, so a
  repeated link is the same text and target on several pages, whichever
  region it is in. A repeated link counts once in the totals and in each
  page type it appears on.

### TFP-200 — A list wrapped in its label is named as the browser names it

- **Priority:** P2 · **Labels:** `bug`, `generate`
- **Scope:** Gate A ruling 2.
- **Deliverables:** the template names a `<select>` inside its `<label>` the
  way the browser's accessibility tree does (the label's own text, not the
  options' text), so its check finds it; the fixture's known-failure case
  turned into a passing case; the coverage map's blind-spot note removed.
- **Acceptance criteria:** the bare label-wrapped list's check passes; the
  `check:template-unchanged` difference is only that list's name, accepted
  in the commit.
- **Dependencies:** none. In batch 2.
- **Built:** the fix is in the inspection, not the template
  (`src/lib/introspect/dom-snapshot.ts`): a label's text is read without
  the labelled control's own content, as Chromium names it (measured:
  "Subject", "Size *", "Message"). It applies to a `label[for]` too. The
  template writes what the inspection records, so
  `check:template-unchanged`, which replays recorded profiles, shows no
  difference; the change reaches suites through new inspections. The
  fixture's case is `/wrapped`, and the TFP-191 defect's list lost its
  `aria-label`. The coverage map's blind-spot note was never added, since
  the fix came in the same batch.

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
- **Built:** `src/lib/library/` - 15 entries, one per Phase 41 check
  (TFP-182 to TFP-187; TFP-181's guard is a helper, not a check). Each
  entry records its pattern, binding (page, or site), ISTQB technique,
  gate, where it runs, its builder, and the bugs it caught at Phase 41's
  Gate B. The controls' page patterns (sort list, filter field, number
  field, list) moved from the controls check into the library; the other
  entries bind to every inspected page, or to the run, as their checks
  already did. Each check's code stays with its generator, which asks
  the library which pages each entry binds to. Measured: the generators'
  whole output on the fixture's and the Toolshop's page data, Standard
  and Comprehensive, is byte-identical before and after
  (`benchmarks/2026-10-14-tfp193-library/`).

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
- **Built:** `src/lib/gap-writer/`. The opt-in is a per-site setting in
  the data folder (`settings.json`, set through `/api/site-settings`;
  absent reads as off). The targets are TFP-201's in-context gap list,
  elements and links (flows are interactive and stay out). The writer
  gives a test body; TestForge composes the test at the read-only gate
  with the whole body in the request guard, type-checks it, refuses a
  body that reaches for Node, and runs it. A failure goes back for a
  revision in the same session, up to 3 attempts; a breach is rejected
  at once. Saved gap tests are kept while their page type holds; a gap
  tried without a saved test is recorded, so it isn't asked for again. At
  most 5 gaps per generation (`TESTFORGE_GAP_LIMIT`), so a first run's
  cost is bounded. Claude Code is called with the prompt on stdin, never
  as an argument, since the prompt carries text from the site. Not built:
  a control in the app for the setting (the route only).

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
- **Built:** `src/lib/candidates/`. After a gap test is saved, the writer
  is asked in the same session to generalise it, leaving `__PAGE__` and
  `__LOCATOR__` blanks. TestForge binds the candidate back to the same
  element and runs it, and only one that passes joins the pool. A pattern
  is the element's kind, type and name (lower-cased), read from the
  coverage map; one pattern is one file, so a second source is merged. On
  a Comprehensive run, each in-context gap a candidate matches gets it,
  bound to that site, in "Candidate tests": filtered out of every count,
  listed in the report's own section, and recorded as evidence when the
  run ends (site, page, run, status). Matching doesn't wait for the
  site's opt-in, since nothing leaves the machine. Before writing, a gap a
  candidate matches gets no new test, on either run type, so on Standard
  such a gap stays uncovered.

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
- **Built:** `src/lib/candidates/promotion.ts`, `/api/candidates`, and
  `npm run library:promote`. The rule reads each candidate's evidence:
  - "passed the gates on every run": at least one run, and no run that
    failed as a read-only gate breach (recorded with each run since this
    ticket);
  - "a real defect": a run a person labelled real, or one credited with a
    benchmark bug (labelled through the route);
  - "3 sites with no unlabelled failure": three distinct sites in its
    runs, and every failure labelled.
  Approving one below the rule is refused. Approval marks it; Claude Code
  runs `library:promote`, which writes each approved candidate with its
  evidence and caught bugs under `src/lib/library/promoted/` and marks it
  promoted, and then commits the entries. Not built: running promoted
  entries in generated suites (they are recorded, not yet applied), and a
  screen in the app (the route only).
- **Stop for verification after TFP-193 to TFP-196 (batch 2).**

- **Batch 2 done, verified 2026-10-14 (Cowork):** TFP-201 (`c516a1e`,
  map `16bbef7`), TFP-200 (`567d2c4`; fixed in the inspection, so template
  output is unchanged), TFP-193 (`7eba131`; output byte-identical), TFP-194
  (`2de9aeb`), TFP-195 (`ee19dae`), TFP-196 (`4dc8e8d`), `b17f097`
  (lint split), `c15dd2c` (gap-test files out of Playwright's test folder,
  which caused 15 unrelated failures in the first full run). End checks:
  unit 551/551, regression 57/57, `check:template-unchanged` 166/166.
  TFP-194 was tested with a stand-in; no real Claude Code call was made.

### Batch 2 rulings (Emil, 2026-10-14)

1. **A repeated link** is matched by text and target, wherever it sits on
   the page (the inspection records no region). Accepted.
2. **On Standard, a matching candidate becomes the gap's test (TFP-203).**
   As built, a gap with a matching candidate got no test on Standard, which
   never runs candidates. Now the candidate is bound into the site suite as
   that gap's site test once it passes the gates, as Decision 8 intends
   ("used instead of writing another").
3. **Promoted entries are applied by generation (TFP-204).** Otherwise
   promotion changes nothing. The app screens for the opt-in and promotion
   wait for the post-Phase 42 review; the API routes work.
4. **The default limit of 5 gap tests per generation**
   (`TESTFORGE_GAP_LIMIT`) is accepted as Emil's decision.
5. **Gap tests are hardened before any real use (TFP-202, P0).** They turn
   text read from a site under test into code that runs on Emil's machine,
   and candidates carry that code to other sites. A real sandbox (the tests
   run inside Docker) is the follow-up, for the post-Phase 42 review.

- **Batch 3 done, verified 2026-10-15 (Cowork):** TFP-202 (`edfa507`),
  TFP-203 (`c7ce21f`), TFP-204 (`9a9681c`), then `97aac4d` (the TFP-094
  leak test), `defcc40` (Standard runs count as evidence), `fd48f77` and
  `7e0116b` (the guard's helper). Pushed; `origin/main` at `7e0116b`. End
  checks on the final code: unit 566/566, regression 57/57;
  `check:template-unchanged` 166/166 after TFP-204 (nothing since touches
  the template). Claude Code's four no-tools flags checked against its CLI
  reference. No real Claude Code call was made.

### Batch 3 rulings (Emil, 2026-10-15)

1. **The TFP-094 leak test** types the credentials as literals and asserts
   that a run's tests can't read them from the environment: the first
   end-to-end proof of TFP-202's environment rule. The run's stored copy
   of the submitted code holds the literals, so the scan checks it is
   exactly what was sent and skips it; everything TestForge captured is
   still scanned.
2. **Promoted entries run on Standard only, accepted.** Every promoted
   entry so far is a read-only functional check, and the library's
   functional entries run only in "Standard functional"; Comprehensive has
   no functional area (security and accessibility only). An entry for an
   area Comprehensive has would follow `entries.ts`'s `runsIn` rule.
3. **A bound candidate's Standard runs count toward its promotion
   (`defcc40`).** Binding already completes the site's own suite: the
   candidate is that gap's test there, the gap counts covered and no
   writer is asked again. Promotion only decides whether it is offered to
   every site, and the rule counts distinct sites, so a run on another
   site is the cross-site evidence it asks for. A failure there is an
   unlabelled failure and blocks promotion until labelled.
4. **Found by fix 2's test (`fd48f77`, `7e0116b`):** on a Standard run with
   control checks, every test under "Gap tests" failed with
   `tfReadOnlyGuarded is not defined`, because the template declares the
   helper inside the functional describe. It hit written gap tests since
   TFP-194 and bound candidates; the gates before saving were unaffected. A
   top-level copy is now added only where a call can't reach one.
5. **For the post-Phase 42 review:** Claude Code still loads Emil's
   user-level CLAUDE.md, memory and hooks (`--safe-mode` would turn them
   off); the run environment drops proxy settings (`HTTPS_PROXY`,
   `NODE_EXTRA_CA_CERTS`), fine locally, not behind a corporate proxy.

### TFP-202 — Harden the gap writer and the tests it writes

- **Priority:** P0 · **Labels:** `security`, `ai`
- **Problem it solves:** `claude -p` is called with its normal tools, from
  the TestForge folder, with page text in the prompt (prompt injection could
  steer what it reads or writes); the written test runs as Node with the
  full environment (API keys included); the code check blocks `require`,
  `process` and `fs` by pattern only.
- **Deliverables:**
  - Claude Code called with every tool turned off and from an empty
    temporary working folder; the exact flags taken from Claude Code's
    current documentation and named in the commit;
  - gap and candidate tests run with a stripped environment: only what
    Playwright needs, no keys, tokens or TestForge settings;
  - the code check widened to network and dynamic code (`fetch`,
    `XMLHttpRequest`, `WebSocket`, `import(`, `eval`, `Function(`,
    `globalThis`, `child_process`, `page.request` and `request.` calls other
    than GET, and the like), still with no imports allowed;
  - the page text in the prompt marked as untrusted data, with the
    instruction not to follow anything in it.
- **Acceptance criteria:** unit cases show the spawn uses the no-tools
  flags and a temporary folder; a test body that reads an environment
  variable gets nothing; each forbidden construct is rejected before
  running; an injection string in the page text ("ignore your
  instructions...") is passed as data in the prompt.
- **Dependencies:** none. Before TFP-197.
- **Built:** `src/lib/gap-writer/code-check.ts`, `src/lib/run/child-env.ts`,
  and the writer's call and prompts in `writers.ts`.
  - The flags, from code.claude.com/docs/en/cli-reference (read
    2026-10-14; Claude Code 2.1.238 on Emil's machine): `--tools ""`,
    `--disallowedTools "*"`, `--strict-mcp-config`,
    `--disable-slash-commands`. Not used: `--restricted` (needs 2.1.248),
    `--permission-prompts none` (2.1.259), `--bare` (API key only, no
    subscription sign-in) and `--no-session-persistence` (would stop the
    `--resume` revisions need). One empty temporary folder per generation.
  - The code check parses the body and walks its syntax tree, so spacing,
    line breaks and quoted or computed names don't get past it; it also
    refuses `arguments` (the module wrapper's second is `require`), `this`,
    prototype access and `context()`/`newPage` (a page the guard isn't
    armed on). Bound candidates are checked again.
  - The stripped environment applies to every Playwright run TestForge
    starts (the main run, its stale re-check, gap-test runs), since saved
    gap tests and candidates run inside the main run.
  - No real Claude Code call was made.

### TFP-203 — On Standard, a matching candidate becomes the gap's test

- **Priority:** P1 · **Labels:** `library`
- **Scope:** batch 2 ruling 2.
- **Acceptance criteria:** on a fixture site with a matching candidate, a
  Standard run binds it into the site suite (after the gates) and writes no
  new gap test; the coverage map counts the gap covered; a candidate that
  fails the gates there is not bound.
- **Dependencies:** none. Before TFP-197.
- **Built:** `src/lib/candidates/standard.ts`, called by `/api/generate` on
  Standard runs after the site suite is applied and before the gap writer.
  The bound candidate goes through `runGapTest` (code check, type check, a
  run at the read-only gate) and is saved as a gap test with
  `writer: "candidate"` and its id, so the existing reuse rules keep it
  while its page type holds. It doesn't wait for the opt-in (nothing leaves
  the machine, as TFP-195's matching). A failure is recorded as a tried gap
  with the candidate's id. Found on the way: `targetOf` gave a link's
  locator in double quotes, which the coverage map never matched, so no
  gap test of a link counted it covered; it now uses the generator's own
  expression.
- **Verified 2026-10-15 (Emil), with a fix:** a bound candidate's Standard
  runs count toward its promotion evidence, like Comprehensive runs (the
  rule counts distinct sites, so this is cross-site evidence). The bound
  test names its candidate (a `candidate` annotation) and each run's
  record carries it. Found on the way: gap tests and bound candidates on a
  Standard functional run with control checks failed with
  `tfReadOnlyGuarded is not defined` (the template's helper sits inside the
  functional describe); the suite now gets a top-level copy.

### TFP-204 — Generation applies promoted library entries

- **Priority:** P1 · **Labels:** `library`, `generate`
- **Scope:** batch 2 ruling 3.
- **Acceptance criteria:** a promoted entry in `src/lib/library/promoted/`
  is bound and run on a site with its pattern, inside the verdict like any
  library entry; with nothing promoted, `check:template-unchanged` is
  166/166.
- **Dependencies:** none. Before TFP-197.
- **Built:** `src/lib/library/promoted.ts`, called by `/api/generate` on
  Standard runs with the functional area in scope (where the library's
  control checks run), before the site suite is applied, so promoted tests
  are saved and reused like the template's. Each entry is matched by its
  pattern against the inspected pages: an element gets a test on each page
  it is on, a repeated link one test on its first page; the blanks take the
  page and the generator's own locator, so the coverage map counts it
  covered. The tests sit in the functional describe at the read-only gate,
  inside the request guard, titled `library promoted.<id>: ...`. An entry
  the TFP-202 code check refuses is not applied, and an unreadable entry
  file is skipped. The template generator itself is untouched (its arity is
  fixed by `check:template-unchanged`), so with nothing promoted its output
  is byte for byte the same. Not done: promoted entries on Comprehensive
  runs, and in `entries.ts`'s catalogue.

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

### Gate B ruling (Emil, 2026-10-15)

- **TFP-197 measured and verified** (`ae88e0b` to `a12aee1`; outcome in
  `benchmarks/2026-10-15-tfp197-gap-writer/outcome.md`). Official score 0 of
  4, expected by design: none of the 4 is in Chromium's reach on the
  selected pages, and a gap test is revised until it passes on its own
  site. No unlabelled failure on clean; an unchanged clean re-run reused
  468 of 468 tests with 0 Claude Code calls. 446 calls, $11.84 in all
  (224 of them, $5.87, on first attempts cut short by `394a096` and
  `31c0afd`). The second measure showed nothing: clean routes by path and
  with-bugs by `#/`, so every page type changed and clean's 19 gap tests
  were retired; 9 of clean's candidates were bound on with-bugs and passed.
- **The gap writer is not kept as a bug finder.** Decision 7's first
  condition failed. What it wrote here were in-context link checks
  (visible, has an `href`, the `href` equals itself): inventory the
  template could test for nothing. The code stays, off unless a site opts
  in; the hardening, site suites, reuse, candidates, promotion, the coverage
  map and the default limit of 5 all stay.
- **What a gap is (Emil, 2026-10-15).** An *inventory gap* (an element or
  link inspection found that no test checks) is the template's job and
  should be closed deterministically: TFP-205. A *scenario gap* (a
  behaviour or edge case nothing in the suite exercises) is what a model's
  judgement is for; designing it is for the post-Phase 42 review, with its
  own decision record.
- **The gap limit:** 50 was Emil's approval for TFP-197's driver only; the
  default stays 5 (50 takes too long).
- **Not measured again now (Emil):** TFP-205 is tested by its own targeted
  tests; the full Toolshop benchmark re-run waits for the full regression
  in the review.
- **Phase 42 closes when TFP-205 is verified.**

### TFP-205 — The template checks every link on the pages it selects

- **Priority:** P1 · **Labels:** `generate`, `coverage`
- **Problem it solves:** on the Toolshop copies the coverage map's
  in-context gap list was links only (36 on clean): the template checks
  every element in context, but not links. TFP-197 paid Claude Code to
  write those checks.
- **Correction (R3, 2026-10-16):** the gap list was not links only, and the
  template did not check every element in context. Gate B's own suites
  (TFP-188), re-read in R1, had 31 element gaps on with-bugs and 5 on clean,
  besides the links (31 on with-bugs, 35 on clean):
  - with-bugs: the home page's filter checkboxes, its sort and search forms,
    and three page forms;
  - clean: five forms.

  R1 (TFP-207) shows the same elements still uncovered. "Every element in
  context" holds only for clean's elements other than forms.
- **Scope:** a deterministic, read-only test per distinct link (text and
  target, counted once as the coverage map counts it) on the selected
  pages, in the functional area:
  - the link is visible on its page with a usable name, by the generator's
    own locator expression, so the map counts it covered in context;
  - its `href` is a valid URL;
  - a same-origin target loads without an error status, through `tfGoto`
    inside the request guard (reuse the existing site-wide link check where
    it already loads that URL, rather than loading it twice); external
    targets get the `href` check only, no request;
  - a cap on target loads per run, with any left over named in the report
    as not loaded.
- **Acceptance criteria (no live benchmark run, Emil 2026-10-15):**
  - fixture cases: a working link, a broken same-origin link (fails), an
    external link (no request), a link repeated across pages (one test);
  - on the committed TFP-197 crawls (`runs/clean-crawl.json`,
    `runs/with-bugs-crawl.json`), offline generation leaves no link in the
    in-context gap list;
  - `check:template-unchanged` changes only by the added link tests, with
    the baseline updated deliberately and the change described in the
    commit;
  - unit and regression suites pass.
- **Dependencies:** none. Last before Phase 42 closes.
- **Built:** `src/lib/generate/mock/link-audits/inventory-tests.ts`, at the
  end of the functional suite, so no existing test's id moves. A same-origin
  target is already loaded by link health (internal and download links) or
  the linked-routes check (hash routes), and the start page by every test,
  so in today's template these tests send no request of their own. The load
  through the guard, with its cap of 20 and the named rest, is for a target
  no other check loads, and is proven on the fixture with the reuse turned
  off. A link inspection found hidden is checked by the hidden-link locator
  (present, valid `href`), and the coverage map counts that locator too. The
  committed TFP-197 crawls hold the selection but no link data, so the
  offline check uses Gate B's committed inspection of the same pages
  (TFP-188; clean's product id differs, its database re-seeded). The gap
  writer's and candidates' tests now generate without the functional area,
  where the fixture's links are still gaps.

- **TFP-205 done, verified 2026-10-15 (Cowork):** `fda373f`, `263db24`
  (expectations it changed: the read-only test count over the 166 inputs,
  1374 to 1390, and a promoted-entry case), `63de663` (the template
  baseline). One test per distinct link, at the end of the functional
  suite so no existing test id moves: on its page by the generator's
  locator or, failing that, its own address; a visible link visible and
  named, a hidden one present; a valid `href`; a same-origin target loaded
  only when no existing check (link health, linked routes, the start page)
  already loads it, up to 20 a run, the rest named. External links: `href`
  only. `check:template-unchanged` against `78a64fb`: 162 identical, 4
  different, and those 4 identical once their 16 added link tests are
  taken out. Offline on TFP-197's selections (with Gate B's committed
  inspection for the link data): no link left on the gap list. Regression
  57/57. Unit 569/572 on its one full run: the two TFP-205 expectations
  fixed in `263db24`, and one Comprehensive security case TFP-205 doesn't
  touch; the three files then passed alone, 14/14. The next full unit run
  is the review's.
- **Accepted as built:** the address fallback means a link whose text
  changed is still found by its `href` (its wording is the spelling and
  naming checks' job); the page visit itself is a plain `page.goto`, the
  target load goes through the request guard.
- **Load flakes to look at in the review:** `comprehensive-scenarios.test.ts`,
  `performance-bands.test.ts` and now a Comprehensive security case, each
  failing once in a full run and passing alone.
- **Correction (R3, 2026-10-16), the flakes:** in R1's three full unit
  runs, all three of those passed 3 of 3. The two that failed once each were
  different:
  - `read-only-guard.test.ts:168`, TFP-199's beacon case;
  - `cookie-scope.test.ts:90`.

  TFP-208 takes all five, with TFP-169.
- **Correction (R3, 2026-10-16), the run-time cost:** "send no request of
  their own" holds for target loads. But each link test is still a visit of
  its page, so TFP-205 adds run time:
  - with-bugs: 39 tests, 104 s;
  - clean: 38 tests, 67 s.

  Standard on with-bugs went from 1,235 s at Gate B to 1,535 s in R1, of
  its 1,800 s limit. The rest of the rise is a run about 15% slower all
  round.
- **R1 finding for TFP-208:** 5 link tests failed falsely, or doubtfully,
  on with-bugs' `/#/category/hand-tools`, whose product window changes
  between loads. TFP-205 has no rule for content that changes between
  loads. TFP-208 decides whether card links are skipped or found by
  something stable, as a ruling for Emil.
- **Ruling (TFP-208, 2026-10-16; confirmed by Emil 2026-10-19, with a condition below): skip.** Links inside
  a listing's repeated cards get no test each. A card group is 3 or more
  links on a page whose targets share an address but a last segment that
  is an identifier (Phase 40's `isIdSegment`). The page gets one test,
  `cards linking to <pattern> on <page>`: such cards are there, and each
  card there at run time, by position, is visible, named and has a valid
  `href` of the pattern. Targets load as for one link (the inspected
  cards' by link health). The coverage map counts each card covered by its
  group's test. `21933f7`, GEN-98.
  - **Rejected: find each card by something stable.** It keeps a test per
    card, each checking the same thing, and costs run time with-bugs
    doesn't have.
  - **The answer key:** no listed bug varies the listing. Both versions page
    a category with `paginate(9)` and no `ORDER BY`, so the order is
    unspecified. But asked ten times in a row on a freshly seeded database,
    each copy's API returned the same 9 (`benchmarks/2026-10-16-tfp208/logs/window-*.log`).
    What moved R1's window between its inspection and its run is not
    reproduced; the ruling doesn't depend on it, since it holds for any
    listing whose cards move.
  - **Measured on with-bugs (one worker, R1's driver):** the 5 false
    failures are gone and no failure is new; 18 link tests and 3 card tests
    instead of R1's 38 link tests; Standard 1,306 s (R1 1,535 s), 494 s
    under the 1,800 s limit. Clean: `benchmarks/2026-10-16-tfp208/outcome.md`.
  - **Confirmed by Emil (2026-10-19), on one condition:** a failing card is
    named by its product, not only by its slot. `02ed0ef`, GEN-99: every
    card is checked before the test fails, and it fails once, listing each
    failing card with its position and what it showed at run time (name, a
    price if shown, `href`), e.g. `card 4 of 9 on /category/hand-tools
    ("ECO Sledgehammer", $17.75, #/product/10)`. A passing test's output is
    unchanged. `check:template-unchanged` against `980346f`: 166 of 166.

### TFP-206 — Code check: allow `response.request().method()`

- **Priority:** P3 · **Labels:** `security`, `gap-writer`
- **Problem it solves:** TFP-202's check refused it as "a request other than
  GET" 9 times in TFP-197, costing revisions.
- **Scope:** allow exactly `<response>.request().method()` (and nothing else
  on `request()`); a test that the other refused forms stay refused.
- **Dependencies:** none. With the review, not before.

## Recommended Execution Order

1. Batch 1: TFP-190, TFP-191, TFP-192. **Gate A passed 2026-10-14.**
2. Batch 2: TFP-201 first, TFP-200, then TFP-193, TFP-194, TFP-195,
   TFP-196.
3. Before TFP-197: TFP-202, TFP-203, TFP-204 (one batch; batch 2's rulings).
   **Done, verified 2026-10-15.**
4. TFP-197. **Gate B.** Measured 2026-10-15; ruling above.
5. TFP-205 (template link checks). **Verified 2026-10-15; Phase 42 complete.**
   TFP-206 waits for the review.

## Gates

### Gate A — Reuse and coverage
**Passed 2026-10-14 (Emil),** with the four rulings above.
- TFP-190 to TFP-192 landed and verified: an unchanged site reuses
  everything, and the coverage map names what nothing tests.

### Gate B — Gap tests measured
**Passed 2026-10-15 (Emil),** with the gap writer not kept as a bug finder
(Gate B ruling above). TFP-205 verified the same day; Phase 42 complete.
- TFP-193 to TFP-197 landed and verified; Decision 7 applied and recorded.
