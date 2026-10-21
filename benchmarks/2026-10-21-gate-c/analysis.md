# Phase 39 Gate C: the numbers

Medians of three runs; each run's time in seconds, in run order.

## Run times

| Copy | Suite | A | C | C1 | C2 | F | FL |
| --- | --- | --- | --- | --- | --- | --- | --- |
| with-bugs | standard | - | 847 (836, 851, 847) | 868 (861, 868, 874) | 739 (738, 748, 739) | 727 (727, 727, 723) | - |
| with-bugs | accessibility | 207 (205, 210, 207) | - | - | 182 (182, 182, 181) | 179 (181, 177, 179) | 151 (157, 151, 150) |
| clean | standard | - | - | 521 (521, 512, 531) | 414 (416, 412, 414) | 407 (401, 407, 420) | - |
| clean | accessibility | 197 (197, 214, 195) | - | - | 128 (133, 125, 128) | 128 (128, 135, 127) | 101 (101, 127, 100) |

F's Standard runs as 19 unit file(s) in 2 pass(es), 5 test(s) in the serial group (with-bugs, run 1).

## Against the targets

- TFP-241's cost, with-bugs standard: C 847 s, C1 868 s. C1 2.5% slower against a bar of under 5%: **kept**.
- TFP-214, with-bugs standard: C1 868 s, C2 739 s. 14.9% faster against at least 10%: **met**.
- Accessibility (moved from Gate B), with-bugs accessibility: A 207 s, C2 182 s. 12.1% faster against at least 30%: **not met**.
- TFP-222, TFP-155, TFP-156, with-bugs standard: C2 739 s, F 727 s. F 1.6% faster (no slower beyond 5%: **met**); the same results: **yes**.
- TFP-222, TFP-155, TFP-156, with-bugs accessibility: C2 182 s, F 179 s. F 1.6% faster (no slower beyond 5%: **met**); the same results: **yes**.
- TFP-214, clean standard: C1 521 s, C2 414 s. 20.5% faster against at least 10%: **met**.
- Accessibility (moved from Gate B), clean accessibility: A 197 s, C2 128 s. 35.0% faster against at least 30%: **met**.
- TFP-222, TFP-155, TFP-156, clean standard: C2 414 s, F 407 s. F 1.7% faster (no slower beyond 5%: **met**); the same results: **yes**.
- TFP-222, TFP-155, TFP-156, clean accessibility: C2 128 s, F 128 s. F 0.0% faster (no slower beyond 5%: **met**); the same results: **yes**.
- The axe order, with-bugs accessibility: F (built order) 179 s, FL (scan last) 151 s, 15.6% faster; the scans' findings identical in every run: yes. **Scan last becomes the default**.
- The axe order, clean accessibility: F (built order) 128 s, FL (scan last) 101 s, 21.1% faster; the scans' findings identical in every run: yes. **Scan last becomes the default**.

## Decision 7: the same results, and the / sort message

### TFP-241's cost: C against C1, with-bugs standard

- Failures: C 84/84/84, C1 84/84/84; the same in every run: C yes, C1 yes.
- Run 1, tests that give the same in every run of each: 0 failing in C only, 0 in C1 only; findings 0 in C only, 0 in C1 only.
- Tests that vary between runs of one variant: 5 (link health: linked routes draw a page, not the app's "not found" view @; the same components look the same on every inspected page (recorded as findings) @/#/; cumulative layout shift during load stays under 0.25 @; /#/category/hand-tools keeps its forms, lists and cards consistent (recorded as findings) ; /#/ keeps its forms, lists and cards consistent (recorded as findings) @/#/).

### TFP-214: C1 against C2, with-bugs standard

- Failures: C1 84/84/84, C2 84/84/84; the same in every run: C1 yes, C2 yes.
- Run 1, tests that give the same in every run of each: 0 failing in C1 only, 0 in C2 only; findings 0 in C1 only, 0 in C2 only.
- Tests that vary between runs of one variant: 5 (link health: linked routes draw a page, not the app's "not found" view @; cumulative layout shift during load stays under 0.25 @; /#/category/hand-tools keeps its forms, lists and cards consistent (recorded as findings) ; /#/ keeps its forms, lists and cards consistent (recorded as findings) @/#/; the same components look the same on every inspected page (recorded as findings) @/#/).

### Accessibility (moved from Gate B): A against C2, with-bugs accessibility

- Failures: A 41/41/41, C2 41/41/41; the same in every run: A yes, C2 yes.
- Run 1, tests that give the same in every run of each: 0 failing in A only, 0 in C2 only; findings 0 in A only, 0 in C2 only.
- Tests that vary between runs of one variant: 0.

### TFP-222, TFP-155, TFP-156: C2 against F, with-bugs standard

- Failures: C2 84/84/84, F 84/84/84; the same in every run: C2 yes, F yes.
- Run 1, tests that give the same in every run of each: 0 failing in C2 only, 0 in F only; findings 0 in C2 only, 0 in F only.
- Tests that vary between runs of one variant: 5 (link health: linked routes draw a page, not the app's "not found" view @; /#/category/hand-tools keeps its forms, lists and cards consistent (recorded as findings) ; /#/ keeps its forms, lists and cards consistent (recorded as findings) @/#/; the same components look the same on every inspected page (recorded as findings) @/#/; cumulative layout shift during load stays under 0.25 @).

### TFP-222, TFP-155, TFP-156: C2 against F, with-bugs accessibility

- Failures: C2 41/41/41, F 41/41/41; the same in every run: C2 yes, F yes.
- Run 1, tests that give the same in every run of each: 0 failing in C2 only, 0 in F only; findings 0 in C2 only, 0 in F only.
- Tests that vary between runs of one variant: 0.

### TFP-214: C1 against C2, clean standard

- Failures: C1 46/46/46, C2 46/46/46; the same in every run: C1 yes, C2 yes.
- Run 1, tests that give the same in every run of each: 0 failing in C1 only, 0 in C2 only; findings 0 in C1 only, 0 in C2 only.
- Tests that vary between runs of one variant: 0.

### Accessibility (moved from Gate B): A against C2, clean accessibility

- Failures: A 19/19/19, C2 19/19/19; the same in every run: A yes, C2 yes.
- Run 1, tests that give the same in every run of each: 0 failing in A only, 0 in C2 only; findings 0 in A only, 0 in C2 only.
- Tests that vary between runs of one variant: 0.

### TFP-222, TFP-155, TFP-156: C2 against F, clean standard

- Failures: C2 46/46/46, F 46/46/46; the same in every run: C2 yes, F yes.
- Run 1, tests that give the same in every run of each: 0 failing in C2 only, 0 in F only; findings 0 in C2 only, 0 in F only.
- Tests that vary between runs of one variant: 0.

### TFP-222, TFP-155, TFP-156: C2 against F, clean accessibility

- Failures: C2 19/19/19, F 19/19/19; the same in every run: C2 yes, F yes.
- Run 1, tests that give the same in every run of each: 0 failing in C2 only, 0 in F only; findings 0 in C2 only, 0 in F only.
- Tests that vary between runs of one variant: 0.

### The with-bugs / sort check's message, every run

- C run 1: Failed: Error: sorting by "Name (A - Z)" on /#/ puts "Wood Saw" before "Thor Hammer"; sorting by "Name (Z - A)" on /#/ puts "Adjustable Wrench" before "Angled Spanner"; sorting by "Price (High - Low)" on /#/ puts "Phillips Screwdriver" (4.92) before "Slip Joint Pliers" (9.17); sorting by "Price (Low - High)
- C run 2: Failed: Error: sorting by "Name (A - Z)" on /#/ puts "Wood Saw" before "Thor Hammer"; sorting by "Name (Z - A)" on /#/ puts "Adjustable Wrench" before "Angled Spanner"; sorting by "Price (High - Low)" on /#/ puts "Phillips Screwdriver" (4.92) before "Slip Joint Pliers" (9.17); sorting by "Price (Low - High)
- C run 3: Failed: Error: sorting by "Name (A - Z)" on /#/ puts "Wood Saw" before "Thor Hammer"; sorting by "Price (High - Low)" on /#/ puts "Angled Spanner" (14.14) before "Belt Sander" (73.59); sorting by "Price (Low - High)" on /#/ puts "Cordless Drill 20V" (125.23) before "Cordless Drill 18V" (119.24) expect(recei
- C1 run 1: Failed: Error: sorting by "Name (A - Z)" on /#/ puts "Wood Saw" before "Thor Hammer"; sorting by "Name (Z - A)" on /#/ puts "Adjustable Wrench" before "Angled Spanner"; sorting by "Price (High - Low)" on /#/ puts "Phillips Screwdriver" (4.92) before "Slip Joint Pliers" (9.17); sorting by "Price (Low - High)
- C1 run 2: Failed: Error: sorting by "Name (A - Z)" on /#/ puts "Wood Saw" before "Thor Hammer"; sorting by "Name (Z - A)" on /#/ puts "Adjustable Wrench" before "Angled Spanner"; sorting by "Price (High - Low)" on /#/ puts "Phillips Screwdriver" (4.92) before "Slip Joint Pliers" (9.17); sorting by "Price (Low - High)
- C1 run 3: Failed: Error: sorting by "Name (A - Z)" on /#/ puts "Wood Saw" before "Thor Hammer"; sorting by "Name (Z - A)" on /#/ puts "Adjustable Wrench" before "Angled Spanner"; sorting by "Price (High - Low)" on /#/ puts "Phillips Screwdriver" (4.92) before "Slip Joint Pliers" (9.17) expect(received).toEqual(expect
- C2 run 1: Failed: Error: sorting by "Name (A - Z)" on /#/ puts "Wood Saw" before "Thor Hammer"; sorting by "Name (Z - A)" on /#/ puts "Adjustable Wrench" before "Angled Spanner"; sorting by "Price (High - Low)" on /#/ puts "Phillips Screwdriver" (4.92) before "Slip Joint Pliers" (9.17) expect(received).toEqual(expect
- C2 run 2: Failed: Error: sorting by "Name (A - Z)" on /#/ puts "Wood Saw" before "Thor Hammer"; sorting by "Name (Z - A)" on /#/ puts "Adjustable Wrench" before "Angled Spanner"; sorting by "Price (High - Low)" on /#/ puts "Phillips Screwdriver" (4.92) before "Slip Joint Pliers" (9.17); sorting by "Price (Low - High)
- C2 run 3: Failed: Error: sorting by "Name (A - Z)" on /#/ puts "Wood Saw" before "Thor Hammer"; sorting by "Name (Z - A)" on /#/ puts "Adjustable Wrench" before "Angled Spanner"; sorting by "Price (High - Low)" on /#/ puts "Phillips Screwdriver" (4.92) before "Slip Joint Pliers" (9.17); sorting by "Price (Low - High)
- F run 1: Failed: Error: sorting by "Name (A - Z)" on /#/ puts "Wood Saw" before "Thor Hammer"; sorting by "Name (Z - A)" on /#/ puts "Adjustable Wrench" before "Angled Spanner"; sorting by "Price (High - Low)" on /#/ puts "Phillips Screwdriver" (4.92) before "Slip Joint Pliers" (9.17); sorting by "Price (Low - High)
- F run 2: Failed: Error: sorting by "Name (A - Z)" on /#/ puts "Wood Saw" before "Thor Hammer"; sorting by "Name (Z - A)" on /#/ puts "Adjustable Wrench" before "Angled Spanner"; sorting by "Price (High - Low)" on /#/ puts "Phillips Screwdriver" (4.92) before "Slip Joint Pliers" (9.17); sorting by "Price (Low - High)
- F run 3: Failed: Error: sorting by "Name (A - Z)" on /#/ puts "Wood Saw" before "Thor Hammer"; sorting by "Name (Z - A)" on /#/ puts "Adjustable Wrench" before "Angled Spanner"; sorting by "Price (High - Low)" on /#/ puts "Phillips Screwdriver" (4.92) before "Slip Joint Pliers" (9.17); sorting by "Price (Low - High)

