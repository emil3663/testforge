# Phase 39 Gate D: the numbers

Medians of three runs (one for the capped run); each run's time in seconds, in run order.

## Run times

| Copy | Suite | W1 | WN | CAP | A | P38B | P38A |
| --- | --- | --- | --- | --- | --- | --- | --- |
| fixture | standard | 82 (82) | 35 (35) | - | - | - | - |
| fixture | security | 12 (12) | 9 (9) | - | - | - | - |
| fixture | accessibility | 8 (8) | 7 (7) | - | - | - | - |
| the-internet | standard | 361 (361) | 128 (128) | - | - | 243 (243) | 276 (276) |
| the-internet | security | 90 (90) | 63 (63) | - | - | - | - |
| the-internet | accessibility | 86 (86) | 53 (53) | - | - | - | - |
| cap-fixture | standard | - | - | 46 (46) | - | - | - |
| cap-fixture | security | - | - | 19 (19) | - | - | - |
| cap-fixture | accessibility | - | - | 6 (6) | - | - | - |

WN: 6 workers (6 used), Standard as 12 unit file(s) in 2 pass(es), 2 test(s) in the serial group (run 1).

## Against the rules

- Decision 12, the fixture: every test the same result with 1 and with N workers: **yes** (standard same, security same, accessibility same).
- Acceptance Criteria 7, the-internet: standard same, security same, accessibility same.
- Standard, fixture (recorded): W1 82 s, WN 35 s, 57.3% faster.
- Standard, the-internet (recorded): W1 361 s, WN 128 s, 64.5% faster.
- Phase 38 on the-internet's local copy: d90de57 243 s (243), d202315 276 s (276).
- Capped, cap-fixture standard (recorded): 46 s, 3 workers (3 used), 123 tests {"Passed":99,"Not run":14,"Failed":10}; 110 requests took a slot, 50 waited (19 s in all), 2.39 per second over the run; timed checks not judged 4; timeouts 0.
- Capped, cap-fixture security (recorded): 19 s, 3 workers (3 used), 20 tests {"Passed":19,"Failed":1}; 55 requests took a slot, 20 waited (9 s in all), 2.89 per second over the run; timed checks not judged 0; timeouts 0.
- Capped, cap-fixture accessibility (recorded): 6 s, 3 workers (3 used), 12 tests {"Not run":5,"Passed":7}; 4 requests took a slot, 0 waited (0 s in all), 0.67 per second over the run; timed checks not judged 0; timeouts 0.

## Decision 7 and Decision 12: the same results; Phase 38; timeouts

### W1 against WN, fixture standard

- Failures: W1 9, WN 9; the same in every run: W1 yes, WN yes.
- Run 1, tests that give the same in every run of each: 0 failing in W1 only, 0 in WN only; findings 0 in W1 only, 0 in WN only.
- Tests that vary between runs of one variant: 0.

### W1 against WN, fixture security

- Failures: W1 0, WN 0; the same in every run: W1 yes, WN yes.
- Run 1, tests that give the same in every run of each: 0 failing in W1 only, 0 in WN only; findings 0 in W1 only, 0 in WN only.
- Tests that vary between runs of one variant: 0.

### W1 against WN, fixture accessibility

- Failures: W1 0, WN 0; the same in every run: W1 yes, WN yes.
- Run 1, tests that give the same in every run of each: 0 failing in W1 only, 0 in WN only; findings 0 in W1 only, 0 in WN only.
- Tests that vary between runs of one variant: 0.

### W1 against WN, the-internet standard

- Failures: W1 65, WN 65; the same in every run: W1 yes, WN yes.
- Run 1, tests that give the same in every run of each: 0 failing in W1 only, 0 in WN only; findings 0 in W1 only, 0 in WN only.
- Tests that vary between runs of one variant: 0.

### W1 against WN, the-internet security

- Failures: W1 0, WN 0; the same in every run: W1 yes, WN yes.
- Run 1, tests that give the same in every run of each: 0 failing in W1 only, 0 in WN only; findings 0 in W1 only, 0 in WN only.
- Tests that vary between runs of one variant: 0.

### W1 against WN, the-internet accessibility

- Failures: W1 19, WN 19; the same in every run: W1 yes, WN yes.
- Run 1, tests that give the same in every run of each: 0 failing in W1 only, 0 in WN only; findings 0 in W1 only, 0 in WN only.
- Tests that vary between runs of one variant: 0.

### Phase 38's before and after, the-internet's local copy

- Tests: before 161, after 187; failed before 18, after 20; 30 s timeouts before 0, after 0.
- New failures in the after run (run 1; a test failing after whose title wasn't failing before): 2.
  - /checkboxes passes the WCAG 2.2 A and AA scan @/checkboxes
  - /dropdown passes the WCAG 2.2 A and AA scan @/dropdown

