# Phase 36 Decision Record — Trust in Results, and Measuring the Local Model

Date: 2026-09-29
Scope: Fix what makes a healthy real site turn red, clean up the small
defects the 2026-09-29 status audit found, and measure which local model and
settings work best on Emil's machine before Phase 35 relies on the model.
Status: Approved (Emil, 2026-09-29, from the TestForge Status Audit's
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
| C7 | Best of C2-C6 on the Decision 7 rule | as chosen | N | With `OLLAMA_FLASH_ATTENTION=1` and `OLLAMA_KV_CACHE_TYPE=q8_0` |

- **N** is set from C1's measured prompt sizes: the smallest of 4096, 6144
  and 8192 that holds the largest measured prompt plus `num_predict`. It is
  never set so low that a prompt is cut off. A cut-off prompt makes a run
  invalid, not a failure.
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
- `benchmarks/<date>/` holds the raw per-call results for C1-C7, the
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

### TFP-124 — Optional SEO items as findings

- **Phase:** 36 · **Priority:** P2 · **Labels:** `enhancement`, `generate`
- **Problem it solves:** a site without a web-app manifest or structured
  data fails SEO for things most sites don't need.
- **Scope:** Decision 2.
- **Deliverables:** SEO template change; tests; `TEST_PLAN.md` update.
- **Acceptance criteria:** Missing optional items appear as findings and
  don't fail the run; the three baseline checks still fail when missing.
- **Dependencies:** None.

### TFP-125 — Small defects from the audit

- **Phase:** 36 · **Priority:** P2 · **Labels:** `bug`
- **Problem it solves:** a check that can't fail, a misleading "run failed",
  and unit tests that fail for the wrong reason.
- **Scope:** Decision 3.
- **Deliverables:** One commit per defect; tests; `TEST_PLAN.md` updates.
- **Acceptance criteria:** Acceptance Criteria 2.
- **Dependencies:** None.

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

### TFP-127 — Run the benchmark and choose the model

- **Phase:** 36 · **Priority:** P1 · **Labels:** `measurement`, `local`
- **Problem it solves:** Phase 35 needs to know what the local model can do
  on this machine.
- **Scope:** Decisions 5 and 7: pull the two approved models, run C1-C6,
  pick C7's base, run C7, apply the rule.
- **Deliverables:** `benchmarks/<date>/`; the measurement report;
  `docs/LOCAL_MODEL_SETUP.md` updated if a new configuration wins.
- **Acceptance criteria:** Acceptance Criteria 3.
- **Dependencies:** TFP-126.

## Recommended Execution Order

1. TFP-126 (build the benchmark, then test it on C1), then TFP-127. This is
   the longest step, so start it first. The runs take roughly two hours of
   machine time, and nothing else should use the GPU while they run.
2. TFP-123 and TFP-125, while the benchmark is not running.
3. TFP-124 after TFP-123 and TFP-125.

## Suggested Milestone Gate

### Gate A — Trust fixes landed and the model measured
- TFP-123 to 127 landed and independently verified; the measurement report
  names the chosen configuration or says C1 stays; no suspected false
  failure is left unresolved.
