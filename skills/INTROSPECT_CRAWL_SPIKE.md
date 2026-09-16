# TFP-036 findings: does Playwright MCP cover introspect/crawl?

Phase 22 (v1.0). Full comparison behind `skills/ROADMAP.md`'s "Known gaps"
entry for TFP-036 — ticketed in Phase 17, run here for the first time.

## Method, stated plainly

**No live browser-automation tool — Playwright MCP or otherwise — was
available in the session that ran this spike.** No `.mcp.json` in this repo,
no matching MCP tools in the toolset. The comparison below is therefore
built from two primary sources, not a live side-by-side run against real
pages:

1. `src/lib/introspect/dom-snapshot.ts` (678 lines), `inspector.ts` (62
   lines), `types.ts` (65 lines), and `src/app/api/crawl/route.ts` (404
   lines) — 1,209 lines total, read in full.
2. Playwright MCP's own real tool reference, fetched directly from
   `github.com/microsoft/playwright-mcp`'s README — the complete 73-tool
   list with descriptions, not recalled from memory or summarized secondhand.

This is a real limitation against the original ticket's ask ("exercise
Playwright MCP's own tools against 2-3 real pages, including one from
test-assist's browser build"), named here rather than glossed over. What
follows is still a specific, named-capability comparison — the question of
whether a *tool* exists to do X is answerable from the real, complete tool
list without needing to watch it run against a particular page; live
execution would mostly produce concrete example output for capabilities
whose presence or absence is already unambiguous from the source and the
docs. The two intended targets (TestForge's own `/`, and a page from
`test-assist`'s browser build) are named below as the nominal subjects the
comparison applies to, not as pages actually exercised live.

## What `crawl/route.ts` does

A breadth-first same-origin crawler: starting from a base URL, visits a
queue of pages (headless Chromium), extracts every `a[href]`, resolves each
to an absolute URL, filters to same-origin, filters out non-http(s) schemes
(`mailto:`/`tel:`/`javascript:`/`data:`) and a fixed list of static-asset
extensions (images, docs, media, fonts, `css`/`js`/`json`), deduplicates by
normalized path (hash and search stripped, trailing slash removed), and
continues until the queue is empty or 100 pages are visited. Tracks
per-crawl progress (visited/queued/discovered counts, current page) and
supports cancellation mid-run. Output: `{path, url, title, discoveredFrom}`
per page, plus warnings for pages that failed to load.

Applied to TestForge's own site starting at `/`: this is what walks from
the homepage to every page `CreationSection`, `GeneratedSuiteSection`, and
the rest of the app link to, building the page list a user picks a target
from. Applied to `test-assist`'s browser build (vanilla JS, Canvas API, no
build step — the nominal second target): the same walk would need to
resolve real anchor hrefs across that app's own page set, which this spike
did not have a live browser to actually run against.

## What `dom-snapshot.ts` does, per page

Not a generic DOM/accessibility dump — every extraction is aimed at
producing Playwright-test-generation context, with testing-domain judgment
layered on top of raw DOM facts:

- **`actionableElements`** (up to 40): every `a`/`button`/non-hidden
  `input`/`select`/`textarea`/`form`/`[role=button]`. For each: element
  type, a role guessed from tag name and input type (`getRole()` — its own
  heuristic, not the browser's computed ARIA role), an accessible name
  assembled from `aria-label`/associated `<label>`/text/placeholder/`name`
  in that priority order, a **container label** found by searching up to 6
  ancestor levels plus siblings for a heading/label/`[role=heading]`
  (`findContainerLabel` — answers "what section is this element in," which
  nothing DOM-standard encodes), an **interaction category**
  (navigation/api/form/action) inferred by regex against the element's text
  and container context, and an **expected HTTP status** inferred from text
  like "created" → 201 or "not found" → 404 — a bespoke guess, not anything
  derived from an actual observed network response.
- **`linkDetails`** (up to 100): per `<a>` — resolved URL, raw href,
  category, a **link-type classification** (internal/external/anchor/
  mailto/download/inert), computed visibility (via `getComputedStyle` +
  bounding rect), target behavior (same-window/new-tab/new-window), and a
  **`requiresAuth` heuristic** (regex against "login/admin/dashboard/
  checkout/billing/settings" in text, href, and container label).
- **`embeddedLinkDetails`** (up to 150): iframes, scripts, stylesheets,
  media, forms, and a heuristic scan of `[onclick]` attributes for
  `location.href = `/`window.open(` patterns — classified by **kind**
  (iframe/frame/image/script/stylesheet/media/document/form/button/data/
  interactive) and same-origin/visibility.
- Headings, button text, link text, and sampled body-copy snippets, each
  deduplicated and capped.

## Playwright MCP's real tool surface (73 tools, fetched directly)

The relevant ones, by category:

| Category | Tool(s) | What it does |
|---|---|---|
| Structural snapshot | `browser_snapshot` | "Capture accessibility snapshot of the current page" — returns the accessibility tree: element roles, names, refs. Optional depth limit, bounding boxes. |
| Text/content search | `browser_find` | Searches the accessibility snapshot for text or a regex, returns matching nodes with context. |
| Visibility | `browser_verify_element_visible` | Confirms visibility of **one** element, given its role and accessible name — a targeted check, not a bulk annotation pass. |
| Navigation | `browser_navigate`, `browser_navigate_back`, `browser_tabs` | Single-page navigation and tab management. No automatic link-following. |
| Script execution | `browser_evaluate` | "Evaluate JavaScript expression on page or element" — arbitrary JS, the same mechanism `inspector.ts` itself uses via `page.evaluate`. |
| Forms | `browser_fill_form` | Fills multiple form fields — an *action* tool, not a discovery tool. |
| Everything else | 60+ tools | Click/drag/hover/type/dialogs/network mocking/cookies/storage/screenshots/video/tracing/PDF export/locator generation, etc. — general interactive browser control, no page-mapping or link-extraction capability among them. |

**No tool's description anywhere in the 73-tool list mentions extracting
hrefs, links, or URLs from a page.** Checked directly against the full
list, not inferred from a category gap.

## The comparison, capability by capability

| TestForge capability | Playwright MCP equivalent | Verdict |
|---|---|---|
| BFS multi-page crawl, same-origin filtering, path dedup, 100-page cap | None. `browser_navigate` is explicitly single-page; no tool follows links automatically. | **Not covered.** Not a partial gap — crawling isn't adjacent to what an interactive single-session browser-control tool is for. |
| Link/href discovery and classification (internal/external/anchor/mailto/download) | None. No tool extracts hrefs; `browser_snapshot`'s tree carries link *nodes* (role="link", accessible name) but not resolved href values or a classification scheme. | **Not covered.** Reaching hrefs would require `browser_evaluate` running custom JS — i.e., reimplementing this logic, not using a ready-made tool. |
| Element role/name/structure discovery | `browser_snapshot` — a real accessibility-tree read, arguably *more* correct than `getRole()`'s tag-name heuristic since it reflects the browser's actual computed ARIA semantics. | **Covered, and better**, for this one narrow piece. |
| Interaction-category classification (navigation/api/form/action) | None. | **Not covered.** Testing-domain judgment with no general-automation equivalent. |
| Expected-HTTP-status inference from element text | None. | **Not covered.** Bespoke heuristic; no browser-automation tool has a reason to guess this. |
| `requiresAuth` heuristic | None. | **Not covered.** |
| Embedded-resource kind classification (iframe/script/stylesheet/media/etc.) | None. | **Not covered.** |
| Container/section labeling (which heading an element belongs under) | None directly — reconstructable from `browser_snapshot`'s tree structure/ordering with additional logic, not returned as a field. | **Not covered as a ready field.** |
| Per-element visibility | `browser_verify_element_visible` — per-element, on request. `dom-snapshot.ts` computes it for every discovered link/embed in one pass. | **Partial** — the primitive exists, the bulk-annotation behavior doesn't. |
| Raw DOM/script access for a custom implementation | `browser_evaluate` | **The substrate exists** — this is the honest caveat: someone could paste `captureDomSnapshot`'s own logic into `browser_evaluate` and get the same output, tool-assisted. That is a different claim from "Playwright MCP already does this out of the box," which is false. |

## Verdict

**Not covered, on both halves of TestForge's introspect/crawl logic, for
two different reasons — not "partly" in the sense of a close call.**

- `crawl/route.ts`'s entire reason to exist (walking a site's pages) has no
  MCP equivalent at all.
- `dom-snapshot.ts`'s DOM-structure discovery has a real, arguably-superior
  partial equivalent in `browser_snapshot` for element roles/names — but
  its actual value-add over a generic snapshot, the testing-semantic
  classification (interaction category, expected status, requiresAuth,
  embedded-resource kind, link-type, container labeling), has no equivalent
  anywhere in Playwright MCP's 73 tools, because those are judgments a
  general-purpose browser-automation surface has no occasion to make.

`docs/REIMAGINING.md`'s original flag — that this ~1,200-1,300 lines would
be a genuine loss if trimmed — holds up under a real, tool-by-tool check.
This is not TestForge reinventing something Playwright MCP already
provides.

## What this doesn't settle

**Not run live** — the verdict above is a capability-presence comparison
(does a tool exist that does X), which is answerable from the real,
complete tool documentation without needing output from a particular page.
It does not produce example output from TestForge's homepage or a
`test-assist` page, and does not confirm whether `browser_evaluate` could
be driven to reconstruct `dom-snapshot.ts`'s exact output shape in
practice — only that the mechanism to attempt it exists. A follow-up spike
with an actual connected browser-automation tool, run against both named
targets, would close that gap; this one couldn't, for the reason stated in
Method above.
