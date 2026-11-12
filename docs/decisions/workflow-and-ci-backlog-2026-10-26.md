# Workflow, documentation and CI integration backlog (2026-10-26)

**Status:** Draft, proposed in a planning session 2026-10-26. Nothing here
is locked. The CI tickets (TFP-244 to TFP-249) need their own decision
record before they are built; TFP-244 is that record. The rest are small and
can be picked up between Phase 39's tickets, after TFP-157's verification.

**Ticket numbers:** TFP-244 to TFP-257, allocated against `main` at
`8e93998` (highest then: TFP-243); TFP-259 and TFP-260 added 2026-10-27
(TFP-258 was taken meanwhile); TFP-261 and TFP-262 added 2026-10-27; TFP-268 to TFP-270
added 2026-11-03 (highest then: TFP-267); TFP-271 added 2026-11-04; TFP-272 added 2026-11-08. Re-check before committing; renumber if
another session took any of them.

**Why this exists:**
- the owner was asked whether TestForge can run in a CI/CD pipeline;
- a documentation pass found docs an enterprise or system architect would
  read first that are missing, stale, or describe another project;
- the working agreement was rewritten (`docs/WORKING_AGREEMENTS.md`) and
  some of what it adopts needs code, config or a larger edit.

---

## Part 0 — Found 2026-10-27, fix first

### TFP-261 - Make the server reachable from this machine only, and refuse cross-site requests

- **Phase:** None — fix before anything else in this backlog
- **Priority:** P0
- **Suggested labels:** `security`, `bug`
- **Problem it solves:** the README's security model says TestForge must
  never be reachable beyond the tester's own machine, because `/api/run`
  executes the code it is given. Two things contradict it today, both
  measured 2026-10-27 on `6bd7fc0`:
  - **It listens on every interface.** `npm run dev` and `npm start` run
    `next dev` / `next start` with no hostname, and Next.js defaults to
    `0.0.0.0`; the dev server announces a Network address. Anyone on the
    same network who can reach port 3000 can call the API.
  - **The API accepts cross-site requests.** No route checks `Host` or
    `Origin`, and `POST /api/run` parses its body with `req.json()`
    whatever the `Content-Type`. A `POST` carrying a foreign `Origin` and
    `Content-Type: text/plain` — the kind of request any web page can send
    without a CORS preflight — was accepted (202) and the code in it ran.
    Whether a given browser will send it to `localhost` depends on the
    browser (current Chrome asks the user first for public sites reaching
    local addresses; not every browser does). A missing `Host` check also
    leaves DNS rebinding open.
- **Scope:**
  - bind to loopback: `-H 127.0.0.1` on `dev`, `dev:development` and
    `start` (the self-test scripts already do);
  - one request guard for every `/api/*` route (Next's `proxy`/middleware):
    refuse when `Host` isn't `localhost`, `127.0.0.1` or `[::1]` on the
    server's port; refuse when `Origin` is present and isn't the same
    origin; refuse a `POST`, `PUT` or `DELETE` that isn't
    `Content-Type: application/json`. Refusals are 403 with a message that
    says why;
  - the UI's own requests keep working unchanged.
- **Acceptance criteria:**
  - the dev server's startup output shows no LAN address, and the port
    isn't reachable on the machine's LAN address (reworded, owner
    decision 2026-10-27: Next.js still prints a "Network:" line, which
    names the bound loopback address);
  - regression tests: the 2026-10-27 request (foreign `Origin`,
    `text/plain`) gets 403 and runs nothing (checked with a marker the code
    would have written); a foreign `Host` gets 403; a same-origin JSON
    request from the UI still gets 202;
  - the self-test and regression suites pass unchanged.
- **Dependencies:** None. `SECURITY.md` (TFP-254) describes the server as
  it is *after* this ticket, so it is committed with or after this fix,
  never before.
- **Done 2026-10-27:** `6d1e854` (the fix, RUN-43), then `SECURITY.md`
  and `CONTRIBUTING.md` (`c284e82`). The startup criterion reworded to
  "no LAN address" (owner decision, 2026-10-27).

#### RUN-43 evidence

Moved word for word from [`docs/test-plan/RUN.md`](../test-plan/RUN.md) by TFP-253; the case's row there links here.

**Test:** The API answers only the tester's own pages on this machine (TFP-261, P0; unit: `src/proxy.test.ts`; regression: `tests/regression/testforge.request-guard.spec.ts`, the built server)

**Expected result:** `npm run dev`, `dev:development` and `start` bind to `127.0.0.1`, so the port isn't reachable on the machine's LAN address. A request guard (`src/proxy.ts`, Next's proxy, on every `/api/*` route) refuses with 403 and the reason: a `Host` that isn't `localhost`, `127.0.0.1` or `[::1]` (DNS rebinding); an `Origin` that isn't the same origin, port included (another site's page in the tester's browser); a `POST`, `PUT`, `PATCH` or `DELETE` that isn't `Content-Type: application/json`, which a page can't send cross-site without a preflight. Measured 2026-10-27 before it: a `POST /api/run` with a foreign `Origin` and `text/plain` was accepted (202) and its code ran. The port isn't checked: a loopback `Host` comes only from this machine, and the `Origin` check compares the whole origin. **Proven (decision table):** each loopback name with and without a port goes on, other names or none are refused; the same origin goes on, another site, another port or `null` is refused; every write method needs JSON (a charset parameter allowed), a read needs no type. **Proven (regression, the built server, with a positive control):** in one test, the 2026-10-27 request (another site's `Origin`, `text/plain`) and a same-origin `text/plain` one each get 403 with their reason, then the same suite sent as the UI sends it (same `Origin`, JSON) gets 202 and writes its marker file; once that control run has finished, and 5 s more, neither refused request's marker exists (a run either had started would have been queued before the control's); a request naming another host gets 403. **Observed:** `npm run dev` on port 3105 listened on `127.0.0.1:3105` only, answered on `127.0.0.1` and `localhost`, and got no connection on the LAN address. Its startup still prints "Network: http://127.0.0.1:3105": Next.js names the bound address, loopback, and no LAN address appears, which meets the criterion as reworded (owner decision, 2026-10-27: "no LAN address", not "no Network line"). **Next's Proxy bypasses (TFP-266, Next 16.4.3):** the regression spec sends the shapes that can apply to an API route from another host (GHSA-267c-6grr-h53f and GHSA-26hh-7cqf-hhc6's `.rsc` and segment-prefetch variants, a route parameter in the query, spellings of the path) and a POST to `/api/run.rsc` from another site, each pinned to the status measured: 403 from the guard for 8, Next's 308 to `/api/runs` for 3 (which the guard then refuses), the 404 page for `/API/runs`. GHSA-492v-c6pp-mqqv can't apply: `src/app/api` has no dynamic route. GHSA-6gpp-xcg3-4w24 can't apply: `next.config.ts` has no `i18n`. These cases pin the guard; they don't show the upgrade fixed it: every shape gets the same status on 16.2.3 and 16.4.3 (2026-10-31), as the advisories describe pages, not route handlers. Without the guard (16.2.3): `/api/runs?_rsc=1` 200 with the runs, the `.segment.rsc` path 204, the diff path its own 400, and 5 others 404 instead of 403.

---

### TFP-266 - Upgrade Next.js and clear the known dependency vulnerabilities (added 2026-10-30)

- **Status:** Built `5a93ecc`, `1a9c2f5` (2026-10-31). **Independently
  verified 2026-10-31 (Cowork, Linux, fresh clone at `1a9c2f5`):** `next`
  16.4.3; `npm audit --omit=dev`: 0 vulnerabilities; the 2026-10-27 attack
  replayed against `npm run dev` on 16.4.3 — a foreign-origin `text/plain`
  POST, a same-origin `text/plain` POST, a rebinding `Host`, a `null`
  `Origin`, `/api/runs?_rsc=1` from a foreign origin, and an RSC-prefetch
  request with a rebinding `Host` — all 403, the run's marker file never
  written, the LAN address not answering; `src/proxy.test.ts` 5 of 5; no
  generator file changed. Rulings (Emil, 2026-10-31):
  - **Accepted.** The bypass cases pin the guard; the builder showed 10 of
    15 fail without it.
  - **The remaining advisories are dev-only and accepted for now**: all of
    Allure's chain (its latest release still pulls a vulnerable
    `dompurify`), and ESLint's (`minimatch`, `glob`). `npm audit` on
    `1a9c2f5` here shows 27 by package: 7 critical, 1 high, 19 moderate —
    the builder's "8" counted critical and high only. Re-checked when Allure
    or ESLint publish fixes; no `overrides`.
  - **Dependabot hasn't rescanned since 2026-10-28 07:31** ("Dependency
    files checked", read in the owner's browser 2026-10-31 03:15): its 114
    open alerts are from `70a0ad3`, before the upgrade, and several pushes
    since haven't triggered a check. If it hasn't rescanned by the next
    session, turning Dependabot alerts off and on in the repo's settings
    forces one (owner's go-ahead first).
    **2026-10-31, 06:40 (owner's go-ahead):** Dependabot alerts turned off
    and on in the owner's browser (security updates left off). Half a
    minute later "Dependency files checked" still read 2026-10-28; the
    dependency graph itself had re-read `package-lock.json` on 2026-10-30.
    Re-checked after `v0.2.0`; if it is still stale a day later, ask GitHub
    support.
  - **The SEO page-selection gap** (the `useRun.ts` effect removed in
    `5a93ecc`): a unit test of the derived selection — the first group
    when none or a vanished one is selected, the chosen one otherwise —
    lands with TFP-267's first commit.

- **Phase:** None — straight after Phase 39 is verified complete
- **Priority:** P0
- **Suggested labels:** `security`, `dependencies`
- **Problem it solves:** GitHub's Dependabot flagged the repo, and
  `npm audit` on `211a4a7` (2026-10-30) gives 23 advisories: 2 critical, 17
  high, 3 moderate, 1 low; 7 of them in packages the app runs
  (`--omit=dev`). The one that matters is **`next` 16.2.3**, with 33
  advisories fixed by **16.4.3** (not a major version):
  - several **Middleware / Proxy bypasses** (GHSA-267c-6grr-h53f,
    GHSA-26hh-7cqf-hhc6, GHSA-492v-c6pp-mqqv, GHSA-6gpp-xcg3-4w24). TFP-261's
    request guard *is* a Next Proxy (`src/proxy.ts`), so a bypass could undo
    it;
  - **unauthenticated RCE on Windows-hosted servers** (GHSA-p293-qw3h-jr36),
    and TestForge runs on Windows.
  Others need features TestForge doesn't use (`next/image`, `next/og`,
  `use cache`, Server Actions): no file in `src/` uses them. Loopback
  binding (TFP-261) limits who can reach the server, but not a page in the
  tester's own browser if the guard is bypassed.
  The rest are transitive: through `next` (sharp, postcss, zod, nanoid,
  source-map-js, baseline-browser-mapping) and through dev tooling
  (Allure's `handlebars` and `adm-zip`, `axios`, `markdown-it`, and others),
  each with a non-major fix.
- **Scope:**
  - `next` and `eslint-config-next` to 16.4.3 or later (read
    `node_modules/next/dist/docs/` for changes, per `AGENTS.md`);
  - `npm audit fix` for the rest, without `--force`; anything it can't fix
    without a major version is listed, not forced;
  - a nightly check: `npm audit --omit=dev --audit-level=high` fails the
    nightly (with `shell: bash`), so the app's own dependencies can't drift
    back unnoticed;
  - SECURITY.md's "dependencies are not scanned automatically" gap updated
    (Dependabot alerts and the nightly check).
- **Acceptance criteria:**
  - `npm audit --omit=dev` reports no critical or high advisory;
  - the request-guard regression spec and `src/proxy.test.ts` pass on the
    new Next, and a request through each bypass's documented shape that
    applies to an `/api/*` route is still refused (or the ticket says why a
    shape can't apply);
  - template check byte-identical; unit and regression suites pass in full;
    the self-test build and `npm run dev` start, bound to `127.0.0.1`;
  - the remaining advisories (dev-only, or no non-major fix) listed in the
    commit body.
- **Dependencies:** Phase 39 verified complete.

---

### TFP-267 - Code scanning: fix the real findings, quiet the noise (added 2026-10-30)

- **Status:** Built `cad75ad`, `1551810`, `24c4449`, `b65020a`, `e8a52c7`
  (2026-10-31); CodeQL moved to advanced setup in `31eae23` (5,000 alerts to
  16; none under `benchmarks/` or `examples/`). **Verified 2026-10-31
  (Cowork, Linux, `e8a52c7`):** `check:template-unchanged 1a9c2f5 e8a52c7`:
  4 of 166 differ, and every changed line read: the link selectors'
  `.replace(/["\\]/g, '\\$&')` (escapes `"` and `\`; the old one escaped
  nothing) and the helper comment's reworded provenance — nothing else;
  link-audit, persistence, runs-route and SEO-selection tests 77 of 77,
  the stray-folder skip included. Rulings (Emil, 2026-10-31):
  - **#1 (`persistence.ts`, path injection) is fixed, not dismissed:** add
    a containment check CodeQL recognises — the resolved run path must stay
    inside the runs root — beside the UUID check, so the scanner keeps
    guarding that file; it closes on the next scan.
  - **The other 13 are dismissed with these reasons:** #12–#15 false
    positive (inert links skipped in a same-origin crawl; nothing rendered
    or executed from them); #2 false positive (a heuristic scoring generated
    code, not a filter); #7, #8 won't fix, by design (`skills/` ships in the
    plugin; the pattern is built from `caseIdCore`, a deliberate caller
    option); #4, #5, #9, #11 used in tests; #5891, #5892 used in tests
    (the local comparison fixture, dev only).
  - **The audit count:** the builder's correction in `e8a52c7` stands (its
    "8" was npm's total on 30 Oct; the 19 moderates are newer advisories).
  - Done when the next scan shows no open alert that isn't dismissed.

- **Phase:** None — after TFP-266
- **Priority:** P1
- **Suggested labels:** `security`, `generate`, `ci`
- **Problem it solves:** GitHub's code scanning (CodeQL, default setup) shows
  about 5,000 open alerts (read 2026-10-30 in the owner's browser): 0
  critical, 18 high, the rest medium or lower. Almost all are in
  `benchmarks/` (frozen copies of generated suites). GitHub's own
  production-code filter (`autofilter:true`, excluding tests and generated
  files) leaves 13. Triage, by reading each one's code on `211a4a7`:
  - **Real, in every generated suite — "Replacement of a substring with
    itself":** the link checks' selector escaping in
    `src/lib/generate/mock/link-audits/detail-tests.ts` (lines 23, 41, 61,
    94) and `experience-tests.ts` (213). Inside the template literal,
    `.replace(/"/g, '\\"')` writes `.replace(/"/g, '\"')` into the suite,
    which in the suite is `"` replaced by `"`: nothing is escaped, and
    backslashes aren't either. A link whose `href` contains `"` or `\`
    produces an invalid selector, so its link test fails on TestForge's own
    error, not the site's. This is where most of the benchmark alerts come
    from (thousands of copies).
  - **Hardening, low risk:**
    - `src/lib/generate/mock/index.ts:117` (alert #10): `hostname.includes("demoqa.com")`
      also matches `demoqa.com.example`; use an exact host or a `.demoqa.com`
      suffix;
    - `src/lib/run/persistence.ts:181` (#1, path injection): every API
      caller already checks `isValidRunId` (UUID) first; also check inside
      `runJsonPath`, so a future caller can't skip it;
    - `src/lib/generate/mock/journey-tests.ts:26` (#3): the attribute name
      escapes `:` only; escape it properly for CSS. It is then quoted as a
      JS string, so this is selector correctness, not code injection.
  - **By design or false positives, dismissed in GitHub with the reason:**
    - `src/lib/introspect/dom-snapshot.ts` 517, 650, 680 and
      `src/app/api/crawl/route.ts:188` ("incomplete URL scheme check"): the
      crawl follows same-origin http(s) links only, and these lists skip
      inert links; nothing is rendered or executed from them;
    - `src/lib/generate/benchmark-quality.ts:28` ("bad HTML filtering
      regexp"): a heuristic that scores generated code, not a filter;
    - `scripts/comparison-fixture.mjs` 412, 435: the local test fixture,
      dev only;
    - the test files and `skills/` helper scripts (#4, #5, #7, #8, #9,
      #11): test-only code.
  - **Noise:** `benchmarks/` and `examples/` are evidence, never edited.
- **Scope:** fix the escaping in the generator (with real-browser cases:
  an `href` containing `"`, and one containing `\`, are found and checked);
  the three hardening items; then — **owner decision** — move CodeQL from
  default to advanced setup with a committed config that ignores
  `benchmarks/**` and `examples/**` (default setup can't exclude paths), and
  dismiss the by-design alerts with their reasons.
- **Acceptance criteria:**
  - the generated link checks escape `"` and `\` (unit and real-browser);
  - `check:template-unchanged` shows only the escaping lines changed;
    `TEMPLATE_BASELINE` re-recorded in its own commit;
  - after the next scan, the production-code view (`autofilter:true`) shows
    no open alert that isn't dismissed with a reason;
  - unit and regression suites pass in full.
- **Dependencies:** TFP-266. The baseline moves once, together with the
  helper-lines change if they land close together.

#### GEN-106 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** A link with no text is found by its href, whatever the href holds, and generated selectors and hosts are matched exactly (TFP-267; unit: `src/lib/generate/mock/link-audits/href-escaping.test.ts`, in a real browser; `demoqa-host.test.ts`; `journey-tests.test.ts`)

**Expected result:** The link checks build `a[href="..."]` inside the generated suite. Inside the generator's template literals `'\\"'` wrote `'\"'` into the suite, which there is just `"`, so the replace did nothing (CodeQL: "replacement of a substring with itself"). An href holding `"` broke the selector, one holding `\` matched nothing, and the check failed on TestForge's own error, not the site's. Fixed on 11 lines in four files: the ticket's five, and `coverage-tests.ts` (4), `experience-tests.ts:214` and `reveal.ts` (1 each), which it didn't list; `format.ts`'s `escapeForDoubleQuotedSelector` was already right. **Proven (real browser):** textless links with a `"`, a `\`, both, and a `\` at the end are found; on the old code those 4 fail and an href with neither passes. Also: DemoQA's suites go only to `demoqa.com` and hosts under it, not `demoqa.com.example`; a journey step's attribute name is escaped for CSS whatever it holds, not just `:`. Template: 4 of 166 inputs change, 54 selector lines and, with TFP-250's helper wording, 4 comment lines, and nothing else.

---

## Part 1 — TestForge in a target's CI pipeline (proposed Phase 47)

> **Locked 2026-10-27 as Phase 47** (`phase-47-ci-integration-decision-record.md`).
> The record's Decisions and Acceptance Criteria govern; TFP-244 is done (the
> record itself). The tickets below stand with the record's changes: a new
> P0, TFP-263, moves the crawl and generate logic into `src/lib/pipeline/`
> first; TFP-245 calls it and opens no server; TFP-246 uses `diffRuns`;
> TFP-247 publishes to GitHub's container registry. Order: after Phase 39,
> before Phase 43.

### Where it stands today

- **TestForge's own CI exists:** PR validation, regression, self-test and
  nightly workflows in `.github/workflows/`.
- **Running TestForge as a step in someone else's pipeline is not possible
  yet.** Everything goes through the Next.js server and the UI: a run is
  three API calls (`/api/crawl`, `/api/generate`, then `POST /api/run`, which
  returns a 202 job that the UI polls). Nothing sets a process exit code;
  the report is JSON and HTML only; site suites and run history live in a
  local data folder that a CI runner wipes; ownership confirmation (Phase 43)
  is designed as a local, interactive step.
- **What works today, as a stopgap:** a generated suite is self-contained
  Playwright (it imports only `@playwright/test`). Save it, commit it to the
  target's repo and run `npx playwright test` in that repo's CI. This gives
  pass/fail on a frozen suite, and loses everything that makes TestForge
  TestForge: honest coverage, the gap list, suite reuse and regeneration on
  changed pages, run diffing, and the gates. It is worth saying when asked;
  it is not the product answer.

### TFP-244 - Decision record: TestForge in CI

- **Phase:** 47 (proposed)
- **Priority:** P0
- **Suggested labels:** `decision`, `ci`
- **Problem it solves:** Phase 16 locked TestForge as local-only, with
  `/api/run`'s code execution accepted under that model. Running on a
  target's CI runner is neither local nor the deferred SaaS, and it changes
  where state lives and what "failed" means. Those are owner decisions and
  need recording before anything is built.
- **Scope:** decide and record:
  - the first CI scope (proposed: Standard at the read-only gate only;
    interactive opt-in by flag; active not before TFP-249);
  - the trust model on a runner: the target's own CI, the target's own
    secrets, TestForge executing only code it generated in that job;
  - what fails the build (proposed: new failures against the baseline;
    known failures and findings are reported, not failing; a "couldn't run"
    is its own exit code, never a pass);
  - where the baseline and site suite live (target repo, CI cache or
    artifact);
  - distribution (npm package, Docker image, or both) and versioning
    (TFP-257);
  - whether the gap writer and local model are ever allowed in CI
    (proposed: no, for the first slice).
- **Deliverables:**
  - `docs/decisions/phase-47-ci-integration-decision-record.md`, locked;
  - an amendment note on Phase 16's local-only decision.
- **Acceptance criteria:**
  - each bullet in Scope has a recorded decision with its date, or is
    explicitly deferred with a reason;
  - the record names the measurement Gate A will use (see TFP-248).
- **Dependencies:** None.

### TFP-245 - Headless runner with a verdict, exit codes and JUnit output

- **Status:** Done 2026-11-08: `2c4b6f3`, verified (Cowork, 2026-11-08) after
  the fixes below. **First pass:** on a Linux clone (2
  cores), the uncommitted files on `6b617b2`: an unreachable URL exits `2`;
  a config with an unknown area exits `3`, naming `practices[0]`; the CLI,
  junit, config, run and pipeline tests pass, **except four server tests
  that fail on every Linux run** (an interrupt's stop, `stopAllServers`, a
  port already in use, and, intermittently, "once stopped nothing
  listens"). Measured: `stopServers` returns after the shell exits and
  before the killed process group has gone; the server's port still
  answers at +0 ms and is free by +100 ms. CI runners are 2-core Linux, so
  this is the platform that matters. A fifth, the IPv6 loopback test,
  fails where `::1` can't be bound (`EAFNOSUPPORT`). Fixes: `stopServers`
  waits, bounded, until each process group has gone; the IPv6 test skips,
  with its reason, where `::1` isn't available. Read: `Not run` never fails
  the build and becomes `<skipped>` in JUnit; `Blocked` fails it and
  becomes `<error>`; `--report-only` turns test failures into exit `0`.
  Claude Code's Toolshop runs, the UI-versus-CLI byte comparison, the port
  sampling and the full suites weren't re-run here (no Docker here).
  **Rulings (Emil, 2026-11-08):** (1) criterion 2's "clean: exit `0`"
  contradicts Decision 5 (no baseline: any failing test fails) on a site
  with 46 real failures; it becomes "clean: exit `1`, JUnit counts equal
  the report's; with `--report-only`, exit `0`" (the record's criterion 2,
  amended), and "clean exits `0`" moves to TFP-246 (clean, with its own
  baseline); (2) `Blocked` fails the build, `Not run` doesn't; (3) the
  default practices are all ten areas; (4) the stop order (stdin, SIGTERM,
  then the tree after 30 s); (5) `page-data.json` in `--out`, redacted as
  every other file (Decision 7), and `serve-toolshop.mjs --ready-port`; (6)
  Claude Code's `CLAUDE.md` line on jobs past 1.5x their projection.
  **Fixed after verification (2026-11-08):** `stopServers` waits, up to
  5 s, until each server's process group has gone (Windows: its shell);
  the IPv6 test skips, with its reason, where `::1` can't be bound;
  `page-data.json`'s redaction has its own test. **Re-verified (Cowork,
  2026-11-08)** on the same 2-core Linux clone, the fixed files on
  `6b617b2`: the server and exit tests 5 runs in a row, each 6 passed, 0
  failed, 1 skipped (`# SKIP IPv6 loopback ::1 can't be bound on this
  machine (EAFNOSUPPORT)`); all CLI, pipeline and introspect tests 40
  passed, 0 failed, 1 skipped; `check:template-unchanged 6b617b2`: 172
  inputs, 172 identical; `tsc` exit 0. Claude Code's clean `--report-only`
  run (exit `0`, 470 tests, 46 failures, 0 errors, 18 skipped, matching the
  report) wasn't re-run here.
- **Phase:** 47
- **Priority:** P0
- **Suggested labels:** `ci`, `run`, `report`
- **Problem it solves:** a pipeline needs one command that runs crawl,
  generate and run without a UI or a long-lived server, and a result a
  pipeline can act on. Today the result exists only as JSON for the UI.
- **Scope:**
  - a CLI entry point (e.g. `npx testforge run --url <base> --mode standard
    --out <dir>`), plus a config file for anything longer than a flag
    (login config, page cap, selected practices);
  - calls the same `src/lib` modules the API routes use — no second
    implementation of generation or running;
  - exit codes: `0` passed (no new failures); `1` test failures; `2`
    couldn't run (target unreachable, crawl found nothing, browser failed);
    `3` invalid configuration;
  - outputs in `--out`: `report.json` (the existing report), the HTML export,
    a JUnit XML file, the executed `suite.spec.ts`, and evidence for
    failures;
  - credentials only from environment variables, as today (Phase 20);
    redaction applies to every output file.
- **Deliverables:** the CLI, its unit tests, a `README.md` section.
- **Acceptance criteria:**
  - against local Toolshop **clean**: exit 1, and the JUnit file's counts
    equal `report.json`'s; with `--report-only`, exit 0 (amended 2026-11-08,
    Emil: clean exits 0 with its baseline in TFP-246);
  - against local Toolshop **with-bugs**: exit 1, and the failing JUnit
    cases name the same tests as the report;
  - against an unreachable URL: exit 2, never 0;
  - a malformed config: exit 3 with a message naming the field;
  - template output for the same site is byte-identical to the UI path
    (`check:template-unchanged`'s inputs).
- **Dependencies:** [TFP-244]

### TFP-246 - Baselines and state on an ephemeral runner

- **Status:** Done 2026-11-08: `9dca554`, verified (Cowork, 2026-11-08)
  after the rulings below. **Re-verified** on a Linux clone, the
  updated files on `653aaf2`: the CLI, diff, persistence and runs-route
  tests 78 passed, 0 failed, 1 skipped (IPv6, its reason given);
  `check:template-unchanged 653aaf2`: 172 identical; `tsc` exit 0. Read:
  `pageTypeTitles` replaces a whole path only (not inside `/en/product/1`
  or `/product/1.html`) and keeps exact paths for a type any one run tested
  twice; `latest` refuses a verdict with exit `2` or new failures, and
  takes exit `0`, a first run, or a UI run. Claude Code's clean-twice runs
  across two Toolshop starts (exit `1`, then `0` with 0 new and 46 known)
  weren't re-run here. **First pass:** `--baseline <run.json | latest>` compares
  through `diffRuns`, which gains `failures` (known, new, fixed); only new
  failures fail the build; `--out` gains `run.json` and `baseline.json`.
  **Verified** on a Linux clone, the uncommitted files on `653aaf2`: the
  CLI, diff and diff-route tests 52 passed, 0 failed, 1 skipped (the IPv6
  test, its reason given); `check:template-unchanged 653aaf2`: 172
  identical; `tsc` exit 0. Read: `diffFailures` keys on (browser, title);
  Failed and Blocked count as failing; a failing duplicate title wins over
  a passing one. Claude Code's Toolshop cases (with-bugs twice 0, one fixed
  0, one planted 1 naming only `TFSE-040`, a page type changed 0, clean
  twice 0 on one start) and its unit run (781 of 781) weren't re-run here.
  **Rulings (Emil, 2026-11-08, as recommended):** (1) **before the commit,** a test is
  matched by its page type, not its exact path: `/product/<id>` gets a new
  id on every Toolshop start, so a fresh start in each CI job (Decision 2)
  shows 4 "new" failures that aren't; titles are compared with each page's
  path replaced by its page-type pattern, as site-suite reuse groups
  pages, and the clean-twice case is re-run across two starts; (2)
  `latest` skips a run whose verdict was failing (each `run.json` records
  its verdict), so a failure can't become known by being saved; (3)
  criterion 3 is met: the changed type was regenerated at generation
  (RUN-29) and only it, and the stale recheck ran with nothing to do
  (CI-17 says so); (4) `run.json` and `baseline.json` join Decision 7's
  outputs, and `/api/runs/diff` gains `failures` (an addition); (5) the
  current run's titles are redacted the same way before comparing, so a
  title quoting a login value matches its redacted baseline. **Built
  (Claude Code, 2026-11-08):** (1) `pageTypeTitles` in `src/lib/run/diff.ts`,
  over both runs' pages, used for `failures` only (the diff's other lists are
  unchanged); (2) `verdict` (`exitCode`, `baselineRunId`, `newFailures`) on
  the saved run and in `--out/run.json` (with `firstRun`); "failing" read
  as: failed on a new failure against its baseline, couldn't run, or
  failed without `--baseline`; a first run (`--baseline latest` with none
  yet), which fails on its own failures, stays a baseline (Decision 5), and
  a run with no verdict (the UI's) is accepted; (5) `diffRuns(..., {
  redact })`. A second fresh-context review's fixes: a path is matched
  whole (not after `/en`, nor before `.html`); a type of which either run
  tested two pages keeps exact paths (merged, a failure moving between the
  two would read as known); a verdict that can't be saved is said and the
  reports are still written. **Left for Emil:** once a real new failure
  lands, `latest` stays on the last accepted run until the failure is
  fixed, or accepted by giving that run's `run.json` as `--baseline`; two
  processes sharing one data folder can race on a record's write (TFP-198's
  one-process assumption).
- **Phase:** 47
- **Priority:** P1
- **Suggested labels:** `ci`, `site-suites`
- **Problem it solves:** without the previous run and the site suite, every
  CI run regenerates from scratch and every known failure fails the build.
  Phase 42's reuse and Phase 17's diff are what make CI results trustworthy
  rather than noisy.
- **Scope:**
  - `--data-dir` (or `TESTFORGE_DATA_DIR`) pointed at a workspace folder
    that the pipeline restores and saves (cache or artifact), per the
    TFP-244 decision;
  - `--baseline <run.json>`: compare with the run diff and fail only on new
    failures; report fixed, still-failing and new separately;
  - a documented way to commit a site suite into the target's repo when the
    team prefers that over a cache.
- **Deliverables:** the flags, unit tests, a docs section.
- **Acceptance criteria:**
  - two consecutive runs on with-bugs with the first as baseline: the
    second exits 0 and lists every failure as known;
  - with one bug fixed in the local copy, the second run reports it fixed
    and exits 0; with one new bug planted, it exits 1 naming only that one;
  - a changed page type is regenerated, not failed, as in the UI path
    (RUN-30);
  - clean twice, the first as baseline: the second exits 0, its 46 known
    failures listed as known (moved from TFP-245's criterion 2, Emil,
    2026-11-08).
- **Dependencies:** [TFP-245]

### TFP-247 - Packaging: a pinned, reproducible runner

- **Status:** Built 2026-11-12 (Claude Code): `7b65bc4`, on the local
  branch `tfp-247-docker-image`, to verify; not pushed or published.
  Unit 830 of 830, 0 skipped (821 plus the 9 new).
  `Dockerfile` on Ubuntu 24.04 (CI's runner pin, so TFP-284 moves both),
  base images pinned by digest: Node 24.14.1 copied from the official
  image, Playwright 1.59.1 from the lockfile (`npm ci --omit=dev`), its
  Chromium headless shell 147.0.7727.15 (every launch in `src/` is
  headless); `scripts/image/check-pins.mjs` fails the build if any of
  them drifts (CI-24). `.dockerignore` lets in only what `mr-onion run`
  loads. `.github/workflows/release-image.yml`: a `v*` tag builds, runs
  `scripts/image/verify-image.mjs` on the built image (CI-25), then pushes
  that same image as `ghcr.io/emil3663/mr-onion:<version>`; a pull request
  touching the image, or a manual run, builds and verifies without
  pushing. **Measured locally** (Windows 11, Docker Desktop 29.4.0):
  build 2 min 41 s, 1.74 GB unpacked; `verify-image.mjs` every check
  held, and failed 4 of 5 on an image with its browsers moved; Acceptance
  Criteria 4's Toolshop comparison (CI-26) identical on clean
  (exit `1`, 470 / 46 / 0 / 18, `17ec8e9`) and with-bugs (exit `1`,
  481 / 84 / 0 / 20, `5ca6b7a`). **A fresh-context review** of the diff
  found the new test missing from `test:unit` (a lost space, which also
  dropped `src/cli/config.test.ts`) and a manual run from a tag able to
  publish; both fixed, with the pull-request paths widened to everything
  the image holds; the image rebuilt and re-verified. Left as found: the
  system libraries `playwright install --with-deps` takes from Ubuntu are
  unpinned (the `Dockerfile` says so); a pull request's run stamps its
  merge commit. **Not yet shown:** the workflow on
  GitHub's runner (it first runs on this ticket's pull request), and
  any push to ghcr.io, which makes the image public: the owner is asked
  before the first one.
- **Phase:** 47
- **Priority:** P1
- **Suggested labels:** `ci`, `release`
- **Problem it solves:** "the same site gives the same suite" only holds if
  Node, Playwright and Chromium are the same between runs and machines.
- **Scope:** a Docker image (Node 24, Playwright's Chromium, the CLI) and/or
  an npm package, per TFP-244; versions pinned; image tagged with the
  TestForge version (TFP-257).
- **Deliverables:** Dockerfile and/or package config; a release workflow.
- **Acceptance criteria:**
  - the image runs TFP-245's clean and with-bugs checks with the same
    results as a local run;
  - the release workflow executes the built image and asserts on its output
    (`verified-release-pipeline` skill), so a green release could have gone
    red.
- **Dependencies:** [TFP-245, TFP-257]

### TFP-248 - GitHub Action, example workflow and CI guide

- **Phase:** 47
- **Priority:** P1
- **Suggested labels:** `ci`, `docs`
- **Problem it solves:** the person who asked wants to drop TestForge into a
  pipeline, not assemble one.
- **Scope:**
  - a composite GitHub Action (`uses: emil3663/testforge/action@<version>`)
    wrapping the image: inputs for URL, mode, baseline and config;
    uploads the HTML report and JUnit results; writes a job summary;
  - an example workflow for a deploy-preview URL;
  - `docs/CI_INTEGRATION.md`: setup, secrets, what fails the build, what
    doesn't run in CI and why, and the stopgap described above;
  - a short note on running the image from other CI systems (GitLab, Azure
    DevOps), without claiming support that isn't tested.
- **Deliverables:** the action, the example, the guide.
- **Acceptance criteria (Gate A for Phase 47):**
  - TestForge's own CI runs the action against local Toolshop clean and
    with-bugs in Docker: clean passes, with-bugs fails, and both reports are
    attached;
  - a deliberately broken target URL turns the job red with exit 2.
- **Dependencies:** [TFP-246, TFP-247]

### TFP-249 - Interactive and active gates in CI

- **Phase:** 47
- **Priority:** P2
- **Suggested labels:** `ci`, `ownership`
- **Problem it solves:** forms, flows and attack-shaped tests are where real
  defects are, but they must never run against a site whose owner hasn't
  confirmed it.
- **Scope:** a non-interactive form of Phase 43's ownership confirmation: a
  committed confirmation file naming exact hosts, plus a CI secret; expiry
  enforced as in Phase 43; active tests skipped (Not run, with the reason)
  when either is missing.
- **Acceptance criteria:**
  - without the file or the secret, no active test runs and the report says
    why;
  - with both, for a listed host only, active tests run; an unlisted host in
    the same run gets none.
- **Dependencies:** [TFP-248, TFP-218, TFP-219, TFP-220, TFP-221]

---

## Part 2 — Working agreement follow-ups

### TFP-250 - Replace names used as permissions with the decision vocabulary

- **Status:** Built 2026-10-27 (`1a4f18b`, `6d82c2e`, `18d1e1c`).
  **Independently verified 2026-10-27 (Cowork, read-only, on a fresh clone
  at `82421c9`):**
  - *Remaining names:* in `src`, `README.md`, `docs/QUALITY_GATES.md`,
    `CLAUDE.md` and `TEST_PLAN.md`, only the seven test-fixture values and
    the two helper-template lines are left, each listed in a commit body —
    **met**;
  - *No SKILL.md heading names a person:* none; 10 sections now read "How to
    invoke this skill"; remaining names in `skills/` are credit lines —
    **met**;
  - *Comments only:* all 51 changed `.ts` files compile to identical output
    with comments stripped (TypeScript `transpileModule`,
    `removeComments`), `1906d52` → `18d1e1c`. Template strings aren't
    comments, so this also covers helper code no fixed input reaches
    (TFP-258's blind spot) — **met**;
  - *Template output:* `check:template-unchanged 1906d52 18d1e1c`: 166
    inputs, 166 identical, 0 different — **met**;
  - *Unit suite unchanged:* not re-run here; with no code change it can't
    differ. The builder's run: 604 of 604 — **met by equivalence**;
  - *Plugin loads:* `plugin.json` parses and all 12 SKILL.md frontmatters
    are valid here; the load itself was shown by the builder on CLI
    2.1.311 (12 skills listed, two invoked) — **met, load checked by the
    builder only**;
  - *Scope:* nothing under `benchmarks/` or `docs/decisions/` changed.
  - *Judgement call ruled on:* provenance became "owner decision, <date>"
    beside the ticket or decision reference already there, rather than the
    reference alone. Accepted: it keeps the date, which the reference
    alone doesn't carry.
  **Owner decision, 2026-10-27:** `controls.ts:245` and `:282`, which still
  name a person inside helper code written into every generated suite (and,
  with Phase 47, into other teams' repos), are reworded to their decision
  references, and the template baseline (`TEMPLATE_BASELINE` in
  `nightly.yml`) is re-recorded in its own commit. After Gate D's
  re-measurement is analysed, not before: it changes generated output.
  The builder's own fresh-context review had caught `:245` reworded and put
  it back (`18d1e1c`); the template check's blind spot for helpers no fixed
  input reaches is TFP-258.

- **Phase:** None (between tickets)
- **Priority:** P1
- **Suggested labels:** `docs`, `chore`
- **Problem it solves:** rules are written as "with Emil's approval", "ask
  Emil first", "Emil's machine". A reader can't tell a standing rule from a
  one-off, and TestForge's own code reads as if only one person will ever
  use it. `WORKING_AGREEMENTS.md` now defines *owner decision*,
  *confirmation required*, *independent review* and, in product code,
  *the tester*.
- **Scope (counts on `8e93998`, excluding "Saint Martin" fixtures):**
  - `src/`: 81 lines in 56 files, all comments and test descriptions; no
    user-visible string names anyone. The candidate API already takes the
    approver as data (`approve`'s `by`). Rewrite authority comments
    ("offered for Emil's approval" → "offered for the tester's approval")
    and provenance ("decided by Emil 2026-10-06" → the decision reference);
    test fixtures may keep a name as a value or use `"tester"`.
  - `README.md` (1 line), `docs/QUALITY_GATES.md` (2: "Emil's machine" →
    "the local dev machine, with a real browser"), `TEST_PLAN.md` (27:
    provenance → decision references). `CLAUDE.md`'s one line was done in
    the planning pass that wrote this backlog.
  - `skills/`: 31 lines in 16 files. "How Emil invokes this skill" →
    "How to invoke this skill" in every SKILL.md and in the template note in
    the READMEs. Credit lines (Martin's proposals and branch, the plugin
    author) stay.
  - Not in scope: `benchmarks/`, git history, decision records' own ruling
    lines, `docs/decisions/` citations (planning sessions update those as
    they touch each record), already-committed promoted library entries'
    `approved.by` (a record of who approved).
- **Acceptance criteria:**
  - `git grep -nE "\b(Emil|Martin)\b" -- src README.md docs/QUALITY_GATES.md
    CLAUDE.md TEST_PLAN.md` returns only test-fixture values and credit lines, each
    listed in the commit body;
  - no `SKILL.md` heading contains a person's name;
  - `npm run test:unit` and `check:template-unchanged` unchanged (comments
    only; template output byte-identical);
  - the plugin still loads (TFP-236's check).
- **Dependencies:** None. Do it after TFP-157's verification, not inside it.

### TFP-251 - A deterministic stop check for implementing sessions

- **Phase:** None
- **Priority:** P2
- **Suggested labels:** `tooling`
- **Problem it solves:** "check before reporting" is advisory in
  `CLAUDE.md`. A Claude Code Stop hook makes the cheap checks unskippable.
- **Scope:** measure first: time `tsc --noEmit` and eslint on changed files
  on this machine. If the pair takes under 30 s, add a project Stop hook in
  `.claude/settings.json` that runs eslint on changed files and `tsc`,
  and blocks the turn from ending on failure. If it's slower, eslint only,
  and say so.
- **Acceptance criteria:**
  - the measured times are in the commit body;
  - a session that introduces a type error cannot end its turn until it is
    fixed (shown once, deliberately);
  - the existing `SessionStart` lock-file hook is unchanged.
- **Dependencies:** None. Changing `.claude/settings.json` affects every
  session on the repo: confirmation required.
- **Done 2026-10-27:** measured 11.8 to 14.2 s for both, so both run;
  `scripts/hooks/stop-check.sh` (`818936f`, the type-error case shown
  once), wired in as a project Stop hook (owner decision the same day),
  the `SessionStart` hook unchanged.

### TFP-252 - Nightly-failure triage

- **Status:** Done and verified 2026-11-04: `c44f1e8`
  (`feat(ci): open, update and close a nightly failure issue (TFP-252)`).
  An `issue` job in `nightly.yml` (only `issues: write` and
  `actions: read`; skipped when a run is cancelled; `notify` waits for it)
  runs `scripts/nightly-email/issue.mjs`, no model: a red night opens
  "Nightly failing" or comments on the open one, the next green run comments
  and closes it, and the email links it. A branch's runs use "Nightly failing
  on <branch>", so a test dispatch can't touch `main`'s issue (Emil,
  2026-11-04). **Verified:** on a Linux clone, the uncommitted files on
  `4621e64`: `issue.test.mjs` and `summary.test.mjs` 43 of 43 passed, 0
  skipped; with HEAD's `notify.mjs`, the three command tests fail
  (`unknown command: issue`). **Live (Emil's go, 4 dispatches on
  `tfp-252-check`):** green, then two forced reds (`template-base=435d78f`),
  then green; [#17](https://github.com/emil3663/testforge/issues/17) opened,
  commented once, closed (2026-11-04 01:08:54 UTC, 2 comments); read over
  the REST API: its body has the run link, each job's result and the
  one-commit range from the green run's `bc54e7d` with the compare link,
  fenced; it is the only "Nightly failing" issue in the repo; the branch is
  deleted. The emails' issue lines are Claude Code's reconstructions from
  the logs, not read from the inbox. Not tested live: the cancelled-run skip.
  **Gap found live, closed before the commit (Emil, 2026-11-04):** a
  failure outside the unit job was named only by its result. A red
  template check now puts its own line in the issue ("N inputs, N
  identical, N different", or that it can't be read), as the email does;
  `audit` and `dead-code` have no line of their own. Two unit tests
  (`issue.test.mjs`) fail without the change; not re-run live.
- **Phase:** None
- **Priority:** P2
- **Suggested labels:** `ci`
- **Problem it solves:** a red nightly is only useful if someone reads it
  the next morning with the failing test and the first bad commit in front
  of them.
- **Scope:**
  - in `nightly.yml`, a step on failure that opens or updates one GitHub
    issue ("Nightly failing") with the failing tests, the run link and the
    commit range since the last green run — deterministic, no model;
  - the TFP-217 summary email links that issue;
  - optionally later, a scheduled Claude Code routine that reads the issue
    and drafts a reproduction. Not in this ticket.
- **Acceptance criteria:**
  - a forced failure on a branch's manual dispatch opens the issue; a second
    forced failure updates it rather than opening another; the next green
    run comments and closes it.
- **Dependencies:** [TFP-217]

#### TST-07 evidence

Moved word for word from [`docs/test-plan/TST.md`](../test-plan/TST.md) by TFP-253; the case's row there links here.

**Test:** A red nightly opens or updates one failure issue, and the next green one closes it (TFP-252; unit: `scripts/nightly-email/issue.test.mjs`; `.github/workflows/nightly.yml`, job `issue`)

**Expected result:** After the four check jobs, whatever their results unless the run was cancelled (then it is skipped, and the email says so), `issue` (its own job, with `issues: write` and `actions: read`; never the SMTP password) runs `notify.mjs issue`, no model. A red night (the email's verdict, `nightlyPassed`) with no open issue titled `Nightly failing` opens one; with one open, comments on it; a green night closes it with a comment naming the run; a quiet green night only reads. The report: the run's link, the short commit, each job's result, the failing tests (as the email names them) and the commits since the last run of `nightly.yml` that concluded green on the branch, with GitHub's compare link (at most 20 listed, then "and N more" from GitHub's total); no green run, a green run that can't be looked up, or a range that can't be listed, is said with `gh`'s own reason, and the issue is opened all the same. "Green" is the run's own conclusion, which counts `issue` and `notify` too, so a range can be longer than it need be, never shorter. Test names and commit subjects are in a text fence longer than any run of `~` inside it, so an `@name` in one notifies nobody. A branch's runs use `Nightly failing on <branch>`, so a test dispatch can't touch main's. The open issue is found by exact title through the list API, not search, so one opened a minute earlier is found. The email links the issue (opened, updated, closed), or says the issue job couldn't do its part. **Proven (unit, offline; `gh` played by `fake-gh.mjs`, a JSON state, not GitHub):** the plan's four cases; red, red, green, green through `notify.mjs`: one issue opened, then commented on, then closed, then left alone, an issue with another title untouched; a branch's red night opens its own issue and leaves main's; a failed green-run lookup still opens the issue; a `~~~~` name, 300 commits, gh's 404 and 502 reasons; the email's line for each action and for an issue job that failed or was cancelled. Against `HEAD`'s `notify.mjs` the command tests fail (`unknown command: issue`); with the email's line removed, its two tests fail; each review fix undone (a fixed fence, the listed count, stderr not captured, a lookup that throws) fails its test. **Proven live (2026-11-04, branch `tfp-252-check`, four manual dispatches, branch deleted after):** run 41741173103 green, issue job `none`, no email line; an empty commit, then run 41743846846 with `template-base=435d78f` (template check 170 of 172, so red) opened #17 "Nightly failing on tfp-252-check" with the run, each job's result and the 1-commit range from the green run's `bc54e7d`, email "Failure issue: opened …/issues/17"; run 41746797189, the same, commented on #17 and opened none, "updated"; run 41749704644 green closed #17 with "Green again: …", "closed". One issue opened in all, closed at the end; none for `main`. Email lines read from bodies rebuilt from each notify job's logged inputs; each sent subject matched the log. **Not proven:** the cancelled-run skip (workflow only). **Gap seen live, closed (Emil, 2026-11-04):** a failure outside the unit job was named by its result alone. A red template check now carries its own line (`**Template check:** N inputs, N identical, N different`, or that it can't be read), as the email does; `audit` and `dead-code` have no line of their own. Unit-proven (fails without the change: 2 tests), not re-run live.

### TFP-253 - Split `TEST_PLAN.md` by area and slim its rows

- **Status:** Done, in two steps. **Step 1, the split: done and verified
  2026-11-04, `0bf35c5`:** nine area files under
  `docs/test-plan/` (HLT, GEN, CRW, INT, RUN, RPT, EXP, SAV, TST), each its
  old §3.x text under a heading and a link back; `TEST_PLAN.md` keeps
  everything else, with §3 as an index (335,601 to 19,365 bytes); living
  docs and five code comments point at the area files; dated records keep
  their historical mentions. **Verified** from the uncommitted files against
  `c44f1e8`'s `TEST_PLAN.md`, with Cowork's own script: 205 case rows and
  205 IDs before, 205 and 205 after, none left in `TEST_PLAN.md`; none
  missing, extra or duplicated; every row byte-identical; LF only; all nine
  index links resolve and each area file links back. Claude Code's
  repo-wide link check (199 files, 19 links into the plan, no new broken
  link) wasn't re-run here. **Step 2, slimming the rows: done and verified
  2026-11-04, committed with this status (`docs(test-plan): slim case rows
  and move their evidence to the records (TFP-253)`):** 166 rows over 400
  characters now read ID | case | short expected result with an `[Evidence]`
  link | status; each one's original Test and Expected text moved word for
  word under a `<ID> evidence` heading in its ticket's record (8 without a
  ticket at the end of the Phase 17 or Phase 34 record); the 39 short rows
  untouched. **Verified** from the uncommitted files against `0bf35c5`, with
  Cowork's own script (its own cell splitting, aware of code spans): 205
  case IDs before and after, none missing, extra or duplicated; longest row
  399 characters, none over 400; every status cell unchanged; all 166
  evidence links land on exactly one heading of that name, and both original
  cells are word for word in the section under it; no line deleted in any
  decision record. Claude Code's 20-row spot-check, repo-wide link check and
  the reviewer's two reads of the 98 hand-written short results weren't
  re-run here; three slim rows read (GEN-95, GEN-51, INT-09) say what their
  evidence says. The `test-plan-doc` skill is a user-level skill: updating it to the
  new layout is the owner's (proposed from a planning session).
- **Phase:** None
- **Priority:** P1
- **Suggested labels:** `docs`, `context`
- **Problem it solves:** `TEST_PLAN.md` is 298 KB in one file; 163 rows
  exceed 400 characters and the longest (RUN-42) is 5,923. A session that
  needs one case pays for all of them, and most of each row is a
  measurement narrative that already lives in a decision record or under
  `benchmarks/`. The information is already filed; the plan should point
  at it, not repeat it.
- **Scope (revised 2026-10-27):**
  - **Split by area.** `TEST_PLAN.md` keeps the feature-status table, the
    known limitations and an index; each case prefix moves to its own file
    under `docs/test-plan/` (`GEN.md`, `RUN.md`, `RPT.md`, `HLT.md`, …).
    A ticket names the area it touches, so a session reads one file.
  - **Slim each row** to: ID, case, expected result, status, and one
    evidence pointer — the record's decision, the ticket, the test file.
    The "Proven (…)" narratives move to the decision record the ticket
    belongs to, under that ticket, where they aren't already.
  - **No separate outstanding-work file.** What's left is already in the
    deferred-work register (build order) and the current handover (next
    tickets); a third copy would drift. Instead, `CLAUDE.md` gets one line:
    read the handover, then only the test-plan area and record section the
    ticket names.
- **Acceptance criteria:**
  - the set of case IDs across the split files equals the set before
    (diffed, in the commit body);
  - no row over 400 characters; total bytes before and after in the commit
    body;
  - every moved narrative is findable in its record (spot-check of 20 rows
    listed in the commit body);
  - links from records and the README to `TEST_PLAN.md#…` anchors still
    resolve, or are updated;
  - `test-plan-doc` skill updated to the split layout.
- **Dependencies:** None. Not while another session is editing
  `TEST_PLAN.md`.

### TFP-259 - Dead-code pass, and a check that keeps it clean

- **Status:** **Built `a1b4b46`; verified 2026-11-02 (Cowork, Linux, fresh clone):**
  `npx knip` exit 0 (one harmless `.css` hint); `tsc --noEmit` clean;
  `check:template-unchanged 769afb4 a1b4b46` 166 of 166 identical; one
  `playwright-core` (1.59.1, deduped under `@playwright/test` and
  `@axe-core/playwright`); `.gitignore` keeps `/runs/` and the commit holds
  nothing under `runs/`; the nightly's `dead-code` job runs `npx knip` with
  no pipe, so it can fail. Rulings (Emil, 2026-11-02): `dist/` stays out
  (nothing produces it); `knip.jsonc` accepted (its comments explain each
  exception); `PAGE_ANNOTATION` left as over-exported; the `.venv`
  patterns go from eslint's ignore list in the next commit; `knip` as a
  dev dependency accepted; the slower unit run (22 min) is one data point.
  **Done 2026-11-02:** a manual nightly (run 41506182823, on `a1b4b46`)
  shows the `dead-code` job green on GitHub.
  The config is `knip.jsonc`, not `knip.json`, as the false positives are explained in
  comments. `playwright-core` is declared at `^1.59.1`, the range of
  `@playwright/test`, so the tree keeps one copy. knip 6 found two things
  the 2026-10-27 scan hadn't: `TOP10_SOURCE` (unused, removed; the header
  comment of `standards.ts` has the same provenance) and unused re-exports,
  removed with their five env-var exports in `request-cap.ts`. `scripts/`
  isn't a blanket entry: only package.json's scripts and the three named in
  `knip.jsonc` are, so an unused script fails the check too.

- **Phase:** None
- **Priority:** P2
- **Suggested labels:** `chore`, `tooling`
- **Problem it solves:** the last deliberate cleanups were Phase 16's
  deletions (2026-08-28) and TFP-070's dead env var (2026-09-23); nothing
  checks for unused code since. A scan on 2026-10-27 (`knip` 5, scoped to
  `src/`, `scripts/`, `tests/`, with the unit tests as entry points) found
  the codebase lean, with a few real leftovers:
  - `getDefaultInspectionPath` is defined twice, identically:
    `src/app/_lib/derive.ts:220` and `src/lib/introspect/paths.ts:14`;
  - `websiteSchema` is defined in `src/app/_lib/constants.ts:118` and again
    in `src/app/page.tsx:36`; only the second is used;
  - `playwright-core` is imported directly (`src/lib/run/redact.ts`) but
    isn't in `package.json` (it arrives through `@playwright/test`);
  - `.env.example` still describes `TESTFORGE_ENV` as a FastAPI overlay
    (it now only labels `/api/health`'s output) and says that without an
    OpenAI key TestForge "falls back to a sample test template" (the
    template is the default generator); `.gitignore` keeps a Python
    section for a toolchain Phase 16 removed.
  Not findings: knip also lists `@axe-core/playwright`, `nspell` and the
  dictionaries as unused (they're used by generated suites and by
  `src/lib/generate`, which knip can't see through code strings) and
  `request-cap-fixture.ts` (copied into run folders by path); 79 exports
  are only used inside their own file — over-exported, not dead.
- **Scope:** remove the duplicates (one implementation, imported where
  needed), declare `playwright-core` or import through `@playwright/test`,
  fix the `.env.example` and `.gitignore` text; commit a `knip.json` with
  the false positives explained, and add `npx knip` to `nightly.yml`.
- **Acceptance criteria:**
  - `npx knip` exits 0 on the committed config, and fails when an unused
    file is added (shown once);
  - `check:template-unchanged` byte-identical; unit suite unchanged.
- **Dependencies:** None.

### TFP-260 - Bind the local Docker stacks to loopback

- **Status:** Built `769afb4` (2026-10-31). **Verified (Cowork, 2026-10-31):**
  `docker-compose.yml` binds MinIO's 9000/9090 and Plane's 80 to
  `127.0.0.1`; `scripts/toolshop-local/compose.loopback.yml` replaces
  Testsmith's port lists with `!override` (4200, 8091, 8000, 3306 on
  `127.0.0.1`), and `toolshop.sh` loads it for both versions; `SECURITY.md`
  describes it. The builder measured every port bound to `127.0.0.1` and no
  answer on the LAN address from the same machine (MinIO had answered there
  before). **Other-machine check done (owner, 2026-11-03):** with the stacks
  up, a phone on the same Wi-Fi got `ERR_CONNECTION_TIMED_OUT` on
  `http://192.168.1.17:9090` and `:4200`. RUN-47 is ✅.
- `v0.2.0` tagged on `b19f314` and released 2026-10-31 04:32 UTC (checked
  via the API: published, not a draft). Dependabot re-checked at 06:55:
  still "Dependency files checked: 2026-10-28 07:31", 114 open.

- **Owner decision, 2026-10-28: Plane stays, secured.** It may be used by
  other people or setups, and the next sites under test will come in the
  same way. Plane's 80 and MinIO's 9000/9090 are published on `127.0.0.1`
  in `docker-compose.yml`; the Toolshop's ports through TestForge's own
  override file. The committed credentials stay as development
  placeholders; `.env.example` and `SECURITY.md` say to change them before
  Plane runs anywhere else. Removal was considered and rejected.

- **Phase:** None
- **Priority:** P1
- **Suggested labels:** `security`, `config`
- **When (owner decision, 2026-10-27):** after Gate D's re-measurement
  session, as the Toolshop setup isn't changed before it.
- **Problem it solves:** `docker-compose.yml` publishes Plane on port 80
  and MinIO on 9000 and 9090 on every network interface (measured
  2026-10-27: `docker ps` shows MinIO on `0.0.0.0:9000` and
  `0.0.0.0:9090`), and the local Toolshop copies publish 4200 (the app),
  8091 (the API), 8000 and 3306 (MariaDB, root password `root`) the same
  way, from Testsmith's own `docker-compose.yml` in WSL; all with credentials
  that are defaults in a public repo (`plane-access-key` /
  `plane-secret-key`, `change-me-before-production`). On a shared network
  anyone who can reach the machine can open the MinIO console with them.
  TestForge itself is loopback-only by rule; its test targets should be too.
- **Scope:** publish as `127.0.0.1:<port>:<port>` in `docker-compose.yml`
  and for the Toolshop (D26). Testsmith's file isn't TestForge's to edit
  (`scripts/toolshop-local/README.md`), so the Toolshop's go in a
  TestForge override beside `compose.local.yml`, which replaces the
  `ports` of `angular-ui`, `web` and `mariadb` (compose merges `ports`
  lists, so the override needs `!override` or a reset, to be checked);
  then remove the known gap from `SECURITY.md`; say in
  `.env.development` and the README that the values are local placeholders,
  and how to override them. Owner decision first: is Plane still used as a
  target? If not, remove it (compose file, env vars, README sections)
  instead.
- **Acceptance criteria:**
  - with the stacks up, `netstat` shows the ports bound to `127.0.0.1`
    only; `http://localhost` still serves Plane, and `localhost:4200` and
    `:8091` the Toolshop, with its start script's bug-80 check passing;
  - from another machine on the network, the ports don't answer.
- **Dependencies:** None.

#### RUN-47 evidence

Moved word for word from [`docs/test-plan/RUN.md`](../test-plan/RUN.md) by TFP-253; the case's row there links here.

**Test:** The local Docker test targets answer on this machine only (TFP-260; `docker-compose.yml`, `scripts/toolshop-local/compose.loopback.yml`)

**Expected result:** Plane's 80 and MinIO's 9000 and 9090 are published on `127.0.0.1`, and the Toolshop's 4200, 8091, 8000 and 3306 through an override with `ports: !override`, as compose merges `ports` lists and Testsmith's file isn't TestForge's to edit. MariaDB's root password is `root` and MinIO's keys are defaults in a public repo, so their reach matters. **Proven (2026-10-31, Windows, Plane and with-bugs running):** `netstat` lists all seven on `127.0.0.1` only; on this machine's LAN address none answers, where MinIO's two did before; through `localhost`, Plane, the app, the API and the MinIO console answer 200 in 9 to 151 ms; `start-toolshop.ps1` passes its bug-80 check; the clean version's merged config has the same four. **Other machine (owner, 2026-11-03):** with Plane, MinIO and the Toolshop running, a phone on the same Wi-Fi opened `http://192.168.1.17:9090` and `:4200`: both ended in `ERR_CONNECTION_TIMED_OUT`. From another machine a timeout can't tell a loopback bind from Windows Firewall dropping the connection; with `netstat` showing all seven on `127.0.0.1` only, together they meet the acceptance.

---

## Part 3 — Docs an architect would read first

Found 2026-10-26. A reviewer evaluating TestForge for a team would open, in
roughly this order: README, a security policy, an architecture overview, a
decisions index, the contribution rules, the version and release notes.

### TFP-254 - `SECURITY.md` and `CONTRIBUTING.md`

- **Priority:** P1
- **Suggested labels:** `docs`, `security`
- **Problem it solves:** the repo is public and shared with outside readers.
  There is no way to report a vulnerability, and the security model —
  arbitrary code execution by design, loopback only — lives only in the
  README. There is no contribution guide; the old working agreement pointed
  at a `CONTRIBUTING.md` that never existed here.
- **Scope:**
  - `SECURITY.md`: how to report, what's supported, the security model
    (from README), and a short threat model: generated-code execution,
    model-written tests (restrictions, not a sandbox; Phase 45), the gap
    writer's tool-less Claude Code call, credentials (env only, redacted,
    storageState never persisted), local data (site details, contact email);
  - `CONTRIBUTING.md`: setup pointer to README, the loop and vocabulary
    from `WORKING_AGREEMENTS.md`, Conventional Commits, the test commands,
    and that outside changes come as issues or PRs, not direct pushes;
  - note in `SECURITY.md` that `.env.development`'s committed values are
    local development placeholders for the optional Plane stack, not
    secrets.
- **Decided 2026-10-27 (owner):** reports through GitHub private
  vulnerability reporting; best effort, acknowledgement within a week;
  `main` supported until versioning starts; issues first, pull requests by
  invitation.
- **Status:** both files drafted 2026-10-27 in a planning pass. Before they
  are committed: TFP-261 lands (SECURITY.md describes the fixed server),
  and the owner switches on private vulnerability reporting in the
  repository's Security settings (the policy points readers there).
- **Acceptance criteria:** both files exist; every claim in the threat model
  points at the code or record that implements it.
- **Dependencies:** None. Planning session can write these.

### TFP-262 - GitHub Issues as the public front door

- **Priority:** P1
- **Suggested labels:** `docs`, `process`
- **Problem it solves:** the repo is public and shared, but its history of
  found-and-fixed problems is spread across 60+ decision records. Issues
  were used in September (`Closes #67` to `#82`) and for #2 and #3, then
  work moved entirely to `TFP-` tickets in docs. An outside reader can't
  see what is known, what was found or what was done about it without
  digging. Mirroring every `TFP-` ticket would be noise; nothing at all
  hides a well-run project.
- **Scope (decided 2026-10-27):**
  - **Issue templates** (`.github/ISSUE_TEMPLATE/`): bug report (the fields
    in `CONTRIBUTING.md`), idea, and a `config.yml` that disables blank
    issues and links security reports to private reporting;
  - **labels** from `TEST_PLAN.md`'s set, plus `known-limitation` and
    `phase`;
  - **known limitations as issues:** one open issue per item in
    `TEST_PLAN.md`'s known-limitations list, linking the case and the
    record that would close it;
  - **one tracking issue per phase** from Phase 39 on: opened when the
    record locks, linking the record; gate rulings summarised as comments;
    closed by the commit that completes the phase. Earlier phases are not
    back-filled (the index covers them);
  - **outside reports** stay issues; one that becomes planned work gets its
    `TFP-` number in its title (as `WORKING_AGREEMENTS.md` says).
- **Acceptance criteria:** the templates show on "New issue"; a blank issue
  can't be opened; every known limitation has an open issue; Phase 39 has a
  tracking issue linking its record; `WORKING_AGREEMENTS.md` and
  `CONTRIBUTING.md` describe the same rules.
- **Dependencies:** None. Creating issues and labels needs GitHub access
  with write permission: confirmation required.
- **Done 2026-10-27** (owner decision the same day for the labels and the
  issues): the templates and `config.yml` (`97e3d2f`); 8 labels added
  (`technical-debt`, `refactor`, `testing`, `investigation`, `skills`,
  `chore`, `known-limitation`, `phase`; `bug` and `documentation` already
  existed); #5 to #13, one per known limitation, each linked from its
  item in `TEST_PLAN.md`; #14, Phase 39's tracking issue; the same rules
  in `WORKING_AGREEMENTS.md` and `CONTRIBUTING.md`.

### TFP-255 - Decisions index, roadmap header, and historical docs marked

- **Priority:** P1
- **Suggested labels:** `docs`
- **Problem it solves:** `docs/decisions/` has 60+ files and no index; the
  roadmap's header still says "Version 1.0, 2026-08-28, Draft" with a
  pre-Phase 16 baseline, and its Phase 39 heading says "not started" though
  Gates A to D are measured. `docs/consolidation/` (April 2026) describes
  the FastAPI backend and proxy cutover that Phase 16 deleted, including a
  CI plan for that architecture, with nothing saying it's historical.
  `docs/TA-230.md` is test-assist material kept as skill source.
- **Scope:**
  - `docs/README.md`: an index of the docs and what each is for;
  - a decisions table (phase, title, status, record, backlog) at the top of
    `product-roadmap.md` or in `docs/decisions/README.md`;
  - roadmap header: current version, date, a baseline that is today's, and
    Phase 39's status;
  - a banner on each `docs/consolidation/` file: historical, superseded by
    Phase 16; or move the folder under `docs/history/`;
  - move `docs/TA-230.md` beside the skill that cites it.
- **Done 2026-10-27 in a planning pass:** `docs/README.md`,
  `docs/decisions/README.md` (the index), the roadmap header and Phase 39's
  heading, a historical banner on every `docs/consolidation/` file and a
  `consolidation/README.md`. **Done 2026-10-27 (Claude Code):** the move
  of `docs/TA-230.md` to `skills/testing/find-the-hidden-platform/`, with
  its links, and the three status lines, which the index no longer flags.
  **Was left:** moving `docs/TA-230.md` beside its
  skill (a `git mv`), and correcting three records' own status lines the
  index flags: Phase 42 ("Locked", complete 2026-10-15), Phases 35 and 36
  ("Approved").
- **Acceptance criteria:** every file under `docs/` is reachable from
  `docs/README.md`; no phase heading's status contradicts its record's
  status line.
- **Dependencies:** None.

### TFP-256 - README claims check

- **Status:** Done 2026-10-28 (planning pass, `repo-claim-audit`), against
  `main` at `f8333b6`. **25 claims checked: 6 false, 4 stale, 2 understated,
  0 unverifiable.** All fixed in `README.md`:
  - *False:* "Node.js 20+" (unit tests and scripts need 22.6; `.nvmrc`
    is 24 — the README's own tool-stack table said so); "Comprehensive goes
    deep on one area, or all of them" (`COMPREHENSIVE_AREAS` is security and
    accessibility; all-areas is D5); "active … only behind a typed ownership
    confirmation" (not built: active tests are always Not run until
    Phase 43); self-test and regression "keep the latest 5" artifacts (each
    upload has `retention-days: 30`); the setup step "add your OpenAI API
    key" as the one configuration step (the path is parked, no completion
    has succeeded); the tagline "you tell it what you want to test in plain
    English … the AI handles the syntax" (generation is the deterministic
    template from site inspection; the description field only steers area
    selection).
  - *Stale:* the security model told the reader not to bind to a
    non-loopback interface (TFP-261 now binds `127.0.0.1` and guards the
    API); "Open http://localhost:3000" (the dev server prints
    `127.0.0.1`); "572 tests at TFP-207"; GitHub Copilot as the AI tool
    (Claude Code is, and the gap writer calls its CLI).
  - *Understated:* the host limits and request cap weren't mentioned; CI
    integration (Phase 47) wasn't mentioned.
  - *Checked true:* the 12 skills (8 + 4); every `npm run` script in the
    table exists and every package script is documented; the example suite
    file exists; save-suite's `.playwright-runs/generated-suites` and the
    `chromium` project; `runs/` as the run root (`TESTFORGE_RUNS_ROOT`);
    the gap writer's four Claude Code flags; the gap limit of 5; promotion
    after 3 clean sites; the library has entries; the nightly's 02:00 UTC
    schedule, 30-day log and pipefail step.
  - *First ten seconds:* the tagline oversold AI and undersold the product
    (crawl, page types, deterministic suite, honest coverage). It now leads
    with what TestForge does, says the AI is optional, and links the docs,
    changelog, security and contributing pages.
  - *Left for TFP-260:* the Plane lines (step 5, tech stack, scripts),
    pending the owner's decision on Plane.

- **Priority:** P2
- **Suggested labels:** `docs`
- **Problem it solves:** the README is mostly current (2026-10-20) but
  states the goal as if it were built: "Comprehensive goes deep on one area,
  or all of them". The goal is a Comprehensive set for every area and an
  all-areas run (D5); today `COMPREHENSIVE_AREAS` is security and
  accessibility. The fix is to say both — the goal, and what's built —
  wherever the README describes coverage.
- **Scope:** run the `repo-claim-audit` skill on README and fix what it
  finds; add a last-reviewed date.
- **Acceptance criteria:** the audit's findings list is in the commit body,
  each resolved or justified.
- **Dependencies:** None.

### TFP-257 - Start versioning

- **Priority:** P1 (blocks TFP-247)
- **Suggested labels:** `release`
- **Problem it solves:** `package.json` says `0.1.0`, unchanged since the
  start, and the repo has no tags, so "which TestForge found this?" has no
  answer, and a CI user has nothing to pin.
- **What it takes:**
  1. **The rule (owner decision, 2026-10-27):** semantic versioning, staying
     below 1.0 while the report format can still change; the minor version
     goes up when a phase completes (Phase 39 → `0.2.0`), the patch for fixes
     between phases; 1.0 when the report and CLI are declared stable
     (after Phase 47). Rejected: 1.0.0 now (every report-format change
     would become a major version); date-based versions (say nothing about
     compatibility to a CI user pinning one).
  2. **One source of truth:** `package.json`'s `version`.
  3. **The product says its version:** `/api/health`, every run's
     `run.json` and the report footer carry the version and the commit,
     so a saved report answers the question by itself.
  4. **A changelog:** `CHANGELOG.md`, one entry per version, written from
     the phase records (what changed for a user), not from commit
     subjects. The first entry, `0.1.0`, summarises Phases 16–38 in a few
     lines and links the index.
  5. **Tags and releases:** an annotated tag `v0.1.0` on the commit that
     starts versioning, and `v0.2.0` when Phase 39 completes;
     **`CHANGELOG.md` drafted 2026-10-27** (planning pass): `0.1.0` covers
     everything complete so far — Phases 16–38 and 40–42, the post-Phase 42
     review and TFP-261 — not "16–38" as first proposed, because 40–42
     finished before 39; Phase 39's built work is listed under Unreleased; a GitHub
     release per tag with the changelog entry. Tags are pushed by Claude
     Code; creating the first one is confirmation required.
  6. **Later, with TFP-247:** a release workflow that builds the image
     from the tag and tests it before publishing.
- **Acceptance criteria:** `v0.1.0` exists; `/api/health` and a fresh
  `run.json` show the version and commit; the changelog's entries each cite
  their phase record.
- **Dependencies:** None for steps 1–5 (the rule is decided first);
  TFP-247 for step 6.

#### RUN-46 evidence

Moved word for word from [`docs/test-plan/RUN.md`](../test-plan/RUN.md) by TFP-253; the case's row there links here.

**Test:** The product says its version: which TestForge ran a saved report (TFP-257; unit: `src/lib/version.test.ts`, offline and through the executor in a real browser; regression: `/api/health` in `testforge.sections.spec.ts`)

**Expected result:** `package.json`'s `version` is the one source of truth, and the commit comes from git. `/api/health` gives both. A built server gives what it was built from (`next.config.ts`, at `next build`), as a pull under a running `next start` changes HEAD, not the code running; a dev server reads them on each call. A run takes its stamp when it starts (`producedBy`), kept in `run.json` and on its report, or on the result where a cancelled or failed run has no report, so a saved report says what made it, not what reads it, and a pull during a run can't change it. The line after the report comes from that stamp; the report's HTML is also built in the browser, so it can't ask git. A run from before this says its version wasn't recorded. A copy with no `package.json` or no git says `unknown` and a null commit, and doesn't fail, and one with no `.git` of its own doesn't report the commit of a repo it sits inside. **Proven (real browser):** a fresh run's `run.json`, its report and the saved report's HTML carry the stamp. **Proven (offline):** both report exports end with the version line after `</main>` (`src/lib/selection/coverage.test.ts`), and a report-less result's export carries it.

---

## Part 4 — Found 2026-11-03 (TFP-258's build), owner decision 2026-11-03

Emil agreed all three on 2026-11-03, and their place in the work order
(the handover's list): TFP-268 first, then TFP-252 and TFP-253, then TFP-269,
then TFP-270, then Phase 47.

### TFP-268 - A journey that revisits a page is dropped, so no journey test is written (added 2026-11-03)

- **Status:** Done and verified 2026-11-04 (`6211ae7`; baseline moved in
  `8d6f408`). Found by TFP-258's build (2026-11-03). A journey's path keeps its
  order and repeats (`normalizeStringSequence`); other lists still
  de-duplicate. **Verified on a Linux clone, the uncommitted files on
  `435d78f`:** `journeys.test.ts` and `journey-tests.test.ts` 28 of 28
  passed, 0 skipped; with the old `normalize.ts`, the two TFP-268 tests fail
  (26 passed, 2 failed). `check:template-unchanged 435d78f`: 172 inputs, 170
  identical, 2 different, the two "journeys selected" inputs; the fast one
  read: +373 −1, ten journey tests added (TFFU-037 to -046, each entering,
  submitting the form and checking the page still renders), the existing
  journey renumbered to TFFU-047, no other line changed. Claude Code's full
  unit run (708 of 708), `tsc` and ESLint weren't re-run here.
  The scope's "say so where the user sees it" isn't built (`route.ts`
  narrows the selection silently; GEN-108 ⚠️): split out as TFP-271 (Emil,
  2026-11-04).
- **Phase:** None — first, before TFP-252
- **Priority:** P1
- **Suggested labels:** `bug`, `generate`, `introspect`
- **Problem it solves:** `normalizeJourneys` (`src/lib/generate/normalize.ts`)
  reads a journey's `path` through `normalizeStringList`, which removes
  repeats. A journey whose path visits a page twice (for example a form that
  posts back to its own page) loses a path entry, its steps no longer line
  up with the path, and the journey is dropped as not aligned. Measured in
  TFP-258's build: all 10 journeys in the fixed content profile end in a form
  that posts to its own page, so all 10 are dropped. A user who selects such
  a journey gets no journey test and no message saying why. It has been so
  since `6a5b4c4`, which added journeys.
- **Scope:**
  - Keep a journey's path as given: trim and drop empty entries, but don't
    remove repeats. The other string lists keep their de-duplication.
  - Check the rest of the journey pipeline (ranking, selection, the journey
    test writer) handles a repeated page.
  - If a selected journey is still dropped for another reason, say so where
    the user sees it, not silently.
- **Acceptance criteria:**
  - **Red first:** a unit test with a journey whose path revisits a page,
    failing on today's code (dropped), passing after the fix.
  - The fixed profile's 10 journeys survive normalisation, and a selected one
    produces a journey test.
  - `check:template-unchanged` shows the change only in inputs with selected
    journeys, and each changed line is read; the baseline moves in its own
    commit if output changes.
  - A `TEST_PLAN.md` case.
- **Dependencies:** none.

#### GEN-108 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** A journey whose path visits a page twice survives the generate route's normalising, so selecting it writes its test (TFP-268; unit: `src/lib/introspect/journeys.test.ts` — "a journey whose path revisits a page survives normalizeContentProfile"; `src/lib/generate/mock/journey-tests.test.ts` — "TFP-268: a selected journey through a form that posts back to its own page gets a test, after the route's normalising")

**Expected result:** `normalizeJourneys` read a journey's `path` through the de-duplicating string-list normaliser, so a form posting back to its own page (`/contact > /contact`) lost an entry, its steps no longer lined up with the path, and the journey was dropped without a word: selected on the review screen, no test written. Since `6a5b4c4`, which added journeys. The path now keeps its order and repeats (trimmed, empty entries dropped); every other string list is still de-duplicated. Ranking, selection (by id) and the journey test writer (step by step, from `steps`) don't depend on a path's pages being distinct. **Proven:** both unit tests fail on the old code (no journeys survive; no test written) and pass on the new one. On the fixed content profile (`benchmarks/2026-09-29/content-profile.json`), all 10 of whose journeys end in a form posting to its own page: 0 of 10 survived and 0 tests were written before, 10 and 10 after. Template: `check:template-unchanged` against `435d78f`, 170 of 172 identical; the 2 "journeys selected" inputs each gain the 10 journey tests (+373 −1 lines: the journey that was already there moves from the 1st to the 11th id, TFFU-037 to -047 in fast mode, -044 to -054 in deep), every line read. **Not covered:** a selected journey dropped for another reason (steps that don't match the graph) still gets no test and no message (`route.ts` narrows `selectedJourneyIds` to the survivors without a word). Introspect returns journeys unnormalised and generate normalises them, so this holds only while the two agree, and no test checks that they do: this bug was such a disagreement.

### TFP-269 - Keep helper comments in generated suites, so the template check sees them (added 2026-11-03)

- **Status:** Done and verified 2026-11-04: `06489fd`; baseline moved in
  `2d210e8`. The shared-visit
  pass carries each moved declaration's leading comments
  (`withLeadingComments` in `shared-visits.ts`); declarations are still
  compared by their code alone. **Verified** on a Linux clone, the
  uncommitted files on `7e2f5ef`: `helper-coverage.test.mjs` and
  `shared-visits.test.ts` 8 of 8 passed, 0 skipped; with the old
  `shared-visits.ts`, the new coverage test fails ("20 distinct comment
  lines reached by no fixed input"). `check:template-unchanged 7e2f5ef`: 172
  inputs, 98 identical, 74 different; Cowork's own line analysis of all 74:
  0 lines removed, 0 added lines that aren't comments (no blank lines
  either), 29 distinct comment lines added (the 20, plus 9 from the
  Comprehensive security and accessibility helpers that Standard suites had
  been dropping). GEN-107 ✅ (row 381 characters). Claude Code's full unit
  run (724 of 724) and `tsc`/ESLint weren't re-run here.
- **Phase:** None — after TFP-253
- **Priority:** P2
- **Suggested labels:** `generate`, `test`
- **Problem it solves:** the shared-visit pass moves helper declarations to
  the top of a suite with `getText()` and removes them from `getFullStart()`,
  so the comment lines before each declaration are dropped: 20 distinct
  lines (`controls.ts` 8, `READ_ONLY_GUARD_HELPER` 7, `SPELLING_HELPERS` 3,
  `LAYOUT_HELPERS` 2). A change to them changes no output the template check
  compares. `READ_ONLY_GUARD_HELPER`'s 7 do reach users' suites in full,
  through site-suite reuse (`withGuardHelper`) and the gap writer, which the
  check doesn't run. Options weighed (TFP-258's entry): keep the comments
  through the move; run the check on the site-suite path too; accept the
  gap. **Chosen (Emil, 2026-11-03): keep the comments through the move.**
- **Scope:**
  - The shared-visit pass carries each declaration's leading comments with
    it.
  - Extend `helper-coverage.test.mjs` to fail on a helper comment line no
    output carries.
  - Re-record `TEMPLATE_BASELINE` in `nightly.yml` in its own commit.
- **Acceptance criteria:**
  - **Red first:** the extended coverage test fails on today's code, naming
    the 20 lines.
  - `check:template-unchanged` shows only added comment lines (about 100
    inputs, per TFP-258's estimate), every kind read; no code line changes.
  - GEN-107 moves to ✅.
- **Dependencies:** TFP-258 (done).

### TFP-270 - Clear the six Dependabot alerts in dev dependencies (added 2026-11-03)

- **Status:** Done and verified 2026-11-04: `804c191`. After the push
  Dependabot marked #142, #139, #138, #110 and #56 fixed; #144 was
  dismissed as tolerable risk (2026-11-04, with the TFP-270 comment), so
  none is open. Only `package.json` and `package-lock.json`: `npm audit fix`
  without `--force` (brace-expansion 1.1.14 to 1.1.21, and 19 ESLint-tree
  packages within their ranges) and an `overrides` entry pinning dompurify
  3.4.17, its reason and removal check in a top-level `"//"` field.
  **Verified** on a Linux clone against `b091875`'s lockfile: `npm audit`
  (dev included) went from 27 (19 moderate, 1 high, 7 critical) to 21
  moderate, only the `glob` and `minimatch <11.0.1` sections left;
  `npm audit --omit=dev --audit-level=high` 0; the lockfile has dompurify
  3.4.17 and brace-expansion 1.1.21 (the other two copies 5.0.12). So #142,
  #139, #138, #56 and #110 are gone; **#144 (minimatch) stays:** fixed only
  in 11.0.1+, which no released ESLint plugin supports (minimatch 11 has no
  default export, which `eslint-plugin-import` calls). **Ruling (Emil,
  2026-11-04):** dismiss #144 in Dependabot as tolerable risk (dev-only lint
  tooling, globs from our own config; revisit when ESLint's plugins support
  minimatch 11). **The override is partial by
  nature:** Allure's report pages still run a DOMPurify 3.4.16 compiled into
  its prebuilt bundles, which only an Allure release replaces; Allure calls
  it with none of the options the three advisories need. Claude Code's
  Allure smoke report (5 of 5, opened, no errors), lint (0 errors) and unit
  run (725 of 725) weren't re-run here.
- **Phase:** None — after TFP-269, before Phase 47
- **Priority:** P3
- **Suggested labels:** `security`, `dependencies`
- **Problem it solves:** Dependabot (last check 2026-11-02 21:58, after
  being stale since 2026-10-28) shows 6 open alerts, all in development
  dependencies that other packages pull in, so the nightly `npm audit
  --omit=dev` doesn't see them: DOMPurify 3.4.16 under Allure's report
  packages (#142 critical, #139 high, #138 low; Allure has no fixed release),
  brace-expansion 1.1.14 under ESLint (#56 high, #110 moderate), minimatch
  under ESLint's plugins (#144 moderate).
- **Scope:**
  - An npm `overrides` entry pinning a patched DOMPurify, with a comment
    saying why and when to remove it (when Allure ships a fixed version).
  - Update brace-expansion and minimatch (`npm audit fix` where it works;
    an override only if not).
  - The Allure report and ESLint still work.
- **Acceptance criteria:**
  - `npm audit` (dev included) shows none of the six; the count of what's
    left is stated.
  - An Allure report builds and opens; `npm run lint` passes; unit tests
    pass.
  - Dependabot's open alerts drop to 0 after the push, or the ones left are
    named with a reason.
- **Dependencies:** none.

### TFP-271 - Tell the user when a selected journey is dropped (added 2026-11-04)

- **Status:** Done 2026-11-08: `5a2673d`, verified (Cowork, 2026-11-08);
  the review's two low items (the inspected-path reason, the untested
  "steps don't match" reason) were fixed in it. Split from TFP-268's scope (Emil, 2026-11-04). The journey check
  moved to `src/lib/generate/journey-check.ts`, used by both the normaliser
  and `explainDroppedJourneys`; the route adds `droppedJourneys` (id and
  reason) only when one is dropped; `GeneratedSuiteSection` shows them
  under the suite. **Verified** on a Linux clone, the uncommitted files on
  `804c191`: the route, dropped-journeys and journey tests 42 of 42 passed,
  0 skipped; with the old `route.ts`, the new route test fails (10 passed,
  1 failed); `check:template-unchanged 804c191`: 172 inputs, 172
  identical; `tsc` exit 0; GEN-108 ✅ (394 characters). Read: every
  `respond(...)` call comes after `droppedJourneys` is set (the closure
  reads it), as the code comment says. Claude Code's end-to-end test (fails
  against `HEAD`'s component at `toBeVisible`, passes with the change), its
  screenshot and its unit run (729 of 729) weren't re-run here.
- **Phase:** None — after TFP-270, before Phase 47
- **Priority:** P3
- **Suggested labels:** `generate`, `ui`
- **Problem it solves:** the generate route (`src/app/api/generate/route.ts`,
  around lines 93–96) narrows the user's selected journey ids to the
  journeys that survive `normalizeContentProfile`, and says nothing about the
  rest. TFP-268 fixed the known cause (a path that revisits a page), but any
  other mismatch would again drop a selected journey silently: the user
  selected it, and no test and no reason appear.
- **Scope:**
  - The generate response lists each selected journey id that was dropped,
    with a short reason (for example "its steps don't match its path").
  - The UI shows that list beside the generated suite, in plain words.
  - Nothing changes when no selected journey is dropped.
- **Acceptance criteria:**
  - **Red first:** a route test that selects a journey which can't survive
    normalising, failing on today's code (no field), passing after.
  - The UI shows the message for that case (a component or end-to-end
    test), and shows nothing extra in the usual case.
  - `check:template-unchanged`: 172 of 172 identical (suites don't change).
  - GEN-108 moves from ⚠️ to ✅.
- **Dependencies:** TFP-268 (done).

### TFP-272 - A crawl whose browser fails to launch stays "running" forever (added 2026-11-08)

- **Status:** Done 2026-11-08: `ad498f8`, verified (Cowork, 2026-11-08).
  Found while building TFP-263 (2026-11-08); present before and
  after it. Launch and the first page now sit in their own `try` in
  `src/lib/pipeline/crawl.ts`; a throw closes any browser that started and
  returns "failed" with "The browser for the crawl could not start: " and
  the cause's first line. **Verified** on a Linux clone, the uncommitted
  files on `b493265`: `src/app/api/crawl/route.test.ts` 3 of 3 passed, 0
  skipped; with the old `crawl.ts` the new test fails (2 passed, 1 failed,
  `browserType.launch: Executable doesn't exist at /no/such/chrome`).
  CRW-04 ✅. Claude Code's standalone status script, its 18 browser-crawl
  unit tests and regression (73 of 73) weren't re-run here. The CLI's half
  of the scope (report and exit non-zero) comes with TFP-245.
- **Phase:** None — after TFP-263, before TFP-245
- **Priority:** P2
- **Suggested labels:** `bug`, `crawl`
- **Problem it solves:** `/api/crawl` starts the crawl with `void
  runCrawlJob(job)`. If launching Chromium throws (a missing browser, a bad
  `PLAYWRIGHT_BROWSERS_PATH`), the throw comes before the crawl's own
  `try`, the promise rejects unseen, and the job's status never leaves
  "running": the UI polls forever with no error.
- **Scope:** a launch failure ends the job as "failed" with a plain
  message naming the cause; the CLI path (TFP-245) reports it and exits
  non-zero.
- **Acceptance criteria:**
  - **Red first:** a route test whose browser launch throws, failing on
    today's code (status stays "running"), passing after (status
    "failed", the message in `error`).
  - The existing crawl tests pass unchanged.
- **Dependencies:** TFP-263.

### TFP-282 - Link health's route test can pass under load without checking the route (added 2026-11-11)

- **Status:** Open.
- **Phase:** None — after Phase 48 merges
- **Priority:** P2
- **Suggested labels:** `test`, `flaky`
- **Problem it solves:** in Phase 48's Gate B (2026-11-11), the unit test
  "a linked missing route fails link health, naming it"
  (`src/lib/introspect/routes.test.ts`) got Passed instead of Failed.
  Beside the full suite's other browser tests it took 96 s, and the
  generated check spent its 14 s route budget ("2 linked routes not
  checked: the check stops after 14 s (/spa#/chainsaws,
  /spa#/products/1)") before reaching the missing route. Alone it took
  39 s and passed. The budget is a known coverage limit (U9 in
  `data/labelled-failures.md`). The weakness is that the test passes
  when the check never reached what it is meant to catch.
- **Scope:** the test fails, not passes, when the route it checks wasn't
  reached: it asserts the missing route was checked, not only the
  verdict. It also gets the time it needs under load, either through its
  own budget or by running alone. The generated check's 14 s budget
  stays as it is: this ticket changes the test, not the template.
- **Acceptance criteria:**
  - **Red first:** with the budget forced short, today's test passes; the
    new test fails, naming the unchecked route.
  - The test passes in a full `npm run test:unit`, three runs in a row.
  - `check:template-unchanged`: identical with no map.
- **Dependencies:** Phase 48 merged.

### TFP-283 - The self-test's server times out on a cold build (added 2026-11-11)

- **Status:** Open.
- **Phase:** None — after Phase 48 merges
- **Priority:** P3
- **Suggested labels:** `test`, `ci`
- **Problem it solves:** `playwright.self-test.config.ts`'s webServer runs
  `npm run serve:self-test`, which builds and then starts the app, within
  `timeout: 120_000`. In Phase 48's Gate B (2026-11-11), a fresh session
  with no build cache took 3.3 min to compile, and the suite stopped with
  "Timed out waiting 120000ms from config.webServer" before any test ran.
  The rerun, with a warm cache, passed 5 of 5. Whether the suite runs
  depends on the cache, not the code.
- **Scope:** the build happens before Playwright waits for the server (a
  separate build step, as `test:regression` already does), or the
  timeout covers a measured cold build. CI's self-test job gets the same
  fix.
- **Acceptance criteria:**
  - **Red first:** with `.next/` removed, today's command times out;
    after the fix it runs all 5 tests.
  - A warm-cache run takes no longer than before, within a minute.
- **Dependencies:** Phase 48 merged.

### TFP-284 - Playwright on the current GitHub runner image (added 2026-11-11)

- **Status:** Open.
- **Phase:** None — after Phase 48 merges
- **Priority:** P2
- **Suggested labels:** `ci`, `dependencies`
- **Problem it solves:** on 2026-11-11, between 09:05 and 15:25 UTC,
  GitHub's `ubuntu-latest` moved from `ubuntu-24.04` to `ubuntu-26.04`.
  Playwright 1.59.1 stops there: "ERROR: Playwright does not support
  chromium on ubuntu26.04-x64" (PR Validation run 43048248301, both
  attempts), before lint. Phase 48's merge was unblocked by pinning every
  job to `ubuntu-24.04` (owner decision, 2026-11-11). That pin holds only
  while GitHub keeps the 24.04 image.
- **Scope:** move Playwright to a release that supports `ubuntu-26.04`
  (1.65.0 is the latest on 2026-11-11; support not yet checked), then
  return the jobs to `ubuntu-latest` or pin `ubuntu-26.04`. The browser
  version moves with it, so the generated template is re-checked.
- **Acceptance criteria:**
  - **Red first:** the PR Validation failure above, quoted.
  - Every workflow green on the new image: PR Validation, CodeQL,
    regression, self-test, and a dispatched nightly.
  - `check:template-unchanged`: identical with no map, or each difference
    named and owner-accepted.
- **Dependencies:** Phase 48 merged.

---

## Owner plans to carry into the register (2026-10-28) — carried 2026-10-30 as D38 and D39

To add to `deferred-work-register.md` once Claude Code's D37 commit has
landed (the file is in its working set now):
- **D38 — "Comprehensive" becomes "Break Me"** once more areas have
  Comprehensive sets: UI, report and docs wording.
- **D39 — The application gets a new name** (there are many "testforge"
  repos); proposed "Mr Onion" (2026-10-30), its own short phase before
  TFP-247, `v0.2.0` tagged under the current name. Superseded by the
  register's D39 entry. To settle before Phase 47's TFP-247 publishes an image or
  action, and before the first GitHub release, since outside pipelines will
  pin the name. It touches the repo and package names, the
  `testforge-skills` plugin, the local data folder
  (`%LOCALAPPDATA%\TestForge`, which needs a one-time move), the
  `TESTFORGE_*` settings, test-ID prefixes (`TF…`), the `TFP-` ticket
  prefix and the `testforgeapp@gmail.com` addresses.

## Recommended execution order

Phase 39 and its tickets stay first. These slot in between gates:

0. **TFP-261 first.**
1. TFP-250 (names), TFP-254 (with or after TFP-261), TFP-255 and TFP-262 —
   small, and they change what any outside reader sees first.
2. TFP-244 — the decision record, so the answer to "can it run in CI?"
   becomes a dated plan.
3. TFP-257 (steps 1–5 can go first, independently), then TFP-245.
4. TFP-246 and TFP-247 (independent of each other once TFP-245 lands).
5. TFP-248 — Gate A for Phase 47.
6. TFP-260 and TFP-253 soon; TFP-252, TFP-259, TFP-256, TFP-251 whenever a slot opens.
7. TFP-249 — after Phase 43.

Where Phase 47 sits relative to the deferred-work build order (after
Phase 39; ownership confirmation; Standard sets…) is an owner decision,
taken in TFP-244.

## Suggested milestone gates

### Gate A — TestForge runs in a pipeline (Phase 47)
- TFP-248's acceptance criteria met in TestForge's own CI: clean passes,
  with-bugs fails, unreachable is exit 2.
- Independent verification of TFP-245's exit codes and JUnit counts.

### Gate B — A second run is trustworthy
- TFP-246's baseline criteria met: known failures don't fail the build; a
  planted new bug does; a fixed bug is reported fixed.
