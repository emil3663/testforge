# Phase 38 Decision Record — Standard Run: Three Gates, Shared Conformance Checks, Performance Bands

Date: 2026-10-05
Scope: Define what a run may do through three gates. Make the Standard run the critical working path. Bring the read-only conformance checks (passive security and the axe scan) into it through one shared implementation. Grade performance with Core Web Vitals' three bands.
Status: Locked. Approved by Emil on 2026-10-05: Decisions 1 to 5, 7 and 8 in the coverage proposal, and Decision 6 in chat. Not started; TFP-145 is in progress first.

## Context

The coverage proposal ("Proposal — TestForge coverage against the standards", a Claude Docs document, 2026-10-05) measured today's Standard run against the published standards:

- The Standard template writes about 44 distinct kinds of check across ten categories. Five categories have only one or two.
- **Accessibility:** Standard has 3 hand-written kinds of check and no axe scan. WCAG 2.2 has 55 success criteria at levels A and AA, and axe-core 4.13.0's 70 A/AA rules touch 23 of them.
- **Security:** Standard has 4 kinds of check, and its header and cookie checks look at the landing page only. The passive checks built in Phase 35 (TFP-133) run in Comprehensive runs only.
- **Performance:** the LCP budget is 4 s, Core Web Vitals' "poor" line. A page between 2.5 and 4 s passes silently, and CLS isn't measured.

Phase 35 kept the Standard run unchanged on purpose. Its Decision 1 says "Standard runs are unchanged", and its deferred list says axe-core in the Standard run is "possible later; kept out now so the Standard run stays unchanged". This phase is that later change, made deliberately and measured.

Standard and Comprehensive have separate header and cookie checks today. On rizonetech.com they disagreed about the same site, which TFP-144 fixed.

Today a single environment variable, `TESTFORGE_INTERACTIVE` (Phase 19 Decision 2), gates everything that changes state. That covers the journey tests, the database round trip, the script-payload test and the local model's tests. Nothing in it separates a harmless form submit from attack-shaped input. Phase 35 Decision 8's typed ownership confirmation is decided but not built.

The coverage proposal fixed the references (its decision 4, confirmed 2026-10-05):

- WCAG 2.2 (ISO/IEC 40500:2025) at levels A and AA;
- OWASP ASVS 5.0.0 Level 1;
- Core Web Vitals, with the date the thresholds were checked.

The Core Web Vitals bands were checked on web.dev on 2026-10-05:

- LCP: 2.5 s or less, up to 4 s, over 4 s;
- INP: 200 ms or less, up to 500 ms, over 500 ms;
- CLS: 0.1 or less, up to 0.25, over 0.25.

They are judged at the 75th percentile of real visits. web.dev calls Total Blocking Time (TBT) "a reasonable proxy" for INP, "not a substitute", and notes that lab tools only see layout shifts during page load.

Test design follows ISTQB CTFL v4.0 practice (confirmed by Emil, 2026-10-05).

## Decisions

1. Every generated test runs behind one of three gates.
- **Read-only gate:** loading pages and reading what comes back (headers, cookies, the rendered page, links), the axe scan, and interactions that send nothing to the server, such as opening a dialog, switching tabs or expanding an accordion. It also allows one request per run to a path that cannot exist. Always on.
- **Interactive gate:** submitting forms with valid data or harmlessly invalid data. It runs only with `TESTFORGE_INTERACTIVE=1`, today's variable and today's rule, unchanged.
- **Active gate:** attack-shaped input, lockout and rate-limit probing, and load testing. It runs only after Phase 35 Decision 8's typed ownership confirmation, which isn't built in this phase.
- Each generated test declares its gate in a `gate` annotation.
- A test whose gate is closed is Not run, with the reason. It is never silently absent and never failed (Phase 34 Decision 7, Option C).
- The report shows each test's gate, and counts the tests not run for each gate.

2. Standard is the critical working path; Comprehensive tries to break it.
- **Standard:** every component on the inspected pages does what it should. Standard runs at the read-only gate always, and at the interactive gate when it is on.
- **Comprehensive:** negative and edge-case testing on more pages, using ISTQB techniques: equivalence partitioning, boundary value analysis, decision tables, state transitions and error guessing. Its tests are designed in later phases; this phase sets the boundary only.
- Every new test names the ISTQB technique it uses.

3. Existing tests keep their gate, except one.
- The journey tests, the database round trip and the local model's tests stay at the interactive gate.
- The Standard script-payload test ("script-shaped input is not executed") sends attack-shaped input, so it moves to the active gate (see Decision 6).
- Every other existing test is read-only.

4. The read-only conformance checks join the Standard run, through one shared implementation.
- **Passive security:** Phase 35 Decision 3's checks run on every inspected page. They cover security headers and cookies, software versions in headers, passwords on plain HTTP, and passwords or tokens in URLs. The missing-page probe runs once per run.
- **Accessibility:** the axe scan (WCAG 2.0, 2.1 and 2.2 at levels A and AA) runs on every inspected page, with Phase 35 Decision 4's impact split:
  - critical and serious violations fail;
  - moderate and minor violations are findings;
  - "incomplete" items are listed for manual review, never counted as passed.
- **One implementation:** Standard and Comprehensive call the same check builders. Standard's own landing-page header check and its session-cookie check are replaced by the shared ones, so the two runs cannot disagree about the same page.
- **Reach:** Standard covers the inspected pages, up to `MAX_INSPECTION_PATHS` (5). Comprehensive keeps its 20-page cap.
- **Tags:** every check keeps its OWASP Top 10:2025 category and its ASVS 5.0.0 IDs, or its WCAG criterion as read from axe's own tags.

5. Performance is graded with Core Web Vitals' three bands, as published on web.dev (checked 2026-10-05).
- **LCP:**
  - 2.5 s or less passes;
  - above 2.5 s, up to 4 s, is a finding ("needs improvement");
  - over 4 s fails ("poor").
  - The failure line is unchanged: `LCP_BUDGET_MS` stays 4000.
- **CLS:** measured during load. 0.1 or less passes, above 0.1 up to 0.25 is a finding, and over 0.25 fails.
- **INP:** not measured in this phase, because it needs a real interaction. TBT is recorded as a measured value with no pass or fail: web.dev calls it a proxy, not a substitute, and publishes no TBT band.
- **Unchanged:** the 5 s navigation budget (`NAVIGATION_BUDGET_MS`), the page-weight check and the failed-request check.
- Every performance finding and failure says it was measured once, in a lab, so it doesn't read as the site's field score.

6. Until Decision 8's confirmation exists, the active gate stays closed (decided by Emil, 2026-10-05).
- The script-payload test is Not run, with the reason "attack-shaped input: needs the ownership confirmation, not built yet".
- Standard loses the one cross-site-scripting check it has, on runs where interactive was on. That is accepted: no attack-shaped input is sent without the confirmation.
- **Rejected:** keeping the test at the interactive gate until Decision 8 is built. It would leave attack-shaped input behind the same switch as an ordinary form submit, which is the gap this phase closes.

7. The Standard run's output changes only where these decisions say. Each ticket is measured with `npm run check:template-unchanged` against the commit before it.
- **TFP-146:** outputs differ only by the added `gate` annotations, and by the script-payload test's gate.
- **TFP-147:** only security-area tests change.
- **TFP-148:** only accessibility-area tests change.
- **TFP-149:** only performance-area tests change.

8. Run time is measured, not assumed.
- Standard's run budget stays 30 minutes (the executor's `maxTimeout` of 1,800,000 ms).
- Run time is measured on the comparison fixture, the-internet.herokuapp.com and rizonetech.com, all at the read-only gate. The rizonetech.com Standard run took 1,766 s on 2026-10-01, before TFP-142's timeout fix.
- If a measured Standard run goes over the budget, the result is recorded, and the split between Standard and Comprehensive is revisited. Nothing is tuned to fit within this phase.

## Acceptance Criteria

1. Gates (TFP-146)
- On the 166 fixed inputs, every generated test carries exactly one `gate` annotation. A unit test fails if any test lacks one.
- With `TESTFORGE_INTERACTIVE` unset, a Standard run on the fixture sends no request other than a GET. A request-recording test proves it, as in Phase 35's Acceptance Criteria 2. Every interactive test is Not run, with its reason.
- With `TESTFORGE_INTERACTIVE=1`, interactive tests run. Active-gate tests are still Not run, with a reason that names the ownership confirmation.
- The report shows each test's gate, and the number of tests not run for each gate.
- `check:template-unchanged`: outputs differ only by the added annotations and the payload test's gate.

2. Shared conformance checks (TFP-147, TFP-148)
- On the fixture, a Standard run finds each injected passive-security defect and each injected WCAG defect on the inspected page that carries it. It classes each one exactly as a Comprehensive run does.
- For the same fixture state, a Standard run and a Comprehensive run report the same findings and failures for the same page.
- Standard's old landing-page header test and session-cookie test are gone. Their findings now come from the shared checks.
- Each Standard run sends exactly one missing-page probe.
- `check:template-unchanged`: TFP-147 changes only security-area tests, and TFP-148 only accessibility-area tests.

3. Performance bands (TFP-149)
- The fixture gains two switchable defects: a slow LCP and a layout shift. With an LCP of about 3 s the run gives a finding, and with about 5 s a failure. A CLS of about 0.15 gives a finding, and about 0.3 a failure.
- TBT appears as a measured value, with no pass or fail.
- Every performance finding and failure carries the "measured once, in a lab" wording.
- `check:template-unchanged`: only performance-area tests change.

4. Measurement (TFP-150)
- Standard run durations on the fixture, the-internet.herokuapp.com and rizonetech.com are recorded, before and after the phase, at the read-only gate.
- Every new failure on the two real sites is read by hand and recorded in the labelled failure set. None is left unexplained.
- Each ticket's `check:template-unchanged` result is recorded.

## Regression Policy

- `TEST_PLAN.md` gets cases for each gate's behaviour, for the gate annotation on every test, for the shared security and accessibility checks in Standard, for the performance bands, for the probe running once per run, and for the run-time measurement. Each case lands with its code.
- Comprehensive's behaviour is unchanged: GEN-59 to GEN-62 and RPT-16 pass as they are.
- The fixture's new slow-LCP and layout-shift defects are documented beside the existing ones.

## Related, deferred (not this phase)

- **Next Standard sets:** SEO next (the proposal's draft set), then functional checks for the 30 WAI-ARIA APG patterns, then the rest of the accessibility and security Standard sets beyond these conformance checks.
- **Comprehensive's negative tests,** designed by ISTQB technique, with a technique-coverage measure.
- **Decision 8's typed confirmation and the active gate,** together with the opt-in load-testing run, designed with the ISTQB Performance Testing syllabus.
- **INP measured** through real interactions.
- **The coverage map.**

## Backlog

TFP-145 was the last issued ticket when this record was written. It is done (`0504f92`, `4d35b28`) and verified. TFP-151 and TFP-152, raised at its verification, are in `real-site-run-findings-backlog-2026-10-01.md`.

### TFP-146 — Three gates, declared by every test

- **Phase:** 38 · **Priority:** P1 · **Labels:** `enhancement`, `run`, `generate`
- **Problem it solves:** one variable gates everything that changes state. Nothing separates a harmless form submit from attack-shaped input, and the report doesn't say which rule kept a test from running.
- **Scope:** Decisions 1, 3 and 6.
- **Deliverables:**
  - the `gate` annotation on every generated test;
  - runtime enforcement of each gate;
  - the report's gate column and not-run counts;
  - a request-recording test for a Standard run;
  - `TEST_PLAN.md` cases.
- **Acceptance criteria:** Acceptance Criteria 1.
- **Dependencies:** TFP-145 (it changes the same Standard accessibility checks).
- **Decided by Emil on 2026-10-05, while building it:**
  - A suite written by OpenAI sits at the interactive gate, like the local model's. It is wrapped whole in one describe, skipped unless `TESTFORGE_INTERACTIVE=1`. Before this it ran in full with interactive off.
  - In a Comprehensive security run, the local model's scenarios sit at the active gate, with its reason. They were already never run, since they may send input. In other areas they stay interactive (Decision 3).

### TFP-147 — Passive security checks in the Standard run, shared with Comprehensive

- **Phase:** 38 · **Priority:** P1 · **Labels:** `enhancement`, `generate`, `security`
- **Problem it solves:** Standard checks security headers and cookies on the landing page only, using its own implementation, which disagreed with Comprehensive's (TFP-144).
- **Scope:** Decision 4, security.
- **Deliverables:**
  - shared check builders used by both runs;
  - Standard's two old tests removed;
  - the probe once per run;
  - `TEST_PLAN.md` cases.
- **Acceptance criteria:** Acceptance Criteria 2, the security parts.
- **Dependencies:** TFP-146.

### TFP-148 — The axe scan in the Standard run

- **Phase:** 38 · **Priority:** P1 · **Labels:** `enhancement`, `generate`, `accessibility`
- **Problem it solves:** the Standard run has no recognised accessibility standard behind it.
- **Scope:** Decision 4, accessibility.
- **Deliverables:**
  - the shared scan on every inspected page;
  - the impact split;
  - the "incomplete" list;
  - `TEST_PLAN.md` cases.
- **Acceptance criteria:** Acceptance Criteria 2, the accessibility parts.
- **Dependencies:** TFP-146, TFP-145, and TFP-152 (so the Standard accessible-name check and axe agree on image links).

### TFP-149 — Core Web Vitals bands for LCP and CLS, TBT recorded

- **Phase:** 38 · **Priority:** P2 · **Labels:** `enhancement`, `generate`, `performance`
- **Problem it solves:** a page with an LCP between 2.5 and 4 s passes silently, and layout shift isn't measured.
- **Scope:** Decision 5.
- **Deliverables:**
  - the LCP and CLS bands;
  - TBT as a recorded value;
  - the lab wording;
  - the fixture's slow-LCP and layout-shift defects;
  - `TEST_PLAN.md` cases.
- **Acceptance criteria:** Acceptance Criteria 3.
- **Dependencies:** TFP-146.

### TFP-150 — Measure the Standard run

- **Phase:** 38 · **Priority:** P2 · **Labels:** `measurement`
- **Problem it solves:** the run-time cost and the new failures on real sites are estimates today.
- **Scope:** Decision 8 and Acceptance Criteria 4.
- **Deliverables:**
  - a report under `docs/decisions/`;
  - the labelled failure set updated.
- **Acceptance criteria:** Acceptance Criteria 4.
- **Dependencies:** TFP-147, TFP-148, TFP-149.

## Recommended Execution Order

1. TFP-145 and its follow-up commit.
2. TFP-146.
3. TFP-147, TFP-148 and TFP-149, in any order.
4. TFP-150 last.

## Suggested Milestone Gates

### Gate A — Gates in place
- TFP-146 landed and independently verified.
- Outputs differ only by the annotations and the payload test's gate.
- A Standard run without interactive sends nothing but GET requests.

### Gate B — Standard run's conformance and performance
- TFP-147 to TFP-150 landed and independently verified.
- Each template diff is confined to its named area.
- No unexplained false failure on the real sites, and durations are recorded.
