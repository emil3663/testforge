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

## Second measurement: the grouping as revised at Gate A (TFP-176)

Date: 2026-10-07. The first measurement above stays as it was. Emil revised
Decisions 1, 2 and 4 the same day:
- the address type comes first;
- an address type splits only when its pages' form signatures differ;
- only sibling address types in one section with equal full signatures
  merge;
- top-level pages and home never merge;
- a segment directly before an `:id` is never a slug.

This measurement re-groups the **same committed crawls**
(`remeasure-tfp176.mts`, no new crawl). Results are in
`<site>-types-tfp176.json`.

"Section" is TFP-176's reading of "siblings under the same parent": the
same prefix, the same first segment and the same depth of at least 2. The
record's own example, `/shop/men/shirts` and `/shop/women/shoes`, has
different immediate parents, `men` and `women`.

The committed crawl results list pages sorted by path, so types come out in
that order. Which pages a type holds doesn't depend on order.

| Site | Pages | Address types | Types, first measurement | **Types, revised** |
| --- | --- | --- | --- | --- |
| Fixture (`/`) | 3 | 3 | 3 | **3** |
| Fixture `/types` shop | 14 | 10 | 9 | **9** |
| Toolshop, clean | 46 | 7 | 9 | **9** |
| Toolshop, with-bugs | 34 | 7 | 9 | **9** |
| the-internet | 100 | 57 | 9 | **57** |

### The Toolshop: the expected nine types, on both sites

| Type | Clean | With-bugs | Form signature |
| --- | --- | --- | --- |
| home | `/` | `/#/` | 2 forms: `[select]`, `[text]` |
| category | `/category/:slug` (4) | `/#/category/:slug` (3) | `[select]` |
| product | `/product/:id` (35) | `/#/product/:id` (24) | none |
| contact | `/contact` | `/#/contact` | `[email,file,select,text,textarea]` |
| rentals | `/rentals` | `/#/rentals` | none |
| privacy / chainsaws | `/privacy` | `/#/chainsaws` | none |
| login | `/auth/login` | `/#/auth/login` | clean `[email,password]`, with-bugs `[password,text]` |
| register | `/auth/register` | `/#/auth/register` | `[password,select,text]` |
| forgot-password | `/auth/forgot-password` | `/#/auth/forgot-password` | clean `[email]`, with-bugs `[text]` |

Differences, explained:
- `/privacy` exists only on the clean site, and `/#/chainsaws` only on
  with-bugs (bug 3's missing page).
- The clean site has 4 categories and with-bugs 3: the two sites list
  different categories (clean `other`, `special-tools`; with-bugs
  `undefined`).
- The two sites have 35 and 24 products.
- With-bugs' email fields are `type="text"`, so its form signatures say
  `text` where the clean site's say `email`. It is still three different
  signatures, so `/#/auth/:slug` still splits into three.

The first measurement's faults are gone:
- every product is one type, and every category is one type;
- the empty category (`special-tools`; `undefined`) stays in its listing
  type;
- `/rentals`, `/privacy` and `/#/chainsaws` stay their own types.

### the-internet: 57 types

the-internet's examples are all top-level pages, and top-level pages never
merge. So its 57 address types are its 57 types, and no type mixes unrelated
templates any more. The first measurement had 9, one of them holding 90
pages with home.

Its form types:

| Type | Form signature | Label |
| --- | --- | --- |
| `/checkboxes` | `[checkbox]` | form |
| `/dynamic_controls` | 2 forms: `[checkbox]`, `[text]` | form |
| `/forgot_password` | `[text]` | form |
| `/key_presses` | `[text]` | form |
| `/login` | `[password,text]` | sign-in |
| `/upload` | `[file]` | form |

The other 51 types have no form. Those with more than one page are
`/infinite_scroll/:id` (36), `/status_codes/:id` (4), `/users/:id` (3),
`/shifting_content/:slug` (3) and `/dynamic_loading/:id` (2).

**What this means for selection (TFP-172).** With a hard cap of 8, the
always-covered types alone fill it on the-internet: home, the six form
types and the largest type (`/infinite_scroll/:id`). The other 49 types
would be named as skipped, as the revised Decision 4 says.

### The fixture `/types` shop

The 9 types match the revised expectation:
- `/types/product/:id` splits by forms (103 has no add-to-cart form);
- `/types/account/:slug` splits into sign-in and form;
- `/types/legal/privacy + /types/help/terms` merge (siblings in the
  `/types` section, equal outlines);
- `/p/:id + /p/:slug` and `/shop/men/shirts + /shop/women/shoes` merge.

The committed crawl predates TFP-176's empty-category page. The real-browser
case in `page-outline.test.ts` crawls the current fixture, 15 pages, and
keeps that page in the listing type.

## Third measurement: merging under one immediate parent (TFP-176 follow-up)

Date: 2026-10-07. The first two measurements above stay as they were. At
Gate A's re-check Emil clarified Decision 2: "same parent" is the immediate
parent, the pattern minus its last segment (prefix kept), not the second
measurement's "section" (same first segment and depth). Under that reading,
pages under a language prefix merge when their outlines match:
`/en/product/:id` with `/en/category/:id`.

The **same committed crawls** were re-grouped
(`remeasure-tfp176.mts --out=tfp176-parent`, no new crawl). Results are in
`<site>-types-tfp176-parent.json`; the second measurement's
`<site>-types-tfp176.json` files are unchanged.

| Site | Pages | Address types | Types, first | Types, second | **Types, third** |
| --- | --- | --- | --- | --- | --- |
| Fixture (`/`) | 3 | 3 | 3 | 3 | **3** |
| Fixture `/types` shop | 14 | 10 | 9 | 9 | **11** |
| Toolshop, clean | 46 | 7 | 9 | 9 | **9** |
| Toolshop, with-bugs | 34 | 7 | 9 | 9 | **9** |
| the-internet | 100 | 57 | 9 | 57 | **57** |

- **Both Toolshops and the-internet: unchanged.** Their result files are
  byte-identical to the second measurement's. Nothing merged on any of the
  three under the second reading either, so the narrower rule has nothing
  to undo there. The nine Toolshop types and the-internet's 57 stand as
  listed in the second section.
- **The `/types` fixture: 9 to 11, as the follow-up expects.** Two merges
  are gone, because their patterns have different immediate parents:
  - `/types/legal/privacy` (`/types/legal`) and `/types/help/terms`
    (`/types/help`);
  - `/shop/men/shirts` (`/shop/men`) and `/shop/women/shoes`
    (`/shop/women`).

  `/p/:id + /p/:slug` still merges (both under `/p`). The real-browser case
  in `page-outline.test.ts` crawls the current fixture (15 pages, with the
  empty category) and gets the same 11 types.
