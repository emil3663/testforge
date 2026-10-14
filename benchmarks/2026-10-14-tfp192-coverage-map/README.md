# Phase 42 (TFP-192): the coverage map on the local Toolshop

TFP-192's acceptance asks for the uncovered list on the local Toolshop to
be recorded. Run on the clean copy (`sprint5`, `scripts/toolshop-local/`),
on committed code (`dd9d9b8`, named in each file's `commit`), with
`run-local.sh clean`:

1. a fresh crawl through the app's crawl route and Phase 40's selection,
   unedited (TFP-175's `crawl-and-select.mts`, as TFP-188 ran it): 49
   pages, 9 types, Standard's 8 pages (`/privacy` skipped);
2. `coverage-map.mts`: Standard's suite generated through the app's
   generate route (all ten areas, fast, the pages inspected first, a
   temporary data folder), then the map built from the suite and the
   inspected pages. Nothing is run: the map is read from the suite's code.

| File | What |
| --- | --- |
| `runs/clean-crawl.json`, `runs/clean-selection.json` | the crawl and the selection |
| `runs/clean-coverage-map.json` | the whole map: every element and link, and the tests that touch each |
| `runs/clean-uncovered.txt` | per page type, covered of total, then each item no test touches |

## Result

**243 of 243 touched; the uncovered list is empty.** 111 elements, 132
links, no flows. The inspection recorded no candidate journeys for these
pages, so there is no flow to cover.

| Page type | Touched |
| --- | --- |
| `/` | 45 of 45 |
| `/product/:id` | 32 of 32 |
| `/category/hand-tools` | 41 of 41 |
| `/auth/:slug` (register, login, forgot-password) | 79 of 79 |
| `/contact` | 27 of 27 |
| `/rentals` | 19 of 19 |

What the empty list rests on:

- **Elements:** each of the 111 has its own element check on its page,
  using its locator (the contact form by its record, each field, Send, the
  nav's buttons). 98 entries are touched by exactly one test.
- **Links:** 16 of the 132 have an on-page link check (Standard writes one
  for the first few links of each page). The other 116 are touched only
  by the site-wide link checks, which request each link's URL (link
  health, HTTPS/SSL). By the map's rule, a link whose URL a test requests
  is touched; the request doesn't find or click the link on its page.
  Counted the narrower way, by an on-page check alone, those 116 would be
  the uncovered list.

Timing: the copy's start took 347 s (it re-seeds its database on every
start); the crawl 52 s; generation and the map 26 s.
