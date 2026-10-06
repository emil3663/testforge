# Known-Bug Benchmark — TestForge Backlog (2026-10-06)

**Version:** 0.1
**Date:** 2026-10-06
**Status:** Locked. Decisions 1 to 4 were approved by Emil on 2026-10-06.
TFP-153 is done (classification and spot-check), pending verification of
the answer key. TFP-154 is not started; it waits for the template fixes TFP-159,
TFP-160, TFP-151 and TFP-161.

## Context

TestForge's real-site runs show what it reports, not what it misses: a site's
real defects are unknown, so a quiet run could mean a healthy site or blind
spots. A site with a published list of planted bugs gives an answer key.

Testsmith's "Toolshop" practice shop has a bug-free version
(https://practicesoftwaretesting.com/, Sprint 5) and a version with planted
bugs (https://with-bugs.practicesoftwaretesting.com/, "Sprint 5 (with
bugs)"). Testsmith's own repository
(`github.com/testsmith-io/practice-software-testing`,
`sprint5-with-bugs/testSessions/listOfBugs.md`) lists 94 bugs, read
2026-10-06. Each one has a page, title, description, expected result,
optionally an OWASP type, and the exploratory-testing tour that finds it.

What the list holds, by reading it (not yet classified for TestForge):
- **Pages:** contact 11, home 10, registration 10, product detail 8,
  checkout 6, category 5, login 5, and others. 13 are API bugs, and 10 are
  accessibility bugs (missing labels, contrast, image alts, a missing
  fieldset).
- **Browser:** 16 name Firefox, Edge or Safari. 13 of those don't show in
  Chromium at all (3 also show in Chrome). TestForge runs Chromium only, so
  the 13 are out of reach unless that changes.
- **Security:** 13 carry an OWASP type, mostly API authorisation. Most need
  attack-shaped requests, which is the active gate.

**Licence.** Testsmith's licence (all rights reserved) permits viewing,
copying and running the software "for private, internal, and non-commercial
purposes only". It forbids publishing a copy or using it to provide
services to third parties. So:
- running TestForge against the hosted sites, which Testsmith publishes for
  practice, is the intended use;
- this repo stores only each bug's ID and TestForge's own one-line
  description and classification, with the source file and commit
  recorded, never Testsmith's text;
- if TestForge ever becomes commercial, this benchmark needs Testsmith's
  written permission first.

(Claude is not a lawyer; this is a reading of the licence text, not advice.)

## Decisions (approved by Emil, 2026-10-06)

1. **The answer key is Testsmith's list, pinned to one commit.** Before any
   run, check the hosted with-bugs site matches it, for example by spot-checking
   ten bugs by hand. A bug that isn't on the hosted site is marked "not
   present" and left out of the score.
2. **Every bug is classified before measuring** (decide before measuring):
   - TestForge area (functional, accessibility, security, SEO, performance and so on);
   - the gate needed to see it (read-only, interactive, active);
   - in reach of Chromium or not;
   - which run could find it today (Standard, Comprehensive, neither).
3. **The scoring rule is written before the first run:**
   - **found:** a failure or finding names the bug's page and its cause;
   - **hinted:** a failure or finding on the right page whose message doesn't
     name the cause;
   - **missed:** neither.

   A failure that also appears on the bug-free site is not a find. The two
   versions' code has drifted apart (460 differing files in the
   repository), so the bug-free site is an approximate control, not an
   exact one.
4. **Gates on the hosted sites:** read-only only, one worker, as Phase 38
   Decision 8 set for real sites. Interactive (forms, the published demo
   accounts) and active (the API security bugs) wait for a local copy run
   through Testsmith's `docker compose` setup on Emil's machine. The licence
   permits that, and a local copy is a host TestForge may own. Active also
   waits for Phase 35 Decision 8's ownership confirmation.

## Backlog

### TFP-153 — The answer key: Testsmith's bug list, classified for TestForge

- **Priority:** P2 · **Labels:** `measurement`, `benchmark`
- **Problem it solves:** TestForge has no measure of what it misses.
- **Scope:** Decisions 1 and 2.
- **Deliverables:**
  - `benchmarks/<date>-toolshop-known-bugs/answer-key.md`: for each bug, ID,
    TestForge's own one-line description, area, gate, Chromium reach, which
    run could find it, and present or not present on the hosted site;
  - the source file and commit it was read from.
- **Acceptance criteria:**
  - every listed bug is classified, or marked "not present" with what was
    checked;
  - no Testsmith text is copied in.
- **Dependencies:** Phase 38 Gate B.

- **Progress (2026-10-06, Cowork):** classified in
  `benchmarks/2026-10-06-toolshop-known-bugs/answer-key.md`, from commit
  `c752a70`. All 94 are classified, in TestForge's own wording.
  - The prediction: 7 likely, 10 maybe, 77 not caught today.
  - **Spot-check done the same day, in Chrome, read-only:** 15 of 15 checked
    bugs are present.
  - **It found that the with-bugs site routes by `#/` hash, while the clean
    site routes by path.** TFP-154 must first check what TestForge's crawl
    finds there. If it only finds `/`, that is a gap of its own and needs a
    ticket before scoring.

### TFP-154 — Run TestForge against both versions and score it

- **Priority:** P2 · **Labels:** `measurement`, `benchmark`
- **Problem it solves:** the gap list for the Standard sets is a judgement
  today; this makes it a measurement.
- **Scope:** Decisions 3 and 4.
- **Deliverables:**
  - Standard and Comprehensive runs (every area) on the with-bugs site and
    the bug-free site, read-only, one worker;
  - each bug scored found, hinted or missed, with the test that found it;
  - every failure on the with-bugs site that matches no listed bug, read by
    hand and recorded in the labelled failure set;
  - a report under `docs/decisions/`, with found, hinted and missed counts
    for each area and gate, and the missed bugs grouped by what would catch
    them.
- **Acceptance criteria:**
  - the scoring rule is committed before the first run;
  - every bug in reach at the read-only gate has a score;
  - every failure on the with-bugs site is either a scored bug or a labelled
    failure;
  - the report says which areas' Standard sets the misses point to.
- **Dependencies:** TFP-153. The template fixes TFP-151 and TFP-159 to
  TFP-161 come first, so their false failures on this same site don't mix
  into the score.

## Recommended Execution Order

1. Confirm Decisions 1 to 4. **Done, 2026-10-06.**
2. TFP-153. **Done 2026-10-06 (Cowork).**
3. TFP-154, at the read-only gate on the hosted sites.
4. Later, a local Docker copy for the interactive and active gates, once
   Phase 35 Decision 8 is built.

## Suggested Milestone Gate

### Gate — Known misses measured
- TFP-153 and TFP-154 landed and independently verified.
- The scoring rule was committed before the first run.
- Found, hinted and missed counts are recorded for each area.
