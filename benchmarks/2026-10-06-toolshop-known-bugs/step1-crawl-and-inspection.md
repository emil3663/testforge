# TFP-154 step 1: what TestForge finds on each Toolshop

Date: 2026-10-06, 10:10 to 10:13 UTC. Read-only (page loads only), one
browser, nothing generated, run or scored.

**How:** the app's own API, as the UI uses it, on a production build of
`ef689fa` (`next start` on `127.0.0.1:3100`). `crawl-and-inspect.mjs`
posts to `/api/crawl` and polls it, selects every crawled path (as
`useCrawl.ts` does), and posts them to `/api/introspect`, which keeps the
first 5. Output: `<site>-crawl.json` and `<site>-inspection.json`.

## The two page lists

| | with-bugs.practicesoftwaretesting.com | practicesoftwaretesting.com |
| --- | --- | --- |
| Routing | hash: `#/contact`, `#/product/1` | path: `/contact`, `/product/<id>` |
| Crawl | **1 page:** `/` (8 s) | **46 pages** (75 s): `/`, `/auth/forgot-password`, `/auth/login`, `/auth/register`, 4 categories, `/contact`, `/privacy`, `/rentals`, 35 products |
| Inspected (first 5) | `/` only (it loaded as `/#/`) | `/`, `/auth/forgot-password`, `/auth/login`, `/auth/register`, `/category/hand-tools` |
| Failed pages | none | none |
| `#` links on inspected pages | 19 on `/`, all recorded as `linkType: "anchor"` | 0 |

The 19 on the with-bugs home page: `#/contact` twice ("Home" and
"Contakt"), `#` ("Categories"), five category routes in the closed
Categories menu (`#/category/hand-tools`, `…/power-tools`,
`…/undefined`, `#/chainsaws`, `#/rentals`), `#/auth/login`, `#filters` (a
real in-page target, hidden) and nine products, `#/product/1` to `/9`.

**So TestForge can't crawl a hash-routed single-page app,** which the
answer key's spot-check anticipated: it sees one page of the with-bugs
site and 46 of the clean one.

## How each check treats a `#/` link

From the code at `ef689fa`; no suite was generated or run for this step.

- **Crawl** (`/api/crawl`): `normalizeCrawlUrl` sets `hash = ""` (and
  `search = ""`) on every discovered URL, so every `#/…` link becomes `/`,
  which is already visited. Measured: 1 page.
- **Introspection** (`inferLinkType`): any `href` starting with `#` is
  `"anchor"`, an in-page link, so `#/product/1` is classed with `#top`.
  Measured: all 19.
- **Link health:**
  - The bulk check ("internal, external, and download links do not return
    broken responses") requests only internal, external and download links,
    so no `#/` route is ever requested.
  - A per-link check on an anchor clicks it and expects the URL's hash to
    equal the `href`. On a hash-routed site that is true whatever the route
    renders, so a route that draws a client-side 404 (bug 3, "Chainsaws")
    would pass.
  - A hidden one (TFP-159, the category routes) checks only its `href` and
    whether users can reach it.
- **Anchor-target check (TFP-141):**
  - It looks up the fragment as an element id: `#/contact` becomes
    `getElementById("/contact")`, which doesn't exist. So the first `#/`
    route on a page fails it, "Anchor target missing for #/contact": a
    false failure.
  - `#` is a placeholder finding, and `#filters` is a real target.
- **Link types:** an anchor passes if its `href` starts with `#`, so every
  `#/` route passes as an anchor.
- **Not affected:** the clean site's links are ordinary paths, and the
  crawl, link health and anchor checks treat them as such.

## For TFP-154

Scoring the with-bugs site now would score one page against bugs that sit
on many. Recognising a `#/` route as a page (crawl, introspection's link
type, link health, the anchor-target check) is a gap of its own and needs a
ticket first, as the answer key says. The clean site is a usable crawl
target but, routing differently, a weaker control than Decision 3 assumed.

## Re-run after TFP-165 (`8324b2b`), 2026-10-06

Same driver, same API and settings, on a production build of `8324b2b`.
Output: `with-bugs-tfp165-*.json` and `clean-tfp165-*.json`. The first
run's files above are kept as they were.

| | with-bugs (hash routes) | clean (paths) |
| --- | --- | --- |
| Crawl | **34 pages** (46 s), named `/#/...` | **46 pages** (69 s), the same list as the first run |
| Inspected (first 5) | `/#/`, `/#/auth/forgot-password`, `/#/auth/login`, `/#/auth/register`, `/#/category/hand-tools` | `/`, `/auth/forgot-password`, `/auth/login`, `/auth/register`, `/category/hand-tools` |
| Failed pages | none | none |
| `#` links on inspected pages | 67: routes recorded as `internal`, `#filters` and `#` as `anchor` | 0 |

Route by route, reading `/#/x` as `/x`:
- **On both:** 8 pages - `/`, `/auth/forgot-password`, `/auth/login`,
  `/auth/register`, `/category/hand-tools`, `/category/power-tools`,
  `/contact`, `/rentals` - and the products (24 on with-bugs, numbered
  `/#/product/1` to `/26` without 17 and 18; 35 on the clean site,
  addressed by id).
- **Only on the clean site:** `/category/other`,
  `/category/special-tools`, `/privacy`.
- **Only on with-bugs:** `/#/category/undefined` and `/#/chainsaws`.
  Both are linked from its menu, and both are listed bugs. The crawl finds
  them as pages; whether they draw "not found" is link health's question
  in the scored runs.

So the with-bugs crawl now finds the routes the clean site finds as paths,
give or take the two sites' own differences (TFP-165's last acceptance
criterion). Inspection's first 5 pages are the same five kinds on both
sites.
