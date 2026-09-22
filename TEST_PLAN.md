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
| HLT-01 | `GET /api/health` (automated: `tests/regression/testforge.sections.spec.ts` — "reports health and observability metadata") | Response is `ok`; JSON body includes `status: "ok"`, `service: "testforge-next"`, a string `environment`, `mode: "local-in-process"` (TFP-031 — every route runs in-process since TFP-010/011 deleted the FastAPI proxy layer, so there is no other mode to report), a `siteUrl` containing `http`, and an ISO `timestamp`; response carries `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a `Permissions-Policy` restricting `camera`, and a `Content-Security-Policy` with `default-src 'self'`. | ✅ |

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
| GEN-10 | Generate executes with no external backend configured (automated: `tests/regression/testforge.sections.spec.ts` — "executes generate, run, crawl, introspect, and save-suite without an external backend configured") | `POST /api/generate` succeeds and returns real Playwright code, with no environment variable set beyond `.env.development`. | ✅ |
| GEN-11 | An element hidden at introspection time does not get an unconditional visibility claim (TFP-054, automated: "does not assert unconditional visibility for an element hidden at introspection time") | A synthetic element with `isVisible: false` generates `toBeAttached()` plus a "Hidden at introspection time" comment, not `toBeVisible()`. Verified live against `test-assist`: regenerating TFP-040's exact suite now produces 0 of the 7 originally-confirmed false positives (41 of 42 passing; the 42nd, `TFFU-036`, is a separate, pre-existing finding unrelated to visibility). | ✅ |
| GEN-12 | A detected toggle group generates an ARIA-state assertion (TFP-057, automated: "generates a toggle-group ARIA assertion for a detected selection group") | A synthetic 3-member `groupId`-sharing group generates a presence test (every member exposes an ARIA state attribute) and, since one member's `ariaChecked` is `"true"`, a toggle-behavior test. Verified live against `test-assist`: the generated accessibility suite's `TFAC-002`/`TFAC-003` both pass now that TA-252 has shipped and every `.tool-btn` reports a real `aria-checked`. The pre-TA-252 "produces a failing test naming the missing ARIA state" half of this ticket's acceptance criteria was confirmed by tracing the generator's own logic (no member would have `activeAriaStateField()`, so the toggle test wouldn't generate at all and the presence test's `toBeTruthy()` would fail), not re-verified live against a reverted target. | ✅ |
| GEN-13 | Accessibility suite asserts a real accessible name and role per discovered element (TFP-056, automated: "generates per-element accessible-name and role checks, skipping hidden elements") | A visible synthetic element generates a `toHaveAccessibleName(/.+/)` plus an `ariaSnapshot()`-derived role check; a hidden one (`isVisible: false`) gets the same `toBeAttached()` treatment as GEN-11 instead, since accessible-name/role computation is undefined for an element excluded from the accessibility tree. Verified live against `test-assist`: 24 of 31 discovered elements got a real per-element check, all passing (`TFAC-002`…`TFAC-031`), including one that caught a genuine finding first try — `#uploadImage` had no accessible name under a hand-rolled text/aria-label/placeholder/title heuristic; switching to Playwright's own `toHaveAccessibleName` (which follows the real accname algorithm, including the wrapping `<label>` test-assist actually uses) resolved the false positive. | ✅ |
| GEN-14 | Responsive suite checks real discovered elements per viewport and adds a touch smoke test (TFP-058, automated: "checks real discovered elements across viewports and adds a touch smoke test") | The viewport loop asserts up to 5 real `isVisible: true` elements stay visible at each of mobile/tablet/desktop, in addition to the existing `body`/heading check; a separate test dispatches `touchstart`/`touchend` at mobile viewport on one of those elements as an explicit smoke check (static introspection can't see touch-specific handlers, so this claims only "doesn't error on tap," not app-specific touch behavior). Verified live against `test-assist`: `TFRM-001` (5 real elements checked per viewport) and `TFRM-002` (touch smoke) both pass. | ✅ |
| GEN-15 | Usability suite asserts content-specific claims instead of an interactive-element count (TFP-059, automated: "replaces the usability interactive-count check with content-specific assertions") | Per-element checks assert any labeled/placeholder-bearing element's text isn't a generic phrase (`submit`, `click here`, `ok`, …); a combined check asserts up to 5 `isVisible: true` elements from the `form`/`action` categories have a bounding box above the desktop fold (900px). Elements hidden at introspection time are excluded from the sample entirely, not attach-only fallback like GEN-11/GEN-13 — a first pass without that filter flagged test-assist's own hidden `#btnRecord` as a false "not rendered on first paint" failure. Verified live against `test-assist`: `TFUS-002`…`TFUS-007` all pass. | ✅ |
| GEN-16 | A detected action pair (e.g. Undo/Redo) gets a negative-assertion regression guard, and only a real pair does (TFP-060, automated: "generates a negative-assertion test for a detected action pair, and only for it") | Two exactly-matching elements from a fixed opposite-word list (undo/redo, save/discard, open/close, …) generate one test asserting a wholly unrelated interaction (a mouse move to a neutral point) doesn't change either element's enabled state or text; an unpaired third element (no matching counterpart) generates nothing. Verified live against `test-assist`: exactly one pair test generated (Undo/Redo), passing, with no spurious pair among Select/Highlight/Text/Circle/Arrow/Rectangle/Pen or Save PNG/Export JSON. | ✅ |
| GEN-17 | A detected drop target gets valid- and invalid-content drag-and-drop tests (TFP-061, automated: "generates valid- and invalid-content drag-and-drop tests for a detected drop target") | A drop target generates a valid-content test (drops a real 1x1 PNG via a dragover+drop DragEvent sequence, asserting an observable DOM change and no uncaught page error) and an invalid-content test (drops a text file, asserting only no crash). Verified live against `test-assist`: both generated tests pass against the real canvas. | ✅ |

### 3.3 Crawl (CRW)

| ID | Test | Expected Result | Status |
|----|------|-----------------|--------|
| CRW-01 | Discovered-pages section, crawl lifecycle, and page selection (automated: "covers the discovered site pages section, crawl lifecycle, and page selection controls") | Crawl discovers same-origin pages, surfaces them for selection, and the UI reflects crawl-in-progress / crawl-complete states correctly. | ✅ |
| CRW-02 | Manual: crawl a multi-page site | All same-origin pages reachable within crawl depth are listed; off-origin links are not crawled. | ⬜ |
| CRW-03 | Crawl executes with no external backend configured (automated: `tests/regression/testforge.sections.spec.ts` — "executes generate, run, crawl, introspect, and save-suite without an external backend configured") | `POST /api/crawl` starts a job that reaches `crawlStatus: "completed"`, with no environment variable set beyond `.env.development`. | ✅ |

### 3.4 Introspect (INT)

| ID | Test | Expected Result | Status |
|----|------|-----------------|--------|
| INT-01 | Content rules and content-aware generation state (automated: "covers the content rules section and content-aware generation state") | Per-page introspection results (elements, roles, content) are reflected in the content rules section and inform content-aware generation. | ✅ |
| INT-02 | Manual: introspect a page with no actionable elements | Introspection completes without error and reports an empty or near-empty actionable-element set rather than failing. | ⬜ |
| INT-03 | Introspect executes with no external backend configured (automated: `tests/regression/testforge.sections.spec.ts` — "executes generate, run, crawl, introspect, and save-suite without an external backend configured") | `POST /api/introspect` succeeds synchronously and returns at least one inspected page, with no environment variable set beyond `.env.development`. | ✅ |
| INT-04 | Actionable elements report `isVisible` (TFP-053, automated: "introspect reports isVisible on every discovered actionable element") | Every discovered actionable element carries a boolean `isVisible`. Verified live against `test-assist`, separately from this suite: `#btnRecord`, `#btnClearSession`, `#uploadImage`, `#btnStopRecord`, `#textInput`, `#btnTextOk`, `#btnTextCancel` all report `isVisible: false` — this repo's own landing page has no naturally-hidden element to assert the `false` case against directly. | ✅ |
| INT-05 | Actionable elements report ARIA state and toggle-group membership (TFP-055, automated: "introspect reports ARIA state and toggle-group membership on actionable elements") | Every discovered actionable element carries `ariaPressed`/`ariaSelected`/`ariaChecked`/`ariaExpanded`/`groupId` as `string \| null`. Verified live against `test-assist`, separately from this suite: the seven `.tool-btn` elements are detected as one group (`role` `button` + shared `containerLabel` + 3+ members), each reporting a real `ariaChecked` value now that TA-252 has shipped; `strokeColor`/`strokeSize`/`fillOpacity` (role `textbox`) and `Undo`/`Redo`/`Clear` (one-shot action verbs) are correctly excluded from grouping. | ✅ |
| INT-06 | Pages report drag-and-drop targets (TFP-061, automated: "introspect reports dragDropTargets as a well-shaped array") | Every page carries a `dragDropTargets` array with `isVisible`/`isDraggableSource`/`isDropTarget` booleans and a string `tagName`. Detection dispatches a non-bubbling synthetic `dragover` event per candidate and checks `defaultPrevented`, since real drop targets (test-assist's canvas included) attach handlers via `addEventListener`, invisible to an attribute-only scan. Verified live against `test-assist`, separately from this suite: introspecting test-assist detects exactly one drop target, the real `<main class="canvas-wrap">` — a first pass with a bubbling probe also flagged 6 of its own descendants as false positives, since the probe's event bubbled into the ancestor's real listener; disabling bubbling on the probe (not on the generated test's own drop simulation, which still bubbles like a real interaction) fixed it. | ✅ |

### 3.5 Run (RUN)

| ID | Test | Expected Result | Status |
|----|------|-----------------|--------|
| RUN-01 | Run a generated suite and open the report popup (automated smoke: "runs a generated suite and opens report popup") | Run completes and the structured report popup opens automatically. | ✅ |
| RUN-02 | Stopping a run preserves planned/interrupted/not-run state (automated: "preserves planned, interrupted, and not-run test states when a run is stopped") | A test already completed before Stop keeps its result; the test in flight is marked interrupted; tests that hadn't started are marked not-run — not silently dropped. | ✅ |
| RUN-03 | Rerun only selected failed tests via API (automated: "runs only the selected failed test titles when includeTestTitles is provided") | Passing `includeTestTitles` reruns exactly those tests; passing tests and untitled failed tests are excluded from the rerun. | ✅ |
| RUN-04 | Rerun a selected failed test from the report UI (automated: "reruns the selected failed test from the execution report") | Selecting a failed test in the execution report and triggering rerun re-executes only that test. | ✅ |
| RUN-05 | Session evidence capture on failure (automated: "captures session evidence artifacts for failed generated runs") | A failed generated test produces captured evidence artifacts (trace/video/screenshot per `playwright.config.ts`'s `retain-on-failure`/`only-on-failure` settings). | ✅ |
| RUN-06 | Manual: cancel a run mid-execution from the UI | Run stops promptly; already-completed test results remain visible. | ⬜ |
| RUN-07 | Run executes with no external backend configured (automated: `tests/regression/testforge.sections.spec.ts` — "executes generate, run, crawl, introspect, and save-suite without an external backend configured") | `POST /api/run` starts a job that reaches `runStatus: "passed"`, with no environment variable set beyond `.env.development`. | ✅ |
| RUN-08 | A finished run survives a server restart (automated: `npm run test:unit` — `src/lib/run/persistence.test.ts`, "round-trip: read back with no reference to the originating job models a restart", plus "evidence move: files land under evidence/..." and "evidence move failure: falls back to the original path...") | `runs/<runId>/run.json` and `suite.spec.ts` are readable, and evidence resolves under `runs/<runId>/evidence/`, using only data on disk — no reference to the in-memory job that produced it, modeling exactly what a fresh process sees after a restart. A failed evidence `rename()` falls back to the artifact's original path rather than losing the record. | ✅ |
| RUN-09 | Retention: pin overrides automatic archiving; archiving keeps `run.json`/`suite.spec.ts` and deletes only `evidence/`; a fixed defect's run becomes sweep-eligible once superseded (automated: `npm run test:unit` — `src/lib/run/persistence.test.ts`, "pin overrides sweep...", "archive: keeps run.json and suite.spec.ts...", "still-open-defect exemption...", "lastAccessedAt: null after persisting...") | A pinned run is never archived by the sweep even when superseded and its one failure is fixed elsewhere; an unpinned, superseded run whose failure is fixed becomes archived (evidence gone, report/suite intact); a run that is still the only evidence for a still-failing test is never auto-archived; `lastAccessedAt` is `null` on a fresh run, set on first read, unchanged on a second. | ✅ |
| RUN-10 | Honest coverage: a target with more discovered elements than written tests shows sub-100% coverage even when every written test passes, and the uncovered list names specific elements (automated: `npm run test:unit` — `src/lib/report/discovered-coverage.test.ts`, "Group 2: more discovered elements than tests still shows <100% coverage...") | With 2 discovered elements and only 1 matching executed (passing) test, the Functional row is `partial` at 50%, not `covered`, and both the row's and the top-level `uncovered` list name the specific untested element, not just "Functional". | ✅ |
| RUN-11 | "Not tested, and why": every unmatched discovered element carries exactly one of not-selected / excluded-by-generator / generator-gap, and generator-gap is real, not vacuous (automated: `npm run test:unit` — `src/lib/report/discovered-coverage.test.ts`, "Group 3: not-selected, excluded-by-generator..." and "...an unselected practice area buckets all of its discovered elements as not-selected") | A link element with dedicated link-audit coverage and elements beyond the generator's 50-element cap are `excluded-by-generator`; elements in an unselected practice area are `not-selected`; a selected, eligible element with no matching executed test is `generator-gap` — no element carries two reasons, and the generator-gap bucket is demonstrably non-empty. | ✅ |
| RUN-12 | Diffing two runs of the same `baseUrl`: specific test names (not just a percentage), per-area coverage deltas, and newly discovered/missing elements, against a deliberately regenerated suite with one fewer test (automated: `npm run test:unit` — `src/lib/run/diff.test.ts`, "Group 4: two runs with a deliberately dropped test...", plus `src/app/api/runs/diff/route.test.ts`'s real-request coverage of `GET /api/runs/diff`) | Given run A (3 passing tests, 100% Functional coverage) and run B (a regenerated 2-test suite where one carried-over test now fails and the third is simply absent), the diff names both affected tests by title with their exact from/to status (the absent one reported as "not run", not conflated with a failure), reports the Functional coverage delta as -50, and lists the specific elements newly discovered/missing between the two runs' own introspection snapshots. Diffing two runs with different `baseUrl` values is rejected. | ✅ |

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
| SAV-03 | Save-suite executes with no external backend configured (automated: `tests/regression/testforge.sections.spec.ts` — "executes generate, run, crawl, introspect, and save-suite without an external backend configured") | `POST /api/save-suite` writes the file locally and returns a `.spec.ts` filename, with no environment variable set beyond `.env.development`. | ✅ |

## 4. Known Limitations & Gaps

1. **`/api/run`'s execution model is unsandboxed, in-process code execution.** It runs caller-supplied Playwright code with the privileges of the user running the dev server — no authentication, no sandboxing, no multi-tenant isolation. This is documented, intended behavior under TestForge's local-only posture (see `README.md`'s Security Model), not a defect, and it is why TestForge must never be bound to a non-loopback interface or exposed through a tunnel.
2. **Chromium only.** Cross-browser execution (Firefox, WebKit) is out of scope as of Phase 16 (TFP-012); `playwright.config.ts` declares a single `chromium` project.
3. **Run persistence and diffing (Phase 17) have landed** — a finished run's config, suite, result, and evidence survive a server restart (`runs/<runId>/`, RUN-08/RUN-09), and two persisted runs of the same `baseUrl` can be diffed via `GET /api/runs/diff` for specific test-status changes, per-area coverage deltas, and newly discovered/missing elements (RUN-12). Data + API only, per the decision record's own scope lock — no diff UI yet.
4. **Coverage is now computed against the discovered surface for functional and accessibility (Phase 17 Groups 2/3, RUN-10/RUN-11)** — an element counts as covered only if it was actually the subject of an executed test, and every unmatched element is bucketed as not-selected / excluded-by-generator / generator-gap. Areas without a one-test-per-element generator shape (performance, security, SEO, responsive, cookie/session, database, and usability's bundled checks) still use the prior test-pass-rate rollup — there's no discovered-element surface to honestly denominate against for those.
5. **The OpenAI-backed generation path is untested in CI.** Only the template-based generator runs in automated tests; the AI path is exercised manually. Phase 21 evaluates it against the deterministic generator using Phase 17's persistence.
6. **No deployed or hosted version exists, and none is assumed.** TestForge is local-only by design; `docs/decisions/saas-prerequisites.md` records what a hosted version would actually require and states plainly that none of it is implemented.

## 5. Roadmap / Next Steps

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
- [ ] TFP-065 — guard `JSON.parse` in `finalizeRunJob` against a corrupted report (silent run hangs)
- [ ] TFP-066 — validate `runId` as a UUID before any file-path operation (path traversal)
- [ ] TFP-067 — add `req.json()` error handling to the 5 unguarded POST handlers
- [ ] TFP-068 — polling hook retry/backoff + terminal-status safety net (`useRun`, `useCrawl`)
- [ ] TFP-069 — drop `unsafe-eval` from production CSP
- [ ] TFP-070 — cleanups: dead `outputDir` env var, default base URL callout, `PLANE_SECRET_KEY` default callout

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
