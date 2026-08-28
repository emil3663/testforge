# TestForge Phase 16 Implementation Backlog

**Version:** 1.0
**Date:** 2026-08-26
**Status:** Decision locked — see `docs/decisions/phase-16-local-first-decision-record.md`

Ticket prefix is `TFP-`. This is distinct from the `TFXX-NNN` identifiers
TestForge assigns to tests inside generated suites at runtime.

---

## Product Vision

TestForge is an AI-native test automation assistant for testers who understand
quality but do not write automation code. A tester describes what to test in
plain English; TestForge generates a Playwright suite, runs it, and returns a
structured report covering execution, defects, coverage, performance, usability
and SEO. It runs on the tester's own machine against a local target.

## Current Functionality (Baseline)

- Next.js UI at `localhost:3000` — the single front end since Phase 11.
- Five API routes: `generate`, `run`, `crawl`, `introspect`, `save-suite`.
- OpenAI `gpt-4o` generation of TypeScript `.spec.ts` Playwright suites, with a
  template fallback when no API key is set.
- Async run lifecycle with progress polling, cancellation, targeted rerun of
  failed tests, and artifact capture.
- Seven-tab structured report with HTML export.
- Site crawl and page introspection feeding content-aware generation.
- 5 smoke tests, 21 regression tests, Allure reporting, three CI workflows.
- A legacy FastAPI backend (`app.py`) that now only redirects, plus a
  backend-proxy layer with no active consumer.

## Scope (Phase 16)

### In scope

1. Removing the deployment surface and asserting local-only posture.
2. Deleting the FastAPI backend and the backend-proxy layer.
3. Scoping browser execution to Chromium.
4. Decomposing the three oversized source files.
5. Bringing documentation into line with the shipped product.
6. Creating the project's first `TEST_PLAN.md`.

### Out of scope

- Authentication, sandboxed execution, or durable run state.
- Any deployed or hosted version of TestForge.
- Cross-browser execution.
- New product features of any kind.

## Development Phases

### Phase 16A — Posture and hygiene
- Remove everything asserting production readiness.
- Clean the repository of tracked artifacts and cross-platform noise.

### Phase 16B — Removal
- Delete the FastAPI backend, the proxy layer, and non-Chromium projects.
- Rewrite documentation against the resulting codebase.

### Phase 16C — Decomposition
- Extract the report engine, then split the two API routes and the UI file.

### Phase 16D — Coverage
- Create the test plan and close the coverage gaps the earlier phases open.

---

## Backlog

### TFP-001 — Remove the production and staging deployment surface

- **Phase:** 16A
- **Priority:** P0
- **Suggested labels:** `technical-debt`, `security`, `documentation`
- **Problem it solves:** `DEPLOYMENT_CHECKLIST.md` states "Ready for production
  cutover" and `.env.production` points at a real hostname, while `/api/run`
  executes arbitrary unauthenticated code. Any reader — human or agent — can
  reasonably act on those files and expose a shell.
- **Scope:**
  - Delete `DEPLOYMENT_CHECKLIST.md`, `.env.production`, `.env.staging`.
  - Remove `build:staging`, `build:production`, `start:staging`,
    `start:production`, `dev:staging` from `package.json`.
  - Remove the `!.env.staging` and `!.env.production` allowlist entries from
    `.gitignore`.
- **Deliverables:**
  - A repository whose only environment files are `.env.example` and
    `.env.development`.
- **Acceptance criteria:**
  - `ls .env.*` lists exactly `.env.development` and `.env.example`.
  - No `package.json` script references a deleted env file.
  - `npm run build` and `npm run lint` pass.
- **Dependencies:** None.

### TFP-002 — Document the local-execution security model

- **Phase:** 16A
- **Priority:** P0
- **Suggested labels:** `security`, `documentation`
- **Problem it solves:** Arbitrary code execution is intended behaviour under
  the local-only model, but nothing in the repository says so. An undocumented
  deliberate risk is indistinguishable from an accidental one, and the next
  person to touch this — including an agent — needs to know it is a decision.
- **Scope:**
  - Add a "Security model" section near the top of `README.md`.
  - State that `/api/run` executes caller-supplied code with the privileges of
    the user running the dev server.
  - State that TestForge must not be bound to a non-loopback interface or
    exposed through a tunnel.
- **Deliverables:**
  - A security section in `README.md` and a matching note in `.env.example`.
- **Acceptance criteria:**
  - `README.md` states the execution model above the installation steps.
  - The statement names `/api/run` explicitly.
- **Dependencies:** None.

### TFP-003 — Untrack committed build and test artifacts

- **Phase:** 16A
- **Priority:** P1
- **Suggested labels:** `technical-debt`, `ci`
- **Problem it solves:** 28 files (6.7 MB) under `artifacts/` are tracked
  despite `artifacts/` being gitignored — `.gitignore` does not untrack
  retroactively. The committed smoke report claims 1 test passed; there are now
  5. The repository publishes a frozen, false green result.
- **Scope:**
  - `git rm -r --cached artifacts/`.
  - Confirm `artifacts/` remains ignored.
- **Deliverables:**
  - A commit removing the tracked artifacts.
- **Acceptance criteria:**
  - `git ls-files artifacts | wc -l` returns `0`.
  - `npm run test:self:allure` still produces a report at
    `artifacts/allure-report/smoke`.
  - `git status` is clean after that run.
- **Dependencies:** None.

### TFP-004 — Add `.gitattributes` and a LICENSE

- **Phase:** 16A
- **Priority:** P2
- **Suggested labels:** `technical-debt`, `chore`
- **Problem it solves:** With no `.gitattributes`, the working tree shows every
  file as modified whenever git runs from a non-Windows view of the checkout,
  which makes diffs unreadable and invites accidental whole-file commits. The
  repository also has no licence, leaving reuse terms undefined.
- **Scope:**
  - Add `.gitattributes` normalising text files to LF in the index.
  - Add a LICENSE file.
- **Deliverables:**
  - `.gitattributes`, `LICENSE`.
- **Acceptance criteria:**
  - `git status` is clean immediately after `git add --renormalize .` and a
    commit.
  - `LICENSE` exists at the repository root.
- **Dependencies:** None.

### TFP-005 — Delete stale remote branches

- **Phase:** 16A
- **Priority:** P2
- **Suggested labels:** `chore`
- **Problem it solves:** Four abandoned `copilot/*` branches remain on origin,
  including `copilot/install-cplusplus`, which has nothing to do with this
  project. They add noise to any branch listing and suggest work in flight that
  is not.
- **Scope:**
  - Confirm each branch has no unmerged work worth keeping.
  - Delete `copilot/bridge-gap-between-testers-developers`,
    `copilot/debug-chat-functionality`, `copilot/debug-chat-functionality-again`,
    `copilot/install-cplusplus` from origin.
- **Deliverables:**
  - An origin with `main` as its only branch.
- **Acceptance criteria:**
  - `git branch -r` lists only `origin/HEAD` and `origin/main`.
- **Dependencies:** None.

### TFP-010 — Delete the FastAPI backend and Python toolchain

- **Phase:** 16B
- **Priority:** P0
- **Suggested labels:** `technical-debt`, `security`
- **Problem it solves:** `app.py` is a second, entirely untested code-execution
  path — CI never installs Python and no pytest suite exists. It has served only
  as a redirect since Phase 11, and `templates/index.html` has been dead since
  the legacy UI was removed. Keeping it doubles the security surface for no
  functional gain.
- **Scope:**
  - Delete `app.py`, `requirements.txt`, `templates/`.
  - Remove `TESTFORGE_NEXT_UI_URL` from `.env.example` and `.env.development`.
  - Remove all Python and uvicorn references from `.vscode/` configuration.
- **Deliverables:**
  - A repository containing no Python source.
- **Acceptance criteria:**
  - `find . -name "*.py" -not -path "./node_modules/*"` returns nothing.
  - `grep -rn "uvicorn\|fastapi\|pytest" --include="*.json" --include="*.ts" --include="*.md" . | grep -v node_modules` returns nothing outside git history.
  - `npm run build`, `npm run lint`, `npm run test:self` and
    `npm run test:regression` all pass.
- **Dependencies:** None.

### TFP-011 — Remove the backend-proxy layer from all five API routes

- **Phase:** 16B
- **Priority:** P0
- **Suggested labels:** `technical-debt`, `refactor`
- **Problem it solves:** Every API route carries proxy and fallback branches for
  an external backend that, after TFP-010, cannot exist. Dead conditional paths
  are the highest-risk kind of dead code in an agent-assisted repository: they
  read as live behaviour and get maintained, extended and reasoned about.
- **Scope:**
  - Delete `src/lib/backend-proxy.ts`.
  - Remove every `isExternalBackendEnabled` / `proxyJsonRequest` /
    `shouldFallbackToLocalBackend` / `getBackendBaseUrl` branch from all six
    routes: `generate`, `run`, `crawl`, `introspect`, `save-suite` and `health`.
  - `health` must continue to report service status after the proxy metadata is
    removed from it.
  - Remove `TESTFORGE_BACKEND_BASE_URL` from all environment files, `README.md`,
    and the consolidation phase docs' "current state" sections.
- **Deliverables:**
  - Six API routes with a single in-process code path each.
- **Acceptance criteria:**
  - `grep -rn "TESTFORGE_BACKEND_BASE_URL\|backend-proxy" src .env.* *.md` returns nothing.
  - `src/lib/backend-proxy.ts` does not exist.
  - The regression suite passes with the two proxy-related cases —
    "reports health and observability metadata for consolidated mode" and
    "redirects FastAPI root to Next.js UI when backend is available" — removed
    or rewritten, and every other case unmodified.
- **Dependencies:** TFP-010

### TFP-012 — Scope browser execution to Chromium

- **Phase:** 16B
- **Priority:** P0
- **Suggested labels:** `bug`, `enhancement`
- **Problem it solves:** The generation UI offers a Cross-Browser option
  ("Chromium, Firefox, and WebKit coverage") and `playwright.config.ts` declares
  all three projects, but `README.md` and all three CI workflows install Chromium
  only. Selecting Cross-Browser on a fresh clone fails with a
  browser-not-installed error. The product currently advertises a feature it
  cannot perform.
- **Scope:**
  - Remove the `cross-browser` entry from `BEST_PRACTICE_OPTIONS` in
    `src/app/page.tsx` and its keyword mapping in `BEST_PRACTICE_KEYWORDS`.
  - Remove the `firefox` and `webkit` projects from `playwright.config.ts`.
  - Remove cross-browser handling from `calculateWorkerCount`,
    `calculateRunTimeout` and the `browserProjects` construction in
    `src/app/api/run/route.ts`.
  - Remove cross-browser references from the generation system prompt.
- **Deliverables:**
  - A single-browser execution path end to end.
- **Acceptance criteria:**
  - `playwright.config.ts` declares exactly one project.
  - The generation UI shows no Cross-Browser option.
  - `grep -rni "firefox\|webkit" src playwright.config.ts` returns nothing.
  - A generate → run → report cycle completes on a fresh clone that has run only
    `npx playwright install chromium`.
- **Dependencies:** None.

### TFP-013 — Deduplicate pull-request CI

- **Phase:** 16B
- **Priority:** P1
- **Suggested labels:** `ci`, `chore`
- **Problem it solves:** `pr-validation.yml` and `self-test.yml` both trigger on
  `pull_request` and both run lint → build → smoke. Every PR pays for the same
  work twice, and a failure appears as two unrelated red checks.
- **Scope:**
  - Decide which workflow owns PR validation and remove the duplicate trigger.
  - Keep Allure artifact upload on whichever workflow survives.
- **Deliverables:**
  - One workflow running per pull request.
- **Acceptance criteria:**
  - Exactly one workflow file lists `pull_request` among its triggers.
  - A test PR produces one lint/build/smoke run and one Allure artifact.
- **Dependencies:** None.

### TFP-014 — Rewrite README against the shipped product

- **Phase:** 16B
- **Priority:** P0
- **Suggested labels:** `documentation`
- **Problem it solves:** `README.md` describes a Python `pytest-playwright`
  product that no longer exists — the app generates TypeScript `.spec.ts` suites
  run by the Playwright CLI. Its getting-started path ends at `localhost:8000`,
  which redirects to a Next.js server the README never tells the reader to start.
  Following the README start to finish does not produce a working application.
- **Scope:**
  - Replace the Python/pytest tech stack, features, example-test and scripts
    sections with what the Next.js app actually does.
  - Rewrite getting started as: clone → `npm install` →
    `npx playwright install chromium` → `cp .env.example .env` →
    `docker compose up -d` → `npm run dev` → `localhost:3000`.
  - Remove the "Consolidation cutover" section entirely.
  - Keep the WSL and Docker proxy troubleshooting sections.
  - Verify every command listed exists in `package.json`.
- **Deliverables:**
  - A `README.md` that is executable start to finish on a clean machine.
- **Acceptance criteria:**
  - `README.md` contains no occurrence of `pytest`, `uvicorn`, `FastAPI`,
    `requirements.txt`, or `.py`.
  - Every command in the Scripts table resolves to a `package.json` script or a
    documented external binary.
  - A reviewer following the README on a clean clone reaches a working
    generate → run → report cycle without consulting any other file.
- **Dependencies:** TFP-001, TFP-002, TFP-010, TFP-011, TFP-012

### TFP-020 — Extract the report engine into `src/lib/report/`

- **Phase:** 16C
- **Priority:** P0
- **Suggested labels:** `refactor`, `technical-debt`
- **Problem it solves:** Report construction is duplicated across
  `src/app/page.tsx` (HTML document builders, status mapping, fallback tables)
  and `src/app/api/run/route.ts` (summary, defect, coverage, performance,
  usability and SEO builders). The two must agree and nothing enforces it. This
  is also the largest single body of logic that has no reason to live in either
  file.
- **Scope:**
  - Create `src/lib/report/` with modules for types, HTML document building,
    status mapping, and each report-section builder.
  - Move `buildReportHtmlDocument`, `buildExecutionOutputHtmlDocument`,
    `buildResultHtmlDocument`, `escapeReportHtml`, `mapFallbackExecutionStatus`,
    and the fallback status helpers out of `page.tsx`.
  - Move `buildDefects`, `buildCoverageMatrix`, `buildSummary`,
    `buildPerformanceReport`, `buildUsabilityReport`, `buildSeoReport`,
    `buildDefectTrend` and `flattenSuites` out of `run/route.ts`.
  - Move the shared report interfaces into a single types module both import.
- **Deliverables:**
  - `src/lib/report/` with no module over 400 lines.
- **Acceptance criteria:**
  - `page.tsx` and `run/route.ts` declare no report-building function.
  - Report type definitions are declared in exactly one file.
  - The regression suite passes with no assertion changes.
  - HTML export output is byte-identical for an identical run report before and
    after the change.
- **Dependencies:** TFP-011

### TFP-021 — Split the run route into modules

- **Phase:** 16C
- **Priority:** P0
- **Suggested labels:** `refactor`, `technical-debt`
- **Problem it solves:** `src/app/api/run/route.ts` is 2,226 lines covering job
  lifecycle, process spawning, progress reporting, output parsing, artifact
  collection and rerun selection. No agent can hold it in view, and every change
  to it produces an unreviewable diff.
- **Scope:**
  - Extract the job registry and lifecycle state into `src/lib/run/jobs.ts`.
  - Extract Playwright process spawning and the progress reporter source into
    `src/lib/run/executor.ts`.
  - Extract output parsing and artifact collection into `src/lib/run/output.ts`.
  - Extract rerun/grep selection into `src/lib/run/selection.ts`.
  - Leave `route.ts` as request handling and validation only.
- **Deliverables:**
  - `src/lib/run/` modules; `route.ts` under 300 lines.
- **Acceptance criteria:**
  - `wc -l src/app/api/run/route.ts` reports under 300.
  - No module under `src/lib/run/` exceeds 500 lines.
  - The regression suite passes with no assertion changes.
  - Run cancellation, targeted rerun, and stopped-run state preservation behave
    identically — verified by the existing regression cases for each.
- **Dependencies:** TFP-020

### TFP-022 — Split the generate route into modules

- **Phase:** 16C
- **Priority:** P0
- **Suggested labels:** `refactor`, `technical-debt`
- **Problem it solves:** `src/app/api/generate/route.ts` is 2,415 lines, most of
  it prompt construction, input normalisation and the ~100-line no-API-key mock
  generator. The system prompt is the single highest-value thing in the product
  to review and iterate on, and it currently shares a file with 2,300 lines of
  unrelated code.
- **Scope:**
  - Extract the system prompt into `src/lib/generate/prompt.ts`.
  - Extract the mock generator into `src/lib/generate/mock.ts`.
  - Extract `normalizeBaseUrl`, `normalizeSelectedPractices`,
    `normalizeContentProfile`, `normalizeContentRules`, `normalizeTestAuditMode`
    into `src/lib/generate/normalize.ts`.
  - Leave `route.ts` as request handling and the OpenAI call only.
- **Deliverables:**
  - `src/lib/generate/` modules; `route.ts` under 200 lines.
- **Acceptance criteria:**
  - `wc -l src/app/api/generate/route.ts` reports under 200.
  - The system prompt is the sole content of one file.
  - Generation with and without `OPENAI_API_KEY` both produce runnable suites.
  - The regression suite passes with no assertion changes.
- **Dependencies:** TFP-020

### TFP-023 — Split `page.tsx` into section components

- **Phase:** 16C
- **Priority:** P0
- **Suggested labels:** `refactor`, `technical-debt`
- **Problem it solves:** `src/app/page.tsx` is 4,739 lines, of which the `Home`
  component alone is 2,766. It is the worst review surface in the repository and
  the file most likely to be edited by an agent working from partial context.
- **Scope:**
  - Extract presentational components (`CollapsibleSection`, `Chevron`,
    `MetricCard`, `ReportPanel`, `DonutChart`, `LegendRow`, `SeverityBar`,
    `TrendBars`, `ExecutionTable`, `FallbackExecutionTable`) into
    `src/app/_components/`.
  - Extract each major UI section — creation inputs, discovered pages/crawl,
    content rules, generated suite, run progress, report tabs — into its own
    component.
  - Extract crawl, run and generation client state into hooks under
    `src/app/_hooks/`.
  - Leave `page.tsx` as composition and top-level state only.
- **Deliverables:**
  - `src/app/_components/` and `src/app/_hooks/`; `page.tsx` under 400 lines.
- **Acceptance criteria:**
  - `wc -l src/app/page.tsx` reports under 400.
  - No file under `src/app/_components/` or `src/app/_hooks/` exceeds 500 lines.
  - The smoke and regression suites pass with no assertion changes, including the
    five UI-section regression cases.
  - No visual change: report tabs, collapsible sections and charts render
    identically.
- **Dependencies:** TFP-020, TFP-012

### TFP-024 — Add a file-size guard to lint

- **Phase:** 16C
- **Priority:** P2
- **Suggested labels:** `ci`, `chore`
- **Problem it solves:** Nothing prevents the files just decomposed from growing
  back. Agent-assisted development appends by default; without a mechanical
  limit this phase's work erodes within months.
- **Scope:**
  - Add an ESLint `max-lines` rule for `src/` at the decision record's 500-line
    limit.
  - Confirm the rule fails the build rather than warning.
- **Deliverables:**
  - An enforced line limit in `eslint.config.mjs`.
- **Acceptance criteria:**
  - `npm run lint` fails when any file under `src/` exceeds 500 lines.
  - `npm run lint` passes on the decomposed codebase with no suppressions.
- **Dependencies:** TFP-021, TFP-022, TFP-023

### TFP-030 — Create `TEST_PLAN.md`

- **Phase:** 16D
- **Priority:** P0
- **Suggested labels:** `documentation`, `testing`
- **Problem it solves:** TestForge has 26 automated tests and no test plan. The
  automated suites are the only description of expected behaviour, so anything
  not automated — and every manual verification step — is undocumented. This is
  the only project in the portfolio without one.
- **Scope:**
  - Feature-status table covering generate, crawl, introspect, run, report,
    export and save-suite.
  - ID-coded manual test cases grouped by area with expected results.
  - Known limitations, including the local-only execution model and the absence
    of cross-browser support.
  - Map each existing automated test to its case ID.
- **Deliverables:**
  - `TEST_PLAN.md` at the repository root.
- **Acceptance criteria:**
  - Every one of the five API routes has at least one documented case.
  - Every case has an expected result and a status checkbox.
  - Each of the 26 automated tests maps to exactly one case ID.
  - Known limitations names the `/api/run` execution model.
- **Dependencies:** TFP-012, TFP-014

### TFP-031 — Close the regression gap left by proxy removal

- **Phase:** 16D
- **Priority:** P1
- **Suggested labels:** `testing`
- **Problem it solves:** Two regression cases exercised proxy and redirect
  behaviour that TFP-010 and TFP-011 delete. Removing them without replacement
  drops the regression count from 21 to 19 and leaves in-process execution
  covered only incidentally.
- **Scope:**
  - Add a regression case asserting `/api/health` reports local in-process mode.
  - Add a regression case asserting each route executes without an external
    backend configured.
- **Deliverables:**
  - Replacement regression cases in `tests/regression/`.
- **Acceptance criteria:**
  - The regression suite reports at least 21 tests.
  - The suite passes with no environment variable set beyond `.env.development`.
- **Dependencies:** TFP-011, TFP-030

### TFP-032 — Record the SaaS prerequisites

- **Phase:** 16D
- **Priority:** P2
- **Suggested labels:** `documentation`
- **Problem it solves:** Phase 16 deliberately deletes the partial scaffolding
  for a deployed version. The reasoning for what a deployed TestForge would
  actually require needs to survive that deletion, or the next attempt starts
  from the same half-built assumptions.
- **Scope:**
  - Record authentication, sandboxed execution, durable run state (replacing the
    in-process `runJobs` map), artifact storage, and per-tenant isolation as
    prerequisites.
  - State explicitly that none of these are partially implemented.
- **Deliverables:**
  - `docs/decisions/saas-prerequisites.md`.
- **Acceptance criteria:**
  - The document names each prerequisite and why local-first does not satisfy it.
  - The document states that no code in the repository anticipates it.
- **Dependencies:** TFP-011

---

## Recommended Execution Order

1. TFP-001 — remove the deployment surface
2. TFP-002 — document the security model
3. TFP-003 — untrack artifacts
4. TFP-004 — `.gitattributes` and LICENSE
5. TFP-010 — delete FastAPI
6. TFP-011 — remove the proxy layer
7. TFP-012 — scope to Chromium
8. TFP-013 — deduplicate PR CI
9. TFP-014 — rewrite the README
10. TFP-020 — extract the report engine
11. TFP-021 — split the run route
12. TFP-022 — split the generate route
13. TFP-023 — split `page.tsx`
14. TFP-024 — file-size guard
15. TFP-030 — create `TEST_PLAN.md`
16. TFP-031 — close the regression gap
17. TFP-032 — record SaaS prerequisites
18. TFP-005 — delete stale remote branches

TFP-001 through TFP-004 have no dependencies and are ordered first because they
are cheap and remove the most misleading content in the repository. TFP-005 is
last because branch deletion is irreversible and worth doing only once the phase
is otherwise settled. TFP-020 precedes TFP-021, TFP-022 and TFP-023 because all
three shrink substantially once report construction has already moved out — doing
them in the other order means moving the same code twice.

## Suggested Milestone Gates

### Gate A — Posture and hygiene complete
- No file in the repository asserts production readiness.
- `git ls-files artifacts` returns nothing.
- `README.md` states the local-execution security model.
- `git status` is clean on a fresh checkout from any platform.

### Gate B — Removal complete
- No Python source in the repository.
- `grep -rn "TESTFORGE_BACKEND_BASE_URL"` returns nothing outside git history.
- `playwright.config.ts` declares one project.
- `README.md` is executable start to finish on a clean machine.
- Build, lint, smoke and regression all pass.

### Gate C — Decomposition complete
- No file under `src/` exceeds 500 lines.
- `npm run lint` enforces that limit.
- Smoke and regression pass with no assertion changes made during this phase.
- HTML report export is unchanged for an identical run.

### Gate D — Phase 16 complete
- `TEST_PLAN.md` exists and maps every automated test to a case ID.
- Regression count is at or above its pre-phase level of 21.
- `docs/decisions/saas-prerequisites.md` records what a deployed version needs.
- A clean clone reaches a working generate → run → report cycle following only
  `README.md`.
