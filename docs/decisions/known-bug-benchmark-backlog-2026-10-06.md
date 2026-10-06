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

### TFP-165 — Treat `#/` links as pages on sites that route by hash

- **Priority:** P1 (it blocks TFP-154) · **Labels:** `enhancement`, `crawl`, `introspect`, `generate`
- **Problem it solves:** TFP-154 step 1 (`c1685b7`,
  `step1-crawl-and-inspection.md`) measured it. On the with-bugs Toolshop,
  which routes by `#/` links, TestForge's crawl finds 1 page; on the clean
  Toolshop, which routes by path, it finds 46. The crawl clears every URL's
  `#…` part (`normalized.hash = ""` in `src/app/api/crawl/route.ts`), so
  each `#/…` link counts as `/`. Read from the code, not run:
  - inspection records every `#…` link as an in-page anchor;
  - link health never requests one, and the per-link check passes any
    route, including one that shows a "not found" page (bug 3);
  - the anchor check looks for an element with id `/contact`, a false
    "Anchor target missing".

  Many single-page apps route this way (Angular's and Vue's hash modes,
  React Router's HashRouter), so this isn't just a Toolshop gap.
- **Decisions to confirm (recommended):**
  1. **A `#` link is a page when what follows the `#` starts with `/` or
     `!/`.** Everything else stays an in-page anchor, including `#top`,
     `#filters` and a bare `#`.
  2. **A route page is named as the address bar shows it,** `/#/contact`,
     everywhere: the crawl, inspection, generated tests and reports.
  3. **After moving to a route, the crawl and the tests wait for the app
     to finish drawing it,** because the browser doesn't reload the page.
     That means network idle, with a bounded timeout, as TFP-142 bounded
     other waits.
  4. **A route that doesn't exist is found by comparison, not by
     guessing:**
     - once per run, open a route that can't exist (`/#/testforge-missing-<random>`)
       and record what the app draws;
     - a linked route that draws the same thing is "not found".

     This is the client-side twin of the passive missing-page probe, and it
     works whatever wording the site uses. It stays read-only: it is only
     page loads.
- **Scope:** crawl, inspection, link health, the anchor check and link-type
  classification follow Decisions 1 to 4. Path-routed sites don't change.
- **Deliverables:** a hash-routed fixture page set with a missing route, the
  changes, and `TEST_PLAN.md` cases. ISTQB technique: equivalence
  partitioning (route fragment, anchor fragment, bare `#`).
- **Acceptance criteria:**
  - On the fixture, the crawl finds every linked route as its own page.
  - A link to a missing route fails link health, naming it. `#top` still
    passes the anchor check, and no route fragment is treated as an anchor.
  - `check:template-unchanged` gives 166 of 166 identical: no fixed input
    is hash-routed.
  - Re-run TFP-154 step 1. The with-bugs crawl finds the routes that the
    clean site finds as paths, give or take the sites' own differences.
- **Dependencies:** none. TFP-154 depends on it.
- **Done, `8324b2b`, verified 2026-10-06 (Cowork):**
  - `check:template-unchanged 2f435a6 8324b2b` gives 166 of 166 identical.
  - The re-run crawl (`b187e25`) finds 34 pages on with-bugs, up from 1,
    and the clean site's 46 match its first run exactly. Both sites have
    the same 8 main routes. `/#/category/undefined` and `/#/chainsaws`
    exist only on with-bugs, and are listed bugs.
  - Read in the code: `isRouteFragment` follows Decision 1, and
    `pagePathOf` Decision 2. The start route (`#/`, `#!/`) is never
    compared with the missing-route view, so an app that sends unknown
    routes home doesn't fail its own home link.
  - Measured by Code: the `/spa` fixture case (453/453 in the unit suite)
    fails on the old code.
  - Known limits, accepted:
    - a page whose text changes on every load can make a missing route look
      found, which is a miss, not a false failure;
    - TFP-161's orphan check still clears the `#…` part, so it is
      meaningless on a hash-routed site. That is TFP-166.

### TFP-166 — The orphan-page check on hash-routed sites

- **Priority:** P2 (before TFP-154) · **Labels:** `bug`, `generate`, `seo`
- **Problem it solves:** TFP-161's orphan check clears the `#…` part of
  each link, so on a hash-routed site every route counts as `/`. Its result
  there means nothing, and it would mix into TFP-154's score.
- **Scope:** count inbound links by `pagePathOf`, as the crawl now does.
- **Acceptance criteria:**
  - On the `/spa` fixture, a route no other route links to fails as an
    orphan, and linked routes pass.
  - `check:template-unchanged` gives 166 of 166 identical.
- **Dependencies:** TFP-165.
- **Done, `26fed09`, verified 2026-10-06 (Cowork):**
  `check:template-unchanged dfabfaf 26fed09` gives 166 of 166 identical. The
  orphan-page test's non-browser case passes here. Measured by Code: the
  hash-routed column fails falsely on the old code, as "/spa#/contact is not
  linked", and on the new code only the genuinely unlinked `/spa#/offer`
  fails. Profiles without `requestedPaths` keep the old check.

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
- **Dependencies:** TFP-153, TFP-165 and TFP-166. The template fixes TFP-151 and
  TFP-159 to TFP-161 come first (done 2026-10-06), so their false failures
  on this same site don't mix into the score.
- **Step 1 done, `c1685b7`, verified 2026-10-06 (Cowork):** the committed
  crawl output gives 1 page on with-bugs and 46 on the clean site.
  Scoring waits for TFP-165.

## Recommended Execution Order

1. Confirm Decisions 1 to 4. **Done, 2026-10-06.**
2. TFP-153. **Done 2026-10-06 (Cowork).**
3. TFP-165 (hash routes), raised by TFP-154 step 1. **Done, `8324b2b`,
   verified 2026-10-06.** Then TFP-166 (the orphan check on hash routes). **Done, `26fed09`,
   verified 2026-10-06.**
4. TFP-154, at the read-only gate on the hosted sites.
5. Later, a local Docker copy for the interactive and active gates, once
   Phase 35 Decision 8 is built.

## Suggested Milestone Gate

### Gate — Known misses measured
- TFP-153 and TFP-154 landed and independently verified.
- The scoring rule was committed before the first run.
- Found, hinted and missed counts are recorded for each area.
