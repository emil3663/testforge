# Phase 41 Decision Record — Check Gaps: Catch What the Benchmark Missed

Date: 2026-10-07
Scope: New checks for the known bugs TestForge reaches but misses at the
read-only gate, grouped by what would catch them: layout and visual
consistency, spelling and wording, the behaviour of controls on read-only
pages, keyboard order and grouping, and read-only security probes. Each
check is measured on the Toolshop answer key, with the clean site as the
false-failure control.
Status: Complete 2026-10-13 (Gate B passed, Emil). Locked 2026-10-07. Every decision confirmed by Emil as recommended,
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

#### RUN-26 evidence

Moved word for word from [`docs/test-plan/RUN.md`](../test-plan/RUN.md) by TFP-253; the case's row there links here.

**Test:** The planned test count counts declared tests only (TFP-189; unit: `src/lib/run/selection.test.ts`; UI: "covers the report tabs, HTML export..." in `tests/regression/testforge.sections.spec.ts`)

**Expected result:** `test(` and `test.only(` are counted; a property access (`.test(`, as in TFP-167's tfGoto helper `/#!?\//.test(url)`), `test.describe(`, `test.skip(` and longer names (`latest(`) are not. The same count decides the zero-tests check (an empty suite). Before, every generated suite was estimated one test too high (15 planned, 14 run), so a run never reached its planned count and the completed-report page never opened. **Proven 2026-10-07:** a generated suite with the helper counts exactly its declared titles (the case fails on the previous count, 3 against 2); the report-tabs regression test's popup opens again.

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
- **Decided while building TFP-182 (Emil, 2026-10-12):** the clean
  Toolshop sorts and filters with the HTTP QUERY method (RFC 10008: safe and
  idempotent like GET, its criteria in a JSON body), which the guard
  aborted, so every interaction check failed there as a breach. The guard
  allows the methods HTTP defines as safe - GET, HEAD and QUERY - and aborts
  every other; the filter check reads a QUERY's body as well as its URL.
  This amends Decision 3's "all GETs" to "all safe methods". Rejected:
  keeping GET only and labelling the clean breaches.

#### RUN-27 evidence

Moved word for word from [`docs/test-plan/RUN.md`](../test-plan/RUN.md) by TFP-253; the case's row there links here.

**Test:** A read-only test that interacts runs under the request guard (TFP-181, Phase 41 Decision 3, amending Phase 38 Decision 1; unit: `src/lib/generate/read-only-guard.test.ts` (runs a suite through the Playwright CLI on the comparison fixture's `/store` and `/forms`, behind the recording proxy))

**Expected result:** `tfReadOnlyGuarded(page, interact)` (`src/lib/generate/read-only-guard.ts`), armed after the page has loaded: every request whose method isn't safe - GET, HEAD or QUERY (RFC 10008; owner decision, 2026-10-12, found on the clean Toolshop, which searches with QUERY) - is aborted before it leaves the browser, and every form submission is stopped before the page's handlers see it (a submit event, or `form.submit()`, which fires none). Either one fails the test as `read-only guard breach, aborted: <METHOD> <url>` or `form submission "<name>" (<METHOD> <action>)`, and that breach is the failure reported even when the interaction then fails for another reason. **Proven on the fixture (decision table: what the interaction sends x whether it then fails):** a GET-only sort passes and its GET reaches the server; a QUERY passes and reaches it; "Add to cart" (a POST) fails naming `POST <origin>/api/store/cart`; a form submitted by its button and by `form.submit()` each fail naming `GET <origin>/notes`; a POST followed by a failing assertion reports the breach, not the assertion. At the server: no request but GET and that one QUERY, and no `/notes` submission. Mutation check: with the abort replaced by letting the request through, the test fails ("no request but GET reached the server"). **Output:** the helper isn't used by any generator in this ticket, so template output is unchanged. **Site beacons (TFP-199; owner decision, 2026-10-13; Phase 41 Gate B's T33):** a request Chromium types `ping` (`navigator.sendBeacon`, a link's `ping`), or a non-safe request to a named analytics path (`TF_BEACON_PATHS`: `/cdn-cgi/rum`, Cloudflare's, measured on the hosted Toolshops as one `ping` and one `xhr` POST per navigation), is still aborted but recorded as a `note` annotation (`read-only guard: aborted N site beacon(s), not a breach: ...`), not a breach. **Proven on the fixture (equivalence partitioning: beacons against every other non-safe request):** `site-beacons` makes every page send a `sendBeacon` POST and a keepalive `fetch` POST to `/cdn-cgi/rum` as it is left; following a link under the guard passes and neither reaches the server; the same two sent while the page stays are noted by name (`(ping)`, `(fetch)`). (TFP-208: the link case no longer requires both in its note. As the old page is torn down Chromium can fail its beacons, `net::ERR_ABORTED`, before Playwright hands them to the guard's route: 15 of 350 runs under 10 to 14 parallel copies noted one or none; in all 320 timed runs the test passed, nothing reached the server, and no beacon came after the guard returned. It checks that whatever its note names is one of the two); the POST control and both form submissions still fail as breaches; on the previous guard the beacon case fails. `check:template-unchanged` 15e0205 against TFP-199: 162 of 166 identical; the 4 with control checks differ only by the beacon lines.

### TFP-182 — Controls do their job on read-only pages

- **Priority:** P1 · **Labels:** `generate`, `functional`
- **Scope:** Decision 3's checks: sort order, filter requests and results,
  quantity steppers, link destinations, error text in option lists.
- **Acceptance criteria:** fixture cases pass and fail as designed (state
  transition and decision table); on the local with-bugs copy they find the
  present ones of 2, 27, 29, 40 and 60; the clean copy passes them.
- **Dependencies:** TFP-181.
- **Decided while building (Emil, 2026-10-12):** the link-destination rule
  ("shares the link's words") failed the clean Toolshop's "Sign in", which
  lands on a page titled and headed "Login". A link and its destination's
  title or first heading are matched through a small fixed synonym table:
  sign in = log in = login; sign up = register = create account; cart =
  basket = checkout. Rejected: matching the destination's URL words, and
  keeping the literal rule and labelling the clean failure.

#### GEN-89 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** Controls on read-only pages do their job: sort, filter, stepper, link destination, option lists (TFP-182, Phase 41 Decision 3; unit: `src/lib/generate/mock/controls.test.ts` (inspects the comparison fixture's `/store`, generates a Standard functional suite and runs the five checks through the Playwright CLI, behind the recording proxy); local copies: `benchmarks/2026-10-12-phase41-batch1/`)

**Expected result:** Functional tests per inspected page, chosen from what inspection recorded (`buildControlTests`, `src/lib/generate/mock/controls.ts`): a select whose options read as sort orders gets **sort options order the items** (each option chosen in turn; names compared for "Name (A - Z)" and the like, prices for "Price (Low - High)"; the items are headings in repeated cards, list items or rows, the largest such group, each with its price; an option that orders by anything else isn't judged; ISTQB: decision table); a checkbox or range field gets **filters send and respect the chosen values** (each range slider, a `role=slider` handle or `input[type=range]`, moved one step by keyboard: the request it sends must carry the new value, in its URL or a QUERY's body; with two handles the listed prices must fall inside them; the first option checkbox with a real value: its request must carry it; boundary value analysis); a number field gets **quantity steppers change the value by one** (+ then -, within `min`/`max`; state transition); any select gets **option lists show no error text** (no option reads "Error", "Error 101", "undefined", "null", "NaN", "not found", "[object Object]" or "exception"; error guessing; reads only); the first inspected page gets **navigation links land where their text says** (each visible header or nav link, up to 10, followed: "Home" must reach the start page; any other link's words must meet the destination's title or first heading, through a fixed synonym table: sign in = log in = login, sign up = register = create account, cart = basket = checkout (owner decision, 2026-10-12); decision table). Every interaction runs under TFP-181's guard; each check is Not run, with the reason, when the page has nothing it can judge. Failures name the control, the page and the value at fault. **Proven on the fixture (decision table: which control is broken):** clean, and each of `controls-sort-reversed`, `controls-filter-drops-max`, `controls-stepper-broken`, `controls-home-link-wrong`, `controls-option-errors`: in each column the broken control's check fails with its named message and the other four pass; the clean store passes all five; no request but GET reached the server. **Local copies (2026-10-12):** with-bugs, the committed profile's 8 pages: the sort fails on home and category (bug 2: "Name (A - Z)" puts "Wood Saw" before "Thor Hammer"), the filter fails (27: the maximum moved to 99, the request `between=price,0`), the stepper fails (40: "+" left 1 at 1), the contact subject list fails (60: "Error 101: Subject not found", "Error 202: Translation error"), the link check fails (29: "Home" leads to /contact; also "Contakt", bug 31); clean: every check that ran passed (the stepper on a current product, the committed profile's product no longer existing after the re-seed). **Found while building:** the clean Toolshop searches with QUERY, so the guard allows GET, HEAD and QUERY (RUN-27; owner decision, 2026-10-12), and the guard settles with `tfSettle` (no request for 500 ms, at most 5 s), since `waitForLoadState('networkidle')` returns at once on a page that has loaded. **Output measured:** `check:template-unchanged` 7069078 against this commit: 162 of 166 identical; the 4 that differ (inputs with page data and the functional area) are identical once the control helpers and the new tests are removed, and gain one test each (the link check: none of the fixed pages has a sort, filter, stepper or select).

### TFP-183 — Tab order and grouping

- **Priority:** P2 · **Labels:** `generate`, `accessibility`
- **Scope:** Decision 4.
- **Acceptance criteria:** fixture cases for positive `tabindex`, an order
  that jumps back, and ungrouped checkboxes; on the local with-bugs copy
  they find the present ones of 53 and 94; the clean copy passes.
- **Dependencies:** Gate A.

#### GEN-90 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** Tab order follows the reading order, and checkboxes and radio buttons that belong together are grouped (TFP-183, Phase 41 Decision 4; unit: `src/lib/generate/keyboard-grouping.test.ts` (the Standard suite's tests and tags; then the Comprehensive accessibility suite through the Playwright CLI on the comparison fixture); local copies: `benchmarks/2026-10-12-phase41-batch1/`)

**Expected result:** Two read-only tests per page, from one builder (`keyboardAndGroupingTests`, `src/lib/generate/comprehensive-accessibility.ts`), in Comprehensive accessibility after the axe scan and the field-name check, and in Standard's accessibility suite on every inspected page, as TFP-148 did for the scan. **Tab order** (WCAG 2.4.3; ISTQB: state transition): a form field with a positive tabindex fails, listing each field and its value; then Tab is pressed through the page (the page's focusable elements plus 5, at most 150) and a form's fields reached out of reading order (top to bottom; fields whose boxes share a row, left to right) fail, naming the jump back and the reading order. Focus moves; nothing is typed or sent. Not run, with the reason, without a form of two or more fields. **Grouping** (WCAG 1.3.1, technique H71; decision table): two or more visible checkboxes or radio buttons that share a `name`, or the heading just before them, fail unless they sit in a `<fieldset>` with a legend or a `role="group"`/`"radiogroup"` element with a name; each group is named once. Not run without such a group. **Proven on the fixture (decision table):** clean `/store` and `/store/register` pass both; `a11y-positive-tabindex` fails tab order naming "Email" (1) and the rest; `a11y-tab-order-jumps` (the name row laid out right to left) fails naming "First name" back to "Last name"; `a11y-ungrouped-choices` fails grouping naming the shared name "category" and both boxes; only GETs reached the server. **Local copies (2026-10-12):** with-bugs, Standard and Comprehensive alike: register fails tab order (bug 53: positive tabindex 1, 2, 5 to 11, and Tab from "E-mail address" back to "Date of birth"); home fails grouping (bug 94: category_id and brand_id, 10 each); the category page fails grouping (R19, shared with clean); contact and login fail on positive tabindex (R20, with-bugs only, outside the answer key). Clean: register, contact, login and forgot-password pass tab order; home passes grouping; the category page fails it (R19, real). **Output measured:** `check:template-unchanged` ebbe066 against this change: 120 of 166 identical; the 46 that differ (every input with the accessibility area) are identical once the two new tests per page are removed; 108 tests added (2 per inspected page).

### TFP-184 — Known-path probe and guessable ids

- **Priority:** P2 · **Labels:** `generate`, `security`
- **Scope:** Decision 5's known paths (Comprehensive security, read-only
  gate, one GET each, the list and its count in the report) and guessable
  ids (a finding).
- **Acceptance criteria:** on the local with-bugs copy they find the present
  ones of 80 and 82; the clean copy shows no known-path failure.
- **Dependencies:** Gate A.
- **Decided while building (Emil, 2026-10-12):**
  - **Where the probe goes:** the site's origin and every same-site origin
    its start page calls with XHR or fetch (the same host on any port, or
    the same registrable domain). Bug 80's log is on the Toolshop's API host
    (`localhost:8091`; hosted, `api.practicesoftwaretesting.com`), not on
    the site's. Rejected: the site's origin only, which leaves 80 out of
    reach.
  - **The list:** 19 paths - `.env`, `.git/HEAD`, `.git/config`,
    `.svn/entries`, `.DS_Store`, five backup and dump names, and
    `error.log`, `debug.log` and `laravel.log` under `/logs`, `/log` and
    `/storage/logs`. It includes the Toolshop's `/logs/laravel.log` as one
    case of the pattern, and the report says so. Rejected: generic names
    only, with no framework's log.
  - **Placement:** guessable ids run per page in Comprehensive security,
    like the probe; Standard's security area is unchanged. (TFP-185's check
    goes there too.)

#### GEN-91 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** Comprehensive security probes known paths that leak, once per run, and records guessable sequential ids per page (TFP-184, Phase 41 Decision 5; unit: `src/lib/generate/security-probes.test.ts` (the Comprehensive security suite through the Playwright CLI on the comparison fixture, behind the recording proxy), `src/lib/generate/standard-conformance.test.ts`; local copies: `benchmarks/2026-10-12-phase41-batch1/`)

**Expected result:** **Known-path probe** (`knownPathsTest`, `src/lib/generate/security-probes.ts`; error guessing; A01:2025, ASVS 5.0.0 13.4.1 and 13.4.7, copied from the pinned sources), its own describe after the missing-page probe: the run's first page is loaded and every same-site origin it calls with XHR or fetch is added to the site's (the same host on any port, or the same registrable domain); then one GET to each of the 19 paths per origin, redirects not followed. The title names the count and the list; a `probe` note names the origins. A path leaks when it answers 200 with a body that isn't an HTML document and has the content its name promises (a log's timestamped lines, `.env` assignments, `ref: refs/` in a HEAD, `[core]`, a zip's or gzip's magic, SQL statements), whatever its content type - so a single-page app's catch-all page is never a leak. A leak fails, naming the URL and the start of its contents. **Guessable ids** (`guessableIdsTest`; error guessing; A01:2025, no ASVS requirement: a passive run can't verify 8.2.2), per page: integer ids in the page's own address, its links and the requests it makes (path or hash route segments after a resource name, `id`/`*_id` parameters; `page`, `p`, versions and years excluded), two or more under one route, are a finding naming the route, the ids and OWASP WSTG-ATHZ-04, never a failure. Both read-only and Comprehensive only (owner decision, 2026-10-12); Standard's security area is unchanged. **Proven on the fixture (decision table):** clean: the probe passes, 19 GETs on the site's origin, no id finding; `security-log-on-api` (the home page calls its API on the fixture's own port, which alone serves `/logs/laravel.log`): the probe fails naming that origin's log, and both origins are probed; `security-catch-all` (200 and a page for every path): the probe passes; `security-sequential-ids`: `/store` carries `.../store/item/:id ... (1, 2, 3, 4, 5, ...)` as a finding and passes. Standard and Comprehensive still agree on every shared check (the conformance test now leaves out Comprehensive's own and counts them). **Local copies (2026-10-12):** with-bugs: the probe fails, `http://localhost:8091/logs/laravel.log answers 200 with its contents ("[2026-10-08 05:44:24] local.INFO: Fetching products ...")` (bug 80; the app's own origin answers its catch-all page and is not flagged); `/#/product/:id` ids are recorded on home, category and product (82). Clean: the probe passes on 4200 and 8091; no id finding on any of 8 pages. **Found while building:** the Toolshop sends its log as `text/html`, so judging "not a page" by content type missed it; it is judged by the body. The probe takes the site's origin from the loaded page, not the `baseURL` fixture. **Updated:** the passive-suite tests now count the guessable-id check per page and the known-path probe (`comprehensive-security.test.ts`, `src/lib/report/comprehensive.test.ts`), and their routed harness leaves the probe to the CLI tests, as it does the missing-page probe. **Output:** `check:template-unchanged` a8dfc03 against this change: 166 of 166 identical (Standard is unchanged).

### TFP-185 — API responses that expose undisplayed internal fields

- **Priority:** P2 · **Labels:** `generate`, `security`
- **Scope:** Decision 5's bug 75: read the API responses the page already
  fetches; report as a finding fields the page never displays whose names
  suggest internals.
- **Acceptance criteria:** on the local copies, the with-bugs field is
  reported and the clean response isn't; the rule is shown not to flag the
  clean site's ordinary fields.
- **Dependencies:** Gate A.

- **Batch 1 done, verified 2026-10-12 (Cowork):** TFP-181 (`7069078`),
  TFP-182 (`4fda321`), TFP-183 (`a8dfc03`), TFP-184 (`b43e14e`), TFP-185
  (`7b632cf`). On the local with-bugs copy the new checks find all 10
  present targets: 2, 27, 29, 40, 60 (failures), 53, 94 (failures), 80 (a
  failure: `GET http://localhost:8091/logs/laravel.log` answers 200), 82 and
  75 (findings: sequential ids; `stock` on `/products` items). The clean
  copy has no unlabelled failure or finding; R19 (ungrouped category
  checkboxes) fails on both and is labelled real. QUERY is RFC 10008.
  - **The evidence ran on working trees, not the final commits** (for
    example `ebbe066`, TFP-182 before its amend). TFP-188 measures on
    committed code only.
  - **Bug 80 needs a log file to exist.** with-bugs serves its log through
    an explicit route (`routes/api.php:43`); the file it served was written
    on 2026-10-08, before `compose.local.yml` sent logs to stderr. A fresh
    with-bugs copy may have no log, so the probe would miss a bug that is
    there. Before TFP-188: with-bugs keeps file logging (its override),
    and the start script confirms `/logs/laravel.log` answers.
    - **Done (2026-10-12), not yet verified:** file logging alone made every
      logging request answer 500 (php-fpm, uid 1000, can't append to the
      mounted folder's uid-82 file). The log now lives in a Docker volume
      over `storage/logs`, given to php-fpm's user once Testsmith's
      `composer` service, which re-owns it to uid 82, has exited. The start
      script then requires a line written since the start; measured, the
      start reports the newest line at 20:56:03 UTC for a 20:53 start, the
      API answers 200, and the 2026-10-08 log would have been rejected.

#### GEN-92 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** Comprehensive security records API fields with internal-sounding names that a page fetches and never shows (TFP-185, Phase 41 Decision 5; unit: `src/lib/generate/api-fields.test.ts` (the Comprehensive security suite through the Playwright CLI on the comparison fixture's `/store`), `comprehensive-security.test.ts`, `src/lib/report/comprehensive.test.ts`, `standard-conformance.test.ts`; local copies: `benchmarks/2026-10-12-phase41-batch1/`)

**Expected result:** `apiFieldsTest` (`src/lib/generate/api-fields.ts`; error guessing; A01:2025 via CWE-200, ASVS 5.0.0 15.3.1, copied from the pinned sources), per page, Comprehensive only (owner decision, 2026-10-12): it reads the JSON that the page's own same-site XHR and fetch requests bring back - each item's own fields (a response array, its `data` array, or the object), not nested objects - and records a finding for a field when its name has a word from a fixed list (stock, inventory, cost, wholesale, margin, profit, supplier, internal, secret, password, passwd, hash, salt, token, private, debug, an API key), its value is a number or a string (a yes/no flag such as `in_stock` is never judged), and the page never shows it (a string's value isn't in the visible text; a number isn't shown beside the field's name, as in "Stock: 12"). The finding names the request, the field, sample values and the page, never a failure. Read-only: nothing is sent. ASVS V15 is now in a passive run's reach (`asvs.ts`). **Proven on the fixture (decision table):** clean (`in_stock` only): no finding; `security-api-internal-fields`: `GET <origin>/api/store/products returns "stock" (12, 19, 26, ...) on its items, which /store never shows`; `security-api-internal-fields-shown` ("Stock: n" on each card): no finding; only GETs reached the server. **Local copies (2026-10-12):** with-bugs: `/products` items' `stock` recorded on home and category, and `/products/6` and its related products' on the product page (bug 75); no other field on 8 pages. Clean: no finding on 8 pages (its items carry `in_stock`, a flag, and no stock count). **Updated:** the passive-suite counts gain one check per page, and the conformance test counts it among Comprehensive's own. **Output:** Standard unchanged (`check:template-unchanged` runs at the end of the batch).

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
- **Decided while building (Emil, 2026-10-12):** Decision 1's "for buttons
  in one row, width" is dropped. On the fixture's clean page it reported
  two ordinary text-sized buttons ("Save" 46 px, "Share" 52 px), as it
  would on most toolbars. A button's width is compared as one component
  across pages instead (its share of its container), which is what finds
  58 and 66: the submit is 10% of its container on register and contact,
  50% on login and forgot-password. Rejected: keeping it for big gaps only,
  and keeping it as written.
- **Found while building:** across pages, a heading is one component only
  when it is a page title (`h1`) or has a class naming it (`card-title`).
  The clean Toolshop's bare `h3` is a form's title on login, register and
  contact (centred) and a section's on the product page (left), which the
  first version reported as one component differing.
- **For TFP-188:** the with-bugs Standard selection has `/#/chainsaws` and
  no rentals page, so bug 49 (rentals' card titles centred) is outside a
  Standard run's pages there; it is found when rentals is inspected
  (clean's selection has rentals). Phase 40's selection is not changed here.

#### GEN-93 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** Layout consistency, overlap and images that don't render (TFP-186, Phase 41 Decision 1; unit: `src/lib/generate/mock/layout.test.ts` (inspects the comparison fixture's `/gallery` and `/gallery/more`, generates a Standard usability suite and runs its four layout checks through the Playwright CLI); local copies: `benchmarks/2026-10-12-phase41-batch2/`)

**Expected result:** Usability tests (`buildLayoutTests`, `src/lib/generate/mock/layout.ts`), on every inspected page (`/` without page data): **consistent forms, lists and cards** (a finding; equivalence partitioning): within one form, its fields' font family, font size, left and top padding, and its labels' font family and size; within one list, its options' font family and size; within a set of three or more repeated cards, their titles' alignment and font, and a card whose image is hidden while at least two others show theirs. The odd one out is named with the value the others share ("\"Austria\" has font-size 13.3333px, where the other 247 have 16px"); with no majority every value is named. Not run without a form, list or set of cards. **No overlapping controls** (a failure; boundary value analysis): two visible links, buttons or fields whose boxes share more than 3 px both ways, neither inside the other (input groups' shared 1 px border is not an overlap). **Every image it loads** (a failure; error guessing): a visible image that finished loading and can't be decoded, named by its `src`. Once per run with two or more pages, **the same components look the same on every inspected page** (a finding; equivalence partitioning): page titles (`h1`) and headings with a component class (a bare `h3` is not one component), compared by alignment, font family and size; and a form's submit button, keyed by its classes (a `<button>` on one page, an `<input>` on another), by its share of its container's width. Each page's usual value is compared, and the values are named with their pages, most common first. Buttons in one row are not compared by width (owner decision, 2026-10-12). **Proven on the fixture (decision table: what is out of line):** the clean gallery passes with no finding; field padding, label font, option font, one card's alignment, a hidden card image, centred titles on the second page and its narrower submit each give exactly one finding, named; overlapping buttons and an image that doesn't load each fail only their own check; only GETs reached the server. **Local copies:** see `benchmarks/2026-10-12-phase41-batch2/README.md`. **Output measured:** `check:template-unchanged` 4f0df79 against this change: 134 of 166 identical; the 32 that differ (every input with the usability area) are identical once the layout helpers and the 124 new tests are removed (28 inputs without page data, 3 each; 4 with it, 10 each). The gate test's read-only count goes from 1196 to 1320.

### TFP-187 — Spelling of interface text

- **Priority:** P1 · **Labels:** `generate`, `content`
- **Scope:** Decision 2, with the dictionary's licence checked first.
- **Acceptance criteria:** fixture cases for a misspelt label, a brand name
  that isn't reported, and a page in another language named as not checked;
  on the local with-bugs copy it finds 31, 33, 34, 42 and 62 (54 is absent
  in this version); on the clean copy every finding is labelled.
- **Dependencies:** Gate A.
- **The dictionary, checked before building (Emil, 2026-10-12):**
  `dictionary-en` 4.0.0 (en_US) and `dictionary-en-gb` 3.0.0 (en_GB-ise),
  Hunspell files from SCOWL size 60, read with `nspell` 2.1.5 (MIT). Their
  licence files, read in full: SCOWL's permissive notices (Kevin Atkinson,
  Ispell's BSD licence, ENABLE, UKACD, WordNet, VarCon); no copyleft, no
  non-commercial clause; the notices must be kept, and UKACD asks that its
  notice be prominently displayed and its text included verbatim wherever
  the list ships. Used, with `THIRD_PARTY_NOTICES.md` carrying all three
  licences verbatim. Rejected: relying on the copies inside
  `node_modules`; looking for another list.
- **The rule, calibrated (Emil, 2026-10-12):** read as written, Decision 2
  reported about 40 words on the clean Toolshop - 37 parts of country names
  from the 248-option country list, "Unsplash" (the footer's photo credit),
  "nav" and "ngx" (aria-labels) - and no dictionary sees bug 62's "Massage",
  a real word. Adopted: words of four or more letters; a word known in
  another case is known; lists of 20 or more options and text in a
  `<footer>` are not read; an unknown word is a finding only when a
  dictionary suggestion is within edit distance 2; and a field's
  placeholder word within distance 2 of a word of its label (same first
  letter, not equal) is a finding. Rejected: sparing words used on every
  page unless within distance 1; keeping the wording and labelling the
  clean findings.
- **Found while building:** adding the GB word list to the US speller
  (`nspell.dictionary()`) left it accepting every word, "Contakt" included,
  so the check keeps two spellers; and `dictionary-en` 4 ships its files as
  `Uint8Array`s, which `nspell` 2 needs decoded to text.

- **Batch 2 done, verified 2026-10-13 (Cowork):** bug 80's log
  (`6897b1e`), batch 1's test types (`4f0df79`), TFP-186 (`085037f`), TFP-187
  (`9a9ac3b`), evidence on committed code (`094e574`, `src/` unchanged from
  `9a9ac3b`). On local with-bugs: TFP-186 finds 4, 19, 26 (a card's image
  hidden among 8 shown), 45 (a failure: 50 x 38 px overlap), 49, 58, 59, 63,
  66, 67; TFP-187 finds 31, 33, 34, 42, 62. The clean copy's one finding is
  "Unsplash" (T32), labelled.
  - **Scoring 49 in TFP-188:** with Phase 40's selection unchanged, with-bugs
    Standard has `/#/chainsaws`, not rentals, so 49 is scored as the runs
    fall, with the reason recorded (the check works; the page wasn't
    selected). The selection isn't tuned to the benchmark.
  - **T32 recurs** on any page crediting Unsplash under the calibrated rule;
    it's a finding, never a failure.

#### GEN-94 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** The spelling of interface text (TFP-187, Phase 41 Decision 2; unit: `src/lib/generate/mock/spelling.test.ts` (inspects the comparison fixture's `/words`, generates a Standard SEO/content suite and runs the check through the Playwright CLI); local copies: `benchmarks/2026-10-12-phase41-batch2/`)

**Expected result:** A content test per inspected page (`buildSpellingTests`, `src/lib/generate/mock/spelling.ts`; error guessing): it reads buttons, labels, placeholders, headings, link text, aria-labels and the options of lists shorter than 20, outside any `<footer>`, and checks each word of four or more letters (no capital after the first; hyphens joined) against `dictionary-en` and `dictionary-en-gb` through two `nspell` spellers, accents stripped, a word known in another case being known. An unknown word with a suggestion within edit distance 2 is a finding naming the word, the element and up to three suggestions (nearest first, then the longest shared start); one with nothing near is site vocabulary. A field's placeholder word within distance 2 of a word of its label, same first letter, not equal, is a finding too (a real-word slip). Not run when the page's `lang` isn't English (en, en-US, en-GB), naming it; a page with no `lang` is checked as English. The dictionaries load inside the test by name, as the axe scan does. Licences: `THIRD_PARTY_NOTICES.md`. **Proven on the fixture (decision table):** the clean page, which holds a list of 24 place names, a footer credit and a three-letter aria-label, has no finding; a misspelt heading gives `"Contakt" in the heading "Contakt us" on /words is not in the dictionary (en-US, en-GB); did you mean "Contact"?`; the placeholder "Your massage" under the label "Message" gives a finding naming both; `lang="de"` is Not run, naming it. **Local copies:** see `benchmarks/2026-10-12-phase41-batch2/README.md`. **Output measured:** `check:template-unchanged` 085037f against this change: 120 of 166 identical; the 46 that differ (every input with the SEO/content area) are identical once the spelling helpers and the 54 new tests are removed (42 inputs with one page, 4 with three). The gate test's read-only count goes from 1320 to 1374.

### TFP-188 — Re-score with the new checks (Gate B)

- **Priority:** P1 · **Labels:** `measurement`, `benchmark`
- **Scope:** Decision 6, on the local copies; then the hosted sites, beside
  the earlier scores.
- **Acceptance criteria:** Decision 6's keep rule applied to each check as
  written, kept, revised or dropped, and recorded either way; run times.
- **Dependencies:** TFP-181 to TFP-187.
- **Stop at Gate B.**
- **Done (2026-10-13), not yet verified.** Code under test `f3fcf9a` (`src/`
  as at `9a9ac3b`); evidence `benchmarks/2026-10-13-tfp188/`; the score and
  run times in `known-bug-benchmark-report-2026-10-06.md`, "Re-score with
  Phase 41's checks". **Local: 33 found, 0 hinted, 4 missed** (Gate A: 9, 4,
  24); **hosted: 32, 0, 5** (TFP-175: 9, 4, 24). Local Standard 1,235 s
  (with-bugs) and 1,049 s (clean); hosted with-bugs 1,816 s (see below).
  - **Decision 6's keep rule, check by check, on the local copies:**

    | Check | Present targets | Found | Clean copy | Outcome as written |
    | --- | --- | --- | --- | --- |
    | TFP-182 sort | 2 | 2 | passes | kept |
    | TFP-182 filter | 27 | 27 | passes | kept |
    | TFP-182 stepper | 40 | 40 | passes | kept |
    | TFP-182 option lists | 60 | 60 | passes | kept |
    | TFP-182 link destination | 29 | 29 | passes | kept (hosted: see T33 below) |
    | TFP-183 tab order | 53 | 53 | passes; R20 on with-bugs labelled | kept |
    | TFP-183 grouping | 94 | 94 | R19, real and labelled | kept |
    | TFP-184 known paths | 80 | 80 | passes | kept |
    | TFP-184 guessable ids | 82 | 82 | no finding | kept |
    | TFP-185 API fields | 75 | 75 | no finding | kept |
    | TFP-186 consistency | 4, 19, 26, 59, 63, 67 | all (4 on these loads) | no finding | kept |
    | TFP-186 overlap | 45 | 45 | passes | kept |
    | TFP-186 images | 26 (Decision 1) | none: Gate A moved 26 to the consistency check, as hidden, not broken | passes | **not met as written** (no present target of its own); it fails 28 and 30 on every with-bugs page, already found by older checks. Keep or drop is Emil's at Gate B |
    | TFP-186 across pages | 4, 49, 58, 66 | 4, 58, 66 | no finding | kept; **49 unreached**: present, but not on a selected page (Emil's ruling) |
    | TFP-187 spelling | 31, 33, 34, 42, 62 | all | T32, labelled | kept |
    | TFP-181 guard | (none) | - | no breach locally | kept locally; **hosted: T33** |

    Standard stays within 1,800 s on one worker on both local copies.
  - **Hosted, the guard breaches on Cloudflare's beacon (T33).** Following a
    header link, the hosted pages send `POST /cdn-cgi/rum?`; the guard aborts
    it and fails the link-destination check on both sites, which hides bug
    29 on hosted with-bugs. The risk was named in `7069078`. A revision -
    for example letting the browser's own beacons (Chromium's `ping`
    resource type) through - is for Emil at Gate B; nothing was changed.
  - **Hosted with-bugs Standard took 1,816 s,** 16 s over the limit Decision
    6 sets on the local copies: five older checks timed out on the slow host
    (198 s, U11); Phase 41's 59 Standard tests took 185 s.
  - **Found while running, fixed:** `f3fcf9a` - the start script now waits
    for Testsmith's composer service to end, however long (it took 10.5
    minutes once), before giving the log folder to php-fpm; `6897b1e`'s
    600 s cap had let composer's chown undo it.

## Recommended Execution Order

1. TFP-189 (small, first), then TFP-179 and TFP-180. **Gate A passed
   2026-10-08.**
2. Batch 1: TFP-181, TFP-182, TFP-183, TFP-184, TFP-185.
3. Batch 2: TFP-186, TFP-187.
4. TFP-188. **Gate B.**

Batch 1 verified 2026-10-12.

## Gates

### Gate A — Ground truth and baseline
**Passed 2026-10-08** (`8769970`): presence verdicts for all 28 targets;
the local baseline is 9 found, 4 hinted, 24 missed.
- Every target bug has a presence verdict from the local copies.
- Today's code is scored on both local copies.

### Gate B — Checks measured
**Passed 2026-10-13 (Emil)** on `f3fcf9a` / `02ab6e5` (verified in Cowork:
every run on `f3fcf9a`, the scoring rule unchanged since `91a7141`). Local:
33 found, 0 hinted, 4 missed (22 and 23 not visible in Chromium, 54 absent,
49 on a page the selection doesn't pick). Hosted: 32, 0, 5 (29 lost to the
guard breach below). 14 of 15 checks kept as written, and the guard.
- **The image-render check is kept (Emil, 2026-10-13)** though its own
  target (26) moved to the consistency check at Gate A: it catches an image
  that loads but can't display, which request checks miss, and adds no false
  failure on the clean copy.
- **The guard fails on site beacons (T33):** Cloudflare's `POST
  /cdn-cgi/rum` fires as a page navigates, so the link check fails as a
  breach on both hosted sites. Fixed by TFP-199
  (`run-evidence-sweep-backlog-2026-10-13.md`), before Phase 42.
- **Hosted with-bugs Standard took 1,816 s,** 16 s over; Decision 6's limit
  applies locally, and five older checks timed out on the slow host.
  Recorded for Phase 39's workers.
- TFP-181 to TFP-188 landed and independently verified.
- Decision 6's keep rule applied per check, locally and then on the hosted
  sites.
