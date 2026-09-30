# Phase 35 Decision Record — Comprehensive Testing, First Slice

Date: 2026-09-30
Scope: Add a "Comprehensive" run for one chosen area beside today's
"Standard" run, and build its first two areas: passive (read-only) security
and an automated WCAG scan for accessibility. The local model's
site-specific scenarios are shown, labelled, but kept out of the verdict.
Status: Approved (Emil, 2026-09-30).

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

TFP-131 was the last issued ticket.

### TFP-132 — Comprehensive run mode

- **Phase:** 35 · **Priority:** P1 · **Labels:** `enhancement`, `run`, `ui`
- **Problem it solves:** TestForge has only one run type, breadth.
- **Scope:** Decisions 1, 2 and 7, with the report's shape and Decision 6's
  fixed statements.
- **Deliverables:** API and UI; page scope and cap; one-worker rule; report
  shape; tests; `TEST_PLAN.md` cases.
- **Acceptance criteria:** Acceptance Criteria 1 and 5.
- **Dependencies:** None.

### TFP-133 — Passive security checks

- **Phase:** 35 · **Priority:** P1 · **Labels:** `enhancement`, `generate`,
  `security`
- **Problem it solves:** security depth beyond the landing page, safe on any
  site.
- **Scope:** Decision 3, with the standards tags.
- **Deliverables:** Checks; ASVS/Top 10 tags from the source; the
  request-recording test; fixture defects; `TEST_PLAN.md` cases.
- **Acceptance criteria:** Acceptance Criteria 2.
- **Dependencies:** TFP-132.

### TFP-134 — axe-core accessibility scan

- **Phase:** 35 · **Priority:** P1 · **Labels:** `enhancement`, `generate`,
  `accessibility`
- **Problem it solves:** accessibility is five hand-written checks with no
  recognised standard behind them.
- **Scope:** Decision 4.
- **Deliverables:** Dependency; scan; impact split; "incomplete" list;
  fixture defects; `TEST_PLAN.md` cases.
- **Acceptance criteria:** Acceptance Criteria 3.
- **Dependencies:** TFP-132.

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

### TFP-136 — Measure the first slice

- **Phase:** 35 · **Priority:** P2 · **Labels:** `measurement`
- **Problem it solves:** comprehensive run timings are estimates today.
- **Scope:** Acceptance Criteria 2's the-internet check and Acceptance
  Criteria 6.
- **Deliverables:** A report under `docs/decisions/`; the labelled failure
  set updated; the roadmap's timing estimate replaced.
- **Acceptance criteria:** Acceptance Criteria 2 (real site) and 6.
- **Dependencies:** TFP-133, TFP-134, TFP-135.

## Recommended Execution Order

1. TFP-132.
2. TFP-133, TFP-134 and TFP-135, in any order.
3. TFP-136 last.

## Suggested Milestone Gates

### Gate A — Comprehensive run mode, with Standard unchanged
- TFP-132 landed and independently verified, with the Standard run's output
  shown unchanged by measurement.

### Gate B — First slice built and measured
- TFP-133 to 136 landed and independently verified, with no unexplained
  failure on the real site.
