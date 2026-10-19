# Real-Site Run Findings — TestForge Backlog (2026-10-01)

**Version:** 1.0
**Date:** 2026-10-01
**Status:** TFP-141/142/144 done and verified; TFP-143 closed; TFP-145 done (`0504f92`, `4d35b28`) and verified; TFP-152 done (`34622b0`, `b15714b`) and verified; TFP-151 and TFP-159 to TFP-161 done and verified; TFP-162 (`cefa24d`), TFP-163 (`be688d3`, `f4ed183`) and TFP-164 (`837de4f`) done and verified 2026-10-07. Every ticket here is closed (header updated 2026-10-19).

## Context

Running TestForge three times against a real WordPress site
(https://rizonetech.com/, read-only, build `899bdd9`) surfaced four issues
in TestForge itself, separate from the site's own defects. Evidence is in
`benchmarks/2026-10-01-rizonetech/` (run ids: Standard `5ce88c9c`, passive
security `4134252c`, accessibility `a3eb621d`).

These are TestForge template/consistency faults, not rizonetech.com's
problems. They are logged here rather than fixed in place because they were
found in an exploratory run, not while building a ticket; the standing
execution policy's "fix defects in-ticket" applies once each is picked up.

TFP-140 was the last issued ticket.

## Backlog

### TFP-141 — The anchor-target check must not crash on `href="#"`

- **Phase:** 35 (follow-up) · **Priority:** P1
- **Suggested labels:** `bug`, `generate`, `functional`
- **Problem it solves:** the "anchor links point to existing in-page
  targets" check (TFFU-019 and siblings) crashed on 5 of 5 pages with
  `locator.count: Unexpected token "#" while parsing css selector "#"`. It
  reads a link's `href="#"` and passes `#` straight to a CSS locator, which
  is invalid. `href="#"` placeholder links are common, so this fails against
  ordinary sites and reports a tool crash as a site failure.
- **Scope:**
  - In the anchor-target check, treat `href="#"` and `href=""` as "no
    in-page target to resolve", not as a selector.
  - Escape or reject any fragment that is not a valid id before building the
    locator.
- **Deliverables:**
  - The fix in the Standard functional template.
  - A fixture page with an `href="#"` link and an empty-fragment link.
  - `TEST_PLAN.md` case.
- **Acceptance criteria:**
  - On a page with an `href="#"` link, the check completes and reports the
    link as having no in-page target, with no thrown error.
  - The fixture case passes; the template's output on fixed inputs is
    measured unchanged except for this check.
- **Dependencies:** None.

### TFP-142 — The hover and HTTPS/SSL checks must not hang for 30 s per page

- **Phase:** 35 (follow-up) · **Priority:** P2
- **Suggested labels:** `bug`, `generate`, `functional`
- **Problem it solves:** the hover-state check (TFFU-014 and siblings) timed
  out at 30 s on 5 of 5 pages, and the HTTPS/SSL check on 3 pages. A per-page
  check timing out on every page is almost certainly a wait that never
  settles, not a slow site — and these timeouts pushed the Standard run to
  1,766 s against its 1,800 s budget.
- **Scope:**
  - Find what each check waits on and why it never settles on a normal page.
  - Give each an explicit, shorter timeout with a stated reason, so a hang is
    reported as a check fault, not a site failure.
- **Deliverables:**
  - The fix, and a `TEST_PLAN.md` case covering the timeout-reason path.
- **Acceptance criteria:**
  - On a healthy page, both checks complete well under the per-test timeout.
  - A deliberately stalled dependency is reported as the check's own timeout
    with its reason, not as a plain 30 s failure.
- **Dependencies:** None.

### TFP-143 — Resolve the double-reporting between the Standard accessible-name checks and the axe scan

- **Phase:** 35 (follow-up) · **Priority:** P3
- **Suggested labels:** `enhancement`, `generate`, `accessibility`
- **Problem it solves:** the Standard run's hand-written accessible-name
  checks (TFAC-008/009/018/038, located by `getByText`) and the Comprehensive
  axe scan's `link-name` rule report the same missing-name links, and the
  `getByText` version is the noisier of the two. On a Comprehensive run the
  two overlap.
- **Scope:**
  - Decide one source of truth for accessible-name coverage when a
    Comprehensive accessibility run is available (likely the axe scan).
  - Either defer the Standard checks there, or de-duplicate the report so one
    issue isn't counted twice.
- **Deliverables:**
  - The decision recorded, the change, and a `TEST_PLAN.md` case.
- **Acceptance criteria:**
  - A single missing-name link produces one reported issue, not two, on a
    Comprehensive accessibility run.
- **Dependencies:** None. Judgement call for Emil and Martin before building.
- **Resolution (2026-10-01): closed, already met; not built.** Measured in
  Cowork: a Comprehensive accessibility suite runs only the axe scan and the
  field-name check, so the Standard checks this ticket names
  (TFAC-008/009/018/038) never run there — axe is already the single source
  for link names. The acceptance criterion holds as it stands. The one axe
  overlap (`image-alt` 1.1.1 and `link-name` 2.4.4 on the same image link) is
  two distinct WCAG failures; merging them would hide a real one, so they are
  left separate. The real duplication the ticket gestured at lives in
  **Standard** runs, which this ticket's criterion never covered; it moves to
  TFP-145.

### TFP-144 — One cookie-scope rule across the Standard and passive-security checks

- **Phase:** 35 (follow-up) · **Priority:** P2
- **Suggested labels:** `bug`, `generate`, `security`
- **Problem it solves:** the two runs disagree on the same site. The Standard
  security check flagged all 6 cookies for missing HttpOnly/Secure; the
  passive-security check flagged none, because it only inspects
  session-named cookies. A reader comparing the two reports sees a
  contradiction.
- **Scope:**
  - Choose one rule for which cookies are in scope for the HttpOnly/Secure
    check (all cookies, or session-named only), with the reason.
  - Apply it in both the Standard and the passive-security paths.
- **Deliverables:**
  - The shared rule, applied in both paths, and a `TEST_PLAN.md` case that
    asserts the two paths agree on the same fixture cookies.
- **Acceptance criteria:**
  - On a fixture with a mix of session and non-session cookies lacking the
    flags, the Standard and passive-security runs report the same set.
- **Dependencies:** None.

### TFP-145 — Standard accessible-name checks fail links that have a name

- **Phase:** 35 (follow-up) · **Priority:** P2 (raised from P3 on
  2026-10-02: measurement shows false failures, not only duplication)
- **Suggested labels:** `bug`, `generate`, `accessibility`
- **Problem it solves:** split out of TFP-143, and re-scoped after reading
  the 2026-10-01 rizonetech.com evidence (`standard-suite.spec.ts`,
  `standard-run.json`, `content-profile.json`). Two causes, both in how the
  Standard accessible-name checks locate their element:
  1. **Text locators land on the wrong element.** Some checks use
     `getByRole('link', { name })` and pass. Others use
     `getByText(text, { exact: true }).first()` and fail with an empty
     accessible name: TFAC-008 "Home", TFAC-009 "Services", TFAC-018 and
     TFAC-038 "AI". `getByText` resolves to the element holding the text,
     most likely the `<span>` inside the menu `<a>` in WordPress menu markup.
     A span has no accessible name, so a named link is reported as unnamed.
     The same "AI" link passes TFAC-005 (by role) and fails TFAC-018 (by
     text).
  2. **Same-named elements all test the first match.** The page data holds
     four distinct "AI" links: the nav link and a hidden copy (`/ai-search/`),
     a category filter and a post's category tag (`/ai/`). Each check ends in
     `.first()`, so four checks meant for four elements test one.
- **Scope:**
  - Locate each check's element by its recorded role and name, or resolve a
    text match to its closest interactive ancestor, so the check reads the
    link's accessible name, not a child's.
  - Scope same-named elements by what the page data already records (`href`
    / `rawHref`, `containerLabel`) instead of `.first()`. Elements that are
    truly identical (same name, target and container) get one check.
  - Find out why the generator chooses `getByText` for some elements and
    `getByRole` for others, and record it in the commit.
- **Deliverables:**
  - The fix in the Standard accessibility template.
  - A fixture page with: a menu link whose text sits in a child `<span>`;
    two same-text links to different targets; and a genuinely unnamed link
    (an `<img>` with no `alt` inside an `<a>`).
  - `TEST_PLAN.md` case.
- **Acceptance criteria:**
  - On the fixture, `<a href="/"><span>Home</span></a>` passes its
    accessible-name check.
  - The genuinely unnamed link still fails, naming the element.
  - Two same-text links to different targets each test their own element
    (shown by a failure on one not failing the other).
  - On the saved rizonetech.com inputs, TFAC-008, 009, 018 and 038 no longer
    fail.
  - `npm run check:template-unchanged` shows only the accessible-name
    checks changed.
- **Dependencies:** None.
- **Verification (2026-10-05, Cowork), `0504f92`:**
  - **Re-measured here.** `check:template-unchanged afe38a1 0504f92` gives
    162 of 166 identical. Split into tests, the 4 that differ change only
    TFAC-002 to 005, the accessible-name tests; headers and titles are
    identical. tsc is clean, and ESLint is clean on the changed files.
    `accessible-names.test.ts` (non-browser case) and the golden-output test
    pass.
  - **Not checkable here, measured by Code on Emil's machine:** the
    real-browser case, the fixture's `/names` run (7 passed, 2 failed), the
    live rizonetech.com run (36/4 to 40/0) and the full unit suite
    (423/423). The VM has no Chromium and stops runs over 3 minutes.
  - **Criteria 1, 2, 4 and 5 met. Criterion 3 met for the measured cases,
    with one gap, found by reading introspection's code:** introspection
    drops a link that repeats another's URL, text and container, but the
    check counts its position among every same-URL, same-text link in the
    page. On a page with a desktop menu "Home", a hidden mobile copy in the
    same container and a footer "Home", the footer check lands on the hidden
    copy and fails a named link.
- **Follow-up, decided by Emil on 2026-10-05:** a second commit in this
  ticket, before anything is pushed.
  - The check counts a link's position only among links whose visibility
    matches what introspection recorded, in the recorded data and in the
    page.
  - A real-browser case reproduces the gap first: a visible menu link, a
    hidden copy in the same container, and a visible footer copy. It fails
    on `0504f92` and passes after the fix.
  - Template output is measured against `0504f92`: only the accessible-name
    tests change.
  - Rejected: recording each link's exact position at introspection. It is
    more precise, but it changes introspection, and saved page data would
    still need this path.
- **Follow-up done, `4d35b28`, verified 2026-10-05 in Cowork:**
  - **Re-measured here.** `check:template-unchanged 0504f92 4d35b28` gives
    162 of 166 identical. In the 4 that differ, only TFAC-002 to 005
    change. The non-browser case and the golden-output test pass.
  - **Measured by Code on Emil's machine:** the hidden-duplicate case fails
    on `0504f92` and passes on `4d35b28`; unit suite 424/424. On the saved
    rizonetech.com page data no visible link's position changes, so the live
    40/40 from `0504f92` stands for the visible checks. Only hidden copies
    move, and their checks only test that the link is attached.
  - **Known limitation, accepted:** when a hidden copy comes before its
    visible link in the same container, introspection keeps the hidden one
    and drops the visible one. A later same-named visible link's check then
    lands on the first visible link. That link is named, so the check passes:
    one link is tested twice and another not at all. Nothing fails wrongly.
    Recorded in the commit; not ticketed.

### TFP-151 — Accessible-name checks for buttons and other non-link elements land on a child element

- **Phase:** after Phase 38 · **Priority:** P3
- **Suggested labels:** `bug`, `generate`, `accessibility`
- **Problem it solves:** TFP-145 fixed links only. A button, or any other
  non-link element, without an id or label is still located with
  `getByText(text, { exact: true }).first()`. When its text sits in a child
  `<span>`, the check reads the span's name and fails a named button. Same-text
  elements still all test the first match.
- **Also (T23, practicesoftwaretesting.com, TFP-150):** the check asked a
  plain `<div>` with no role for an accessible name. A generic element has
  none to give, so asking is the check's mistake. The check must not ask an
  element with no role for a name.
- **Scope:**
  - Apply TFP-145's approach to buttons and the other element types the
    accessible-name check covers: find the element itself by what
    introspection recorded, not the element holding its text.
  - Leave `buildLocatorExpression` and the introspection name chain as they
    are, unless a measured case shows that's not enough.
- **Deliverables:**
  - The fix, a real-browser case and a `TEST_PLAN.md` case.
- **Acceptance criteria:**
  - `<button><span>Save</span></button>` passes its accessible-name check.
  - An icon-only button with no name fails, naming the element.
  - Two same-text buttons each test their own element.
  - `npm run check:template-unchanged` shows only the accessible-name
    checks changed.
- **Dependencies:** Phase 38 Gate B, since TFP-148 changes the same
  accessibility area.
- **Done, `bf9cc36`, verified 2026-10-06 (Cowork):**
  `check:template-unchanged 91222c5 bf9cc36` gives 166 of 166 identical. No
  fixed input generates a button or form name check.
  - Accepted: the actionable-elements golden file changes in its
    `signup-form` check. A form with an id but no name has no role, so the
    check is now Not run with its reason (T23).

### TFP-152 — The accessible-name check passes an image link that has no name

- **Phase:** 35 (follow-up) · **Priority:** P2
- **Suggested labels:** `bug`, `generate`, `accessibility`
- **Problem it solves:** on rizonetech.com, TFAC-007 (the logo link) passes,
  while axe's `link-name` rule flags the same link. Its only content is an
  image with `alt=""` and a `title`.
  - **The standard says axe is right.** HTML-AAM 4.1.10 (img Element
    Accessible Name Computation, checked 2026-10-05) uses the `alt`
    attribute "even if its value ... is the empty string", says such an
    image "is mapped to the presentation role. It has no accessible name",
    and uses `title` only "if ... there is no alt attribute". So the link
    has no accessible name.
  - **Why the check passes:** Playwright 1.59.1 departs from that rule. Its
    role code makes an `alt=""` image presentational only when it has no
    `title`, and its name code falls back to the `title` when `alt` is
    empty. `toHaveAccessibleName` therefore finds a name.
  - This is a false pass: the check says a link is named when assistive
    technology following the standard gets no name.
- **Scope:**
  - Confirm on the live page that the `title` is on the `<img>`, not the
    `<a>`. A `title` on the link itself is a valid name (accname step 2I),
    and then Playwright is right.
  - Record what Chromium's own accessibility tree gives the link (CDP
    `Accessibility.getPartialAXTree`), as evidence only. The verdict follows
    HTML-AAM either way, decided before measuring.
  - Make the check fail a link whose only name comes from the `title` of an
    `alt=""` image, citing HTML-AAM 4.1.10 in the message. **Approach
    decided by Emil on 2026-10-05: the standard decides, not any one tool.**
  - Rejected: reading every name from Chromium's tree through CDP. If
    Chromium also names the link from the `title`, the false pass would
    stay. It would also tie generated suites to Chromium and change every
    accessible-name check.
  - Other places where Playwright departs from the standard are not covered
    by this rule. Once TFP-148 adds the axe scan to the Standard run, a
    disagreement between axe and this check shows up in the report.
- **Deliverables:**
  - The fix, a real-browser case and a `TEST_PLAN.md` case.
  - The TFAC-007 verdict in `docs/decisions/data/labelled-failures.md` as a
    template error: a false pass.
- **Acceptance criteria:**
  - `<a href="/"><img alt="" title="Home"></a>` fails its accessible-name
    check, naming the link and HTML-AAM 4.1.10.
  - `<a href="/" title="Home"><img alt=""></a>` and
    `<a href="/"><img alt="Home"></a>` pass.
  - `npm run check:template-unchanged` shows only the accessible-name
    checks changed.
- **Dependencies:** the TFP-145 follow-up. To land before Phase 38's
  TFP-148, so the Standard check and axe agree when they meet.
- **Verification (2026-10-06, Cowork), `34622b0`:**
  - **Re-measured here.** `check:template-unchanged cdec8e0 34622b0` gives
    162 of 166 identical. Split into tests, the 4 that differ change only
    TFAC-002 to 005, the accessible-name tests; headers and titles are
    identical.
  - **Live evidence, measured by Code** (`benchmarks/2026-10-05-tfp152-logo-link/`):
    the `title` is on the `<img alt="">`, not the link. Playwright names the
    link from it, and Chromium 147's own accessibility tree gives it the name
    `""`. So the standard and Chrome agree, and Playwright is the one that
    differs. On rizonetech.com, `/` gives 39 passed and 1 failed (TFAC-007).
    Unit suite 437/437. Labelled as T18, the set's first false pass.
  - **Accepted:**
    - the rule applies to every element the check covers, not only links,
      because the rule is about the image;
    - the check removes the image's `title` in the page before reading the
      name. Each test loads its own page, and nothing is sent to the site.
  - **Wording:** the ticket says TFAC-007 "passes" on the logo. On
    2026-10-01 TFAC-007 tested the "Skip to content" link (`a[href]`
    first). The false pass on the logo dates from `0504f92`, as T18 records.
  - **Fix before the push, in this ticket:** the check finds images with
    `img[alt=""]`, so it misses an `alt` that is only whitespace, such as
    `alt=" "`. HTML-AAM 4.1.10 treats an `alt` that is empty "when trimmed
    of whitespace" the same way. Playwright 1.59.1 treats `alt=" "` as an
    image and falls back to the `title`, so `<a><img alt=" " title="Home"></a>`
    still passes falsely. The check must match any `img` whose `alt` is
    present and empty after trimming, with a real-browser case for
    `alt=" "`.
- **Follow-up done, `b15714b`, verified 2026-10-06 in Cowork:**
  `check:template-unchanged 34622b0 b15714b` gives 162 of 166 identical,
  and only the Accessibility block changes. The `alt=" "` case is measured
  by Code: a false pass on `34622b0`, a failure now.

### TFP-159 — Link checks expect links in closed menus to be visible

- **Phase:** after Phase 38 · **Priority:** P2
- **Suggested labels:** `bug`, `generate`, `functional`
- **Problem it solves:** on practicesoftwaretesting.com (TFP-150, T19 and
  T20) 16 checks failed healthy links:
  - **T19, 15 checks:** "Hand Tools" sits in the closed "Categories" dropdown,
    and the link-health, link-type and keyboard checks expect it visible.
  - **T20, 1 check:** at 390 px, "Home" sits behind the collapsed navbar
    toggle.
- **Scope:**
  - A link inside a closed menu or a collapsed navbar is checked as what it
    is. **Approach decided by Emil on 2026-10-06:**
    - **Link health and link type are independent of the menu.** They are
      checked from the link's own `href` and its presence in the page,
      without requiring it to be visible. They don't wait on the keyboard or
      mouse checks, so a broken menu never hides a dead link, and links in a
      broken menu are still checked.
    - **The keyboard and responsive checks open the menu or toggle first.**
      Opening it is a read-only interaction (Phase 38 Decision 1). If the
      link still isn't visible, the check fails, naming the menu.
    - **The two are linked in the report.** When a menu couldn't be opened,
      each link in it that passed its health check gets a finding: "healthy
      by its address, but users can't reach it: the '<menu>' menu didn't
      open".
    - Rejected: making the health check wait on the menu checks. One
      failure would cover two causes, and links behind a broken menu would
      go unchecked.
  - ISTQB technique: decision table (visible, in a closed menu, behind a
    toggle).
- **Deliverables:** the fix, a fixture page with a closed dropdown and a
  collapsed navbar, and `TEST_PLAN.md` cases.
- **Acceptance criteria:**
  - On the fixture, a healthy link in a closed dropdown passes link health
    and link type.
  - The keyboard check opens the menu and passes. A link that stays hidden
    after opening fails, naming the menu.
  - With the menu's toggle broken on the fixture, the keyboard check fails
    naming the menu, the link's health check still passes, and it carries
    the "users can't reach it" finding.
  - At 390 px, a link behind a working toggle passes.
  - `npm run check:template-unchanged` shows only these checks changed.
- **Dependencies:** Phase 38 Gate B.
- **Done, `6852538`, verified 2026-10-06 (Cowork):**
  `check:template-unchanged 882a47d 6852538` gives 162 of 166 identical.
  The 4 that differ change only TFRM-001, the responsive check; no fixed
  input has a hidden link. Measured by Code: the new case reproduces T19
  and T20 on the old code, and the unit suite gives 445/445.
  - Accepted: Code applies Emil's ARIA-then-sibling rule one level at a
    time, nearest hidden ancestor first. Trying ARIA on every ancestor first
    picked a far toggle over the nearer menu button.

### TFP-160 — Form checks locate a form by its joined label text

- **Phase:** after Phase 38 · **Priority:** P2
- **Suggested labels:** `bug`, `generate`, `functional`
- **Problem it solves:** on practicesoftwaretesting.com (TFP-150, T21 and
  T22) 5 form checks found the wrong element or none:
  - **T21:** a sort `<select>` matched its own options' joined text;
  - **T22:** the contact and login forms were looked up by all their labels
    joined ("Email address *Password *"), which no single element holds.
- **Scope:**
  - Locate each form the way TFP-145 locates links: the `<form>` element
    itself, by what introspection recorded (its action, its fields), not by
    text.
  - ISTQB technique: error guessing, from the two recorded failures.
- **Deliverables:** the fix, fixture cases for a form with several labelled
  fields and a lone `<select>`, and `TEST_PLAN.md` cases.
- **Acceptance criteria:**
  - On the fixture, the multi-field form and the `<select>` form each find
    their own `<form>` and count its fields correctly.
  - `npm run check:template-unchanged` shows only the form checks changed.
- **Dependencies:** Phase 38 Gate B.
- **Done, `91222c5`, verified 2026-10-06 (Cowork):**
  `check:template-unchanged 6852538 91222c5` gives 162 of 166 identical.
  The 4 that differ change only the two `[form]` checks (TFFU-004 and
  TFFU-008), and no test is added.
  - Introspection now also records each form's action, method and fields.
    That adds to the page data; nothing existing changes.
  - Accepted: a form with an id keeps its id-based check, as TFP-145 does
    for links.

### TFP-161 — The orphan-page check judges pages it never loaded

- **Phase:** after Phase 38 · **Priority:** P3
- **Suggested labels:** `bug`, `generate`, `seo`
- **Problem it solves:** on the-internet (TFP-150 re-run, T24), inspection
  couldn't load `/`, the page that links to every example. Every other page
  then looked unlinked and failed as an orphan.
- **Scope:**
  - The check counts inbound links only among pages that were actually
    inspected. When pages failed to load, it says which ones. A page with
    no inbound link among the loaded pages is a finding naming those
    missing pages, not a failure.
  - When the start page itself wasn't loaded, the check is Not run, with
    that reason.
- **Deliverables:** the fix, a fixture case where the hub page fails to
  load, and `TEST_PLAN.md` cases.
- **Acceptance criteria:**
  - With the hub page unreachable, no page fails as an orphan. The check is
    Not run, naming the hub page.
  - With every page loaded, a genuinely unlinked page still fails.
- **Dependencies:** Phase 38 Gate B.
- **Done, `f4bb043`, verified 2026-10-06 (Cowork):**
  `check:template-unchanged bf9cc36 f4bb043` gives 166 of 166 identical.
  - Saved page data has no `requestedPaths`, so old profiles keep the old
    check, and only new inspections get the fix.
  - Accepted: a page's links to itself (`#top`) no longer count as inbound
    links, as the check's title implies.

### TFP-162 — Hidden elements in the remaining checks

- **Phase:** after TFP-159 · **Priority:** P2
- **Suggested labels:** `bug`, `generate`, `functional`
- **Problem it solves:** found while building TFP-159 and TFP-151.
  - In deep mode, the "navigation destination" check still requires a link
    in a closed menu to be visible.
  - In the form and name checks, a hidden button is looked up with
    `getByRole`, which only finds elements in the accessibility tree, so it
    never finds the button.
- **Scope:** apply TFP-159's approach to both. The approach is decided:
  check from the element itself, open the menu first only where the check
  is about reaching the element.
- **Deliverables:** the fix, fixture cases, `TEST_PLAN.md` cases.
- **Acceptance criteria:**
  - On the fixture, a link in a closed menu passes the deep-mode
    destination check.
  - A hidden button is found and checked as itself.
  - `check:template-unchanged` shows only these checks changed.
- **Dependencies:** none.
- **Done, `cefa24d`, verified 2026-10-07 (Cowork)**, in the batch with TFP-177.

### TFP-163 — Introspection misses or merges some controls

- **Phase:** after TFP-159 · **Priority:** P2
- **Suggested labels:** `bug`, `introspect`, `accessibility`
- **Problem it solves:** found while building TFP-151.
  - **Every `<input>` gets the role `textbox`,** so a labelled
    `type="search"` field (role `searchbox`) is never found by role.
  - **An icon-only button with no text, label or id isn't recorded,** so it
    gets no name check. Toolshop's show-password toggle (R10) is one; only
    the axe scan catches it.
  - **Same-text buttons under the same heading are merged into one
    record,** so only the first is checked. It's the same deduplication
    TFP-145 met for links.
- **Scope:**
  - Roles follow the input type, as the ARIA in HTML mapping sets them.
  - Unnamed icon-only buttons are recorded, with their position.
  - Same-text buttons are kept apart by position, as TFP-145 did for links.

  Each of these changes the saved page data, so measure on the fixed inputs
  and on fresh inspections.
- **Deliverables:** the fix, fixture cases, `TEST_PLAN.md` cases.
- **Acceptance criteria:**
  - On the fixture, a labelled search field is found and checked.
  - An icon-only unnamed button fails its name check.
  - Two same-text buttons each test their own element.
- **Dependencies:** none. ISTQB technique: equivalence partitioning, by input
  type.
- **Done, `be688d3`, `f4ed183`, verified 2026-10-07 (Cowork)**, in the batch with TFP-177.

### TFP-164 — The visible download-link check's pattern lost its escaped dot

- **Phase:** after TFP-159 · **Priority:** P3
- **Suggested labels:** `bug`, `generate`
- **Problem it solves:** in `coverage-tests.ts` (since 2026-08-28), the
  pattern is written as `\.` inside a template string, which drops the
  backslash, so the generated
  test gets `/.(pdf|doc|…)…$/i`. The `.` there matches any character, so
  `…/getpdf` counts as a download. The hidden-link path TFP-159 added
  escapes it correctly.
- **Scope:** emit `\.` in the generated pattern. Add a unit case: a link
  ending `xpdf` with no dot is not a download.
- **Acceptance criteria:**
  - The generated pattern contains `\.(pdf`.
  - `check:template-unchanged` shows only the download check changed.
- **Dependencies:** none.

## Recommended Execution Order

1. TFP-141 (a crash; highest value). **Done, `32e8eae`, verified.**
2. TFP-142. **Done, `6c484de`, verified.**
3. TFP-144. **Done, `4a81655`, verified.**
4. TFP-143. **Closed 2026-10-01, already met — see its Resolution; not built.**
5. TFP-145 (split from TFP-143; re-scoped 2026-10-02 to the false failures).
   **Done, `0504f92` and follow-up `4d35b28`, verified 2026-10-05.**
6. TFP-152, after Phase 38's TFP-146 and before its TFP-148. **Done, `34622b0`
   and follow-up `b15714b`, verified 2026-10-06.**
7. TFP-151, after Phase 38 Gate B (now also covers T23).
8. TFP-159, TFP-160 and TFP-161, after Phase 38 Gate B, in any order.
   **Done (`6852538`, `91222c5`, `f4bb043`), with TFP-151 (`bf9cc36`),
   verified 2026-10-06.**
9. TFP-162, TFP-163 and TFP-164, raised while building them. **Done
   (`cefa24d`; `be688d3`, `f4ed183`; `837de4f`), verified 2026-10-07.**

## Suggested Milestone Gate
- **Done, `837de4f`, verified 2026-10-07 (Cowork)**, in the batch with TFP-177.

### Gate — Real-site noise removed
- **Met 2026-10-01.** TFP-141, TFP-142 and TFP-144 landed and independently
  verified in Cowork, with the template's output on fixed inputs measured
  unchanged apart from the named checks (166 / 164 / 152 identical, every
  differing input changed only in its named check). TFP-143 closed as
  already met. TFP-145 split off and left in the backlog.
