# Phase 40 Decision Record — Page-Type Selection: Test One Page of Every Kind

Date: 2026-10-06
Scope: Group a site's crawled pages into page types (templates). Choose the
pages a run inspects by type, not by crawl order. Standard covers one page
of every type up to a cap instead of the first 5 pages; Comprehensive covers
every type first. The report names the types found, covered and skipped,
with each page's full URL. A list of URLs pasted into the URL field re-runs
exactly those pages.
Status: Draft. Emil asked for it on 2026-10-06 and decided that Standard is
not capped at 5 pages. The values marked `[PLACEHOLDER]` must be confirmed
before building. Starts after TFP-167 and TFP-154's re-score.

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

2. The crawl records a cheap outline of each page, and the outline refines the
grouping.
- **The outline:** landmark regions, the number of forms and their field
  types (password, email, textarea, search), whether repeated card-like
  items are present, heading structure, and the count of interactive
  elements.
- Pages with different addresses but matching outlines merge into one type,
  for example `/privacy` and `/terms`.
- Pages with one address pattern but clearly different outlines split.
- `[PLACEHOLDER: the outline-match threshold; set by measuring on the
  fixture, Toolshop and the-internet crawls before building the selection]`
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
- **Always covered, never dropped:**
  - home;
  - every type with a form (sign-in, registration, contact, checkout);
  - the type covering the most pages (usually detail).
- **Then, by score:** the number of pages of that type, plus the number of
  interactive elements and forms on its representative page.
  `[PLACEHOLDER: the score weights]`
- **Dropped first when over the cap:** content types, then the lowest
  scores.
- **The representative page** is the type's page with the most interactive
  elements. Ties go to crawl order.

5. Standard covers one page of every type, up to a cap. It is no longer capped
at 5 pages.
- **Not 5 (Emil, 2026-10-06).** `[PLACEHOLDER: the cap; recommended 8, so
  that most small sites are fully covered and a shop loses only its content
  types]`
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
  Standard run now takes 1,170 s for 5 pages, about 234 s a page. If cost
  grows linearly with pages (not yet measured), the recommended cap of 8
  comes to about 1,870 s, over the 30-minute budget (1,800 s) on one worker.
  Emil confirms the cap with this in view.

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
- The selection is kept if `[PLACEHOLDER: e.g. it reaches at least as many
  of the answer key's in-reach bugs as the hand-picked list, and Standard
  stays within the 30-minute budget]`. Otherwise it is revised or reverted,
  and the result is recorded either way.

## Acceptance Criteria

1. Grouping
- On a fixture with 2 detail pages, 2 listing pages, a sign-in page, a
  contact form, 2 content pages and home, the grouping finds exactly those
  types.
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

- After TFP-167 and TFP-154's re-score with the hand-picked list. Decision 9
  needs that re-score as the baseline: the first score (6 found, 3 hinted,
  28 missed) was held down by TFP-167's readiness defect.
- Works without Phase 39, but the run-time measurement should be repeated
  once Phase 39's workers land.
- Uses TFP-165's page names for hash-routed sites.
- Tickets are written once the `[PLACEHOLDER]` values are confirmed.
