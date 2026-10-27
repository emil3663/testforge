# Phase 47 Decision Record — TestForge in a Target's CI Pipeline

Date: 2026-10-27
Scope: TestForge runs as one step in another project's CI pipeline:
- a command crawls, generates and runs against a target, with no UI and no
  server;
- it ends with an exit code a pipeline acts on, and JUnit and HTML reports;
- a second run compares against the first, so known failures don't fail the
  build;
- it ships as a pinned Docker image and a GitHub Action.

Status: **Locked (Emil, 2026-10-27). Not started.**
- Cowork drafted Decisions 1 to 11 the same day; Emil confirmed every one as
  proposed, choosing option (a) for Decision 11.
- Phase 16 Decision 1 is amended in its own record, in the same change as
  this lock (Decision 3).
- Asked for from outside (2026-10-26: "can TestForge be integrated in a
  CI/CD pipeline?"). Written up as TFP-244 to TFP-249 in
  `workflow-and-ci-backlog-2026-10-26.md`; this record is TFP-244 and
  supersedes that backlog's Part 1.
- Order: Decision 11. Tickets TFP-263 and TFP-245 to TFP-249.

## Context

- **Phase 16 Decision 1 (2026-08-26)** made TestForge a local-only tool:
  `/api/run` executes the code it is given, accepted because the tool runs
  only on the tester's own machine. A CI runner is neither that machine nor
  the deferred SaaS (Decision 2 there): it is the target team's own
  machine, running TestForge for that team alone.
- **TFP-261 (`6d1e854`, 2026-10-27)** bound the server to loopback and
  guards every `/api/*` request. A CI run needs no server at all.
- **Everything goes through the UI today.** A run is three API calls
  (`/api/crawl`, `/api/generate`, `POST /api/run`, which returns a 202 job
  the UI polls). Nothing sets a process exit code.
- **Much of the orchestration lives inside the routes, not `src/lib`:**
  - `src/app/api/crawl/route.ts` (460 lines) holds the crawl loop, its job
    map and browser handling; `src/lib` has the pieces it calls
    (`introspect/routes`, `selection/*`);
  - `src/app/api/generate/route.ts` (290 lines) chooses between template,
    site-suite reuse, library, candidates, gap writer and models;
  - `src/app/api/run/route.ts` (205 lines) is thin: `startRunJob`
    (`src/lib/run/executor.ts`) does the work.
- **The benchmarks already run the whole pipeline without a server** —
  `benchmarks/2026-10-07-tfp175-selection/crawl-and-select.mts` and
  `benchmarks/2026-10-21-gate-d/generate.mts` import the route handlers
  in-process with a `NextRequest`. That proves it can be done; it is not a
  product interface.
- **Reports:** the executor already asks Playwright for its `json`
  reporter (`executor.ts:253`); the report is JSON plus an HTML export.
  No JUnit.
- **State:** runs, site suites and candidates live in the data folder
  (`src/lib/storage/data-dir.ts`; `TESTFORGE_DATA_DIR` overrides).
  `diffRuns(runIdA, runIdB)` (`src/lib/run/diff.ts`) compares two saved
  runs test by test. A CI runner starts empty every time.
- **Phase 39's host table** caps any non-local host at 3 workers sharing 5
  requests per second, and timed checks (load, LCP, CLS, TBT) are Not run
  under the cap. Only a local host (`localhost`, loopback, `*.localhost`,
  `*.test`) or a host with an ownership confirmation (Phase 43, not built)
  runs uncapped. In CI, a target started inside the same job on
  `localhost` is a local host; a preview deployment's URL is not.
- **The generated suite** imports only `@playwright/test`, so a saved
  suite can already run in any CI with `npx playwright test` — but without
  coverage, the gap list, reuse, diffing or gates. That stays the stopgap,
  documented, not the product answer.
- **No version exists to pin** (`package.json` 0.1.0, no tags): TFP-257.

## Decisions

1. **What runs in CI, first: Standard, read-only gate.** (Emil, 2026-10-27)
   - Comprehensive runs follow when D5's all-areas run exists; one
     Comprehensive area may be asked for by flag before that.
   - The interactive gate is opt-in by flag. The active gate never runs in
     CI before Phase 43 and TFP-249.

2. **The first supported target is one the job starts itself on
   `localhost`.** (Emil, 2026-10-27)
   - The usual pattern: build the app, start it in the job, test
     `http://localhost:<port>`. It is a local host, so it runs uncapped and
     timed checks are judged, and it needs no ownership confirmation.
   - A deployed URL (a preview environment) is allowed, and is capped like
     any remote host, with timed checks Not run and the report saying so,
     until Phase 43 gives it a confirmation.

3. **TestForge in CI is still single-user.** (Emil, 2026-10-27) Phase 16
   Decision 1 is amended, not reversed: TestForge runs on the tester's own
   machine *or on their own team's CI runner*, never as a shared service.
   - The CLI starts no HTTP server and opens no port of its own beyond
     Phase 39's slot server on loopback.
   - It executes only code it generated in that job, or the site suite
     restored from that team's own state.
   - Credentials come only from the pipeline's secrets as environment
     variables (Phase 20), redacted from every output.

4. **One pipeline, two front ends.** (Emil, 2026-10-27) The crawl, generate and run
   orchestration moves out of the API routes into `src/lib/pipeline/`. The
   routes and the CLI both call it; neither has its own copy.
   - Rejected: the CLI importing route handlers in-process, as the
     benchmarks do — fast to build, but it ties the CLI to Next.js request
     objects and to route internals.
   - The move is behaviour-preserving (`behavior-preservation-verification`
     skill): template output byte-identical on every fixed input, and the
     UI's runs unchanged.

5. **What fails the build.** (Emil, 2026-10-27)
   - Exit `0`: no new failures. `1`: test failures. `2`: couldn't run
     (target unreachable, crawl found nothing, browser failed) — never a
     pass. `3`: invalid configuration.
   - **With a baseline**, only failures the baseline didn't have fail the
     build; known failures, fixed tests and findings are reported.
   - **Without a baseline** (a first run), any failing test fails the
     build; `--report-only` reports and exits `0` unless it couldn't run.
   - Findings (SEO, usability, performance improvements) never fail the
     build.
   - Rejected: a first run that only reports by default — a broken site
     would pass its first CI run.

6. **Where state lives between runs.** (Emil, 2026-10-27) The data folder is
   pointed at a workspace folder (`--data-dir`) that the pipeline restores
   before the run and saves after it (a CI cache or artifact). Committing a
   site suite into the target's repo is documented as an alternative for
   teams that want to review it.
   - Rejected as the default: committing state to the target's repo, since
     every run's changes would become commits someone has to make.

7. **Outputs, in `--out`:** `report.json` (today's report, plus the
   TestForge version and commit), the HTML export, JUnit XML, the executed
   `suite.spec.ts`, and evidence for failing tests only. Redaction applies
   to every file. (Emil, 2026-10-27)

8. **Distribution: a Docker image first, an npm package later.**
   (Emil, 2026-10-27)
   - The image pins Node, Playwright and Chromium, so "the same site gives
     the same suite" holds between machines. Published to GitHub's
     container registry, tagged with the TestForge version (TFP-257).
   - An npm package is deferred (D32): it would leave Chromium's version to
     the runner.

9. **No model in CI.** (Emil, 2026-10-27) The gap writer, the local model and the
   OpenAI path are off in CI in this phase, whatever the site's settings
   say. Candidates and promoted library entries still run: they are
   committed code, not model calls.

10. **GitHub Actions first.** (Emil, 2026-10-27) A composite action wraps the
    image. Other CI systems run the image with the documented command; the
    guide doesn't claim support it hasn't tested.

11. **Order: after Phase 39, before Phase 43.** (Emil, 2026-10-27)
    - Decisions 1 and 2 need nothing from Phase 43, and this answers the
      outside request soonest. TFP-249 waits for Phase 43.
    - Rejected: after Phase 43 (a deployed URL would get performance judged
      from the start, but the request waits longer); after the Standard
      sets (CI much later).

## Acceptance Criteria

1. **The pipeline move (TFP-263)**
   - Template output is byte-identical against the recorded baseline on
     every fixed input (`npm run check:template-unchanged`).
   - The self-test and regression suites pass in full.
   - `src/app/api/crawl/route.ts` and `generate/route.ts` hold request
     parsing and responses only; no crawl loop or generator choice remains
     in them.

2. **The CLI (TFP-245)**
   - Against local Toolshop **clean**: exit `0`; JUnit counts equal
     `report.json`'s.
   - Against local Toolshop **with-bugs**: exit `1`; the failing JUnit cases
     are the report's failing tests.
   - An unreachable URL: exit `2`. A malformed config: exit `3`, naming the
     field.
   - For the same site and inspection, the CLI's suite is byte-identical
     to the UI's.
   - No port is opened other than Phase 39's loopback slot server
     (checked while a run is in progress).

3. **Baselines (TFP-246)**
   - with-bugs twice, the first as baseline: the second exits `0` and
     lists every failure as known.
   - One bug fixed in the local copy: reported fixed, exit `0`. One new
     defect planted: exit `1`, naming only that one.
   - A changed page type is regenerated, not failed (RUN-30's behaviour).

4. **The image (TFP-247)**
   - Criterion 2's clean and with-bugs checks give the same results from
     the image as from a local run.
   - The release workflow runs the built image and asserts on its output,
     so a green release could have gone red (`verified-release-pipeline`
     skill).

5. **The action (TFP-248) — Gate A**
   - In TestForge's own CI, the action runs against local Toolshop clean
     and with-bugs started in the job: clean passes, with-bugs fails, both
     reports are attached, and a job summary is written.
   - A wrong target URL turns the job red with exit `2`.

## Regression Policy

- Each ticket adds its cases to `TEST_PLAN.md` in the same commit (a new
  `CI-` prefix; in its own area file if TFP-253 has split the plan by
  then).
- TFP-263's proof is the template check plus the existing self-test and
  regression suites, unchanged; it adds no new cases of its own.

## Related, deferred (not this phase)

- **Active and interactive gates against deployed URLs in CI**: TFP-249,
  after Phase 43.
- **An npm package** (Decision 8).
- **Models in CI** (Decision 9): revisit after Phase 45's sandbox.
- **Comprehensive all-areas in CI**: with D5.
- **Other CI systems' native integrations** (GitLab component, Azure task).
- **SARIF output** for GitHub code scanning, from Comprehensive security
  findings.
- **Performance on a capped deployed URL** before Phase 43: D30's solo
  performance pass covers it when built.

Each of these is entered in `deferred-work-register.md` (D31 to D35) in
the same change as this lock.

## Dependencies and order

- TFP-257 (versioning, steps 1–5) before TFP-247.
- TFP-263 before TFP-245; TFP-245 before TFP-246 and TFP-247; both before
  TFP-248.
- Not during a measurement series: TFP-263 changes code every run uses,
  so it lands between Phase 39's sessions or after them, never in the
  middle of one.

## Backlog

TFP-245 to TFP-249 are as written in `workflow-and-ci-backlog-2026-10-26.md`
Part 1, with these changes once this record locks:
- TFP-245 calls `src/lib/pipeline/` (Decision 4) instead of reimplementing
  anything, and opens no server.
- TFP-246's baseline uses `diffRuns` on runs restored from the data folder.
- TFP-247 publishes to GitHub's container registry.

### TFP-263 - Move crawl and generate orchestration out of the API routes

- **Phase:** 47
- **Priority:** P0
- **Suggested labels:** `refactor`, `ci`
- **Problem it solves:** the crawl loop and the generator choice live
  inside two Next.js route handlers, so a CLI could only use them by
  faking HTTP requests. One shared module keeps the UI and CI producing the
  same suite from the same site.
- **Scope:**
  - `src/lib/pipeline/crawl.ts`: the crawl and selection, with progress and
    cancellation as callbacks, no job map;
  - `src/lib/pipeline/generate.ts`: today's generate route body, taking a
    plain object, returning the suite and its generation record;
  - the routes keep the job map, request parsing and responses;
  - nothing else changes.
- **Deliverables:** the two modules; thinner routes; their unit tests
  moved with the code they test.
- **Acceptance criteria:** Acceptance Criteria 1.
- **Dependencies:** None. Not during a Phase 39 measurement session.

## Recommended Execution Order

1. TFP-257 steps 1–5 (independent).
2. TFP-263.
3. TFP-245.
4. TFP-246 and TFP-247.
5. TFP-248 — Gate A.
6. TFP-249 after Phase 43.

## Suggested Milestone Gates

### Gate A — TestForge runs in a pipeline
- Acceptance Criteria 1, 2 and 5 met; independent verification of the exit
  codes and the JUnit counts.

### Gate B — A second run can be trusted
- Acceptance Criteria 3 met.
