# TFP-207: the full regression after Phase 42 (review R1)

Run on 2026-10-15/16. No code changes, no Claude Code calls, gap writer
off.
- **Code under test:** the suites and template check ran on `bfd900a` (`logs/commit.txt`), the benchmark on `076fba5`, which adds only its own script under `benchmarks/`. `src/` is the same in both.
- **Benchmark:** TFP-175's driver (the template's suite, as Phase 41's Gate B ran it), Standard only as the ticket says, Phase 40's selection unedited, at the read-only gate, one worker, Chromium.

## Suites

| Run | Result | Time |
| --- | --- | --- |
| Unit 1 | 571 / 572 | 834 s |
| Unit 2 | **572 / 572** | 770 s |
| Unit 3 | 571 / 572 | 757 s |
| Regression | **57 / 57** (second attempt; see below) | 472 s |
| `check:template-unchanged` against `18b47d8` | **166 / 166 identical** | 1 s |

The regression suite's first attempt ran no test. Its web server
(`npm run serve:self-test`, a `next build` then a start on :3001) wasn't
ready within the config's 120 s, and nothing else held :3001. The second
attempt built and passed. Log: `logs/regression-attempt1-webserver-timeout.log`.

### Flake table (three unit runs)

| File | Test | Failed in | Message |
| --- | --- | --- | --- |
| `src/lib/generate/read-only-guard.test.ts:168` | in a real browser: a page's beacons, sent as a link is followed, are aborted and noted, not a breach (TFP-199) | 1 of 3 (run 1) | `sendBeacon's POST, typed ping:` expected true, got false |
| `src/lib/generate/mock/cookie-scope.test.ts:90` | in a real browser: on a page with a session cookie and two that are not, none with HttpOnly, both checks name the same one | 1 of 3 (run 3) | `TypeError: Cannot read properties of undefined (reading 'status')`: a record missing from the run |

The three load flakes named in the Phase 42 record passed in all three
runs: `comprehensive-scenarios.test.ts:85`, `performance-bands.test.ts:67`
and `api-fields.test.ts:65`. So did every other test. No test failed in
more than one run.

## The Toolshop score: 30 found, 0 hinted, 7 missed (Standard only)

TFP-154's committed rule, the evidence gathered by `evidence.mjs` (TFP-188's
script with its bug patterns unchanged, Standard only), read bug by bug.

| | Gate B local (TFP-188) | TFP-207 |
| --- | --- | --- |
| Runs | Standard, Comprehensive security, Comprehensive accessibility | Standard |
| Found | 33 | 30 |
| Hinted | 0 | 0 |
| Missed | 4 | 7 |

**Every bug Gate B found through Standard is found again, by the same
check and cause.** The 3 differences are the bugs Gate B found only
through Comprehensive security, which this ticket doesn't run:

| Bug | Gate B | TFP-207 | Why |
| --- | --- | --- | --- |
| 75 Products API exposes stock | found | missed | all 8 of Gate B's evidence items were from Comprehensive security; its Standard run had none either |
| 80 Log file reachable from the web | found | missed | Gate B's 1 item was from Comprehensive security, none from Standard (present now: the start check answered 200) |
| 82 Sequential, guessable ids | found | missed | all 8 of Gate B's items were from Comprehensive security, none from Standard |

The other 4 misses are Gate B's own:
- 22 is Edge only and 23 is Firefox only;
- 49's page (rentals) isn't in with-bugs' selection;
- 54 isn't in this version. Its one evidence item is bug 53's tab-order failure, matched by a wide pattern: a near miss, as at Gate B.

Checked by hand where the first item wasn't the cited one:
- **92:** the axe `image-alt` items on the product cards are in the full Playwright report, beyond the records' 600-character cut. They are identical to Gate B's (8, 40 and 16 occurrences), and clean has none.
- **46 and 60:** the cited items are present: the product pages' axe `color-contrast` items, and `the "Subject" list on /#/contact offers "Error 101: Subject not found"`.

## Failures against Gate B

- **Clean:** 46 failures, exactly the 46 of Gate B's clean Standard run, all labelled then. None is new, and none is gone. TFP-205's 37 link tests all passed.
- **With-bugs:** 89 failures. 84 are Gate B's, with none gone. **5 are new, all TFP-205 link tests**, on product-card links on `/#/category/hand-tools`. Example: `"ECO Sledgehammer ABCDE$17.75" is on /#/category/hand-tools`, found neither by name nor by its address `#/product/10`.
  - **Cause:** the page draws a different window of products from one load to the next. Gate B's inspection had products 1 to 9 there, this one had 6 to 14, and by the run, 10 to 14 were gone.
  - **What it is:** a false failure TFP-205 brings to pages whose content varies between loads. It isn't labelled yet. It is for TFP-208 or a review ticket; it is recorded here, not fixed.

## TFP-205's link tests and the gap list

| Copy | Link tests run | Failed | In-context gaps: elements | links |
| --- | --- | --- | --- | --- |
| With-bugs | 38 | 5 (the drift above) | 31 (Gate B's suite: 31) | **0** (Gate B's: 31) |
| Clean | 37 | 0 | 5 (Gate B's: 5) | **0** (Gate B's: 35) |

As expected, no link is left on either copy's gap list. The element gaps
are unchanged from Gate B: the same elements, which TFP-205 doesn't touch.
- **with-bugs:** the home page's filter checkboxes, some named alike (`3 [input]` twice), its sort and search forms, and three page forms.
- **clean:** five forms.

TFP-201's "every element in context" was measured on clean's elements
other than forms; it is not true of with-bugs.

## Time

| Step | Time |
| --- | --- |
| Three unit runs | 39 min |
| Regression | 8 min, plus the 2-minute attempt that didn't run |
| Start with-bugs | 15m39s (composer took about 15 min) |
| with-bugs crawl and Standard | 26m43s (suite 1535 s) |
| Start clean | 7m31s, with the stop |
| clean crawl and Standard | 20m12s (suite 1131 s) |

Both copies were stopped afterwards.
