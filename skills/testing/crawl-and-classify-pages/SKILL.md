---
name: crawl-and-classify-pages
description: >
  Map a web app page by page — breadth-first, same-origin — and for each
  page, classify every actionable element and link with testing-semantic
  judgment (interaction category, expected HTTP status, whether it looks
  auth-gated, what section it lives in, what kind of embedded resource it
  is) rather than a raw DOM or accessibility dump. Use this skill when
  asked to map, crawl, or inventory a multi-page site or app for test
  coverage, to answer "what's actually on this site to test," or as the
  discovery step before writing tests page-by-page with
  write-playwright-test. Confirmed (TFP-036) that no Playwright MCP tool
  does either half of this — no tool follows links across pages, and no
  general-purpose browser tool has occasion to make these testing
  judgments — so this is real, non-duplicated capability, not a
  reimplementation of something already available.
---

# Crawl and classify pages

## Why this is a skill and not just "use browser_snapshot"

A 2026 spike (TestForge's TFP-036, full writeup at
`skills/INTROSPECT_CRAWL_SPIKE.md` if you have that repo open) checked this
directly against Playwright MCP's real, complete 73-tool list rather than
assuming. The verdict, on both halves:

- **No tool follows links across pages.** `browser_navigate` is explicitly
  single-page. Nothing in the 73-tool list extracts `href`s, resolves them,
  or walks a site. If the goal is "every page this app has," there is no
  ready-made tool for that — you have to drive it yourself.
- **`browser_snapshot` gives you a real accessibility tree — and stops
  there.** It's an honestly *better* source for element role and name than
  guessing from tag name, because it reflects the browser's actual computed
  ARIA semantics. But nothing in it tells you which of those elements is
  worth an assertion, what HTTP status a "Delete" button should produce,
  whether a link needs a login first, or what section of the page a button
  belongs to. Those are testing judgments, not DOM facts, and no
  general-purpose browser-automation tool has a reason to make them.

So: use `browser_snapshot` (or equivalent) as your raw material for *this
page*. Use the technique below to decide *which pages to visit* and *what
each element on each page means for testing*.

## When to reach for this vs. `write-playwright-test`

`write-playwright-test` turns one described page or flow into one test
file. It assumes you already know what to test. This skill is the step
before that on a real, unfamiliar, multi-page app: build the page map,
then classify each page's actionable surface, *then* hand pages one at a
time to `write-playwright-test` (or write tests directly from the
classification below).

Don't run this on a single already-described page — that's
`write-playwright-test`'s job and this skill adds nothing there.

## Step A — breadth-first, same-origin crawl

There's no single tool call for this; drive it as an explicit loop using
whatever navigation/evaluation tool you have (`browser_navigate` +
`browser_evaluate`, or repeated `browser_snapshot` calls after navigating).
The algorithm, taken directly from TestForge's own `crawl/route.ts`:

1. Start a queue with one entry: the base URL, `discoveredFrom: null`.
2. Pop the next queued URL. If already visited, skip it.
3. Navigate to it. Extract every `a[href]` on the page (`browser_evaluate`
   running `Array.from(document.querySelectorAll('a[href]')).map(a =>
   a.href)` is the direct equivalent of what the real code does in-page).
4. For each discovered href, queue it only if **all** of:
   - it resolves to the **same origin** as the base URL,
   - its scheme isn't `mailto:`, `tel:`, `javascript:`, or `data:`,
   - it doesn't match a static-asset extension — the real skip list is
     `pdf doc docx xls xlsx csv zip ppt pptx jpg jpeg png gif svg webp ico
     css js json xml txt mp3 mp4 avi mov woff woff2 ttf eot` (with an
     optional trailing `?query` or `#hash`).
5. De-duplicate by **normalized path**, not raw URL: strip the hash, strip
   the query string, strip a trailing slash (except for `/` itself). Two
   URLs that differ only by `?tab=2` or a trailing `/` are the same page.
6. Record `{path, url, title, discoveredFrom}` for the page you just
   visited, then continue from step 2.
7. Stop when the queue is empty, or you've visited **100 pages** — cap it
   lower for a quick pass, but state the cap you used. Note any page that
   failed to load as a warning rather than silently dropping it.

Report the resulting page list before moving to Step B — it's a useful
artifact on its own (a sitemap the user may not have had), and it's the
thing Step B iterates over.

## Step B — per-page classification

For each page from Step A, extract and classify — this is the part with no
tool equivalent. Reproduce it with `browser_evaluate` (running the logic
below as in-page JS) or by applying this same judgment to a
`browser_snapshot` read; either way, the classification is the point, not
the extraction mechanism.

### Actionable elements

Every `a`, `button`, non-hidden `input`, `select`, `textarea`, `form`, and
`[role=button]`. For each, work out:

**Role** — from tag/type, not a guess at computed ARIA (that part
`browser_snapshot` already does better; use it if you have it):

| Element | Role |
|---|---|
| `a` | link |
| `button` | button |
| `select` | combobox |
| `textarea` | textbox |
| `input[type=checkbox]` | checkbox |
| `input[type=radio]` | radio |
| `input[type=submit\|button\|reset]` | button |
| other `input` | textbox |
| `form` | form |

**Accessible name** — in priority order: `aria-label`, an associated
`<label>` (via `closest("label")` or `label[for=id]`), element text (or
`value`/`placeholder`/`name` for inputs), first non-empty wins.

**Container label** — the answer to "what section is this in," which
nothing in the DOM encodes directly. Walk up to 6 ancestor levels; at each
level, check the ancestor's *direct children* for a heading/label
(`h1-h6, p, legend, label, [role='heading']`) — if that ancestor also
contains more than one link, treat its direct-child label as the
container's label. Otherwise check each ancestor's *previous siblings* for
the same selectors. If nothing found up the tree, check the element's own
previous siblings. First match wins; empty string if none.

**Interaction category** — checked in this order against
`(text + url + containerLabel).toLowerCase()`:

1. Inside `nav` or `[role='navigation']` → **navigation**
2. Context matches `/api call|api response|status code|send an api call|
   created|no ?content|nocontent|moved|bad[-\s]?request|unauthorized|
   forbidden|invalid[-\s]?url|not[-\s]?found/` → **api**
3. Element is `form`/`input`/`select`/`textarea` → **form**
4. Element is `button`: text matches `/submit|search|filter|save|login|
   sign in|register|send|apply/` → **form**; matches `/next|previous|back|
   home|menu|open|continue|visit/` → **navigation**; otherwise → **action**
5. Otherwise: `a` → **navigation**, everything else → **action**

**Expected HTTP status** — only meaningful when category is `api`; match
`(text + url + containerLabel).toLowerCase()` against:

| Pattern | Status |
|---|---|
| `created` | 201 |
| `no content` / `nocontent` | 204 |
| `moved` | 301 |
| `bad request` | 400 |
| `unauthorized` | 401 |
| `forbidden` | 403 |
| `invalid url` / `not found` | 404 |

This is a text-based guess, not an observed response — say so when you
report it, and verify it against a real network call before asserting on
it in a generated test.

### Links

For every `a[href]`, beyond role/name/container above:

- **Link type** — `mailto:` prefix → `mailto`; `#` prefix → `anchor`;
  has a `download` attribute or matches
  `/\.(pdf|doc|docx|xls|xlsx|csv|zip|ppt|pptx)([?#].*)?$/i` → `download`;
  otherwise resolve the href and compare origins → `internal` or
  `external`.
- **Target behavior** — `target=_blank` → new-tab; any other non-`_self`
  target → new-window; otherwise → same-window.
- **`requiresAuth` heuristic** — `(text + href + containerLabel)`
  matched against `/login|sign in|signin|account|profile|admin|dashboard|
  checkout|orders|billing|settings|my /`. This is a heuristic, not a proof
  of an auth wall — flag it as "looks auth-gated," and confirm with a real
  unauthenticated request before treating it as fact.
- **Visibility** — computed `display !== 'none'`, `visibility !== 'hidden'`,
  and a non-zero bounding-box size. Worth computing per link in one pass
  rather than one at a time (a single-element visibility check tool, if
  that's all you have, doesn't scale to "annotate every discovered link").

### Embedded resources

`iframe`/`frame`/`img`/`script`/`link` (stylesheet)/`video`/`audio`/
`source`/`object`/`embed`/`form`, plus a scan of `[onclick]` attributes for
`location.href =` / `window.open(` patterns, and `data-href`/`data-url`/
`routerlink`/`ng-href`/`xlink:href` attributes (classify these as `data`).
Record same-origin/visibility the same way as links.

## Reporting the result

Per page, produce something shaped like:

```
/pricing  (discovered from /)
  actionable elements: 12 (3 form, 4 navigation, 5 action)
  links: 8 (6 internal, 2 external, 1 flagged requires-auth)
  embedded: 2 iframes, 1 stylesheet
```

with the full per-element detail available on request — this is the
handoff artifact for `write-playwright-test`, a coverage plan, or a direct
answer to "what's on this site."

## Honesty about the method

State plainly, in the report, that this was driven by iterating your own
browser tool rather than a single built-in "crawl" or "classify" call —
that's the actual gap this skill closes (see the "Why" section above). If
you don't have a live browser tool available at all, say so and stop
rather than fabricating a page map or element list.
