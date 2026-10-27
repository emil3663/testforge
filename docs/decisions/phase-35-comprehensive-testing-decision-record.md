# Phase 35 Decision Record — Comprehensive Testing, First Slice

Date: 2026-09-30
Scope: Add a "Comprehensive" run for one chosen area beside today's
"Standard" run, and build its first two areas: passive (read-only) security
and an automated WCAG scan for accessibility. The local model's
site-specific scenarios are shown, labelled, but kept out of the verdict.
Status: First slice built and verified 2026-10-01 (Gate B); the later areas are in the deferred-work register. Approved (Emil, 2026-09-30).

## Context

The product-roadmap outline (Phase 35) set the direction on 2026-09-28:
- A Standard run is breadth: the same best-practice checks for every site,
  a few tests per area.
- A Comprehensive run is depth: one area of concern, as far as the site
  allows.
- The name is "Comprehensive testing". Security comes first, then SEO, then
  the highest-risk areas from run history.
- A single-area run reports only that area. Security is organised in three
  levels: passive, authenticated, active.

Phases 36 and 37 made the local model fast enough (39.5 s median per suite,
`num_gpu 29`), and measured its quality by hand. Performance, SEO, security,
accessibility and database meet Phase 33's bar. Reliability does in 2 of 3
runs, with misleading titles that no gate catches. Functional guesses where
a sign-in leads. That is why its tests stay out of the verdict (Decision 5).

Standards used (as of 2026-09-30):
- OWASP ASVS 5.0 (May 2025) defines what is checked.
- The OWASP Web Security Testing Guide (v4.2) describes how.
- Findings are grouped by OWASP Top 10:2025 category.
- Accessibility uses WCAG 2.2 through axe-core (MPL-2.0). axe-core states it
  finds on average 57% of WCAG issues automatically and flags others for
  manual review.

## Decisions

1. A Comprehensive run covers one area, chosen by the user, beside the
   unchanged Standard run.
- In the UI and the API, a run is Standard (today's behaviour) or
  Comprehensive for one area. This phase offers two areas: security
  (passive) and accessibility.
- A Standard run's generated suite and report are unchanged. This is
  measured on fixed inputs, as in earlier phases.
- All-areas Comprehensive runs, scheduling and per-area jobs are deferred.

2. A Comprehensive run covers every inspected page, politely.
- Pages come from crawl and introspection (Phases 18-19), up to 20 pages by
  default, configurable. When the site has more, the report says so and
  names the pages covered.
- On any host that isn't a local development host, it runs with one
  Playwright worker, so it doesn't load the site like an attack would.
- It runs as a background job with the existing progress display, and its
  duration is recorded.

3. Comprehensive security, passive level: read-only checks on every page.
- Every check only loads pages and reads what comes back. One exception:
  a single request to a random path that cannot exist, to see the site's
  error page.
- Nothing submits a form, changes data or sends attack-shaped input. That is
  the active level, which is not built here.
- **Failures:** real exposures.
  - A password field on a page served over plain HTTP.
  - A form that sends a password field to a plain-HTTP address.
  - A session-like token or password in a URL (links, redirects, form
    `GET` targets).
  - An error page that shows a stack trace or file paths.
- **Findings:** hardening gaps, following Phase 34 Decision 3.
  - Missing or weak security headers on any page: CSP, X-Content-Type-Options,
    frame protection, HSTS on HTTPS, Referrer-Policy.
  - Mixed content on HTTPS pages.
  - `Server` or `X-Powered-By` headers giving a software version.
  - Cookie flags on every page, using the Phase 36 session-cookie rules.
- Every check is tagged with its OWASP Top 10:2025 category and, where one
  applies, its ASVS 5.0 requirement ID. IDs are copied from the published
  ASVS 5.0 source, not written from memory, and the source file and version
  are recorded.

4. Comprehensive accessibility: an axe-core WCAG 2.2 scan on every page.
- `@axe-core/playwright` is added as a dependency, unmodified (MPL-2.0).
- Rules: WCAG 2.0, 2.1 and 2.2 at levels A and AA.
- **Failures:** violations with impact "critical" or "serious".
- **Findings:** violations with impact "moderate" or "minor".
- Anything axe marks "incomplete" is listed as needing manual review, not
  counted as passed.
- The existing accessibility checks (Phase 34, TFP-121) also run on every
  page.

5. The local model's scenarios are labelled and kept outside the verdict.
- When the local model is configured, a Comprehensive run also asks it for
  site-specific scenarios for that area, on top of the template's checks.
  Every existing gate applies.
- Its tests are shown in their own report section, marked as written by the
  local model and not yet trusted. They do not count toward pass/fail, the
  release recommendation or any coverage figure.
- A failed model test is shown as "failed: needs review", with its message,
  not as a defect in the site.
- When no model is configured, or it is rejected or times out, the report
  says so. The template's checks stand on their own.
- Letting model tests count later is a separate decision. It needs the
  labelled failure set to show they are trustworthy for that area.
- **Amended at Gate B (Emil, 2026-10-01): where the model's tests run.**
  - In a passive security run they are listed and never run. A
    model-written test may send input (on the fixture the model wrote
    invalid-input and script-injection tests), and running it would be the
    active level, which needs Decision 8's confirmation.
  - In other areas they run only with interactive tests on
    (`TESTFORGE_INTERACTIVE=1`), as gap-fill tests do (GEN-44).

6. Every Comprehensive report ends with what it did not test.
- A fixed, written statement per area, not model-generated. It is the first
  use of `honest-coverage`'s idea as a rule inside TestForge.
- **Security (passive):** no input was sent, so injection and access control
  are untested. Logged-in pages were not checked. Server configuration that
  isn't visible over HTTP can't be verified from a browser. A table lists the
  ASVS areas tested and those out of reach.
- **Accessibility:** automated scanning finds about half of WCAG issues
  (axe-core states 57% on average). Keyboard use, screen-reader experience
  and content clarity need a person. The "incomplete" items are listed for
  that review.
- Pages beyond the cap are named as not covered.

7. The report for a single-area run shows only that area.
- An area summary, a per-page table, then failures and findings grouped by
  OWASP category (security) or WCAG criterion (accessibility), each naming
  the page and element.
- Then the model's section (Decision 5) and the "not tested" statement
  (Decision 6).
- Recorded with the run like any other: persistence, diffing and the gate
  verdicts all apply.

8. The permission confirmation for active security testing is decided now
   and built with the active level.
- Before any active run, the user types the domain they are testing and
  confirms they own it or have written permission to test it.
- The confirmation (the typed domain, the wording confirmed, the time) is
  saved with the run and shown in its report. A run whose target domain
  doesn't match what was typed does not start.
- Active testing of a site without permission is unauthorised security
  testing, which is illegal in most countries, including South Africa.
- Not built in this phase: no active check exists yet.
- **Amended 2026-10-19 (Emil; Phase 43, Decision 14):**
  - The confirmation is saved with the site, not the run, and named in each
    run's report. A tester confirms once per site
    (`phase-43-ownership-confirmation-decision-record.md`).
  - "A run whose target domain doesn't match what was typed does not start"
    becomes: the run goes ahead, and its active tests are Not run with the
    reason (Phase 43 Decision 8).
  - The text above is kept as it was decided.

## Acceptance Criteria

1. Run modes
- Standard runs are unchanged: template output on fixed inputs is
  byte-identical before and after.
- A Comprehensive run for security or accessibility can be started from the
  UI and the API. It covers up to the page cap, names any pages left out, and
  runs with one worker on non-local hosts.

2. Passive security
- On the comparison fixture, each injected passive-security defect (Decision
  3's failure list) fails with the page and element named. Each hardening
  gap is a finding.
- On the-internet.herokuapp.com, no failure is a false one. Every failure is
  a real exposure, confirmed by reading the page, and recorded in the
  labelled failure set.
- No request other than page loads and the one missing-page probe is sent.
  A test proves it by recording every request the checks make.

3. Accessibility
- On the fixture, injected WCAG defects (at least a missing image alt, a
  contrast failure and an unlabelled field) are found and classed by impact.
- "Incomplete" items appear as needing manual review.

4. Model section
- With the model configured, its tests appear only in their own section and
  change no count in the summary. A deliberately failing model test leaves
  the verdict unchanged.
- Without the model, the report says so.

5. Report
- A single-area report contains only that area, ends with the fixed "not
  tested" statement, and lists the ASVS areas tested and out of reach.

6. Measurement
- Durations for Comprehensive security and accessibility runs on the fixture
  and the-internet are recorded against a Standard run, replacing the
  roadmap's estimates.

## Regression Policy

- `TEST_PLAN.md` gets cases for: each run mode; each passive-security
  failure and finding; the axe impact split and "incomplete"; the model
  section staying outside the verdict; the "not tested" statement; the
  one-worker rule; and the request-recording test. Each lands with its code.
- The fixture gains switchable passive-security and WCAG defects, documented
  beside the existing ones.

## Related, deferred (not this phase)

- Authenticated security (logout, session changes, access between two
  accounts) and active security (driving ZAP), with Decision 8's
  confirmation.
- Comprehensive SEO, then the highest-risk areas from run history.
- All-areas Comprehensive runs, scheduling, and per-area jobs.
- Letting model tests count toward the verdict (Decision 5).
- axe-core in the Standard run: possible later; kept out now so the Standard
  run stays unchanged.

## Backlog

TFP-131 was the last issued ticket. TFP-137 and TFP-138 were added on 2026-10-01, and TFP-139 and TFP-140 at Gate B.

### TFP-132 — Comprehensive run mode

- **Phase:** 35 · **Priority:** P1 · **Labels:** `enhancement`, `run`, `ui`
- **Problem it solves:** TestForge has only one run type, breadth.
- **Scope:** Decisions 1, 2 and 7, with the report's shape and Decision 6's
  fixed statements.
- **Deliverables:** API and UI; page scope and cap; one-worker rule; report
  shape; tests; `TEST_PLAN.md` cases.
- **Acceptance criteria:** Acceptance Criteria 1 and 5.
- **Dependencies:** None.
- **Status:** Built 2026-09-30 (TEST_PLAN RUN-22 to RUN-24, RPT-16); Standard output measured unchanged, and by TFP-137's check on 2026-10-01: 166 of 166 identical. Each page gets one check, that it loads, until TFP-133/134 add the area checks.
- **Verified:** 2026-10-01, Gate A, independently in Cowork.
  - 166 of 166 identical by TFP-137's check on Linux, matching Windows.
  - The verifier's own scripts give the same result on the same inputs, value for value.
  - Unit suite: 392 tests, 379 passed, 13 skipped (real-browser tests; the VM has no Chromium), none failed.
  - `tsc` is clean, and so is ESLint on all 31 changed files.
  - All 17 ASVS chapter names, and requirements 12.2.1, 13.4.6, 14.2.1 and 16.5.1, were checked against the v5.0.0_release files.
  - Not checkable in the VM: the live runs (the fixture, the-internet, the UI) and the real-browser report test. They rest on the builder's Windows run.
  - Found: the Standard HTML export's tabs have never worked (TFP-138); the fixed statements describe checks not yet built (TFP-133 and TFP-134); and the one-worker rule depends on the caller sending `runMode` (TFP-133).

### TFP-133 — Passive security checks

- **Phase:** 35 · **Priority:** P1 · **Labels:** `enhancement`, `generate`,
  `security`
- **Problem it solves:** security depth beyond the landing page, safe on any
  site.
- **Scope:** Decision 3, with the standards tags.
- **Deliverables:** Checks; ASVS/Top 10 tags from the source; the
  request-recording test; fixture defects; `TEST_PLAN.md` cases.
- **Acceptance criteria:** Acceptance Criteria 2.
  - **Added at Gate A (2026-10-01):** the security "not tested" statement
    is true of the run. Today it says a missing-page probe was sent, which
    only becomes true when this ticket adds the probe.
  - **Added at Gate A (2026-10-01):** the one-worker rule no longer depends
    on the caller. Today `/api/run` applies it only when the request
    carries `runMode`, and judges the host from the request's `baseUrl`. A
    Comprehensive suite posted without `runMode`, or with a local `baseUrl`
    but pages on another host, runs with the Standard worker count. The
    generated suite enforces one worker itself (for example
    `test.describe.configure({ mode: "serial" })` in its single file), and
    a test proves it. This matters little while the checks only load
    pages, but it must hold before the active level exists.
- **Dependencies:** TFP-132.
- **Status:** Built 2026-10-01 (TEST_PLAN GEN-59, GEN-60; RUN-24 and RPT-16 updated). On the fixture each injected passive defect fails or is a finding as Decision 3 sets, naming page and element; the clean fixture has no failures. Both Gate A criteria: the missing-page probe exists, so the statement is true; the suite enforces one worker itself (proven under `--workers=4 --fully-parallel`), so a Comprehensive run is one worker on every host. Acceptance Criteria 2's the-internet check is TFP-136's. Not yet independently verified. Not pushed.

### TFP-134 — axe-core accessibility scan

- **Phase:** 35 · **Priority:** P1 · **Labels:** `enhancement`, `generate`,
  `accessibility`
- **Problem it solves:** accessibility is five hand-written checks with no
  recognised standard behind them.
- **Scope:** Decision 4.
- **Deliverables:** Dependency; scan; impact split; "incomplete" list;
  fixture defects; `TEST_PLAN.md` cases.
- **Acceptance criteria:** Acceptance Criteria 3.
  - **Added at Gate A (2026-10-01):** the accessibility "not tested"
    statement is true of the run. Today it describes a scan and its
    "could not decide" list, which don't exist until this ticket.
- **Dependencies:** TFP-132.
- **Status:** Built 2026-10-01 (TEST_PLAN GEN-61; RPT-16 updated). Acceptance Criteria 3: on the fixture, a missing image alt, a contrast failure and an unlabelled field are found and classed by impact (critical, serious, critical), each under its WCAG criterion and naming the element; undecided items appear under "Needs manual review" (proven in a real browser). The Gate A criterion: the statement is true of the run.
- **Gate B finding, to fix in this ticket before the push (2026-10-01):**
  - TFP-121's field-name check **passed** on the three pages that answered
    HTTP 401 on the-internet (`/basic_auth`, `/digest_auth`,
    `/download_secure`, run `84094801`). There was no page to check, so 3
    of the 17 passes check nothing. `198dbec`'s rule is that a page
    answering 400 or more is Not run with the reason; the axe scan follows
    it and this check doesn't.
  - Fix it in the Comprehensive copy of the check only. The Standard
    template must stay 166 of 166 identical.
  - Correct the measurement report and TEST_PLAN to match: on the-internet
    that is 14 passed, 20 failed, 6 not run.
  - In the same commit: `WCAG_TAGS` lists `wcag22a`, which axe-core 4.13.0
    doesn't have (its WCAG tags are `wcag2a`, `wcag2aa`, `wcag2aaa`,
    `wcag21a`, `wcag21aa`, `wcag22aa`). Drop it. The scan still selects
    the same 70 rules. WCAG 2.2's new level-A criteria have no axe rule,
    which the "need a person" statement already covers.
- **Gate B finding fixed in `ab60f46` (2026-10-01), verified in Cowork the same day:** the Comprehensive copy of TFP-121's check is Not run on a page answering 400 or more, with the reason; `wcag22a` is dropped (axe-core 4.13.0's level tags checked: `wcag2a`, `wcag2aa`, `wcag2aaa`, `wcag21a`, `wcag21aa`, `wcag22aa`; 70 rules selected before and after). The template stays 166 of 166 identical. The-internet counts are corrected to 14 passed, 20 failed, 6 not run, derived from the committed evidence and confirmed by a live re-run (`a7540ac8`).
  - **Verification:**
    - A built Comprehensive accessibility suite skips both checks on an answer of 400 or more, for each page, including a path with a quote, and loads each page once.
    - The suite passes the type check, and its scan's tags are the five axe has.
    - The new run's evidence gives 40 tests: 14 passed, 20 failed, and 6 not run, which are the three 401 pages with both checks each. Its 20 failures are the same as the first run's.
    - The template is 166 of 166 identical from 094d52d to ab60f46.
    - `tsc` and ESLint are clean.
    - The real-browser test skips in the VM (no Chromium), so it rests on the builder's run.

### TFP-135 — Model scenarios, labelled and outside the verdict

- **Phase:** 35 · **Priority:** P2 · **Labels:** `enhancement`, `local`,
  `report`
- **Problem it solves:** the model can add site-specific depth, but isn't
  yet trustworthy enough to count.
- **Scope:** Decision 5.
- **Deliverables:** Request; report section; summary exclusion; tests;
  `TEST_PLAN.md` cases.
- **Acceptance criteria:** Acceptance Criteria 4.
- **Dependencies:** TFP-132.
- **Status:** Built 2026-10-01 (TEST_PLAN GEN-62; RPT-16 updated). Acceptance Criteria 4: with the model configured its tests appear only in their own section and change no count; a deliberately failing model test leaves the verdict unchanged (proven in a real browser and in a finalised job); without the model, or with its suite rejected, the report says so. **One choice beyond the record, for review:** in a passive security run the model's scenarios are listed and never run, because a model-written test may send input (the live model wrote invalid-input and script-injection tests), which is the active level and needs Decision 8's permission; in accessibility they run only with interactive tests on, as gap-fill tests do. Not yet independently verified. Not pushed.

### TFP-136 — Measure the first slice

- **Phase:** 35 · **Priority:** P2 · **Labels:** `measurement`
- **Problem it solves:** comprehensive run timings are estimates today.
- **Scope:** Acceptance Criteria 2's the-internet check and Acceptance
  Criteria 6.
- **Deliverables:** A report under `docs/decisions/`; the labelled failure
  set updated; the roadmap's timing estimate replaced.
- **Acceptance criteria:** Acceptance Criteria 2 (real site) and 6.
- **Dependencies:** TFP-133, TFP-134, TFP-135.
- **Status:** Measured 2026-10-01 (`phase-35-first-slice-measurement-report.md`, evidence in `benchmarks/2026-10-01-phase35-first-slice/`). Acceptance Criteria 2 on the-internet: the first passive run had 5 false failures, all template errors (labelled T13 to T17), fixed in `198dbec`; after the fix, 0 failures on 20 pages, and the 85 findings match the site's real headers. Accessibility there: 20 failures, each confirmed real (R4 to R9). Acceptance Criteria 6: durations recorded against Standard runs, and the roadmap's estimate replaced. Not yet independently verified. Not pushed.

### TFP-137 — Commit the check that proves the template's output unchanged

- **Phase:** 35 · **Priority:** P1 · **Labels:** `test`, `tooling`,
  `generate`
- **Problem it solves:** Gate A, and every regression policy since Phase 34,
  needs the template's output shown byte-identical on fixed inputs. The
  scripts that do this exist only on the verifier's side, so nobody else can
  repeat the check, and the builder can't run it before reporting
  (`docs/QUALITY_GATES.md`, section 6).
- **Context:** the verifier's scripts import `mockGenerate` from each
  commit's own source, run it on 166 fixed inputs, and compare the JSON
  byte for byte.
  - **144 inputs without page data.** 3 targets (`http://127.0.0.1:4410`,
    `https://the-internet.herokuapp.com`, `https://demoqa.com`) × 2 audit
    modes (`fast`, `deep`) × 24 requests:
    - "Check the home page." with each of the 10 areas alone, and with no
      areas;
    - "Check the <w> of the home page." for each of "performance", "load
      time", "speed" and "response time", with `performance/load`, with no
      areas, and with `functional`;
    - "Check security and save data, update cookies, accessibility and
      seo." with no areas.
  - **22 inputs with page data.** `benchmarks/2026-09-29/content-profile.json`
    on `http://127.0.0.1:4410`, "Check the site.", 2 modes × (each of the
    10 areas alone, and no areas).
  - Content rules are the defaults (`normalizeContentRules(undefined)`).
- **Scope:**
  - `npm run check:template-unchanged -- <base-ref> [<head-ref>]`. The head
    defaults to the working tree.
  - For each ref, extract `src/`, `scripts/` and `package.json` with
    `git archive` into a temporary folder and link the working tree's
    `node_modules` (a directory junction on Windows, so no admin rights are
    needed). Then import that ref's `mockGenerate`, `normalizeContentRules`,
    `normalizeTestAuditMode` and, where it exists, `normalizeContentProfile`.
  - The inputs and the content profile come from the working tree, never
    from the refs, so both sides run the same inputs. The input list lives
    in one committed file and is exactly the 166 above.
  - The output gives the number of inputs run, identical and different,
    and, for each different input, its key and the first differing line.
    Exit code 0 only when every input is identical. Both outputs are kept
    under `comparisons/template-unchanged/<base>-<head>/` (gitignored) for
    inspection.
  - If a ref's exports or `mockGenerate`'s parameters don't match, stop
    with a named error. Never adapt the call to make it run.
  - No browser, no network, no model: it runs wherever Node runs, including
    the verifier's VM.
- **Deliverables:** the script, its input file and the npm script; unit
  tests of the comparison; `TEST_PLAN.md` case GEN-58; `docs/QUALITY_GATES.md`
  sections 3 and 5 naming the command, and section 6's gap closed.
- **Acceptance criteria:**
  1. `npm run check:template-unchanged -- 66e08bf 20bd60d` (a docs-only
     commit) reports 166 of 166 identical and exits 0.
  2. `npm run check:template-unchanged -- 960bc3d~1 960bc3d` (optional SEO
     items became findings) reports exactly 4 of 166 different and exits 1.
     The 4 are the page-data inputs for `seo/content` and for no areas, in
     both modes. All 144 inputs without page data are identical, which is
     why the page-data inputs are part of the check.
  - Criteria 1 and 2 were measured by the verifier's scripts on 2026-10-01,
    and the committed check must reproduce them.
  3. `npm run check:template-unchanged -- 20bd60d 134b183` is run and its
     result reported as it is. This is Gate A's measurement for TFP-132. A
     result other than 166 of 166 is a TFP-132 defect, fixed in TFP-132
     (standing execution policy).
  4. The same counts on Windows (Emil's machine) and Linux (the verifier's
     VM).
  5. The working tree is unchanged afterwards: temporary folders are
     removed, and `git status` shows nothing new outside gitignored output.
  6. Unit tests: identical outputs pass; a single changed character in one
     input is reported with that input's key; a missing export stops with
     its name.
- **Not in this ticket:**
  - A committed golden snapshot. Comparing ref against ref needs none and
    can't go stale.
  - CI wiring.
  - Local-model or real-browser output.
  - Changing the input set. That is its own decision, so results stay
    comparable with earlier checks.
- **Dependencies:** none. Gate A's verification of TFP-132 depends on it.
- **Status:** Built 2026-10-01 (TEST_PLAN GEN-58). Measured on Windows: criterion 1, 166 of 166 identical, exit 0; criterion 2, exactly the 4 named inputs different, exit 1; criterion 3 on 134b183, 166 of 166 identical, exit 0; criterion 5, working tree unchanged; criterion 6, unit tests pass. Criterion 4's Linux run is the verifier's.
- **Verified:** 2026-10-01, Gate A, in Cowork.
  - On Linux: criterion 1 gives 166 of 166 identical, exit 0. Criterion 2 gives exactly the 4 named inputs different, exit 1. Criterion 3 gives 166 of 166 identical, exit 0. A bad ref exits 2.
  - `node_modules` is intact (417 entries before and after), no temporary folder is left, and `git status` is clean.
  - The check's outputs for 134b183 equal the verifier's own scripts' outputs on all 166 inputs, so it runs the same inputs.
  - The 6 unit tests pass.

### TFP-138 — The Standard HTML export's tabs switch

- **Phase:** 35 · **Priority:** P2 · **Labels:** `bug`, `report`
- **Problem it solves:** the exported Standard report can't be read
  beyond its first tab.
  - Its tab buttons call `showTab`, but the script at the end of
    `src/lib/report/html.ts` has neither its opening `<script>` tag nor
    the `function showTab(btn, id) {` line. The function's body shows as
    page text and no tab switches.
  - Found by the builder during TFP-132; the 134b183 message says it dates
    from 9fbfab9. Confirmed by reading `html.ts` at Gate A, 2026-10-01.
  - RPT-08 checks that the export is available, not that its tabs work.
- **Scope:**
  - Restore the missing script lines, and nothing else in the export.
  - Decision 1 keeps the Standard report from changing by accident. This
    is a named fix, measured to change nothing else.
- **Deliverables:**
  - The fix.
  - A real-browser test that opens an exported Standard report, clicks
    every tab, and checks that its panel shows, the others hide, and no
    script text appears as page content.
  - `TEST_PLAN.md` RPT-17.
- **Acceptance criteria:**
  1. The new test passes.
  2. Exports of the same Standard runs before and after the fix (TFP-132's
     11 suites) differ only in the restored script lines.
  3. TFP-137's check still gives 166 of 166 identical.
- **Not in this ticket:** any other change to the export or its styling;
  the Comprehensive export, which has no tabs.
- **Dependencies:** none.
- **Status:** Built 2026-10-01 (TEST_PLAN RPT-17). Criterion 1: the real-browser test passes, and fails on the previous code at the second tab. Criterion 2: the 11 exports differ only by the 4 restored lines. Criterion 3: 166 of 166 identical.
- **Verified:** 2026-10-01, in Cowork.
  - The same Standard report exported at 78b17d2 and at 163b4c7 differs only by the 4 restored lines.
  - The export's own script was run against the export's own 7 tab buttons and 7 panels, outside a browser. Before the fix, its text shows on the page and `showTab` is undefined. After it, every tab shows only its own panel and only that tab is active.
  - `check:template-unchanged 78b17d2 163b4c7` gives 166 of 166 identical.
  - `tsc` and ESLint are clean.
  - The real-browser test skips in the VM, which has no Chromium; it rests on the builder's run.

### TFP-139 — Keep a model accessibility suite that imports axe

- **Phase:** 35 · **Priority:** P3 · **Labels:** `local`, `generate`
- **Problem it solves:** a model accessibility suite that uses axe is
  always rejected.
  - When the model's suite is merged into a Comprehensive accessibility
    suite, only its `@playwright/test` import is dropped.
  - A model suite that imports `@axe-core/playwright` (the natural way to
    write accessibility scenarios) passes the model's own type check. But
    the merged suite then has an import inside a `describe`: TS1232, "An
    import declaration can only be used at the top level of a namespace or
    module".
  - The run falls back to the template safely, but those scenarios are
    always lost. Reproduced at Gate B, 2026-10-01.
- **Scope:**
  - The merge also drops an `import AxeBuilder from '@axe-core/playwright'`
    line, which the suite already has. This is the same kind of removal as
    the `@playwright/test` line, not a rewrite of the model's tests.
  - Any other import still fails the merged type check, by design.
- **Acceptance criteria:**
  - A model suite importing axe merges and passes the merged type check.
  - A model suite importing anything else still falls back, with the gate
    verdict recorded.
- **Dependencies:** none.

### TFP-140 — A crawled page's server error is checked for leaks

- **Phase:** 35 · **Priority:** P3 · **Labels:** `security`, `generate`
- **Problem it solves:** only one error page is ever read for leaks.
  - Since `198dbec`, a covered page that answers 500 or more is Not run, so
    its error body is never read.
  - Only the one missing-page probe checks an error page for stack traces
    and file paths. A real page that crashes and shows its stack trace (the
    exposure Decision 3 names) is reported as not run.
- **Scope:** on an answer of 500 or more, apply the probe's error-leak
  patterns to that page's body. A leak fails, as the probe's does. With no
  leak, the other checks stay Not run with the reason.
- **Acceptance criteria:**
  - On the fixture, a page switched to answer 500 with a stack trace fails,
    naming the page and the pattern.
  - A page answering 500 without a leak is not failed.
  - Still no request beyond page loads and the one probe (the
    request-recording test).
- **Dependencies:** none.

## Recommended Execution Order

1. TFP-132.
2. TFP-137 (added 2026-10-01, after TFP-132 was built), then Gate A's
   verification of TFP-132 with it.
3. TFP-138 (added at Gate A, 2026-10-01).
4. TFP-133, TFP-134 and TFP-135, in any order.
5. TFP-136 last.
6. The Gate B finding in TFP-134, before the push. TFP-139 and TFP-140
   after, in any order.

## Suggested Milestone Gates

### Gate A — Comprehensive run mode, with Standard unchanged
- TFP-132 and TFP-137 landed and independently verified, with the Standard
  run's output shown unchanged by TFP-137's check (its Acceptance Criterion
  3), run by the builder and repeated by the verifier.
- **Verified 2026-10-01** (Cowork): passed. See the TFP-132 and TFP-137
  status entries.

### Gate B — First slice built and measured
**Built 2026-10-01** (`a7fae28` TFP-133, `7c8b979` TFP-134, `8c5b1e4` TFP-135, `198dbec` the fix found by TFP-136, and TFP-136's measurement). Not pushed.
- **Verified and passed 2026-10-01 (Cowork).** TFP-134's Gate B finding was
  fixed in `ab60f46` and checked:
  - The template is 166 of 166 identical from 094d52d to 7f7829b, on Linux.
  - Unit suite: 413 tests, 388 passed, 25 skipped (real-browser tests; the
    VM has no Chromium), none failed. `tsc` and ESLint are clean on the 26
    changed files.
  - Every OWASP Top 10:2025 title, its CWE mappings, and ASVS 3.3.1, 3.3.3,
    3.3.4, 3.4.1 and 3.4.3 to 3.4.6 were checked against their source
    files.
  - The checks read as passive: page loads plus one GET probe. The
    request-recording test asserts GET only, never two requests at once,
    and one worker slot under `--workers=4 --fully-parallel`.
  - The model section's exclusion from every count is proven by its
    real-browser test.
  - From the committed evidence: security on the-internet has 81 tests
    (72 passed, 9 not run, 0 failed) and 85 findings, 5 kinds on each of
    the 17 pages that load. The contrast ratio of `rgb(43,166,203)` on
    white recomputes to 2.83:1.
  - Not checkable here: the live runs. The VM can't reach the site, so they
    rest on the builder's Windows runs and the committed evidence.
  - Emil accepted Decision 5's amendment and `198dbec` (2026-10-01).
- TFP-133 to 136 landed and independently verified, with no unexplained
  failure on the real site.
