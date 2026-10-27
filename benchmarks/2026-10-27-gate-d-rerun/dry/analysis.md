# Phase 39 Gate D's re-measurement: the numbers

Medians of three runs (one for the capped run); each run's time in seconds, in run order. Gate D's own medians (`benchmarks/2026-10-21-gate-d/`) beside them where it ran the same.

## Run times

| Copy | Suite | W1 | WN | W3 | CAP | Gate D W1 | Gate D WN |
| --- | --- | --- | --- | --- | --- | --- | --- |
| fixture | standard | 85 (85) | 35 (35) | - | - | 74 (74, 74, 73) | 34 (34, 33, 34) |
| fixture | security | 13 (13) | 10 (10) | - | - | 10 (10, 10, 10) | 8 (7, 8, 8) |
| fixture | accessibility | 7 (7) | 5 (5) | - | - | 7 (7, 6, 7) | 5 (4, 5, 5) |
| with-bugs | standard | 688 (688) | 383 (383) | 280 (280) | - | 734 (734, 714, 740) | 365 (407, 365, 358) |
| with-bugs | security | 101 (101) | 74 (74) | 69 (69) | - | 113 (133, 113, 108) | 89 (98, 86, 89) |
| with-bugs | accessibility | 131 (131) | 70 (70) | 73 (73) | - | 149 (149, 149, 144) | 60 (60, 79, 58) |
| clean | standard | 323 (323) | 432 (432) | 180 (180) | - | 403 (403, 399, 413) | 519 (463, 519, 661) |
| clean | security | 81 (81) | 159 (159) | 77 (77) | - | 113 (113, 110, 113) | 189 (195, 179, 189) |
| clean | accessibility | 83 (83) | 207 (207) | 69 (69) | - | 98 (98, 97, 98) | 197 (246, 186, 197) |
| cap-fixture | standard | - | - | - | 44 (44) | - | - |
| cap-fixture | security | - | - | - | 21 (21) | - | - |
| cap-fixture | accessibility | - | - | - | 7 (7) | - | - |

WN: 6 workers (6 used), Standard as 12 unit file(s) in 2 pass(es), 2 test(s) in the serial group (run 1).

W3: 3 workers (3 used), Standard as 19 unit file(s) in 2 pass(es), 5 test(s) in the serial group (run 1).

## Against the rules

- Decision 12, the fixture: every test the same result with 1 and with N workers: **yes** (standard same, security same, accessibility same).
- Acceptance Criteria 7, with-bugs, W1 against WN: standard differs, security same, accessibility same.
- Acceptance Criteria 7, clean, W1 against WN: standard differs, security differs, accessibility same.
- Acceptance Criteria 7, with-bugs, W1 against W3: standard differs, security same, accessibility same.
- Acceptance Criteria 7, clean, W1 against W3: standard same, security same, accessibility same.
- **Decision 13, with-bugs, W1 against WN:** Comprehensive, every area (security + accessibility): W1 232 s (232), WN 144 s (144), 37.9% faster against at least 40%; with the fixture's same results: **not met**. Gate D: W1 262 s, WN 158 s.
- **Decision 13, with-bugs, W1 against W3:** Comprehensive, every area (security + accessibility): W1 232 s (232), W3 142 s (142), 38.8% faster against at least 40% (recorded). Gate D: W1 262 s, WN 158 s.
- **Decision 13, clean, W1 against WN:** Comprehensive, every area (security + accessibility): W1 164 s (164), WN 366 s (366), -123.2% faster against at least 40%; with the fixture's same results: **not met**. Gate D: W1 211 s, WN 386 s.
- **Decision 13, clean, W1 against W3:** Comprehensive, every area (security + accessibility): W1 164 s (164), W3 146 s (146), 11.0% faster against at least 40% (recorded). Gate D: W1 211 s, WN 386 s.
- Standard, fixture, W1 against WN (recorded): W1 85 s, WN 35 s, 58.8% faster.
- Standard, with-bugs, W1 against WN (recorded): W1 688 s, WN 383 s, 44.3% faster.
- Standard, with-bugs, W1 against W3 (recorded): W1 688 s, W3 280 s, 59.3% faster.
- Standard, clean, W1 against WN (recorded): W1 323 s, WN 432 s, -33.7% faster.
- Standard, clean, W1 against W3 (recorded): W1 323 s, W3 180 s, 44.3% faster.
- Capped, cap-fixture standard (recorded): 44 s, 3 workers (3 used), 123 tests {"Passed":99,"Not run":14,"Failed":10}; 110 requests took a slot, 54 waited (26 s in all), 2.50 per second over the run; timed checks not judged 4; timeouts 0.
- Capped, cap-fixture security (recorded): 21 s, 3 workers (3 used), 20 tests {"Passed":19,"Failed":1}; 55 requests took a slot, 20 waited (9 s in all), 2.62 per second over the run; timed checks not judged 0; timeouts 0.
- Capped, cap-fixture accessibility (recorded): 7 s, 3 workers (3 used), 12 tests {"Not run":5,"Passed":7}; 4 requests took a slot, 0 waited (0 s in all), 0.57 per second over the run; timed checks not judged 0; timeouts 0.

## Decision 7 and Decision 12: the same results; timeouts

### W1 against WN, fixture standard

- Failures: W1 9, WN 9; the same in every run: W1 yes, WN yes.
- Run 1, tests that give the same in every run of each: 0 failing in W1 only, 0 in WN only; findings 0 in W1 only, 0 in WN only.
- Tests that vary between runs of one variant: 0.
- 30 s timeouts: W1 0, WN 0.

### W1 against WN, fixture security

- Failures: W1 0, WN 0; the same in every run: W1 yes, WN yes.
- Run 1, tests that give the same in every run of each: 0 failing in W1 only, 0 in WN only; findings 0 in W1 only, 0 in WN only.
- Tests that vary between runs of one variant: 0.
- 30 s timeouts: W1 0, WN 0.

### W1 against WN, fixture accessibility

- Failures: W1 0, WN 0; the same in every run: W1 yes, WN yes.
- Run 1, tests that give the same in every run of each: 0 failing in W1 only, 0 in WN only; findings 0 in W1 only, 0 in WN only.
- Tests that vary between runs of one variant: 0.
- 30 s timeouts: W1 0, WN 0.

### W1 against WN, with-bugs standard

- Failures: W1 84, WN 84; the same in every run: W1 yes, WN yes.
- Run 1, tests that give the same in every run of each: 0 failing in W1 only, 0 in WN only; findings 9 in W1 only, 10 in WN only.
- Tests that vary between runs of one variant: 0.
- 30 s timeouts: W1 0, WN 0.
  - finding in W1 only: link health: linked routes draw a page, not the app's "not found" view @ | 3 linked routes not checked: the check stops after 14 s (/#/product/7, /#/product/8, /#/product/9)
  - finding in W1 only: link health: linked routes draw a page, not the app's "not found" view @ | 2 linked routes not checked: the check stops after 14 s (/#/product/8, /#/product/9)
  - finding in W1 only: the same components look the same on every inspected page (recorded as findings) @/#/ | h5.card-title differs across pages in text-align: left on /#/, /#/product/6; right on /#/category/hand-tools
  - finding in W1 only: /#/category/hand-tools keeps its forms, lists and cards consistent (recorded as findings) @/#/category/hand-tools | the card titles on /#/category/hand-tools: "Pliers" has text-align left, where the other 5 have right
  - finding in W1 only: /#/category/hand-tools keeps its forms, lists and cards consistent (recorded as findings) @/#/category/hand-tools | the card titles on /#/category/hand-tools: "Slip Joint Pliers" has text-align left, where the other 5 have right
  - finding in W1 only: /#/ keeps its forms, lists and cards consistent (recorded as findings) @/#/ | the card titles on /#/: "Combination Pliers" has text-align left, where the other 5 have right
  - finding in W1 only: /#/ keeps its forms, lists and cards consistent (recorded as findings) @/#/ | the card titles on /#/: "Bolt Cutters" has text-align left, where the other 5 have right
  - finding in W1 only: /#/ keeps its forms, lists and cards consistent (recorded as findings) @/#/ | the card titles on /#/: "Claw Hammer with Shock Reduction Grip" has text-align left, where the other 5 have right
  - finding in W1 only: /#/ keeps its forms, lists and cards consistent (recorded as findings) @/#/ | the card titles on /#/: "Hammer" has text-align left, where the other 5 have right
  - finding in WN only: link health: linked routes draw a page, not the app's "not found" view @ | 7 linked routes not checked: the check stops after 14 s (/#/product/3, /#/product/4, /#/product/5, /#/product/6, /#/product/7, ...)
  - finding in WN only: link health: linked routes draw a page, not the app's "not found" view @ | 2 linked routes not checked: the check stops after 14 s (/#/product/11, /#/product/12)
  - finding in WN only: link health: linked routes draw a page, not the app's "not found" view @ | 5 linked routes not checked: the check stops after 14 s (/#/product/5, /#/product/6, /#/product/7, /#/product/8, /#/product/9)
  - finding in WN only: the same components look the same on every inspected page (recorded as findings) @/#/ | h5.card-title differs across pages in text-align: left on /#/product/6, /#/category/hand-tools; right on /#/
  - finding in WN only: cumulative layout shift during load stays under 0.25 @ | CLS 0.101 on /: Core Web Vitals "needs improvement" (over 0.1, up to 0.25). Shifted first: div, div#navbarSupportedContent, div. Measured once, in a lab (this run, from this machine), not from real visits.
  - finding in WN only: /#/category/hand-tools keeps its forms, lists and cards consistent (recorded as findings) @/#/category/hand-tools | the card titles on /#/category/hand-tools: "Bolt Cutters" has text-align left, where the other 5 have right
  - finding in WN only: /#/category/hand-tools keeps its forms, lists and cards consistent (recorded as findings) @/#/category/hand-tools | the card titles on /#/category/hand-tools: "Hammer" has text-align left, where the other 5 have right
  - finding in WN only: /#/ keeps its forms, lists and cards consistent (recorded as findings) @/#/ | the card titles on /#/: "Claw Hammer with Shock Reduction Grip" has text-align left, where the other 6 have right
  - finding in WN only: /#/ keeps its forms, lists and cards consistent (recorded as findings) @/#/ | the card titles on /#/: "Hammer" has text-align left, where the other 6 have right
  - finding in WN only: /#/ keeps its forms, lists and cards consistent (recorded as findings) @/#/ | the card titles on /#/: "Thor Hammer" has text-align left, where the other 6 have right

### W1 against WN, with-bugs security

- Failures: W1 3, WN 3; the same in every run: W1 yes, WN yes.
- Run 1, tests that give the same in every run of each: 0 failing in W1 only, 0 in WN only; findings 0 in W1 only, 0 in WN only.
- Tests that vary between runs of one variant: 0.
- 30 s timeouts: W1 0, WN 0.

### W1 against WN, with-bugs accessibility

- Failures: W1 41, WN 41; the same in every run: W1 yes, WN yes.
- Run 1, tests that give the same in every run of each: 0 failing in W1 only, 0 in WN only; findings 0 in W1 only, 0 in WN only.
- Tests that vary between runs of one variant: 0.
- 30 s timeouts: W1 0, WN 0.

### W1 against WN, clean standard

- Failures: W1 46, WN 53; the same in every run: W1 yes, WN yes.
- Run 1, tests that give the same in every run of each: 0 failing in W1 only, 7 in WN only; findings 0 in W1 only, 1 in WN only.
- Tests that vary between runs of one variant: 0.
- 30 s timeouts: W1 0, WN 6 (run.mts: 1).
  - failing in WN only: navigation link health: Hand Tools @
  - failing in WN only: keyboard navigation: links can receive focus and activate with Enter @
  - failing in WN only: usability: primary actions are reachable without scrolling at desktop viewport @
  - failing in WN only: keeps the core journey visible across common viewport sizes @
  - failing in WN only: largest contentful paint stays under 4 s @
  - failing in WN only: dependency failure injection: localhost:8091 [xhr-fetch] @
  - failing in WN only: session cookies set by the site expire and stay scoped to it @
  - finding in WN only: hover state: links show pointer cursor and preserve tooltip attributes @ | links that could not be hovered, so their cursor was not checked: /product/<id> (did not respond within 2 s)

### W1 against WN, clean security

- Failures: W1 2, WN 11; the same in every run: W1 yes, WN yes.
- Run 1, tests that give the same in every run of each: 0 failing in W1 only, 6 in WN only; findings 0 in W1 only, 0 in WN only.
- Tests that vary between runs of one variant: 0.
- 30 s timeouts: W1 0, WN 9 (run.mts: 0).
  - failing in WN only: / uses no guessable sequential ids in its addresses (recorded as a finding) @/
  - failing in WN only: / fetches no internal fields it never shows (recorded as a finding) @/
  - failing in WN only: / puts no password or session token in a URL @/
  - failing in WN only: /product/<id> puts no password or session token in a URL @/product/<id> (x4)
  - failing in WN only: /category/hand-tools puts no password or session token in a URL @/category/hand-tools
  - failing in WN only: /contact puts no password or session token in a URL @/contact

### W1 against WN, clean accessibility

- Failures: W1 19, WN 19; the same in every run: W1 yes, WN yes.
- Run 1, tests that give the same in every run of each: 0 failing in W1 only, 0 in WN only; findings 0 in W1 only, 0 in WN only.
- Tests that vary between runs of one variant: 0.
- 30 s timeouts: W1 0, WN 6 (run.mts: 5).

### W1 against W3, with-bugs standard

- Failures: W1 84, W3 84; the same in every run: W1 yes, W3 yes.
- Run 1, tests that give the same in every run of each: 0 failing in W1 only, 0 in W3 only; findings 11 in W1 only, 12 in W3 only.
- Tests that vary between runs of one variant: 0.
- 30 s timeouts: W1 0, W3 0.
  - finding in W1 only: link health: linked routes draw a page, not the app's "not found" view @ | 3 linked routes not checked: the check stops after 14 s (/#/product/7, /#/product/8, /#/product/9)
  - finding in W1 only: link health: linked routes draw a page, not the app's "not found" view @ | 2 linked routes not checked: the check stops after 14 s (/#/product/8, /#/product/9)
  - finding in W1 only: the same components look the same on every inspected page (recorded as findings) @/#/ | h5.card-title differs across pages in text-align: left on /#/, /#/product/6; right on /#/category/hand-tools
  - finding in W1 only: /#/category/hand-tools keeps its forms, lists and cards consistent (recorded as findings) @/#/category/hand-tools | the card titles on /#/category/hand-tools: "Pliers" has text-align left, where the other 5 have right
  - finding in W1 only: /#/category/hand-tools keeps its forms, lists and cards consistent (recorded as findings) @/#/category/hand-tools | the card titles on /#/category/hand-tools: "Long Nose Pliers" has text-align left, where the other 5 have right
  - finding in W1 only: /#/category/hand-tools keeps its forms, lists and cards consistent (recorded as findings) @/#/category/hand-tools | the card titles on /#/category/hand-tools: "Slip Joint Pliers" has text-align left, where the other 5 have right
  - finding in W1 only: /#/category/hand-tools keeps its forms, lists and cards consistent (recorded as findings) @/#/category/hand-tools | the card titles on /#/category/hand-tools: "Thor Hammer" has text-align left, where the other 5 have right
  - finding in W1 only: /#/ keeps its forms, lists and cards consistent (recorded as findings) @/#/ | the card titles on /#/: "Combination Pliers" has text-align left, where the other 5 have right
  - finding in W1 only: /#/ keeps its forms, lists and cards consistent (recorded as findings) @/#/ | the card titles on /#/: "Bolt Cutters" has text-align left, where the other 5 have right
  - finding in W1 only: /#/ keeps its forms, lists and cards consistent (recorded as findings) @/#/ | the card titles on /#/: "Claw Hammer with Shock Reduction Grip" has text-align left, where the other 5 have right
  - finding in W3 only: link health: linked routes draw a page, not the app's "not found" view @ | 5 linked routes not checked: the check stops after 14 s (/#/product/5, /#/product/6, /#/product/7, /#/product/8, /#/product/9)
  - finding in W3 only: link health: linked routes draw a page, not the app's "not found" view @ | 1 linked routes not checked: the check stops after 14 s (/#/product/12)
  - finding in W3 only: link health: linked routes draw a page, not the app's "not found" view @ | 4 linked routes not checked: the check stops after 14 s (/#/product/6, /#/product/7, /#/product/8, /#/product/9)
  - finding in W3 only: the same components look the same on every inspected page (recorded as findings) @/#/ | h5.card-title differs across pages in text-align: right on /#/, /#/category/hand-tools; left on /#/product/6
  - finding in W3 only: cumulative layout shift during load stays under 0.25 @ | CLS 0.101 on /: Core Web Vitals "needs improvement" (over 0.1, up to 0.25). Shifted first: div, div#navbarSupportedContent, div. Measured once, in a lab (this run, from this machine), not from real visits.
  - finding in W3 only: /#/category/hand-tools keeps its forms, lists and cards consistent (recorded as findings) @/#/category/hand-tools | the card titles on /#/category/hand-tools: "Combination Pliers" has text-align left, where the other 6 have right
  - finding in W3 only: /#/category/hand-tools keeps its forms, lists and cards consistent (recorded as findings) @/#/category/hand-tools | the card titles on /#/category/hand-tools: "Pliers" has text-align left, where the other 6 have right
  - finding in W3 only: /#/category/hand-tools keeps its forms, lists and cards consistent (recorded as findings) @/#/category/hand-tools | the card titles on /#/category/hand-tools: "Claw Hammer with Shock Reduction Grip" has text-align left, where the other 6 have right
  - finding in W3 only: /#/ keeps its forms, lists and cards consistent (recorded as findings) @/#/ | the card titles on /#/: "Combination Pliers" has text-align right, where the other 5 have left
  - finding in W3 only: /#/ keeps its forms, lists and cards consistent (recorded as findings) @/#/ | the card titles on /#/: "Claw Hammer with Shock Reduction Grip" has text-align right, where the other 5 have left

### W1 against W3, with-bugs security

- Failures: W1 3, W3 3; the same in every run: W1 yes, W3 yes.
- Run 1, tests that give the same in every run of each: 0 failing in W1 only, 0 in W3 only; findings 0 in W1 only, 0 in W3 only.
- Tests that vary between runs of one variant: 0.
- 30 s timeouts: W1 0, W3 0.

### W1 against W3, with-bugs accessibility

- Failures: W1 41, W3 41; the same in every run: W1 yes, W3 yes.
- Run 1, tests that give the same in every run of each: 0 failing in W1 only, 0 in W3 only; findings 0 in W1 only, 0 in W3 only.
- Tests that vary between runs of one variant: 0.
- 30 s timeouts: W1 0, W3 0.

### W1 against W3, clean standard

- Failures: W1 46, W3 46; the same in every run: W1 yes, W3 yes.
- Run 1, tests that give the same in every run of each: 0 failing in W1 only, 0 in W3 only; findings 0 in W1 only, 0 in W3 only.
- Tests that vary between runs of one variant: 0.
- 30 s timeouts: W1 0, W3 0.

### W1 against W3, clean security

- Failures: W1 2, W3 2; the same in every run: W1 yes, W3 yes.
- Run 1, tests that give the same in every run of each: 0 failing in W1 only, 0 in W3 only; findings 0 in W1 only, 0 in W3 only.
- Tests that vary between runs of one variant: 0.
- 30 s timeouts: W1 0, W3 0.

### W1 against W3, clean accessibility

- Failures: W1 19, W3 19; the same in every run: W1 yes, W3 yes.
- Run 1, tests that give the same in every run of each: 0 failing in W1 only, 0 in W3 only; findings 0 in W1 only, 0 in W3 only.
- Tests that vary between runs of one variant: 0.
- 30 s timeouts: W1 0, W3 0.

