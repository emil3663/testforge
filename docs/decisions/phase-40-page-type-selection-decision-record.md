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
are done (9 found, 4 hinted, 24 missed). Tickets TFP-170 to TFP-175.

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
- **The structural signature (Emil, 2026-10-07):** the set of landmark
  regions, the form signature (the number of forms and each form's field
  types) and whether repeated card-like items are present. Two outlines
  match only when their signatures are equal. There is no threshold.
- Counts (headings, interactive elements) never decide grouping; they are
  recorded and used by the ranking.
- Pages with different addresses but equal signatures merge into one type,
  for example `/privacy` and `/terms`.
- Pages with one address pattern but different signatures split.
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
- **Always covered, never dropped:**
  - home;
  - every type with a form (sign-in, registration, contact, checkout);
  - the type covering the most pages (usually detail).
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
  types. Two pages with equal signatures merge; two with one address pattern
  and different signatures split.
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

1. TFP-170, then TFP-171. **Gate A.**
2. TFP-172, TFP-173, TFP-174, in that order.
3. TFP-175. **Gate B.**

## Gates

### Gate A — Types measured
- TFP-170 and TFP-171 landed and independently verified.
- Type counts for the fixture, both Toolshops and the-internet are recorded.
- Emil reviews whether exact matching over-splits before selection is
  built.

### Gate B — Selection measured
- TFP-172 to TFP-175 landed and independently verified.
- Decision 9's keep rule applied and recorded, with run times.
