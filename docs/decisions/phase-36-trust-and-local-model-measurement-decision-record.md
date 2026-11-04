# Phase 36 Decision Record — Trust in Results, and Measuring the Local Model

Date: 2026-09-29
Scope: Fix what makes a healthy real site turn red, clean up the small
defects the 2026-09-29 status audit found, and measure which local model and
settings work best on Emil's machine before Phase 35 relies on the model.
Status: Complete, verified as a whole and pushed 2026-09-30. Approved (Emil, 2026-09-29, from the TestForge Status Audit's
recommended order). All decisions are made; Decision 2 was decided by Emil
the same day.

## Context

The 2026-09-29 status audit found:

- **Healthy real sites turn red.** The latest clean runs on
  the-internet.herokuapp.com have 10 failures. Five are SEO: three real gaps
  (meta description, canonical, a sitemap line in robots.txt), and two
  optional items (a web-app manifest, structured data). Four functional
  failures look false: TFFU-002 finds no sign-in control on a login page;
  TFFU-007 and TFFU-010 call the GitHub ribbon link invisible; TFFU-015
  (keyboard navigation) times out at 30 s. The tenth came from the local
  model. Source: `comparisons/2026-09-28T20-19-37-582Z-the-internet/results.json`.
- **Small defects:** the cookie/session test cannot fail (it asserts the
  cookie list is an array); a zero-test suite reports "run failed, no
  report"; real-browser unit tests fail rather than skip where Chromium is
  not installed.
- **The local model is an unknown.** The only model comparison
  (Phase 30's spike: 3B 53.5 s, 7B 73.9 s, llama3.1 8B 54.5 s) is one run
  per model. It ran before the rules layer, the gates and Phase 33's category
  examples existed, and never measured memory fit or tuned settings.
  Measured since: 67 s median per suite and 2 of 16 timeouts (Phase 21);
  25-55 s per gap area (Phase 34). The GPU is an RTX 2050 with 4 GB.
  `qwen2.5-coder:7b` at q4 is 4.68 GB, so it cannot fit.

Phase 35 (comprehensive testing) plans to lean on the local model, so what it
can promise depends on this measurement.

## Decisions

1. The four suspected false failures on the-internet are reproduced and each
   one resolved, not suppressed.
- Each is re-run and the page read by hand. A real site problem stays a
  failure and its message says what is wrong. A template error is fixed in
  the template.
- No failure is resolved by loosening an assertion without saying why in the
  commit.
- All four, with their verdicts, go into a labelled failure set
  (`docs/decisions/data/labelled-failures.md`) alongside TFP-040's eight and
  the TFP-099 cases. It is the seed for the failure-triage gate deferred in
  Phase 34.

2. Optional SEO items are recorded as findings, not failures.
- Decided by Emil 2026-09-29. A missing web-app manifest and missing
  structured data are recorded as named findings (Playwright annotations, as
  security headers are) and do not fail the test. A missing meta
  description, canonical link, or sitemap reference in robots.txt stay
  failures, as baseline SEO for any public page. Every failure and finding
  names what is missing and on which page.

3. The small defects are fixed now, per the standing rule.
- Cookie/session gets a test that can fail: after the landing page loads,
  the site's own session-like cookies are checked for expiry and scope.
  Details are left to the ticket, but a check that always passes is removed,
  not kept beside the new one.
- A suite with zero tests reports "nothing to run" with the area's
  not-applicable reason, not "run failed".
- Real-browser unit tests skip with a stated reason when Chromium is not
  installed, instead of failing.
- The throwaway spikes (`spike-ollama-check.mjs`, `spike-ollama-check-v2.mjs`)
  are deleted once the benchmark below replaces them. `Modelfile.testforge-qwen3b`
  moves into the benchmark's Modelfiles.

4. The local model is measured on Emil's machine with a committed,
   repeatable benchmark, not a one-off spike.
- `scripts/benchmark-local-models.mjs` runs the real local generation path:
  the same system prompt, `localRulesFor(areas)` and request shape
  `/api/generate` sends.
- Each call is also made on Ollama's native `/api/chat` endpoint, with
  identical messages and options, to capture its timings. The
  OpenAI-compatible endpoint TestForge uses returns none.
- Settings are baked into a Modelfile per configuration, because the
  OpenAI-compatible endpoint drops `num_ctx` (Phase 30).
- Raw results, the Modelfiles and the machine details are committed under
  `benchmarks/<date>/`, so this is never undocumented again.

5. The configurations measured.

| ID | Model | Quantisation | `num_ctx` | Notes |
| --- | --- | --- | --- | --- |
| C1 | `testforge-qwen7b` (qwen2.5-coder 7B) | q4_K_M, 4.68 GB | 16384 | Today's baseline, unchanged |
| C2 | qwen2.5-coder 7B | q4_K_M, 4.68 GB | N (below) | Smaller context only |
| C3 | qwen2.5-coder 7B | q3_K_M, 3.8 GB | N | Download approved |
| C4 | qwen2.5-coder 3B | q4_K_M, 1.93 GB | N | Installed |
| C5 | qwen3.5 4B | q4_K_M, 3.4 GB | N | Download approved; newest small Qwen |
| C6 | llama3.1 8B | q4_K_M, 4.92 GB | N | Installed; general model, control |
| C7 | Best of C2-C6 and C8 on the Decision 7 rule | as chosen | as chosen | With `OLLAMA_FLASH_ATTENTION=1` and `OLLAMA_KV_CACHE_TYPE=q8_0` |
| C8 | `testforge-qwen7b` (qwen2.5-coder 7B) | q4_K_M, 4.68 GB | 16384 | `num_gpu` raised to the largest value that loads without error. Added 2026-09-29: C1 left 1.6 GB of VRAM unused while running 59% of the model on the CPU |

- **N = 12288** for C2-C6: it holds the largest measured prompt (6,608)
  plus `num_predict` 4,096 with about 1,600 spare. Decided by Emil
  2026-09-29; the original rule (the smallest of 4096, 6144 and 8192 that
  holds the largest measured prompt plus `num_predict`) could not be met,
  because it reserved the full output ceiling while measured output never
  passed 481 tokens. A cut-off prompt still makes a run invalid, not a
  failure.
- **C8's `num_gpu`** is found by stepping it up and recording each attempt.
  An out-of-memory failure is a result, not something to work around. C8 is
  judged by the same Decision 7 rule.
- `temperature` stays 0.2 and `num_predict` stays 4096 for every
  configuration, so only the model, quantisation and context change.
- Approved downloads (Emil, 2026-09-29): `qwen2.5-coder:7b-instruct-q3_K_M`
  and `qwen3.5:4b`. Nothing else is pulled without asking.
- `dolphin-mixtral` (26 GB) is installed but out of scope: it cannot run
  usefully on this machine.

6. What is measured, per configuration.
- **Workload:** the seven fixture cases in
  `scripts/comparison-configs/fixture.json` (functional, accessibility, seo,
  performance, database, security, reliability), each with the fixture's
  page data. One unscored warm-up call, then 3 measured calls per case: 21
  suites per configuration.
- **Speed:** wall time per call, plus Ollama's own `load_duration`,
  `prompt_eval_count`, `prompt_eval_duration`, `eval_count` and
  `eval_duration` (so tokens per second in and out), and timeouts at the
  existing 180 s. Reported as median and 90th percentile.
- **Memory fit:** `ollama ps` after the warm-up (loaded size and the GPU/CPU
  split), and `nvidia-smi` memory used, once per configuration.
- **Code quality, per suite:** passes `findTypeErrors`; passes
  `findUnawaitedAssertions`; contains at least one test; carries the area's
  category signal, as Phase 33 defined it (performance measures time; SEO
  checks title and meta; database saves and reloads; security sends a
  payload or checks transport; reliability uses `page.route()`;
  accessibility checks names or roles); no leaked example data
  (`example.invalid`, `EXAMPLE-ONLY`); and no duplicate test titles.
- **Behaviour, per suite that passes both gates:** run against the fixture
  clean (it should pass) and with that case's injected defect on (it should
  fail). Clean passes and defect detections are counted. The fixture is
  biased toward the worked examples, and the report says so.
- **Machine:** Windows version, GPU, driver and VRAM, Ollama version, and
  whether other GPU programs were running. Every configuration runs on the
  same machine, one at a time.

7. The winner is chosen by a rule fixed now, before any number exists.
- **Quality bar:** a configuration qualifies only if, out of 21 suites, it
  is no more than 1 worse than C1 on each of: both gates passed, category
  signal present, clean-run passes, and defect detections. It must also have
  no more timeouts than C1.
- **Choice:** among qualifying configurations, the lowest median wall time
  wins. A tie within 10% goes to the higher defect-detection count.
- **If nothing beats C1:** C1 stays, and the report says so plainly.
- **Adoption:** the winner becomes the setup in `docs/LOCAL_MODEL_SETUP.md`
  and the default `TESTFORGE_OLLAMA_MODEL`. It is re-checked on the Phase 33
  category bar (three consecutive real generations per category, read, not
  just compiled) before Phase 35 relies on it.

## Acceptance Criteria

1. False failures
- The four the-internet failures each have a recorded verdict (real or
  template error) with the evidence. Template errors are fixed, and a clean
  run of those cases no longer fails on them.
- The labelled failure set exists and lists every case with its source run.

2. Small defects
- The cookie/session test fails on a site whose session cookie breaks its
  expiry or scope expectations, and passes on one that meets them.
- A zero-test suite's report says "nothing to run" and why.
- Real-browser unit tests report as skipped, with a reason, where Chromium
  is missing.

3. Measurement
- `benchmarks/<date>/` holds the raw per-call results for C1-C8, the
  Modelfiles, and the machine details.
- A report (`docs/decisions/phase-36-local-model-measurement-report.md`)
  gives each configuration's speed, memory fit and quality numbers, applies
  the Decision 7 rule, and names the winner or says C1 stays.
- Re-running the script reproduces the same set of measurements (the timings
  will vary; the set of measures must not).

## Regression Policy

- `TEST_PLAN.md` gets cases for: each resolved false failure; the new
  cookie/session check; "nothing to run"; browser-test skipping; and the
  benchmark's own quality checks (so a change to the gates or the category
  signal is caught). Each lands in the same commit as its code.
- Template output for areas not changed by a ticket stays byte-identical on
  fixed inputs, measured as in Phase 34.

## Related, deferred (not this phase)

- **Skills as rules TestForge uses at run time.** No skill under `skills/`
  is read by the app today. Whether some become runtime rules (for example
  `honest-coverage`'s "what a green run leaves unknown" in every report, or
  `dont-stub-what-you-prove` as a check on generated suites) is a product
  decision for Phase 35, not built here.
- **Proving the skills** (Martin's "skills tested against themselves"), and
  the Phase 29 drift fix, follow this phase.
- **Phase 35's decision record** is written after this phase's measurement,
  since what the local model can do shapes it.

## Backlog

Ticket numbers are estimates; TFP-122 was the last issued.

### TFP-123 — Resolve the four suspected false failures on the-internet

- **Phase:** 36 · **Priority:** P1 · **Labels:** `bug`, `generate`
- **Problem it solves:** a healthy site turns red, which erodes trust in
  every red result.
- **Scope:** Decision 1.
- **Deliverables:** Template fixes where needed; the labelled failure set;
  `TEST_PLAN.md` cases.
- **Acceptance criteria:** Acceptance Criteria 1.
- **Dependencies:** None.
- **Status:** Landed `7678490` (TEST_PLAN GEN-50). All four reproduced and read
  by hand; all four template errors, fixed. Live: functional 13/13, free-form
  28/33 (the 5 left are real SEO gaps). Labelled set:
  `docs/decisions/data/labelled-failures.md`. Independently verified and
  pushed 2026-09-30.

#### GEN-50 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** A healthy real site doesn't turn red on the template's own mistakes (TFP-123, Phase 36 Decision 1; unit: `src/lib/generate/mock/false-failures.test.ts` (real browser), `locators.test.ts`; live: the-internet.herokuapp.com; labelled set: `docs/decisions/data/labelled-failures.md`)

**Expected result:** Four failures on the-internet, each re-run and the page read by hand, each a template error. **TFFU-002** (sign-in control) visited `/`, a list of examples with no sign-in control; it now visits the first inspected page with one (a password field, or a Log in / Sign in button or link), and `/` only when none has. **TFFU-007, 010:** the GitHub ribbon is `<a><img style="position:absolute"></a>`, so the anchor itself has a 0x0 box and `a[href=...]:visible` never matched, while the image is on screen and the anchor is the first Tab stop. Link locators now match an anchor that renders itself or through its content (`:visible, :has(:visible)`), still skipping hidden copies; visibility checks and clicks use what renders the link (`link.or(link.locator('*')).filter({ visible: true })`); attribute checks and focus stay on the anchor. Not loosened: a link must still be on screen. **TFFU-015** (keyboard) had three layered causes, each found once the one before was fixed: the same locator; a race where Enter only starts a navigation and the next link was sought on the new site (now waits up to 5 s for the URL to change, then reloads the links page); and an http link the site upgrades to https by 301 (now compares host and path). **Live, 2026-09-30:** all four reproduced first (runs `15dbf0fd`, `04f40ce8`), then passed (functional 13/13, run `ae16b41c`; free-form 28/33, run `03bae90c`, the 5 left being real SEO gaps, TFP-124). **Output measured:** 240 of 264 fixed inputs byte-identical; the other 24 differ only by the link-locator edits and, in the 12 that include the keyboard test, its two edits (checked by undoing them). Not changed: the search-control test's `/` (nothing has failed there); `a[href]:visible` link counts.

### TFP-124 — Optional SEO items as findings

- **Phase:** 36 · **Priority:** P2 · **Labels:** `enhancement`, `generate`
- **Problem it solves:** a site without a web-app manifest or structured
  data fails SEO for things most sites don't need.
- **Scope:** Decision 2.
- **Deliverables:** SEO template change; tests; `TEST_PLAN.md` update.
- **Acceptance criteria:** Missing optional items appear as findings and
  don't fail the run; the three baseline checks still fail when missing.
- **Dependencies:** None.
- **Status:** Landed `960bc3d` (TEST_PLAN GEN-52). Live on the-internet: the two
  optional items pass with named findings, the three baseline gaps fail by
  name. Independently verified and pushed 2026-09-30. Found in it: test IDs
  restarted per suite, so two SEO suites both numbered a TFSE-001. Emil
  accepted a one-time renumbering; see the Gate A follow-ups.

#### GEN-52 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** Optional SEO items are findings; baseline SEO items fail, naming what is missing and where (TFP-124, Phase 36 Decision 2; unit: `src/lib/generate/mock/seo-findings.test.ts` (real browser); live: the-internet.herokuapp.com)

**Expected result:** Owner decision, 2026-09-29. **Findings, not failures:** a page with no structured data (no non-empty JSON-LD script) records "no structured data (JSON-LD) on <page>"; a site that links no web-app manifest records "no web-app manifest linked from /". Both use Playwright annotations, as the security header findings do (RPT-11), and both titles say "(recorded as a finding when missing)". A manifest the page does link to but that can't be fetched, or has no name, still fails: a broken reference isn't a missing optional item. **Still failures, now named:** "no meta description on <page>" (or "… is missing or no longer matches the inspected one"), "no canonical link on <page>", "the canonical link on <page> points to a different page", "/robots.txt has no Sitemap: line", "no /robots.txt (HTTP <status>)"; sitemap.xml keeps its verdict and gains the same kind of message. **Proven in a real browser:** a bare site gives the two findings and passes them, and fails the three baseline items; a complete site passes all five with no findings; a manifest link that 404s fails. **Live, 2026-09-30, the-internet:** 6/9, with TFSE-005 and TFSE-008 passing with their findings, and TFSE-002, 004 and 006 failing with "no meta description on /login", "no canonical link on /login", "/robots.txt has no Sitemap: line". **Output measured:** of 264 fixed inputs, 240 byte-identical; the 24 with page data and SEO in scope change only in these tests. **Found, not fixed:** test IDs restart per suite, so the landing-page SEO suite and the per-page SEO suite both have a TFSE-001.

#### GEN-53 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** No two tests in one generated file share an ID (Phase 36 Gate A follow-up; unit: `src/lib/generate/mock/test-ids.test.ts`)

**Expected result:** IDs are `TF<area code>-<nnn>`. Each suite used to begin at 001, so an area with two suites repeated IDs: the landing-page SEO suite and the per-page SEO suite both had a TFSE-001 (found in TFP-124). Suites that share an area code are now numbered on from each other (`renderSuites` in `mock/index.ts`). The owner accepted the one-time renumbering 2026-09-30. **What moves:** the per-page SEO suite's tests go up by one (old TFSE-001…008 are now TFSE-002…009); the TFSE IDs cited for the 2026-09-30 live run in GEN-52 and the labelled-failure set are the old numbers, and past records keep the numbers they were written with. The run diff matches tests by full title, so comparing a run from before this change with one after shows those SEO tests as removed and added, once. **Output measured:** of 264 fixed inputs, 24 had a duplicate ID before and 0 after; 240 are byte-identical; the 24 that change (every input with page data and SEO in scope) are identical once IDs are removed, and all 312 renumbered IDs are TFSE. **Unit:** with every area selected on a two-page profile, fast and deep, no ID repeats and the SEO IDs run 001, 002, … across both suites; the test fails on the previous code.

### TFP-125 — Small defects from the audit

- **Phase:** 36 · **Priority:** P2 · **Labels:** `bug`
- **Problem it solves:** a check that can't fail, a misleading "run failed",
  and unit tests that fail for the wrong reason.
- **Scope:** Decision 3.
- **Deliverables:** One commit per defect; tests; `TEST_PLAN.md` updates.
- **Acceptance criteria:** Acceptance Criteria 2.
- **Dependencies:** None.
- **Status:** Landed as one commit per defect: cookie/session `46476e6` (GEN-51),
  nothing to run `d86c8d1` (RPT-15), browser-test skipping `a7276c2` (TST-01);
  the spikes and the 3B Modelfile moved with TFP-126 (`142e937`).
  Independently verified and pushed 2026-09-30; two follow-ups from the
  verification are listed under Gate A.

#### GEN-51 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** The cookie/session test can fail (TFP-125, Phase 36 Decision 3; unit: `src/lib/generate/mock/cookie-session-checks.test.ts` (real browser); live: the-internet.herokuapp.com, comparison fixture)

**Expected result:** The old test asserted the browser's cookie list is an array, which is always true. It is removed, not kept beside the new one. After the landing page loads, the site's own session cookies are checked. A cookie counts as a session cookie by name (session, sess, sid, auth, token, jwt, JSESSIONID, PHPSESSID, connect.sid, rack.session, laravel_session), the stated rule, since TestForge can't tell session cookies apart for certain. **Fails** when one stays valid for more than 30 days, or is set for a parent domain (sent to every subdomain), naming the cookie and the problem. **Not run**, with the reason, when the site sets no session cookie on its landing page. **Proven in a real browser** (a local site served as app.site.test): a browser-session cookie and a 1-day one pass; a 400-day one fails as "stays valid for 400 days (more than 30)"; `Domain=site.test` fails as "set for .site.test, so every subdomain of site.test receives it"; a 2-year `_ga` cookie is ignored, so the test is Not run. **Live, 2026-09-30:** the-internet passes (`rack.session`, browser-session, host-only); the fixture sets no cookie, so Not run. **Output measured:** of 264 fixed inputs, 240 are byte-identical; the 24 cookie/session suites differ only by this test. **Shared with subdomains (Gate A follow-up, 2026-09-30):** a session cookie whose domain starts with "." for the site's own host (`Domain=app.site.test`) is sent to that host's subdomains too. It passes with the named finding 'session cookie "sid" is set for .app.site.test, so subdomains of app.site.test also receive it'; before, the leading dot was stripped and it passed silently. The parent-domain case still fails and records no finding. Both are proven in a real browser. Output measured: of 264 fixed inputs, 240 byte-identical; the 24 cookie/session suites gain only that line.

#### RPT-15 evidence

Moved word for word from [`docs/test-plan/RPT.md`](../test-plan/RPT.md) by TFP-253; the case's row there links here.

**Test:** A suite with nothing to run says so, and why, instead of "run failed" (TFP-125, Phase 36 Decision 3; unit: `src/lib/run/jobs.test.ts`; live: the-internet.herokuapp.com)

**Expected result:** When every area in scope turns out not applicable (e.g. database on a site whose only form is a sign-in), the template writes no test, only the note saying why. Playwright then reports "No tests found", and the run used to end as **failed** with no report. Now a suite that declares no `test(...)` and whose only error is "No tests found" ends with the new terminal status **empty**. It keeps its structured report: the recommendation reads "Nothing to run: the suite has no tests" (neutral badge, RPT-14), the output starts "Nothing to run: the generated suite has no tests." followed by each empty area's reasons, and "Areas with no tests" lists them. The progress line reads "Nothing to run". **Still failed:** a suite that declares tests yet ran none, and an empty suite with any other error (e.g. a syntax error). **Live, 2026-09-30:** the-internet with database only: 0 tests; status `empty`; the report names Database with "no form that saves visible text was found on the inspected pages".

#### TST-01 evidence

Moved word for word from [`docs/test-plan/TST.md`](../test-plan/TST.md) by TFP-253; the case's row there links here.

**Test:** Unit tests that need a real browser skip, with the reason, where Chromium isn't installed (TFP-125, Phase 36 Decision 3; `src/test-support/chromium.ts`)

**Expected result:** Ten unit tests drive a real Chromium: six launch it directly (accessible names, the per-type check, link locators, the image-link case, database field locators, session cookies), and four route tests make the route inspect a page. Where Playwright's Chromium isn't installed they failed, for a reason that had nothing to do with the code, as the Gate C verification sandbox showed. Each now passes node:test's `skip` option the reason from `chromiumSkipReason()`: "needs a real browser, and Playwright's Chromium is not installed (expected at <path>); install it with: npx playwright install chromium". The other tests in the same files still run. **Measured, 2026-09-30:** with `PLAYWRIGHT_BROWSERS_PATH` pointed at an empty folder, `npm run test:unit` gives 340 passed, 10 skipped with the reason, 0 failed; with Chromium installed, 350 passed, 0 skipped.

### TFP-126 — Build the local model benchmark

- **Phase:** 36 · **Priority:** P1 · **Labels:** `measurement`, `local`
- **Problem it solves:** the only model comparison is one run each, before
  any tuning, and it lives only in a decision record's prose.
- **Scope:** Decisions 4-6: the script, the Modelfiles, the measures. Test
  it on C1 alone first, and show the numbers from both endpoints agree
  before running the full matrix.
- **Deliverables:** `scripts/benchmark-local-models.mjs`; Modelfiles;
  unit tests for its quality checks; `TEST_PLAN.md` case; the spikes
  removed.
- **Acceptance criteria:** A C1-only run produces every Decision 6 measure.
- **Dependencies:** None.
- **Status:** Landed `142e937` (TEST_PLAN GEN-48); the C1-only run was
  independently verified 2026-09-29. C8 support and the `num_gpu` probe
  land with TFP-127. Verified as a whole and pushed 2026-09-30.

#### GEN-48 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** The local-model benchmark measures a configuration repeatably (TFP-126, Phase 36 Decisions 4-6; unit: `src/lib/generate/benchmark-quality.test.ts`; manual, on-demand: `npm run benchmark:local -- --config C1`, then `node scripts/benchmark-summary.mjs benchmarks/<date>/<config>`)

**Expected result:** **Real path, not a copy:** each fixture case's messages are built by `buildGapFillMessages` (moved out of the route; the route's chat bodies are byte-identical before and after, 36 requests captured) and sent through `generateLocalSuite`, the route's own call and gates. That function now also returns the model's token `usage`, and the raw `code` when a gate rejects it; the route ignores both. The same messages (`withLocalRules`) then go to Ollama's native `/api/chat` for its timings. **Quality checks (unit-tested):** both gates; at least one test; the area's category signal (performance measures time; SEO checks title and meta description; database fills and reloads; security sends a payload or checks the protocol; reliability uses `route()`; accessibility checks names or roles; functional interacts with the page, a trait TestForge defines because Decision 6 names none); no leaked example data; no duplicate titles. Each signal is tested present and absent. **Method findings from smoke runs:** a native call made straight after the identical OpenAI-compatible call reused Ollama's prompt cache (6202 tokens evaluated in 0.3 s). So each round makes every case's TestForge-path call, then every case's native call, and each call follows a different request. The cold numbers come from a native warm-up with the model unloaded first. Endpoints are compared per output token, since their outputs differ. Other GPU programs exclude Ollama's own runner. Saved suites are excluded from `tsc` and ESLint, since rejected ones must be kept as written. **Live, C1, 2026-09-29:** 21 of 21 prompt token counts identical across endpoints; rounds 2-3 agree within ~1% per output token, round 1 ran 5-33% slower on TestForge's path. Numbers are in `benchmarks/2026-09-29/C1/` and the Phase 36 measurement report.

### TFP-127 — Run the benchmark and choose the model

- **Phase:** 36 · **Priority:** P1 · **Labels:** `measurement`, `local`
- **Problem it solves:** Phase 35 needs to know what the local model can do
  on this machine.
- **Scope:** Decisions 5 and 7: pull the two approved models, run C1-C6 and C8,
  pick C7's base, run C7, apply the rule.
- **Deliverables:** `benchmarks/<date>/`; the measurement report;
  `docs/LOCAL_MODEL_SETUP.md` updated if a new configuration wins.
- **Acceptance criteria:** Acceptance Criteria 3.
- **Dependencies:** TFP-126.
- **Correction:** `061a5b9`. The benchmark ran model suites without the base
  URL TestForge gives them; the 5 affected suites (C3, C6) were re-run. C3
  now also qualifies; the choice (C8) is unchanged. The report says so.
- **Status:** Run 2026-09-29/30 (TEST_PLAN GEN-49). C2-C8 measured, plus a
  back-to-back confirmation of C1 and the winner requested by Emil. Winner:
  C8 (`num_gpu 29`), adopted in `ollama/Modelfile.testforge-qwen7b` and
  `docs/LOCAL_MODEL_SETUP.md`. Report:
  `phase-36-local-model-measurement-report.md`. Independently verified and
  pushed 2026-09-30, the correction included (reproduced: C3 19 clean
  passes, 15/18; C6 12; C8 stays).
- **Phase 33 category bar on C8:** run 2026-09-30 (GEN-54). Performance,
  SEO, security and accessibility 3/3; reliability 1/3, database 1/3,
  functional 0/3 without a guessed destination. Recorded in the report;
  awaiting verification.

#### GEN-49 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** The local model configuration is chosen by measurement (TFP-127, Phase 36 Decisions 5 and 7, amended 2026-09-29; manual: `npm run benchmark:local`; report: `docs/decisions/phase-36-local-model-measurement-report.md`)

**Expected result:** Eight configurations, 21 suites each, on the reference machine (RTX 2050, 4 GB): C1 today's model; C2 same at context 12288; C3 7B q3_K_M; C4 3B; C5 qwen3.5 4B; C6 llama3.1 8B; C8 C1 with `num_gpu` raised; C7 the best qualifier with flash attention and a q8_0 KV cache. C8's `num_gpu` was found by stepping it from 12 to 29 and recording each load: every value loaded; from 22 the VRAM is full and the driver overflows into system memory, so 29 was used. Decision 7's bar (no more than 1 worse than C1 on gates, signal, clean passes and detections; no more timeouts): **C8 qualifies and is the fastest**, median 39.5 s against C1's 68.2 s with equal or better quality. C2 misses on clean passes (18 against 20), C4 on gates (16), C5 on timeouts (16; it reasons before answering), C6 on everything, C7 on gates (19) and speed (92.8 s). **Corrected 2026-09-30:** the benchmark had run model suites without the `test.use({ baseURL })` TestForge's merged suite gives them, so suites with relative URLs failed on "Cannot navigate to invalid URL" (C3: 3, C6: 2). Re-run with the base URL, no new model calls: C3 has 19 clean passes, not 17, and **also qualifies**, at 56.9 s; C6 still doesn't. The choice (C8) is unchanged. The benchmark now adds the base URL (`withBaseUrl`, unit-tested). **Confirmation run** (the owner's request, since applications were closed during C5): C1 and C8 back to back gave 65.5 s and 39.4 s, clean passes 18 and 21. C1's own clean passes moved from 20 to 18 between identical runs, the size of the bar, which the report states. Adopted: `ollama/Modelfile.testforge-qwen7b` gains `num_gpu 29`; `docs/LOCAL_MODEL_SETUP.md` explains it. **Still owed:** the Phase 33 category bar on C8 before Phase 35 relies on it.

## Recommended Execution Order

1. TFP-126 (build the benchmark, then test it on C1), then TFP-127. This is
   the longest step, so start it first. The runs take roughly two hours of
   machine time, and nothing else should use the GPU while they run.
2. TFP-123 and TFP-125, while the benchmark is not running.
3. TFP-124 after TFP-123 and TFP-125.

## Suggested Milestone Gate

### Gate A — Trust fixes landed and the model measured
**Verified independently and pushed 2026-09-30** (`7678490`, `061a5b9`,
`46476e6`, `d86c8d1`, `a7276c2`, `960bc3d`, `25ae0cc`; TFP-126 and TFP-127
earlier the same day). The Phase 33 per-category check on C8, owed before
Phase 35, ran 2026-09-30 (GEN-54); three categories fall short. See the
measurement report. Awaiting verification.

Follow-ups from the verification, one commit each, verified independently
and pushed 2026-09-30 with the record update `fe834d3` (jobs.test.ts 6/6 on
Node 22; duplicate test IDs 4 -> 0 on inputs with page data; only the
intended lines change). Phase 36 is complete.
- `a264f46` (GEN-51): a session cookie whose domain starts with "." for the
  site's own host is shared with its subdomains. It passes with a named
  finding; the parent-domain case still fails. Before, it passed silently.
- `199900b`: the three TFP-125 tests in `jobs.test.ts` failed on Node 22
  with ENOENT. `jobFilesRoot` is now created with `mkdirSync` at load, as
  asked, but that alone did not fix it: on Node 22 the file's `after()` ran
  during a top-level `await import` between tests and removed the scratch
  folder. The imports moved above the first test. Unit suite 354/354 on
  Node 22.
- `66204b9` (GEN-53): suites sharing an area code are numbered on from each
  other, so no two tests in one generated file share an ID. Only the
  per-page SEO suite moves (TFSE-001…008 become 002…009); past records keep
  the old numbers.

- TFP-123 to 127 landed and independently verified; the measurement report
  names the chosen configuration or says C1 stays; no suspected false
  failure is left unresolved.
