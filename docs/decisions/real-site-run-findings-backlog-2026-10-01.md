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

#### GEN-63 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** The anchor-target check never crashes on href="#" (TFP-141; unit: `src/lib/generate/mock/link-audits/anchor-target.test.ts` (real browser, through the Playwright CLI); fixture: `/anchors`)

**Expected result:** On rizonetech.com (run `5ce88c9c`, 2026-10-01) the check "anchor links point to existing in-page targets" crashed on 5 of 5 pages: it passed each link's href to `page.locator`, so `href="#"` became the CSS selector `#` ("Unexpected token \"#\" while parsing css selector") - a tool crash reported as a site failure. The target is now looked up in the page by id, or by name, with the fragment URL-decoded; no selector is built from an href. An empty fragment (`#`) is a named finding - 'link "Menu" has href="#", which points at no in-page target (a placeholder link)' - and not a failure; `#top` passes, since browsers scroll to the top for it with no such element. A real missing target still fails, as "Anchor target missing for #<id>". **Proven in a real browser:** a page with `#`, `#section`, `#top` and an encoded `#caf%C3%A9` passes with the one finding; `#missing` fails by name, never with a selector error; both fail on the previous code. **Fixture:** a new `/anchors` page (not linked from the nav) with `href="#"`, a real target and `#top`; TestForge's own inspector finds them and the generated check passes with the placeholder finding. The fixture's existing pages answer identically (6 of 6). **Output measured:** `check:template-unchanged` gives 166 of 166 identical - no fixed input reaches this check - so it was also measured on the rizonetech.com page data (fast and deep): only the 5 anchor tests' bodies change, nothing else in either suite.

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

#### GEN-64 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** The hover-state and HTTPS/SSL link checks bound their own waits and name what they could not check (TFP-142; unit: `src/lib/generate/mock/link-audits/link-check-timeouts.test.ts` (real browser, through the Playwright CLI))

**Expected result:** On rizonetech.com (run `5ce88c9c`, 2026-10-01) the hover check hit the 30 s test timeout on 5 of 5 pages - `hover()` retried forever on a skip link parked off-screen ("outside of the viewport") - and the HTTPS/SSL check on 3, requesting every secure link in turn (59 on one page, many repeated) at up to 15 s each. **Hover:** each link gets 2 s and the check 15 s; a link that can't be hovered is named with the reason - "links that could not be hovered, so their cursor was not checked: #content (outside of the viewport)" - and links left when the budget ends are a finding ("N of M links not hovered: the check stops after 15 s"). A hovered link without a pointer cursor still fails. **HTTPS/SSL:** each distinct URL is requested once, for up to 5 s, and the check stops after 20 s; a URL that can't be reached is named with its reason ("no answer within 5 s", "getaddrinfo ENOTFOUND ...") - reachability is link health's job - and the ones left when the budget ends are named. A link marked secure that is not https, or a request that ends on http, still fails. **Proven in a real browser:** an off-screen skip link passes in seconds with the named finding (timed out at 30 s on the previous code); a server that accepts and never answers, listed twice, plus an unresolvable host passes in under 15 s with one finding naming both and their reasons, and the stalled URL is requested once (failed on the previous code). **Live, rizonetech.com, one worker:** all 10 checks pass - hover 20 to 22 s (15 s budget plus the page load), HTTPS/SSL 4.7 to 12.5 s; `cnvrg.io` is named as ENOTFOUND. **Output measured:** `check:template-unchanged` gives 164 of 166 identical; the 2 that differ (page-data, no areas, fast and deep) differ only in the hover test. On the rizonetech.com page data (fast and deep) only the 5 hover and 5 HTTPS/SSL tests change.

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

#### GEN-65 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** The Standard and passive-security checks flag the same cookies for missing HttpOnly/Secure (TFP-144; unit: `src/lib/generate/mock/cookie-scope.test.ts` (real browser, through the Playwright CLI); fixture: `security-mixed-cookies`)

**Expected result:** On rizonetech.com (2026-10-01) the Standard security check named 6 cookies for missing HttpOnly and Comprehensive passive security none, on the same site: the Standard check took every cookie the site set, passive security only those named like a session. **Rule:** in scope are the site's own cookies named like a session (`SESSION_COOKIE_NAME`, the rule passive security and the cookie/session check already use, Phase 34 Decision 3). All 6 rizonetech.com cookies were analytics or consent cookies (`_clck`, `_clsk`, `_fbp`, `tk_ai`, `FCCDCF`, `FCNEC`) that their own scripts must read, so HttpOnly is not theirs to have. The Standard check is renamed "session cookies set by the site carry protective flags (recorded as findings)", names each as 'session cookie "<name>" has no ...', and with no session-named cookie on the landing page is Not run with the reason ("no session cookie on the landing page (N cookie(s) set by the site, none named like a session), so there is nothing to check") rather than passing having checked nothing. Passive security is unchanged. **Proven in a real browser:** one page sets `sid`, `_ga` and `theme`, none HttpOnly; both checks pass and flag exactly `sid`. On the previous code the Standard check flagged `_ga`, `sid` and `theme`. A page with only `_ga` makes the Standard check Not run with its reason. **Fixture, live through the app (one worker):** with `security-mixed-cookies` (the same three cookies on the home page), the Standard security run and the Comprehensive passive-security run both flag only `sid`. **Output measured:** `check:template-unchanged` gives 152 of 166 identical; the 14 that differ (every input that includes security) are identical once this one test is removed. **Since TFP-147 (GEN-69)** Standard has no cookie check of its own: its security suite runs the passive check, built by the same function, so the two cannot drift. The unit test now pins that, and both still flag only `sid`. One outcome changed: with no session-named cookie the check is no longer Not run ("no session cookie on the landing page"); it also reads the headers, so it passes with the header findings and names no cookie.

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

#### GEN-66 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** The Standard accessible-name check tests the link it was generated for (TFP-145; unit: `src/lib/generate/mock/actionable-elements/accessible-names.test.ts` (introspects a real page, then runs the generated checks through the Playwright CLI); fixture: `/names`)

**Expected result:** On rizonetech.com (run `5ce88c9c`, 2026-10-01) TFAC-008 "Home", 009 "Services", 018 and 038 "AI" failed as "has no accessible name" on links that have one. Introspection records a name only for an element with an `aria-label` or a `<label>` (its `aria-label ?? label ?? text` chain stops at the label, which is `""` when there is none), so most links fell through `buildLocatorExpression` to `getByText(text, { exact: true }).first()`. That resolves to the element holding the text - the `<span>` inside a WordPress menu link, which has no name - and `.first()` made same-text links all test the first one. A link with a target is now found the way introspection recorded it: the `<a>` whose resolved href and collapsed text match, and which of those it was in page order; a link that is no longer there fails as "<name> (a link to <url>) is not on the page". Links with an id, links without a target and other elements keep the previous locator; `buildLocatorExpression` (shared with the functional checks) is unchanged. **Proven in a real browser, from real introspection:** a span-wrapped menu link and its plain footer copy pass; of two "Open" links, the one to `/notes` passes and the one to `/login` (text `aria-hidden`) fails as "Open has no accessible name"; an image link with no alt fails as "Untitled link to .../login?from=icon has no accessible name". On the previous code the menu link fails ("locator resolved to `<span>Home</span>`"). **Fixture, live through the app:** a Standard accessibility run on `/names` gives 7 passed, 2 failed - exactly the "Open" link to `/login` and the image link; the fixture's other pages answer as before. **rizonetech.com, live, one worker, from the saved page data:** the 40 accessible-name checks go from 36 passed, 4 failed (TFAC-008, 009, 018, 038, as in the saved run) to 40 passed. **Output measured:** `check:template-unchanged` gives 162 of 166 identical; the 4 that differ (fixture page data, accessibility and no areas, fast and deep) are identical once the accessible-name tests are removed. On the rizonetech.com page data only 36 of the 40 accessible-name tests change, nothing else; the actionable-elements golden file changes only in its accessibility key. **Follow-up (2026-10-05):** a link's position now counts only links with the visibility introspection recorded, in the recorded data and in the page (introspection's own rule: not `display: none`, not `visibility: hidden`, non-zero box). Introspection drops a link that repeats another's URL, text and container whatever its visibility, so a hidden mobile copy of a menu link is in the page but not in the data. **Proven in a real browser (error guessing):** a menu "Home", a `display: none` copy in the same list and a footer "Home"; introspection records two visible "Home" links, and both checks pass. On `0504f92` the footer check resolved to `locator('a').nth(1)`, the hidden copy, and failed as "Home has no accessible name". **Output measured** against `0504f92`: 162 of 166 identical; the 4 that differ are identical once the accessible-name tests are removed, and in those only TFAC-002 to 005 change. On the saved rizonetech.com page data no visible link's position changes; 10 hidden links' positions do (each page's hidden "AI" and "Contact Us" copies, from 1 to 0), and those checks assert only that the link is attached.

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

#### GEN-74 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** The accessible-name check tests the button, field or form it was generated for, and doesn't ask an element with no role for a name (TFP-151, T23; Not run: owner decision, 2026-10-06; unit: `src/lib/generate/mock/actionable-elements/control-names.test.ts` (introspects a real page, then runs the generated checks through the Playwright CLI))

**Expected result:** **Lookup** (`accessibility.ts`): a button, select, textarea or input with no id, label, placeholder or role-and-name - until now `getByText(text).first()`, the element holding the text - is found among its own kind (`button, input[type=button|submit|reset], [role=button]` not on `<a>`; `select`; `textarea`; other inputs) by the text introspection recorded (computed as introspection does: an input's value, aria-label, placeholder or name, else collapsed textContent), its visibility and its position among those, as TFP-145 finds links. A `<form>` without an id is the `<form>` itself, by TFP-160's record (action, method, occurrence), or the nth `<form>` in a profile without one. Elements with an id, label, placeholder or role-and-name keep their locator. **No role:** a `<form>` with no `aria-label`, `aria-labelledby` or `title` (no `role` attribute) is generic under HTML-AAM, so its check is Not run: "<name> is a <form> with no accessible name, so it has no role (HTML-AAM): there is no name to check". **Proven (equivalence partitioning over how an element gets or lacks its name), 2026-10-06:** `<button><span>Save</span></button>` passes (failed on the old check, which read the span); two "Open" buttons under different headings, the second's text `aria-hidden`: the first passes, the second fails "Open has no accessible name" (the old check tested the first twice and passed both); an icon-only button with only an id fails "show-password has no accessible name"; an unnamed `<form>` is Not run with the reason (the old check asked it for a name); a `<form aria-label="Newsletter">` is checked and passes; the fields and the buttons inside the forms pass. **Limits, not changed here:** introspection records an element only with text, a label, a placeholder or an id, so an icon-only button with none of those (Toolshop's show-password toggle, R10) gets no check here; the axe scan catches it. Two same-text buttons with the same container label are one record (introspection's dedupe), so only the first is checked. Introspection gives every `<input>` the role `textbox`, so a `type="search"` input (role `searchbox`) with an aria-label is looked for as a textbox and not found. **Output measured:** `check:template-unchanged` against `91222c5`: 166 of 166 identical. The fixed inputs generate accessible-name checks only for the home page's links, so none reaches the changed paths. The actionable-elements golden output (`__fixtures__/golden-output.json`) changes in one check, its `signup-form` form: the three Not-run lines are added (a form with an id but no accessible name has no role either).

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

#### GEN-68 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** The accessible-name check follows HTML-AAM 4.1.10 for an `<img alt="">`, not Playwright's departure from it (TFP-152; owner decision, 2026-10-05: the standard decides, not any one tool; unit: `src/lib/generate/mock/actionable-elements/accessible-names.test.ts` (introspects a real page, then runs the generated checks through the Playwright CLI))

**Expected result:** HTML-AAM 4.1.10 (checked 2026-10-05) gives an image with `alt=""` no name and uses `title` only when there is no `alt` attribute; Playwright 1.59.1 falls back to the `title`. Before reading the name, the check takes the `title` off every `img[alt=""]` inside the element (the page is not reused). When that leaves no name it fails as "<name> has no accessible name: HTML-AAM 4.1.10 gives an <img alt=""> no name and does not use its title ("<title>")". **Proven in a real browser (equivalence partitioning: where the only text sits):** `<a href="/logo"><img alt="" title="Home"></a>` fails with that message, naming the link by its target; `<a href="/titled" title="Home"><img alt=""></a>` (accname step 2I) and `<a href="/alt"><img alt="Home"></a>` pass. On the previous code all three passed. **rizonetech.com, live:** the logo link (TFAC-007) is exactly that markup; Chromium 147's own accessibility tree gives it the name `""` (evidence only). The 40 checks for `/` from the saved page data give 39 passed and 1 failed, TFAC-007 with that message (`benchmarks/2026-10-05-tfp152-logo-link/`; labelled-failure T18). **Output measured:** `check:template-unchanged` against `cdec8e0` gives 162 of 166 identical; the 4 that differ are identical once the accessible-name tests are removed, and all 16 accessible-name tests in them change. The golden file changes only in its accessibility key. **Follow-up (2026-10-06):** "empty" is HTML-AAM's "empty when trimmed of whitespace": any `img` whose `alt` is present and only ASCII whitespace counts, not only `alt=""`. Playwright treats `alt=" "` as a real image and falls back to the title. **Proven in a real browser (boundary value analysis on the alt):** `<a href="/blank"><img alt=" " title="Home"></a>` passed on `34622b0` and now fails with the HTML-AAM 4.1.10 message; the other three cases are unchanged. **Output measured** against `34622b0`: 162 of 166 identical; the 4 that differ change only in their 16 accessible-name tests; the golden file only in its accessibility key. Other places where Playwright departs from the standard are not covered; once TFP-148 adds the axe scan to Standard, a disagreement shows in the report.

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

#### GEN-72 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** A link in a closed menu or behind a collapsed navbar's toggle is checked as what it is (TFP-159, approach: owner decision, 2026-10-06; unit: `src/lib/generate/mock/link-audits/hidden-links.test.ts` (introspects the comparison fixture, then runs the generated suite through the Playwright CLI, deep mode); fixture: `menus`, `menus-toggle-broken`)

**Expected result:** **Rule** (`link-audits/reveal.ts`, run in the generated test): the control that reveals a hidden element is an `aria-expanded` element whose `aria-controls` (or `data-bs-target`, `data-target`, `href="#id"`) names a hidden ancestor, failing that one just before that ancestor (Bootstrap's dropdown), nearest hidden ancestor first; a hidden control is revealed first, up to 3 levels. **Link health** (a link hidden at inspection): its presence (`toBeAttached`, located with `includeHidden`) and its own address (HTTP status under 400, or its `href`), never its visibility; it then tries to reveal the link by click and, if it can't, records a finding: "<link> is healthy by its address, but users can't reach it: the '<menu>' menu didn't open" (or "... opened, but it stays hidden", or "no control was found that reveals it"). **Link type**: a hidden link is classified by its address and presence. **Keyboard**: opens the menu by keyboard (focus the control, Enter); a link still hidden fails, "<link> can't be reached by keyboard: <reason>". **Responsive** (TFRM-001): at each viewport, an item not visible is revealed by clicking its control first; still hidden, it fails with the reason. Visible links' checks are unchanged. **Proven (decision table: visible; closed menu that opens; opens but stays hidden; toggle broken; behind a toggle at 390 px; hidden with no control), 2026-10-06:** `menus`: Shop (visible) passes; Hand Tools passes health with no finding and is reached by keyboard through "Categories"; Archived passes health with "... the 'Categories' menu opened, but it stays hidden" and fails the keyboard check naming the menu; link types pass; at 390 px the responsive check opens the collapsed nav (`aria-controls`) and passes. `menus-toggle-broken`: Hand Tools passes health with "... the 'Categories' menu didn't open", and the keyboard check fails with the same reason. A link hidden with no control passes health with "... no control was found that reveals it". On the old generator the `menus` suite failed Hand Tools' and Archived's health, link types, keyboard and responsive. **Not in scope, still open:** the deep-mode "navigation destination" check still requires hidden links visible; form and accessible-name checks look up a button hidden at desktop with `getByRole` and fail to find it. **Output measured:** `check:template-unchanged` against `882a47d`: 162 of 166 identical; the 4 that differ (page-data inputs with the responsive area) change only in TFRM-001 (the reveal helper and each item revealed first). No fixed input has a hidden link, so their link checks are unchanged.

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

#### GEN-73 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** The form check finds the `<form>` itself and the fields introspection recorded in it (TFP-160, approach: owner decision, 2026-10-06; unit: `src/lib/generate/mock/actionable-elements/form-check.test.ts` (introspects the comparison fixture's `/forms`, then runs the generated checks through the Playwright CLI); fixture: `/forms`, `forms-missing-field`)

**Expected result:** **Introspection** records, for each `<form>`, a `form` record: its `action` and `method` as written ("" when absent), its `occurrence` among the page's earlier forms with the same action and method, and its fields (`input` other than hidden, `select`, `textarea`, `button`: tag, type, name, id) in document order. **The check** finds, among the page's `<form>` elements, the one with that action and method at that occurrence (failing "no form on <path> with action ..., method ..."), asserts it visible (or attached, if hidden at inspection), then asserts each recorded field is inside it: by name, else id, else by count of its kind; it fails naming each one missing ("fields missing from the form on /forms: input named \"tag\""). Text is no longer used to find a form. **A form with an id** keeps its id-based check, unchanged, as TFP-145 keeps a link's id. **A profile without form records** (saved before TFP-160) falls back to the nth `<form>` on the page, n from the profile's order, and "at least one control", as before. **Proven (error guessing, from T21 and T22 on practicesoftwaretesting.com), 2026-10-06:** on `/forms`, the multi-field form (fields in their own `<div>`s with no text between them, an `<input type="submit">`, no id: Playwright counts the input's value as the form's text and introspection doesn't, so the old `getByText` found nothing, as T22) and the lone-`<select>` form (the old check counted fields inside the `<select>`, as T21) both fail on the old generator and pass on the new one; with `forms-missing-field` the multi-field form fails naming `input named "tag"` and the `<select>` form still passes. A profile without form records gives the fallback. **Output measured:** `check:template-unchanged` against `6852538`: 162 of 166 identical; the 4 that differ (page-data inputs with the functional area) change only in their two `[form]` checks, to the fallback, since the fixed inputs' profiles have no form records.

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

#### GEN-75 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** The orphan-page check judges only pages that were loaded (TFP-161, T24; owner decisions, 2026-10-06: inspection records requested and failed pages, the start page is the first path requested, a 5xx is not loaded; unit: `src/lib/generate/mock/link-audits/orphan-pages.test.ts` (introspects the comparison fixture, then runs the generated check through the Playwright CLI); fixture: `hub-down`, `/unreachable`)

**Expected result:** **Inspection** (`inspectPages`, `/api/introspect`) adds `requestedPaths` (in order) and `failedPages` (`{ path, reason }`) to the profile. A page fails when it can't be loaded (timeout, dropped connection) or answers 500-599 ("HTTP 503"); it is left out of `pages`. A 4xx is still a page. **The check**, for a profile with `requestedPaths`: the start page is the first requested path. Start page not loaded: Not run, "the start page / could not be loaded when the site was inspected (HTTP 502), so which pages it links to is unknown". Otherwise each loaded page except the start needs a link from another loaded page; a page's links to itself (`#top`) no longer count. With another page not loaded, an unlinked page is a finding ("/anchors has no link from another loaded page; /unreachable could not be loaded, so a link from there was not seen"), not a failure; with every page loaded it fails, "/anchors is not linked from any other inspected page". A profile without `requestedPaths` (saved before TFP-161) gets the previous check, unchanged. **Proven (decision table: start loaded or not; another page lost or not; page linked or not), 2026-10-06:** `hub-down` with `/`, `/anchors`, `/names` (pages only the home page links to, like the-internet's examples): Not run, naming `/`; the previous check on the same profile failed `/names` as an orphan, as T24. `/`, `/anchors`, `/unreachable`: passes with the finding naming `/unreachable`. `/`, `/notes`, `/anchors`: fails naming `/anchors`. `/`, `/login`, `/notes`: passes, no finding. A profile without the record gets the previous check. **Output measured:** `check:template-unchanged` against `bf9cc36`: 166 of 166 identical. The fixed inputs' stored profiles have no `requestedPaths`, so they keep the previous check; the new path shows only in profiles inspected from now on.

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

#### GEN-86 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** Hidden elements in the remaining checks (TFP-162, TFP-159's approach; unit: `src/lib/generate/mock/link-audits/hidden-links.test.ts`)

**Expected result:** **Deep mode's navigation destination check:** a link hidden at inspection (a closed menu) is taken by its own address - present in the page, its href resolving to its destination - and not clicked; whether users can reach it stays the keyboard check's question. Emitted only when the page has such a link. **Form and name checks:** an element hidden at inspection that has a role and a name is looked up with `getByRole(..., { includeHidden: true })`, since getByRole alone searches the accessibility tree, which leaves hidden elements out (0 matches against 1). **Proven 2026-10-07:** on the fixture's `menus` state, deep mode, the destination check passes with Hand Tools and Archived in the closed Categories menu (it failed on the previous code, "Hand Tools ... not found"), and the closed menu's hidden "Clear filters" button (aria-label) is looked up with includeHidden and its checks pass.

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

#### INT-11 evidence

Moved word for word from [`docs/test-plan/INT.md`](../test-plan/INT.md) by TFP-253; the case's row there links here.

**Test:** Introspection records controls as they are (TFP-163; unit: `src/lib/introspect/controls.test.ts`)

**Expected result:** **Roles by input type** (ARIA in HTML): search is a searchbox (a combobox with a list), number a spinbutton, range a slider, image/submit/button/reset a button, text-like fields with a list a combobox; text, email, tel, url and password stay textbox. **Buttons:** a button with no text, label or id (icon-only) is recorded, with its position among the page's buttons, and found by it; same-text buttons are no longer merged - each records its position and which of the same-text buttons it is, and is found as the nth. Older profiles (no position) generate exactly as before. **Proven 2026-10-07:** each input type's role (equivalence partitioning); on the fixture's `/controls`, the labelled search field is found by role and its checks pass, the icon-only button's name check fails ("has no accessible name"), and the two "Delete" buttons get two checks, the enabled one passing and the disabled one failing. A fresh, read-only inspection of with-bugs `/#/auth/login` now records the show-password toggle (R15) at position 3.

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

#### GEN-87 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** The download checks' pattern keeps its escaped dot (TFP-164; unit: `src/lib/generate/mock/link-audits/download-pattern.test.ts`)

**Expected result:** Written as `\.` inside a template string, the backslash was dropped, so the visible link-types check and the download-link check emitted `/.(pdf|...)/`, which counts `.../getpdf` as a download. Both now emit `\.(pdf|doc|...)([?#].*)?$`, as TFP-159's hidden-link path already did. **Proven 2026-10-07:** equivalence partitioning on the emitted pattern - `report.pdf`, `report.PDF`, `sheet.xlsx?v=2`, `deck.pptx#page=3` match; `getpdf`, `xpdf`, `reportzip` don't (the test fails on the previous code).

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
