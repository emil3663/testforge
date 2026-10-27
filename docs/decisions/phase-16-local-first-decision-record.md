# Phase 16 Decision Record (Locked)

Date: 2026-08-26
Scope: Establish TestForge as a local-only tool — remove the FastAPI/proxy backend, scope execution to Chromium, and decompose the three oversized source files
Status: Complete. Every Phase 16 ticket landed 2026-08-28 to 2026-09-17; see `phase-16-implementation-backlog.md` for commits. Reconciled with git 2026-09-29.

## Context

Phases 1–15 consolidated TestForge from two UIs onto the Next.js app. That work
left the repository asserting two incompatible things at once: that TestForge is
a local development tool run against a Dockerised Plane instance, and that it is
"ready for production cutover". The execution model — `POST /api/run` accepts
arbitrary code, writes it to disk, and executes it with no authentication or
sandbox — is correct for the first reading and unacceptable under the second.

This phase resolves that contradiction in favour of local-only, and removes the
structure that existed to support the other answer.

## Decisions

1. TestForge is a local-only tool and is not deployed.
- The tool runs on the developer's own machine against a local test target.
- Arbitrary code execution in `/api/run` is accepted as intended behaviour under
  this model and is documented as such.
- No authentication, sandboxing, or multi-tenant isolation is built in this phase.
- `.env.production`, `.env.staging`, and `DEPLOYMENT_CHECKLIST.md` are removed.

**Amended 2026-10-27 (Emil; Phase 47 Decision 3,
`phase-47-ci-integration-decision-record.md`):** "local-only" means TestForge
runs on the tester's own machine *or on their own team's CI runner*, for that
team alone — never as a shared service. In CI it starts no HTTP server, runs
only code it generated in that job or the team's own restored site suite, and
takes credentials only from the pipeline's secrets. Decision 2 (SaaS
deferred) is unchanged.

2. A deployed SaaS version is explicitly deferred, not cancelled.
- SaaS is out of scope for Phase 16 and every ticket within it.
- Authentication, sandboxed execution, and durable run state are recorded as
  known prerequisites for that future phase and are not partially built now.
- No abstraction is retained in the codebase for the sole purpose of enabling it
  later.

3. The FastAPI backend and the backend-proxy layer are deleted.
- `app.py`, `requirements.txt`, and `templates/index.html` are removed.
- `src/lib/backend-proxy.ts` is removed.
- Every `TESTFORGE_BACKEND_BASE_URL` proxy branch is removed from
  `src/app/api/generate`, `/run`, `/crawl`, `/introspect`, and `/save-suite`.
- `TESTFORGE_BACKEND_BASE_URL` and `TESTFORGE_NEXT_UI_URL` are removed from all
  environment files and documentation.
- Next.js API routes execute in-process only.

4. Browser execution is scoped to Chromium.
- The Cross-Browser option is removed from the generation UI.
- The `firefox` and `webkit` projects are removed from `playwright.config.ts`.
- Cross-browser support is re-introduced as its own future ticket, with matching
  install steps and CI coverage, or not at all.

5. The three oversized source files are decomposed in full.
- Report construction moves out of `src/app/page.tsx` and
  `src/app/api/run/route.ts` into a shared `src/lib/report/` module.
- `src/app/page.tsx` is split into section components under `src/app/_components/`.
- `src/app/api/generate/route.ts` and `src/app/api/run/route.ts` are split into
  modules under `src/lib/`.
- No source file exceeds 500 lines on completion, with one named exception:
  `src/lib/introspect/dom-snapshot.ts` (673 lines), the function passed by
  reference to Playwright's `page.evaluate`. Playwright serializes only that
  function's own source text and runs it inside the browser's isolated JS
  context, with no access to this module's scope — its ~18 nested helpers
  cannot be extracted into importable files without throwing `ReferenceError`
  at runtime. This is the only file in the repository under this exception.
- Decomposition is behaviour-preserving: no user-visible change ships with it.

6. Tracked build and test artifacts are removed from version control.
- The 28 tracked files under `artifacts/` are untracked via `git rm --cached`.
- `artifacts/` remains gitignored and is regenerated on demand.

## Acceptance Criteria

1. Deployment posture
- The repository contains no file asserting production readiness.
- `README.md` states in its opening section that TestForge runs locally and
  executes arbitrary code by design.
- `.env.example` contains only variables the local tool actually reads.

2. FastAPI and proxy removal
- No Python file remains in the repository.
- `grep -r "TESTFORGE_BACKEND_BASE_URL" .` returns no matches outside git history.
- The five API routes contain no proxy or fallback branch.
- `npm run build` and `npm run lint` pass.
- The smoke and regression suites pass unchanged in count and outcome.

3. Chromium scope
- The generation UI offers no Cross-Browser option.
- `playwright.config.ts` declares exactly one project.
- A fresh clone following `README.md` start to finish produces a working
  generate → run → report cycle with no browser-not-installed error.

4. Documentation truth
- `README.md` describes TypeScript `.spec.ts` generation and Playwright CLI
  execution, with no reference to Python, pytest, or `pytest runs/ -v`.
- Following `README.md` from clone to first run requires no undocumented step.
- Every command listed in `README.md` exists in `package.json`.

5. Decomposition
- `wc -l` reports no file over 500 lines under `src/`, with the one named
  exception in Decision 5 (`src/lib/introspect/dom-snapshot.ts`).
- The regression suite passes with no assertion changes.
- No route or component exports change name or signature without a
  corresponding test update.

6. Repository hygiene
- `git ls-files artifacts | wc -l` returns 0.
- A `.gitattributes` file normalises line endings.
- The repository has a LICENSE.

## Regression Policy

- `TEST_PLAN.md` does not yet exist for this project and is created as part of
  this phase, covering the generate, crawl, introspect, run, report, and export
  flows currently exercised only by the automated suites.
- Add explicit regression cases to `TEST_PLAN.md` for: single-browser run
  completion after the Chromium scoping; in-process execution after proxy
  removal; and report rendering parity before and after decomposition.
- The decomposition tickets add no new test cases — they must pass the existing
  suite unmodified. Any change required to a test during decomposition is
  treated as a behaviour regression, not a test-maintenance task.
