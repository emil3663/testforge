# Phase 40 Decision Record — Page-Type Selection: Test One Page of Every Kind

Date: 2026-10-06
Scope: Group a site's crawled pages into page types (templates). Choose the
pages a run inspects by type, not by crawl order. Standard covers one page
of every type up to a cap instead of the first 5 pages; Comprehensive covers
every type first. The report names the types found, covered and skipped,
with each page's full URL. A list of URLs pasted into the URL field re-runs
exactly those pages.
Status: Locked 2026-10-07. Emil asked for it on 2026-10-06 and decided
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
  fit are named in the report as skipped. (On the-internet, home, six form
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
  The crawl still runs for link checks, but type selection is skipped and
  the report says "pages chosen by the user".
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

### TFP-173 — Report coverage by type, with the copyable re-run list

- **Priority:** P1 · **Labels:** `report`
- **Scope:** Decision 7.
- **Deliverables:** types found, covered and skipped, each with pattern,
  page count, label and the representative page's full URL; the covered
  list and the skipped list at the end of the report and the HTML export;
  a manual override recorded.
- **Acceptance criteria:** the report half of Acceptance Criteria 3.
- **Dependencies:** TFP-172.

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
- **Dependencies:** TFP-173.

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
- TFP-172 to TFP-175 landed and independently verified.
- Decision 9's keep rule applied and recorded, with run times.
