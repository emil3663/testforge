# Handover to Claude Code — Phase 39, Gate D (2026-10-21)

This replaces `docs/HANDOVER_TO_CLAUDE_CODE_2026-10-16-review.md`. Delete
that file (`git rm`) in the commit that adds this one. Its history is in
git and in the phase records.

You are a fresh session, started on purpose so the latest versions of
Emil's account skills are loaded.

## Read first

- **`docs/decisions/phase-39-run-concurrency-decision-record.md`:**
  - the Gate A targets;
  - the Gate B and Gate C rulings;
  - TFP-157 and TFP-158, which are next;
  - Gate D.
- **`docs/decisions/deferred-work-register.md`:** the build order after
  Phase 39, and the standing rules at the top.
- **`docs/decisions/post-phase-42-review-plan.md`:** R4's tickets, which you
  build between gates.
- **`docs/QUALITY_GATES.md`:** gates, evidence and verification.
- **`CLAUDE.md`:** RTK. Check it with `rtk gain` at the start of a session.
  If it isn't working, tell Emil; don't reinstall it or change user-level
  settings.

## At the start of this session

- **List the skills you have loaded,** and say which version of
  `conventional-commits` you see. It should include a section, "Every claim
  in the body is measured first". If it doesn't, tell Emil before
  committing anything.

## State on 2026-10-21

- **`origin/main` is at `224feec`.**
- **Phase 39, Gates A, B and C have passed:**
  - Gate A: 2026-10-20;
  - Gate B: 2026-10-20, accessibility moved to Gate C;
  - Gate C: 2026-10-21, with-bugs accessibility recorded at 27.1% against
    30%.
- **Built and verified:**
  - TFP-211 (measurement);
  - TFP-240 (the sort check);
  - TFP-212, TFP-213 and TFP-215 (shared visits; the 2 s assertion wait);
  - TFP-241 (video for failing shared checks);
  - TFP-214 (in-place checks share; path links by Back);
  - TFP-222 (a folder per app run);
  - TFP-155 (units);
  - TFP-156 (the serial group);
  - the axe scan last by default (`d95fb61`).
- **The template baseline is `d95fb61`,** pinned in `nightly.yml`.
- **Standard on one worker, Gate C's session:** with-bugs 847 s (C, Gate B's
  code) to 727 s (F); clean 521 s (C1, with TFP-241; C wasn't run on clean)
  to 407 s (F). F ran with the axe scan before the changing checks;
  Standard on `d95fb61`'s order isn't measured. Decision 7 has held at
  every gate.
- **Known one-off flakes, one data point each** (register D23):
  - `performance-bands.test.ts:69`;
  - `timing.test.ts`'s settle cap.

  A second failure of either gets a ticket.
- **CI:**
  - every workflow runs on Node 24, from `.nvmrc`;
  - the nightly runs the unit suite and the template check;
  - a scheduled run can start hours late, which is GitHub's best effort.

## Next, in order

1. **TFP-157:** worker limits and a request cap by host (Decision 10). The
   ownership row is tested with a stub until Phase 43. Stop for
   verification.
2. **Prepare Gate D's overnight session** (TFP-158, Decision 13):
   - **targets:** the fixture, the local Toolshop copies, and a local copy
     of the-internet;
   - **the-internet's copy** is set up in WSL's Linux filesystem, by the
     register's standing rule. The Toolshop copies stay where they are until
     D26, after Phase 39;
   - **the hosted practicesoftwaretesting.com run:** capped, recorded only;
   - **1 worker against the machine limit,** medians of 3; Decision 13's 40%
     is judged on Comprehensive, every area, on the local Toolshop;
   - **Phase 38's missing before and after** on the local the-internet copy;
   - **a dry run,** then tell Emil it's ready, and wait for him.
3. **Around these, during the day, R4:**
   - TFP-217 Part A;
   - TFP-206;
   - TFP-209;
   - TFP-236 to TFP-239 (R6's skills tickets).

   Not TFP-217 Part B: the Gmail setup can't be done before about
   2026-10-26.

After Phase 39: D26, then Phase 43 (the register's build order).

## Measurement sessions

- **They run overnight.** Emil closes his browsers and says go.
- **A quiet machine:**
  - only VS Code, Docker Desktop and the Claude app running;
  - Ollama not running.
- **Plane:** stop Emil's Plane stack (the 8 `testforge-plane-*` containers)
  at the start, and restart it at the end. Record both in the session's
  logs, as at Gates B and C.
- **Docker Desktop is not updated during Phase 39.**
- **Record the machine's state at the start.**
- **Judging:** before against after, in one session, interleaved, medians
  of three.
- **Worktrees:** the session runner may use temporary worktrees, as at
  Gates B and C, linked with Node, not `mklink`, and removed by the runner.
  Outside a session runner, don't create worktrees.
- **Worktrees:** as `WORKING_AGREEMENTS.md` allows; the 2026-10-07 hazard
  came from a linked `node_modules`.

## Git

- **No `git stash` in this repo:** Emil keeps an older stash entry.
- **Reading an old version:** use `git show <commit>:<path>`.
- **Building an older commit:** clone it to a separate folder with its own
  `npm ci`, or use the session runner's worktree pattern.

## Local test sites

- **The Toolshop:** `scripts/toolshop-local/`.
  - Docker Desktop must be started first.
  - One version at a time; stop each copy after use.
- **Any new local site** keeps its code in WSL's Linux filesystem, not a
  Windows folder mounted into Docker (register, standing rule).

## TestForge's test account

- **The address:** `testforgeapp@gmail.com`, with
  `testforgeapp+<site>@gmail.com` per site.
- **The credentials** are only in `.env.local` (`TESTFORGE_ACCOUNT_EMAIL`,
  `TESTFORGE_ACCOUNT_PASSWORD`).
  - Never in a tracked file, a commit, a doc, a fixture, a report or a log.
  - Never print them.
- **Practice sites** use their published demo accounts. Any other site
  waits for the owner's sign-off on Comprehensive testing.
- **Real-site runs:** never rizonetech.com (a friend's revenue-earning
  site).

## Standing rules

- **`TEST_PLAN.md` cases** go in the same commit as the code.
- **Output changes are measured** with `npm run check:template-unchanged`,
  not diff-read. A deliberate change moves the baseline, and the nightly's
  `TEMPLATE_BASELINE`, in its own commit.
- **Counts and measurements come from unfiltered output** (`rtk proxy`),
  **read before the commit message is written.** A claim about evidence or
  behaviour is measured, or labelled as reasoning.
- **Every new test names its ISTQB technique.**
- **While the Standard and Comprehensive sets are built** (later, after
  Phase 39), each is verified on its own section. Full evidence comes once
  per set (register, standing rules).
- **The script-payload test stays Not run** until Phase 43, with its
  reason.
- **A decision that comes up while building goes to Emil,** not into the
  ticket.
- **ASVS IDs** are copied from the published source, with file and version.
  **Core Web Vitals bands** come from web.dev. Don't change a threshold
  without a decision.
- **Stop only the processes you started,** by process ID, never by name.
- **Never close Emil's apps or browsers.** Ask him.
- **Conventional Commits,** with the why, the alternatives rejected, and
  what the change doesn't do.

## From the outgoing session (2026-10-21)

Only what isn't above or in the decision records.

### Uncommitted, unpushed or half-done

- **Nothing.** This file was the only change; local `main` and `origin/main` match. TFP-157 isn't started.
- **Leftovers in `.playwright-runs/` (gitignored, 275 MB), not this session's:**
  - 505 `artifacts-<id>` folders and about 40 top-level run files (`test-`, `progress-reporter-`, `report-`, `wb-`, one
    `gap-test-`), dated 2026-08-28 to 2026-10-16;
  - the old executor layout, from before TFP-222. Its sweep removes only `run-`, `gap-` and `recheck-` folders, so
    these stay;
  - ask Emil before deleting them. This session removed its own 25 (from 02:13 to 02:14, its runs of TFP-222's race
    test against the old executor).
- **`comparisons/template-unchanged/`** (gitignored) holds every template comparison so far. Harmless.

### Running now

- **Plane:** its 8 `testforge-plane-*` containers are up, restarted by Gate C's runner at 10:00.
- **The Toolshop:** stopped (the runner's last step, 10:00).
- **Worktrees:** none but the repo itself; no `../testforge-gate-*` folders.
- **One `node` process:** Playwright's `test-server` for VS Code. It isn't this session's; leave it.

### The session runners, for Gate D

Copy `benchmarks/2026-10-21-gate-c/` (Gate B's, with fixes); its README has the layout.
- **`run-all.sh <commits…>`:**
  - refuses to start with uncommitted `src/`;
  - records the machine's state and stops Plane, then starts it again at the end;
  - one worktree per variant (`../testforge-gate-c-<variant>`, `node_modules` linked by a Node junction), removed at
    the end;
  - per copy: start, crawl and select (`2026-10-07-tfp175-selection/crawl-and-select.mts`), inspect once
    (`2026-10-20-gate-b/inspect.mts`), generate in each worktree, run;
  - each step's `.start`, `.end` and `.log` in `logs/`;
  - `DRY=1` runs the same on the comparison fixture (port 4471), one round, into `dry/`, leaving Plane and the Toolshop
    alone.
- **`run.mts`:**
  - each run in its own run folder (`createRunFolder`);
  - a variant in `SPLIT` runs as the app runs it: `splitSuite`, the read-only units, then the serial group as a
    second pass, merged by the executor's `mergePasses`;
  - a run that fails to report is logged and the session goes on.
  - **`--workers=1` is hard-coded.** Gate D's variants differ by worker count, not code (Decision 13: both sides on
    the code after Decisions 2 to 6). So Gate D needs a workers setting per variant, and likely no worktrees.
- **`analyse.mts`:** a section per comparison, Decision 7 by `sameResults` (Gate B's method), medians of three.
- **Measured times, for projecting:**
  - Toolshop start: with-bugs 863 to 1,070 s, clean 381 to 391 s;
  - one worker, final code: with-bugs Standard about 727 s, accessibility about 150 to 180 s; clean Standard about
    407 s, accessibility about 100 to 130 s;
  - Gate C's whole session: 5 h 14 min, against 5 h 30 min projected.
- **Facts the runners depend on:**
  - "Comprehensive, every area" is two areas, security and accessibility (`COMPREHENSIVE_AREAS`);
  - the clean Toolshop seeds new product ids at each start, so its selection differs from the last session's by the
    product page's id only (`analyse.mts` normalises `01M…` ids);
  - on the Toolshop the start page is `/#/`, not `/` (Gate C's `analyse.mts` missed the sort check by that, and was
    fixed);
  - the-internet hasn't been set up anywhere yet, and `crawl-and-select.mts` hasn't been tried on it.
- **The executor's worker rule today, which TFP-157 replaces** (`src/lib/run/executor.ts`, TFP-155's stopgap):
  - a local host gets `workerCountFor`'s count: Standard 4 (fast) or 2 (deep), Comprehensive 1 everywhere (Phase 35
    Decision 2);
  - any other host gets 1;
  - the serial group always runs on 1.
  - The run already records "Split into N unit file(s) … run by W worker(s)", and `runTiming` carries `workers`,
    `files` and `serialGroup`, for Decision 11.
- **Watches:** a Monitor expires after 30 minutes. When re-arming one, read the log for lines written in the gap: Gate
  C missed one run's line that way (it was in the log).

### Noticed, and not reported until now

- **`git stash` was used twice tonight,** path-limited, to run a new test against the old code: TFP-214's navigation
  check and TFP-222's executor. That was before the no-stash rule was known. Emil's `stash@{0}` ("cosmetic CRLF
  noise") is untouched; nothing else is in the list.
- **The unit suite took 791 to 1,147 s on the same code tonight** (machine load). Project with the range, not the
  last run.
- **The API answers with a run's result before the run is saved.** A test that reads `runs/<id>` must wait for
  `run.json` (with no `.tmp`), as `waitForSavedRun` does. TFP-094's leak test didn't, and failed twice tonight
  (`4b872cf` fixed it). That's not a flake for the D23 list.
- **During the sessions, 6 `msedgewebview2` processes stayed up** (other apps' embedded web views); Gate B's record
  has them too.

### Corrected above

- **"Standard on one worker, same session":**
  - the clean figure's start is C1 (521 s), not Gate B's code: C wasn't run on the clean copy;
  - both end figures (727 s, 407 s) are F, which ran with the axe scan before the changing checks;
  - Standard on `d95fb61`'s default order hasn't been measured.
