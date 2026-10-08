# Labelled Failure Set

The seed for the failure-triage gate Phase 34 deferred (its "Related,
deferred" section): every test failure TestForge has hand-classified, with
its verdict, the evidence, and its source run. Started 2026-09-30 in Phase 36
(TFP-123, Decision 1).

**Verdicts**

- **Real:** the site has the problem the test names.
- **Template error:** the template generator's test is wrong about the page.
- **Model error:** a local-model test is wrong about the page.
- **Unclear:** a real observation whose importance is a judgement call.

**Sources.** `comparisons/` and `runs/` are gitignored, so a source run
exists only on the machine that made it; the evidence column carries what a
reader needs without it. `benchmarks/` and `examples/` are committed.

**Status** says whether a rule has since removed the cause (Phase 34's "rule
first": a pattern a deterministic rule can recognise is handled by the rule,
and a classifier only sees what is left).

## Template errors

| # | Site | Test | Evidence | Source run | Status |
| --- | --- | --- | --- | --- | --- |
| T1-T7 | test-assist | 7 "action/form element check" tests: `#btnRecord`, `#btnClearSession`, `#uploadImage`, `#btnStopRecord`, `#textInput`, `#btnTextOk`, `#btnTextCancel` | `toBeVisible()` failed with `Received: hidden` on elements hidden by the app's design until a user action (Video mode, a restored session, the Text tool); `#uploadImage` is a styled-invisible file input inside a visible label | TFP-040, `examples/testforge-app/test-assist/run-report.json`; analysis in `notes.md` there | Fixed by rule: TFP-053/054 (hidden at inspection means an attached check, not a visibility claim) |
| T8 | comparison fixture | reliability: dependency failure injection on `/login` | Blocking the `/login` form action's route also blocked the page's own navigation to `/login` | TFP-099, `comparisons/2026-09-24T16-*-fixture` (Phase 21 report, "Results by area, fixture") | Open |
| T9 | the-internet | TFFU-002 "surfaces a sign-in related control for the described flow" | Visited `/`; read by hand, `/` is a list of examples with no sign-in control (0 matches), while `/login`, the page inspected for the request, has 3, all visible | TFP-099 (2026-09-24) and `comparisons/2026-09-28T20-19-37-582Z-the-internet`, runs `0a73a87b`, `f2fd9c89`; reproduced 2026-09-30, runs `15dbf0fd`, `04f40ce8` | **Fixed, TFP-123:** the test visits the first inspected page with a sign-in control. Passes on run `03bae90c` |
| T10 | the-internet | TFFU-007 "navigation link health: Untitled link to https://github.com/tourdedave/the-internet" | `a[href=…]:visible` found nothing. Read by hand: the link is `<a><img style="position:absolute…" alt="Fork me on GitHub"></a>`, so the anchor's own box is 0x0 and Playwright calls it hidden, while the 149x149 image is on screen, uncovered, clickable, and the anchor is the first Tab stop | as T9 | **Fixed, TFP-123:** a link counts as rendered when it or its content renders; visibility checks and clicks use what renders it. Passes on `ae16b41c`, `03bae90c` |
| T11 | the-internet | TFFU-010 "link types: … classified correctly" | Same link and cause as T10 | as T9 | **Fixed, TFP-123**, as T10 |
| T12 | the-internet | TFFU-015 "keyboard navigation: links can receive focus and activate with Enter" (30 s timeout) | Three layered causes, each found only once the one before was fixed. (1) The T10 locator never matched, so `focus()` waited out the test. (2) Pressing Enter only starts a navigation: the test's next `waitForLoadState` returned at once on the old page, the URL looked unchanged, and the next link was then sought on github.com until the timeout. (3) The Elemental Selenium link is `http://…`, the site answers 301 to `https://`, and the test compared URLs including the scheme | as T9; (2) and (3) measured 2026-09-30, runs `db67113c`, `5c1c8351` | **Fixed, TFP-123:** (1) as T10; (2) waits up to 5 s for the URL to change, then reloads the links page; (3) compares host and path, allowing an http-to-https upgrade. Passes on `03bae90c` |
| T13-T15 | the-internet | Comprehensive security, "responds, with its security headers": `/basic_auth`, `/digest_auth`, `/download_secure` | Each answered HTTP 401 (read with curl: `/basic_auth` 401). They are behind HTTP authentication; refusing is the server working, and Decision 3's failures are exposures only | TFP-136, `benchmarks/2026-10-01-phase35-first-slice/before-fix-security-the-internet.json` (run `aeb33b15`) | **Fixed, `198dbec`:** a page answering 400 or more is Not run with the reason ("behind a login, and this run does not sign in"); its version check still reads the headers. Passes on run `12e385fb` |
| T16 | the-internet | Comprehensive security on `/add_remove_elements` | HTTP 404. The site graph normalises the path; the link's real href is `/add_remove_elements/`, which answers 200 | TFP-136, `benchmarks/2026-10-01-phase35-first-slice/before-fix-security-the-internet.json` (run `aeb33b15`) | **Fixed, `198dbec`:** a page known only from the crawl is loaded by the href a link to it uses. Covered as `/add_remove_elements/` on run `12e385fb` |
| T17 | the-internet | Comprehensive security on `/authenticate` | HTTP 404 to a GET. Known only from a form-submit edge: it is `/login`'s POST target, not a page | TFP-136, `benchmarks/2026-10-01-phase35-first-slice/before-fix-security-the-internet.json` (run `aeb33b15`) | **Fixed, `198dbec`:** nodes reached only by a form submit or scripted action are not loaded |
| T18 | rizonetech.com | TFAC-007 "accessible name and role: Untitled link to https://rizonetech.com/" - a **false pass**, not a failure | The logo link is `<a href="https://rizonetech.com/" class="custom-logo-link"><img alt="" title="Rizonetech Logo - Light R2 → Rizonetechcom"></a>`: no `title` or `aria-label` on the link. HTML-AAM 4.1.10 gives an `alt=""` image no name and uses `title` only without an `alt` attribute, so the link has none, and axe's `link-name` flags it. Playwright 1.59.1 names it from the image's title, so `toHaveAccessibleName` passed. Chromium 147's own accessibility tree (CDP, evidence only) gives the link the name `""`, with no name sources. On 2026-10-01 the check located `a[href]` first, which is the page's "Skip to content" link, so the logo was not what it tested. The false pass on the logo itself dates from `0504f92`, whose live run passed it | Live 2026-10-05: `benchmarks/2026-10-05-tfp152-logo-link/live-2026-10-05.log`; the 2026-10-01 suite in `benchmarks/2026-10-01-rizonetech/standard-suite.spec.ts` | **Fixed, TFP-152:** the check follows HTML-AAM 4.1.10 and fails it as "has no accessible name: HTML-AAM 4.1.10 gives an `<img alt="">` no name and does not use its title". Live, the 40 checks on `/` give 39 passed and this 1 failed (`live-checks-2026-10-06.log` there) |
| T19 | practicesoftwaretesting.com | 15 tests: "navigation link health: Hand Tools" and "link types: … classified correctly" (5 pages each), "keyboard navigation: links can receive focus and activate with Enter" (5, 30 s timeout) | "Hand Tools" is `<a href="/category/hand-tools">` inside the closed "Categories" dropdown (`.dropdown-menu`), hidden until the menu opens. The first two require it visible; keyboard navigation waits to focus it until the test times out. Visibility by design, as T1-T7 | TFP-150, `benchmarks/2026-10-06-tfp150/toolshop-after-report.json` (and `-before-`, `d90de57`) | Open |
| T20 | practicesoftwaretesting.com | TFRM-001 "keeps the core journey visible across common viewport sizes" | At 390 px "Home" is in the collapsed navbar, hidden behind a visible `.navbar-toggler`; visible at 768 and 1440 px | TFP-150, `benchmarks/2026-10-06-tfp150/toolshop-after-report.json` (and `-before-`, `d90de57`) | Open |
| T21 | practicesoftwaretesting.com | "form element check: Name (A - Z)… [Sort] [form]" on 3 pages | `getByText` of the options' joined text matches the `<select>` itself; the check then counts `input, textarea, select, button` inside it: 0. A `<form>` around it exists | TFP-150, `benchmarks/2026-10-06-tfp150/toolshop-after-report.json` (and `-before-`, `d90de57`) | Open |
| T22 | practicesoftwaretesting.com | "form element check" for the `/contact` and `/auth/login` forms | Located by the whole form's joined label text ("Email address *Password *"); no single element has that text, so nothing is found | TFP-150, `benchmarks/2026-10-06-tfp150/toolshop-after-report.json` (and `-before-`, `d90de57`) | Open |
| T23 | practicesoftwaretesting.com | TFAC "accessible name and role: SearchX Search [form]" | The located element is a plain `<div>` (no role, no `aria-label`): a generic element has no accessible name to give, so asking for one is the check's mistake | TFP-150, `benchmarks/2026-10-06-tfp150/toolshop-after-report.json` (and `-before-`, `d90de57`) | Open |
| T24 | the-internet | "orphan page approximation: each scanned page is linked from another scanned page" (3 and 4 tests) | The check counts inbound links only among inspected pages. The host timed out on `/`, so inspection lost the page that links to every example, and `/checkboxes`, `/dropdown`, `/tables` (and `/login`) each looked unlinked. Read by hand, each is linked from `/` | TFP-150 re-run, `benchmarks/2026-10-06-tfp150/the-internet-rerun-*` (`d90de57` and `d202315`) | Open |
| T25 | Toolshop, both sites | the form check (TFP-160) and the form name check (TFP-151): "no form on /#/auth/login with no action, no method" (with-bugs 1; clean 5, every form), "(a form) is not on the page" (clean 2) | The generated check looks for the `<form>` straight after `domcontentloaded`; the Angular app draws its forms later, so there is none yet. Read by hand: each form is on the settled page with the recorded action and method. TFP-160's and TFP-151's fixtures were static HTML, so their tests never met it | TFP-154, `benchmarks/2026-10-06-toolshop-known-bugs/runs/*-standard-records.json` (`26fed09`) | **Fixed, TFP-167** (`e812795`): every visit waits for the page to draw. In the re-score (`runs-tfp167/`, `7577252`) every form check passes on both sites |
| T26 | with-bugs Toolshop | "form element check: 1 [Versatile combination pliers ...] [input]" on `/#/product/1` | The quantity `<input type="number">` was recorded with its value "1" as its text and located with `getByText('1')`; an input's value is not text, so nothing is found Also on the local with-bugs product page (TFP-180), the quantity field found by its value under a description's text. | as T25 | Open |
| T27 | with-bugs Toolshop | "api element check: First nameLast nameEmail addressSubject..." on `/#/contact` | The contact `<form>` was classed `api`, so TFP-160's form lookup (category `form` only) didn't apply and it was located by all its labels joined, as T22. Its message happens to contain the subject list's error entries (bug 60) | as T25 | Open |
| T28 | with-bugs Toolshop | passive security "puts no password or session token in a URL": "a form on /#/auth/login would send its password field in the URL (method GET ...)" | The check flags any GET `<form>` holding a password input. Read by hand: the field has no `name`, so a native submit wouldn't send it, and the app submits by script. The clean site's form is the same; its check passed only because the form wasn't drawn yet (T25). In the re-score (`runs-tfp167/`) it fails on both sites' login and register pages | as T25 | Open |
| T29 | with-bugs Toolshop | "link types: ... classified correctly" on 5 pages: `getByRole('link', { name: 'Categories' })` not found | "Categories" is `<a href="#" role="button">`: its role is button, so a link-role lookup can't find it. (The clean site's is a `<button>`, not a link) | as T25 | Open |
| T30 | with-bugs Toolshop | "orphan page approximation: each scanned page is linked from another scanned page" on all 8 pages: "/#/product/6 is not linked from any other inspected page" | Read from the run's inspection profile: home and `/#/category/hand-tools` exposed no product link at all, where the re-score's inspection of the same pages had `#/product/1` to `#/product/9`. Inspection read them before the product cards drew (they load from the API), so the product page looked unlinked. The tests themselves ran on drawn pages (axe names the cards), so no bug's score depends on it. Not the selection: product 1 would have failed the same way | TFP-175, `benchmarks/2026-10-07-tfp175-selection/runs/``with-bugs-standard-*` (`7233751`) | Open: inspection doesn't wait for a hash route's data, as generated visits do since TFP-167 |
| T31 | practicesoftwaretesting.com | "link types: ... classified correctly": `getByRole('link', { name: 'Combination Pliers ABCDE$14.15' })` (a product card) and `{ name: 'Learn Test AutomationHands-on courses for Playwright, Robot Framework, APIs and more' }` (a footer card) not found | The name is the link's text as inspection joined it, with no space between its block children ("Automation" + "Hands-on", the CO2 letters and the price). The browser's accessible name separates them, so an exact lookup finds nothing, though the link is there. The re-score (5) and TFP-175 (7), clean site only (the with-bugs footer and cards differ) Also on the local clean copy (TFP-180): "Claw Hammer with Shock Reduction Grip ABCDE$13.41". | TFP-178, from `benchmarks/2026-10-06-toolshop-known-bugs/runs-tfp167/clean-standard-records.json` and `benchmarks/2026-10-07-tfp175-selection/runs/clean-standard-records.json` | Open |

## Model errors

| # | Site | Test | Evidence | Source run | Status |
| --- | --- | --- | --- | --- | --- |
| M1 | the-internet | local accessibility test, exact accessible name "Login" | The button's accessible name is " Login" (with a leading space); an exact match on "Login" failed | TFP-099, `comparisons/2026-09-24T16-47-24-029Z-the-internet` | Open |
| M2 | the-internet; comparison fixture | local tests with a guessed `form` role name | The model named a form role the page doesn't expose; again in the Phase 36 benchmark, C3 functional #2 (`getByRole('form', { name: 'Sign in' })`, re-run with the base URL) | as M1; `benchmarks/2026-09-29/C3/rerun-with-base-url.json` | Open |
| M3 | the-internet | gap-fill database test "data entered on the login page is saved" | Invented a login-and-reload flow: typed a username and password, submitted, reloaded, expected the fields to keep the values. A sign-in form doesn't save input. Passed all four generation gates. Repeated in two runs | TFP-120, `comparisons/2026-09-28T20-08-32-878Z-the-internet`, `…20-19-37-582Z-the-internet` | Avoided, not fixed: with page data (TFP-122 inspects automatically) the template reports database not applicable and the model isn't asked |
| M4 | comparison fixture | local functional test "should display/show an error message for invalid credentials" | Asserts an error message the fixture's sign-in page doesn't show. Checked per suite: 7 clean-run failures (C1 once, C2 twice, C7 twice, C8 once, the confirmation C1 twice) | Phase 36 benchmark, `benchmarks/2026-09-29*/*/functional-*.spec.ts` | Open: moves clean-run counts by 1-2 per configuration |
| M5 | comparison fixture | local security test "input that looks like a script is not executed" | Detects the injected defect only sometimes: it checks for an alert immediately after clicking Save, without waiting for the saved page to render. C1's three suites were byte-identical and caught the defect once | Phase 36 benchmark, `benchmarks/2026-09-29/C1/security-*.spec.ts` | Open: a detection race, not a false failure |

## Real

| # | Site | Test(s) | Evidence | Source run | Status |
| --- | --- | --- | --- | --- | --- |
| R1 | comparison fixture | 9 template SEO test failures | The fixture has no canonical link, structured data, robots.txt, sitemap or web-app manifest | TFP-099, `comparisons/2026-09-24T16-*-fixture` | Real. TFP-124 makes a missing manifest and missing structured data findings, not failures |
| R2 | the-internet | template SEO: meta description, canonical, sitemap reference in robots.txt | The page has no meta description or canonical link; robots.txt has no `Sitemap:` line | TFP-099 and every later the-internet run, most recently `03bae90c` (2026-09-30) | Real, and stay failures (Phase 36 Decision 2) |
| R3 | the-internet | template SEO: structured data, web-app manifest | Neither exists | as R2 | Real, but optional: findings from TFP-124 (Decision 2) |
| R4 | the-internet | Comprehensive accessibility, color-contrast (serious, WCAG 1.4.3) on 17 of 20 pages | Measured: every flagged element is the site's `rgb(43,166,203)` with white - the footer's "Elemental Selenium" link (16px, on white), the buttons on `/add_remove_elements/`, `/dynamic_controls`, `/challenging_dom`, and the 32px "Login" heading - at 2.83:1, under 4.5:1 for normal text and 3:1 for large | TFP-136, `benchmarks/2026-10-01-phase35-first-slice/accessibility-none-the-internet.herokuapp.com.json` (run `84094801`) | Open (the site's) |
| R5 | the-internet | image-alt (critical, 1.1.1) on `/broken_images` and `/dynamic_content` | The flagged `<img>` elements have no `alt` | TFP-136, `benchmarks/2026-10-01-phase35-first-slice/accessibility-none-the-internet.herokuapp.com.json` (run `84094801`) | Open (the site's) |
| R6 | the-internet | label (critical, 4.1.2) and TFP-121's field-name check on `/checkboxes` | `<input type="checkbox"> checkbox 1<br>` - text beside the box, no label | TFP-136, `benchmarks/2026-10-01-phase35-first-slice/accessibility-none-the-internet.herokuapp.com.json` (run `84094801`) | Open (the site's) |
| R7 | the-internet | select-name (critical, 4.1.2) and TFP-121's check on `/dropdown` | `<select id="dropdown">` with no label anywhere on the page (0 `<label>` elements) | TFP-136, `benchmarks/2026-10-01-phase35-first-slice/accessibility-none-the-internet.herokuapp.com.json` (run `84094801`) | Open (the site's) |
| R8 | the-internet | label (critical, 4.1.2) and TFP-121's check on `/dynamic_controls` | The checkbox and the text input have no label | TFP-136, `benchmarks/2026-10-01-phase35-first-slice/accessibility-none-the-internet.herokuapp.com.json` (run `84094801`) | Open (the site's) |
| R9 | the-internet | list (serious, 1.3.1) on `/disappearing_elements` | The `<ul>`'s direct children are `LI,LI,LI,LI,LI,UL` - a list inside a list without an `<li>` | TFP-136, `benchmarks/2026-10-01-phase35-first-slice/accessibility-none-the-internet.herokuapp.com.json` (run `84094801`) | Open (the site's) |
| R10 | practicesoftwaretesting.com | axe `button-name` (critical, 4.1.2) on `/auth/login` (and `/auth/register`, TFP-178) | The show-password toggle is `<button class="btn btn-outline-secondary"><fa-icon><svg aria-hidden="true">…</svg></fa-icon></button>`: no text, no label; its aria snapshot is `- button`. New with Phase 38's scan (TFP-148) | TFP-150, `benchmarks/2026-10-06-tfp150/toolshop-after-report.json` | Open (the site's) |
| R11 | practicesoftwaretesting.com | "storage failure injection: localStorage" on all 5 pages | With `localStorage` throwing, the app throws it uncaught and renders an empty body (0 characters, no products) | TFP-150, `benchmarks/2026-10-06-tfp150/toolshop-after-report.json` (and `-before-`, `d90de57`) | Open (the site's) |
| R12 | practicesoftwaretesting.com | template SEO: meta description and canonical (5 pages each), robots.txt `Sitemap:`, sitemap.xml | No meta description or canonical link after render; `/robots.txt` and `/sitemap.xml` answer 200 with the app's HTML shell | TFP-150, `benchmarks/2026-10-06-tfp150/toolshop-after-report.json` (and `-before-`, `d90de57`) | Real, and stay failures (Phase 36 Decision 2) |
| R13 | Toolshop, both sites | template SEO: meta description and canonical on the 5 Standard routes, robots.txt `Sitemap:`, sitemap.xml | No meta description or canonical link; `/robots.txt` is a real robots file with no `Sitemap:` line, and `/sitemap.xml` answers 404. Not a listed bug | TFP-154, `benchmarks/2026-10-06-toolshop-known-bugs/runs/with-bugs-standard-records.json` | Real, and stay failures (Phase 36 Decision 2) |
| R14 | with-bugs Toolshop | "anchor links point to existing in-page targets": "Anchor target missing for #filters" (2 pages) | `<a href="#filters" data-bs-toggle="collapse">` (the small-screen filters toggle); no element has id `filters`, after the page settles too. The clean site uses a button with an existing target. Not a listed bug | as R13 | Open (the site's) |
| R15 | with-bugs Toolshop | axe `button-name` (critical, 4.1.2) on `/#/auth/login` and `/#/auth/register` | The show-password toggle, `<button class="btn btn-outline-secondary"><i class="fa fa-eye"></i></button>`: no text, no label. The same defect as R10 on the clean site, which this run's clean scans didn't reach (its form wasn't drawn yet, T25). Not a listed bug | as R13 | Open (the site's) |
| R16 | Toolshop, both sites | axe `list` (serious, 1.3.1) on home and the category (`.checkbox:nth-child(n) > ul`), and on the clean register page (`#passwordHelp > ul`) | A `<ul>` that directly holds something other than `<li>`: the filters' nested category lists. Seen once TFP-167 let the filters draw. Not a listed bug | TFP-154 re-score, `benchmarks/2026-10-06-toolshop-known-bugs/runs-tfp167/*-accessibility-records.json` (`7577252`) | Open (the site's) |
| R17 | Toolshop, both sites | axe `target-size` (serious, 2.5.8) on `/#/product/1` | The related products' `<a large href="#">` links are smaller than 24 px with no spacing. Not on the re-score's clean product; TFP-175 found it on all 9 clean product pages its Comprehensive run covered (`.card-body > a[href="#"][large=""]`), so it is shared behaviour, not a planted bug. Not a listed bug | as R16 | Open (the site's) |
| R18 | with-bugs Toolshop | axe `color-contrast` (serious, 1.4.3) on home's `.float-start` | Read by hand: `<span data-test="out-of-stock" class="float-start text-danger">Out of stock</span>`, red `rgb(220, 53, 69)`, below 4.5:1. The clean site passes. Not a listed bug | as R16 | Open (the site's) |

## Unclear

| # | Site | Test | Evidence | Source run | Status |
| --- | --- | --- | --- | --- | --- |
| U1 | test-assist | TFFU-036 `:visited` link styling | The stylesheet defines no `:visited` rule; the page has two links, both external. A real observation, but whether it matters is a judgement call | TFP-040, `examples/testforge-app/test-assist/` | Recorded as a real but unclear finding |
| U2 | practicesoftwaretesting.com | "visited style configuration" on 5 pages | No `:visited` rule in 1,826 inspectable same-origin rules, as U1 | TFP-150, `benchmarks/2026-10-06-tfp150/toolshop-after-report.json` (and `-before-`, `d90de57`) | Recorded as a real but unclear finding |
| U3 | practicesoftwaretesting.com | "visual representation: links are distinguishable from surrounding text" on `/category/power-tools` | The footer's "explore" card links (`.ptt-explore-link`) have their parent's colour and no underline, but are block links with no surrounding text. Timing-dependent: the run failed this page and passed 4, a later probe found them on 3 others and not this one | TFP-150, `benchmarks/2026-10-06-tfp150/toolshop-after-report.json` (and `-before-`, `d90de57`) | Unclear: the finding, and the check's race with the footer's render. TFP-154 (2026-10-06): the same check failed on 4 of the with-bugs Toolshop's 5 Standard pages; its message names no link, so which links were not read |
| U4 | with-bugs Toolshop | "form element check: Your password * [Login] [input]" on `/#/auth/login`: "not editable ... Element is not an <input>" | Two elements carry `id="password"`: the `app-password-input` wrapper and the input inside it. `[id="password"]` lands on the wrapper. The duplicate id is real (axe lists `duplicate-id-aria` for manual review on register); the check's message blames the field, which is editable | TFP-154, `benchmarks/2026-10-06-toolshop-known-bugs/runs/with-bugs-standard-records.json` Also on `/#/auth/register` ("form element check: Your password * [Password] [input]", TFP-175, `benchmarks/2026-10-07-tfp175-selection/runs/`), the same two elements | Unclear: a real duplicate id, reported as the wrong fault |
| U5 | practicesoftwaretesting.com | "link types: ... classified correctly" on the clean product page: `getByRole('link', { name: 'Hammer More information' })` not found | A product card link named as inspection saw it, a few minutes before the test, wasn't there when the test ran. Not read back: an hour later the clean site's catalogue had been reset and the run's product (`/product/01M4B76Y1E21FPWYSS4K07YSMB`) drew no product at all, so its cards can't be compared. The same check failed the same way in the re-score on "Combination Pliers ABCDE$14.15" | TFP-175, `benchmarks/2026-10-07-tfp175-selection/runs/``clean-standard-*` | Unclear: the cards' contents shift between inspection and test |
| U6 | practicesoftwaretesting.com | "link health: internal, external, and download links do not return broken responses": the footer's GitHub link answered HTTP 500 | Once, on one of 8 pages; the same link passed on the other 7 and in the re-score. GitHub's answer, not the Toolshop's | TFP-175, `benchmarks/2026-10-07-tfp175-selection/runs/``clean-standard-*` | Unclear: an external host's passing error |
| U7 | practicesoftwaretesting.com | "orphan page approximation" on all 5 pages of the re-score: "/product/01M48AGCWN26TFYQ1FQ6S7FNJF is not linked from any other inspected page" | Read from the run's profile: home and `/category/hand-tools` each listed 9 products, none of them this one. It is TFP-154's hand-picked product, fixed by id on 2026-10-06; the clean catalogue is reset (the benchmark's known limit), so by the re-score its page was reached only by its address. The check is right about the data it had | TFP-178, from `benchmarks/2026-10-06-toolshop-known-bugs/runs-tfp167/clean-standard-*` | Unclear: a benchmark artifact, not the site's or the template's |
| U8 | Toolshop, local copies | "page weight stays under 5 MB" (6.8 MB with-bugs, 5.7 MB clean) and "publishes robots.txt" / "sitemap.xml" (HTTP 404), on the local copies only | The local copies run Angular's development server (`ng serve`): unminified bundles (the largest, FontAwesome's icons, 1,013 KB) and no `robots.txt` or `sitemap.xml`. The hosted sites are production builds, so neither shows there. Not the site's behaviour | TFP-180, `benchmarks/2026-10-07-phase41-local/runs/` | Unclear: the local environment, not the site |

## What this set is, and isn't

- 3 sites: 12 template-error failures (7 of them one cause, fixed by rule),
  5 model-error patterns (M4 alone covers 7 suites), 14 real SEO failures
  and 1 unclear finding. Too few, and too dominated by the two sites
  TestForge was built against, to set a classifier threshold. T18 (TFP-152)
  adds rizonetech.com and the set's first false pass: a check that passed
  where it should have failed, which a failure classifier never sees. Phase 34's
  plan stands: add labelled failures from later runs, and hold some back
  from threshold-setting.
- TFP-150 (2026-10-06) adds practicesoftwaretesting.com, a fourth site and
  the first built for test practice: 22 template-error failures (T19 alone
  is 15), 18 real and 6 unclear.
- **Left out on purpose:** the-internet's 30 s test timeouts in TFP-150's
  runs (`benchmarks/2026-10-06-tfp150/the-internet-*`): 47 before, 53 after,
  and in the re-run 54 before, 87 after, plus one `HTTP 503` on `/`.
  The host wasn't answering (inspection timed out on 3 of 5 pages, and
  `curl` got a 503 after 30.8 s), so none is a test right or wrong about a
  page.
- **Left out on purpose:** C3's and C6's benchmark suites that navigated to
  relative URLs and failed with "Cannot navigate to invalid URL". That was
  the benchmark running a model suite without the `test.use({ baseURL })`
  TestForge's merged gap-fill suite gives it, not a mistake about the page.
- Every template error found so far came from the generator assuming
  something about the page that one real page contradicted: visibility by
  design, a zero-size anchor, a root page that isn't the flow's page, a
  navigation that hasn't committed yet, an https upgrade.


## The clean Toolshop's failures, labelled (TFP-178, 2026-10-07)

Decision 9's condition 4 (Phase 40) could be read only against new failures,
because the first score labelled with-bugs only. Every clean-site failure in
TFP-154's re-score (`runs-tfp167/`) and in TFP-175
(`benchmarks/2026-10-07-tfp175-selection/runs/`) was read by hand from the
committed records, then given a label by `label-clean.mjs` (in TFP-175's
folder), which fails if any failure is left without one. No new runs.

- **New labels:** T31 (a link's name joined without spaces) and U7 (the
  hand-picked product no longer listed after a catalogue reset).
- **Labels widened:** R13 (both sites), R10 (register too).
- R16 already covers the clean register and categories; T28, R17, U5 and U6
  already name the clean site.



**Every one of the 122 clean-site failures has a label.** By verdict:
- **real (R10, R11, R13, R16, R17):** 70;
- **template errors (T28, T31):** 19;
- **unclear (U2, U3, U5, U6, U7):** 33.

R10+R16 is one scan failing on both rules, on register.