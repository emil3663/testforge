# Phase 39 Gate D's re-measurement: the numbers

Medians of three runs (one for the capped run); each run's time in seconds, in run order. Gate D's own medians (`benchmarks/2026-10-21-gate-d/`) beside them where it ran the same.

## Run times

| Copy | Suite | W1 | WN | W3 | CAP | Gate D W1 | Gate D WN |
| --- | --- | --- | --- | --- | --- | --- | --- |
| fixture | standard | 74 (77, 74, 74) | 33 (32, 33, 33) | - | - | 74 (74, 74, 73) | 34 (34, 33, 34) |
| fixture | security | 10 (10, 10, 10) | 7 (7, 7, 7) | - | - | 10 (10, 10, 10) | 8 (7, 8, 8) |
| fixture | accessibility | 6 (6, 6, 6) | 4 (4, 4, 4) | - | - | 7 (7, 6, 7) | 5 (4, 5, 5) |
| with-bugs | standard | 651 (651, 633, 653) | 311 (305, 311, 317) | 297 (309, 297, 291) | - | 734 (734, 714, 740) | 365 (407, 365, 358) |
| with-bugs | security | 88 (101, 85, 88) | 66 (68, 64, 66) | 61 (69, 61, 59) | - | 113 (133, 113, 108) | 89 (98, 86, 89) |
| with-bugs | accessibility | 129 (133, 128, 129) | 59 (79, 59, 56) | 63 (70, 63, 60) | - | 149 (149, 149, 144) | 60 (60, 79, 58) |
| clean | standard | 337 (337, 339, 332) | 342 (342, 760, 276) | 180 (180, 276, 160) | - | 403 (403, 399, 413) | 519 (463, 519, 661) |
| clean | security | 77 (76, 77, 77) | 147 (140, 147, 156) | 71 (71, 106, 70) | - | 113 (113, 110, 113) | 189 (195, 179, 189) |
| clean | accessibility | 82 (82, 81, 84) | 227 (227, 202, 262) | 66 (60, 66, 86) | - | 98 (98, 97, 98) | 197 (246, 186, 197) |
| practicesoftwaretesting | standard | - | - | - | 1369 (1369) | - | - |
| practicesoftwaretesting | security | - | - | - | 478 (478) | - | - |
| practicesoftwaretesting | accessibility | - | - | - | 140 (140) | - | - |

WN: 6 workers (6 used), Standard as 12 unit file(s) in 2 pass(es), 2 test(s) in the serial group (run 1).

W3: 3 workers (3 used), Standard as 19 unit file(s) in 2 pass(es), 5 test(s) in the serial group (run 1).

## Against the rules

- Decision 12, the fixture: every test the same result with 1 and with N workers: **yes** (standard same, security same, accessibility same).
- Acceptance Criteria 7, with-bugs, W1 against WN: standard same, security same, accessibility same.
- Acceptance Criteria 7, clean, W1 against WN: standard differs, security differs, accessibility same.
- Acceptance Criteria 7, with-bugs, W1 against W3: standard same, security same, accessibility same.
- Acceptance Criteria 7, clean, W1 against W3: standard same, security same, accessibility same.
- **Decision 13, with-bugs, W1 against WN:** Comprehensive, every area (security + accessibility): W1 217 s (234, 213, 217), WN 123 s (147, 123, 122), 43.3% faster against at least 40%; with the fixture's same results: **met**. Gate D: W1 262 s, WN 158 s.
- **Decision 13, with-bugs, W1 against W3:** Comprehensive, every area (security + accessibility): W1 217 s (234, 213, 217), W3 124 s (139, 124, 119), 42.9% faster against at least 40% (recorded). Gate D: W1 262 s, WN 158 s.
- **Decision 13, clean, W1 against WN:** Comprehensive, every area (security + accessibility): W1 158 s (158, 158, 161), WN 367 s (367, 349, 418), -132.3% faster against at least 40%; with the fixture's same results: **not met**. Gate D: W1 211 s, WN 386 s.
- **Decision 13, clean, W1 against W3:** Comprehensive, every area (security + accessibility): W1 158 s (158, 158, 161), W3 156 s (131, 172, 156), 1.3% faster against at least 40% (recorded). Gate D: W1 211 s, WN 386 s.
- Standard, fixture, W1 against WN (recorded): W1 74 s, WN 33 s, 55.4% faster.
- Standard, with-bugs, W1 against WN (recorded): W1 651 s, WN 311 s, 52.2% faster.
- Standard, with-bugs, W1 against W3 (recorded): W1 651 s, W3 297 s, 54.4% faster.
- Standard, clean, W1 against WN (recorded): W1 337 s, WN 342 s, -1.5% faster.
- Standard, clean, W1 against W3 (recorded): W1 337 s, W3 180 s, 46.6% faster.
- Capped, practicesoftwaretesting standard (recorded): 1369 s, 3 workers (3 used), 486 tests {"Failed":153,"Passed":303,"Not run":30}; 5731 requests took a slot, 5656 waited (16065 s in all), 4.19 per second over the run; timed checks not judged 4; timeouts 28. Gate D: 29340 s, timeouts 466.
- Capped, practicesoftwaretesting security (recorded): 478 s, 3 workers (3 used), 122 tests {"Failed":35,"Passed":87}; 2055 requests took a slot, 1787 waited (3810 s in all), 4.30 per second over the run; timed checks not judged 0; timeouts 1. Gate D: 698 s, timeouts 5.
- Capped, practicesoftwaretesting accessibility (recorded): 140 s, 3 workers (3 used), 80 tests {"Not run":38,"Passed":24,"Failed":18}; 670 requests took a slot, 662 waited (1895 s in all), 4.79 per second over the run; timed checks not judged 0; timeouts 0. Gate D: 170 s, timeouts 0.

## Decision 7 and Decision 12: the same results; timeouts

### W1 against WN, fixture standard

- Failures: W1 9/9/9, WN 9/9/9; the same in every run: W1 yes, WN yes.
- Run 1, tests that give the same in every run of each: 0 failing in W1 only, 0 in WN only; findings 0 in W1 only, 0 in WN only.
- Tests that vary between runs of one variant: 0.
- 30 s timeouts: W1 0/0/0, WN 0/0/0.

### W1 against WN, fixture security

- Failures: W1 0/0/0, WN 0/0/0; the same in every run: W1 yes, WN yes.
- Run 1, tests that give the same in every run of each: 0 failing in W1 only, 0 in WN only; findings 0 in W1 only, 0 in WN only.
- Tests that vary between runs of one variant: 0.
- 30 s timeouts: W1 0/0/0, WN 0/0/0.

### W1 against WN, fixture accessibility

- Failures: W1 0/0/0, WN 0/0/0; the same in every run: W1 yes, WN yes.
- Run 1, tests that give the same in every run of each: 0 failing in W1 only, 0 in WN only; findings 0 in W1 only, 0 in WN only.
- Tests that vary between runs of one variant: 0.
- 30 s timeouts: W1 0/0/0, WN 0/0/0.

### W1 against WN, with-bugs standard

- Failures: W1 84/84/84, WN 84/84/84; the same in every run: W1 yes, WN yes.
- Run 1, tests that give the same in every run of each: 0 failing in W1 only, 0 in WN only; findings 0 in W1 only, 0 in WN only.
- Tests that vary between runs of one variant: 5 (the same components look the same on every inspected page (recorded as findings) @/#/; cumulative layout shift during load stays under 0.25 @; /#/category/hand-tools keeps its forms, lists and cards consistent (recorded as findings) ; /#/ keeps its forms, lists and cards consistent (recorded as findings) @/#/; link health: linked routes draw a page, not the app's "not found" view @).
- 30 s timeouts: W1 0/0/0, WN 0/0/0.

### W1 against WN, with-bugs security

- Failures: W1 3/3/3, WN 3/3/3; the same in every run: W1 yes, WN yes.
- Run 1, tests that give the same in every run of each: 0 failing in W1 only, 0 in WN only; findings 0 in W1 only, 0 in WN only.
- Tests that vary between runs of one variant: 0.
- 30 s timeouts: W1 0/0/0, WN 0/0/0.

### W1 against WN, with-bugs accessibility

- Failures: W1 41/41/41, WN 41/41/41; the same in every run: W1 yes, WN yes.
- Run 1, tests that give the same in every run of each: 0 failing in W1 only, 0 in WN only; findings 0 in W1 only, 0 in WN only.
- Tests that vary between runs of one variant: 0.
- 30 s timeouts: W1 0/0/0, WN 0/0/0.

### W1 against WN, clean standard

- Failures: W1 46/46/46, WN 49/57/50; the same in every run: W1 yes, WN no.
- Run 1, tests that give the same in every run of each: 0 failing in W1 only, 1 in WN only; findings 0 in W1 only, 0 in WN only.
- Tests that vary between runs of one variant: 13 (keyboard navigation: links can receive focus and activate with Enter @; filters send and respect the chosen values on /category/hand-tools @/category/hand-tools; navigation links land where their text says, from / @/; usability: primary actions are reachable without scrolling at desktop viewport @; keeps the core journey visible across common viewport sizes @; landing page finishes loading within 5 s @; dependency failure injection: localhost:8091 [xhr-fetch] @; storage failure injection: sessionStorage on /product/<id> @; session cookies set by the site expire and stay scoped to it @; navigation link health: Untitled link to http://localhost:4200/ @; largest contentful paint stays under 4 s @; keeps heading structure stable for /product/<id> @; hover state: links show pointer cursor and preserve tooltip attributes @).
- 30 s timeouts: W1 0/0/0, WN 1 (run.mts: 0)/11 (run.mts: 5)/3 (run.mts: 0).
  - failing in WN only: navigation link health: Hand Tools @

### W1 against WN, clean security

- Failures: W1 2/2/2, WN 9/12/11; the same in every run: W1 yes, WN no.
- Run 1, tests that give the same in every run of each: 0 failing in W1 only, 1 in WN only; findings 0 in W1 only, 0 in WN only.
- Tests that vary between runs of one variant: 4 (/ fetches no internal fields it never shows (recorded as a finding) @/; / puts no password or session token in a URL @/; /product/<id> puts no password or session token in a URL @/product/<id>; /category/special-tools puts no password or session token in a URL @/category/special-tool).
- 30 s timeouts: W1 0/0/0, WN 7 (run.mts: 0)/10 (run.mts: 0)/9 (run.mts: 0).
  - failing in WN only: / uses no guessable sequential ids in its addresses (recorded as a finding) @/

### W1 against WN, clean accessibility

- Failures: W1 19/19/19, WN 19/19/20; the same in every run: W1 yes, WN no.
- Run 1, tests that give the same in every run of each: 0 failing in W1 only, 0 in WN only; findings 0 in W1 only, 0 in WN only.
- Tests that vary between runs of one variant: 1 (every form field has an accessible name: / @/).
- 30 s timeouts: W1 0/0/0, WN 6/5/7.

### W1 against W3, with-bugs standard

- Failures: W1 84/84/84, W3 84/84/84; the same in every run: W1 yes, W3 yes.
- Run 1, tests that give the same in every run of each: 0 failing in W1 only, 0 in W3 only; findings 0 in W1 only, 0 in W3 only.
- Tests that vary between runs of one variant: 5 (the same components look the same on every inspected page (recorded as findings) @/#/; cumulative layout shift during load stays under 0.25 @; /#/category/hand-tools keeps its forms, lists and cards consistent (recorded as findings) ; /#/ keeps its forms, lists and cards consistent (recorded as findings) @/#/; link health: linked routes draw a page, not the app's "not found" view @).
- 30 s timeouts: W1 0/0/0, W3 0/0/0.

### W1 against W3, with-bugs security

- Failures: W1 3/3/3, W3 3/3/3; the same in every run: W1 yes, W3 yes.
- Run 1, tests that give the same in every run of each: 0 failing in W1 only, 0 in W3 only; findings 0 in W1 only, 0 in W3 only.
- Tests that vary between runs of one variant: 0.
- 30 s timeouts: W1 0/0/0, W3 0/0/0.

### W1 against W3, with-bugs accessibility

- Failures: W1 41/41/41, W3 41/41/41; the same in every run: W1 yes, W3 yes.
- Run 1, tests that give the same in every run of each: 0 failing in W1 only, 0 in W3 only; findings 0 in W1 only, 0 in W3 only.
- Tests that vary between runs of one variant: 0.
- 30 s timeouts: W1 0/0/0, W3 0/0/0.

### W1 against W3, clean standard

- Failures: W1 46/46/46, W3 46/47/46; the same in every run: W1 yes, W3 no.
- Run 1, tests that give the same in every run of each: 0 failing in W1 only, 0 in W3 only; findings 0 in W1 only, 0 in W3 only.
- Tests that vary between runs of one variant: 1 (link health: internal, external, and download links do not return broken responses @).
- 30 s timeouts: W1 0/0/0, W3 0/0/0.

### W1 against W3, clean security

- Failures: W1 2/2/2, W3 2/2/2; the same in every run: W1 yes, W3 yes.
- Run 1, tests that give the same in every run of each: 0 failing in W1 only, 0 in W3 only; findings 0 in W1 only, 0 in W3 only.
- Tests that vary between runs of one variant: 0.
- 30 s timeouts: W1 0/0/0, W3 0/0/0.

### W1 against W3, clean accessibility

- Failures: W1 19/19/19, W3 19/19/19; the same in every run: W1 yes, W3 yes.
- Run 1, tests that give the same in every run of each: 0 failing in W1 only, 0 in W3 only; findings 0 in W1 only, 0 in W3 only.
- Tests that vary between runs of one variant: 0.
- 30 s timeouts: W1 0/0/0, W3 0/0/0.

### Timeouts, capped practicesoftwaretesting standard

- TFFU-127: link health: internal, external, and download links do not return broken responses @
- TFFU-132: keyboard navigation: links can receive focus and activate with Enter @
- TFFU-139: link health: internal, external, and download links do not return broken responses @
- TFFU-144: keyboard navigation: links can receive focus and activate with Enter @
- TFFU-152: link health: internal, external, and download links do not return broken responses @
- TFFU-157: keyboard navigation: links can receive focus and activate with Enter @
- TFFU-164: link health: internal, external, and download links do not return broken responses @
- TFFU-169: keyboard navigation: links can receive focus and activate with Enter @
- TFFU-176: link health: internal, external, and download links do not return broken responses @
- TFFU-181: keyboard navigation: links can receive focus and activate with Enter @
- TFFU-188: link health: internal, external, and download links do not return broken responses @
- TFFU-193: keyboard navigation: links can receive focus and activate with Enter @
- TFFU-199: navigation link health: Hand Tools @
- TFFU-200: link health: internal, external, and download links do not return broken responses @
- TFFU-205: keyboard navigation: links can receive focus and activate with Enter @
- TFFU-212: link health: internal, external, and download links do not return broken responses @
- TFFU-217: keyboard navigation: links can receive focus and activate with Enter @
- TFFU-221: sort options order the items on / @/
- TFFU-225: sort options order the items on /category/hand-tools @/category/hand-tools
- TFFU-230: navigation links land where their text says, from / @/
- TFUS-038: the same components look the same on every inspected page (recorded as findings) @/
- TFRM-001: keeps the core journey visible across common viewport sizes @
- TFSE-018: keeps canonical metadata stable for /product/01M5Z4WVS7ZSXQRRKS1WKX6WCZ @
- TFSE-019: exposes structured data for /product/01M5Z4WVS7ZSXQRRKS1WKX6WCZ (recorded as a finding when missing) @
- TFSC-006: /product/01M5Z4WVS7ZSXQRRKS1WKX6WCZ sends its security headers and session cookies @/product/01M5Z4WVS7ZSXQRRKS1WKX6WCZ
- TFFU-049: form element check: 01M5Z4WVPMW789SSCYF5SF37VY [Hand Tools] [input] @
- TFFU-050: form element check: 01M5Z4WVPMW789SSCYF5SF37VZ [Hand Tools] [input] @
- TFFU-051: form element check: 01M5Z4WVPMW789SSCYF5SF37W0 [Hand Tools] [input] @

### Timeouts, capped practicesoftwaretesting security

- TFSC-122: 19 known paths that leak (/.env, /.git/HEAD, /.git/config, /.svn/entries, /.DS_Store, /backup.zip, /backup.tar.gz, /backup.sql, /dump.sql, /database.sql, /logs/error.log, /logs/debug.log, /logs/laravel.log, /log/error.log, /log/debug.log, /log/laravel.log, /storage/logs/error.log, /storage/logs/debug.log, /storage/logs/laravel.log) are not reachable on the site or its own API @(known-path probe)

