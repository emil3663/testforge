# TFP-197: the outcome (Phase 42 Gate B)

The gap writer was measured with real Claude Code calls on the local Toolshop
copies on 2026-10-15, following the plan Emil approved:
- Standard only, all ten areas, fast mode, at the read-only gate, one worker, Chromium;
- Phase 40's selection, unedited;
- one data folder outside the repo, clean first;
- gap limit 50.

Claude Code 2.1.238 with `--tools "" --disallowedTools "*" --strict-mcp-config
--disable-slash-commands` ran from an empty temporary folder on every call.
Its default model was `claude-sonnet-5`, with `claude-haiku-4-5` for Claude
Code's own small calls. No call failed, and there was no read-only gate
breach. Raw numbers: `analysis.txt` (from `analyse.mjs`). Every run's
records, suite, Playwright report, Claude Code calls and data folder are in
`runs/`.

## Official score: 0 of 4 (expected by design)

TFP-154's rule, against the 4 bugs still missed after Phase 41's Gate B:

| Bug | Score | Why |
| --- | --- | --- |
| 22 Forgot-password button font | missed | Edge only; not visible in Chromium |
| 23 Forgot-password email padding | missed | Firefox only |
| 49 Rentals title centred | missed | rentals is not in with-bugs' Standard selection (chainsaws is); a layout bug, not a gap the map lists |
| 54 Registration phone placeholder misspelt | missed | not in this version |

0 of 4 was expected before any run, for two reasons. None of the 4 is in
Chromium's reach on the selected pages. And the gap writer only writes for
the coverage map's in-context gap list, which on these copies is links:
every element is already checked, and none of the 4 is a link bug.

A gap test also can't fail on the site it was written for: it is revised
until it passes, or it isn't kept. So, against the bugs, it finds things
only when it runs on another site, which is the second measure below.

## The other acceptance criteria

- **No unlabelled failure on the clean copy:** met.
  - Run 1's 46 failures, and run 2's, are exactly the 46 that Gate B's clean Standard run had (TFP-188), test for test, all labelled then.
  - All 19 of clean's gap tests passed.
- **A re-run of an unchanged site reuses everything and writes nothing:** met on clean.
  - Run 2: 468 of 468 tests reused, 0 generated, 0 regenerated, 0 retired, 0 gaps asked, 0 Claude Code calls, $0. Generation took 22 s.
  - Run 4 (with-bugs) reused all 506 and generated none. It wrote the 1 gap that run 3 had left over the limit (51 gaps, 50 asked): 2 calls, $0.06. Nothing it had already written was asked again.
- **Claude Code's cost and run time:** below.
- **On with-bugs, the run itself:** 84 failures, every one a test Gate B's with-bugs Standard run also failed. All 47 gap tests passed (38 written there, 9 bound from clean); run 4 had the same 84 failures and all 48 gap tests passing.

## Second measure: run 1's tests in run 3

Clean's site suite didn't carry over to with-bugs. In run 3a, which ran on run
1's own data folder, every page type had changed: the clean copy routes by
path, with-bugs by `#/`. So all 19 of run 1's gap tests were retired with
their types (416 tests retired in all, 0 reused), and with-bugs got its own.

Run 1's tests reached with-bugs as **candidates**. Of the 10 clean's gap
tests became, **9 matched a gap on with-bugs**. Each was bound as that gap's
test (TFP-203) after passing its gates there, then ran in the verdict: **9
ran, 9 passed, 0 failed**. So there is no failure to match to a benchmark
bug or to label.

The 9 are Documentation, Sign in, Barn Images and Unsplash on `/#/`;
iMattSmart, Unsplash and More information on `/#/product/6`; and Register
your account and Forgot your Password? on `/#/auth/login`. None of them sits
on a planted bug.

## Failing attempts not kept (possible hints, read by hand)

17 on clean (run 1) and 12 on with-bugs (run 3), each after 3 attempts.
Every one is a link the writer couldn't reach:
- the nav's category menu (Hand Tools, Power Tools, Other, Special Tools, Categories, Rentals, Chainsaws), whose links aren't visible until the menu opens;
- product-card links whose accessible names hold prices, which the writer's own regular expressions didn't match;
- timeouts.

None touches a target bug:
- Chainsaws (with-bugs, a timeout) is the link of bug 3, which Gate B already found.
- `UNDEFINED [link]` is the `/#/category/undefined` category link, which Gate B's crawls already had. It is not a planted bug (bug 16's "undefined" is in the invoice address, behind an interactive flow).

## Claude Code calls, cost and time

| Run | Calls (write / revise / generalise) | Claude Code | Cost | Generation | Suite run |
| --- | --- | --- | --- | --- | --- |
| 1a clean (first attempt) | 110 (36 / 51 / 23) | 742 s | $2.69 | 1780 s | 1019 s |
| 1 clean | 106 (36 / 52 / 18) | 741 s | $2.74 | 1812 s | 1023 s |
| 2 clean again | 0 | 0 s | $0 | 22 s | 1031 s |
| 3a with-bugs (first attempt) | 114 (50 / 36 / 28) | 763 s | $3.18 | 1760 s | 0 tests (see below) |
| 3 with-bugs | 114 (50 / 34 / 30) | 662 s | $3.18 | 1692 s | 1319 s |
| 4 with-bugs again | 2 (1 / 0 / 1) | 10 s | $0.06 | 42 s | 1319 s |
| **All** | **446** | | **$11.84** | | |

About 7 s and $0.03 a call. A gap costs about 3 calls (1.4 revisions each,
plus its generalisation when saved), and about 50 s of generation with its
gate runs. The counted runs (1 to 4) cost $5.97. The two first attempts,
which the bugs below cut short, cost $5.87.

## Found by the measurement (fixed, or for Emil)

1. **No candidate could survive the real writer** (fixed in `394a096` before
   run 1 was redone). Claude Code wrote the page blank as an expression,
   `page.goto(__PAGE__)`, and the binding made it `page.goto(/)`, so run
   1a's 23 candidates all failed their bound-back check. TFP-194's stand-in
   had always quoted it.
2. **Duplicate gap-test titles made Playwright refuse the whole suite**
   (fixed in `31c0afd` before run 3 was redone). Several with-bugs form
   fields share a name on one page (`3 [input]`), and so did their gap
   tests, so run 3a's suite ran 0 tests. In the app, any such site with the
   gap writer on would do the same.
3. **The code check refuses a harmless read (not fixed; for Emil).**
   TFP-202 allows `request` only as `page.request.get(...)`, so a body that
   checks `response.request().method()` is refused as "a request other than
   GET". It happened 9 times across runs 1a, 1 and 3. It costs a revision,
   not a wrong result.
4. **The gap limit and "a re-run writes nothing".** A re-run writes nothing
   only once the gap list is used up. At the default 5, the clean copy's 36
   gaps would take 8 generations. With-bugs had 51 gaps, one more than the
   limit of 50, so run 4 wrote 1.

## Gate B, by Decision 7's keep rule

The rule: kept if it finds some of the remaining bugs, adds no unlabelled
failure on the clean copy, and a re-run of an unchanged site reuses
everything.
- **Finds some of the remaining bugs:** not met, at 0 of 4. As built and scored, the remaining bugs are out of its reach.
- **No unlabelled failure on the clean copy:** met.
- **A re-run reuses everything:** met.

Emil's decision at Gate B.
