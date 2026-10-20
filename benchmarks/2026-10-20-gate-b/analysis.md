# Phase 39 Gate B: the numbers

Medians of three runs; each run's time in seconds, in run order.

## Run times

| Copy | Suite | A (before) | B (TFP-212, 213) | C (+ TFP-215) | A to C |
| --- | --- | --- | --- | --- | --- |
| with-bugs | standard | 1342 (1352, 1342, 1326) | 919 (945, 910, 919) | 854 (865, 854, 845) | 36.4% faster |
| with-bugs | security | 205 (213, 205, 196) | - | 111 (110, 111, 113) | 45.9% faster |
| with-bugs | accessibility | 206 (206, 201, 206) | - | 204 (203, 204, 206) | 1.0% faster |
| clean | standard | 1025 (1034, 1025, 1018) | - | 513 (510, 516, 513) | 50.0% faster |
| clean | security | 197 (197, 197, 196) | - | 106 (106, 103, 106) | 46.2% faster |
| clean | accessibility | 186 (188, 185, 186) | - | 170 (165, 171, 170) | 8.6% faster |

## Against the targets

- Gate B, with-bugs standard: 36.4% faster against a target of 20%: **met**.
- Gate B, with-bugs security: 45.9% faster against a target of 30%: **met**.
- Gate B, with-bugs accessibility: 1.0% faster against a target of 30%: **not met**.
- Gate B, clean standard: 50.0% faster against a target of 20%: **met**.
- Gate B, clean security: 46.2% faster against a target of 30%: **met**.
- Gate B, clean accessibility: 8.6% faster against a target of 30%: **not met**.
- TFP-215, with-bugs Standard: C 7.1% faster than B (919 s to 854 s) against a bar of 5%: **kept**.

## Decision 7: the same results

### with-bugs, standard

- Failures: A 84/84/84, C 84/84/84; the same in every run: A yes, C yes.
- Run 1, A against C, tests that give the same in every run of each: 0 failing in A only, 0 in C only; findings 0 in A only, 0 in C only.
- Tests that vary between runs of one variant: 5 (link health: linked routes draw a page, not the app's "not found" view @; /#/ keeps its forms, lists and cards consistent (recorded as findings) @/#/; /#/category/hand-tools keeps its forms, lists and cards consistent (recorded as findings) ; the same components look the same on every inspected page (recorded as findings) @/#/; cumulative layout shift during load stays under 0.25 @); their A-against-C differences in run 1: failures 0, findings 22.

### with-bugs, security

- Failures: A 3/3/3, C 3/3/3; the same in every run: A yes, C yes.
- Run 1, A against C, tests that give the same in every run of each: 0 failing in A only, 0 in C only; findings 0 in A only, 0 in C only.
- Tests that vary between runs of one variant: 0; their A-against-C differences in run 1: failures 0, findings 0.

### with-bugs, accessibility

- Failures: A 41/41/41, C 41/41/41; the same in every run: A yes, C yes.
- Run 1, A against C, tests that give the same in every run of each: 0 failing in A only, 0 in C only; findings 0 in A only, 0 in C only.
- Tests that vary between runs of one variant: 0; their A-against-C differences in run 1: failures 0, findings 0.

### clean, standard

- Failures: A 46/46/46, C 46/46/46; the same in every run: A yes, C yes.
- Run 1, A against C, tests that give the same in every run of each: 0 failing in A only, 0 in C only; findings 0 in A only, 0 in C only.
- Tests that vary between runs of one variant: 0; their A-against-C differences in run 1: failures 0, findings 0.

### clean, security

- Failures: A 2/2/2, C 2/2/2; the same in every run: A yes, C yes.
- Run 1, A against C, tests that give the same in every run of each: 0 failing in A only, 0 in C only; findings 0 in A only, 0 in C only.
- Tests that vary between runs of one variant: 0; their A-against-C differences in run 1: failures 0, findings 0.

### clean, accessibility

- Failures: A 19/19/19, C 19/19/19; the same in every run: A yes, C yes.
- Run 1, A against C, tests that give the same in every run of each: 0 failing in A only, 0 in C only; findings 0 in A only, 0 in C only.
- Tests that vary between runs of one variant: 0; their A-against-C differences in run 1: failures 0, findings 0.

## The Toolshop score's evidence (TFP-207's evidence.mjs, run 1)

- Items per bug, A: 2:2 3:10 4:4 19:1 22:0 23:0 26:2 27:1 28:12 29:1 30:2 31:9 33:1 34:1 40:1 42:1 45:1 46:1 49:0 53:1 54:1 58:1 59:2 60:2 62:1 63:1 66:1 67:1 75:0 80:0 82:0 85:7 87:2 91:3 92:3 93:1 94:1
- Items per bug, C: 2:2 3:10 4:4 19:1 22:0 23:0 26:2 27:1 28:12 29:1 30:2 31:9 33:1 34:1 40:1 42:1 45:1 46:1 49:0 53:1 54:1 58:1 59:2 60:2 62:1 63:1 66:1 67:1 75:0 80:0 82:0 85:7 87:2 91:3 92:3 93:1 94:1
- Evidence lines in A only: 16; in C only: 15.
  - A only: [standard failure] /#/ | sort options order the items on / || Error: sorting by "Name (A - Z)" on /#/ puts "Wood Saw" before "Thor Hammer"; sorting by "Name (Z - A)" on /#/ puts "Adjustable Wrench" before "Angled Spanner
  - A only: [standard failure]  | link health: linked routes draw a page, not the app's "not found" view || Error: linked routes that show the app's "not found" view: /#/chainsaws (draws the same as /#/testforge-missing-8fre41uy, a 
  - A only: [standard failure]  | link health: linked routes draw a page, not the app's "not found" view || Error: linked routes that show the app's "not found" view: /#/chainsaws (draws the same as /#/testforge-missing-gkipixlq, a 
  - A only: [standard failure]  | link health: linked routes draw a page, not the app's "not found" view || Error: linked routes that show the app's "not found" view: /#/chainsaws (draws the same as /#/testforge-missing-dxmmyol4, a 
  - A only: [standard failure]  | link health: linked routes draw a page, not the app's "not found" view || Error: linked routes that show the app's "not found" view: /#/chainsaws (draws the same as /#/testforge-missing-q03cia7e, a 
  - A only: [standard failure]  | link health: linked routes draw a page, not the app's "not found" view || Error: linked routes that show the app's "not found" view: /#/chainsaws (draws the same as /#/testforge-missing-ui0hs56n, a 
  - A only: [standard failure]  | link health: linked routes draw a page, not the app's "not found" view || Error: linked routes that show the app's "not found" view: /#/chainsaws (draws the same as /#/testforge-missing-5pa3ftgo, a 
  - A only: [standard failure]  | link health: linked routes draw a page, not the app's "not found" view || Error: linked routes that show the app's "not found" view: /#/chainsaws (draws the same as /#/testforge-missing-43c5w1wg, a 
  - A only: [standard failure]  | link health: linked routes draw a page, not the app's "not found" view || Error: linked routes that show the app's "not found" view: /#/chainsaws (draws the same as /#/testforge-missing-1cdx4858, a 
  - A only: [standard finding] /#/category/hand-tools | /category/hand-tools keeps its forms, lists and cards consistent (reco || the card titles on /#/category/hand-tools: "Pliers" has text-align right, where the other 5 have left
  - A only: [standard finding] /#/category/hand-tools | /category/hand-tools keeps its forms, lists and cards consistent (reco || the card titles on /#/category/hand-tools: "Bolt Cutters" has text-align right, where the other 5 have
  - A only: [standard finding] /#/category/hand-tools | /category/hand-tools keeps its forms, lists and cards consistent (reco || the card titles on /#/category/hand-tools: "Hammer" has text-align right, where the other 5 have left
  - A only: [standard finding] /#/category/hand-tools | /category/hand-tools keeps its forms, lists and cards consistent (reco || the card titles on /#/category/hand-tools: "Thor Hammer" has text-align right, where the other 5 have 
  - A only: [standard failure] /#/auth/forgot-password | /auth/forgot-password shows every image it loads || Error: images on /#/auth/forgot-password that loaded but can't be shown: broken.png expect(received).toEqual(expected) // d
  - A only: [standard failure] /#/chainsaws | /chainsaws shows every image it loads || Error: images on /#/chainsaws that loaded but can't be shown: broken.png expect(received).toEqual(expected) // deep equality - Expected - 1 + Rec
  - A only: [standard finding] /#/ | / spells its interface text correctly (recorded as findings) || "Contakt" in the link "Contakt" on /#/ is not in the dictionary (en-US, en-GB); did you mean "Contact"?
  - C only: [standard failure] /#/ | sort options order the items on / || Error: sorting by "Name (A - Z)" on /#/ puts "Wood Saw" before "Thor Hammer"; sorting by "Price (High - Low)" on /#/ puts "Phillips Screwdriver" (4.92) before
  - C only: [standard failure]  | link health: linked routes draw a page, not the app's "not found" view || Error: linked routes that show the app's "not found" view: /#/chainsaws (draws the same as /#/testforge-missing-zzlk86ws, a 
  - C only: [standard failure]  | link health: linked routes draw a page, not the app's "not found" view || Error: linked routes that show the app's "not found" view: /#/chainsaws (draws the same as /#/testforge-missing-k6a3ez9f, a 
  - C only: [standard failure]  | link health: linked routes draw a page, not the app's "not found" view || Error: linked routes that show the app's "not found" view: /#/chainsaws (draws the same as /#/testforge-missing-m7qdgg8c, a 
  - C only: [standard failure]  | link health: linked routes draw a page, not the app's "not found" view || Error: linked routes that show the app's "not found" view: /#/chainsaws (draws the same as /#/testforge-missing-4vyuchng, a 
  - C only: [standard failure]  | link health: linked routes draw a page, not the app's "not found" view || Error: linked routes that show the app's "not found" view: /#/chainsaws (draws the same as /#/testforge-missing-nnvzygqx, a 
  - C only: [standard failure]  | link health: linked routes draw a page, not the app's "not found" view || Error: linked routes that show the app's "not found" view: /#/chainsaws (draws the same as /#/testforge-missing-gkp5i4fq, a 
  - C only: [standard failure]  | link health: linked routes draw a page, not the app's "not found" view || Error: linked routes that show the app's "not found" view: /#/chainsaws (draws the same as /#/testforge-missing-y7wvyeqa, a 
  - C only: [standard failure]  | link health: linked routes draw a page, not the app's "not found" view || Error: linked routes that show the app's "not found" view: /#/chainsaws (draws the same as /#/testforge-missing-2o4li5oc, a 
  - C only: [standard finding] /#/ | the same components look the same on every inspected page (recorded as || h5.card-title differs across pages in text-align: left on /#/, /#/product/6; right on /#/category/hand-tools
  - C only: [standard finding] /#/category/hand-tools | /category/hand-tools keeps its forms, lists and cards consistent (reco || the card titles on /#/category/hand-tools: "Combination Pliers" has text-align right, where the other 
  - C only: [standard finding] /#/category/hand-tools | /category/hand-tools keeps its forms, lists and cards consistent (reco || the card titles on /#/category/hand-tools: "Pliers" has text-align right, where the other 6 have left
  - C only: [standard finding] /#/category/hand-tools | /category/hand-tools keeps its forms, lists and cards consistent (reco || the card titles on /#/category/hand-tools: "Long Nose Pliers" has text-align right, where the other 6 
  - C only: [standard failure]  | no same-origin request fails while the page loads || Error: same-origin requests failed while / loaded: HTTP 404 http://localhost:4200/broken.png. Measured once, in a lab (this run, from this machin
  - C only: [standard finding] /#/chainsaws | /chainsaws spells its interface text correctly (recorded as findings) || "Contakt" in the link "Contakt" on /#/chainsaws is not in the dictionary (en-US, en-GB); did you mean "Contact"?
- with-bugs records from the session carry no manual-review items (the with-bugs half's run.mts kept none); bug 46's are checked by the axe scans alone, A against C (bug-46.md).

