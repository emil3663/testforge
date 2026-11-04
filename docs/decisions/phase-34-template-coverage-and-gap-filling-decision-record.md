# Phase 34 Decision Record — Template Category Coverage and Additive Gap-Filling

Date: 2026-09-28
Scope: Give the deterministic template generator real tests for the three
best-practice areas where it writes none today (performance/load, security,
database), then build Phase 21's chosen Option B: the template always
generates, and the local model fills only the selected areas the template
still leaves empty.
Status: Complete 2026-09-29. Gates A, B and C met and independently
verified; everything through `3c4fe40` pushed. Option B confirmed by Emil
2026-09-28, with performance budgets, security-finding handling, Option C
skips, GEN-43 and Decisions 10-11 decided the same day. Next: Phase 35,
comprehensive testing (roadmap outline, not yet locked).

## Context

Phase 21's comparison (`phase-21-comparison-report.md`) found the template
wrote zero executable tests for performance, database and security on the
requests tried, and its caveat 2 left open whether other wording or inputs
would change that. Reading `src/lib/generate/mock/` on 2026-09-28 settles
it. The three gaps have three different causes:

- **Performance/load: a bug.** `generic-suites.ts` generates its one
  load-time test only when the description does *not* contain
  "performance", "load time", "speed" or "response time". Asking for
  performance explicitly yields zero tests on every target except DemoQA,
  whose own builder writes one exactly when the description names
  performance. The check was a stand-in for that, present since the first
  commit (`75c20df`); see Decision 1's correction. The comparison's request
  ("…for performance/load coverage") hit it exactly.
- **Security: too thin.** The only template is "the page URL is HTTPS",
  written only for HTTPS targets. On the fixture (`http://127.0.0.1`) it is
  replaced by a note, so nothing checks input handling, which is what the
  injected defect (`security-unescaped-note`) needed.
- **Database: never built.** There is no template, only the manual
  follow-up comment from `areas.ts`.

For reference, the template's full category set (`BEST_PRACTICE_OPTIONS`):
functional, usability, responsive/mobile, accessibility, seo/content and
reliability run by default; performance/load, security, cookie/session and
database run only when selected or keyword-triggered (`getBestPracticeAreas`).

Phase 21's TFP-100 recorded Option B. This phase builds it. The template
work comes first because it changes which areas are gaps: once the template
writes performance, security and database tests for a target, the local
model is no longer asked for those areas on that target.

## Decisions

1. The missing performance test is a defect and is fixed first.
- `generic-suites.ts` generates the performance suite when performance/load
  is selected or triggered, unless a target-specific builder already wrote
  one.
- Per the standing execution policy, it is fixed in its own ticket
  (TFP-114) with a regression test, not folded into the template work.
- Correction (2026-09-28, found while building TFP-114): this record first
  called the check an inverted condition to flip. It was not. It stood in
  for "the DemoQA builder already wrote a performance test", and flipping
  it gave DemoQA two performance blocks. The fix passes the areas a
  target-specific builder covered to the shared builder instead.

2. The template gains real performance/load checks that need no
   target-specific knowledge, with loose budgets.
- Budgets fail only on a clear problem, not on "could be faster". The
  numbers are measured from wherever TestForge runs, over that machine's
  network, so tight budgets on an arbitrary site produce flaky results that
  people learn to ignore.
- Navigation timing: the existing 5000 ms budget stays (now actually
  generated, per TFP-114).
- Largest contentful paint: 4.0 s, the Core Web Vitals boundary for "poor".
  2.5 s ("good") is not used: it fails many ordinary sites on network noise.
- Total page transfer size: 5 MB, a "clearly bloated" bound of roughly
  twice a typical page's weight.
- No same-origin resource request fails (4xx/5xx or network error) during
  load.
- Every failure says what went wrong, not just that a budget was exceeded
  (Emil, 2026-09-28). The failure message states:
  - the measured value, the budget, and what the budget represents (e.g.
    "LCP 5.2 s, budget 4.0 s: Core Web Vitals 'poor'");
  - for LCP, which element was the largest contentful paint;
  - for transfer size, the largest resources by size, with URLs;
  - for failed requests, each failing URL with its status or network
    error.
- Comparing against the site's own previous run (Phase 17 run diffing) is
  not part of this phase; it needs a baseline run and is a later option.

3. The template gains real security checks.
- A script-shaped payload is entered into each discovered text input and
  submitted; the test asserts it is not executed.
- Response security headers are checked on the landing page
  (`Content-Security-Policy`, `X-Content-Type-Options`, frame protection via
  `X-Frame-Options` or CSP `frame-ancestors`).
- Cookies set by the target are checked for `Secure` (HTTPS targets only),
  `HttpOnly` and `SameSite`.
- The existing HTTPS check stays, still conditional on the base URL's
  scheme.
- The script-payload test fails when the payload executes: that is an
  exploitable defect.
- A missing security header or cookie flag is recorded as a finding and
  does not fail the test (Emil, 2026-09-28). Many real sites have no CSP,
  and TestForge cannot tell a session cookie (where a missing `HttpOnly`
  matters) from an analytics or preference cookie (where it is often
  deliberate), so failing would turn most runs red on hardening gaps rather
  than defects.
- Findings are Playwright test annotations naming the missing header or
  the cookie and flag. If TestForge's run report does not show annotations
  today, showing them is part of TFP-116.

4. The template gains a database check: a user-visible persistence round
   trip.
- Fill a discovered form's text input with a unique generated value,
  submit, reload, and assert the value is still shown.
- This is the same user-visible create/read flow `BEST_PRACTICE_GUIDANCE`
  already describes for database, and the flow that caught
  `database-notes-not-saved` in Phase 21.
- When no suitable form is discovered, the suite carries a note saying so,
  so the area is visibly empty rather than silently empty (see Decision 7).

5. Every new test that submits or mutates on the live site follows the
   existing interactive-tests rule.
- The security payload and database round-trip tests submit forms, so they
  are skipped unless the run sets the interactive option
  (`src/lib/run/interactive.ts`), exactly as Phase 19's journey tests are.
- Keyword triggering does not bypass this. `getBestPracticeAreas` adds
  database for common words such as "save" and "update", so without this
  rule an ordinary request could start writing data to a live site.
- The header, cookie-flag and performance checks are read-only and run
  whenever their area is selected or triggered.

6. Option B: the template always generates; the local model fills gaps.
- A gap is a selected or triggered area where the template wrote zero
  executable `test(...)` calls, as TFP-100 defined it.
- The local model is asked only for gap areas, in one request per
  generation, and only when `TESTFORGE_OLLAMA_MODEL` is set.
- Its describe blocks are appended to the template suite and keep their own
  label, so a run shows which tests came from which generator.
- Every existing local-path gate still applies (`findTypeErrors`,
  `findUnawaitedAssertions`). A local suite that fails a gate is dropped;
  the template suite is returned unchanged.
- Reliability is never a gap-fill area in this phase (GEN-32 is still open).
- Exposure stays as TFP-100 recorded: env-var opt-in, API only, no UI
  toggle.
- Amended 2026-09-28 (GEN-43, Emil): an area the template checked and
  correctly found nothing to test is not a gap. A gap is an area the
  template could not test, not one where it looked and found nothing
  applicable. Built and measured, the usual gap after Gate A was database
  on a page with no form that saves anything; asked to fill it, the model
  invented a login-and-reload flow with a guessed username that failed
  falsely. Such an area is reported empty with the template's own reason
  (Decision 7) and the local model is not called.
  - Rejected: keeping it a gap but making the local test skip itself (the
    model's latency is paid for a test that never runs by default, and the
    invented flow still fails falsely with interactive tests on); keeping
    it as is (false failures from invented flows).
  - Consequence, stated rather than worked around: with Gate A's templates
    covering every area, gap-filling will rarely trigger. The template
    closed the gaps Option B was meant to fill. TFP-120 measures and
    reports this plainly. A different role for the local model (adding
    depth to areas the template already covers) is a new decision: see
    the roadmap's Phase 35, comprehensive testing.
- Amended 2026-09-28 (GEN-43, Emil): every gap-fill test is skipped unless
  interactive tests are on. The local model's tests ignore the interactive
  rule (live, one submitted a real login form with interactive tests off),
  and Option B points it at exactly the areas that submit forms. The block
  TestForge wraps around the model's tests carries one `test.skip(...)`
  with a stated reason, so under Decision 7 its tests report as "Not run"
  with that reason.
  - Rejected: skipping only the local tests that submit or change
    something. That needs recognising a submit in model-written code (a
    click on a button can submit), and getting it wrong writes data to a
    live site, the one mistake Decision 5 exists to prevent.

7. An area that ends up with no tests is reported, never silently dropped.
- The run report names each selected area with zero tests and the reason:
  no template applies to this target (e.g. no form found), local model not
  configured, local model timed out, or local output rejected (with its
  `fallbackReason`).
- This builds on Phase 17's not-tested-and-why reporting
  (`src/lib/report/discovered-coverage.ts`); whether it extends that
  structure or adds an area-level equivalent is decided when TFP-119 is
  built.
- A test that skipped itself with a stated reason is "not run by choice",
  not a failure (Emil, 2026-09-28, Option C). Today every skip becomes
  status `Blocked`, which counts on the failed side of the pass/fail ratio
  and turns a clean run into "Ready with caution". Every run with
  interactive tests off, the safe default, therefore could never read
  "Ready for release".
  - A skip with a reason (Playwright's `skip` annotation, read since
    `915b69c`) gets its own status. It is left out of the pass/fail ratio
    and does not downgrade the release recommendation.
  - The summary says beside the recommendation what was not run and why,
    e.g. "4 tests not run: interactive tests are off", so a run whose
    meaningful tests were all skipped cannot read as full coverage.
  - A skip or interruption with no stated reason stays `Blocked` and still
    means "Ready with caution": nobody chose it.
  - Rejected: leaving it (caution becomes the normal state of a healthy
    site and gets ignored) and ignoring every skip (a run could read "Ready
    for release" with its important tests skipped).

8. Every generation gate's verdict is recorded with the run, with its
   stated bar and its evidence (Martin's review, 2026-09-28).
- Today the gate outcome (`generatedBy`, `fallbackReason`) is returned by
  `/api/generate` and then lost: it is not saved with the run or shown in
  the report, and the evidence behind a rejection (which type errors, which
  unawaited lines) is discarded. Nobody can later see why local output was
  kept or dropped.
- For each gate that ran (`findTypeErrors`, `findUnawaitedAssertions`, and
  the timeout), the run records: the gate's name, its stated bar (e.g.
  "0 type errors"), the measured result (e.g. "2 type errors"), the verdict
  (kept or rejected), and the evidence (the error messages or source lines,
  capped to a readable length).
- The run report shows these verdicts, so disagreeing with a decision means
  arguing with a recorded number and its evidence, not a guess.
- Today's gates are binary: their bar is zero, so there is no score to
  threshold. The recorded shape (bar, measured value, verdict, evidence) is
  the same one a future scored gate uses, so a calibrated check can later
  add a score and a threshold without changing the record format.

9. Option B is measured before any UI exposure is considered.
- The Phase 21 comparison script (`npm run compare:generators`) is re-run
  with template-only vs. template-plus-gap-fill.
- The fixture's defects were designed after the local model's worked
  examples, and Decisions 3-4 add template checks modelled on what caught
  those same defects. Fixture detection is therefore biased toward *both*
  generators now, and is not the acceptance evidence. At least one real
  target the checks were not designed against is required.
- Outcome 2026-09-28 (TFP-120, `phase-34-option-b-measurement-report.md`):
  **no UI control for gap-filling.** With page data, gap-filling called the
  model on neither target: the gap sweep found 0 gaps across every area on
  both, and 15 of 17 comparison cases were the template's suite byte for
  byte. The only remaining gap is database without page data. There the
  model's test caught the fixture's defect (biased, see above) and failed
  falsely on the-internet (an invented login-and-reload flow), in both of
  two full runs. Gap-filling stays opt-in through `TESTFORGE_OLLAMA_MODEL`
  only. Revisit if a target's sweep shows gaps with page data, or if Phase
  35 gives the local model a depth role. Recorded by Claude Code from the
  measurement; **confirmed by Emil 2026-09-28.**

10. The template's accessibility checks catch a form field with no
    accessible name (TFP-121).
- TFP-120 found the template's 5 accessibility tests pass with the
  fixture's `a11y-unlabelled-field` defect on. Weak coverage inside a
  covered area is not a gap (Decision 6), so the fix belongs in the
  template, not in gap-filling, and it does not wait for Phase 35.
- Every visible form field on the inspected pages (text-like inputs,
  `select`, `textarea`; not hidden, submit, button or image inputs) must
  have an accessible name. A field with none fails the test, and the
  message names each field (its id, name or type, and page).
- A field whose only name comes from its placeholder is recorded as a
  finding, not a failure: a placeholder vanishes as the user types, so it is
  a weak label, but it is not a missing one.
- The name is the one the browser computes (as Playwright's role queries
  and aria snapshots see it), not a hand-rolled approximation, so the check
  agrees with what a screen reader is told.
- It is read-only and runs with the default accessibility area. It
  deliberately changes accessibility output; every other area's output must
  stay unchanged by measurement.

11. Generation inspects the pages itself when a request brings no page data
    (TFP-122).
- TFP-120 found the one remaining gap is database without page data, where
  the local model's answer was one catch on the biased fixture and one false
  failure on the real site. With page data the template either writes a real
  round trip (about 1 ms) or reports the area not applicable.
- When `/api/generate` receives no content profile, it runs the same
  introspection the app's own flow runs, for the base URL, before
  generating, using the introspection code directly rather than an HTTP
  call to `/api/introspect`.
- The response says the page data was gathered automatically, and the
  report shows it.
- If introspection fails (site unreachable, timeout), generation continues
  exactly as today without page data, and the reason is reported. It never
  blocks generation.
- Callers can opt out with an explicit flag. The Phase 21 and 34 comparison
  scripts' no-page-data cases need it to stay reproducible.
- Introspection only reads pages. It follows the existing introspection
  rules, including authenticated targets (Phase 20).
- Consequence: with this in place, gap-filling runs only when inspection was
  opted out of or failed. That is expected, not something to work around.

## Acceptance Criteria

1. Performance defect fixed
- A request whose description contains "performance" and selects
  performance/load produces at least one performance test.
- A regression unit test covers each of the four trigger words.

2. Template category coverage
- On the Phase 21 fixture requests for performance, security and database,
  the template now produces executable tests in each area.
- Each new check is type-correct against real `@playwright/test` types
  (the same `findTypeErrors` check the local path uses).
- Form-submitting tests are skipped when the interactive option is not set,
  and the run report shows them as skipped for that reason.
- On an `http://` target, the security suite still contains the non-HTTPS
  checks (input handling, headers) rather than only a note.
- A performance failure message names the measured value, the budget and
  the culprit (largest element, largest resources, or failing URLs).
- A missing security header or cookie flag leaves the test passing and
  appears as a named finding in the run report.

3. Option B
- With `TESTFORGE_OLLAMA_MODEL` unset, generation output is identical to
  template-only.
- With it set, the local model is called only for gap areas; a request
  where the template covers every selected area makes no local call.
- A request with a gap area returns template tests plus appended local
  tests, each labelled by generator in the run report.
- A rejected or timed-out local suite leaves the template suite intact and
  the area is reported empty with its reason.
- Reliability is never sent to the local model.
- A run with interactive tests off and no failures reads "Ready for
  release", with its not-run tests counted and named beside the
  recommendation and excluded from the pass/fail ratio; an unexplained skip
  still yields "Ready with caution". A run where no test ran at all (every
  test Not run) gives "No recommendation: no test ran" (RPT-14).
- A generation that ran any gate shows each gate's bar, measured result,
  verdict and evidence in the persisted run and its report, including when
  the local output was rejected.

4. Measurement
- A comparison report records template-only vs. template-plus-gap-fill on
  the fixture and at least one real target, with the fixture-bias caveat
  stated, not smoothed over.

5. Follow-ups from TFP-120
- A run in which no test executed, whether every test was "Not run" or
  every test was Blocked (interrupted or skipped without a reason), reads
  "No recommendation: no test ran", and its status badge is neutral, not
  green.
- With the fixture's `a11y-unlabelled-field` defect on, the template's
  accessibility suite fails and names the field; with it off, it passes. On
  the-internet it produces no false failure, or the result is recorded as it
  is rather than smoothed over.
- Only the accessibility area's output changes for TFP-121, by measurement
  on fixed inputs.
- A generate request with no content profile returns suites built from
  automatically gathered page data and says so; with introspection forced to
  fail, it returns today's output plus the reason; with the opt-out flag, it
  behaves exactly as today.

## Regression Policy

- `TEST_PLAN.md` gets GEN cases (next free number after GEN-37) for: the
  performance trigger fix; each new template category; the interactive-skip
  rule for form-submitting template tests; gap-fill merging and labelling;
  gap-fill fallback; and empty-area reporting. Each lands in the same
  commit as its code, per the standing execution policy.
- Existing template output for the six default areas must not change;
  TFP-114-117 prove this by measurement, not diff-reading: generate suites
  from fixed inputs before and after each change and diff the output.

## Related, deferred (not this phase)

- **Cookie/session's existing test is hollow.** It asserts the cookie list
  is an array, which is always true. Decision 3's cookie-flag checks give
  the area real content; replacing the hollow test itself is not in scope
  unless Emil adds it.
- **Reliability gap-filling** waits on GEN-32 (Phase 33's naming and
  duplication weakness).
- **A UI control for gap-filling** waits on Decision 9's measurement, as
  TFP-100 recorded.
- **Comprehensive testing (area deep dive)** (Emil, 2026-09-28): a separate, user-chosen run that
  goes deep into one area of concern, such as security, beyond the
  best-practice suite. Outlined in `product-roadmap.md` as Phase 35; it gets
  its own decision record when picked up.
- **A failure-triage gate: "is this failure real or an artifact of the
  test?"** (Martin's review, 2026-09-28). A Choice-shaped judgement (real
  defect / test bug / environment or flake / inconclusive) with a score, a
  written threshold, and low-confidence cases sent to human review rather
  than auto-labelled. It would be recorded in the shape Decision 8 defines.
  Not this phase, because it needs a labelled set of failures first:
  - **Seed set:** TFP-040's run (42 tests, 8 failures). Seven were false
    positives from one root cause (elements hidden by design, asserted as
    visible); the eighth (TFFU-036, no `:visited` link styling) was recorded
    as a real but unclear finding (`examples/testforge-app/test-assist/notes.md`).
    That is effectively two distinct cases, and the first was since fixed
    by a rule (TFP-053/054), so it is not enough to calibrate a threshold
    alone.
  - **To add:** the failures hand-classified while building TFP-099
    (`phase-21-comparison-report.md`), e.g. blocking `/login`'s network
    route also blocking the page's own navigation to `/login` (false) and
    the SEO gaps (real), plus labelled failures from later runs.
  - **Held-out cases:** part of the set is kept back from threshold-setting,
    so the threshold is not set and judged on the same examples.
  - **Rule first:** any failure pattern a deterministic rule can recognise
    (as TFP-053/054 did) is handled by the rule; the classifier is only for
    what is left. Whether a local open-weights System One model (e.g. an
    encoder-sized one that fits beside `testforge-qwen7b` on 4 GB VRAM) or
    an LLM prompt is the judge is decided when this is picked up.
- **GEN-32 duplication check.** Before any classifier, a deterministic check
  (normalising each reliability test's `page.route()` setup and flagging
  identical ones) is tried first, since duplicates under different titles
  are structurally identical.

## Backlog

**Ticket numbers below are estimates** — confirm the next real free number
against the actual backlog before filing (TFP-113 was Phase 33's last
issued number as of this record).

### TFP-114 — Fix the inverted performance/load condition

- **Phase:** 34
- **Priority:** P1
- **Suggested labels:** `bug`, `generate`, `template`
- **Problem it solves:** explicitly asking for performance produces zero
  performance tests.
- **Scope:** Generate the shared performance suite when the area is
  selected or triggered, skipping it only where a target-specific builder
  already wrote one; regression test.
- **Status:** Landed `836d17f` (GEN-38), independently verified
  2026-09-28.
- **Deliverables:** Updated `generic-suites.ts`; unit test; `TEST_PLAN.md`
  GEN case.
- **Acceptance criteria:** Acceptance Criteria 1.
- **Dependencies:** None.

#### GEN-38 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** Naming performance in the request produces a performance test on every target (TFP-114; unit: `src/lib/generate/mock/performance-suite.test.ts`)

**Expected result:** The shared template builder used to skip its performance test whenever the description said "performance", "load time", "speed" or "response time". That check stood in for "the DemoQA builder already wrote one", but no other target has a builder that does, so on every non-DemoQA target asking for performance by name produced **zero** performance tests. This is the Phase 21 comparison's "template: no performance tests" finding. The DemoQA builder now passes the areas it covered, and the shared builder skips only those. Each trigger word, selected or keyword-triggered, now produces a performance suite on a generic target, and DemoQA still gets exactly one suite, never two. (At TFP-114 that suite was one test; TFP-115, GEN-40, made it four.) With the fix reverted, 8 of the 14 cases fail. **Output measured, not diff-read:** template suites for 84 fixed inputs (every area alone, the defaults, each trigger word selected and triggered, on a generic and a DemoQA target, fast and deep) were generated before and after. 66 are byte-identical, including all 42 DemoQA suites and every default-area suite. The 18 that changed are generic-target performance requests naming a trigger word, each gaining exactly one test with no line removed.

### TFP-115 — Performance/load template checks

- **Phase:** 34
- **Priority:** P2
- **Suggested labels:** `enhancement`, `generate`, `template`
- **Problem it solves:** the template's only performance check is one
  navigation-timing budget.
- **Scope:** Decision 2's four checks and their descriptive failure
  messages, in `generic-suites.ts` and `demoqa-suites.ts` where they apply.
- **Deliverables:** Updated suite builders; unit tests; `TEST_PLAN.md`.
- **Acceptance criteria:** Acceptance Criteria 2.
- **Dependencies:** TFP-114 (landed).
- **Status:** Landed `a2b0c57`, independently verified 2026-09-28.

#### GEN-40 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** The template's performance checks measure real load behaviour and name the culprit (TFP-115; unit: `src/lib/generate/mock/performance-checks.test.ts`, `performance-suite.test.ts`; live: comparison fixture and the-internet.herokuapp.com)

**Expected result:** A performance suite has four read-only checks with Phase 34 Decision 2's loose budgets. It runs whenever the area is selected or triggered, needs no interactive option, and is the same on generic and DemoQA targets. (1) Navigation under 5000 ms, measured after the load event. The old test loaded with `domcontentloaded` and read `duration` at once, which is **0 ms** on a page whose load finishes later: measured 0 ms old vs. 3010 ms new on a page with a 3 s image. That test passed on any such page, and DemoQA's own performance test had the same bug and now uses these checks. (2) Largest contentful paint under 4.0 s, the Core Web Vitals "poor" boundary, naming the largest element. No LCP at all is recorded as a finding, not a failure. (3) Page weight under 5 MB, from browser-reported request sizes (Resource Timing reports 0 bytes cross-origin), listing the 5 largest requests. (4) No same-origin request fails during load, listing each failing URL with its status; requests the page cancelled itself (`ERR_ABORTED`) don't count. **Live, 2026-09-28:** on the fixture, clean 4/4. With `performance-slow` (4 s responses) 3/4: LCP failed with "LCP 4.04 s, budget 4.0 s: Core Web Vitals \"poor\". Largest element: h1 \"Acme Notes\"" (shown to 1 decimal at the time; now 2, since 4.0 vs. 4.0 read like a pass). That detection is marginal by design: 4 s sits just over the LCP budget and under the 5 s navigation budget. On the-internet.herokuapp.com, 4/4 passed, with no false failures from the loose budgets. **Output measured:** of 84 fixed template inputs, all 44 without performance in scope are byte-identical. All 40 with it changed, each to a 4-check suite with unique test ids. **Since Phase 38 (TFP-149, GEN-71)** LCP and CLS are graded in Core Web Vitals' three bands, TBT is recorded, and every performance finding and failure says it was measured once, in a lab.

### TFP-116 — Security template checks

- **Phase:** 34
- **Priority:** P2
- **Suggested labels:** `enhancement`, `generate`, `template`
- **Problem it solves:** the template checks only the URL scheme, and
  nothing at all on `http://` targets.
- **Scope:** Decision 3's checks, using the content profile's discovered
  text inputs; form submission gated by Decision 5. Check whether the run
  report shows test annotations; add that if not.
- **Deliverables:** Updated suite builders; report change if needed; unit
  tests; `TEST_PLAN.md`.
- **Acceptance criteria:** Acceptance Criteria 2.
- **Dependencies:** None.
- **Status:** Landed `5231b64`, `d496c58`, independently verified 2026-09-28; follow-up `9393f12` (the payload test no longer passes when validation blocks the submit).

#### GEN-41 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** The template checks security on every target, not only HTTPS ones (TFP-116; unit: `src/lib/generate/mock/security-checks.test.ts`; live: comparison fixture and the-internet.herokuapp.com)

**Expected result:** The template's only security check was "the URL is HTTPS", written only for https targets; an http target got a note and nothing else. The security suite is now built as follows. (1) HTTPS, unchanged and still only on https targets. (2) Landing-page headers: Content-Security-Policy, `X-Content-Type-Options: nosniff`, and frame protection via `X-Frame-Options` or CSP `frame-ancestors`. (3) The flags on cookies the site itself sets: `HttpOnly`; `Secure` on https only; `SameSite` other than `None`. (4) A script-shaped payload typed into each discovered form's visible free-text fields (text, search, textarea; never passwords; up to 3 forms), with email, url and tel fields filled with valid dummy values, then submitted. The test fails if the payload executes, detected by its own marker or any dialog, with the message "the page renders user input as HTML (cross-site scripting)". It **skips, with the reason**, when the browser's validation would block the submit (naming the rejected fields) or when submitting sends no request, so it can't pass having tested nothing. The first version typed the payload into email/url/tel fields, where validation blocked the submit and the test passed vacuously. Proven in a real browser: a form blocked by a required checkbox skipped as "browser validation rejects: agree"; a form whose script cancels the submit skipped as "sent no request"; a form rendering input raw failed as XSS. Headers and cookie flags are **findings** (RPT-11) and never fail a test (Phase 34 Decision 3). Most sites have no CSP, and a missing `HttpOnly` on an analytics cookie is often deliberate. The payload test submits a real form, so it is skipped unless interactive tests are on (Decision 5), with the skip reason reported (RPT-10). **Since Phase 38 (TFP-146, Decision 6)** it sends attack-shaped input, so it sits at the active gate and is Not run on every run, with the reason "attack-shaped input: needs the ownership confirmation, not built yet", until the ownership confirmation exists (GEN-67); the live results below predate that. **Live, 2026-09-28:** on the fixture, clean 4/4. With `security-unescaped-note` 3/4: the /notes payload test failed as XSS. The /login one then passed, but only because validation blocked its submit, which is the vacuous pass since fixed: /login has no free-text field, so it no longer gets a payload test. On the-internet.herokuapp.com (interactive off), 3/3 passed with the payload test reported skipped. Findings: no CSP; the session cookie `rack.session` has no `Secure`; analytics cookies have no `HttpOnly`/`Secure`. The last is exactly why these don't fail tests. **Output measured:** 80 of 84 fixed template inputs are byte-identical; the 4 that changed are the security-only requests. The form grouping moved into `mock/forms.ts`, shared with the database round trip; its tests pass unchanged. **Since Phase 38 (TFP-147, Decision 4)** items (2) and (3), the landing-page header and session-cookie checks, are gone: the suite runs the Comprehensive passive checks on every inspected page, plus one missing-page probe (GEN-69).

#### RPT-11 evidence

Moved word for word from [`docs/test-plan/RPT.md`](../test-plan/RPT.md) by TFP-253; the case's row there links here.

**Test:** Findings a test recorded without failing appear in the report (TFP-116; unit: `src/lib/report/execution.test.ts` - "finding annotations are kept on the record...")

**Expected result:** A test can record a finding with `test.info().annotations.push({ type: 'finding', description })` and still pass. The run report keeps these as the test record's `findings` list, de-duplicated, and appends them to its remark ("... Findings: a; b."), so the app's execution table, the HTML export and the saved run all show them with no view-specific change. A test without findings keeps its remark unchanged. Live, 2026-09-28, the-internet.herokuapp.com: the security header test passed with "Findings: no Content-Security-Policy header: nothing limits what an injected script could do"; the cookie test passed listing, per cookie, the missing flags.

### TFP-117 — Database persistence round-trip template

- **Phase:** 34
- **Priority:** P2
- **Suggested labels:** `enhancement`, `generate`, `template`
- **Problem it solves:** the database area has no template at all.
- **Scope:** Decision 4's round trip against a discovered form, gated by
  Decision 5; a note when no suitable form exists.
- **Deliverables:** New builder (a separate file under `mock/` if it reads
  better, like `storage-failure-injection.ts`); unit tests; `TEST_PLAN.md`.
- **Acceptance criteria:** Acceptance Criteria 2.
- **Dependencies:** None.
- **Status:** Landed `3b0345d` (GEN-39), independently verified 2026-09-28.

#### GEN-39 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** The template writes a database persistence round trip (TFP-117; unit: `src/lib/generate/mock/database-round-trip.test.ts`; live: comparison fixture)

**Expected result:** For database, which previously had only a manual follow-up comment, the template finds forms worth a round trip in the inspected pages. A suitable form has a visible plain text field or textarea, no password field, and isn't a search box or an email-only signup. Up to 3 are used. For each, the test fills in a unique `TestForge check <timestamp>` value, saves, checks the value is shown, reloads, and checks it is still shown. Each failure message says which step broke, e.g. "after a reload the value saved through \"Note\" (...) is gone: it was shown once but not persisted". It submits a real form, so it is skipped unless the run enables interactive tests, even when a keyword such as "save" triggered the area (Phase 34 Decision 5). The skip is reported with its reason (RPT-10). With no inspection data, or no suitable form, the suite carries a note saying so instead of being silently empty. The generated code passes the type check and the unawaited-assertion check. **Live, 2026-09-28, on the comparison fixture:** with interactive tests on, 1/1 passed on the clean site and 0/1 with `database-notes-not-saved` switched on, so the defect was detected. With interactive tests off, the test was reported skipped for that reason. **Output measured:** 80 of the 84 fixed template inputs are byte-identical. The 4 that changed are the database-only requests, which gained the explanatory note.

#### RPT-10 evidence

Moved word for word from [`docs/test-plan/RPT.md`](../test-plan/RPT.md) by TFP-253; the case's row there links here.

**Test:** A test that skips itself says why (TFP-117; unit: `src/lib/report/execution.test.ts` - "flattenSuites: a test that skipped itself reports its own reason...")

**Expected result:** When a test calls `test.skip(condition, reason)`, the run report's remark reads "Skipped. <test> did not run: <reason>.", taken from Playwright's `skip` annotation. Previously every skipped test was described as "could not be completed because the run was interrupted or a required dependency was unavailable". That was wrong for a deliberate skip, such as a form-submitting test with interactive tests off. A skip or interruption with no stated reason keeps the old wording. Live, 2026-09-28: the template's database round trip on the comparison fixture without interactive tests was reported as "Skipped. TFDB-001: persistence round trip: Note on /notes did not run: database round trip: saves data through a form on the live site, so it only runs when TESTFORGE_INTERACTIVE=1 is set for the run." Superseded in part by RPT-12 (Phase 34 Option C): such a test is now status "Not run" with the remark "Not run. <test> did not run: <reason>.", and no longer counts as failed.

### TFP-118 — Option B: additive gap-filling

- **Phase:** 34
- **Priority:** P2
- **Suggested labels:** `enhancement`, `generate`, `local`
- **Problem it solves:** the local model can only replace the template
  wholesale today (`TESTFORGE_OLLAMA_MODEL`), losing its breadth.
- **Scope:** Decision 6: gap detection, a local request scoped to gap
  areas, appending labelled describe blocks, per-gate fallback that keeps
  the template suite. Reliability excluded.
- **Deliverables:** Updated `/api/generate` route and generation modules;
  tests against a fake local server, the way TFP-103/106/110 proved their
  gates; `TEST_PLAN.md`.
- **Acceptance criteria:** Acceptance Criteria 3.
- **Dependencies:** TFP-114-117 (they define which areas remain gaps).
- **Status:** Landed `ef736c5`, independently verified 2026-09-28. Follow-up
  for Decision 6's two GEN-43 amendments (template-reported "nothing
  applicable" is not a gap; gap-fill tests skip unless interactive) landed
  in `17651f2` (TEST_PLAN GEN-44), with `a564543` (the test fake's
  keep-alive race behind GEN-43's unexplained failure) and `238f406` (a run
  where nothing ran gives no recommendation, RPT-14). Not yet
  independently verified.

#### GEN-43 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** Option B: the local model fills only the areas the template left empty (TFP-118; automated: `src/app/api/generate/route.local.test.ts` (17 at the time), `src/lib/generate/gap-fill.test.ts`, `src/lib/report/execution.test.ts`; live: see Expected Result)

**Expected result:** With `TESTFORGE_OLLAMA_MODEL` unset, the response is exactly the template-only one. With it set, the template always generates (`mockGenerateDetailed` reports tests per area; its output is byte-identical to before across 264 fixed inputs). A **gap** is a selected or triggered area with zero template tests, reliability never included (GEN-32 open). No gap: no local call, and the response is the template with `generatedBy: "template"`. Gaps: one local request asking for those areas only, with only their guides. Every Phase 30-33 gate applies, plus a type check of the merged file. On success the local tests are appended in `test.describe('Local model (<model>)')`, with an inner area block when there is one gap area, and the response has `generatedBy: "template+ollama"`. On any failure the **template suite is returned unchanged** with `generatedBy: "fallback"`, the `fallbackReason`, and `gapFill.outcome: "rejected"`. Every response carries each gate's verdict: bar, measured result, verdict, evidence (Decision 8; persisted with the run in TFP-119). The run report labels each test `generator: "template"` or `"local model"`, and local tests' remarks say so. **Live, 2026-09-28, real page data, testforge-qwen7b:** the-internet.herokuapp.com with database selected (its only form is a login, so database is a gap) gave `template+ollama` in 55 s, all 4 gates kept. The report labelled the local test `local model` under Database. The fixture with database selected (the notes form gives the template a round trip) gave no gap, no local call, 4 ms. **Open, recorded not fixed:** (1) on the page with no saving form the local model invented a login-and-reload flow with a guessed username, which failed falsely. That is the GEN-35 weakness, and it is the main case where gap-filling calls the model now that the template covers the other areas. (2) Local tests are not gated by the interactive rule (Decision 5): the local test above submitted a real login form on a live site with interactive tests off. This was already true of the Phase 30-33 replace mode. One unexplained failure of the gap-filled test in the first of 19 full-suite runs did not reproduce (12 isolated runs, 2 under CPU load); its assertion now prints a diff. **Both open items and the flake are resolved by GEN-44:** (1) a page inspected and found to have no saving form is no longer a gap, so the-internet case above no longer calls the model; (2) the local block is skipped unless interactive tests are on. The flake was the test's fake server, not the route (see GEN-44).

### TFP-119 — Report areas that end up with no tests

- **Phase:** 34
- **Priority:** P2
- **Suggested labels:** `enhancement`, `report`
- **Problem it solves:** an area that produces no tests (no template
  applies, or the local model is unavailable or rejected) disappears from
  the report instead of saying why; and every gate verdict is discarded
  after `/api/generate` returns, with its evidence.
- **Scope:** Decisions 7 and 8: area-level "not tested and why"; deliberate
  skips as their own "not run by choice" status in the summary, ratio and
  release recommendation (`src/lib/report/summary.ts`, `execution.ts`); and
  each gate's bar, measured result, verdict and evidence persisted with the
  run and shown in the report.
- **Deliverables:** Generate-route and run-persistence changes to carry the
  verdicts; report changes; tests (including a rejected local suite whose
  evidence appears in the saved run); `TEST_PLAN.md` RPT cases.
- **Acceptance criteria:** Acceptance Criteria 3 (the reporting bullets,
  including gate verdicts).
- **Dependencies:** Can be built alongside TFP-118; its local-model reasons
  depend on TFP-118's fallback shape.
- **Status:** Landed `de26bf1` and `13fdffb`, independently verified
  2026-09-28.

#### RPT-12 evidence

Moved word for word from [`docs/test-plan/RPT.md`](../test-plan/RPT.md) by TFP-253; the case's row there links here.

**Test:** A test skipped by choice doesn't count against the run (TFP-119, Phase 34 Decision 7 Option C; unit: `src/lib/report/summary.test.ts`, `execution.test.ts`)

**Expected result:** A test that skipped itself with a stated reason (Playwright's `skip` annotation) gets the status **Not run** and keeps its reason (`skipReason`). It is not executed, is left out of the pass/fail ratio, and doesn't downgrade the release recommendation. The summary carries `notRun`, `notRunReasons` and `notRunNote` ("2 tests not run: <reason> (1); <reason> (1)"), shown beside the recommendation in the app and the HTML export, which says they are not coverage either. The app's filter, colours and counts know the new status. An unexplained skip or interruption stays **Blocked** and still gives "Ready with caution", since nobody chose it. Coverage and performance treat Not run like Blocked: not executed. Before this, any run with interactive tests off (the safe default) could never read "Ready for release". **Live, 2026-09-28, the comparison fixture, interactive off:** 35 planned, 33 passed, 2 Not run (the database round trip and the script-payload test), ratio 33:0, **"Ready for release"**, with the note naming both reasons. Before this change the same run read "Ready with caution".

#### RPT-13 evidence

Moved word for word from [`docs/test-plan/RPT.md`](../test-plan/RPT.md) by TFP-253; the case's row there links here.

**Test:** Empty areas say why, and generation gates are recorded with the run (TFP-119, Phase 34 Decisions 7 and 8; unit: `src/lib/report/empty-areas.test.ts`, `src/lib/run/generation-record.test.ts`)

**Expected result:** **Gate verdicts with the run (Decision 8).** The app keeps the generate response's `generatedBy`, `model`, `fallbackReason`, `gapFill` and `gates` and sends them with the run request as `generation`. `/api/run` accepts only the known shape, capped (untrusted input), and persists it in `run.json` and the report. The summary tab and the HTML export show "How this suite was generated": each gate's bar, measured result, verdict and evidence. **Empty areas (Decision 7).** Every area in scope (selected, or inferred as the template does) with no test record is listed in "Areas with no tests" with its reasons. The template's own note for that area comes first, read back from the suite that ran. Then the local-model side: timed out, output rejected (and by which gate), unreachable, not installed, asked-but-wrote-nothing, reliability never sent (GEN-32), or no local model result recorded (model variable not set). **Live, 2026-09-28, the-internet.herokuapp.com, real page data, testforge-qwen7b:** a database gap filled in 54 s was saved to `run.json` with all 4 gates ("time budget: 54327 ms -> kept", ...). With the local budget cut to 1 s, the saved run and report show the rejected time gate ("no answer within 1000 ms"), and Database is listed empty with the template's note (no form that saves visible text) and "the local model did not answer within its time budget". **Not exercised in a browser:** the three-line React hand-off (store in `useGeneration`, pass in `page.tsx`, send in `useRun`); it is type-checked, and the live check sent exactly what it sends.

### TFP-120 — Measure Option B

- **Phase:** 34
- **Priority:** P3
- **Suggested labels:** `measurement`, `docs`
- **Problem it solves:** Option B's value is asserted from Phase 21's data,
  not yet measured as built.
- **Scope:** Decision 9.
- **Deliverables:** A comparison report under `docs/decisions/`; decision
  on whether a UI control is justified recorded in this record.
- **Acceptance criteria:** Acceptance Criteria 4.
- **Dependencies:** TFP-118 (including its GEN-43 follow-up), TFP-119.
- **Note:** after the GEN-43 amendments, expect few or no gap-fill calls on
  the Phase 21 targets. That is a result to report, not a reason to widen
  what counts as a gap.
- **Status:** Measured 2026-09-28 (TEST_PLAN GEN-45). Report:
  `phase-34-option-b-measurement-report.md`; outcome under Decision 9,
  confirmed by Emil. Independently verified 2026-09-28 (see Gate B).

#### GEN-45 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** Option B measured: template vs. template + gap-fill, against the fixture and a real target (TFP-120, Phase 34 Decision 9; manual, on-demand: `npm run compare:generators`, see `docs/GENERATOR_COMPARISON.md`; report: `docs/decisions/phase-34-option-b-measurement-report.md`)

**Expected result:** The comparison now pits the template alone against the template with the local model's gap-fill, both through the real `/api/generate`. It saves each run with its generation record (gap-fill outcome, every gate verdict), and checks that a gap-fill suite that added nothing is byte-identical to the template's; such a suite is not run twice. A **gap sweep** first requests every area alone, with and without the target's page data, through the real route with the local model pointed at a closed port, so the route's own gap detection decides and no model is called. **Live, 2026-09-28, testforge-qwen7b, two full runs of both targets:** 0 gaps with page data on either target; without page data the only gap is database. 15 of 17 cases made no local call, and the suite was the template's byte for byte. Of the 2 gap-fill calls (database without page data, built for it): the fixture's test caught `database-notes-not-saved`, a result the fixture's bias weakens; the-internet's failed on the healthy site, an invented login-and-reload flow that all four gates passed. Template-only detection on the fixture is 5 of 6 (Phase 21: 2 of 6). The miss is `a11y-unlabelled-field`, which gap-filling can't reach because accessibility has template tests. Outcome: no UI control for gap-filling (Decision 9). The report script reads Phase 21 results unchanged apart from an "interactive tests on" label on the two cases that set it.

### RPT-14 follow-up — "No test ran" must not count interrupted tests

- **Phase:** 34
- **Priority:** P2
- **Suggested labels:** `bug`, `report`
- **Problem it solves:** `buildSummary` counts `passed + flaky + failed +
  blocked` as tests that ran. Since Option C, `Blocked` means interrupted or
  skipped without a reason, so those did not run either. A run where every
  test was interrupted still reads "Ready with caution". The status badge
  also stays green beside "No recommendation", because Playwright treats an
  all-skipped run as passed.
- **Scope:** Count only `passed + flaky + failed` as run. A mix of run and
  Blocked tests still reads "Ready with caution". Neutral badge when no test
  ran.
- **Deliverables:** `summary.ts` and badge change; summary tests for
  all-Blocked and all-Not-run; `TEST_PLAN.md` RPT-14 update.
- **Acceptance criteria:** Acceptance Criteria 5, first bullet.
- **Dependencies:** None.
- **Status:** Landed `2c9ecea` (TEST_PLAN RPT-14). Not yet independently
  verified.

### TFP-121 — Accessibility: every form field has an accessible name

- **Phase:** 34
- **Priority:** P2
- **Suggested labels:** `enhancement`, `generate`, `template`
- **Problem it solves:** the template's accessibility tests miss a form
  field with no label (TFP-120: `a11y-unlabelled-field` undetected).
- **Scope:** Decision 10.
- **Deliverables:** Template check in the accessibility builder(s), using
  discovered form fields from page data; unit tests including a
  real-browser case with labelled, `aria-label`, `aria-labelledby`,
  placeholder-only and unlabelled fields; `TEST_PLAN.md` GEN case; output
  measured before and after on fixed inputs.
- **Acceptance criteria:** Acceptance Criteria 5, second and third bullets.
- **Dependencies:** None.
- **Status:** Landed `99f90f3` (TEST_PLAN GEN-46). Live: fixture fails with
  the defect on, naming `#email` on /login, and passes clean; the-internet
  passes with no finding. 240 of 264 fixed inputs byte-identical, the 24
  changed only gaining the new accessibility tests. Not yet independently
  verified.

#### GEN-46 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** Every form field on the inspected pages has an accessible name (TFP-121, Phase 34 Decision 10; unit: `src/lib/generate/mock/form-field-names.test.ts`; live: comparison fixture and the-internet.herokuapp.com)

**Expected result:** The template's accessibility tests only checked the landing page's elements, so TFP-120 found all 5 passing with the fixture's sign-in email field unlabelled. The accessibility suite now gets one test per inspected page with form fields (up to 10). At run time it checks every visible field there: every `input` except hidden, submit, button, image and reset, plus `select` and `textarea`. The name is the one the browser computes, read from the field's aria snapshot, not a hand-rolled label heuristic. A field with **no name fails** the test, and the message names the page and each field by id, name or type. A field named **only by its placeholder** is a **finding** (RPT-11): the test removes the placeholder in the page, reads the name again and restores it, so this is still the browser's computation and nothing is sent to the site. Read-only. **Proven in a real browser:** a label, `aria-label`, `aria-labelledby`, a wrapping label and `title` all give a name. An unlabelled input and an unnamed `select` fail and are listed. Two placeholder-only fields become findings. CSS-hidden, hidden and submit inputs are skipped. **Per input type (Gate C condition, 2026-09-29):** in a real browser, labelled and unlabelled checkbox, radio, password, number, date, range, color and file inputs, plus checked, wrapped-label, value-bearing, `aria-labelledby` and `multiple` variants, are each named correctly. The first snapshot line shows state or a value for some types (`- checkbox [checked]`, `- slider: "50"`), and neither is read as a name. The case found that Chromium names an unlabelled **file** input by its button text ("Choose File"), so it passed as named. A file input whose name equals that of a throwaway unlabelled file input in the same page (so any locale) now counts as unnamed. Without that fix the case fails on exactly the two unlabelled file inputs. Output: all 264 fixed inputs are identical to `99f90f3`'s outside the form-field tests themselves. **Live, 2026-09-28:** fixture clean 7/7. With `a11y-unlabelled-field` on, 6/7, failing with "form fields on /login with no accessible name (a screen reader announces them without a label): #email". the-internet 2/2, with no false failure and no findings. Template-only detection on the fixture is now 6 of 6. **Output measured, not diff-read:** of 264 fixed inputs, 240 are byte-identical, including every suite without page data and every area other than accessibility. The 24 that changed are the with-page-data suites with accessibility in scope (alone or defaults). Each only gains the new tests (fixture /login and /notes, the-internet /login) with no line removed, appended last so existing test ids don't shift.

### TFP-122 — Inspect automatically when a request has no page data

- **Phase:** 34
- **Priority:** P2
- **Suggested labels:** `enhancement`, `generate`, `introspection`
- **Problem it solves:** the one remaining gap (database without page data)
  sends the local model after a flow it has to invent; inspecting the pages
  answers it deterministically, and gives every other area's template real
  page data too.
- **Scope:** Decision 11.
- **Deliverables:** `/api/generate` change calling the introspection code
  directly; the opt-out flag; response and report fields saying page data
  was gathered automatically, or why it failed; comparison scripts updated
  to use the opt-out for their no-page-data cases; route tests for all three
  paths; `TEST_PLAN.md` GEN case.
- **Acceptance criteria:** Acceptance Criteria 5, last bullet.
- **Dependencies:** None. Build after TFP-121 if done in sequence, so each
  output measurement changes only one thing.
- **Status:** Landed `cc7a810` (TEST_PLAN GEN-47). Full route responses for
  264 fixed inputs (supplied page data or opt-out) byte-identical. Live: the
  inspected-without-page-data, failed-inspection and opt-out paths all
  behave as Acceptance Criteria 5 states. Not yet independently verified.

#### GEN-47 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** A generate request with no page data is inspected automatically (TFP-122, Phase 34 Decision 11; automated: `src/app/api/generate/route.inspect.test.ts` (real browser, local site), `src/lib/run/generation-record.test.ts`, `src/lib/report/empty-areas.test.ts`; live: comparison fixture and the-internet.herokuapp.com)

**Expected result:** When `/api/generate` gets no `contentProfile`, it runs the same introspection the app's own flow runs, by calling `inspectPages` directly (not over HTTP). It inspects the request's `contentRules.paths`, or the base URL's own path, normalized as `/api/introspect` does (the normalization moved to `src/lib/introspect/paths.ts`, unchanged). The response adds `pageInspection` (`inspected` with paths, pages and warnings; or `failed` with a one-line reason, with terminal colour codes and the call log removed) and `generatedBy: "template"` if no other generator set it. The run persists it (capped, untrusted input), and the app's report and the HTML export say where the page data came from, or why there is none. **Never blocks:** a failed inspection returns exactly the no-page-data output plus the reason. **Opt-out:** `autoInspect: false` gives exactly today's response; the comparison script's no-page-data cases and the route's own generation tests send it (so no test opens a browser on :3000). Supplied page data is used as-is. **Live, 2026-09-28, testforge-qwen7b configured:** the-internet database with no page data was inspected in 7 s, found not applicable, and made no model call. The fixture database request was inspected in 1.4 s, and the template's round trip was written and passed; the saved report carries the inspection. Opted out, the same request called the model as before (48 s). An unreachable host generated in 2.3 s with "Could not inspect http://127.0.0.1:4499/: page.goto: net::ERR_CONNECTION_REFUSED ...". With inspection on, gap-filling runs only when inspection is opted out of or fails (Decision 11's stated consequence). **Output measured, not diff-read:** full route responses for 264 fixed inputs (supplied page data or `autoInspect: false`) are byte-identical before and after. **Not changed:** the app, which always inspects before generating and so never reaches this path; the gathered page data is not returned in the response.

## Recommended Execution Order

1. TFP-114 immediately; it is a small, standalone defect fix.
2. TFP-117, TFP-115, TFP-116 in any order (all decisions resolved
   2026-09-28).
3. TFP-118, with TFP-119 alongside.
4. TFP-120.
5. The RPT-14 follow-up (a defect, fixed first), then TFP-121, then
   TFP-122.

## Suggested Milestone Gates

### Gate A — The template covers all three areas
**Met 2026-09-28** (TFP-114 to 117 landed and independently verified; the six
default areas' output unchanged by measurement).
- TFP-114-117 landed; the Phase 21 fixture requests for performance,
  security and database each produce executable template tests; the six
  default areas' output is shown unchanged.

### Gate B — Option B built and measured
**Met 2026-09-28.** Built and measured, and independently verified: the
GEN-43 follow-up (`17651f2`), RPT-14 (`238f406`), the route-test fix
(`a564543`) and TFP-120 (`6618501`, `f799b7a`) were checked against the
repository (typecheck and lint clean, 316 unit tests, template output
unchanged on fixed inputs, the report consistent with its tables). The live
Ollama runs could not be reproduced from the verifying session and are
taken from Claude Code's run. The Decision 9 outcome (no UI control) was
confirmed by Emil the same day.
- TFP-118-120 landed; the measurement report exists with the fixture-bias
  caveat and at least one real target; `product-roadmap.md` records the
  outcome.

### Gate C — TFP-120's follow-ups landed
**Built 2026-09-28 (`2c9ecea`, `99f90f3`, `cc7a810`); independently verified
2026-09-29 with one condition before pushing.** Typecheck and lint clean;
325 unit tests pass in the verifying session plus the 7 that need a real
browser there, for 332; template output unchanged on fixed inputs without
page data; the code matches Decisions 10 and 11. The live runs are taken
from Claude Code's run.
- **Condition (TFP-121):** the check decides "has a name" by parsing the
  first line of each field's aria snapshot, and it counts checkboxes and
  radios. The real-browser test covers text-like fields, `select` and
  `textarea` only. A real-browser case must also show labelled and unlabelled
  checkbox, radio, password, number, date, range, color and file inputs
  parsed correctly, so no real site gets a false "no accessible name" from
  an input type whose snapshot line looks different.
  **Met 2026-09-29 (TEST_PLAN GEN-46).** The parse is correct for every
  listed type, including checked, wrapped-label and value-bearing variants
  (`- checkbox [checked]`, `- slider: "50"` read as unnamed; `- slider
  "Volume": "50"` as named). The case found the opposite error for `file`:
  Chromium names an unlabelled file input by its button text ("Choose
  File"), so it passed as named. Fixed, not dropped: a file input whose
  name equals that of a throwaway unlabelled file input in the same page
  (so any locale) counts as unnamed. The new case fails on exactly the two
  unlabelled file inputs without the fix.
- **Known, not acted on (TFP-122):** automatic inspection does not pass
  named flows, so journeys that come from named flows are not built from
  automatically gathered data. A generate request has no named-flow input
  today, so nothing is lost; revisit if one is added.
- The RPT-14 follow-up, TFP-121 and TFP-122 landed, each with its
  `TEST_PLAN.md` case and independently verified; TFP-121's and TFP-122's
  output changes shown by measurement to be only the intended ones.

## Test-plan evidence for cases with no ticket of their own (TFP-253)

### GEN-42 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** Selectors built from page values survive quotes and backslashes (Phase 34; unit: `src/lib/generate/mock/locators.test.ts`, `database-round-trip.test.ts` - fieldLocator)

**Expected result:** Generated code locates elements with CSS selectors built from discovered values: element and drag-target ids, drag-target classes, link hrefs, input types, form actions and form fields. Each value was escaped for the CSS string but not for the single-quoted JS string the selector is written into. So a value containing `'` produced generated code that didn't compile, and every backslash was halved. `quoteSelector` (format.ts) now escapes the whole selector for the JS string, in `locators.ts`, `dependency-failure-injection.ts` and `forms.ts`. Proven in real Chromium: ids, classes and hrefs containing `'`, `\`, `.`, `:` and `"` compile and select exactly the right element. With the old code, `it's` gives a TypeScript syntax error. Plain values give exactly the same locator text as before, and on the real fixture and the-internet profiles every suite outside the security change is byte-identical.

### GEN-44 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** Gap-filling skips areas the template found nothing to test in, and the local block runs only with interactive tests on (GEN-43 follow-up, amended Phase 34 Decision 6; automated: `src/lib/generate/gap-fill.test.ts`, `src/app/api/generate/route.local.test.ts` (18); live: see Expected Result)

**Expected result:** **(1) Not applicable is not a gap.** When the template inspected the pages and found nothing its area applies to (database: page data exists but no form saves visible text), the suite records that as `notApplicable`. That area is not a gap, so no local call is made, and the response lists it in `gapFill.notApplicableAreas` (in the `no-gaps`, `added` and `rejected` shapes alike). An area with **no page data** is still a gap: the template could not look, so that is not a finding. Template output is byte-identical to before across the 264 fixed inputs. **(2) The local block skips unless interactive tests are on.** Its first statement is `test.skip(process.env.TESTFORGE_INTERACTIVE !== '1', '<reason>')`, with the reason "gap-fill test written by the local model (<model>): it may submit forms on the live site, so it only runs when TESTFORGE_INTERACTIVE=1 is set for the run". The whole block skips, not individual tests, because recognising a submit in model-written code is exactly where a mistake writes to a live site. The template's own tests are untouched. Its tests report as **Not run** with that reason (RPT-12). **Test fix:** the fake OpenAI server in `route-test-helpers.ts` now closes every connection. A pooled keep-alive socket could hit the server's idle close mid-request under full-suite load, and the route correctly reported `ollama_unreachable` for a server that was up. That was GEN-43's unexplained failure: 0 failures in 8 full-suite runs after the fix, against a failure on the first run twice before. **Live, 2026-09-28, testforge-qwen7b:** the-internet.herokuapp.com, real page data, functional + database: `generatedBy: "template"`, no local call, 25 ms, `notApplicableAreas: ["database"]`, and the report lists Database under "Areas with no tests" with the template's reason. The comparison fixture with database and no page data: a gap, filled in 28 s. Run with interactive off, its one local test was **Not run** with the reason above. Run with interactive on, it ran and passed. **Not changed:** selecting only an area that turns out not applicable leaves an empty suite, and the run ends "No tests found", as the template-only path always has.

### RPT-14 evidence

Moved word for word from [`docs/test-plan/RPT.md`](../test-plan/RPT.md) by TFP-253; the case's row there links here.

**Test:** A run where nothing ran gives no release recommendation and a neutral badge (GEN-44, Phase 34 RPT-14 follow-up; unit: `src/lib/report/summary.test.ts`)

**Expected result:** A test **ran** only if it Passed, was Flaky or Failed. If none did, because every test was Not run (e.g. the suite is only the local model's gap-fill block, with interactive tests off) or Blocked (interrupted, or skipped without a reason), the recommendation is **"No recommendation: no test ran"**, beside the not-run note. Before, RPT-12's rule gave "Ready for release" with zero tests executed (found in GEN-44's live check on the comparison fixture), and the first fix still counted Blocked tests as run, so an all-interrupted run read "Ready with caution". A mix of run and Blocked tests still reads "Ready with caution". **Badge:** Playwright calls an all-skipped run passed, so the app's report badge and the HTML export's recommendation banner were green (and the banner orange for all-Blocked). Both are now neutral grey when no test ran, through one shared `noTestRan` check; the export's banner class is covered by a unit test (`rec-none`). Not changed: the raw execution panel shown when there is no structured report, which has no summary to consult.
