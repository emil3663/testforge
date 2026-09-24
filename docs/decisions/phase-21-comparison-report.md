# Phase 21 Comparison Report — Template Generator vs. Local Model

Date: 2026-09-24
Ticket: TFP-099 (Phase 21, retargeted — see the Amendment in
`phase-21-ai-assisted-generation-decision-record.md`)
Compared: TestForge's deterministic template generator vs. `testforge-qwen7b`
(`qwen2.5-coder:7b` via Ollama, with the Phase 31-33 local rules), on
Emil's machine (RTX 2050, 4GB VRAM).
How to reproduce: `docs/GENERATOR_COMPARISON.md` (TFP-098).

## Bottom line

The two generators are good at different things. The local model does **not**
replace the template generator, and the template generator doesn't make the
local model redundant.

- **Where the template generator writes tests, it writes far more of them, instantly.**
  Functional: 31 tests vs. 1. SEO: 19 vs. 3. Generation takes 1-11 ms against
  a median of 67 s (41-149 s) for the local model, and 2 of 16 local
  generations hit the 180 s timeout and fell back.
- **For the requests in this comparison, the template generator wrote no
  executable tests at all for performance, database or security.** It left
  "manual follow-up" comments only. For each of those areas the local model
  wrote real tests, and on the fixture each of them caught the injected defect.
- **Defect detection on the fixture: local 6/6, template 2/6.** But 3 of the
  template's misses are "no tests to detect with", and the fixture and its
  defects were designed by the same session that wrote the local model's
  examples. Read the caveats before quoting this number.
- **On an untuned real site (the-internet.herokuapp.com),** the template found
  more real problems (5 SEO gaps against 2), and each generator produced 2-3
  false failures from wrong assumptions about the page.

## Method

- **One command per target** (`npm run compare:generators`). Both generators
  get the same request and the same introspection data. Both generate through
  the real `/api/generate` handler. Both suites run through TestForge's
  `/api/run` and are persisted, and the clean pair is diffed with Phase 17's
  `/api/runs/diff` (Decision 2).
- **Targets.**
  - `scripts/comparison-fixture.mjs`: a local site with one switchable
    injected defect per area. A generator *detects* a defect when one of its
    tests passes on the clean site and fails with the defect on.
  - `https://the-internet.herokuapp.com/login`: public, tuned for neither
    generator, and without defects, so detection is reported as skipped there.
- **One case per area,** worded the way Phases 31-33 measured the local model.
  **One sample per case.** These are observations, not rates.
- **Which run each case comes from.** Three fixture batches were run. Each
  case is taken from its valid run:
  - Batch 1 had two local timeouts (functional, SEO). Those cases were re-run
    in batch 3, and the timeouts are counted in the latency figures.
  - Batch 2's database result is void: a fixture bug hid the defect from any
    save-reload test. The bug was fixed and the case re-run in batch 3.

## How each dimension is scored (Decision 4)

| Dimension | Scored as | Can it be computed? |
| --- | --- | --- |
| Coverage delta | The run report's coverage per area, **and** a title-independent proxy: how many distinct discovered elements the suite's code names | Partly. For functional, accessibility and reliability, the run report credits an element only to a test titled the template generator's way, so the local model scores ~0% there by construction. That figure is shown but not used to judge the local model. The proxy stands in for it. For the other areas the run report uses pass rate. |
| Pass/fail agreement | Per area: do both generators' suites all pass, or do both have failures? | Yes, per area. Not per test: the two never share a test title (0 shared in every case), so Phase 17's title-level diff lists each passing suite whole. |
| Defect detection | Passes clean and fails with the defect on | On the fixture only. The real site has no known injected defect, so it is **skipped** there, not guessed. |
| Latency and cost | Generation and run wall time. Cost is $0 for both (no API). | Yes. Cost would differentiate only against a paid API, which Phase 21 does not use. |

## Results by area, fixture

| Area | Tests written (template / local) | Clean pass (template / local) | Injected defect | Detected by template | Detected by local | Local generation |
| --- | --- | --- | --- | --- | --- | --- |
| Functional | 31 / 1 | 31/31 / 1/1 | none | — | — | 57 s |
| Accessibility | 5 / 3 | 5/5 / 3/3 | email field loses its label | no (tested the home page's links only) | **yes** | 77 s |
| SEO | 19 / 3 | 10/19 / 3/3 | no meta description | **yes** | **yes** | 62 s |
| Performance | **0** / 2 | — / 2/2 | 4 s responses | no tests | **yes** (both tests) | 68 s |
| Database | **0** / 1 | — / 1/1 | note gone after reload | no tests | **yes** | 44 s |
| Security | **0** / 3 | — / 2/2 (+1 correctly skipped: HTTPS on an http site) | note rendered as raw HTML | no tests | **yes** (script-injection test) | 123 s |
| Reliability | 2 / 3 | 1/2 / 3/3 | uncaught error when the API fails | **yes** | **yes** | 149 s |

The template's clean-run failures are real in part and false in part:
- **SEO, 9/19 fail, and these are real.** The fixture genuinely has no
  canonical link, structured data, robots.txt, sitemap or manifest. The
  template's SEO checks go further than the local model's 3.
- **Reliability, 1/2 fails, and this is a false failure.** Blocking the
  `/login` form action also blocks the page's own navigation to `/login`.

## Results by area, real site (the-internet.herokuapp.com)

| Case | Tests written (template / local) | Clean pass (template / local) | Real findings | False failures |
| --- | --- | --- | --- | --- |
| Functional | 13 / 2 | 10/13 / 2/2 | none | template 3: a hidden GitHub link asserted visible (2), a sign-in locator miss |
| Accessibility | 1 / 3 | 1/1 / 2/3 | none | local 1: exact accessible name "Login" vs. the page's " Login" |
| SEO | 9 / 3 | 4/9 / 1/3 | template 5 (no meta description, canonical, structured data, sitemap reference, manifest); local 2 (no meta description, no `h1`) | none |
| Security | 1 / 3 | 1/1 / 3/3 | none | none |
| Free-form ("logging in with the wrong password shows an error, and the page is accessible") | 32 / 2 | 23/32 / 1/2 | template: the same 5 SEO gaps | template: the same 3, plus a keyboard-navigation timeout; local 1: a guessed `form` role name |

Element-reference proxy on the real site (5 named elements): template 0-4,
local 0-5 per case. On the free-form request the local suite named all 5 and
the template 4.

## Caveats (read before quoting any number above)

1. **The fixture favours the local model's examples.** Its defects were
   written after the Phase 31-33 worked examples, and two line up closely
   with what those examples check: an unlabelled sign-in field for
   accessibility, and a timing budget for performance. The local
   accessibility suite *is* the example with the URL substituted. Detection
   on those two shows that the examples work as intended, not that the model
   reasons about accessibility or performance better than the template.
2. **"Template: no tests" is about these requests.** For the performance,
   database and security cases, the template produced suites with manual
   follow-up comments and zero `test(...)` calls. This comparison did not
   establish whether other wording or inputs change that.
3. **Reliability (Phase 33, GEN-32 ⚠️).** On this fixture the local
   reliability suite was sound: three distinct failures, and it detected the
   defect. Phase 33 recorded that on a sign-in-page request the model often
   names reliability tests after the page's inputs and duplicates them. That
   weakness still stands; this single sample doesn't lift it.
4. **One sample per case.** The local model varies run to run (Phase 33 saw
   it). Treat each cell as one observation.
5. **Latency is this machine.** On a 4GB-VRAM GPU the 7B model partly runs
   on the CPU, and larger introspection data (30 KB for the fixture's 3
   pages) makes generation slower and, twice here, too slow.
6. **"Detected" means a test failed.** It doesn't mean the failure message
   explains the defect well. Both generators' failure messages were read for
   the cases above.

## What this is enough to decide (input to TFP-100)

- Replacing the template generator with the local model would lose most of
  the functional and SEO breadth and add a minute or more per suite. The data
  does not support it.
- Performance, database and security are covered only by the local model
  here. It caught all three injected defects there, and on the real site its
  security suite passed cleanly.
- The current exposure is all or nothing: `TESTFORGE_OLLAMA_MODEL` set means
  every generation uses the local model (Phase 30, Decision 5). The results
  point toward a shape where the local model adds to the template generator
  rather than replacing it. That is TFP-100's decision, not this report's.

## Full per-case results

Generated by `node scripts/comparison-report.mjs` from the raw runs (kept
locally in `comparisons/`, gitignored), unedited.

### fixture: http://127.0.0.1:4410 (cases: functional, seo, database)

Local model `testforge-qwen7b`, TestForge http://127.0.0.1:3100, finished 2026-09-24T16:47:12.171Z. Source: `comparisons/2026-09-24T16-42-31-599Z-fixture/`.
Distinct discovered elements with a usable name, by type and name across all pages (for the reference proxy): 11.

#### functional

Request: "Check the sign-in page: the email and password fields accept input and the Sign in button submits the form." - areas: functional.

| | Deterministic | Local |
| --- | --- | --- |
| Generation | 11 ms | 57.3 s (ollama) |
| Clean run | 8.1 s, 31/31 passed | 4.1 s, 1/1 passed |
| Cost | $0 (no model) | $0 (local, no API) |
| Coverage as the run report computes it (functional, accessibility, reliability: discovered elements, credited only to tests titled the template generator's way - so model-written tests score ~0% there by construction; other areas: pass rate) | Functional 100% | Functional 0% |
| Discovered elements referenced in the suite (title-independent proxy) | 11/11 | 4/11 |
| Pass/fail by area (clean) | Functional 31/31 | Functional 1/1 |
| Pass/fail agreement | Functional: agree (all pass vs all pass) | |
| Defect detection | skipped: no injected defect for this case | same |

Phase 17 diff: 31 test(s) pass only in the deterministic run and 1 only in the local run; the suites share 0 test title(s), so this lists each passing suite whole rather than any disagreement.

#### seo

Request: "Check the Acme Notes home page for SEO/content coverage." - areas: seo/content - injected defect: `seo-missing-meta`.

| | Deterministic | Local |
| --- | --- | --- |
| Generation | 2 ms | 62.3 s (ollama) |
| Clean run | 34.2 s, 10/19 passed | 4.1 s, 3/3 passed |
| Cost | $0 (no model) | $0 (local, no API) |
| Coverage as the run report computes it (functional, accessibility, reliability: discovered elements, credited only to tests titled the template generator's way - so model-written tests score ~0% there by construction; other areas: pass rate) | SEO 53% | SEO 100% |
| Discovered elements referenced in the suite (title-independent proxy) | 3/11 | 0/11 |
| Pass/fail by area (clean) | SEO 10/19 | SEO 3/3 |
| Pass/fail agreement | SEO: disagree (failures vs all pass) | |
| Defect detection (`seo-missing-meta`) | **detected** by 1 test(s): "TFSE-002: keeps meta description stable for /" | **detected** by 1 test(s): "page has a meta description" |

Phase 17 diff: 10 test(s) pass only in the deterministic run and 3 only in the local run; the suites share 0 test title(s), so this lists each passing suite whole rather than any disagreement.

#### database

Request: "Check the notes page form (Note field, Save note button) for database coverage." - areas: database - injected defect: `database-notes-not-saved`.

| | Deterministic | Local |
| --- | --- | --- |
| Generation | 2 ms | 43.9 s (ollama) |
| Clean run | no report (run failed); the suite has 0 test(s) | 4.1 s, 1/1 passed |
| Cost | $0 (no model) | $0 (local, no API) |
| Coverage as the run report computes it (functional, accessibility, reliability: discovered elements, credited only to tests titled the template generator's way - so model-written tests score ~0% there by construction; other areas: pass rate) | n/a | Database 100% |
| Discovered elements referenced in the suite (title-independent proxy) | 0/11 | 2/11 |
| Pass/fail by area (clean) | Database - | Database 1/1 |
| Pass/fail agreement | Database: only one generator tested it | |
| Defect detection (`database-notes-not-saved`) | nothing to detect with: the suite has no tests | **detected** by 1 test(s): "a new note is still shown after reloading the page" |

Phase 17 diff: 0 test(s) pass only in the deterministic run and 1 only in the local run; the suites share 0 test title(s), so this lists each passing suite whole rather than any disagreement.

### fixture: http://127.0.0.1:4410 (cases: accessibility, performance)

Local model `testforge-qwen7b`, TestForge http://127.0.0.1:3100, finished 2026-09-24T16:34:16.796Z. Source: `comparisons/2026-09-24T16-23-42-468Z-fixture/`.
Distinct discovered elements with a usable name, by type and name across all pages (for the reference proxy): 11.

#### accessibility

Request: "Check the sign-in page (email and password fields, Sign in button) for accessibility coverage." - areas: accessibility - injected defect: `a11y-unlabelled-field`.

| | Deterministic | Local |
| --- | --- | --- |
| Generation | 5 ms | 77.3 s (ollama) |
| Clean run | 4.1 s, 5/5 passed | 4.1 s, 3/3 passed |
| Cost | $0 (no model) | $0 (local, no API) |
| Coverage as the run report computes it (functional, accessibility, reliability: discovered elements, credited only to tests titled the template generator's way - so model-written tests score ~0% there by construction; other areas: pass rate) | Accessibility 59% | Accessibility 0% |
| Discovered elements referenced in the suite (title-independent proxy) | 5/11 | 4/11 |
| Pass/fail by area (clean) | Accessibility 5/5 | Accessibility 3/3 |
| Pass/fail agreement | Accessibility: agree (all pass vs all pass) | |
| Defect detection (`a11y-unlabelled-field`) | not detected | **detected** by 1 test(s): "Email field is labelled and reachable by keyboard" |

Phase 17 diff: 5 test(s) pass only in the deterministic run and 3 only in the local run; the suites share 0 test title(s), so this lists each passing suite whole rather than any disagreement.

#### performance

Request: "Check the Acme Notes home page for performance/load coverage." - areas: performance/load - injected defect: `performance-slow`.

| | Deterministic | Local |
| --- | --- | --- |
| Generation | 2 ms | 67.6 s (ollama) |
| Clean run | no report (run failed); the suite has 0 test(s) | 4.0 s, 2/2 passed |
| Cost | $0 (no model) | $0 (local, no API) |
| Coverage as the run report computes it (functional, accessibility, reliability: discovered elements, credited only to tests titled the template generator's way - so model-written tests score ~0% there by construction; other areas: pass rate) | n/a | Performance 100% |
| Discovered elements referenced in the suite (title-independent proxy) | 0/11 | 0/11 |
| Pass/fail by area (clean) | Performance - | Performance 2/2 |
| Pass/fail agreement | Performance: only one generator tested it | |
| Defect detection (`performance-slow`) | nothing to detect with: the suite has no tests | **detected** by 2 test(s): "home page finishes loading within 3 seconds", "server responds and the page is ready quickly" |

Phase 17 diff: 0 test(s) pass only in the deterministic run and 2 only in the local run; the suites share 0 test title(s), so this lists each passing suite whole rather than any disagreement.

### fixture: http://127.0.0.1:4410 (cases: security, reliability)

Local model `testforge-qwen7b`, TestForge http://127.0.0.1:3100, finished 2026-09-24T16:41:28.886Z. Source: `comparisons/2026-09-24T16-35-08-787Z-fixture/`.
Distinct discovered elements with a usable name, by type and name across all pages (for the reference proxy): 11.

#### security

Request: "Check the notes page form (Note field, Save note button) for security coverage." - areas: security - injected defect: `security-unescaped-note`.

| | Deterministic | Local |
| --- | --- | --- |
| Generation | 6 ms | 123.0 s (ollama) |
| Clean run | no report (run failed); the suite has 0 test(s) | 8.1 s, 2/2 passed |
| Cost | $0 (no model) | $0 (local, no API) |
| Coverage as the run report computes it (functional, accessibility, reliability: discovered elements, credited only to tests titled the template generator's way - so model-written tests score ~0% there by construction; other areas: pass rate) | n/a | Security 67% |
| Discovered elements referenced in the suite (title-independent proxy) | 0/11 | 2/11 |
| Pass/fail by area (clean) | Security - | Security 2/2 (+1 skipped) |
| Pass/fail agreement | Security: only one generator tested it | |
| Defect detection (`security-unescaped-note`) | nothing to detect with: the suite has no tests | **detected** by 1 test(s): "input that looks like a script is not executed" |

Phase 17 diff: 0 test(s) pass only in the deterministic run and 2 only in the local run; the suites share 0 test title(s), so this lists each passing suite whole rather than any disagreement.

#### reliability

Request: "Check the Acme Notes home page for reliability coverage." - areas: reliability - injected defect: `reliability-api-crash`.

| | Deterministic | Local |
| --- | --- | --- |
| Generation | 4 ms | 148.9 s (ollama) |
| Clean run | 8.1 s, 1/2 passed | 4.1 s, 3/3 passed |
| Cost | $0 (no model) | $0 (local, no API) |
| Coverage as the run report computes it (functional, accessibility, reliability: discovered elements, credited only to tests titled the template generator's way - so model-written tests score ~0% there by construction; other areas: pass rate) | Reliability 100% | Reliability 0% |
| Discovered elements referenced in the suite (title-independent proxy) | 0/11 | 0/11 |
| Pass/fail by area (clean) | Reliability 1/2 | Reliability 3/3 |
| Pass/fail agreement | Reliability: disagree (failures vs all pass) | |
| Defect detection (`reliability-api-crash`) | **detected** by 1 test(s): "TFRL-001: dependency failure injection: 127.0.0.1:4410 [xhr-fetch]" | **detected** by 1 test(s): "page still works when its API requests fail" |

Phase 17 diff: 1 test(s) pass only in the deterministic run and 3 only in the local run; the suites share 0 test title(s), so this lists each passing suite whole rather than any disagreement.

### the-internet: https://the-internet.herokuapp.com

Local model `testforge-qwen7b`, TestForge http://127.0.0.1:3100, finished 2026-09-24T16:59:16.823Z. Source: `comparisons/2026-09-24T16-47-24-029Z-the-internet/`.
Distinct discovered elements with a usable name, by type and name across all pages (for the reference proxy): 5.

#### functional

Request: "Check the login page: the username and password fields accept input and the Login button submits the form." - areas: functional.

| | Deterministic | Local |
| --- | --- | --- |
| Generation | 9 ms | 72.6 s (ollama) |
| Clean run | 60.4 s, 10/13 passed | 10.1 s, 2/2 passed |
| Cost | $0 (no model) | $0 (local, no API) |
| Coverage as the run report computes it (functional, accessibility, reliability: discovered elements, credited only to tests titled the template generator's way - so model-written tests score ~0% there by construction; other areas: pass rate) | Functional 100% | Functional 0% |
| Discovered elements referenced in the suite (title-independent proxy) | 4/5 | 3/5 |
| Pass/fail by area (clean) | Functional 10/13 | Functional 2/2 |
| Pass/fail agreement | Functional: disagree (failures vs all pass) | |
| Defect detection | skipped: no injected defect for this case (not the comparison fixture) | same |

Phase 17 diff: 10 test(s) pass only in the deterministic run and 2 only in the local run; the suites share 0 test title(s), so this lists each passing suite whole rather than any disagreement.

#### accessibility

Request: "Check the login page (username and password fields, Login button) for accessibility coverage." - areas: accessibility.

| | Deterministic | Local |
| --- | --- | --- |
| Generation | 2 ms | 55.5 s (ollama) |
| Clean run | 6.1 s, 1/1 passed | 18.2 s, 2/3 passed |
| Cost | $0 (no model) | $0 (local, no API) |
| Coverage as the run report computes it (functional, accessibility, reliability: discovered elements, credited only to tests titled the template generator's way - so model-written tests score ~0% there by construction; other areas: pass rate) | Accessibility 0% | Accessibility 0% |
| Discovered elements referenced in the suite (title-independent proxy) | 0/5 | 3/5 |
| Pass/fail by area (clean) | Accessibility 1/1 | Accessibility 2/3 |
| Pass/fail agreement | Accessibility: disagree (all pass vs failures) | |
| Defect detection | skipped: no injected defect for this case (not the comparison fixture) | same |

Local clean-run failures: "Login button has an accessible role and name" (Error: expect(locator).toHaveAccessibleName(expected) failed Locator: getByRole('button', { name: 'Login' }) Expected: "Login" Received: " )

Phase 17 diff: 1 test(s) pass only in the deterministic run and 2 only in the local run; the suites share 0 test title(s), so this lists each passing suite whole rather than any disagreement.

#### seo

Request: "Check the login page for SEO/content coverage." - areas: seo/content.

| | Deterministic | Local |
| --- | --- | --- |
| Generation | 1 ms | 41.5 s (ollama) |
| Clean run | 46.4 s, 4/9 passed | 24.2 s, 1/3 passed |
| Cost | $0 (no model) | $0 (local, no API) |
| Coverage as the run report computes it (functional, accessibility, reliability: discovered elements, credited only to tests titled the template generator's way - so model-written tests score ~0% there by construction; other areas: pass rate) | SEO 44% | SEO 33% |
| Discovered elements referenced in the suite (title-independent proxy) | 0/5 | 0/5 |
| Pass/fail by area (clean) | SEO 4/9 | SEO 1/3 |
| Pass/fail agreement | SEO: agree (failures vs failures) | |
| Defect detection | skipped: no injected defect for this case (not the comparison fixture) | same |

Local clean-run failures: "page has a meta description" (Error: expect(locator).toHaveAttribute(expected) failed Locator: locator('meta[name="description"]') Expected: "" Timeout: 5000ms Error: ele); "page has exactly one main heading" (Error: expect(locator).toHaveCount(expected) failed Locator: getByRole('heading', { level: 1 }) Expected: 1 Received: 0 Timeout: 5000ms Call)

Phase 17 diff: 4 test(s) pass only in the deterministic run and 1 only in the local run; the suites share 0 test title(s), so this lists each passing suite whole rather than any disagreement.

#### security

Request: "Check the login page (username and password fields, Login button) for security coverage." - areas: security.

| | Deterministic | Local |
| --- | --- | --- |
| Generation | 2 ms | 75.9 s (ollama) |
| Clean run | 6.1 s, 1/1 passed | 14.2 s, 3/3 passed |
| Cost | $0 (no model) | $0 (local, no API) |
| Coverage as the run report computes it (functional, accessibility, reliability: discovered elements, credited only to tests titled the template generator's way - so model-written tests score ~0% there by construction; other areas: pass rate) | Security 100% | Security 100% |
| Discovered elements referenced in the suite (title-independent proxy) | 0/5 | 3/5 |
| Pass/fail by area (clean) | Security 1/1 | Security 3/3 |
| Pass/fail agreement | Security: agree (all pass vs all pass) | |
| Defect detection | skipped: no injected defect for this case (not the comparison fixture) | same |

Phase 17 diff: 1 test(s) pass only in the deterministic run and 3 only in the local run; the suites share 0 test title(s), so this lists each passing suite whole rather than any disagreement.

#### free-form

Request: "Check the login page: logging in with the wrong password shows an error, and the page is accessible." - areas: inferred.

| | Deterministic | Local |
| --- | --- | --- |
| Generation | 7 ms | 85.4 s (ollama) |
| Clean run | 173.4 s, 23/32 passed | 16.1 s, 1/2 passed |
| Cost | $0 (no model) | $0 (local, no API) |
| Coverage as the run report computes it (functional, accessibility, reliability: discovered elements, credited only to tests titled the template generator's way - so model-written tests score ~0% there by construction; other areas: pass rate) | Functional 76%, Usability 100%, Responsive 100%, Accessibility 100%, SEO 44%, Reliability 100%, Cookies 100% | Functional 50% |
| Discovered elements referenced in the suite (title-independent proxy) | 4/5 | 5/5 |
| Pass/fail by area (clean) | Functional 13/17, Usability 1/1, Responsive 1/1, Accessibility 1/1, SEO 4/9, Reliability 2/2, Cookies 1/1 | Functional 1/2, Usability -, Responsive -, Accessibility -, SEO -, Reliability -, Cookies - |
| Pass/fail agreement | Functional: agree (failures vs failures); Usability: only one generator tested it; Responsive: only one generator tested it; Accessibility: only one generator tested it; SEO: only one generator tested it; Reliability: only one generator tested it; Cookies: only one generator tested it | |
| Defect detection | skipped: no injected defect for this case (not the comparison fixture) | same |

Local clean-run failures: "page is accessible" (Error: expect(locator).toBeVisible() failed Locator: getByRole('form', { name: 'Username Password Login' }) Expected: visible Timeout: 5000m)

Phase 17 diff: 23 test(s) pass only in the deterministic run and 1 only in the local run; the suites share 0 test title(s), so this lists each passing suite whole rather than any disagreement.

