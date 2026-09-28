# Phase 34 Decision Record — Template Category Coverage and Additive Gap-Filling

Date: 2026-09-28
Scope: Give the deterministic template generator real tests for the three
best-practice areas where it writes none today (performance/load, security,
database), then build Phase 21's chosen Option B: the template always
generates, and the local model fills only the selected areas the template
still leaves empty.
Status: Approved and in implementation (Option B confirmed by Emil
2026-09-28; performance budgets and security-finding handling decided the
same day). TFP-114 landed.

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

7. An area that ends up with no tests is reported, never silently dropped.
- The run report names each selected area with zero tests and the reason:
  no template applies to this target (e.g. no form found), local model not
  configured, local model timed out, or local output rejected (with its
  `fallbackReason`).
- This builds on Phase 17's not-tested-and-why reporting
  (`src/lib/report/discovered-coverage.ts`); whether it extends that
  structure or adds an area-level equivalent is decided when TFP-119 is
  built.

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
- A generation that ran any gate shows each gate's bar, measured result,
  verdict and evidence in the persisted run and its report, including when
  the local output was rejected.

4. Measurement
- A comparison report records template-only vs. template-plus-gap-fill on
  the fixture and at least one real target, with the fixture-bias caveat
  stated, not smoothed over.

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

### TFP-119 — Report areas that end up with no tests

- **Phase:** 34
- **Priority:** P2
- **Suggested labels:** `enhancement`, `report`
- **Problem it solves:** an area that produces no tests (no template
  applies, or the local model is unavailable or rejected) disappears from
  the report instead of saying why; and every gate verdict is discarded
  after `/api/generate` returns, with its evidence.
- **Scope:** Decisions 7 and 8: area-level "not tested and why", plus each
  gate's bar, measured result, verdict and evidence persisted with the run
  and shown in the report.
- **Deliverables:** Generate-route and run-persistence changes to carry the
  verdicts; report changes; tests (including a rejected local suite whose
  evidence appears in the saved run); `TEST_PLAN.md` RPT cases.
- **Acceptance criteria:** Acceptance Criteria 3 (the reporting bullets,
  including gate verdicts).
- **Dependencies:** Can be built alongside TFP-118; its local-model reasons
  depend on TFP-118's fallback shape.

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
- **Dependencies:** TFP-118, TFP-119.

## Recommended Execution Order

1. TFP-114 immediately; it is a small, standalone defect fix.
2. TFP-117, TFP-115, TFP-116 in any order (all decisions resolved
   2026-09-28).
3. TFP-118, with TFP-119 alongside.
4. TFP-120 last.

## Suggested Milestone Gates

### Gate A — The template covers all three areas
- TFP-114-117 landed; the Phase 21 fixture requests for performance,
  security and database each produce executable template tests; the six
  default areas' output is shown unchanged.

### Gate B — Option B built and measured
- TFP-118-120 landed; the measurement report exists with the fixture-bias
  caveat and at least one real target; `product-roadmap.md` records the
  outcome.
