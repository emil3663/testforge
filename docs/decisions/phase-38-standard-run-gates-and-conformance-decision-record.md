# Phase 38 Decision Record — Standard Run: Three Gates, Shared Conformance Checks, Performance Bands

Date: 2026-10-05
Scope: Define what a run may do through three gates. Make the Standard run the critical working path. Bring the read-only conformance checks (passive security and the axe scan) into it through one shared implementation. Grade performance with Core Web Vitals' three bands.
Status: Complete. Approved by Emil on 2026-10-05: Decisions 1 to 5, 7 and 8 in the coverage proposal, and Decision 6 in chat. Decision 8 was amended on 2026-10-06. Gate A passed 2026-10-05; Gate B passed 2026-10-06 (Emil).

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
  - **Amended by Phase 41 Decision 3 (Emil, 2026-10-07; built in TFP-181):** it also allows interactions whose requests are all GETs and that submit no form (a sort, a filter, a quantity stepper, a link followed), under a request guard that aborts any other request and any form submission and fails the test as a guard breach, named (`src/lib/generate/read-only-guard.ts`). "GETs" means the methods HTTP defines as safe: GET, HEAD and QUERY (Emil, 2026-10-12, TFP-182). Phase 41 Decision 5 adds Comprehensive security's known-path probe, one GET per path.
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
- Run time is measured on the comparison fixture, the-internet.herokuapp.com and practicesoftwaretesting.com, all at the read-only gate.
- **Amended by Emil on 2026-10-06:** real-site runs use only sites published for test practice. rizonetech.com is a friend's site that earns revenue, so it is not used for TFP-150. practicesoftwaretesting.com (the "Toolshop" demo shop, built for practising test automation) takes its place. Its 2026-10-01 runs and labelled failures stay as historical evidence. (The rizonetech.com Standard run took 1,766 s on 2026-10-01, before TFP-142's timeout fix.)
- The "before" runs use `d90de57`, the last commit before TFP-146. On each real site, the before and after runs go back to back, so the site's own speed varies as little as possible.
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
- Standard run durations on the fixture, the-internet.herokuapp.com and practicesoftwaretesting.com are recorded, before and after the phase, at the read-only gate (Decision 8, as amended 2026-10-06).
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
- **Verification (2026-10-05, Cowork), `245ea6f`: Gate A not yet passed.**
  - **Re-measured here.** `check:template-unchanged d90de57 245ea6f` gives
    12 of 166 identical. With the gate annotations, the payload test's
    `test.skip(true, ...)` and its security note removed from the new
    output, and the payload test's old interactive skip and note removed
    from the old output, all 166 are byte-identical. Every test line carries
    exactly one gate: 860 read-only, 2 interactive (the database round trip),
    2 active (the payload test). tsc is clean. In `test-gates.test.ts` and
    `standard-gates.test.ts`, 8 pass and the 2 real-browser cases skip here.
  - **Measured by Code on Emil's machine:** the request-recording run
    (151 requests, all GET, no body, with interactive unset; 11 POSTs with
    it set, and the payload test still Not run) and the unit suite
    (434/434).
  - **Fix before Gate A passes, in this ticket:** the "Not run by gate"
    count groups every Not run test by its gate, so it reports "read-only
    2" for two cookie checks that skipped for their own reason. The
    read-only gate never closes, and RPT-18 says the line counts what each
    gate "kept from running". It must count only tests whose gate was
    closed for the run: interactive tests when `TESTFORGE_INTERACTIVE` is
    unset, and active tests always.
  - **Fix before Gate A passes, decided by Emil on 2026-10-05:** a suite
    written by OpenAI sits at the active gate when the requested areas
    include security, Not run with the active reason; otherwise it stays
    interactive. It matches the split for the local model's Comprehensive
    scenarios. The reason: TestForge's own quality check for a model's
    security tests looks for script-shaped input, and Decision 1 puts
    attack-shaped input at the active gate.
  - **Accepted:** gates are enforced through each test's own skip, with a
    unit test that checks every skip matches its gate (Decision 7 rules out
    a shared hook). The Comprehensive report shows no per-test gate, because
    it lists no tests one by one; Acceptance Criteria 1 is about the
    Standard run, and the records carry the gate. Suites a user edits and
    saves aren't gated: they are the user's code.
- **Verification (2026-10-05, Cowork), `b9ca79b`: Gate A passed, with one
  docs correction before the push.**
  - **Re-measured here.** `check:template-unchanged 245ea6f b9ca79b` gives
    166 of 166 identical. tsc is clean. `test-gates.test.ts` and
    `jobs.test.ts` give 18 passed and none failed.
  - **Read in the code:** the count uses the run's own interactive setting
    (`closedGates`: active always, interactive unless the run turned it on).
    The OpenAI suite is active when `getBestPracticeAreas` includes
    security. Its defaults don't, so security comes only from a selection or
    a keyword such as "xss" or "invalid input". Counting keyword-triggered
    areas too is accepted, because the description reaches the model either
    way.
  - **Measured by Code on Emil's machine:** the real-browser test asserts
    read-only 0, interactive 12, active 1 with interactive unset, and
    active 1 alone with it on. The unit suite gives 436/436.
  - **Docs correction before the push:** RUN-25 contradicts itself. It says
    "all 12 interactive tests", and the real-browser test asserts 12, but
    its Measured line gives 93 tests, 14 not run and "interactive 11". The
    commit message for `245ea6f` says the same, while its test also
    asserted 12. RUN-25 must name the run each set of numbers came from,
    and the two must agree or the difference must be explained (for
    example, a run without the local-model block).
- **Decided by Emil on 2026-10-05, while building it:**
  - A suite written by OpenAI sits at the interactive gate, like the local model's. It is wrapped whole in one describe, skipped unless `TESTFORGE_INTERACTIVE=1`. Before this it ran in full with interactive off.
  - In a Comprehensive security run, the local model's scenarios sit at the active gate, with its reason. They were already never run, since they may send input. In other areas they stay interactive (Decision 3).

#### GEN-67 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** Every generated test declares one of three gates, and its skip matches its gate (TFP-146, Phase 38 Decisions 1, 3 and 6; unit: `src/lib/run/test-gates.test.ts`; real browser: `src/lib/generate/standard-gates.test.ts` (RUN-25))

**Expected result:** Each test carries a static `{ annotation: { type: 'gate', description: 'read-only' / 'interactive' / 'active' } }`. **Template:** the builders of interactive and active tests declare theirs; every other test gets read-only where suites are rendered (Decision 3), so none is left without one. Journeys and the database round trip are interactive, behind the unchanged `TESTFORGE_INTERACTIVE` skip. The script-payload test is active: its first statement is `test.skip(true, 'attack-shaped input: needs the ownership confirmation, not built yet')` (Decision 6), and the security note says so. **Comprehensive:** every passive check, the missing-page probe included, is read-only, beside its `page` annotation. **Model-written blocks** declare the gate on their describe: gap-fill and Comprehensive non-security scenarios are interactive; Comprehensive security scenarios are active, with the active reason (owner decision, 2026-10-05). **OpenAI:** the returned suite is wrapped whole in an `OpenAI (<model>)` describe at the interactive gate, skipped unless interactive tests are on; before this it ran in full with interactive off. When the run's areas include security (selected, or triggered by a keyword in the description, as the template scopes them) it sits at the active gate instead, Not run with the active reason (both owner decisions, 2026-10-05: a model's security tests are expected to send script-shaped input). Its imports, one or several lines each, stay at the top. **Proven (equivalence partitioning, one partition per generation path):** on the 166 fixed inputs every test line carries exactly one gate (860 read-only, 2 interactive, 2 active; the 12 inputs without tests are database or reliability without page data); with every journey selected, 11 interactive and 1 active; every interactive test has the interactive skip, every active test the active skip, and no read-only test either. **Output measured:** `check:template-unchanged` against `d90de57` gives 12 of 166 identical; all 154 others are byte-identical to `d90de57` once the gate annotations, the payload test's skip and its note are taken out.

#### RPT-18 evidence

Moved word for word from [`docs/test-plan/RPT.md`](../test-plan/RPT.md) by TFP-253; the case's row there links here.

**Test:** The report shows each test's gate, and how many tests each gate kept from running (TFP-146, Phase 38 Decision 1; unit: `src/lib/run/test-gates.test.ts`; real browser: `src/lib/generate/standard-gates.test.ts`)

**Expected result:** Each execution record carries `gate`, read from the test's `gate` annotation or its describe's; an unknown value is ignored. The summary carries `notRunByGate` (read-only, interactive, active): the Not run tests whose gate was closed for the run - active always, interactive when the run did not turn interactive tests on (the job's own setting reaches the report). Read-only never closes, so a read-only test that skipped for its own reason is not counted (Gate A fix, 2026-10-05). Shown as "Not run because their gate was closed: interactive 11, active 1", listing only gates that kept a test from running, under the Not run note in the app's report header and Summary tab, and in the HTML export's recommendation banner. ISTQB technique: decision table (gate x interactive setting), in `test-gates.test.ts` and `jobs.test.ts`. Each test card in the Execution tab shows "Gate: <gate>", and the HTML export's execution table has a Gate column. Runs from before TFP-146, whose tests declare no gate, show neither. The Comprehensive report lists no tests one by one, so it shows no gate.

#### RUN-25 evidence

Moved word for word from [`docs/test-plan/RUN.md`](../test-plan/RUN.md) by TFP-253; the case's row there links here.

**Test:** Gates at run time: a Standard run sends only GETs with interactive tests off, and the active gate stays closed with them on (TFP-146, Phase 38 Decisions 1 and 6, Acceptance Criteria 1; unit: `src/lib/generate/standard-gates.test.ts` (introspects the comparison fixture through a recording proxy, then runs the generated suite through the Playwright CLI))

**Expected result:** The suite: every area, every journey selected, plus a local-model block. **`TESTFORGE_INTERACTIVE` unset:** every request the fixture receives is a GET with no body; every test has a gate; all 12 interactive tests (10 journeys, the database round trip, the model's test) are Not run with the `TESTFORGE_INTERACTIVE=1` reason; the payload test is Not run with the active reason. **`TESTFORGE_INTERACTIVE=1`:** no interactive test is held back by its gate, some pass, and the fixture receives POSTs; the payload test is still Not run, naming the ownership confirmation. ISTQB technique: decision table (gate x interactive). **Measured at `b9ca79b`, 2026-10-05,** four runs on the fixture, raw output in `benchmarks/2026-10-05-tfp146-gate-run/gate-run.log` (script beside it). **With the local-model block, as this unit test runs it:** 94 tests (81 read-only, 12 interactive, 1 active). Without interactive: 151 requests, all GET; 70 passed, 9 failed, 15 not run; Not run because their gate was closed: interactive 12, active 1 (the 2 read-only cookie checks that skipped for their own reason are not counted). With interactive on: 193 GET and 11 POST (`/login`, `/notes`), 82 passed, 9 failed, 3 not run, of which the gate closed active 1. **Without the block (the template alone):** 93 tests, 11 of them interactive; the same except one test fewer - 70/9/14 and interactive 11 without interactive; 192 GET, 11 POST and 81/9/3 with it on. The block's one test is the only difference: interactive, Not run when interactive is off, and one GET of `/notes` when on. The interactive-11 figure in `245ea6f`'s commit message came from this template-only run, not from the unit test. Without interactive, outcomes are the same as before TFP-146 (template alone, 70/9/14). The 9 failures are the fixture's own (no canonical link, robots.txt or sitemap.xml, no visited-link style, the failure-injection check on `/login`), identical in all four runs.

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
- **Verification (2026-10-06, Cowork), `fc736cc`: met.**
  - **Re-measured here.** `check:template-unchanged b15714b fc736cc` gives
    152 of 166 identical. In the 14 that differ, all of them inputs with
    security, nothing changes outside the Security block and its `// Security:`
    note. Every output with security has exactly one missing-page probe test,
    and the others have none. Standard imports the same builders
    (`passiveSecurityPageTests`, `passiveSecurityRunTests`) as Comprehensive.
  - **Measured by Code:** the real-browser comparison, the clean fixture plus
    the six passive defects, with the same outcome on every page in both
    runs.
  - **Accepted:** with no session cookie, the shared check now passes and
    records the header findings, where Standard's own check was Not run. It
    now has headers to check, so that's an honest pass (Decision 4; GEN-65
    updated).

#### GEN-69 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** The Standard run's security checks are the Comprehensive run's passive checks, on every inspected page, with one missing-page probe per run (TFP-147, Phase 38 Decision 4, Acceptance Criteria 2 security; unit: `src/lib/generate/standard-conformance.test.ts` (introspects the comparison fixture through a recording proxy, then runs both suites through the Playwright CLI), `src/lib/generate/mock/security-checks.test.ts`, `cookie-scope.test.ts`; `standard-gates.test.ts` counts the probe on a full Standard run)

**Expected result:** The security suite calls the same builders as Comprehensive (`passiveSecurityPageTests`, `passiveSecurityRunTests`), with the same details (`checkDetails`: page, read-only gate, OWASP/ASVS tags): per inspected page, up to `MAX_INSPECTION_PATHS` (`/` without page data), headers and session cookies, software versions, passwords off plain HTTP, and no password or session token in a URL; then one request to a path that cannot exist. Their helpers are written once at the top of the Security describe. Standard's own landing-page header test and session-cookie test are gone. The HTTPS check (https targets) and the script-payload test (active gate) stay. Findings and failures are classed as in Comprehensive (GEN-59). **Proven on the fixture (equivalence partitioning: the clean site and one partition per injected defect):** for the clean site and each of `security-password-to-http`, `security-token-in-url`, `security-stack-trace`, `security-version-header`, `security-weak-session-cookie` and `security-mixed-cookies`, a Standard security run and a Comprehensive security run of `/`, `/login`, `/notes` give the same outcome, findings and failure for all 13 checks; each defect changes the check on the page that carries it (the `/login` transport check, the `/` URL check, the probe, the `/` version check, the `/` header-and-cookie check); the clean site passes every check; each Standard run sends exactly one `/testforge-missing-` request, and so does a full Standard run of every area, with interactive tests off and on. **Output measured:** `check:template-unchanged` against `b15714b`: 152 of 166 identical; the 14 that differ (every input with the security area) are identical outside the Security describe and its notes. Every generated security suite type-checks with no duplicate test. Test count: the 166 outputs go from 860 to 918 read-only tests (+3 on each of the 12 security inputs without page data, +11 on each of the 2 with it).

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
- **Verification (2026-10-06, Cowork), `12ace9c`: one gap to close before
  Gate B.**
  - **Re-measured here.** `check:template-unchanged fc736cc 12ace9c` gives
    120 of 166 identical. In the 46 that differ, nothing changes outside the
    Accessibility block, and Standard's imports are unchanged. The scan uses
    Phase 35 Decision 4's split: critical and serious fail, moderate and
    minor are findings, incomplete items are listed as `manual-review`.
  - **Measured by Code:** the clean fixture and three WCAG defects, with the
    same scan on every page in both runs.
  - **Accepted:** axe is loaded inside the test, so Comprehensive
    accessibility files lose their file-level import. Decision 7 covers the
    Standard run, and the Comprehensive real-browser case still passes.
  - **Gap, in this ticket:** nothing shows that a real scan's incomplete
    items reach the report as "Needs manual review". A unit case covers only
    the list. Add a fixture state that makes axe return an incomplete item
    (for example, text over a background image, which leaves colour contrast
    undecided). Show it listed for manual review in a Standard run, and not
    counted as passed.
- **Gap closed, `73aa393`, verified 2026-10-06:** the generator is
  unchanged (only the fixture and a test change). A new fixture state,
  `a11y-text-over-image`, makes axe leave colour contrast undecided. A
  Standard run lists it under "Needs manual review" and adds no finding or
  failure. "Never counted as passed" applies to the undecided item, which is
  listed for a person to judge; the scan itself still passes on its
  violations, as Phase 35 Decision 4 and GEN-61 set out.

#### GEN-70 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** The Standard run runs Comprehensive's axe-core WCAG 2.2 A and AA scan on every inspected page, and lists what axe could not decide for manual review (TFP-148, Phase 38 Decision 4, Acceptance Criteria 2 accessibility; unit: `src/lib/generate/standard-conformance.test.ts` (introspects the comparison fixture, then runs both suites through the Playwright CLI), `comprehensive-accessibility.test.ts`)

**Expected result:** The accessibility suite appends `axeScanTest` - the builder Comprehensive's `accessibilityPageTests` now calls for its scan - for each inspected page (`inspectedPagePaths`: up to `MAX_INSPECTION_PATHS`, `/` without page data), after its existing checks, with the same details (page, read-only gate, category) and the scan's helpers written once at the top of the Accessibility describe. Impact split as in Comprehensive (GEN-61): critical and serious violations fail, moderate and minor are findings, each recorded under its WCAG criterion from axe's own tags. Standard keeps its own checks, TFP-121's field-name check included. The scan loads axe inside the test, so neither suite needs a file-level import. **Manual review:** a Standard report carries `manualReview` - every "incomplete" item the scans recorded, by page, with its criterion - shown as "Needs manual review (n)" in the Summary tab and the HTML export, never counted as passed; absent when there is none, and on Comprehensive runs, whose own section lists them. **Proven on the fixture (equivalence partitioning: the clean site and one partition per WCAG defect):** for the clean site and each of `a11y-unlabelled-field`, `a11y-missing-alt` and `a11y-low-contrast`, the Standard and Comprehensive scans of `/`, `/login`, `/notes` give the same outcome, findings, failure and issues on every page; the clean site passes; each defect fails the scan on its page under its rule and criterion (`label` 4.1.2 critical on `/login`; `image-alt` 1.1.1 critical and `color-contrast` 1.4.3 serious on `/`); the Standard report lists as many undecided items as the scans recorded. **Undecided, on the fixture (2026-10-06):** `a11y-text-over-image` puts the home page's introduction in white over a background image, which axe cannot judge for contrast. The Standard and Comprehensive scans of `/` still agree and pass with no new finding; the scan records `manual-review WCAG 1.4.3 color-contrast ... - p:nth-child(2)`, and the Standard report lists that item once under `/`, and its HTML export under "Needs manual review". The clean site leaves no contrast item undecided. A unit case checks the list, its HTML, and that a Comprehensive report does not repeat it. **Output measured:** `check:template-unchanged` against `fc736cc`: 120 of 166 identical; the 46 that differ (every input with the accessibility area, 42 without page data and 4 with it) are identical outside the Accessibility describe and its notes; every generated accessibility suite type-checks. Read-only tests in the 166 outputs: 918 to 972 (+1 on each of the 42, +3 on each of the 4).

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
- **Verification (2026-10-06, Cowork), `c4f00df`: one boundary fix before
  Gate B.**
  - **Re-measured here.** `check:template-unchanged 12ace9c c4f00df` gives
    110 of 166 identical. In the 56 that differ, nothing changes outside the
    Performance block. The CLS session window follows web.dev (1 s gap, 5 s
    cap), CLS fails only over 0.25 (`toBeLessThanOrEqual(0.25)`), and TBT
    is a `measurement` with no assertion.
  - **Measured by Code:** LCP 3.06 s gives a finding and 5.06 s a failure;
    CLS 0.142 gives a finding and 0.285 a failure; TBT is about 250 ms for a
    300 ms task.
  - **Accepted:** the lab wording on the failed-requests message, since
    Decision 5 says every performance finding and failure carries it.
  - **Fix, in this ticket (boundary value analysis):** LCP still fails with
    `toBeLessThan(4000)`, while the finding covers `lcp.time <= 4000`. At
    exactly 4.0 s the run gives both a finding and a failure. Decision 5 and
    web.dev say "over 4 s" is poor, so the assertion must be
    `toBeLessThanOrEqual(4000)`, with a unit case at 4000 ms.
- **Fix done, `da2235f`, verified 2026-10-06:** `check:template-unchanged
  c4f00df da2235f` gives 110 of 166 identical. Each of the 56 that differ
  changes by one line, `toBeLessThan(4000)` to `toBeLessThanOrEqual(4000)`.
  The boundary unit test (LCP 2500, 2501, 4000 and 4001 ms; CLS 0.1, 0.101,
  0.25 and 0.251, with Playwright's real `expect`) passes here, 9 of 9.

#### GEN-71 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** Performance is graded in Core Web Vitals' three bands: LCP and CLS pass, give a finding ("needs improvement") or fail ("poor"); TBT is recorded with no pass or fail; every performance finding and failure says it was measured once, in a lab (TFP-149, Phase 38 Decision 5, Acceptance Criteria 3; unit: `src/lib/generate/mock/performance-bands.test.ts` (comparison fixture and a local page, through the Playwright CLI, one worker), `performance-checks.test.ts`; fixture: `performance-lcp-3s`, `performance-lcp-5s`, `performance-shift-0.15`, `performance-shift-0.3`)

**Expected result:** Bands from web.dev, checked 2026-10-05, in `performance-checks.ts` (`LCP_GOOD_MS` 2500, `LCP_BUDGET_MS` 4000 unchanged, `CLS_GOOD` 0.1, `CLS_POOR` 0.25). **LCP:** up to 2.5 s passes; above, up to 4 s, a finding; over 4 s fails, as before. **CLS** (new check): measured during load and 1.5 s after it, as web.dev's largest session window of shifts without recent input (a window ends after a 1 s gap or at 5 s), naming the first shifted elements; up to 0.1 passes, up to 0.25 a finding, over 0.25 fails. **TBT** (new check): long tasks are collected from before the page's own scripts run; the sum of each one's time over 50 ms, after the first contentful paint and up to 1.5 s after load, is recorded as a `measurement` annotation - the record's `measurements` and "Measured: ..." in its remarks - never a finding or a failure (web.dev: a proxy for INP, not a substitute, with no band). INP is not measured. **Lab wording** (`LAB_NOTE`, "Measured once, in a lab (this run, from this machine), not from real visits.") on every performance finding and failure: navigation, LCP (finding, failure, no-LCP finding), CLS, page weight, failed requests, and the TBT value. **Fixture defects** (beside the others in `scripts/comparison-fixture.mjs`): the hero image held back 3 s or 5 s (a 25 KB, 400-circle SVG: Chrome leaves low-entropy images out of LCP, and a plain rectangle was never the LCP), and a banner inserted 200 ms after render above full-viewport content, sized for CLS about 0.15 or 0.3. **Proven (boundary value analysis: one value in each band, either side of the good and poor lines), 2026-10-06:** clean site: LCP and CLS pass with no finding, TBT 0 ms recorded; `performance-lcp-3s`: LCP 3.06 s, a finding ("needs improvement", largest element img); `performance-lcp-5s`: LCP 5.06 s, a failure; `performance-shift-0.15`: CLS 0.142, a finding (shifted first: main, nav); `performance-shift-0.3`: CLS 0.285, a failure; each with the lab wording. A page that blocks for 300 ms after its first paint records TBT about 250 ms (1 long task) and still passes. **At the lines (unit, `performance-checks.test.ts`, the generated check run with a stub measurement and Playwright's `expect`), 2026-10-06:** LCP 2500 ms passes; 2501 and 4000 ms give a finding; 4001 ms fails. Until then the check used `toBeLessThan(4000)`, so 4000 ms gave both a finding and a failure, where web.dev calls only "over 4 s" poor. CLS 0.1 passes; 0.101 and 0.25 give a finding; 0.251 fails. **Output measured:** `check:template-unchanged` against `12ace9c`: 110 of 166 identical; the 56 that differ (every input with the performance area) are identical outside the Performance describe and its notes; every generated performance suite type-checks. Read-only tests in the 166 outputs: 972 to 1084 (+2 on each of the 56).

### TFP-150 — Measure the Standard run

- **Phase:** 38 · **Priority:** P2 · **Labels:** `measurement`
- **Problem it solves:** the run-time cost and the new failures on real sites are estimates today.
- **Scope:** Decision 8 and Acceptance Criteria 4.
- **Deliverables:**
  - a report under `docs/decisions/`;
  - the labelled failure set updated.
- **Acceptance criteria:** Acceptance Criteria 4.
- **Dependencies:** TFP-147, TFP-148, TFP-149.
- **Verification (2026-10-06, Cowork), `ac9cf44` and `2a45da9`: Gate B passed (Emil, 2026-10-06).**
  (Code's report gave the hash as `78b1d0f`, which doesn't exist. The commit
  is `ac9cf44`.)
  - **Re-measured here from the committed evidence**
    (`benchmarks/2026-10-06-tfp150/`). The Playwright stats match the report
    to the second:
    - fixture: 68 s before, 76 s after;
    - practicesoftwaretesting.com: 925 s before, 952 s after;
    - the-internet: 1,712 s before, 1,913 s after.

    Toolshop's 45 and 46 unexpected results and the-internet's 47 and 53
    timeouts match the report too. `check:template-unchanged d90de57
    d202315` gives 12 of 166 identical across the phase.
  - **Labelled set:** the 46 Toolshop failures are each labelled: 22 template
    errors (T19 to T23), 18 real (R10 to R12) and 6 unclear (U2, U3). R10 is
    the only new failure from the phase, and it is real.
  - **Open:** the-internet's pair ran while the host was mostly not
    answering: 503s, and 47 and 53 thirty-second timeouts. It measures a dead
    host, not the phase. The host answered again by 05:50 on 2026-10-06.
    Re-run the pair back to back on a healthy host before Gate B closes, and
    keep the first pair in the report as it is.
  - **Accepted:** the runs were driven by a script with one worker, on 5
    chosen paths, the same before and after.
  - **Re-run, `2a45da9`, verified 2026-10-06:** Playwright's stats match the
    report. Before took 2,071 s, with 54 timeouts and 6 other failures.
    After took 3,222 s, with 87 timeouts and 6 other failures. The host was
    still failing, and setup loaded different page sets in the two runs, so
    the pair doesn't compare. Both pairs stay recorded as they are, and
    nothing was tuned. T24 (the orphan-page check) is a template error,
    ticketed as TFP-161.
  - **Gate B decided by Emil on 2026-10-06:** passed on the fixture and
    practicesoftwaretesting.com. The-internet's hosted copy is recorded as
    not measurable. Its code is Apache-2.0 with a Dockerfile, so it is
    measured on a local copy in Phase 39's TFP-158.

## Recommended Execution Order

1. TFP-145 and its follow-up commit.
2. TFP-146.
3. TFP-147, TFP-148 and TFP-149, in any order.
4. TFP-150 last.

## Suggested Milestone Gates

### Gate A — Gates in place
- **Passed 2026-10-05** (Cowork, `245ea6f` and `b9ca79b`), with RUN-25's
  numbers corrected before the push. See TFP-146's verification entries.
- TFP-146 landed and independently verified.
- Outputs differ only by the annotations and the payload test's gate.
- A Standard run without interactive sends nothing but GET requests.

### Gate B — Standard run's conformance and performance
- **Passed 2026-10-06** (Emil). The before and after are measured on the
  fixture and practicesoftwaretesting.com. The-internet's hosted copy is
  recorded as not measurable, and its measurement moves to a local copy in
  Phase 39's TFP-158. The older false failures found are labelled and
  ticketed (TFP-151, TFP-159 to TFP-161).
- TFP-147 to TFP-150 landed and independently verified.
- Each template diff is confined to its named area.
- No unexplained false failure on the real sites, and durations are recorded.
