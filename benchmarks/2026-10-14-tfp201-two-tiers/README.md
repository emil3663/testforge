# Phase 42 (TFP-201): the Toolshop coverage map in two tiers

TFP-201's acceptance asks for the Toolshop map, re-read from `612b144`'s
suite, in both tiers with the distinct-link count. `612b144` kept the map
but not the suite or the page data, so it can't be re-read as such. This
run generates the suite again from the same template code (TFP-200 and
TFP-201 leave template output unchanged: `check:template-unchanged`
`cf14cb8` → `567d2c4` is 166/166 identical across the three commits), on a
fresh crawl of the clean copy, on committed code (`567d2c4`). From now on
the suite and the page data are kept beside the map (`clean-suite.spec.ts`,
`clean-profile.json`), so later maps can be re-read from them.

Made with `run-local.sh clean` (TFP-192's `coverage-map.mts`, now also
saving its inputs; its gap-list prefix now reads "not checked in context").
The clean copy re-seeds its database on every start, so its product
address differs from `612b144`'s.

## Result

**113 of 149 checked in context; 36 more only reached; nothing touched by
no test.** 111 elements (all in context, as before) and **38 distinct
links, found 133 times across the 8 pages** (Gate A counted 37 and 132 on
`612b144`'s crawl).

- **In context:** every element, and 2 links: the logo's link to `/` and
  "Home", each on all 8 pages and checked on each.
- **Only reached:** the other 36 links. A site-wide check requests their
  URLs (link health, HTTPS), but no test finds them on a page. Among them
  are the nav's categories, Rentals, Contact, Sign in, Documentation, the
  footer's Privacy Policy, Barn Images and Unsplash, and the product cards.
- **Repeated links:** 17 links appear on more than one page, 112 of the 133
  occurrences. Each counts once.

| Page type | In context | Only reached |
| --- | --- | --- |
| `/` | 25 of 45 | 20 |
| `/product/:id` | 13 of 33 | 20 |
| `/category/hand-tools` | 21 of 41 | 20 |
| `/auth/:slug` (3 pages) | 40 of 53 | 13 |
| `/contact` | 16 of 27 | 11 |
| `/rentals` | 8 of 19 | 11 |

A repeated link counts in each page type it appears on, so the rows add up
to more than the totals.

The in-context gap list, the 36 links, is what TFP-194 would target on this
site.

Timing: the copy's start took 262 s; the crawl 59 s; generation and the
map 26 s.
