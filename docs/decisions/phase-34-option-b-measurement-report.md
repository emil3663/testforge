# Phase 34 Measurement Report — Option B as Built

Date: 2026-09-28
Ticket: TFP-120 (Phase 34, Decision 9)
Compared: the template generator alone vs. the template plus the local
model's gap-fill (Option B, TFP-118 with its GEN-43 follow-up), using
`testforge-qwen7b` (`qwen2.5-coder:7b` via Ollama) on Emil's machine.
How to reproduce: `docs/GENERATOR_COMPARISON.md`.
Previous comparison (replace mode, before Phase 34):
`phase-21-comparison-report.md`.

## Bottom line

**With page data, gap-filling never calls the model on either target.** The
Phase 34 templates cover every area on both sites, or report the area not
applicable. As the record expected after the GEN-43 amendments, the template
closed the gaps Option B was built to fill.

- **Gap sweep, 40 probes** (10 areas × 2 targets × with and without page
  data), through the real route's own gap detection: **0 gaps with page
  data.** Without page data, the only gap is database, on both targets,
  because the template can't look for a form that saves anything.
- **17 comparison cases** (9 fixture, 8 the-internet). In **15**, gap-fill
  made no local call, and its suite was the template's, byte for byte.
  Generation took 1-7 ms either way.
- **The 2 cases where the model was called** are the two built for it:
  database with no page data. On the fixture its test passed clean and
  **caught** `database-notes-not-saved` (25 s to generate). On
  the-internet it **failed on the healthy site** (46 s): it typed a
  username and password into the login form, submitted, reloaded, and
  expected the fields to still hold the values. A sign-in form doesn't save
  what you type, so that's a false failure. It's the same invented flow
  GEN-43 recorded and the GEN-44 amendment prevents when page data exists.
  All four gates passed it, because they check that the code is valid, not
  what the test assumes.
- **Both results repeated** in a second full run of both targets
  (first-pass artefacts: `comparisons/2026-09-28T20-04-33-215Z-fixture`,
  `comparisons/2026-09-28T20-08-32-878Z-the-internet`). The tables below
  come from the second run.
- **Recommendation: a UI control for gap-filling isn't justified** (Decision
  9). See "Decision 9 outcome" below.

## Method

- **One command per target** (`npm run compare:generators`), re-targeted in
  TFP-120 at Option B. Both sides get the same request and the same
  introspection data and generate through the real `/api/generate` handler.
  The template side has `TESTFORGE_OLLAMA_MODEL` cleared; the gap-fill side
  has it set, exactly as the route decides at runtime.
- **Suites run through `/api/run` and are saved like any run,** now with the
  generation record (gap-fill outcome and every gate verdict, Decision 8).
  A gap-fill suite that added nothing is checked to be byte-identical to the
  template's. It is **not run again**, because running the same suite twice
  compares nothing, and the report says so per case.
- **The gap sweep** asks for each area alone, with and without the target's
  page data, through the real route with the local model pointed at a closed
  port. The route's own `findGapAreas` decides and no model is called.
  Reliability is listed as "never a gap" because it is never sent to the
  local model (GEN-32).
- **New cases:** `database-no-page-data` on both targets, generating without
  page data (the one situation where a gap remains), with interactive tests
  on so the gap-fill test runs; and `database` on the-internet, whose only
  form is a sign-in (GEN-44's "not applicable").
- **Interactive tests on the-internet:** the no-page-data case ran with
  interactive tests on, so the gap-fill test submitted the login form. That
  site is a public practice site built for automated form submission. No
  other the-internet case enabled it.
- **Targets:** the comparison fixture (`http://127.0.0.1:4410`, 6 injected
  defects) and https://the-internet.herokuapp.com (no defect switch, so
  detection there is reported as skipped, not guessed).

## Caveats (not smoothed over)

- **The fixture is biased toward both generators.** Its defects were
  designed after the local model's worked examples, and Phase 34's template
  checks were modelled on what caught those same defects. The fixture's
  gap-fill test is almost line for line the worked example for a notes form.
  Its detection shows the pipeline works; it isn't evidence the model finds
  real defects. The acceptance evidence is the real target, where the one
  gap-fill test was wrong.
- **Two targets, one page set each,** and one model. "No gaps with page
  data" holds for these two sites. A site whose pages defeat the template's
  discovery could still produce gaps; the sweep is cheap to re-run on any
  new target to check.
- **One gap-fill test per target, twice.** The false failure repeated in
  both runs, but n=2 is not a rate.
- **Not measured:** gap-fill on multi-area requests without page data (only
  database ever became a gap, so a multi-area request adds the same one gap).

## What the template now catches, and what gap-filling can't reach

Defect detection on the fixture with page data, template only: **5 of 6**
(Phase 21: 2 of 6): SEO, performance, database, security and reliability.
The miss is `a11y-unlabelled-field`: the template's 5 accessibility tests
pass with the unlabelled field on (Phase 21's local suite caught it).
Option B **can't be called for it**: accessibility has template tests, so it
is not a gap, by the definition Decision 6 fixes. Weak coverage inside a
covered area is exactly the "depth" role the record says needs a new
decision (roadmap Phase 35, comprehensive testing). That's where this miss
belongs, or in a template fix, not in widening what counts as a gap.

## Decision 9 outcome: no UI control for gap-filling

A UI control isn't justified by this measurement:

1. **In the normal flow it does nothing.** With page data there were no gaps
   on either target, so a toggle would change no suite.
2. **Where it acts, the evidence is 1 right on a biased fixture and 1 false
   failure on the real target.** A control that invites users to switch on
   that trade isn't worth the UI surface.
3. **The no-page-data gap has a cheaper answer:** inspect the pages before
   generating. With page data, the-internet's database request became "not
   applicable" with the reason reported (GEN-44, RPT-13), and the fixture's
   became a template round trip, generated in about 1 ms, that caught the defect. Whether
   generation should inspect automatically when no profile is supplied is a
   separate product question, not decided here.

Gap-filling stays as built: opt-in via `TESTFORGE_OLLAMA_MODEL`, env var
only. **Revisit if** a target's sweep shows gaps with page data, or if Phase
35 gives the local model a depth role in covered areas.

## Tooling changes in TFP-120

- `scripts/compare-generators.mjs`: template vs. template + gap-fill, the gap
  sweep (`gap-sweep.json`), the generation record passed to `/api/run`, a
  byte-identity check when gap-fill added nothing, and a per-case
  `noContentProfile` option.
- `scripts/comparison-report.mjs`: reads Phase 21 and Phase 34 results
  alike. It adds the gap-sweep table, the gates row, local-model test counts,
  the template's own pass count and detection when only one suite ran, and
  "Not run" handling (a test skipped with a reason is neither passed nor
  failed). On the Phase 21 results the output is unchanged except for an
  "interactive tests on" label on the two cases that set it.
- Configs: `database-no-page-data` on both targets and `database` on
  the-internet.

---

# Results by case (generated)

Output of `node scripts/comparison-report.mjs
comparisons/2026-09-28T20-16-15-419Z-fixture
comparisons/2026-09-28T20-19-37-582Z-the-internet`, unedited. "Template
only" runs with `TESTFORGE_OLLAMA_MODEL` cleared; "Template + gap-fill" with
it set. When gap-fill added nothing, the "Runs" row gives the template run's
results, which are the case's only results.

## fixture: http://127.0.0.1:4410

Local model `testforge-qwen7b`, TestForge http://127.0.0.1:3100, finished 2026-09-28T20:19:36.335Z. Source: `comparisons/2026-09-28T20-16-15-419Z-fixture`.
Distinct discovered elements with a usable name, by type and name across all pages (for the reference proxy): 11.

Gap sweep: each area requested alone, through the real route with the local model unreachable, so only the route's gap detection decides (no model called).

| Area | With page data | Without page data |
| --- | --- | --- |
| functional | covered | covered |
| responsive/mobile | covered | covered |
| performance/load | covered | covered |
| security | covered | covered |
| accessibility | covered | covered |
| usability | covered | covered |
| seo/content | covered | covered |
| cookie/session | covered | covered |
| database | covered | **gap**: database |
| reliability | never a gap: not sent to the local model (GEN-32) | never a gap: not sent to the local model (GEN-32) |

### functional

Request: "Check the sign-in page: the email and password fields accept input and the Sign in button submits the form." - areas: functional.

| | Template only | Template + gap-fill |
| --- | --- | --- |
| Generation | 2 ms | 1 ms (template, gaps: none) |
| Runs | 8.1 s, 31/31 passed | not run: no gaps: the template covered every area in scope, so the model was not called; the suite is the template's, byte for byte |

### accessibility

Request: "Check the sign-in page (email and password fields, Sign in button) for accessibility coverage." - areas: accessibility - injected defect: `a11y-unlabelled-field`.

| | Template only | Template + gap-fill |
| --- | --- | --- |
| Generation | 2 ms | 1 ms (template, gaps: none) |
| Runs | 4.0 s, 5/5 passed; defect `a11y-unlabelled-field`: not detected | not run: no gaps: the template covered every area in scope, so the model was not called; the suite is the template's, byte for byte |

### seo

Request: "Check the Acme Notes home page for SEO/content coverage." - areas: seo/content - injected defect: `seo-missing-meta`.

| | Template only | Template + gap-fill |
| --- | --- | --- |
| Generation | 4 ms | 1 ms (template, gaps: none) |
| Runs | 34.3 s, 10/19 passed; defect `seo-missing-meta`: **detected** by 1 test(s): "TFSE-002: keeps meta description stable for /" | not run: no gaps: the template covered every area in scope, so the model was not called; the suite is the template's, byte for byte |

### performance

Request: "Check the Acme Notes home page for performance/load coverage." - areas: performance/load - injected defect: `performance-slow`.

| | Template only | Template + gap-fill |
| --- | --- | --- |
| Generation | 2 ms | 1 ms (template, gaps: none) |
| Runs | 6.0 s, 4/4 passed; defect `performance-slow`: **detected** by 1 test(s): "TFPL-002: largest contentful paint stays under 4 s" | not run: no gaps: the template covered every area in scope, so the model was not called; the suite is the template's, byte for byte |

### database

Request: "Check the notes page form (Note field, Save note button) for database coverage." - areas: database - injected defect: `database-notes-not-saved` - interactive tests on.

| | Template only | Template + gap-fill |
| --- | --- | --- |
| Generation | 1 ms | 1 ms (template, gaps: none) |
| Runs | 2.0 s, 1/1 passed; defect `database-notes-not-saved`: **detected** by 1 test(s): "TFDB-001: persistence round trip: Note on /notes" | not run: no gaps: the template covered every area in scope, so the model was not called; the suite is the template's, byte for byte |

### database-not-interactive

Request: "Check the notes page form (Note field, Save note button) for database coverage." - areas: database.

| | Template only | Template + gap-fill |
| --- | --- | --- |
| Generation | 1 ms | 1 ms (template, gaps: none) |
| Runs | 2.0 s, 0/0 passed, 1 not run | not run: no gaps: the template covered every area in scope, so the model was not called; the suite is the template's, byte for byte |

### security

Request: "Check the notes page form (Note field, Save note button) for security coverage." - areas: security - injected defect: `security-unescaped-note` - interactive tests on.

| | Template only | Template + gap-fill |
| --- | --- | --- |
| Generation | 1 ms | 1 ms (template, gaps: none) |
| Runs | 4.0 s, 3/3 passed; defect `security-unescaped-note`: **detected** by 1 test(s): "TFSC-003: script-shaped input is not executed: Note on /notes" | not run: no gaps: the template covered every area in scope, so the model was not called; the suite is the template's, byte for byte |

### reliability

Request: "Check the Acme Notes home page for reliability coverage." - areas: reliability - injected defect: `reliability-api-crash`.

| | Template only | Template + gap-fill |
| --- | --- | --- |
| Generation | 2 ms | 1 ms (template, gaps: none) |
| Runs | 4.0 s, 1/2 passed; defect `reliability-api-crash`: **detected** by 1 test(s): "TFRL-001: dependency failure injection: 127.0.0.1:4410 [xhr-fetch]" | not run: no gaps: the template covered every area in scope, so the model was not called; the suite is the template's, byte for byte |

### database-no-page-data

Request: "Check the notes page form (Note field, Save note button) for database coverage." - areas: database - injected defect: `database-notes-not-saved` - generated without page data - interactive tests on.

| | Template only | Template + gap-fill |
| --- | --- | --- |
| Generation | 1 ms | 25.4 s (template+ollama, gaps: database) |
| Gates | none (no model) | time budget: 24384 ms -> kept; type check: 0 type errors -> kept; unawaited assertions: 0 never-awaited web-first assertions -> kept; merged suite type check: 0 type errors -> kept |
| Clean run | no report (run failed); the suite has 0 test(s) | 4.0 s, 1/1 passed |
| Cost | $0 (no model) | $0 (local, no API) |
| Coverage as the run report computes it (functional, accessibility, reliability: discovered elements, credited only to tests titled the template generator's way - so model-written tests score ~0% there by construction; other areas: pass rate) | n/a | Database 100% |
| Discovered elements referenced in the suite (title-independent proxy) | 0/11 | 2/11 |
| Tests written by the local model (clean run) | 0 | 1 (1 Passed) |
| Pass/fail by area (clean) | Database - | Database 1/1 |
| Pass/fail agreement | Database: only one generator tested it | |
| Defect detection (`database-notes-not-saved`) | nothing to detect with: the suite has no tests | **detected** by 1 test(s): "a new note is still shown after reloading the page" |

Phase 17 diff: 0 test(s) pass only in the template only run and 1 only in the template + gap-fill run; the suites share 0 test title(s), so this lists each passing suite whole rather than any disagreement.

## the-internet: https://the-internet.herokuapp.com

Local model `testforge-qwen7b`, TestForge http://127.0.0.1:3100, finished 2026-09-28T20:25:50.355Z. Source: `comparisons/2026-09-28T20-19-37-582Z-the-internet`.
Distinct discovered elements with a usable name, by type and name across all pages (for the reference proxy): 5.

Gap sweep: each area requested alone, through the real route with the local model unreachable, so only the route's gap detection decides (no model called).

| Area | With page data | Without page data |
| --- | --- | --- |
| functional | covered | covered |
| responsive/mobile | covered | covered |
| performance/load | covered | covered |
| security | covered | covered |
| accessibility | covered | covered |
| usability | covered | covered |
| seo/content | covered | covered |
| cookie/session | covered | covered |
| database | not applicable: database | **gap**: database |
| reliability | never a gap: not sent to the local model (GEN-32) | never a gap: not sent to the local model (GEN-32) |

### functional

Request: "Check the login page: the username and password fields accept input and the Login button submits the form." - areas: functional.

| | Template only | Template + gap-fill |
| --- | --- | --- |
| Generation | 1 ms | 2 ms (template, gaps: none) |
| Runs | 58.5 s, 10/13 passed | not run: no gaps: the template covered every area in scope, so the model was not called; the suite is the template's, byte for byte |

### accessibility

Request: "Check the login page (username and password fields, Login button) for accessibility coverage." - areas: accessibility.

| | Template only | Template + gap-fill |
| --- | --- | --- |
| Generation | 2 ms | 2 ms (template, gaps: none) |
| Runs | 6.1 s, 1/1 passed | not run: no gaps: the template covered every area in scope, so the model was not called; the suite is the template's, byte for byte |

### seo

Request: "Check the login page for SEO/content coverage." - areas: seo/content.

| | Template only | Template + gap-fill |
| --- | --- | --- |
| Generation | 1 ms | 1 ms (template, gaps: none) |
| Runs | 46.4 s, 4/9 passed | not run: no gaps: the template covered every area in scope, so the model was not called; the suite is the template's, byte for byte |

### security

Request: "Check the login page (username and password fields, Login button) for security coverage." - areas: security.

| | Template only | Template + gap-fill |
| --- | --- | --- |
| Generation | 2 ms | 2 ms (template, gaps: none) |
| Runs | 12.1 s, 3/3 passed, 1 not run | not run: no gaps: the template covered every area in scope, so the model was not called; the suite is the template's, byte for byte |

### free-form

Request: "Check the login page: logging in with the wrong password shows an error, and the page is accessible." - areas: inferred.

| | Template only | Template + gap-fill |
| --- | --- | --- |
| Generation | 4 ms | 7 ms (template, gaps: none) |
| Runs | 165.2 s, 23/32 passed | not run: no gaps: the template covered every area in scope, so the model was not called; the suite is the template's, byte for byte |

### performance

Request: "Check the login page for performance/load coverage." - areas: performance/load.

| | Template only | Template + gap-fill |
| --- | --- | --- |
| Generation | 2 ms | 1 ms (template, gaps: none) |
| Runs | 18.2 s, 4/4 passed | not run: no gaps: the template covered every area in scope, so the model was not called; the suite is the template's, byte for byte |

### database

Request: "Check that data entered on the login page is saved." - areas: database.

| | Template only | Template + gap-fill |
| --- | --- | --- |
| Generation | 3 ms | 2 ms (template, gaps: none, not applicable: database) |
| Runs | no report (run failed); the suite has 0 test(s) | not run: no gaps: the template covered every area in scope or found it not applicable (database), so the model was not called; the suite is the template's, byte for byte |

### database-no-page-data

Request: "Check that data entered on the login page is saved." - areas: database - generated without page data - interactive tests on.

| | Template only | Template + gap-fill |
| --- | --- | --- |
| Generation | 3 ms | 46.1 s (template+ollama, gaps: database) |
| Gates | none (no model) | time budget: 44952 ms -> kept; type check: 0 type errors -> kept; unawaited assertions: 0 never-awaited web-first assertions -> kept; merged suite type check: 0 type errors -> kept |
| Clean run | no report (run failed); the suite has 0 test(s) | 12.1 s, 0/1 passed |
| Cost | $0 (no model) | $0 (local, no API) |
| Coverage as the run report computes it (functional, accessibility, reliability: discovered elements, credited only to tests titled the template generator's way - so model-written tests score ~0% there by construction; other areas: pass rate) | n/a | Database 0% |
| Discovered elements referenced in the suite (title-independent proxy) | 0/5 | 3/5 |
| Tests written by the local model (clean run) | 0 | 1 (1 Failed) |
| Pass/fail by area (clean) | Database - | Database 0/1 |
| Pass/fail agreement | Database: only one generator tested it | |
| Defect detection | skipped: no injected defect for this case (not the comparison fixture) | same |

Template + gap-fill clean-run failures: "data entered on the login page is saved" (Error: expect(locator).toHaveValue(expected) failed Locator: getByLabel('Username') Expected: "TestForge check 1790627139917" Received: "" T)

Phase 17 diff: 0 test(s) pass only in the template only run and 0 only in the template + gap-fill run; the suites share 0 test title(s), so this lists each passing suite whole rather than any disagreement.

