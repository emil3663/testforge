# Phase 41 Decision Record — Check Gaps: Catch What the Benchmark Missed

Date: 2026-10-07
Scope: New checks for the known bugs TestForge reaches but misses at the
read-only gate, grouped by what would catch them: layout and visual
consistency, spelling and wording, the behaviour of controls on read-only
pages, keyboard order and grouping, and read-only security probes. Each
check is measured on the Toolshop answer key, with the clean site as the
false-failure control.
Status: Locked 2026-10-07. Every decision confirmed by Emil as recommended,
with one change of venue: Phase 41 is built and measured on local copies of
both Toolshops first (Decision 7); the hosted sites come after, once the
issues are worked through locally. Tickets TFP-179 to TFP-189.

## Context

- **The measurement:** TFP-154's answer key, scored three times. The last
  two scores (after TFP-167, and with Phase 40's selection) agree bug for
  bug: 9 found, 4 hinted, 24 missed of the 37 bugs in reach at the read-only
  gate in Chromium.
- **Phase 40 showed the misses are check gaps, not page gaps:** covering
  register, forgot-password and a content page found nothing new, because no
  check reads layout, spelling or tab order.
- **The 24 misses, by what would catch them** (IDs from
  `benchmarks/2026-10-06-toolshop-known-bugs/answer-key.md`):

  | Group | Missed | Hinted | Today's nearest area |
  | --- | --- | --- | --- |
  | Layout and visual consistency | 4, 19, 22, 23, 45, 49, 58, 59, 63, 66, 67 (11) | 26 | none (usability nearest) |
  | Spelling and wording | 31, 34, 42, 54, 62 (5) | 33 | SEO/content |
  | Controls on read-only pages | 2, 27, 29 (3) | 40, 60 | functional |
  | Keyboard order and grouping | 53, 94 (2) | | accessibility |
  | Read-only security probes | 75, 80, 82 (3) | | security |

- **Presence isn't confirmed for most of them.** 20 of the first score's 28
  misses were never checked by hand on the hosted site ("?" in the report);
  some may not be there.
- **The clean site is the control.** A check that fails on the clean site is
  a false failure unless the clean site really has the problem. Layout and
  spelling checks are where false failures are most likely (brand names,
  product names, intentional design differences).
- **Standing rules this phase keeps:** Standard is the critical working path
  and must not be intrusive (Phase 38 Decision 2); every test declares its
  gate (Phase 38 Decision 1); a result that misses a best-practice target but
  isn't poor is a finding, not a failure (Emil, 2026-10); the deterministic
  template generator is the foundation; every new test names its ISTQB
  technique.

## Decisions

0. Confirm presence before building.
- Before any check is built, each target bug is confirmed on the local
  copies (Decision 7): in the with-bugs source (the `sprint5-with-bugs`
  version against `sprint5`), and on the running page, read-only. Each is
  recorded in the answer key as present, absent or not visible. A check is built only
  for bugs that are present; absent ones leave the denominator, with the
  reason.

1. Layout and visual consistency (11 missed, 1 hinted).
- **The approach (recommended):** consistency, not a baseline. TestForge
  can't know a site's intended design on a first run, but it can find
  elements that should look alike and don't:
  - **Within a group:** sibling controls of one form or one toolbar share
    font family, font size, padding and, for buttons in one row, width
    (19, 22, 23, 58, 59, 63, 66, 67);
  - **Across pages:** the same component on different pages shares its
    alignment and typography (page titles: 49; product card names: 4);
  - **Overlap:** interactive elements' boxes don't intersect (45);
  - **Rendering:** an `<img>` that is visible but has `naturalWidth` 0 or a
    failed request didn't render (26).
- Rejected for now: screenshot comparison against a baseline. It needs a
  known-good first run, which a site under test doesn't give, and it's
  noisy across fonts and data. It may come back later as an opt-in.
- **Confirmed (Emil, 2026-10-07):** overlap and an image that didn't
  render are failures (a user can't use or see the thing); a consistency
  difference is a finding that names both elements and the property that
  differs, since some differences are intended. All of it runs in Standard,
  on the selected pages.

2. Spelling and wording (5 missed, 1 hinted).
- **The approach (recommended):** a dictionary check on the words people
  read in the interface: button text, labels, placeholders, headings,
  link text, `aria-label`s and option text. Body copy is out of scope at
  first (too many names and too much prose).
- **Site vocabulary:** words a dictionary doesn't know but the site uses
  consistently (brand and product names) shouldn't fail. Recommended: an
  unknown word is reported only if the site doesn't also use it elsewhere
  in the same form, or a near spelling of a known word (edit distance 1 or
  2) is in the dictionary. "Contakt" is reported; "Bosch" isn't.
- **Language:** the page's `lang`; English (en-US and en-GB both accepted)
  first, other languages named as not checked.
- **The dictionary** is an open word list with a licence compatible with
  TestForge's; checked before building.
- **Confirmed (Emil, 2026-10-07):** a finding naming the word, the element
  and the suggested spelling.

3. Controls on read-only pages (3 missed, 2 hinted).
- **The gate question:** the read-only gate allows interactions that send
  nothing to the server (Phase 38 Decision 1). A sort or a filter usually
  sends a GET to fetch results.
- **Confirmed (Emil, 2026-10-07): the read-only gate is widened.** It also
  allows interactions whose requests are all GETs and submit no form, under
  a request guard that aborts any other method and fails the test as a
  guard breach. A sort, a filter and a quantity stepper fit; add-to-cart
  doesn't. This amends Phase 38 Decision 1.
- **The checks (recommended):**
  - **Sort:** choosing each sort option orders the visible items by it (2);
  - **Filter:** a range or option filter's request carries the chosen
    values, and the results respect them (27);
  - **Stepper:** +/- change the field's value by one, within its bounds
    (40);
  - **Link destination:** a navigation link's text matches where it lands:
    "Home" reaches the start page, and otherwise the destination's title or
    first heading shares the link's words (29);
  - **Option lists:** a select's options don't contain error text such as
    "Error", "undefined" or "not found" (60).
- These are failures: each is a control not doing its job.

4. Keyboard order and grouping (2 missed).
- **Tab order (53):** tabbing through a form visits its fields in reading
  order (top to bottom, then left to right). A positive `tabindex` or an
  order that jumps back is a failure. Read-only: focus moves, nothing is
  typed or sent.
- **Grouping (94):** two or more checkboxes or radios that share a name or
  a heading, outside a `fieldset` or `role="group"`/`radiogroup` with a
  name, fail (WCAG 1.3.1, technique H71). axe has no rule for it.

5. Read-only security probes (3 missed).
- **Known paths (80):** a short fixed list of paths that leak (log files,
  `.env`, backups, VCS folders), one GET each, once per run. This goes
  beyond "one request to a path that cannot exist" (Phase 38 Decision 1).
  **Confirmed (Emil, 2026-10-07):** Comprehensive security only, at the
  read-only gate, with the list and its count in the report.
- **Guessable ids (82):** sequential integer ids in page and API URLs are
  recorded as a finding (OWASP WSTG-ATHZ-04 context), not a failure.
- **API response contents (75): confirmed (Emil, 2026-10-07).** A read-only
  check that reads the API
  responses the page already fetches and reports, as a finding, fields the
  page never displays whose names suggest internals. Designed and measured
  on the local with-bugs and clean copies (the field's presence in one and
  absence in the other is the ground truth).

6. Measure each check against the answer key and the control.
- A new check is kept only if, on the local Toolshops (Decision 7) at the
  read-only gate with Phase 40's selection:
  - it finds (by TFP-154's committed scoring rule) the target bugs it was
    built for that are present (Decision 0);
  - it adds no unlabelled failure or finding on the clean site;
  - Standard stays within 1,800 s on one worker.
- Otherwise it is revised or dropped, and the result is recorded either
  way. The score is recorded beside the three before it.

7. Build and measure on local copies first (Emil, 2026-10-07).
- Both Toolshop versions run locally from Testsmith's repository
  (`docker compose`, with `SPRINT` in `.env` choosing `sprint5` or
  `sprint5-with-bugs`), on Emil's machine (Docker Desktop, WSL 2; checked
  2026-10-07).
- The local copies give ground truth (the source shows each bug), a control
  that differs from the bugged version only by the bugs, no load on the
  hosted demo, and a catalogue that doesn't reset under the benchmark.
- **A local baseline first:** today's code is scored on the local copies
  before any new check, so every gain is measured against the same copies.
- The hosted sites are re-scored at the end, beside the earlier scores,
  once the checks are settled locally.
- The local setup is shared with Phase 39 (TFP-158 needs the same copy).

## Dependencies

- After Phase 40 (complete) and the current batch (TFP-177 and others),
  since TFP-177 changes what inspection records.
- Docker Desktop must be started before the local copies run.
- Independent of Phase 39's workers; Phase 39 reuses TFP-179's local copy.

## Backlog

Ticket prefix TFP-. Each check is built ticket by ticket with targeted
tests; the full unit suite, the regression tests and
`check:template-unchanged` run once at the end of each batch (Emil,
2026-10-07), and each batch stops for verification. Every new test names
its ISTQB technique and its gate.

### TFP-189 — The progress estimate counts the helper's `.test(` (and two stale tests)

- **Priority:** P1, before TFP-179 · **Labels:** `bug`, `run`, `test`
- **Problem it solves:** found in the batch's regression run. The planned
  test count (`src/lib/run/selection.ts`) matches `\btest\s*\(`, which also
  matches the `.test(url)` inside TFP-167's `tfGoto` helper. Every
  generated suite is estimated one test too high (15 planned, 14 run), so
  the "open the report in a new page" step never happens.
  `src/lib/run/jobs.ts` uses the same pattern for its zero-tests check.
- **Scope:** count only `test(`, `test.only(` and the like that aren't a
  property access (no `.` before `test`), in both places. Fix the two stale
  regression tests ("Playwright executes zero tests" and "fallback report
  page"), which still expect "failed" where an empty run has ended "empty"
  since `d86c8d1`, as their own `test` commit.
- **Acceptance criteria:** a unit case with the helper counts its tests
  exactly; the "Report tabs, HTML export" regression test and the two fixed
  ones pass; the full regression suite runs green at the end of the next
  batch.
- **Dependencies:** none.

### TFP-179 — Run both Toolshop versions locally

- **Priority:** P1 · **Labels:** `infra`, `benchmark`
- **Scope:** Decision 7.
- **Deliverables:**
  - a script (PowerShell, read-friendly) that clones or updates Testsmith's
    `practice-software-testing` outside the TestForge repo, and starts the
    clean (`sprint5`) and with-bugs (`sprint5-with-bugs`) versions, both at
    once if their ports can be separated, otherwise one at a time;
  - a stop script; the URLs and ports recorded in a short doc;
  - the upstream commit used, recorded, so runs are reproducible.
- **Acceptance criteria:**
  - both versions answer (the app's home page and the API's documentation
    page) from this machine;
  - a TestForge crawl of each records its page types, matching the hosted
    ones apart from routing (the local copies may route by path);
  - nothing from Testsmith's repository is committed to TestForge.
- **Dependencies:** none. Docker Desktop running.

### TFP-180 — Confirm the target bugs and score a local baseline (Gate A)

- **Priority:** P1 · **Labels:** `measurement`, `benchmark`
- **Scope:** Decisions 0 and 7.
- **Deliverables:**
  - each of the 24 missed and 4 hinted bugs confirmed present, absent or
    not visible on the local with-bugs copy, from the source diff between
    the two versions and the running page, recorded in the answer key;
  - today's TestForge scored on both local copies with TFP-154's committed
    rule and Phase 40's selection (Standard, Comprehensive security and
    accessibility; read-only; one worker; Chromium), recorded beside the
    hosted scores;
  - new failures on either copy labelled, as before.
- **Acceptance criteria:** every target bug has a presence verdict; the
  local baseline score is recorded with run times.
- **Dependencies:** TFP-179, and the current batch (TFP-177).
- **Stop at Gate A.**

- **Done, TFP-189 (`69511a4`, `4f636b1`), TFP-179 (`044a1cd`) and TFP-180
  (`8769970`), verified 2026-10-08 (Cowork). Gate A passed.**
  - **TFP-189:** the planned count now matches only declared `test(` and
    `test.only(` (`(?<![.\w$])test(?:\.only)?\s*\(`), in `selection.ts`
    and `jobs.ts`; regression 57/57.
  - **TFP-179:** Testsmith's repository is cloned next to TestForge, pinned
    at `5a6ccc26`; TestForge's two compose overrides leave Testsmith's files
    untouched. One version runs at a time (both apps call `localhost:8091`).
  - **TFP-180:** every run's site is `http://localhost:4200`, every
    inspected page is local, and each Standard run used exactly its
    selection. The local score is 9 found, 4 hinted, 24 missed, bug for bug
    TFP-175's. Of the 24 missed, 21 are present and visible in Chromium;
    22 and 23 show only in Edge and Firefox; 54 is absent in this version.
  - **The two copies' API caches differed** (clean in memory, with-bugs on
    file); the with-bugs run predated the override. TFP-188 runs both
    through the committed script, so they match from then on.

### TFP-181 — Widen the read-only gate for GET-only interactions

- **Priority:** P1 · **Labels:** `run`, `gates`
- **Scope:** Decision 3's gate, amending Phase 38 Decision 1.
- **Deliverables:** a request guard for read-only tests that interact: any
  request other than GET, and any form submission, is aborted and fails the
  test as a guard breach, named; the gate's definition updated where it is
  documented.
- **Acceptance criteria:** on the fixture, a GET-only sort passes the guard,
  and a control that POSTs is aborted and named; existing read-only tests
  unchanged (`check:template-unchanged`).
- **Dependencies:** Gate A.

### TFP-182 — Controls do their job on read-only pages

- **Priority:** P1 · **Labels:** `generate`, `functional`
- **Scope:** Decision 3's checks: sort order, filter requests and results,
  quantity steppers, link destinations, error text in option lists.
- **Acceptance criteria:** fixture cases pass and fail as designed (state
  transition and decision table); on the local with-bugs copy they find the
  present ones of 2, 27, 29, 40 and 60; the clean copy passes them.
- **Dependencies:** TFP-181.

### TFP-183 — Tab order and grouping

- **Priority:** P2 · **Labels:** `generate`, `accessibility`
- **Scope:** Decision 4.
- **Acceptance criteria:** fixture cases for positive `tabindex`, an order
  that jumps back, and ungrouped checkboxes; on the local with-bugs copy
  they find the present ones of 53 and 94; the clean copy passes.
- **Dependencies:** Gate A.

### TFP-184 — Known-path probe and guessable ids

- **Priority:** P2 · **Labels:** `generate`, `security`
- **Scope:** Decision 5's known paths (Comprehensive security, read-only
  gate, one GET each, the list and its count in the report) and guessable
  ids (a finding).
- **Acceptance criteria:** on the local with-bugs copy they find the present
  ones of 80 and 82; the clean copy shows no known-path failure.
- **Dependencies:** Gate A.

### TFP-185 — API responses that expose undisplayed internal fields

- **Priority:** P2 · **Labels:** `generate`, `security`
- **Scope:** Decision 5's bug 75: read the API responses the page already
  fetches; report as a finding fields the page never displays whose names
  suggest internals.
- **Acceptance criteria:** on the local copies, the with-bugs field is
  reported and the clean response isn't; the rule is shown not to flag the
  clean site's ordinary fields.
- **Dependencies:** Gate A.

### TFP-186 — Layout consistency, overlap and images that don't render

- **Priority:** P1 · **Labels:** `generate`, `usability`
- **Scope:** Decision 1.
- **From Gate A's presence verdicts (2026-10-08):**
  - **Bug 26 hides images (`d-none` on products 5, 13 and 20), it doesn't
    break them.** An "image that didn't render" check reads only visible
    images, so it can't see these. Add a group-consistency case: in a set
    of repeated cards, a card whose image is hidden while its siblings'
    show is a finding naming the card.
  - **Bug 4 is random:** product names are right-aligned only when a random
    number is odd, so it shows on some loads and not others. The check must
    report it when it appears and must not count its absence as a pass on
    the bug; the scoring records it as present-intermittent.
  - 22 and 23 aren't visible in Chromium, so they leave this ticket's
    targets.
- **Acceptance criteria:** fixture cases for each property, for overlap, for
  an unrendered image and for a hidden image among its siblings; on the
  local with-bugs copy they find the present ones of 4, 19, 26, 45, 49, 58,
  59, 63, 66 and 67; on the clean copy, no failure, and every finding
  labelled.
- **Dependencies:** Gate A.

### TFP-187 — Spelling of interface text

- **Priority:** P1 · **Labels:** `generate`, `content`
- **Scope:** Decision 2, with the dictionary's licence checked first.
- **Acceptance criteria:** fixture cases for a misspelt label, a brand name
  that isn't reported, and a page in another language named as not checked;
  on the local with-bugs copy it finds 31, 33, 34, 42 and 62 (54 is absent
  in this version); on the clean copy every finding is labelled.
- **Dependencies:** Gate A.

### TFP-188 — Re-score with the new checks (Gate B)

- **Priority:** P1 · **Labels:** `measurement`, `benchmark`
- **Scope:** Decision 6, on the local copies; then the hosted sites, beside
  the earlier scores.
- **Acceptance criteria:** Decision 6's keep rule applied to each check as
  written, kept, revised or dropped, and recorded either way; run times.
- **Dependencies:** TFP-181 to TFP-187.
- **Stop at Gate B.**

## Recommended Execution Order

1. TFP-189 (small, first), then TFP-179 and TFP-180. **Gate A passed
   2026-10-08.**
2. Batch 1: TFP-181, TFP-182, TFP-183, TFP-184, TFP-185.
3. Batch 2: TFP-186, TFP-187.
4. TFP-188. **Gate B.**

## Gates

### Gate A — Ground truth and baseline
**Passed 2026-10-08** (`8769970`): presence verdicts for all 28 targets;
the local baseline is 9 found, 4 hinted, 24 missed.
- Every target bug has a presence verdict from the local copies.
- Today's code is scored on both local copies.

### Gate B — Checks measured
- TFP-181 to TFP-188 landed and independently verified.
- Decision 6's keep rule applied per check, locally and then on the hosted
  sites.
