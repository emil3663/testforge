# Real-Site Run Findings — TestForge Backlog (2026-10-01)

**Version:** 1.0
**Date:** 2026-10-01
**Status:** TFP-141/142/144 done and verified; TFP-143 closed; TFP-145 open (2026-10-01)

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

## Recommended Execution Order

1. TFP-141 (a crash; highest value). **Done, `32e8eae`, verified.**
2. TFP-142. **Done, `6c484de`, verified.**
3. TFP-144. **Done, `4a81655`, verified.**
4. TFP-143. **Closed 2026-10-01, already met — see its Resolution; not built.**
5. TFP-145 (split from TFP-143; re-scoped 2026-10-02 to the false failures).

## Suggested Milestone Gate

### Gate — Real-site noise removed
- **Met 2026-10-01.** TFP-141, TFP-142 and TFP-144 landed and independently
  verified in Cowork, with the template's output on fixed inputs measured
  unchanged apart from the named checks (166 / 164 / 152 identical, every
  differing input changed only in its named check). TFP-143 closed as
  already met. TFP-145 split off and left in the backlog.
