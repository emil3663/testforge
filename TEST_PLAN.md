# TestForge — Test Plan

**Version:** 1.0
**Last updated:** 2026-09-17
**Status:** In active development

## 1. App Overview

TestForge is an AI-native test automation assistant: a tester describes what
to check in plain English (or picks from best-practice coverage areas), and
TestForge crawls the target site, inspects what's actually on each page, and
generates a deterministic (or, with an OpenAI key configured, AI-assisted)
Playwright TypeScript suite from that inspection. The generated suite runs
through an async lifecycle with live progress, and results land in a
seven-tab structured report with HTML export. Main areas: suite creation,
crawl, introspect, generate, run, report, export, and save-suite.

## 2. Current Feature Status

| Feature | Status | Notes |
|---------|--------|-------|
| Generate | ✅ Done | Template-based generator by default; OpenAI GPT-4o path available when `OPENAI_API_KEY` is set, but that path is untested in CI (see Known Limitations). |
| Crawl | ✅ Done | Same-origin BFS crawl of the target site to discover pages before generation. |
| Introspect | ✅ Done | Per-page DOM inspection (elements, roles, content) that feeds content-aware generation. |
| Run | ✅ Done | Async run lifecycle: live progress, cancellation, and targeted rerun of just the failed tests. |
| Report | ✅ Done | Seven-tab structured report — summary, execution, defects, coverage, performance, usability, and SEO (when SEO coverage is selected). |
| Export | ✅ Done | HTML export of the structured report. |
| Save-suite | ✅ Done | Persists an edited generated suite before it's run. |

## 3. Test Cases

### 3.1 Health & Observability

| ID | Test | Expected Result | Status |
|----|------|-----------------|--------|
| HLT-01 | `GET /api/health` (automated: `tests/regression/testforge.sections.spec.ts` — "reports health and observability metadata") | Response is `ok`; JSON body includes `status: "ok"`, `service: "testforge-next"`, a string `environment`, a `siteUrl` containing `http`, and an ISO `timestamp`; response carries `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a `Permissions-Policy` restricting `camera`, and a `Content-Security-Policy` with `default-src 'self'`. | ✅ |

### 3.2 Generate (GEN)

| ID | Test | Expected Result | Status |
|----|------|-----------------|--------|
| GEN-01 | Suite-creation UI renders (automated smoke: "renders critical suite creation UI") | Header shows "TestForge"; the "Test Suite Creation" panel and the "Generated Suite" section are both visible before any suite is generated. | ✅ |
| GEN-02 | Generate a suite from a plain-English prompt (automated smoke: "generates a Playwright suite from prompt input") | Submitting Base URL + description produces a non-empty `.spec.ts` suite in the Generated Suite panel. | ✅ |
| GEN-03 | Creation inputs, generation mode, and best-practice inference (automated: "covers the creation inputs, generation mode, and inferred best-practice state") | The creation form correctly reflects which generation mode (template vs. AI) is active and which best-practice coverage areas are inferred from the description. | ✅ |
| GEN-04 | SEO coverage is generated when SEO-relevant input is given (automated: "covers SEO metadata and crawler-facing files") | Generated suite includes SEO checks (meta description, crawler-facing files) when the description or selected practice areas call for them. | ✅ |
| GEN-05 | SEO coverage is withheld when Functional is explicitly selected (automated: "does not generate SEO coverage when Functional is explicitly selected") | Selecting Functional explicitly, without SEO, produces a suite with no SEO test block. | ✅ |
| GEN-06 | Content-profile SEO checks withheld under the same condition (automated: "does not generate content-profile SEO checks when Functional is explicitly selected") | No content-profile-derived SEO checks appear in the generated suite when Functional was explicitly and exclusively selected. | ✅ |
| GEN-07 | Regeneration required after changing selected best-practice areas (automated: "requires regeneration before running when selected best-practice areas change") | Changing the selected best-practice areas after a suite exists disables Run until the suite is regenerated. | ✅ |
| GEN-08 | Manual: generate with no `OPENAI_API_KEY` set | Template-based generator produces a suite; no request to OpenAI is made. | ⬜ |
| GEN-09 | Manual: generate with `OPENAI_API_KEY` set | OpenAI GPT-4o path produces a suite with descriptive test names. | ⬜ |

### 3.3 Crawl (CRW)

| ID | Test | Expected Result | Status |
|----|------|-----------------|--------|
| CRW-01 | Discovered-pages section, crawl lifecycle, and page selection (automated: "covers the discovered site pages section, crawl lifecycle, and page selection controls") | Crawl discovers same-origin pages, surfaces them for selection, and the UI reflects crawl-in-progress / crawl-complete states correctly. | ✅ |
| CRW-02 | Manual: crawl a multi-page site | All same-origin pages reachable within crawl depth are listed; off-origin links are not crawled. | ⬜ |

### 3.4 Introspect (INT)

| ID | Test | Expected Result | Status |
|----|------|-----------------|--------|
| INT-01 | Content rules and content-aware generation state (automated: "covers the content rules section and content-aware generation state") | Per-page introspection results (elements, roles, content) are reflected in the content rules section and inform content-aware generation. | ✅ |
| INT-02 | Manual: introspect a page with no actionable elements | Introspection completes without error and reports an empty or near-empty actionable-element set rather than failing. | ⬜ |

### 3.5 Run (RUN)

| ID | Test | Expected Result | Status |
|----|------|-----------------|--------|
| RUN-01 | Run a generated suite and open the report popup (automated smoke: "runs a generated suite and opens report popup") | Run completes and the structured report popup opens automatically. | ✅ |
| RUN-02 | Stopping a run preserves planned/interrupted/not-run state (automated: "preserves planned, interrupted, and not-run test states when a run is stopped") | A test already completed before Stop keeps its result; the test in flight is marked interrupted; tests that hadn't started are marked not-run — not silently dropped. | ✅ |
| RUN-03 | Rerun only selected failed tests via API (automated: "runs only the selected failed test titles when includeTestTitles is provided") | Passing `includeTestTitles` reruns exactly those tests; passing tests and untitled failed tests are excluded from the rerun. | ✅ |
| RUN-04 | Rerun a selected failed test from the report UI (automated: "reruns the selected failed test from the execution report") | Selecting a failed test in the execution report and triggering rerun re-executes only that test. | ✅ |
| RUN-05 | Session evidence capture on failure (automated: "captures session evidence artifacts for failed generated runs") | A failed generated test produces captured evidence artifacts (trace/video/screenshot per `playwright.config.ts`'s `retain-on-failure`/`only-on-failure` settings). | ✅ |
| RUN-06 | Manual: cancel a run mid-execution from the UI | Run stops promptly; already-completed test results remain visible. | ⬜ |

### 3.6 Report (RPT)

| ID | Test | Expected Result | Status |
|----|------|-----------------|--------|
| RPT-01 | Defect backlog and usability findings render in plain language (automated: "formats defect backlog and usability findings in plain language") | Report's defects/usability tabs show human-readable findings, not raw Playwright matcher output. | ✅ |
| RPT-02 | Defects, usability findings, and evidence link to the same failed test (automated: "links defects, usability findings, and captured artifacts to the same failed test") | A single failing test's defect entry, usability finding, and captured evidence artifact are all traceable to that same test in the report. | ✅ |
| RPT-03 | SEO checks grouped by page across multiple pages (automated: "groups SEO checks by page when multiple pages are under test") | SEO tab groups findings under the page they belong to when more than one page was tested. | ✅ |
| RPT-04 | SEO findings summarized in plain language (automated: "summarizes SEO findings in plain language instead of raw matcher errors") | SEO tab shows a plain-language summary rather than a raw assertion failure message. | ✅ |
| RPT-05 | Broken-link failures list the specific broken links (automated: "lists the specific broken links in observed outcomes for broken-link failures") | A broken-link test failure's observed outcome names the specific URL(s) that failed, not a generic failure message. | ✅ |
| RPT-06 | No structured report when Playwright executes zero tests (automated: "does not show a structured report when Playwright executes zero tests") | If the underlying Playwright run executes no tests, the UI does not present a structured report as if one exists. | ✅ |
| RPT-07 | Fallback report page for runs without structured report data (automated: "opens a fallback report page for runs without structured report data") | A run lacking structured report data opens a fallback report page rather than erroring or showing a blank state. | ✅ |
| RPT-08 | Report tabs, export, and page-scoped SEO drilldown after a run (automated: "covers the report tabs, HTML export, and page-scoped SEO drilldown after running a generated suite") | All seven report tabs are navigable, HTML export is available, and the SEO tab supports drilling into a specific page's findings. | ✅ |

### 3.7 Export (EXP)

| ID | Test | Expected Result | Status |
|----|------|-----------------|--------|
| EXP-01 | Export HTML report after a suite run (automated smoke: "exports HTML report after suite run") | Exporting after a run produces a downloadable HTML file containing the report content. | ✅ |
| EXP-02 | Manual: open an exported HTML report standalone (no dev server running) | Exported HTML renders correctly in a browser with the TestForge server stopped. | ⬜ |

### 3.8 Save-suite (SAV)

| ID | Test | Expected Result | Status |
|----|------|-----------------|--------|
| SAV-01 | Generated suite section: editing and saving actions (automated: "covers the generated suite section actions for editing and saving") | Edits made to the generated suite in the in-browser editor are saved and reflected before Run uses the saved version. | ✅ |
| SAV-02 | Add a generated suite to Playwright discovery (automated smoke: "adds a generated suite to Playwright discovery") | Saving a generated suite makes it discoverable by Playwright (e.g. VS Code Test Explorer / `playwright test --list`). | ✅ |

## 4. Known Limitations & Gaps

1. **`/api/run`'s execution model is unsandboxed, in-process code execution.** It runs caller-supplied Playwright code with the privileges of the user running the dev server — no authentication, no sandboxing, no multi-tenant isolation. This is documented, intended behavior under TestForge's local-only posture (see `README.md`'s Security Model), not a defect, and it is why TestForge must never be bound to a non-loopback interface or exposed through a tunnel.
2. **Chromium only.** Cross-browser execution (Firefox, WebKit) is out of scope as of Phase 16 (TFP-012); `playwright.config.ts` declares a single `chromium` project.
3. **Run state is in-memory only.** Nothing persists across a server restart; there is no way to compare two runs of the same site against each other. This is the specific gap Phase 17 (run persistence and honest coverage) is scoped to close.
4. **Coverage is computed from the tests that ran, not against a discovered surface.** There is no "not tested, and why" accounting yet — also a Phase 17 target.
5. **The OpenAI-backed generation path is untested in CI.** Only the template-based generator runs in automated tests; the AI path is exercised manually. Phase 21 evaluates it against the deterministic generator using Phase 17's persistence.
6. **No deployed or hosted version exists, and none is assumed.** TestForge is local-only by design; `docs/decisions/saas-prerequisites.md` records what a hosted version would actually require and states plainly that none of it is implemented.

## 5. Roadmap / Next Steps

### Sprint 1 (Close out Phase 16)
- [x] TFP-005 — delete stale `copilot/*` branches from origin
- [ ] TFP-031 — close the regression gap left by proxy removal (assert `/api/health` reports local in-process mode; assert each route executes without an external backend configured)
- [x] TFP-030 — this document
- [x] TFP-032 — `docs/decisions/saas-prerequisites.md`

### Sprint 2 (Phase 17 — run persistence and honest coverage)
- [ ] Persist run config, suite, result, and evidence to disk
- [ ] Recompute coverage against the discovered surface (crawl + introspect), not just the tests that ran
- [ ] Add a "not tested, and why" report section
- [ ] Diff two persisted runs of the same site

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
