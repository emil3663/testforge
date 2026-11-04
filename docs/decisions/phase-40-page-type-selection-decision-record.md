# Phase 40 Decision Record — Page-Type Selection: Test One Page of Every Kind

Date: 2026-10-06
Scope: Group a site's crawled pages into page types (templates). Choose the
pages a run inspects by type, not by crawl order. Standard covers one page
of every type up to a cap instead of the first 5 pages; Comprehensive covers
every type first. The report names the types found, covered and skipped,
with each page's full URL. A list of URLs pasted into the URL field re-runs
exactly those pages.
Status: Complete 2026-10-07 (Gate B passed, Emil). Locked 2026-10-07. Emil asked for it on 2026-10-06 and decided
that Standard is not capped at 5 pages; on 2026-10-07 he confirmed the
remaining values: a cap of 8, exact structural signatures instead of an
outline threshold, ordered ranking rules instead of weights, the keep rule
in Decision 9, and Phase 40 before Phase 39. TFP-167 and TFP-154's re-score
are done (9 found, 4 hinted, 24 missed). Tickets TFP-170 to TFP-176. Revised at Gate A on 2026-10-07: Decisions 1,
2 and 4 (address first, a hard cap).

## Context

- **How pages are chosen today:** a run inspects the first
  `MAX_INSPECTION_PATHS` (5) pages in crawl order. On practicesoftwaretesting.com
  that is home, the three sign-in pages and one category (TFP-150, TFP-154
  step 1). Product, contact and rentals pages are never opened, though most
  of the site's pages are products.
- **The idea:** a site is built from a handful of templates. Testing one page
  of each template catches most of what that template gets wrong. This is
  ISTQB equivalence partitioning, applied to pages.
- **Typical type counts** are rough ranges, not measured: brochure sites 4 to
  6, blogs 5 to 8, shops 8 to 12, apps behind a login 10 to 30 or more.
  Toolshop's public side has about 8 to 10. the-internet is an outlier:
  nearly every page is its own type. This phase records the real count for
  every site crawled.
- **Ready to measure:** TFP-154 scores a hand-picked, one-per-type page list
  against Toolshop's known bugs. This phase's automatic selection is scored
  against the same answer key.

## Decisions

1. Pages are grouped into types by their address pattern.
- Path segments that vary between otherwise identical addresses become
  placeholders: ids and numbers become `:id` (`/product/01HX…` →
  `/product/:id`), and slugs under a shared parent become `:slug`
  (`/category/hand-tools` → `/category/:slug`).
- Hash-routed pages are grouped the same way, by the page name TFP-165 gives
  them (`/#/product/:id`).
- Query strings don't create types.
- **Top-level pages stay separate** (`/contact`, `/privacy`); the root is
  not a shared parent (Emil, 2026-10-07, TFP-170's review).
- **A segment directly before an `:id` is a collection name, not a slug**
  (Emil, 2026-10-07, Gate A): `/en/product/1` and `/en/category/2` are
  `/en/product/:id` and `/en/category/:id`, not one `/en/:slug/:id`.

2. The crawl records a cheap outline of each page, and the outline refines the
grouping.
- **The outline:** landmark regions, the number of forms and the type of
  every field in each (password, email, textarea and search were examples;
  every field type counts, Emil 2026-10-07), whether repeated card-like
  items are present, heading structure, and the count of interactive
  elements.
- **The structural signature (Emil, 2026-10-07):** the set of landmark
  regions, the form signature (the number of forms and each form's field
  types) and whether repeated card-like items are present. Two outlines
  match only when their signatures are equal. There is no threshold.
- Counts (headings, interactive elements) never decide grouping; they are
  recorded and used by the ranking.
- **Revised at Gate A (Emil, 2026-10-07): the address type comes first;
  the outline refines it only in two narrow ways.** The first measurement
  (TFP-171, `d8287a1`) showed that merging any address types with equal
  signatures merges unrelated templates (90 of the-internet's 100 pages
  into one type with home; Toolshop products with `/rentals` and
  `/privacy`), and that splitting on cards follows data, not templates
  (products with and without related items; an empty category).
  - **Split** an address type only when its pages' **form signatures**
    differ (the Toolshop's `/auth/:slug` into login, register and
    forgot-password). Landmarks and cards don't split a type.
  - **Merge** address types only when they are siblings under the same
    immediate parent and their full signatures are equal. The parent is the
    pattern minus its last segment, after `:id` and `:slug` are applied:
    `/p/:id` and `/p/:slug` share `/p` and merge. **Clarified at Gate A's
    re-check (Emil, 2026-10-07):** not the same first segment. Under a
    first-segment reading, every page of a site with a language prefix
    (`/en/...`) or an app under one path (`/app/...`) is one section, so
    unrelated templates merge again whenever their outlines match
    (`/en/product/:id` with `/en/category/:id`). A wrong merge silently
    skips a template, while a wrong split costs only a cap slot, so merging
    stays the narrow side. The earlier `/shop/men/shirts` +
    `/shop/women/shoes` example is withdrawn: they have different parents
    and stay two types.
  - **Never merge** top-level pages with each other, and never merge home.
    Decision 2's earlier `/privacy` + `/terms` example is withdrawn: two
    content types cost little, since content types are dropped first.
- Rejected: a fuzzy similarity threshold. It needs calibrating before it can
  be trusted and can't be explained in the report. The type counts measured
  on the fixture, both Toolshops and the-internet (TFP-171) show whether
  exact matching over-splits; tolerance is added only with that evidence,
  as its own decision.
- The outline is read-only: it comes from pages the crawl already opens.

3. Each type gets a label, for the report only.
- **The labels:**
  - home (the start page);
  - sign-in (a password field);
  - form (contact or registration, a form without a password field);
  - listing (repeated cards);
  - detail (a single item with actions);
  - search;
  - content (mostly text, few controls);
  - other.
- A wrong label never changes which pages are tested; the ranking does that.

4. Types are ranked, and the ranking decides what is covered.
- **Always covered first:**
  - home;
  - every type with a form (sign-in, registration, contact, checkout);
  - the type covering the most pages (usually detail).
- **The cap is hard (Emil, 2026-10-07, Gate A),** since it protects the
  run-time budget. If the always-covered types alone exceed it, they are
  ordered among themselves by the ordered rules below, and those that don't
  fit are named in the report as skipped.
- **Home is always ranked first (Emil, 2026-10-07, TFP-172's review).** It
  is the start page, where most site-wide problems show up, so the cap can
  never cut it. Under the ordered rules alone it ranked low (few pages,
  often no form): 8th of 8 on the-internet. (On the-internet, home, six form
  pages and the largest type already make 8.)
- **Then, by ordered rules (Emil, 2026-10-07):** more pages of that type
  first; then more forms on its representative page; then more interactive
  elements on it; then crawl order. No weights: the report can say exactly
  which rule placed a type where it is. Rejected: a weighted score, which
  needs tuning and can't explain a drop in one line.
- **Dropped first when over the cap:** content types, then the lowest
  scores.
- **The representative page** is the type's page with the most interactive
  elements. Ties go to crawl order.

5. Standard covers one page of every type, up to a cap. It is no longer capped
at 5 pages.
- **Not 5 (Emil, 2026-10-06). The cap is 8 (Emil, 2026-10-07)**, so that
  most small sites are fully covered and a shop loses only its content
  types.
- When a site has more types than the cap, Standard drops from the bottom of
  Decision 4's ranking and names every skipped type in the report.
- Every per-page check (the passive security checks, the axe scan, the
  accessible-name checks, link checks) runs on the selected pages. Phase 38
  Decision 4's reach ("up to `MAX_INSPECTION_PATHS` (5)") becomes "the
  selected pages".
- Run time is measured against the 30-minute budget (Phase 38 Decision 8).
  Phase 39's workers are expected to absorb the extra pages. If a measured
  Standard run goes over, the result is recorded and the cap is revisited;
  nothing is tuned to fit.
- **Note on cost (2026-10-07, after TFP-167):** the with-bugs Toolshop's
  Standard run took 1,170 s for 5 pages in TFP-167's measurement and
  1,058 s in the re-score, about 212 to 234 s a page. If cost grew linearly
  with pages, 8 pages would come to about 1,690 to 1,870 s, at the 1,800 s
  budget on one worker. Linear is the pessimistic case: the site-wide checks
  (link health, performance, journeys) don't grow with pages. Emil kept 8
  with this in view; the measured run decides, under the rule above.

6. Comprehensive covers every type first.
- One page of every type, then the rest of its 20-page budget goes to the
  biggest types, in Decision 4's order.
- Types beyond 20 are named in the report as not covered.

7. The report shows coverage by type.
- For example: "Found 8 page types. Covered 6: home, detail (35 pages),
  listing (5), sign-in (3), form (contact), search. Not covered: content
  (privacy, terms)."
- Each type lists its address pattern, page count, label, and the full URL
  of the page that represented it, as the address bar shows it (for example
  `https://with-bugs.practicesoftwaretesting.com/#/product/1`).
- **A copyable re-run list (Emil, 2026-10-06):** the report and the HTML
  export end with every covered page's full URL, one per line, ready to
  paste into the URL field. Skipped types' URLs follow in a second list, so
  they can be added by hand.
- The user can override the selection: choose pages by hand as today, or
  add a type. An override is recorded in the report.

8. The URL field takes a list of pages to run.
- One URL per line runs Standard (or Comprehensive) on exactly those pages.
  Type selection is skipped and the report says "pages chosen by the user".
  **Clarified at TFP-174's review (2026-10-07):** a list run doesn't crawl
  by itself; link checks come from inspection, as for any run. If the site
  was crawled, the crawl is used only to name the types the list covered
  and left out.
- The first URL gives the run's site. Every URL must share its origin; a URL
  on another origin is rejected before the run, naming it.
- Hash-routed URLs (`/#/contact`) are kept as they are (TFP-165).
- A single URL behaves as today.
- A list pasted from a report reproduces that run's pages exactly. A test
  proves it.

9. Decide before measuring.
- Score TFP-154's answer key with the automatic Standard and Comprehensive
  selection on with-bugs Toolshop, and compare with TFP-154's hand-picked
  list.
- **The baseline** is the re-score of the hand-picked list (`878a49d`):
  9 found, 4 hinted, 24 missed of 37.
- **The selection is kept (Emil, 2026-10-07) only if, on with-bugs
  Toolshop, all of these hold:**
  - it finds at least 9 of the 37;
  - found plus hinted is at least 13;
  - every new failure on with-bugs is a scored bug or a labelled failure;
  - no unlabelled failure appears on the clean site;
  - Standard stays within 1,800 s on one worker.
- Otherwise it is revised or reverted, and the result is recorded either
  way.

## Acceptance Criteria

1. Grouping
- On a fixture with 2 detail pages, 2 listing pages, a sign-in page, a
  contact form, 2 content pages and home, the grouping finds exactly those
  types. One address pattern with different form signatures splits; sibling
  address types under one parent with equal signatures merge; top-level
  pages and home never merge; cards alone never split a type.
- On Toolshop (both versions), the types found are recorded with their page
  counts. Hash and path routing give the same types.

2. Selection
- Standard selects one page per type up to the cap. Home, the form types and
  the largest type are always included.
- Over the cap, content types are dropped first, and every skipped type is
  named.
- Comprehensive covers every type before a second page of any type.

3. Report and re-run
- The run report lists types found, covered and skipped, each with its
  pattern, page count and representative page's full URL.
- The report and the HTML export end with the copyable list of covered URLs,
  and a second list for skipped types.
- Pasting the covered list into the URL field runs exactly those pages; the
  generated suite covers the same pages as the original run.
- A URL on another origin is rejected before the run, naming it.
- A manual override is recorded.

4. Measurement
- Decision 9's comparison is recorded, with run times, and the keep or
  revert rule is applied as written.
- Type counts for the fixture, both Toolshops and the-internet are recorded.

## Regression Policy

- Add `TEST_PLAN.md` cases for the grouping, the outline merge and split,
  the ranking's always-covered rule, the cap with named skips, Comprehensive
  coverage, the report, the re-run list round trip, the multi-URL field
  (including the other-origin rejection) and the override.
- `check:template-unchanged` on the 166 fixed inputs: test bodies are
  unchanged. Only which pages a suite covers changes, and the fixed inputs
  name their pages directly.

## Dependencies and order

- After TFP-167 and TFP-154's re-score with the hand-picked list: both done
  2026-10-07. Decision 9 uses that re-score as the baseline, since the first
  score (6 found, 3 hinted, 28 missed) was held down by TFP-167's readiness
  defect.
- **Before Phase 39 (Emil, 2026-10-07).** Phase 40 is built and measured on
  one worker, which gives an honest single-worker cost; Phase 39's
  measurement (TFP-158) repeats it with workers later.
- Uses TFP-165's page names for hash-routed sites.
- Tickets TFP-170 to TFP-175, below.

## Backlog

Ticket prefix TFP-. Every ticket stops for independent verification
(Cowork) before the next starts. New tests name the ISTQB technique they
use.

### TFP-170 — Group crawled pages into types by address pattern

- **Priority:** P1 · **Labels:** `crawl`, `selection`
- **Scope:** Decision 1.
- **Deliverables:**
  - the grouping: varying segments become `:id` or `:slug`; query strings
    ignored; hash-routed pages grouped by TFP-165's page names;
  - each type recorded with its pattern and page list;
  - unit cases (equivalence partitioning: ids, slugs, hash routes, queries).
- **Acceptance criteria:**
  - `/product/01HX…` pages group as `/product/:id`, `/category/hand-tools`
    and its siblings as `/category/:slug`, and `/#/product/1` and its
    siblings as `/#/product/:id`;
  - two addresses differing only by query string are one type;
  - the path-routed and hash-routed Toolshop crawls give the same patterns.
- **Dependencies:** none.

#### GEN-80 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** A site's crawled pages are grouped into types by address pattern (TFP-170, Phase 40 Decision 1; unit: `src/lib/selection/page-types.test.ts` (unit cases, the two committed Toolshop crawls, and a real crawl of the fixture's `/spa` through `/api/crawl`))

**Expected result:** **Grouping** (`src/lib/selection/page-types.ts`): a segment that is an identifier (digits, a UUID, a ULID or other letter-and-digit token of 16+ characters, hex of 8+ with a digit) becomes `:id`; a segment that varies between addresses equal everywhere else, under a parent segment, becomes `:slug`; top-level pages and a lone child stay literal; hash routes group by TFP-165's page names (`/#/product/:id`, `/app#!/item/:id`); a query string doesn't create a type. Types keep crawl order. **The crawl** (`/api/crawl`) records them as `pageTypes` (pattern and pages, from the pages in discovery order). **Proven (equivalence partitioning: ids, slugs, top-level pages, hash routes, queries), 2026-10-07:** `/product/01M48...` groups as `/product/:id`; `/category/hand-tools` and its siblings as `/category/:slug`; `/#/product/1` and siblings as `/#/product/:id`; `/search?q=a` and `/search?q=b` are one type; `/contact`, `/privacy`, `/rentals` stay three types. The committed Toolshop crawls give 7 types each, the same patterns apart from the sites' own pages: clean `/` 1, `/auth/:slug` 3, `/category/:slug` 4, `/contact` 1, `/privacy` 1, `/product/:id` 35, `/rentals` 1; with-bugs the same under `/#` with `/#/category/:slug` 3, `/#/product/:id` 24, `/#/chainsaws` 1 and no `/privacy`. A real crawl of `/spa` records 6 types. **Not yet:** `/auth/:slug` groups the sign-in, registration and forgot-password pages by address; Decision 2's outline (TFP-171) is what splits them.

### TFP-171 — The page outline and exact-signature merge and split

- **Priority:** P1 · **Labels:** `crawl`, `selection`, `measurement`
- **Scope:** Decisions 2 and 3.
- **Deliverables:**
  - the outline, read from pages the crawl already opens (read-only): the
    structural signature, plus heading structure and interactive-element
    count;
  - merge and split by signature equality, applied to TFP-170's types;
  - the report-only labels;
  - the fixture pages in Acceptance Criteria 1;
  - the type counts and each type's pages for the fixture, both Toolshops
    and the-internet, committed as raw evidence with a short report.
- **Acceptance criteria:**
  - on the fixture, the grouping finds exactly the expected types, with one
    merge and one split shown;
  - a wrong label never changes a type's pages;
  - the type counts for all four sites are recorded, with any type that
    looks over-split named.
- **Dependencies:** TFP-170.
- **Stop at Gate A** after this ticket.
- **Done, `d8287a1`, verified 2026-10-07 (Cowork); Gate A not passed.**
  The counts in `benchmarks/2026-10-07-phase40-types/` reproduce from the
  committed type files. Exact matching under-splits across address types
  and over-splits on cards; Emil revised Decisions 1, 2 and 4 the same day.
  TFP-176 builds the revision.

#### GEN-81 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** Each page's outline refines its address type: equal structural signatures merge, different ones split; each type gets a report-only label (TFP-171, Phase 40 Decisions 2 and 3; unit: `src/lib/selection/page-outline.test.ts` (unit cases, then a real crawl of the fixture's `/types` shop through `/api/crawl`); fixture: `/types`, `/p/...`, `/shop/...`)

**Expected result:** **Outline** (`src/lib/selection/page-outline.ts`, read by the crawl from the page it already has open): landmark regions (banner, navigation, main, complementary, contentinfo, search), forms and each form's field types, repeated card-like items (3+ siblings of one tag and class, each a link with an image or heading), heading levels and the interactive-element count. **Signature:** landmarks, forms (count and field types) and cards; headings and counts never decide. Field types are every field's type: Decision 2 names password, email, textarea and search, and read as the whole list a registration form and a sign-in form (both email and password) would match. **Grouping** (`groupPagesIntoTypes`): TFP-170's address types split by signature, then types of different patterns with equal signatures merge (`/legal/privacy + /help/terms`); a page with no outline keeps its address type. **Labels** (report only, never change pages): home, sign-in (a password field), detail (an `:id` pattern), listing (repeated cards), form, search (only `type="search"` fields), content (no forms, no cards), other. The crawl records each page's `outline` and the labelled types as `pageTypes`. **Proven (equivalence partitioning over how two pages relate: same address and signature, same address different signature, different address same signature, a page with no outline), 2026-10-07:** the `/types` crawl finds exactly 9 types from 14 pages: home; `/types/product/:id` (101, 102) and, split off by its outline, 103; `/types/category/:slug`; `/types/account/:slug` split into sign-in (login) and form (contact), as the Toolshop's `/auth/:slug`; `/types/legal/privacy + /types/help/terms` merged; and TFP-170's edges folded back: `/p/:id + /p/:slug` and `/shop/men/shirts + /shop/women/shoes`. A deliberately wrong label leaves every type's pages unchanged. **Found:** under a shared prefix two id families read as one slug pattern (`/en/product/1`, `/en/category/2` -> `/en/:slug/:id`, TFP-170's rule); their outlines split them, but both keep that name. **Measured** (`benchmarks/2026-10-07-phase40-types/`): types (address types) - fixture 3 (3), `/types` 9 (10), Toolshop clean 9 (7), with-bugs 9 (7), the-internet 9 (57, 100 pages). The Toolshop's `/auth/:slug` splits into its three pages on both sites (under the narrow reading of field types it doesn't on with-bugs). Exact matching under-splits where pages share few landmarks, forms or cards (the-internet: 90 pages in home's type; Toolshop products without related items merge with `/rentals` and `/privacy`) and over-splits a little (empty categories; products with and without related items). For Gate A.

### TFP-176 — Revise the grouping after Gate A's first measurement

- **Priority:** P1 · **Labels:** `selection`, `measurement`
- **Scope:** Decisions 1, 2 and 4 as revised at Gate A (2026-10-07).
- **Deliverables:**
  - TFP-170's rule: a segment directly before an `:id` is never a slug;
  - TFP-171's grouping: split within an address type by form signature
    only; merge only sibling address types under one immediate parent (the
    pattern minus its last segment) with equal full signatures; never merge
    top-level pages or home;
  - fixture cases (decision table): the `/types` fixture updated to the
    revised expectation, `/en/product/:id` beside `/en/category/:id`, the
    two TFP-170 edge families still merging, and a page without cards kept
    in its listing type;
  - the four sites re-measured from the crawls already committed in
    `benchmarks/2026-10-07-phase40-types/` (no new crawl), with a section
    added to that report beside the first measurement, which stays.
- **Acceptance criteria:**
  - the clean Toolshop gives home, category, product, contact, rentals,
    privacy, login, register and forgot-password, each with its pages; the
    with-bugs Toolshop the same with `/#/chainsaws` in place of `/privacy`;
    any difference is explained in the report;
  - the-internet's type count is recorded, with its form types listed;
  - `check:template-unchanged` 166 of 166 identical.
- **Dependencies:** TFP-171.
- **Stop at Gate A** again after this ticket.
- **Built, `b9270b2`, verified 2026-10-07 (Cowork), with one correction.**
  Re-running the grouping on the committed crawls reproduces every count:
  both Toolshops give exactly the 9 expected types, the-internet 57, the
  `/types` fixture 9. But `b9270b2` reads "same parent" as "same first
  segment and depth", which merges `/en/product/:id` with
  `/en/category/:id` (and `/a/b/c/x` with `/a/d/e/y`) when their outlines
  match. Emil clarified Decision 2 the same day: the immediate parent.
  - **Follow-up:** merge only when the two patterns minus their last
    segment are equal. Decision-table cases: `/p/:id` + `/p/:slug` merge;
    `/shop/men/shirts` and `/shop/women/shoes` stay apart; `/en/product/:id`
    and `/en/category/:id` stay apart even with equal outlines; a top-level
    page and home never merge. Update the `/types` fixture's expectation
    (`/types/help/terms` and `/types/legal/privacy` no longer merge).
  - **Re-measure** the four sites from the same committed crawls, in a
    third section of the report; the first two stay. Both Toolshops and
    the-internet should be unchanged, since nothing merges there; any
    change is explained.
  - **Gate A passes on Cowork's verification of the follow-up**, without
    another stop for Emil unless a result differs from the above.
- **Follow-up done, `8c05578`, verified 2026-10-07 (Cowork).** Re-running
  the grouping on the committed crawls: `/en/product/:id` and
  `/en/category/:id` stay apart, as do `/a/b/c/x` and `/a/d/e/y` and the
  two `/shop` pages; `/p/:id` + `/p/:slug` still merge; top-level pages
  never merge. The `/types` fixture gives 11 types. Both Toolshops (9 types
  each) and the-internet (57) are identical to the second measurement, type
  for type.

#### GEN-82 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** The page grouping as revised at Gate A: address types first, split only by form signature, merge only siblings under one immediate parent, never top-level pages or home; no slug before an `:id` (TFP-176 and its follow-up, Phase 40 Decisions 1, 2 and 4 revised by owner decision, 2026-10-07; unit: `src/lib/selection/page-outline.test.ts` (decision table, then a real crawl of the fixture's `/types` shop))

**Expected result:** **Address** (`groupPagesByAddress`): a segment directly before an `:id` names a collection and is never a slug (`/en/product/1`, `/en/category/2` stay `/en/product/:id`, `/en/category/:id`). **Split:** an address type splits only when its pages' form signatures (`formSignatureOf`: how many forms, each one's field types) differ; landmarks and cards don't split. **Merge:** only address types under one immediate parent (the pattern minus its last segment, prefix kept: `/p/:id` and `/p/:slug` merge; `/shop/men/shirts` and `/shop/women/shoes` don't, nor `/en/product/:id` and `/en/category/:id`, even with equal outlines; the owner clarified 2026-10-07) whose pages share one full signature; top-level pages and home never merge; a page with no outline stays apart and never merges. **Proven (decision table: same address or not, form signatures, full signatures, same immediate parent or not, outline read or not), 2026-10-07:** the `/types` crawl (15 pages) gives 11 types: `/types/product/:id` split by forms, the empty category kept with the listing, `/types/account/:slug` split into sign-in and form, `/types/legal/privacy` and `/types/help/terms` apart, `/shop/men/shirts` and `/shop/women/shoes` apart, `/p/:id + /p/:slug` merged; `/`, `/privacy`, `/terms` never merge, nor `/#/rentals` and `/#/chainsaws`. **Re-measured from the committed crawls** (`benchmarks/2026-10-07-phase40-types/`, `remeasure-tfp176.mts`): Toolshop clean 9 types (home, category 4, product 35, contact, rentals, privacy, login, register, forgot-password), with-bugs the same with `/#/chainsaws` for `/privacy` (category 3, product 24); the-internet 57 types (its examples are top-level), forms on `/checkboxes`, `/dynamic_controls`, `/forgot_password`, `/key_presses`, `/login`, `/upload`. Under the immediate-parent rule (`--out=tfp176-parent`) all three sites' results are byte-identical; only the `/types` fixture changes, 9 to 11.

### TFP-172 — Rank types and select pages for Standard and Comprehensive

- **Priority:** P1 · **Labels:** `selection`, `generate`
- **Scope:** Decisions 4, 5 and 6.
- **Deliverables:**
  - the ranking: always-covered types, then the ordered rules, with the
    representative page chosen by most interactive elements;
  - Standard: one page per type, up to 8, dropping content types first and
    naming every skipped type;
  - Comprehensive: one page of every type, then its 20-page budget by
    ranking;
  - Phase 38 Decision 4's reach becomes "the selected pages";
  - unit cases (decision table for the always-covered rule and the cap).
- **Acceptance criteria:** Acceptance Criteria 2; a site with more than 8
  types drops content types first, then the lowest-ranked, and each drop
  names the rule that placed it; `check:template-unchanged` shows test
  bodies unchanged on the 166 fixed inputs.
- **Dependencies:** TFP-171 and Gate A.

- **Done, `10c3f8c`, verified 2026-10-07 (Cowork), with one follow-up.**
  Re-running the ranking and selection on the committed crawls reproduces
  the report: each Toolshop's Standard covers 8 of 9 types and skips its
  rentals page (content, by crawl order), naming the rule; the-internet's
  Standard covers its 8 always-covered types and names 49 skipped;
  Comprehensive covers all 9 Toolshop types in 20 pages.
  - **Rulings:** a crawl-order tie-break between content types is accepted
    (deterministic per crawl, and named); Comprehensive's extra pages taken
    round-robin in rank order are accepted as Decision 6's "biggest types";
    Comprehensive inspecting all its selected pages is measured in TFP-175.
  - **Follow-up:** home is always ranked first (Decision 4, as amended), with
    a unit case where the always-covered types exceed the cap and home is
    still covered.
  - **For TFP-175:** the product type's representative is its page with the
    most interactive elements (`/#/product/10` on with-bugs), not the
    hand-picked list's `/#/product/1`. If a product bug shows only on one
    product, the keep rule will show it.

- **Follow-up done, `967ad6c`, verified 2026-10-07 (Cowork):** home now
  leads the ranking (first on the-internet, where it was 8th), with a unit
  case of home behind 9 form types under the cap of 8. Covered pages on the
  committed crawls are unchanged; only the order moves.

#### GEN-83 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** Page types are ranked and Standard covers one page per type up to a hard cap of 8 (TFP-172, Phase 40 Decisions 4 and 5 as revised at Gate A; unit: `src/lib/selection/select.test.ts` (decision table), plus the real crawl in `src/lib/selection/page-outline.test.ts`)

**Expected result:** **Always covered:** home, every type with a form, the largest type; home is always ranked first (Decision 4 amended 2026-10-07, TFP-172's follow-up); then the ordered rules (more pages, more forms on the representative page, more interactive elements on it, crawl order), no weights; content types last. **The cap is hard:** always-covered types beyond it (after home) are ordered by the same rules and skipped, named; home is never cut. **Representative page:** most interactive elements, ties to crawl order. Each type records the rule that placed it, and each skip says so in one line. A run inspects the selected pages (Phase 38 Decision 4's reach; the 5-page cap is gone, bounded at 100); the UI selects by type after a crawl, follows the run type until the user picks by hand, and "Select by page type" returns to it. **Proven 2026-10-07:** decision table (home, form, largest, content; within or over the cap; always-covered alone over it, with home still covered first); the committed Gate A crawls: both Toolshops cover 8 of 9 types and skip `/rentals` (`/#/rentals`), a content type; the-internet covers its 8 always-covered types, home first, and skips 49; the `/types` fixture crawl covers 8 of 11, skipping sold-out product 103 and the two content pages.

#### GEN-84 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** Comprehensive covers every page type before a second page of any (TFP-172, Phase 40 Decision 6; unit: `src/lib/selection/select.test.ts`)

**Expected result:** One page (the representative) of every type in rank order; types beyond the budget are skipped, named. The rest of the budget (the run's page cap, 20 by default) goes one more page per type per round, in rank order, each type's pages by most interactive elements, until the budget or the pages run out. **Proven 2026-10-07:** a 4-type site with budget 7, 2 and 20; both Toolshops cover all 9 types in 20 pages.

### TFP-173 — Report coverage by type, with the copyable re-run list

- **Priority:** P1 · **Labels:** `report`
- **Scope:** Decision 7.
- **Deliverables:** types found, covered and skipped, each with pattern,
  page count, label and the representative page's full URL; the covered
  list and the skipped list at the end of the report and the HTML export;
  a manual override recorded.
- **Acceptance criteria:** the report half of Acceptance Criteria 3.
- **Dependencies:** TFP-172.

- **Done, `1e7fcd1`, verified 2026-10-07 (Cowork), with one fix carried
  into TFP-174.** The app's report and both HTML exports end with the
  section: types found, covered and skipped, each with pattern, page count,
  label and representative URL; the covered list, then one page per skipped
  type. A hand selection is recorded as an override (pages added and left
  out). The record reaches the run through the generation record, which
  `/api/run` normalizes as untrusted input, and the HTML export escapes it.
  - **Gap:** the normalizer accepts any text as a URL, and the export puts
    it in an `href`, so a `javascript:` value would survive into a shared
    HTML file. TFP-174 accepts only `http:` and `https:` URLs on the run's
    origin, here as in the URL field, and drops the rest.

#### RPT-19 evidence

Moved word for word from [`docs/test-plan/RPT.md`](../test-plan/RPT.md) by TFP-253; the case's row there links here.

**Test:** The run report shows coverage by page type and ends with the copyable re-run lists (TFP-173, Phase 40 Decision 7; unit: `src/lib/selection/coverage.test.ts`, `src/lib/run/jobs.test.ts`; UI: `tests/regression/testforge.page-types.spec.ts`)

**Expected result:** When the pages came from a crawl, the generation record carries the page types found, covered and skipped, each with pattern, page count, label and the full URL of the page that represented it, as the address bar shows it (`https://…/#/product/1`); skipped types give their one-line reason. A selection made by hand is recorded as an override: the pages added to and left out of the type selection, and each skipped type says whether the type selection would have covered it. The app's report and both HTML exports (Standard and Comprehensive) show the section last: Decision 7's sentence ("Found 9 page types. Covered 8: home, detail (3 pages), … Not covered: content (rentals)."), the table, the covered pages one per line (with a copy button in the app), then the skipped types' pages. `/api/run` normalizes the record as untrusted input (unknown selector or run type dropped; at most 100 types and 100 URLs). Without a crawl there is no section. **Proven 2026-10-07:** decision table (by type or by hand; Standard or Comprehensive; covered, skipped or added; hash routes); the normalizer round trip; a finished job's report carries the record; both exports end with the lists; through the UI, a crawl of the `/types` shop runs 8 pages and the report names 11 types, 3 skipped; "Select all" is sent as an override with 7 pages added, and "Select by page type" returns to 8.

### TFP-174 — The URL field takes a list of pages

- **Priority:** P1 · **Labels:** `ui`, `api`
- **Scope:** Decision 8.
- **Deliverables:** one URL per line runs exactly those pages, the crawl
  still runs for link checks, type selection is skipped and the report says
  "pages chosen by the user"; a URL on another origin is rejected before the
  run, naming it; hash routes kept as they are; a single URL behaves as
  today.
- **Acceptance criteria:** the round trip: a covered list pasted from a
  report runs the same pages, and the generated suite covers the same
  pages; the other-origin rejection is tested.
- **Also (from TFP-173's review):** the page-type record's URLs (each
  type's `url`, `covered`, and the override's `added` and `removed`) keep
  only `http:` and `https:` URLs on the run's origin; anything else is
  dropped when `/api/run` normalizes the record. A unit case shows a
  `javascript:` URL and an other-origin URL dropped, and the HTML export
  never contains them.
- **Dependencies:** TFP-173.

- **Done, `e2a3070`, verified 2026-10-07 (Cowork), with one follow-up.**
  The field parses one URL as before, or a list on one origin (checked by
  `URL.origin`, so `https://site@evil` is rejected); `javascript:` and
  `data:` are rejected; the page-type record keeps only `http:`/`https:`
  URLs on the run's origin.
  - **Gap:** a page given to `/api/introspect` or `/api/generate` as a path
    such as `//evil.test/x` or `/\evil.test/x` passes `findForeignPath`
    (it isn't an absolute URL) but resolves to another site in the
    inspector (`new URL(path, baseUrl)`). This predates TFP-174, but
    Decision 8's guarantee depends on closing it. **Follow-up:** resolve
    every page against the base URL and reject any whose origin differs,
    before the run, naming it; unit cases for both forms.
  - **Also:** the regression test "Journey tests are skipped by default"
    (`tests/regression/testforge.journeys.spec.ts:133`) still expects
    "Blocked", but skipped tests have been reported as "Not run" since
    `de26bf1`. Fix the assertion in its own `test` commit.

#### GEN-85 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** The URL field takes a list of pages (TFP-174, Phase 40 Decision 8, with TFP-173's review; unit: `src/app/_lib/derive.test.ts`, `src/lib/selection/coverage.test.ts`, `src/app/api/introspect/route.test.ts`, `src/app/api/generate/route.inspect.test.ts`; UI: `tests/regression/testforge.page-types.spec.ts`)

**Expected result:** One URL behaves as today. One page URL per line runs exactly those pages: the first URL's origin is the run's site, each page keeps its path, query and hash route (`/#/contact`), duplicates and blank lines are dropped, selection by page type is skipped, and the report says "pages chosen by the user" (with a crawl of that site it also names the types the list covered and left out; without one each page stands alone). The list stays in the field after generating. A page on another origin, or a non-http(s) URL, is rejected before the run, naming it: in the field (Generate disabled), and at `/api/introspect` and `/api/generate` (400) for callers that send full URLs; a same-origin full URL is inspected as its path. **Follow-up (2026-10-07):** every page is resolved against the base URL as the inspector opens it, so a path that resolves to another site (`//evil.test/x`, `/\evil.test/x`, `\\evil.test\x`) is rejected the same way, naming it (400 at both routes), and never visited. **URL check (TFP-173's review):** `/api/run` keeps only `http:`/`https:` URLs on the run's origin in the page-type record (type URLs, covered pages, the override's lists); the rest are dropped, so the HTML export never contains a `javascript:` or another site's URL. **Proven 2026-10-07:** parser cases; the round trip for Standard and Comprehensive (the covered list parses back to the same pages, the suite's pages are the same, the list run's report lists them again); hostile URLs dropped and absent from the export; through the UI, the `/types` report's covered list pasted back inspects the same 8 pages and the generated suite's page data is the same; a list with another origin names it and disables Generate.

### TFP-175 — Score the automatic selection against the hand-picked list

- **Priority:** P1 · **Labels:** `measurement`, `benchmark`
- **Scope:** Decision 9.
- **Deliverables:** Standard and Comprehensive runs on both Toolshops with
  the automatic selection, read-only, one worker, Chromium; each bug scored
  with TFP-154's committed rule; new with-bugs failures scored or labelled;
  run times; a report beside TFP-154's two scores.
- **Acceptance criteria:** the keep rule in Decision 9 is applied as
  written, and the outcome (kept, revised or reverted) is recorded either
  way.
- **Dependencies:** TFP-172 to TFP-174.
- **Stop at Gate B** after this ticket.

- **Done, `fac43b6`, `7233751` (TFP-174's follow-ups) and `20d6773`
  (TFP-175), verified 2026-10-07 (Cowork). Outcome: the selection is kept.**
  - **Pages:** each Standard run used exactly the 8 pages in the app's
    selection file, home first; every inspected page was on the real site.
    The first attempt (Git Bash rewrote page paths into Windows paths) was
    discarded unscored.
  - **Score:** 9 found, 4 hinted, 24 missed, bug for bug the re-score's.
    The selection ties the hand-picked list and covers every type it
    skipped; the remaining misses (layout, spelling, tab order) are check
    gaps, not selection gaps.
  - **Run time:** Standard 1,232 s (with-bugs) and 1,276 s (clean), within
    1,800 s; about 154 s a page.
  - **Condition 4 (Emil, 2026-10-07):** read as "no new unlabelled failure
    on the clean site against the re-score", since the clean site's baseline
    failures were never labelled. TFP-178 labels them, so later benchmarks
    can use the strict reading.
  - **New:** T30, a false orphan failure from inspection reading pages
    before their cards drew; TFP-177 fixes it.

## Recommended Execution Order

1. TFP-170, then TFP-171. **Gate A (first measurement, 2026-10-07): not
   passed; Decisions 1, 2 and 4 revised.** Then TFP-176. **Gate A passed
   2026-10-07** (`8c05578`, verified in Cowork).
2. TFP-172, TFP-173, TFP-174, in that order.
3. TFP-175. **Gate B.**

## Gates

### Gate A — Types measured
**Passed 2026-10-07** on `8c05578`: both Toolshops give exactly their 9
expected types; the-internet gives 57, with its form types listed.
- TFP-170, TFP-171 and TFP-176 landed and independently verified.
- Type counts for the fixture, both Toolshops and the-internet are recorded.
- Emil reviews whether exact matching over-splits before selection is
  built.

### Gate B — Selection measured
**Passed 2026-10-07 (Emil):** the automatic selection meets Decision 9's
keep rule and is kept. Phase 40 is complete.
- TFP-172 to TFP-175 landed and independently verified.
- Decision 9's keep rule applied and recorded, with run times.
