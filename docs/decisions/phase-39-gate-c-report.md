# Phase 39 Gate C Report — Split and Serial (TFP-214, TFP-241, TFP-222, TFP-155, TFP-156)

Date: 2026-10-21
Evidence: `benchmarks/2026-10-21-gate-c/`. `analysis.md` has every number below.
Targets: the record's Gate C table (`phase-39-run-concurrency-decision-record.md`, "Gate C").
Setup:
- **Variants:**
  - A (`4a85f1f`), before TFP-212;
  - C (`2be975c`), Gate B's code;
  - C1 (`3b1210c`), with TFP-241;
  - C2 (`d3e197e`), with TFP-214;
  - F (`7599789`), with TFP-222, TFP-155 and TFP-156, run as the app runs it (units, the serial group second);
  - FL, F with the axe scan last.
- **One session, interleaved:** 04:45 to 10:00, three runs each, one worker, the local Toolshop copies (with-bugs,
  then clean), every variant generated from one inspection per copy. Trimmed to the runs the comparisons need.
- **A quiet machine:** VS Code, Docker and Claude only (Edge and WhatsApp ended by Emil at 04:48, before the first
  run). Plane stopped for the session and restarted at 10:00.

For Emil: two decisions, below.

## Bottom line

| Comparison | Judges | Target | with-bugs | clean |
| --- | --- | --- | --- | --- |
| C against C1 | TFP-241's cost | under 5% | 2.5% slower: **kept** | (not run) |
| C1 against C2 | TFP-214 | at least 10% faster | 14.9%: **met** | 20.5%: **met** |
| A against C2 | accessibility | at least 30% faster | 12.1%: **not met** | 35.0%: **met** |
| C2 against F | TFP-222, 155, 156 | same results; no slower beyond 5% | Standard 1.6%, accessibility 1.6% faster; same: **met** | 1.7%, 0.0% faster; same: **met** |
| F against FL | where the axe scan runs | identical axe findings and faster | identical, 15.6% faster | identical, 21.1% faster |

- **Decision 7 holds in every comparison:** the same failing tests in every run of every variant, on both copies, and
  0 differences in failures or findings between the variants of any comparison, among the tests that give the same
  in every run.
- **Scan last meets its rule on both copies.** Under Emil's ruling it becomes the default. That is a code change (the
  switch's default) and a template baseline move, not yet made: for Emil.
- **Accessibility misses on with-bugs only,** as at Gate B, for the cause Gate B measured. For Emil, below.

## Run times (seconds; median, then each run)

| Copy | Suite | A | C | C1 | C2 | F | FL |
| --- | --- | --- | --- | --- | --- | --- | --- |
| with-bugs | Standard | - | 847 (836, 851, 847) | 868 (861, 868, 874) | 739 (738, 748, 739) | 727 (727, 727, 723) | - |
| with-bugs | Accessibility | 207 (205, 210, 207) | - | - | 182 (182, 182, 181) | 179 (181, 177, 179) | 151 (157, 151, 150) |
| clean | Standard | - | - | 521 (521, 512, 531) | 414 (416, 412, 414) | 407 (401, 407, 420) | - |
| clean | Accessibility | 197 (197, 214, 195) | - | - | 128 (133, 125, 128) | 128 (128, 135, 127) | 101 (101, 127, 100) |

- **Against Gate B:** C's with-bugs Standard took 847 s (Gate B: 854 s), so the machine was in about the same state.
  On with-bugs Standard, A to F is not measured in one session (A has no Standard run here); C to F is 14.2% faster.
- **Page loads, with-bugs Standard, run 1:** C 319, C1 319, C2 261, F 260. Accessibility: A 80, C2 61, F 61, FL 44.
- **F's split:** with-bugs Standard ran as 19 unit files in 2 passes (5 tests in the serial group); clean Standard as
  17; accessibility as 20, in one pass (no serial group).
- **The spread:** at most 4% between a variant's runs, except clean accessibility, where A spread 195 to 214 s and FL
  100 to 127 s.

## Decision 7: the same results (`analysis.md`)

- **Failures, every run of every variant:** with-bugs Standard 84, accessibility 41; clean Standard 46,
  accessibility 19.
- **Between variants:** 0 tests failing in one variant only, 0 findings in one variant only, in every comparison.
- **Tests that vary from run to run of one variant** (compared apart, as at Gate B): 5 on with-bugs Standard, the
  same kinds as Gate B's:
  - link health's linked routes (its cutoff);
  - the cross-page component check and the pages' card consistency (bug 4's random alignment);
  - a lab CLS measurement.
  None on clean, and none in accessibility.
- **The scans, F against FL:** every axe scan's status, findings and manual-review items identical in every run, on
  both copies.

## The with-bugs `/` sort message (Gate B ruling 4)

- The check fails in every run of every variant (C, C1, C2, F).
- Its message varies within one variant: C names "Name (Z - A)" in runs 1 and 2, not in run 3. C1, C2 and F name it
  in all three.
- So the message depends on the with-bugs app's state at the moment of the check, not on the code: the same code
  gives both messages. This is the reading Gate B recorded, now measured.

## For Emil

1. **Accessibility on with-bugs: 12.1% against 30%.**
   - The cause is Gate B's: the axe scan fails on all 20 with-bugs pages. Each failure restarts the worker, so the
     checks after it load the page again. On clean, where it fails on fewer pages, the target is met (35.0%).
   - With the scan last (FL), with-bugs reaches 27.1% (151 s against A's 207 s), and clean 48.7%.
   - Options:
     - **a. Accept the gate,** with the with-bugs miss recorded. Standard is past its targets on both copies, clean
       accessibility is past its target, and with-bugs accessibility is 12% faster with the same results.
       Recommended.
     - **b. Make scan-last the default (decision 2) and judge with-bugs accessibility on FL:** 27.1%, still short of
       30%.
     - **c. Apply the rule as locked: not met, reverted.** That would give up TFP-214's Standard gains (15% and 20%)
       for a target that one copy's bug pattern decides.
2. **The axe scan last becomes the default,** as Emil's rule says (identical findings on both copies, and faster:
   15.6% and 21.1%).
   - This needs the switch's default flipped, `check:template-unchanged`'s baseline moved in its own commit, and the
     template's accessibility suites changed in order only. Not done without Emil's go-ahead.
