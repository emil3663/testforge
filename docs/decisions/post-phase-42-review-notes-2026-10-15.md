# Post-Phase 42 Review — Working Notes (2026-10-15, Cowork)

Notes from the evening of 2026-10-15, while TFP-207 ran. Not yet decisions
unless marked. Read with `post-phase-42-review-plan.md`.

## R3 claims audit — first pass (at `bfd900a`, before R1's numbers)

False
- F1 README features, "How it works", tech stack: "OpenAI GPT-4o generates",
  "TestForge calls OpenAI". The default is the template; the OpenAI path
  tries `gpt-4.1-mini` first (`src/lib/generate/models.ts`) and no live
  OpenAI completion has ever succeeded (TEST_PLAN known limitation 5).
- F2 README "Example generated test": a hand-written Plane login sample, not
  current generator output. Replace with a real excerpt from a committed
  benchmark suite.
- F3 Phase 42 record, Dependencies: "Phase 39's workers ... apply to every
  test this phase runs". Phase 39 was never started.
- F4 TEST_PLAN known limitation 1, "in-process code execution": runs are a
  spawned child process (`src/lib/run/executor.ts`), with a trimmed
  environment since TFP-202.

Stale
- S1 `product-roadmap.md`: Phase 41 "locked, not started" (complete
  2026-10-13); Phase 42 "in progress" (complete 2026-10-15).
- S2 TEST_PLAN: header "Last updated 2026-09-17", overview, the 7-row
  feature status table (nothing from Phases 35 to 42), roadmap ending at
  Phase 24. The test cases themselves are current (GEN-97 is TFP-205).
- S3 Handover: heading "State on 2026-10-07"; the Phase 42 bullet "Not to be
  started before Phase 41's Gate B"; issue #2 "Emil closes it" (closed);
  about 100 lines of Phase 38 "Do next" history. Replace with a short,
  fresh handover.
- S4 README names Plane as the test target; everything measured since
  Phase 38 uses the local Toolshop copies and the fixtures.
- S5 README scripts table: 13 listed, 23 in `package.json` (missing
  `test:unit`, `check:template-unchanged`, `library:promote`,
  `benchmark:local`, ...).

Understated
- U1 README features: nothing on the read-only/interactive/active gates,
  Standard and Comprehensive runs, page-type selection, Phase 41's checks,
  the coverage map, or the benchmark result (33 of 37 found locally).
- U2 CI runs lint, build, smoke and (manually) regression; not the unit
  suite (572 tests) or `check:template-unchanged`.

Unverifiable here: the Plane compose setup still works; the OpenAI path
with a funded key; each phase's numbers against today's code (R1).

Open items found: TFP-169 (security case ECONNRESET at fixture start-up) is
probably the Comprehensive security flake: fold into TFP-208. Phase 39 was
locked 2026-10-06 and never started.

Proposed, awaiting Emil: README front door rewritten after R1's numbers;
the other doc fixes (S1, S2, S3, F3, F4) made once Code is stopped; a Code
ticket TFP-210 to add the unit suite and the template check to CI.

## Phase 39 widened to run speed (agreed in principle with Emil, 2026-10-15)

Evidence: TFP-197's clean re-run, one worker: 468 tests, 446 page visits,
median test about 1.5 s, about 17 min of test time. Almost every test loads
its page afresh, and every visit waits up to 5 s for the network to settle.

The amended record (to draft after TFP-207) covers, in order:
1. **Measure first**, per run: time in page loads and settle waits; how many
   visits hit the 5 s cap; time failing tests spend waiting out timeouts;
   visits per page per area; overlap left between areas (link health,
   TFP-205's link tests, linked routes, the navigation-link check). The
   numbers set the keep-or-revert target before anything is built.
2. **One visit per page for read-only checks, across areas** (functional,
   accessibility, SEO, usability, passive security), each check still its
   own test and result under its own area. Passive security needs the
   page's load-time requests recorded on the shared visit and handed to
   each check.
3. **Functional sharing by control kind:**
   - in place (radio buttons, toggles, tabs, accordions, anchors, link
     presence): share the loaded page; a test that changes something puts
     it back;
   - in-app navigation (single-page apps, e.g. a sidebar that swaps the
     main pane, as in Claude's own UI): chain the clicks on one loaded app;
     each check confirms the pane really changed to its target (address
     and content), so it can't pass on the previous link's content;
   - full navigation (multi-page sites): the target loads anyway; return
     with back rather than a fresh load.
   How many controls fit each kind is to be looked at later (Emil).
4. **Rules for shared pages:** after a failure, reload (Emil); after a test
   that left the page, reload; a test that types clears what it typed,
   pass or fail; a failure on a shared page is re-run once on a fresh page
   and the fresh result is reported, both recorded; proof on the fixture
   that every test's result is the same shared and one-page-per-test.
5. **Keep their own fresh page:** performance (measures the load),
   responsive (viewport before load), cookie and session checks (clean
   state), and everything at the interactive or active gates.
6. **Tune the settle wait and read-only timeouts** from the measurements.
7. **Parallel workers** as already locked (Decisions 1 to 4).

Belongs in R5 as a decision record amendment; Emil confirms before it is
locked.
