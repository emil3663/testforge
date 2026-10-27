# TestForge — what it actually does

*Living doc. Last reviewed 2026-10-26, against `main` at `8e93998` (Phase 39
Gate D ruled). Reviewed at every phase completion
([`WORKING_AGREEMENTS.md`](WORKING_AGREEMENTS.md)). Point new readers here
first; `README.md` is the how-to, `docs/decisions/product-roadmap.md` the
phase-by-phase ledger, `TEST_PLAN.md` the case-by-case status.*

## In one paragraph

TestForge is a test automation assistant for websites. Give it a base URL
and it crawls the site, groups its pages into page types, inspects one page
of each type, writes a Playwright TypeScript suite from what it actually
found, runs it in Chromium, and returns a report that says what was tested,
how, and — just as prominently — what wasn't tested and why. The suite is
plain Playwright you can keep and run without TestForge. The core needs no
AI and no API key. It is a local, single-user tool today: a Next.js app on
the tester's machine, not a hosted service.

## The ideas it is built on

- **Honest coverage.** The coverage denominator is everything the crawl and
  inspection found (every link, control, form and outbound dependency), not
  the tests that happened to be generated. The report's gap list names what
  no test touched (Phase 17; element-level coverage map, Phase 42).
- **Deterministic first.** A template generator writes every test from
  inspection data. The same site gives the same suite; the template's output
  is checked byte-for-byte against a recorded baseline on fixed inputs
  (`npm run check:template-unchanged`, nightly).
- **Evidence over claims.** Every capability is measured against targets
  with known defects — local Docker copies of the Toolshop practice site
  (clean and with-bugs) and The Internet — and results are kept under
  `benchmarks/` (`docs/QUALITY_GATES.md`).
- **Safe by default.** Tests are read-only unless a run turns on more.

## What a run does

1. **Crawl and select.** Pages are grouped into page types by address
   pattern, split only by form signature; Standard tests one page per type,
   up to 8 (Phase 40).
2. **Inspect.** Each selected page is read in a real browser so every check
   targets real elements: controls, forms, links, landmarks, outbound
   requests.
3. **Generate.** The template writes the suite. Optionally, a local model
   (Ollama) fills areas the template left empty, and, opt-in per site,
   Claude Code or a local model writes tests for coverage gaps; model-written
   tests are labelled and kept apart.
4. **Run.** Chromium only, at one of three gates:
   - **read-only** (default): nothing that changes data; a request guard
     blocks non-GET traffic;
   - **interactive**: forms and flows, when the run switches it on;
   - **active**: data-changing and attack-shaped tests, only behind an
     ownership confirmation (Phase 43, locked, not built).
5. **Report.** Execution, defects, coverage, performance, accessibility,
   usability and SEO, with an HTML export. Runs persist and two runs of the
   same site can be diffed test by test.

## Two kinds of run

- **Standard** — the critical working path, not intrusive: functional
  controls (sorts, filters, steppers, links), every link on the selected
  pages, layout and overlap, spelling, keyboard order, WCAG 2.2 A/AA via axe,
  passive security headers and probes, baseline SEO, and Core Web Vitals
  graded in bands (a miss that isn't poor is an improvement, not a failure).
- **Comprehensive** — one area in depth, or all areas: negative and
  edge-case tests that try to break fields and flows. Security and
  accessibility have Comprehensive sets today; SEO, functional negatives and
  all-areas runs are in the build order
  (`docs/decisions/deferred-work-register.md`).

Measured: on the local Toolshop copies, with 37 known bugs in reach,
Standard alone finds 30 (TFP-207, 2026-10-16); Standard plus Comprehensive
security and accessibility finds 33 (Phase 41 Gate B).

## Reuse instead of regeneration (Phase 42)

- **Site suites.** A site's Standard suite is saved with a structural
  fingerprint per page type. Later runs reuse unchanged page types,
  regenerate changed ones, retire removed ones and keep hand-edited tests.
  A reused test that fails on a changed page is regenerated and re-run
  before it counts.
- **Library.** Comprehensive tests written against component patterns,
  in the repo (`src/lib/library/`), applied to any site with that pattern.
- **Gap tests and candidates.** Opt-in per site: uncovered elements get a
  test written (by Claude Code, tools disabled, or a local model). Passing
  ones join the site suite and become candidates; a candidate that passes
  every run and catches a real defect or runs clean on 3 sites is offered
  for promotion to the library, which needs the tester's approval
  (confirmation required).

Site suites, run history and candidates hold one site's details, so they
live in TestForge's local data folder (`%LOCALAPPDATA%\TestForge` on
Windows; `TESTFORGE_DATA_DIR` overrides), never in the repo.

## Architecture

```
 Browser UI (src/app/page.tsx)
      │  fetch
      ▼
 Next.js API routes (src/app/api/*)          one Node process, loopback only
  crawl · introspect · generate · run · runs · runs/diff · candidates
  site-settings · save-suite · health
      │
      ├─ src/lib/introspect, selection   crawl, page types, inspection (Playwright)
      ├─ src/lib/generate                 template generator, Comprehensive sets
      ├─ src/lib/gap-writer, candidates,  gap tests, candidate pool, promotion
      │  library, site-suites
      ├─ src/lib/run                      job queue, gates, request guard, host limits,
      │                                   child Playwright runs with a minimal environment
      ├─ src/lib/report                   coverage, summary, diff, HTML export
      └─ src/lib/storage                  data folder: runs/, site-suites/, candidates/
      │
      ▼
 Chromium (Playwright) ──► target site          optional: Ollama (local model),
                                                 Claude Code CLI (gap writer)
```

- **No database.** Runs are folders (`run.json`, the executed
  `suite.spec.ts`, `evidence/`), written atomically; one TestForge process
  per data folder.
- **Async runs.** `POST /api/run` returns a job (202); the UI polls
  `GET /api/run`. Concurrency is by worker count with per-host request caps
  (Phase 39, in progress).
- **Security model.** `/api/run` executes generated code with the user's
  privileges. That is accepted under the local-only model (Phase 16) and is
  why TestForge must never be bound to a non-loopback interface or tunnelled
  (`README.md`, Security model). Model-written code is restricted to the page
  and `expect` and runs with no keys in its environment — not a sandbox; the
  Docker sandbox is Phase 45.
- **Tests of TestForge itself.** Node unit tests, a Playwright self-test and
  regression suite against a built instance, Allure reports; CI runs PR
  validation, regression, self-test and the nightly unit and template
  checks (`.github/workflows/`).

## Where it's going

In order (`product-roadmap.md`, `deferred-work-register.md`):

- **Now:** Phase 39, run speed — Gates A–D measured; TFP-157's slot-server
  fix verified and pushed (`66cd0c0`); D26 (the Toolshop copies in WSL)
  built, awaiting verification; Gate D's re-measurement next.
- **Next:** Phase 43 ownership confirmation; then the remaining Standard
  sets (SEO, the WAI-ARIA APG patterns, the rest of accessibility and
  security); Comprehensive negative tests and SEO; all-areas runs; load
  testing.
- **Locked, not started:** Phase 44 scenario gaps, Phase 45 Docker sandbox,
  Phase 46 app screens.
- **Locked, next after Phase 39:** Phase 47, TestForge as a step in a
  target's CI pipeline (`docs/decisions/phase-47-ci-integration-decision-record.md`).
- **Deferred, not cancelled:** a hosted SaaS version
  (`saas-prerequisites.md`); the OpenAI path (Phase 28, parked).

## Relationship to `skills/`

A parallel track, not a replacement: `skills/` packages the testing and
engineering judgment behind TestForge as an installable Claude Code plugin
(`testforge-skills`, 12 skills under `skills/testing/` and
`skills/engineering/`), usable without the app. `skills/proposed/` holds
SRE and DORA skills under review, four of them being adopted (TFP-236).
Rewriting TestForge as skills only was considered and declined
(`docs/REIMAGINING.md`, `REIMAGINING-RESPONSE.md`).
