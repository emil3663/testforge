# TestForge — Test Plan

**Version:** 1.0
**Last updated:** 2026-10-16 (header, overview, feature status, known limitation 1 and the roadmap pointer, from the post-Phase 42 review; the test cases were already current)
**Status:** In active development

## 1. App Overview

TestForge is a local-only test automation tool. It crawls a target site,
groups the pages into page types and picks one page of each (up to 8),
inspects what's actually on them, and generates a deterministic Playwright
TypeScript suite from that inspection with its template generator. A local
model (Ollama) or OpenAI can fill only the areas the template leaves empty;
neither is needed.

Two kinds of run:
- **Standard:** the critical working path, at the read-only gate unless the
  interactive gate is switched on.
- **Comprehensive:** one area in depth, or all of them, trying to break
  fields and flows.

The active gate (attack-shaped input, such as the script-payload test) stays
closed: it opens only with a site's ownership confirmation, which isn't
built yet (Phase 43). Data-changing tests, such as journeys and the database
round trip, sit at the interactive gate.

Each site's Standard suite is kept and reused, regenerated only for page
types that changed. A library holds Comprehensive tests
written against component patterns. A coverage map shows, element by
element, what no test touches.

Runs go through an async lifecycle with live progress, and results land in
a structured report with HTML export. Main areas: suite creation, crawl,
page-type selection, introspect, generate, site suites and the library,
run, report, export, and save-suite.

## 2. Current Feature Status

| Feature | Status | Notes |
|---------|--------|-------|
| Generate | ✅ Done | Template-based generator by default; OpenAI path available when `OPENAI_API_KEY` is set. That path now degrades safely (TFP-083: failure, timeout, empty completion and an unusable model catalog all fall back to the template, labelled `generatedBy: "fallback"`) and picks its model from an ordered candidate list in `src/lib/generate/models.ts`. Still not evaluated against the template generator and not run in CI with a real key (see Known Limitations). A local Ollama path (TFP-103, Phase 30) takes priority when `TESTFORGE_OLLAMA_MODEL` is set; it runs, degrades safely, and only labels a suite as model output if it type-checks against Playwright (Known Limitations item 9). |
| Crawl | ✅ Done | Same-origin BFS crawl of the target site to discover pages before generation. |
| Introspect | ✅ Done | Per-page DOM inspection (elements, roles, content) that feeds content-aware generation. |
| Run | ✅ Done | Async run lifecycle: live progress, cancellation, and targeted rerun of just the failed tests. |
| Report | ✅ Done | Seven-tab structured report — summary, execution, defects, coverage, performance, usability, and SEO (when SEO coverage is selected). |
| Export | ✅ Done | HTML export of the structured report. |
| Save-suite | ✅ Done | Persists an edited generated suite before it's run. |
| Comprehensive runs | ✅ Done | Phase 35: one area in depth or all areas, starting with security; a single-area run reports only that area, an all-areas run gives a summary plus per-area reports. One worker off a local host. |
| Gates and Standard conformance | ✅ Done | Phase 38: read-only, interactive and active gates (active behind the typed ownership confirmation); passive security and the axe scan shared with Comprehensive; performance graded by Core Web Vitals bands ("needs improvement" is a finding, "poor" fails). |
| Page-type selection | ✅ Done | Phase 40: pages grouped by address pattern, split by form signature; Standard tests one page of every type, capped at 8; the report lists types found, covered and skipped, with a copyable page list. |
| Check gaps | ✅ Done | Phase 41: layout consistency, overlap and unrendered images, spelling, controls that don't do their job (GET-only interactions behind a request guard), tab order and grouping, known-path probes, guessable ids, exposed API fields. Local Toolshop copies: 33 of 37 known bugs found with Standard plus Comprehensive security and accessibility (Gate B, TFP-188); 30 with Standard alone (TFP-207). |
| Site suites, library, coverage map | ✅ Done | Phase 42: Standard suites kept per site and reused; a library of component-pattern tests with candidates promoted only with the tester's approval; a coverage map in two tiers (reachability and in context), with a template test for every link on the selected pages (TFP-205). The gap writer (Claude Code) exists but is off unless a site opts in, and not kept as a bug finder (Gate B ruling). |
| Run concurrency and speed | ⏳ Locked, not started | Phase 39, amended 2026-10-16: fewer page visits first, then workers by host. Today Standard runs 4 workers in the app (2 in deep mode). |

## 3. Test Cases

Each area's cases are in a file of their own under `docs/test-plan/` (TFP-253). A ticket names the area it touches: read that file, not all of them. A case keeps its ID and its row; a new case goes in its area's file.

| § | Area | Cases | File |
|---|------|-------|------|
| 3.1 | Health & Observability (HLT) | 1 | [docs/test-plan/HLT.md](docs/test-plan/HLT.md) |
| 3.2 | Generate (GEN) | 108 | [docs/test-plan/GEN.md](docs/test-plan/GEN.md) |
| 3.3 | Crawl (CRW) | 5 | [docs/test-plan/CRW.md](docs/test-plan/CRW.md) |
| 3.4 | Introspect (INT) | 11 | [docs/test-plan/INT.md](docs/test-plan/INT.md) |
| 3.5 | Run (RUN) | 53 | [docs/test-plan/RUN.md](docs/test-plan/RUN.md) |
| 3.6 | Report (RPT) | 21 | [docs/test-plan/RPT.md](docs/test-plan/RPT.md) |
| 3.7 | Export (EXP) | 2 | [docs/test-plan/EXP.md](docs/test-plan/EXP.md) |
| 3.8 | Save-suite (SAV) | 3 | [docs/test-plan/SAV.md](docs/test-plan/SAV.md) |
| 3.9 | Test suite (TST) | 7 | [docs/test-plan/TST.md](docs/test-plan/TST.md) |
| 3.10 | CI command line (CI) | 22 | [docs/test-plan/CI.md](docs/test-plan/CI.md) |

## 4. Known Limitations & Gaps

1. **`/api/run` executes code without a sandbox.** It writes the caller-supplied Playwright suite to disk and runs it in a spawned child process (`src/lib/run/executor.ts`), with the privileges of the user running the dev server — no authentication, no sandboxing, no multi-tenant isolation. Since TFP-202 (Phase 42) that process gets a trimmed environment (`src/lib/run/child-env.ts`): only what Node, the Playwright CLI and the browser need, plus what TestForge sets for the run, so TestForge's keys and settings are out of a test's reach. That is not a sandbox; running tests inside Docker is a decision for the post-Phase 42 review. This is documented, intended behavior under TestForge's local-only posture (see `README.md`'s Security Model), not a defect, and it is why TestForge must never be bound to a non-loopback interface or exposed through a tunnel. Since TFP-261 the server binds to `127.0.0.1` and its API refuses requests from another host name, another origin, or a write that isn't JSON (RUN-43). Open issue: [#5](https://github.com/emil3663/testforge/issues/5).
2. **Chromium only.** Cross-browser execution (Firefox, WebKit) is out of scope as of Phase 16 (TFP-012); `playwright.config.ts` declares a single `chromium` project. Open issue: [#6](https://github.com/emil3663/testforge/issues/6).
3. **Run persistence and diffing (Phase 17) have landed** — a finished run's config, suite, result, and evidence survive a server restart (`runs/<runId>/`, RUN-08/RUN-09), and two persisted runs of the same `baseUrl` can be diffed via `GET /api/runs/diff` for specific test-status changes, per-area coverage deltas, and newly discovered/missing elements (RUN-12). Data + API only, per the decision record's own scope lock — no diff UI yet. Open issue: [#7](https://github.com/emil3663/testforge/issues/7).
4. **Coverage is now computed against the discovered surface for functional and accessibility (Phase 17 Groups 2/3, RUN-10/RUN-11)** — an element counts as covered only if it was actually the subject of an executed test, and every unmatched element is bucketed as not-selected / excluded-by-generator / generator-gap. Reliability dependency/storage surfaces and, since TFP-091, selected journeys are tracked the same way (journeys add an `interactive-skipped` bucket). Areas without a one-test-per-element generator shape (performance, security, SEO, responsive, cookie/session, database, and usability's bundled checks) still use the prior test-pass-rate rollup — there's no discovered-element surface to honestly denominate against for those. Open issue: [#8](https://github.com/emil3663/testforge/issues/8).
5. **The OpenAI-backed generation path is hardened but not evaluated, and no live completion has succeeded yet.** TFP-083 (Phase 28) makes the route fail safe: a rejected call, a timeout (30s, one budget for catalog lookup plus completion), an empty completion, or no candidate model in the live catalog each return the template generator's output labelled `generatedBy: "fallback"` with a `fallbackReason`, proven by tests against a fake OpenAI server. The same fallback was also observed against the real API on 2026-09-24 (a 429 "no credits" refusal returned the labelled template, not a 500). Still open: (a) `npm run check:openai-models` confirmed all three `OPENAI_MODEL_CANDIDATES` are in the live catalog (the route picks `gpt-4.1-mini`), but its test completion was refused because the account had no API credits — re-run it once the account is funded; (b) the AI path has not been compared against the deterministic generator, and no CI job calls OpenAI with a real key (Phase 21, TFP-098/099). Hardening is not evaluation. Open issue: [#9](https://github.com/emil3663/testforge/issues/9).
6. **No deployed or hosted version exists, and none is assumed.** TestForge is local-only by design; `docs/decisions/saas-prerequisites.md` records what a hosted version would actually require and states plainly that none of it is implemented. Open issue: [#10](https://github.com/emil3663/testforge/issues/10).
7. **`src/lib/introspect/dom-snapshot.ts` is deliberately long (800+ lines) and exempted from this repo's 500-line max-lines lint rule.** `captureDomSnapshot` is passed by reference to Playwright's `page.evaluate()`, which serializes the function's own source and runs it inside the browser's isolated JS context — every helper it uses must stay nested inside its body, since no module system is available there. Splitting it into separate files would silently break real page introspection. Open issue: [#11](https://github.com/emil3663/testforge/issues/11).
8. **Only a single-page login form is supported for authenticated runs (Phase 20, TFP-092).** They are configured in the app's "Authenticated Run" section (TFP-097) or as the `/api/run` request's `login` field. The login block is `loginUrl`, three selectors, two credential environment-variable *names*, and a post-login path/selector; multi-step logins, MFA, and CAPTCHA are not driven (the roadmap keeps login config-driven, not discovered). The login runs in the same browser context the tests do (`src/lib/run/browser-context.ts`), because a site can bind a session to the client that logged in; a target that binds to something else the context doesn't control would still refuse the session. Traces are now scrubbed of the run's credentials and session (TFP-094, RUN-18), but screenshots and videos are binary and cannot be text-scrubbed — they are kept as captured, and show whatever the authenticated page showed; trace scrubbing uses the zip reader/writer bundled inside `playwright-core` (an internal export, not a public API), so a Playwright update that moves it fails the RUN-18 regression test rather than leaking silently. **Credentials come from process environment variables only — no secret-store integration is supported (Decision 3, deferred deliberately, not silently).** The two variables must be set for the TestForge server process (a local `.env`, or the shell that starts it); a name must be upper case (letters, digits, underscore). A password that is itself all upper-case letters, digits and underscores, pasted where a name belongs, would still pass the name check and be echoed in a "variable X is not set" error to the caller (a local-only tool, and only if that variable is unset) — the check narrows the mistake, it cannot rule it out. Open issue: [#12](https://github.com/emil3663/testforge/issues/12).
9. **The local (Ollama) model's suites compile, but only the type check stands between it and invented APIs, and "compiles" is not "correct".** Phase 31 update: a local-only rules layer (TFP-106, GEN-27) fixed the accessibility defect described below. Three consecutive live accessibility requests now return real checks. The history below explains why the type check exists. TFP-103 (Phase 30) adds the path (`TESTFORGE_OLLAMA_MODEL`, setup in `docs/LOCAL_MODEL_SETUP.md`). It degrades safely: unreachable, model missing, Ollama error, timeout (180s) and empty output each return the labelled template suite, proven against a fake server (GEN-22 to GEN-25). Every local suite is also type-checked against `@playwright/test` before it is labelled model output (GEN-26), because `testforge-qwen7b` invents Playwright APIs. All three accessibility-worded requests run live on 2026-09-24 produced `expect(locator).toBeAccessible()`, which Playwright does not have. The first two predate the check. The third was caught and returned as `fallbackReason: "invalid_output"`. A functional request in the same session passed and was returned as model output (GEN-21). So a broken suite is never passed off as model output, but for accessibility coverage the local path currently yields the template. What the check does not judge: whether a valid suite's assumptions are right (the passing suite guessed a `/dashboard` URL after sign-in). Three samples are not a measured rate. Still true after Phase 31: the type check cannot see a missing `await`, a wrong URL, or an assertion that doesn't pass on the real page. The Phase 31 baseline (GEN-28) found all 10 areas compile, but performance, SEO and database suites contained nothing specific to their area, security and reliability only partly, and 9 of 10 suites navigated to `/login`, copied from the rules example (confirmed and removed in GEN-30). Phase 32 also found the model reuses an example's test names and structure (GEN-30), and that one baseline suite had an unawaited, never-run assertion (GEN-29). Phase 33: a suite with a never-run assertion is now rejected (GEN-31, `unawaited_assertion`). Worked-example guides now exist for reliability, performance, SEO, database and security, sent only for the areas in scope. Live, 3 consecutive each: performance, SEO, database and security now produce category-specific checks (GEN-33 to GEN-36). Reliability now simulates real failures but often maps the request's inputs and button onto duplicate, mislabelled tests (GEN-32, ⚠️). Accessibility (GEN-27 wording, 3/3) and functional (GEN-21) did not regress. Out of scope: trying other local models, and comparing the local path against the template and OpenAI paths (Phase 21, TFP-099). Open issue: [#13](https://github.com/emil3663/testforge/issues/13).
10. **The stale re-check's re-runs aren't judged for cap starvation (TFP-264, D37).** On a capped host, a failure the request cap starved is reported Not run (RUN-44), decided from the timing reporter's step times. The stale re-check of failing reused tests (Phase 42, TFP-191) runs without that reporter, so a reused test it re-runs keeps its re-run's result: a failure there is Failed even when the cap starved it. A rare path: a reused test that failed on a page that changed, on a capped host. Open issue: [#15](https://github.com/emil3663/testforge/issues/15).
11. **An image a later check's own action brings in is charged to the test that loaded the page (TFP-264, D40).** On a capped host, a failure the request cap starved is reported Not run (RUN-44). A resource a page's HTML pulls in counts for the test whose navigation loaded that page, so a lazy-loaded image a later check scrolls to, on a page an earlier test kept, counts for the earlier test. If the cap starves that check through its wait, it can still come out Failed. A fetch or XHR the check's own action sets off counts for the check, and isn't affected. Open issue: [#16](https://github.com/emil3663/testforge/issues/16).

## 5. Roadmap / Next Steps

The sprints below are the early history. Since Phase 35 the phase plan lives
in `docs/decisions/product-roadmap.md`, each phase in its own decision record
under `docs/decisions/`. Now: the post-Phase 42 review
(`docs/decisions/post-phase-42-review-plan.md`), then Phase 39.

### Sprint 1 (Close out Phase 16)
- [x] TFP-005 — delete stale `copilot/*` branches from origin
- [x] TFP-031 — close the regression gap left by proxy removal (assert `/api/health` reports local in-process mode; assert each route executes without an external backend configured)
- [x] TFP-030 — this document
- [x] TFP-032 — `docs/decisions/saas-prerequisites.md`

### Sprint 2 (Phase 17 — run persistence and honest coverage)
- [x] Persist run config, suite, result, and evidence to disk (Group 1, TFP-064)
- [x] Recompute coverage against the discovered surface (crawl + introspect), not just the tests that ran (Group 2, TFP-071)
- [x] Add a "not tested, and why" report section (Group 3, TFP-072)
- [x] Diff two persisted runs of the same site (Group 4, TFP-073)

### Sprint 3 (Phase 24 — reliability audit findings, `docs/decisions/phase-24-reliability-audit-backlog.md`)
- [x] TFP-065 — guard `JSON.parse` in `finalizeRunJob` against a corrupted report (silent run hangs)
- [x] TFP-066 — validate `runId` as a UUID before any file-path operation (path traversal)
- [x] TFP-067 — add `req.json()` error handling to the 5 unguarded POST handlers
- [x] TFP-068 — polling hook retry/backoff + terminal-status safety net (`useRun`, `useCrawl`)
- [x] TFP-069 — drop `unsafe-eval` from production CSP
- [x] TFP-070 — cleanups: dead `outputDir` env var, default base URL callout, `PLANE_SECRET_KEY` default callout

## 6. GitHub Project Board Structure

TestForge currently tracks phase work as numbered `TFP-NNN` tickets inside
`docs/decisions/phase-N-*-backlog.md`, not as live GitHub Issues. The
structure below is the suggested shape if/when this repo's tracking moves
to a GitHub Project board, kept consistent with the labels already used
across the backlog docs.

| Column | Description |
|--------|-------------|
| 🧊 Backlog | Roadmapped, not yet locked (e.g. Phase 18–21 items) |
| 🔍 Needs Investigation | Spikes / trials before a ticket is written (e.g. TFP-036's style) |
| 🚧 In Progress | Actively being worked on |
| 👀 In Review | PR open, awaiting review |
| ✅ Done | Merged |

### Suggested Labels

| Label | Colour | Use |
|-------|--------|-----|
| `bug` | red | Something isn't working |
| `technical-debt` | orange | Cleanup, dead-code removal, hardening |
| `refactor` | orange | Behavior-preserving restructuring |
| `documentation` | blue | Docs-only changes |
| `testing` | purple | Test coverage additions or fixes |
| `investigation` | yellow | Spike/trial work, not yet a locked ticket |
| `skills` | green | `skills/` library changes |
| `chore` | grey | Housekeeping (e.g. branch cleanup) |
