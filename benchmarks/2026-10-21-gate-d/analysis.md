# Phase 39 Gate D: the numbers

Medians of three runs (one for the capped run); each run's time in seconds, in run order.

## Run times

| Copy | Suite | W1 | WN | CAP | A | P38B | P38A |
| --- | --- | --- | --- | --- | --- | --- | --- |
| fixture | standard | 74 (74, 74, 73) | 34 (34, 33, 34) | - | - | - | - |
| fixture | security | 10 (10, 10, 10) | 8 (7, 8, 8) | - | - | - | - |
| fixture | accessibility | 7 (7, 6, 7) | 5 (4, 5, 5) | - | - | - | - |
| with-bugs | standard | 734 (734, 714, 740) | 365 (407, 365, 358) | - | - | - | - |
| with-bugs | security | 113 (133, 113, 108) | 89 (98, 86, 89) | - | - | - | - |
| with-bugs | accessibility | 149 (149, 149, 144) | 60 (60, 79, 58) | - | 215 (215, 222, 207) | - | - |
| clean | standard | 403 (403, 399, 413) | 519 (463, 519, 661) | - | - | - | - |
| clean | security | 113 (113, 110, 113) | 189 (195, 179, 189) | - | - | - | - |
| clean | accessibility | 98 (98, 97, 98) | 197 (246, 186, 197) | - | - | - | - |
| the-internet | standard | 316 (326, 314, 316) | 91 (97, 77, 91) | - | - | 218 (219, 216, 218) | 242 (239, 242, 243) |
| the-internet | security | 79 (79, 79, 79) | 56 (56, 56, 56) | - | - | - | - |
| the-internet | accessibility | 73 (73, 73, 72) | 24 (26, 24, 23) | - | - | - | - |
| practicesoftwaretesting | standard | - | - | 29340 (29340) | - | - | - |
| practicesoftwaretesting | security | - | - | 698 (698) | - | - | - |
| practicesoftwaretesting | accessibility | - | - | 170 (170) | - | - | - |

WN: 6 workers (6 used), Standard as 12 unit file(s) in 2 pass(es), 2 test(s) in the serial group (run 1).

## Against the rules

- Decision 12, the fixture: every test the same result with 1 and with N workers: **yes** (standard same, security same, accessibility same).
- Acceptance Criteria 7, with-bugs: standard same, security same, accessibility same.
- Acceptance Criteria 7, clean: standard differs, security differs, accessibility differs.
- Acceptance Criteria 7, the-internet: standard same, security same, accessibility same.
- **Decision 13, with-bugs:** Comprehensive, every area (security + accessibility): W1 262 s (282, 262, 252), WN 158 s (158, 165, 147), 39.7% faster against at least 40%; with the fixture's same results: **not met: reverted**.
- **Decision 13, clean:** Comprehensive, every area (security + accessibility): W1 211 s (211, 207, 211), WN 386 s (441, 365, 386), -82.9% faster against at least 40%; with the fixture's same results: **not met: reverted**.
- Gate C's accessibility gap, with-bugs: A (before TFP-212, 1 worker) 215 s, WN 60 s, 72.1% faster against Gate C's 30%: **closed**.
- Standard, fixture (recorded): W1 74 s, WN 34 s, 54.1% faster.
- Standard, with-bugs (recorded): W1 734 s, WN 365 s, 50.3% faster.
- Standard, clean (recorded): W1 403 s, WN 519 s, -28.8% faster.
- Standard, the-internet (recorded): W1 316 s, WN 91 s, 71.2% faster.
- Phase 38 on the-internet's local copy: d90de57 218 s (219, 216, 218), d202315 242 s (239, 242, 243).
- Capped, practicesoftwaretesting standard (recorded): 29340 s, 3 workers (3 used), 484 tests {"Passed":9,"Failed":467,"Not run":8}; 902 requests took a slot, 897 waited (855783 s in all), 0.03 per second over the run; timed checks not judged 4; timeouts 466.
- Capped, practicesoftwaretesting security (recorded): 698 s, 3 workers (3 used), 122 tests {"Passed":117,"Failed":5}; 1953 requests took a slot, 1762 waited (5799 s in all), 2.80 per second over the run; timed checks not judged 0; timeouts 5.
- Capped, practicesoftwaretesting accessibility (recorded): 170 s, 3 workers (3 used), 80 tests {"Not run":40,"Passed":40}; 624 requests took a slot, 613 waited (2260 s in all), 3.67 per second over the run; timed checks not judged 0; timeouts 0.

## Decision 7 and Decision 12: the same results; Phase 38; timeouts

### W1 against WN, fixture standard

- Failures: W1 9/9/9, WN 9/9/9; the same in every run: W1 yes, WN yes.
- Run 1, tests that give the same in every run of each: 0 failing in W1 only, 0 in WN only; findings 0 in W1 only, 0 in WN only.
- Tests that vary between runs of one variant: 0.

### W1 against WN, fixture security

- Failures: W1 0/0/0, WN 0/0/0; the same in every run: W1 yes, WN yes.
- Run 1, tests that give the same in every run of each: 0 failing in W1 only, 0 in WN only; findings 0 in W1 only, 0 in WN only.
- Tests that vary between runs of one variant: 0.

### W1 against WN, fixture accessibility

- Failures: W1 0/0/0, WN 0/0/0; the same in every run: W1 yes, WN yes.
- Run 1, tests that give the same in every run of each: 0 failing in W1 only, 0 in WN only; findings 0 in W1 only, 0 in WN only.
- Tests that vary between runs of one variant: 0.

### W1 against WN, with-bugs standard

- Failures: W1 84/84/84, WN 83/84/84; the same in every run: W1 yes, WN no.
- Run 1, tests that give the same in every run of each: 0 failing in W1 only, 0 in WN only; findings 0 in W1 only, 0 in WN only.
- Tests that vary between runs of one variant: 5 (link health: linked routes draw a page, not the app's "not found" view @; the same components look the same on every inspected page (recorded as findings) @/#/; /#/category/hand-tools keeps its forms, lists and cards consistent (recorded as findings) ; /#/ keeps its forms, lists and cards consistent (recorded as findings) @/#/; cumulative layout shift during load stays under 0.25 @).

### W1 against WN, with-bugs security

- Failures: W1 3/3/3, WN 3/3/3; the same in every run: W1 yes, WN yes.
- Run 1, tests that give the same in every run of each: 0 failing in W1 only, 0 in WN only; findings 0 in W1 only, 0 in WN only.
- Tests that vary between runs of one variant: 0.

### W1 against WN, with-bugs accessibility

- Failures: W1 41/41/41, WN 41/41/41; the same in every run: W1 yes, WN yes.
- Run 1, tests that give the same in every run of each: 0 failing in W1 only, 0 in WN only; findings 0 in W1 only, 0 in WN only.
- Tests that vary between runs of one variant: 0.

### W1 against WN, clean standard

- Failures: W1 46/46/46, WN 63/64/83; the same in every run: W1 yes, WN no.
- Run 1, tests that give the same in every run of each: 2 failing in W1 only, 6 in WN only; findings 1 in W1 only, 0 in WN only.
- Tests that vary between runs of one variant: 24 (keyboard navigation: links can receive focus and activate with Enter @; usability: primary actions are reachable without scrolling at desktop viewport @; dependency failure injection: localhost:8091 [xhr-fetch] @; storage failure injection: sessionStorage on /auth/login @; session cookies set by the site expire and stay scoped to it @; form element check: <id> [By category:] [input] @; /category/hand-tools passes the WCAG 2.2 A and AA scan @/category/hand-tools; navigation link health: Hand Tools @; form element check: <id> [Categories] [input] @; usability: <id> [input] uses non-generic guidance text @; action element check: Decrease quantity [Ergonomic claw hammer featuring an advanced shock; keeps heading structure stable for /product/<id> @; navigation link health: Untitled link to http://localhost:4200/ @; keeps heading structure stable for /rentals @; landing page finishes loading within 5 s @; storage failure injection: sessionStorage on /product/<id> @; storage failure injection: sessionStorage on /contact @; storage failure injection: sessionStorage on /rentals @; navigation link health: Home @; largest contentful paint stays under 4 s @; cards linking to /product/:id on /: each on the page, named, with a valid href @/; cards linking to /product/:id on /product/<id>: each on the page, named, with a valid href; link "More information" on /product/<id>: on the page, named, with a valid href @/product/; hover state: links show pointer cursor and preserve tooltip attributes @).
  - failing in W1 only: /product/<id> passes the WCAG 2.2 A and AA scan @/product/<id>
  - failing in W1 only: /category/hand-tools groups its checkboxes and radio buttons @/category/hand-tools
  - failing in WN only: the same components look the same on every inspected page (recorded as findings) @/
  - failing in WN only: keeps the core journey visible across common viewport sizes @
  - failing in WN only: link "iMattSmart" on /product/<id>: on the page, named, with a valid href @/product/<id>
  - failing in WN only: keeps page title stable for /product/<id> @
  - failing in WN only: cards linking to /product/:id on /category/hand-tools: each on the page, named, with a valid href @/category/hand-tools
  - failing in WN only: keeps page title stable for /category/hand-tools @
  - finding in W1 only: /product/<id> spells its interface text correctly (recorded as findings) @/product/<id> | "Unsplash" in the link "Unsplash" on /product/<id> is not in the dictionary (en-US, en-GB); did you mean "splash"?

### W1 against WN, clean security

- Failures: W1 2/2/2, WN 9/12/11; the same in every run: W1 yes, WN no.
- Run 1, tests that give the same in every run of each: 0 failing in W1 only, 1 in WN only; findings 0 in W1 only, 0 in WN only.
- Tests that vary between runs of one variant: 6 (/ fetches no internal fields it never shows (recorded as a finding) @/; /product/<id> puts no password or session token in a URL @/product/<id>; /product/<id> fetches no internal fields it never shows (recorded as a finding) @/product/; /category/special-tools puts no password or session token in a URL @/category/special-tool; /contact puts no password or session token in a URL @/contact; / puts no password or session token in a URL @/).
  - failing in WN only: / uses no guessable sequential ids in its addresses (recorded as a finding) @/

### W1 against WN, clean accessibility

- Failures: W1 19/19/19, WN 18/10/18; the same in every run: W1 yes, WN no.
- Run 1, tests that give the same in every run of each: 1 failing in W1 only, 0 in WN only; findings 0 in W1 only, 0 in WN only.
- Tests that vary between runs of one variant: 11 (/ passes the WCAG 2.2 A and AA scan @/; /product/<id> passes the WCAG 2.2 A and AA scan @/product/<id>; /category/hand-tools passes the WCAG 2.2 A and AA scan @/category/hand-tools; /category/power-tools groups its checkboxes and radio buttons @/category/power-tools; /category/power-tools passes the WCAG 2.2 A and AA scan @/category/power-tools; /category/special-tools passes the WCAG 2.2 A and AA scan @/category/special-tools; /category/hand-tools groups its checkboxes and radio buttons @/category/hand-tools; /category/other groups its checkboxes and radio buttons @/category/other; /category/other passes the WCAG 2.2 A and AA scan @/category/other; /contact passes the WCAG 2.2 A and AA scan @/contact; /auth/forgot-password passes the WCAG 2.2 A and AA scan @/auth/forgot-password).
  - failing in W1 only: /category/special-tools groups its checkboxes and radio buttons @/category/special-tools

### W1 against WN, the-internet standard

- Failures: W1 65/65/65, WN 65/65/65; the same in every run: W1 yes, WN yes.
- Run 1, tests that give the same in every run of each: 0 failing in W1 only, 0 in WN only; findings 0 in W1 only, 0 in WN only.
- Tests that vary between runs of one variant: 0.

### W1 against WN, the-internet security

- Failures: W1 0/0/0, WN 0/0/0; the same in every run: W1 yes, WN yes.
- Run 1, tests that give the same in every run of each: 0 failing in W1 only, 0 in WN only; findings 0 in W1 only, 0 in WN only.
- Tests that vary between runs of one variant: 0.

### W1 against WN, the-internet accessibility

- Failures: W1 19/19/19, WN 19/19/19; the same in every run: W1 yes, WN yes.
- Run 1, tests that give the same in every run of each: 0 failing in W1 only, 0 in WN only; findings 0 in W1 only, 0 in WN only.
- Tests that vary between runs of one variant: 0.

### Phase 38's before and after, the-internet's local copy

- Tests: before 161/161/161, after 187/187/187; failed before 18/18/18, after 20/20/20; 30 s timeouts before 0/0/0, after 0/0/0.
- New failures in the after run (run 1; a test failing after whose title wasn't failing before): 2.
  - /checkboxes passes the WCAG 2.2 A and AA scan @/checkboxes
  - /dropdown passes the WCAG 2.2 A and AA scan @/dropdown

### Timeouts, capped practicesoftwaretesting standard

- TFFU-125: link health: internal, external, and download links do not return broken responses @
- TFFU-130: keyboard navigation: links can receive focus and activate with Enter @
- TFFU-132: HTTPS/SSL: secure links remain on HTTPS when marked as secure @
- TFFU-136: navigation link health: Hand Tools @
- TFFU-137: link health: internal, external, and download links do not return broken responses @
- TFFU-142: keyboard navigation: links can receive focus and activate with Enter @
- TFFU-144: HTTPS/SSL: secure links remain on HTTPS when marked as secure @
- TFFU-149: navigation link health: Hand Tools @
- TFFU-150: link health: internal, external, and download links do not return broken responses @
- TFFU-155: keyboard navigation: links can receive focus and activate with Enter @
- TFFU-157: HTTPS/SSL: secure links remain on HTTPS when marked as secure @
- TFFU-161: navigation link health: Hand Tools @
- TFFU-162: link health: internal, external, and download links do not return broken responses @
- TFFU-167: keyboard navigation: links can receive focus and activate with Enter @
- TFFU-169: HTTPS/SSL: secure links remain on HTTPS when marked as secure @
- TFFU-173: navigation link health: Hand Tools @
- TFFU-174: link health: internal, external, and download links do not return broken responses @
- TFFU-179: keyboard navigation: links can receive focus and activate with Enter @
- TFFU-181: HTTPS/SSL: secure links remain on HTTPS when marked as secure @
- TFFU-185: navigation link health: Hand Tools @
- TFFU-186: link health: internal, external, and download links do not return broken responses @
- TFFU-191: keyboard navigation: links can receive focus and activate with Enter @
- TFFU-193: HTTPS/SSL: secure links remain on HTTPS when marked as secure @
- TFFU-197: navigation link health: Hand Tools @
- TFFU-198: link health: internal, external, and download links do not return broken responses @
- TFFU-203: keyboard navigation: links can receive focus and activate with Enter @
- TFFU-205: HTTPS/SSL: secure links remain on HTTPS when marked as secure @
- TFFU-209: navigation link health: Hand Tools @
- TFFU-210: link health: internal, external, and download links do not return broken responses @
- TFFU-215: keyboard navigation: links can receive focus and activate with Enter @
- TFFU-217: HTTPS/SSL: secure links remain on HTTPS when marked as secure @
- TFFU-219: sort options order the items on / @/
- TFFU-220: filters send and respect the chosen values on / @/
- TFFU-222: quantity steppers change the value by one on /product/01M5FXC1SQZJGRE0Y1X41HXZZ0 @/product/01M5FXC1SQZJGRE0Y1X41HXZZ0
- TFFU-223: sort options order the items on /category/hand-tools @/category/hand-tools
- TFFU-224: filters send and respect the chosen values on /category/hand-tools @/category/hand-tools
- TFFU-228: navigation links land where their text says, from / @/
- TFUS-038: the same components look the same on every inspected page (recorded as findings) @/
- TFRM-001: keeps the core journey visible across common viewport sizes @
- TFRM-002: responds to a touch tap at mobile viewport @
- TFPL-003: page weight stays under 5 MB @
- TFPL-004: no same-origin request fails while the page loads @
- TFSC-034: a page that cannot exist shows no stack trace or server file path @(missing-page probe)
- TFRL-001: dependency failure injection: api.practicesoftwaretesting.com [xhr-fetch] @
- TFRL-002: dependency failure injection: practicesoftwaretesting.com [xhr-fetch] @
- TFRL-003: dependency failure injection: static.cloudflareinsights.com [third-party-script] @
- TFRL-004: dependency failure injection: www.google-analytics.com [xhr-fetch] @
- TFRL-005: dependency failure injection: www.googletagmanager.com [third-party-script] @
- TFRL-006: dependency failure injection: www.google.com [xhr-fetch] @
- TFRL-007: storage failure injection: localStorage on / @
- TFRL-008: storage failure injection: sessionStorage on / @
- TFRL-009: storage failure injection: localStorage on /product/01M5FXC1SQZJGRE0Y1X41HXZZ0 @
- TFRL-010: storage failure injection: sessionStorage on /product/01M5FXC1SQZJGRE0Y1X41HXZZ0 @
- TFRL-011: storage failure injection: localStorage on /category/hand-tools @
- TFRL-012: storage failure injection: sessionStorage on /category/hand-tools @
- TFRL-013: storage failure injection: localStorage on /auth/register @
- TFRL-014: storage failure injection: sessionStorage on /auth/register @
- TFRL-015: storage failure injection: localStorage on /contact @
- TFRL-016: storage failure injection: sessionStorage on /contact @
- TFRL-017: storage failure injection: localStorage on /auth/login @
- TFRL-018: storage failure injection: sessionStorage on /auth/login @
- TFRL-019: storage failure injection: localStorage on /auth/forgot-password @
- TFRL-020: storage failure injection: sessionStorage on /auth/forgot-password @
- TFRL-021: storage failure injection: localStorage on /rentals @
- TFRL-022: storage failure injection: sessionStorage on /rentals @
- TFCS-001: session cookies set by the site expire and stay scoped to it @
- TFSE-050: publishes robots.txt with a sitemap reference @
- TFSE-051: publishes sitemap.xml with at least one URL @
- TFFU-001: loads the target page and shows visible content @
- TFFU-002: shows at least one interactive element related to the scenario @
- TFFU-003: action element check: Testing Guide [button] @
- TFFU-004: action element check: 🐛 Bug Hunting [button] @
- TFFU-005: navigation element check: Toggle navigation [button] @
- TFFU-006: navigation element check: Categories [button] @
- TFFU-007: navigation element check: EN [button] @
- TFFU-008: form element check: Filters [button] @
- TFFU-009: form element check: Name (A - Z)Name (Z - A)Price (High - Low)Price (Low - High)CO₂ Rating (A - E)CO₂ Rating (E - A) [Sort] [form] @
- TFFU-010: form element check: Name (A - Z)Name (Z - A)Price (High - Low)Price (Low - High)CO₂ Rating (A - E)CO₂ Rating (E - A) [Sort] [select] @
- TFFU-011: form element check: SearchX Search [Search] [form] @
- TFFU-012: form element check: Search [Search] [input] @
- TFFU-013: form element check: X [Search] [button] @
- TFFU-014: form element check: Search [Search] [button] @
- TFFU-015: form element check: 01M5FXC1QKGT4YKH93ET4KCR5S [Categories] [input] @
- TFFU-016: form element check: 01M5FXC1R2QHMPHCRFCZ4MC33K [Categories] [input] @
- TFFU-017: form element check: 01M5FXC1R2QHMPHCRFCZ4MC33M [Categories] [input] @
- TFFU-018: form element check: 01M5FXC1R2QHMPHCRFCZ4MC33N [Categories] [input] @
- TFFU-019: form element check: 01M5FXC1R2QHMPHCRFCZ4MC33P [Categories] [input] @
- TFFU-020: form element check: 01M5FXC1R2QHMPHCRFCZ4MC33Q [Categories] [input] @
- TFFU-021: form element check: 01M5FXC1R2QHMPHCRFCZ4MC33R [Categories] [input] @
- TFFU-022: form element check: 01M5FXC1R2QHMPHCRFCZ4MC33S [Categories] [input] @
- TFFU-023: form element check: 01M5FXC1QKGT4YKH93ET4KCR5T [Categories] [input] @
- TFFU-024: form element check: 01M5FXC1R2QHMPHCRFCZ4MC33T [Categories] [input] @
- TFFU-122: navigation link health: Untitled link to https://practicesoftwaretesting.com/ @
- TFFU-123: navigation link health: Home @
- TFFU-126: link types: internal, external, anchor, mailto, and download links are classified correctly @
- TFFU-127: visual representation: links are distinguishable from surrounding text @
- TFFU-129: visited style configuration: stylesheet defines visited-link styling when same-origin rules are inspectable @
- TFFU-131: technical security: link protocols are safe and do not expose obvious XSS vectors @
- TFFU-221: option lists show no error text on / @/
- TFFU-229: link "Documentation" on /: on the page, named, with a valid href @/
- TFFU-230: link "https://practicesoftwaretesting.com/" on /: on the page, named, with a valid href @/
- TFFU-231: link "Home" on /: on the page, named, with a valid href @/
- TFFU-232: link "Hand Tools" on /: on the page, named, with a valid href @/
- TFFU-233: link "Power Tools" on /: on the page, named, with a valid href @/
- TFFU-234: link "Other" on /: on the page, named, with a valid href @/
- TFFU-235: link "Special Tools" on /: on the page, named, with a valid href @/
- TFFU-236: link "Rentals" on /: on the page, named, with a valid href @/
- TFFU-237: link "Contact" on /: on the page, named, with a valid href @/
- TFFU-238: link "Sign in" on /: on the page, named, with a valid href @/
- TFFU-239: link "Explore courses" on /: on the page, named, with a valid href @/
- TFFU-240: cards linking to /product/:id on /: each on the page, named, with a valid href @/
- TFFU-241: link "Learn Test AutomationHands-on courses for Playwright, Robot Framework, APIs and more" on /: on the page, named, with a valid href @/
- TFFU-242: link "API SpectorOpen-source API testing, mocking and contract testing" on /: on the page, named, with a valid href @/
- TFFU-243: link "GitHubSource code, issues and contributions" on /: on the page, named, with a valid href @/
- TFFU-244: link "Privacy Policy" on /: on the page, named, with a valid href @/
- TFFU-245: link "Barn Images" on /: on the page, named, with a valid href @/
- TFFU-246: link "Unsplash" on /: on the page, named, with a valid href @/
- TFUS-001: keeps navigation and guidance visible for a first-time user @
- TFUS-002: usability: Search [input] uses non-generic guidance text @
- TFUS-003: usability: 01M5FXC1QKGT4YKH93ET4KCR5S [input] uses non-generic guidance text @
- TFUS-004: usability: 01M5FXC1R2QHMPHCRFCZ4MC33K [input] uses non-generic guidance text @
- TFUS-005: usability: 01M5FXC1R2QHMPHCRFCZ4MC33M [input] uses non-generic guidance text @
- TFUS-006: usability: 01M5FXC1R2QHMPHCRFCZ4MC33N [input] uses non-generic guidance text @
- TFUS-007: usability: 01M5FXC1R2QHMPHCRFCZ4MC33P [input] uses non-generic guidance text @
- TFUS-008: usability: 01M5FXC1R2QHMPHCRFCZ4MC33Q [input] uses non-generic guidance text @
- TFUS-009: usability: 01M5FXC1R2QHMPHCRFCZ4MC33R [input] uses non-generic guidance text @
- TFUS-010: usability: 01M5FXC1R2QHMPHCRFCZ4MC33S [input] uses non-generic guidance text @
- TFUS-011: usability: 01M5FXC1QKGT4YKH93ET4KCR5T [input] uses non-generic guidance text @
- TFUS-012: usability: 01M5FXC1R2QHMPHCRFCZ4MC33T [input] uses non-generic guidance text @
- TFUS-014: / keeps its forms, lists and cards consistent (recorded as findings) @/
- TFUS-015: / has no overlapping controls @/
- TFUS-016: / shows every image it loads @/
- TFAC-001: exposes basic accessible structure for assistive technologies @
- TFAC-006: accessible name and role: Toggle navigation [button] @
- TFAC-009: accessible name and role: Hand Tools [link] @
- TFAC-010: accessible name and role: Power Tools [link] @
- TFAC-011: accessible name and role: Other [link] @
- TFAC-012: accessible name and role: Special Tools [link] @
- TFAC-013: accessible name and role: Rentals [link] @
- TFAC-017: accessible name and role: DE [link] @
- TFAC-018: accessible name and role: EL [link] @
- TFAC-019: accessible name and role: EN [link] @
- TFAC-020: accessible name and role: ES [link] @
- TFAC-021: accessible name and role: FR [link] @
- TFAC-022: accessible name and role: NL [link] @
- TFAC-023: accessible name and role: TR [link] @
- TFAC-025: accessible name and role: Filters [button] @
- TFAC-058: / groups its checkboxes and radio buttons @/
- TFSE-001: exposes core SEO and content signals on the landing page @
- TFSE-002: / spells its interface text correctly (recorded as findings) @/
- TFSE-010: keeps page title stable for / @
- TFSE-011: keeps meta description stable for / @
- TFSE-012: keeps heading structure stable for / @
- TFSE-013: keeps canonical metadata stable for / @
- TFSE-014: exposes structured data for / (recorded as a finding when missing) @
- TFSE-052: publishes manifest metadata for installable clients (recorded as a finding when missing) @
- TFSC-001: uses HTTPS for the requested public test target @
- TFSC-002: / sends its security headers and session cookies @/
- TFSC-003: / names no software version in its response headers @/
- TFSC-004: / keeps passwords off plain HTTP @/
- TFSC-005: / puts no password or session token in a URL @/
- TFFU-128: hover state: links show pointer cursor and preserve tooltip attributes @
- TFAC-002: accessible name and role: Documentation [link] @
- TFAC-003: accessible name and role: Testing Guide [button] @
- TFAC-004: accessible name and role: 🐛 Bug Hunting [button] @
- TFAC-005: accessible name and role: Untitled link to https://practicesoftwaretesting.com/ [link] @
- TFAC-007: accessible name and role: Home [link] @
- TFAC-008: accessible name and role: Categories [button] @
- TFAC-014: accessible name and role: Contact [link] @
- TFAC-015: accessible name and role: Sign in [link] @
- TFAC-016: accessible name and role: EN [button] @
- TFAC-024: accessible name and role: Explore courses [link] @
- TFAC-026: accessible name and role: Name (A - Z)Name (Z - A)Price (High - Low)Price (Low - High)CO₂ Rating (A - E)CO₂ Rating (E - A) [form] @
- TFAC-027: accessible name and role: Name (A - Z)Name (Z - A)Price (High - Low)Price (Low - High)CO₂ Rating (A - E)CO₂ Rating (E - A) [select] @
- TFAC-028: accessible name and role: SearchX Search [form] @
- TFAC-029: accessible name and role: Search [input] @
- TFAC-030: accessible name and role: X [button] @
- TFAC-031: accessible name and role: Search [button] @
- TFAC-032: accessible name and role: 01M5FXC1QKGT4YKH93ET4KCR5S [input] @
- TFAC-033: accessible name and role: 01M5FXC1R2QHMPHCRFCZ4MC33K [input] @
- TFAC-034: accessible name and role: 01M5FXC1R2QHMPHCRFCZ4MC33M [input] @
- TFAC-035: accessible name and role: 01M5FXC1R2QHMPHCRFCZ4MC33N [input] @
- TFAC-036: accessible name and role: 01M5FXC1R2QHMPHCRFCZ4MC33P [input] @
- TFAC-037: accessible name and role: 01M5FXC1R2QHMPHCRFCZ4MC33Q [input] @
- TFAC-038: accessible name and role: 01M5FXC1R2QHMPHCRFCZ4MC33R [input] @
- TFAC-039: accessible name and role: 01M5FXC1R2QHMPHCRFCZ4MC33S [input] @
- TFAC-040: accessible name and role: 01M5FXC1QKGT4YKH93ET4KCR5T [input] @
- TFAC-041: accessible name and role: 01M5FXC1R2QHMPHCRFCZ4MC33T [input] @
- TFAC-042: every form field has an accessible name: / @
- TFAC-057: / is tabbed through in reading order @/
- TFAC-049: / passes the WCAG 2.2 A and AA scan @/
- TFFU-025: action element check: Testing Guide [button] @
- TFFU-026: action element check: 🐛 Bug Hunting [button] @
- TFFU-027: navigation element check: Toggle navigation [button] @
- TFFU-028: navigation element check: Categories [button] @
- TFFU-029: navigation element check: EN [button] @
- TFFU-030: action element check: Decrease quantity [Ergonomic claw hammer featuring an advanced shock reduction grip system that absorbs up to 70% of impact vibrations, protecting your wrist, elbow, and shoulder during prolonged nailing sessions. The 450g carbon steel head is precision-balanced and heat-treated for maximum hardness, ensuring accurate nail driving with minimal effort on every swing. The curved claw design effortlessly removes nails without damaging surrounding wood surfaces, making it equally useful for construction and renovation work. A fiberglass-reinforced handle combines lightweight strength with exceptional durability that far outlasts traditional wooden handles. The overmolded soft-grip zone conforms to your hand shape for a custom-feeling, fatigue-free hold throughout long working days. Recommended for professional framing, carpentry, and renovation projects where operator comfort matters as much as striking performance.] [button] @
- TFFU-031: form element check: 1 [Ergonomic claw hammer featuring an advanced shock reduction grip system that absorbs up to 70% of impact vibrations, protecting your wrist, elbow, and shoulder during prolonged nailing sessions. The 450g carbon steel head is precision-balanced and heat-treated for maximum hardness, ensuring accurate nail driving with minimal effort on every swing. The curved claw design effortlessly removes nails without damaging surrounding wood surfaces, making it equally useful for construction and renovation work. A fiberglass-reinforced handle combines lightweight strength with exceptional durability that far outlasts traditional wooden handles. The overmolded soft-grip zone conforms to your hand shape for a custom-feeling, fatigue-free hold throughout long working days. Recommended for professional framing, carpentry, and renovation projects where operator comfort matters as much as striking performance.] [input] @
- TFFU-032: action element check: Increase quantity [Ergonomic claw hammer featuring an advanced shock reduction grip system that absorbs up to 70% of impact vibrations, protecting your wrist, elbow, and shoulder during prolonged nailing sessions. The 450g carbon steel head is precision-balanced and heat-treated for maximum hardness, ensuring accurate nail driving with minimal effort on every swing. The curved claw design effortlessly removes nails without damaging surrounding wood surfaces, making it equally useful for construction and renovation work. A fiberglass-reinforced handle combines lightweight strength with exceptional durability that far outlasts traditional wooden handles. The overmolded soft-grip zone conforms to your hand shape for a custom-feeling, fatigue-free hold throughout long working days. Recommended for professional framing, carpentry, and renovation projects where operator comfort matters as much as striking performance.] [button] @
- TFFU-033: action element check: Add to cart [Ergonomic claw hammer featuring an advanced shock reduction grip system that absorbs up to 70% of impact vibrations, protecting your wrist, elbow, and shoulder during prolonged nailing sessions. The 450g carbon steel head is precision-balanced and heat-treated for maximum hardness, ensuring accurate nail driving with minimal effort on every swing. The curved claw design effortlessly removes nails without damaging surrounding wood surfaces, making it equally useful for construction and renovation work. A fiberglass-reinforced handle combines lightweight strength with exceptional durability that far outlasts traditional wooden handles. The overmolded soft-grip zone conforms to your hand shape for a custom-feeling, fatigue-free hold throughout long working days. Recommended for professional framing, carpentry, and renovation projects where operator comfort matters as much as striking performance.] [button] @
- TFFU-034: action element check: Add to favourites [Ergonomic claw hammer featuring an advanced shock reduction grip system that absorbs up to 70% of impact vibrations, protecting your wrist, elbow, and shoulder during prolonged nailing sessions. The 450g carbon steel head is precision-balanced and heat-treated for maximum hardness, ensuring accurate nail driving with minimal effort on every swing. The curved claw design effortlessly removes nails without damaging surrounding wood surfaces, making it equally useful for construction and renovation work. A fiberglass-reinforced handle combines lightweight strength with exceptional durability that far outlasts traditional wooden handles. The overmolded soft-grip zone conforms to your hand shape for a custom-feeling, fatigue-free hold throughout long working days. Recommended for professional framing, carpentry, and renovation projects where operator comfort matters as much as striking performance.] [button] @
- TFFU-035: action element check: Compare [Ergonomic claw hammer featuring an advanced shock reduction grip system that absorbs up to 70% of impact vibrations, protecting your wrist, elbow, and shoulder during prolonged nailing sessions. The 450g carbon steel head is precision-balanced and heat-treated for maximum hardness, ensuring accurate nail driving with minimal effort on every swing. The curved claw design effortlessly removes nails without damaging surrounding wood surfaces, making it equally useful for construction and renovation work. A fiberglass-reinforced handle combines lightweight strength with exceptional durability that far outlasts traditional wooden handles. The overmolded soft-grip zone conforms to your hand shape for a custom-feeling, fatigue-free hold throughout long working days. Recommended for professional framing, carpentry, and renovation projects where operator comfort matters as much as striking performance.] [button] @
- TFFU-134: navigation link health: Untitled link to https://practicesoftwaretesting.com/ @
- TFFU-135: navigation link health: Home @
- TFFU-138: link types: internal, external, anchor, mailto, and download links are classified correctly @
- TFFU-139: visual representation: links are distinguishable from surrounding text @
- TFFU-141: visited style configuration: stylesheet defines visited-link styling when same-origin rules are inspectable @
- TFFU-143: technical security: link protocols are safe and do not expose obvious XSS vectors @
- TFFU-247: link "iMattSmart" on /product/01M5FXC1SQZJGRE0Y1X41HXZZ0: on the page, named, with a valid href @/product/01M5FXC1SQZJGRE0Y1X41HXZZ0
- TFFU-248: link "Unsplash" to https://unsplash.com/photos/jaLaLQdkBOE on /product/01M5FXC1SQZJGRE0Y1X41HXZZ0: on the page, named, with a valid href @/product/01M5FXC1SQZJGRE0Y1X41HXZZ0
- TFFU-249: cards linking to /product/:id on /product/01M5FXC1SQZJGRE0Y1X41HXZZ0: each on the page, named, with a valid href @/product/01M5FXC1SQZJGRE0Y1X41HXZZ0
- TFFU-250: link "More information" on /product/01M5FXC1SQZJGRE0Y1X41HXZZ0: on the page, named, with a valid href @/product/01M5FXC1SQZJGRE0Y1X41HXZZ0
- TFUS-017: /product/01M5FXC1SQZJGRE0Y1X41HXZZ0 keeps its forms, lists and cards consistent (recorded as findings) @/product/01M5FXC1SQZJGRE0Y1X41HXZZ0
- TFUS-018: /product/01M5FXC1SQZJGRE0Y1X41HXZZ0 has no overlapping controls @/product/01M5FXC1SQZJGRE0Y1X41HXZZ0
- TFUS-019: /product/01M5FXC1SQZJGRE0Y1X41HXZZ0 shows every image it loads @/product/01M5FXC1SQZJGRE0Y1X41HXZZ0
- TFAC-060: /product/01M5FXC1SQZJGRE0Y1X41HXZZ0 groups its checkboxes and radio buttons @/product/01M5FXC1SQZJGRE0Y1X41HXZZ0
- TFSE-003: /product/01M5FXC1SQZJGRE0Y1X41HXZZ0 spells its interface text correctly (recorded as findings) @/product/01M5FXC1SQZJGRE0Y1X41HXZZ0
- TFSE-015: keeps page title stable for /product/01M5FXC1SQZJGRE0Y1X41HXZZ0 @
- TFSE-016: keeps meta description stable for /product/01M5FXC1SQZJGRE0Y1X41HXZZ0 @
- TFSE-017: keeps heading structure stable for /product/01M5FXC1SQZJGRE0Y1X41HXZZ0 @
- TFSE-018: keeps canonical metadata stable for /product/01M5FXC1SQZJGRE0Y1X41HXZZ0 @
- TFSE-019: exposes structured data for /product/01M5FXC1SQZJGRE0Y1X41HXZZ0 (recorded as a finding when missing) @
- TFSC-006: /product/01M5FXC1SQZJGRE0Y1X41HXZZ0 sends its security headers and session cookies @/product/01M5FXC1SQZJGRE0Y1X41HXZZ0
- TFSC-007: /product/01M5FXC1SQZJGRE0Y1X41HXZZ0 names no software version in its response headers @/product/01M5FXC1SQZJGRE0Y1X41HXZZ0
- TFSC-008: /product/01M5FXC1SQZJGRE0Y1X41HXZZ0 keeps passwords off plain HTTP @/product/01M5FXC1SQZJGRE0Y1X41HXZZ0
- TFSC-009: /product/01M5FXC1SQZJGRE0Y1X41HXZZ0 puts no password or session token in a URL @/product/01M5FXC1SQZJGRE0Y1X41HXZZ0
- TFFU-140: hover state: links show pointer cursor and preserve tooltip attributes @
- TFFU-145: anchor links point to existing in-page targets @
- TFAC-043: every form field has an accessible name: /product/01M5FXC1SQZJGRE0Y1X41HXZZ0 @
- TFAC-059: /product/01M5FXC1SQZJGRE0Y1X41HXZZ0 is tabbed through in reading order @/product/01M5FXC1SQZJGRE0Y1X41HXZZ0
- TFAC-050: /product/01M5FXC1SQZJGRE0Y1X41HXZZ0 passes the WCAG 2.2 A and AA scan @/product/01M5FXC1SQZJGRE0Y1X41HXZZ0
- TFFU-036: action element check: Testing Guide [button] @
- TFFU-037: action element check: 🐛 Bug Hunting [button] @
- TFFU-038: navigation element check: Toggle navigation [button] @
- TFFU-039: navigation element check: Categories [button] @
- TFFU-040: navigation element check: EN [button] @
- TFFU-041: form element check: Filters [button] @
- TFFU-042: form element check: Name (A - Z)Name (Z - A)Price (High - Low)Price (Low - High)CO₂ Rating (A - E)CO₂ Rating (E - A) [Sort] [form] @
- TFFU-043: form element check: Name (A - Z)Name (Z - A)Price (High - Low)Price (Low - High)CO₂ Rating (A - E)CO₂ Rating (E - A) [Sort] [select] @
- TFFU-044: form element check: 01M5FXC1QKGT4YKH93ET4KCR5S [By category:] [input] @
- TFFU-045: form element check: 01M5FXC1R2QHMPHCRFCZ4MC33K [Hand Tools] [input] @
- TFFU-046: form element check: 01M5FXC1R2QHMPHCRFCZ4MC33M [Hand Tools] [input] @
- TFFU-047: form element check: 01M5FXC1R2QHMPHCRFCZ4MC33N [Hand Tools] [input] @
- TFFU-048: form element check: 01M5FXC1R2QHMPHCRFCZ4MC33P [Hand Tools] [input] @
- TFFU-049: form element check: 01M5FXC1R2QHMPHCRFCZ4MC33Q [Hand Tools] [input] @
- TFFU-050: form element check: 01M5FXC1R2QHMPHCRFCZ4MC33R [Hand Tools] [input] @
- TFFU-051: form element check: 01M5FXC1R2QHMPHCRFCZ4MC33S [Hand Tools] [input] @
- TFFU-052: form element check: 01M5FXC1CTS5ZRKR9VKWSSC3HQ [By brand:] [input] @
- TFFU-053: form element check: 01M5FXC1CTS5ZRKR9VKWSSC3HR [By brand:] [input] @
- TFFU-054: form element check: on [Eco-Friendly Products] [input] @
- TFFU-055: action element check: Compare [button] @
- TFFU-056: action element check: Compare [button] @
- TFFU-147: navigation link health: Untitled link to https://practicesoftwaretesting.com/ @
- TFFU-148: navigation link health: Home @
- TFFU-151: link types: internal, external, anchor, mailto, and download links are classified correctly @
- TFFU-152: visual representation: links are distinguishable from surrounding text @
- TFFU-154: visited style configuration: stylesheet defines visited-link styling when same-origin rules are inspectable @
- TFFU-156: technical security: link protocols are safe and do not expose obvious XSS vectors @
- TFFU-225: option lists show no error text on /category/hand-tools @/category/hand-tools
- TFFU-251: cards linking to /product/:id on /category/hand-tools: each on the page, named, with a valid href @/category/hand-tools
- TFUS-020: /category/hand-tools keeps its forms, lists and cards consistent (recorded as findings) @/category/hand-tools
- TFUS-021: /category/hand-tools has no overlapping controls @/category/hand-tools
- TFUS-022: /category/hand-tools shows every image it loads @/category/hand-tools
- TFAC-062: /category/hand-tools groups its checkboxes and radio buttons @/category/hand-tools
- TFSE-004: /category/hand-tools spells its interface text correctly (recorded as findings) @/category/hand-tools
- TFSE-020: keeps page title stable for /category/hand-tools @
- TFSE-021: keeps meta description stable for /category/hand-tools @
- TFSE-022: keeps heading structure stable for /category/hand-tools @
- TFSE-023: keeps canonical metadata stable for /category/hand-tools @
- TFSE-024: exposes structured data for /category/hand-tools (recorded as a finding when missing) @
- TFSC-010: /category/hand-tools sends its security headers and session cookies @/category/hand-tools
- TFSC-011: /category/hand-tools names no software version in its response headers @/category/hand-tools
- TFSC-012: /category/hand-tools keeps passwords off plain HTTP @/category/hand-tools
- TFSC-013: /category/hand-tools puts no password or session token in a URL @/category/hand-tools
- TFFU-153: hover state: links show pointer cursor and preserve tooltip attributes @
- TFAC-044: every form field has an accessible name: /category/hand-tools @
- TFAC-061: /category/hand-tools is tabbed through in reading order @/category/hand-tools
- TFAC-051: /category/hand-tools passes the WCAG 2.2 A and AA scan @/category/hand-tools
- TFFU-057: action element check: Testing Guide [button] @
- TFFU-058: action element check: 🐛 Bug Hunting [button] @
- TFFU-059: navigation element check: Toggle navigation [button] @
- TFFU-060: navigation element check: Categories [button] @
- TFFU-061: navigation element check: EN [button] @
- TFFU-062: form element check: First nameLast nameDate of Birth *CountryYour country *AlbaniaÅland IslandsAlgeriaAmerican SamoaAndorraAngolaAnguillaAntarcticaAntigua and BarbudaArgentinaArmeniaArubaAustraliaAustriaAzerbaijanBahamas (the)BahrainBangladeshBarbadosBelarusBelgiumBelizeBeninBermudaBhutanBolivia (Plurinational State of)Bonaire, Sint Eustatius and SabaBosnia and HerzegovinaBotswanaBouvet IslandBrazilBritish Indian Ocean Territory (the)Brunei DarussalamBulgariaBurkina FasoBurundiCabo VerdeCambodiaCameroonCanadaCayman Islands (the)Central African Republic (the)ChadChileChinaChristmas IslandCocos (Keeling) Islands (the)ColombiaComoros (the)Congo (the Democratic Republic of the)Congo (the)Cook Islands (the)Costa RicaCroatiaCubaCuraçaoCyprusCzechiaCôte d'IvoireDenmarkDjiboutiDominicaDominican Republic (the)EcuadorEgyptEl SalvadorEquatorial GuineaEritreaEstoniaEswatiniEthiopiaFalkland Islands (the) [Malvinas]Faroe Islands (the)FijiFinlandFranceFrench GuianaFrench PolynesiaFrench Southern Territories (the)GabonGambia (the)GeorgiaGermanyGhanaGibraltarGreeceGreenlandGrenadaGuadeloupeGuamGuatemalaGuernseyGuineaGuinea-BissauGuyanaHaitiHeard Island and McDonald IslandsHoly See (the)HondurasHong KongHungaryIcelandIndiaIndonesiaIran (Islamic Republic of)IraqIrelandIsle of ManIsraelItalyJamaicaJapanJerseyJordanKazakhstanKenyaKiribatiKorea (the Democratic People's Republic of)Korea (the Republic of)KuwaitKyrgyzstanLao People's Democratic Republic (the)LatviaLebanonLesothoLiberiaLibyaLiechtensteinLithuaniaLuxembourgMacaoMadagascarMalawiMalaysiaMaldivesMaliMaltaMarshall Islands (the)MartiniqueMauritaniaMauritiusMayotteMexicoMicronesia (Federated States of)Moldova (the Republic of)MonacoMongoliaMontenegroMontserratMoroccoMozambiqueMyanmarNamibiaNauruNepalNetherlands (the)New CaledoniaNew ZealandNicaraguaNiger (the)NigeriaNiueNorfolk IslandNorthern Mariana Islands (the)NorwayOmanPakistanPalauPalestine, State ofPanamaPapua New GuineaParaguayPeruPhilippines (the)PitcairnPolandPortugalPuerto RicoQatarRepublic of North MacedoniaRomaniaRussian Federation (the)RwandaRéunionSaint BarthélemySaint Helena, Ascension and Tristan da CunhaSaint Kitts and NevisSaint LuciaSaint Martin (French part)Saint Pierre and MiquelonSaint Vincent and the GrenadinesSamoaSan MarinoSao Tome and PrincipeSaudi ArabiaSenegalSerbiaSeychellesSierra LeoneSingaporeSint Maarten (Dutch part)SlovakiaSloveniaSolomon IslandsSomaliaSouth AfricaSouth Georgia and the South Sandwich IslandsSouth SudanSpainSri LankaSudan (the)SurinameSvalbard and Jan MayenSwedenSwitzerlandSyrian Arab RepublicTaiwan (Province of China)TajikistanTanzania, United Republic ofThailandTimor-LesteTogoTokelauTongaTrinidad and TobagoTunisiaTurkeyTurkmenistanTurks and Caicos Islands (the)TuvaluUgandaUkraineUnited Arab Emirates (the)United Kingdom of Great Britain and Northern Ireland (the)United States Minor Outlying Islands (the)United States of America (the)UruguayUzbekistanVanuatuVenezuela (Bolivarian Republic of)Viet NamVirgin Islands (British)Virgin Islands (U.S.)Wallis and FutunaWestern SaharaYemenZambiaZimbabwe Choose your country and enter the postal code and house number. Street, city and state will be filled in automatically. Postal codeHouse numberStreetCityStatePhoneEmail addressPassword Your password must: Be at least 8 characters long Contain both uppercase and lowercase letters Include at least one number Have at least one special symbol (e.g., @, #, $, etc.) Password strength: WeakModerateStrongVery StrongExcellentRegister [Customer registration] [form] @
- TFFU-063: form element check: First name * [Customer registration] [input] @
- TFFU-064: form element check: Your last name * [Customer registration] [input] @
- TFFU-065: form element check: YYYY-MM-DD [Customer registration] [input] @
- TFFU-066: form element check: Your country *AlbaniaÅland IslandsAlgeriaAmerican SamoaAndorraAngolaAnguillaAntarcticaAntigua and BarbudaArgentinaArmeniaArubaAustraliaAustriaAzerbaijanBahamas (the)BahrainBangladeshBarbadosBelarusBelgiumBelizeBeninBermudaBhutanBolivia (Plurinational State of)Bonaire, Sint Eustatius and SabaBosnia and HerzegovinaBotswanaBouvet IslandBrazilBritish Indian Ocean Territory (the)Brunei DarussalamBulgariaBurkina FasoBurundiCabo VerdeCambodiaCameroonCanadaCayman Islands (the)Central African Republic (the)ChadChileChinaChristmas IslandCocos (Keeling) Islands (the)ColombiaComoros (the)Congo (the Democratic Republic of the)Congo (the)Cook Islands (the)Costa RicaCroatiaCubaCuraçaoCyprusCzechiaCôte d'IvoireDenmarkDjiboutiDominicaDominican Republic (the)EcuadorEgyptEl SalvadorEquatorial GuineaEritreaEstoniaEswatiniEthiopiaFalkland Islands (the) [Malvinas]Faroe Islands (the)FijiFinlandFranceFrench GuianaFrench PolynesiaFrench Southern Territories (the)GabonGambia (the)GeorgiaGermanyGhanaGibraltarGreeceGreenlandGrenadaGuadeloupeGuamGuatemalaGuernseyGuineaGuinea-BissauGuyanaHaitiHeard Island and McDonald IslandsHoly See (the)HondurasHong KongHungaryIcelandIndiaIndonesiaIran (Islamic Republic of)IraqIrelandIsle of ManIsraelItalyJamaicaJapanJerseyJordanKazakhstanKenyaKiribatiKorea (the Democratic People's Republic of)Korea (the Republic of)KuwaitKyrgyzstanLao People's Democratic Republic (the)LatviaLebanonLesothoLiberiaLibyaLiechtensteinLithuaniaLuxembourgMacaoMadagascarMalawiMalaysiaMaldivesMaliMaltaMarshall Islands (the)MartiniqueMauritaniaMauritiusMayotteMexicoMicronesia (Federated States of)Moldova (the Republic of)MonacoMongoliaMontenegroMontserratMoroccoMozambiqueMyanmarNamibiaNauruNepalNetherlands (the)New CaledoniaNew ZealandNicaraguaNiger (the)NigeriaNiueNorfolk IslandNorthern Mariana Islands (the)NorwayOmanPakistanPalauPalestine, State ofPanamaPapua New GuineaParaguayPeruPhilippines (the)PitcairnPolandPortugalPuerto RicoQatarRepublic of North MacedoniaRomaniaRussian Federation (the)RwandaRéunionSaint BarthélemySaint Helena, Ascension and Tristan da CunhaSaint Kitts and NevisSaint LuciaSaint Martin (French part)Saint Pierre and MiquelonSaint Vincent and the GrenadinesSamoaSan MarinoSao Tome and PrincipeSaudi ArabiaSenegalSerbiaSeychellesSierra LeoneSingaporeSint Maarten (Dutch part)SlovakiaSloveniaSolomon IslandsSomaliaSouth AfricaSouth Georgia and the South Sandwich IslandsSouth SudanSpainSri LankaSudan (the)SurinameSvalbard and Jan MayenSwedenSwitzerlandSyrian Arab RepublicTaiwan (Province of China)TajikistanTanzania, United Republic ofThailandTimor-LesteTogoTokelauTongaTrinidad and TobagoTunisiaTurkeyTurkmenistanTurks and Caicos Islands (the)TuvaluUgandaUkraineUnited Arab Emirates (the)United Kingdom of Great Britain and Northern Ireland (the)United States Minor Outlying Islands (the)United States of America (the)UruguayUzbekistanVanuatuVenezuela (Bolivarian Republic of)Viet NamVirgin Islands (British)Virgin Islands (U.S.)Wallis and FutunaWestern SaharaYemenZambiaZimbabwe [Customer registration] [select] @
- TFFU-067: form element check: Your Postcode * [Customer registration] [input] @
- TFFU-068: form element check: e.g. 42 * [Customer registration] [input] @
- TFFU-069: form element check: Your Street * [Customer registration] [input] @
- TFFU-070: form element check: Your City * [Customer registration] [input] @
- TFFU-071: form element check: Your State * [Customer registration] [input] @
- TFFU-072: form element check: Your phone * [Customer registration] [input] @
- TFFU-073: form element check: Your email * [Customer registration] [input] @
- TFFU-074: form element check: Your password [Password] [input] @
- TFFU-075: action element check: Untitled button [Password] [button] @
- TFFU-076: form element check: Register [Customer registration] [button] @
- TFFU-159: navigation link health: Untitled link to https://practicesoftwaretesting.com/ @
- TFFU-160: navigation link health: Home @
- TFFU-163: link types: internal, external, anchor, mailto, and download links are classified correctly @
- TFFU-164: visual representation: links are distinguishable from surrounding text @
- TFFU-166: visited style configuration: stylesheet defines visited-link styling when same-origin rules are inspectable @
- TFFU-168: technical security: link protocols are safe and do not expose obvious XSS vectors @
- TFFU-226: option lists show no error text on /auth/register @/auth/register
- TFUS-023: /auth/register keeps its forms, lists and cards consistent (recorded as findings) @/auth/register
- TFUS-024: /auth/register has no overlapping controls @/auth/register
- TFUS-025: /auth/register shows every image it loads @/auth/register
- TFAC-064: /auth/register groups its checkboxes and radio buttons @/auth/register
- TFSE-005: /auth/register spells its interface text correctly (recorded as findings) @/auth/register
- TFSE-025: keeps page title stable for /auth/register @
- TFSE-026: keeps meta description stable for /auth/register @
- TFSE-027: keeps heading structure stable for /auth/register @
- TFSE-028: keeps canonical metadata stable for /auth/register @
- TFSE-029: exposes structured data for /auth/register (recorded as a finding when missing) @
- TFSC-014: /auth/register sends its security headers and session cookies @/auth/register
- TFSC-015: /auth/register names no software version in its response headers @/auth/register
- TFSC-016: /auth/register keeps passwords off plain HTTP @/auth/register
- TFSC-017: /auth/register puts no password or session token in a URL @/auth/register
- TFFU-165: hover state: links show pointer cursor and preserve tooltip attributes @
- TFAC-045: every form field has an accessible name: /auth/register @
- TFAC-063: /auth/register is tabbed through in reading order @/auth/register
- TFAC-052: /auth/register passes the WCAG 2.2 A and AA scan @/auth/register
- TFFU-077: action element check: Testing Guide [button] @
- TFFU-078: action element check: 🐛 Bug Hunting [button] @
- TFFU-079: navigation element check: Toggle navigation [button] @
- TFFU-080: navigation element check: Categories [button] @
- TFFU-081: navigation element check: EN [button] @
- TFFU-082: form element check: First nameLast nameEmail addressSubjectSelect a subject *Customer serviceWebmasterReturnPaymentsWarrantyStatus of my orderMessage * AttachmentOnly files with the txt extension are allowed, and files must be 0kb. [Contact] [form] @
- TFFU-083: form element check: Your first name * [Contact] [input] @
- TFFU-084: form element check: Your last name * [Contact] [input] @
- TFFU-085: form element check: Your email * [Contact] [input] @
- TFFU-086: form element check: Select a subject *Customer serviceWebmasterReturnPaymentsWarrantyStatus of my order [Contact] [select] @
- TFFU-087: form element check: Message * [Message *] [textarea] @
- TFFU-088: form element check: Attachment [Attachment] [input] @
- TFFU-089: form element check: Send [Contact] [button] @
- TFFU-090: navigation element check: Open chat [button] @
- TFFU-091: action element check: Show live shop activity [button] @
- TFFU-171: navigation link health: Untitled link to https://practicesoftwaretesting.com/ @
- TFFU-172: navigation link health: Home @
- TFFU-175: link types: internal, external, anchor, mailto, and download links are classified correctly @
- TFFU-176: visual representation: links are distinguishable from surrounding text @
- TFFU-178: visited style configuration: stylesheet defines visited-link styling when same-origin rules are inspectable @
- TFFU-180: technical security: link protocols are safe and do not expose obvious XSS vectors @
- TFFU-227: option lists show no error text on /contact @/contact
- TFUS-026: /contact keeps its forms, lists and cards consistent (recorded as findings) @/contact
- TFUS-027: /contact has no overlapping controls @/contact
- TFUS-028: /contact shows every image it loads @/contact
- TFAC-066: /contact groups its checkboxes and radio buttons @/contact
- TFSE-006: /contact spells its interface text correctly (recorded as findings) @/contact
- TFSE-030: keeps page title stable for /contact @
- TFSE-031: keeps meta description stable for /contact @
- TFSE-032: keeps heading structure stable for /contact @
- TFSE-033: keeps canonical metadata stable for /contact @
- TFSE-034: exposes structured data for /contact (recorded as a finding when missing) @
- TFSC-018: /contact sends its security headers and session cookies @/contact
- TFSC-019: /contact names no software version in its response headers @/contact
- TFSC-020: /contact keeps passwords off plain HTTP @/contact
- TFSC-021: /contact puts no password or session token in a URL @/contact
- TFFU-177: hover state: links show pointer cursor and preserve tooltip attributes @
- TFAC-046: every form field has an accessible name: /contact @
- TFAC-065: /contact is tabbed through in reading order @/contact
- TFAC-053: /contact passes the WCAG 2.2 A and AA scan @/contact
- TFFU-092: action element check: Testing Guide [button] @
- TFFU-093: action element check: 🐛 Bug Hunting [button] @
- TFFU-094: navigation element check: Toggle navigation [button] @
- TFFU-095: navigation element check: Categories [button] @
- TFFU-096: navigation element check: EN [button] @
- TFFU-097: form element check: Sign in with Google [Login] [button] @
- TFFU-098: form element check: Email address *Password * [Login] [form] @
- TFFU-099: form element check: Your email [Login] [input] @
- TFFU-100: form element check: Your password [Password *] [input] @
- TFFU-101: action element check: Untitled button [Password *] [button] @
- TFFU-102: form element check: Login [Login] [button] @
- TFFU-103: navigation element check: Open chat [button] @
- TFFU-104: action element check: Show live shop activity [button] @
- TFFU-183: navigation link health: Untitled link to https://practicesoftwaretesting.com/ @
- TFFU-184: navigation link health: Home @
- TFFU-187: link types: internal, external, anchor, mailto, and download links are classified correctly @
- TFFU-188: visual representation: links are distinguishable from surrounding text @
- TFFU-190: visited style configuration: stylesheet defines visited-link styling when same-origin rules are inspectable @
- TFFU-192: technical security: link protocols are safe and do not expose obvious XSS vectors @
- TFFU-252: link "Register your account" on /auth/login: on the page, named, with a valid href @/auth/login
- TFFU-253: link "Forgot your Password?" on /auth/login: on the page, named, with a valid href @/auth/login
- TFUS-029: /auth/login keeps its forms, lists and cards consistent (recorded as findings) @/auth/login
- TFUS-030: /auth/login has no overlapping controls @/auth/login
- TFUS-031: /auth/login shows every image it loads @/auth/login
- TFAC-068: /auth/login groups its checkboxes and radio buttons @/auth/login
- TFSE-007: /auth/login spells its interface text correctly (recorded as findings) @/auth/login
- TFSE-035: keeps page title stable for /auth/login @
- TFSE-036: keeps meta description stable for /auth/login @
- TFSE-037: keeps heading structure stable for /auth/login @
- TFSE-038: keeps canonical metadata stable for /auth/login @
- TFSE-039: exposes structured data for /auth/login (recorded as a finding when missing) @
- TFSC-022: /auth/login sends its security headers and session cookies @/auth/login
- TFSC-023: /auth/login names no software version in its response headers @/auth/login
- TFSC-024: /auth/login keeps passwords off plain HTTP @/auth/login
- TFSC-025: /auth/login puts no password or session token in a URL @/auth/login
- TFFU-189: hover state: links show pointer cursor and preserve tooltip attributes @
- TFAC-047: every form field has an accessible name: /auth/login @
- TFAC-067: /auth/login is tabbed through in reading order @/auth/login
- TFAC-054: /auth/login passes the WCAG 2.2 A and AA scan @/auth/login
- TFFU-105: action element check: Testing Guide [button] @
- TFFU-106: action element check: 🐛 Bug Hunting [button] @
- TFFU-107: navigation element check: Toggle navigation [button] @
- TFFU-108: navigation element check: Categories [button] @
- TFFU-109: navigation element check: EN [button] @
- TFFU-110: form element check: Email address * [Forgot Password] [form] @
- TFFU-111: form element check: Your email [Forgot Password] [input] @
- TFFU-112: action element check: Set New Password [Forgot Password] [button] @
- TFFU-113: navigation element check: Open chat [button] @
- TFFU-114: action element check: Show live shop activity [button] @
- TFFU-195: navigation link health: Untitled link to https://practicesoftwaretesting.com/ @
- TFFU-196: navigation link health: Home @
- TFFU-199: link types: internal, external, anchor, mailto, and download links are classified correctly @
- TFFU-200: visual representation: links are distinguishable from surrounding text @
- TFFU-202: visited style configuration: stylesheet defines visited-link styling when same-origin rules are inspectable @
- TFFU-204: technical security: link protocols are safe and do not expose obvious XSS vectors @
- TFUS-032: /auth/forgot-password keeps its forms, lists and cards consistent (recorded as findings) @/auth/forgot-password
- TFUS-033: /auth/forgot-password has no overlapping controls @/auth/forgot-password
- TFUS-034: /auth/forgot-password shows every image it loads @/auth/forgot-password
- TFAC-070: /auth/forgot-password groups its checkboxes and radio buttons @/auth/forgot-password
- TFSE-008: /auth/forgot-password spells its interface text correctly (recorded as findings) @/auth/forgot-password
- TFSE-040: keeps page title stable for /auth/forgot-password @
- TFSE-041: keeps meta description stable for /auth/forgot-password @
- TFSE-042: keeps heading structure stable for /auth/forgot-password @
- TFSE-043: keeps canonical metadata stable for /auth/forgot-password @
- TFSE-044: exposes structured data for /auth/forgot-password (recorded as a finding when missing) @
- TFSC-026: /auth/forgot-password sends its security headers and session cookies @/auth/forgot-password
- TFSC-027: /auth/forgot-password names no software version in its response headers @/auth/forgot-password
- TFSC-028: /auth/forgot-password keeps passwords off plain HTTP @/auth/forgot-password
- TFSC-029: /auth/forgot-password puts no password or session token in a URL @/auth/forgot-password
- TFFU-201: hover state: links show pointer cursor and preserve tooltip attributes @
- TFAC-048: every form field has an accessible name: /auth/forgot-password @
- TFAC-069: /auth/forgot-password is tabbed through in reading order @/auth/forgot-password
- TFAC-055: /auth/forgot-password passes the WCAG 2.2 A and AA scan @/auth/forgot-password
- TFFU-115: action element check: Testing Guide [button] @
- TFFU-116: action element check: 🐛 Bug Hunting [button] @
- TFFU-117: navigation element check: Toggle navigation [button] @
- TFFU-118: navigation element check: Categories [button] @
- TFFU-119: navigation element check: EN [button] @
- TFFU-120: navigation element check: Open chat [button] @
- TFFU-121: action element check: Show live shop activity [button] @
- TFFU-207: navigation link health: Untitled link to https://practicesoftwaretesting.com/ @
- TFFU-208: navigation link health: Home @
- TFFU-211: link types: internal, external, anchor, mailto, and download links are classified correctly @
- TFFU-212: visual representation: links are distinguishable from surrounding text @
- TFFU-214: visited style configuration: stylesheet defines visited-link styling when same-origin rules are inspectable @
- TFFU-216: technical security: link protocols are safe and do not expose obvious XSS vectors @
- TFUS-035: /rentals keeps its forms, lists and cards consistent (recorded as findings) @/rentals
- TFUS-036: /rentals has no overlapping controls @/rentals
- TFUS-037: /rentals shows every image it loads @/rentals
- TFAC-072: /rentals groups its checkboxes and radio buttons @/rentals
- TFSE-009: /rentals spells its interface text correctly (recorded as findings) @/rentals
- TFSE-045: keeps page title stable for /rentals @
- TFSE-046: keeps meta description stable for /rentals @
- TFSE-047: keeps heading structure stable for /rentals @
- TFSE-048: keeps canonical metadata stable for /rentals @
- TFSE-049: exposes structured data for /rentals (recorded as a finding when missing) @
- TFSC-030: /rentals sends its security headers and session cookies @/rentals
- TFSC-031: /rentals names no software version in its response headers @/rentals
- TFSC-032: /rentals keeps passwords off plain HTTP @/rentals
- TFSC-033: /rentals puts no password or session token in a URL @/rentals
- TFFU-213: hover state: links show pointer cursor and preserve tooltip attributes @
- TFAC-071: /rentals is tabbed through in reading order @/rentals
- TFAC-056: /rentals passes the WCAG 2.2 A and AA scan @/rentals

### Timeouts, capped practicesoftwaretesting security

- TFSC-036: /product/01M5FXC1X9N2BCR0RNBHCQDTJ4 fetches no internal fields it never shows (recorded as a finding) @/product/01M5FXC1X9N2BCR0RNBHCQDTJ4
- TFSC-041: /product/01M5FXC1XA752J29MNYF9SGYXC uses no guessable sequential ids in its addresses (recorded as a finding) @/product/01M5FXC1XA752J29MNYF9SGYXC
- TFSC-042: /product/01M5FXC1XA752J29MNYF9SGYXC fetches no internal fields it never shows (recorded as a finding) @/product/01M5FXC1XA752J29MNYF9SGYXC
- TFSC-047: /product/01M5FXC1XCWKAYRCGX46B9HD37 uses no guessable sequential ids in its addresses (recorded as a finding) @/product/01M5FXC1XCWKAYRCGX46B9HD37
- TFSC-122: 19 known paths that leak (/.env, /.git/HEAD, /.git/config, /.svn/entries, /.DS_Store, /backup.zip, /backup.tar.gz, /backup.sql, /dump.sql, /database.sql, /logs/error.log, /logs/debug.log, /logs/laravel.log, /log/error.log, /log/debug.log, /log/laravel.log, /storage/logs/error.log, /storage/logs/debug.log, /storage/logs/laravel.log) are not reachable on the site or its own API @(known-path probe)

