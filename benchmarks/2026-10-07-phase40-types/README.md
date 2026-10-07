# Phase 40 page types, measured (TFP-171, for Gate A)

Date: 2026-10-07. Code: TFP-171's working tree on `2ed67bc`. Each site was
crawled once through the app's crawl route (`measure-types.mts`): read-only,
one browser, up to 100 pages. Files per site: `<site>-crawl.json` (the crawl,
with each page's outline) and `<site>-types.json` (the types).

"Address types" are Decision 1 alone (TFP-170). "Types" are Decision 2:
address types split and merged by the exact structural signature (landmarks,
forms with each form's field types, repeated cards). "Narrow" is Decision 2
with field types limited to password, email, textarea and search.

| Site | Pages | Address types | Types | Narrow | Crawl |
| --- | --- | --- | --- | --- | --- |
| Fixture (`/`) | 3 | 3 | 3 | 3 | 2 s |
| Fixture `/types` shop | 14 | 10 | **9, exactly as expected** | 9 | 8 s |
| Toolshop, clean | 46 | 7 | 9 | 9 | 75 s |
| Toolshop, with-bugs | 34 | 7 | 9 | 7 | 47 s |
| the-internet | 100 (cap) | 57 | 9 | 7 | 106 s |

Every page's outline was read. There were no crawl warnings.

## `/auth/:slug` on the Toolshop: it splits into its three pages, on both sites

| Page | Clean signature (forms) | With-bugs signature (forms) | Label |
| --- | --- | --- | --- |
| login | `[email,password]` | `[password,text]` | sign-in |
| register | `[password,select,text]` | `[password,select,text]` | sign-in |
| forgot-password | `[email]` | `[text]` | form |

Under the narrow reading, with-bugs' login and register merge (both
`[password]`), and forgot-password merges with an empty category page. Only
reading every field's type splits all three on both sites, which is why
TFP-171 reads Decision 2's list as examples.

## What the counts show

Exact matching **over-splits a little and under-splits more**, as soon as a
site's signatures are coarse.

- **Under-split: merges of unrelated templates.**
  - The Toolshop has no `main` landmark, so a product page's signature is
    only "no forms, repeated cards", and the cards are its related products.
    Products without related products have "no forms, no cards", the same as
    `/rentals` and `/privacy`.
    - Clean: 4 products merge with `/rentals` and `/privacy`.
    - With-bugs: 8 products merge with `/#/chainsaws` and `/#/rentals`.
  - the-internet's example pages have no landmarks, forms or cards, so 90 of
    its 100 pages, home included, are one type. Its 57 address types become
    9 types.
- **Over-split: one template, two types.**
  - The Toolshop's empty category (`/category/special-tools`;
    `/#/category/undefined`) has no cards, so it splits from the listing
    type and is labelled "form" (its sort control).
  - The product family splits by whether a product has related products:
    clean 31 and 4, with-bugs 16 and 8.
- **Home merged** into another type on the-internet (with 89 pages), and in
  the `/spa` fixture of TFP-165 (with 4 routes). On the Toolshop home stays
  its own type.
- **Labels** follow the type's first page. The Toolshop's merged
  "no forms, no cards" type is labelled detail, because a product is in it,
  though `/privacy` is too. Labels don't decide coverage.
- **A third address edge** (TFP-170's rule, unchanged). Under a shared
  prefix two id families read as one slug pattern: `/en/product/1` and
  `/en/category/2` become `/en/:slug/:id`. Outlines split them when they
  differ, but both keep that name. It is unit-tested in
  `page-outline.test.ts`. The `/types` fixture puts its edge families at the
  root, as the reviewer's examples do.

## For Emil at Gate A

Decision 2 asked whether exact matching over-splits. Measured, it over-splits
a little (empty categories, products with and without related items) and
under-splits more on sites whose pages share few landmarks, forms or cards
(the-internet: 90 pages, one type). Possible ways forward, each its own
decision:
- keep address types apart unless their outlines match (merge only within
  one address family, or only for top-level pages);
- add structure to the signature (for example the main heading level, or
  whether the page has an image gallery);
- accept it and let the ranking and the cap decide (TFP-172).

Nothing here is tuned. Selection (TFP-172) waits for Gate A.
