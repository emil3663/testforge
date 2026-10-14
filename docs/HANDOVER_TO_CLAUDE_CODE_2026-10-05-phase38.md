# Handover to Claude Code — Phase 38 (2026-10-05)

Supersedes `docs/HANDOVER_TO_CLAUDE_CODE_2026-09-30-phase35.md`. Phase 35
Gate B was verified on 2026-10-01 (899bdd9).

Binding references:
- `docs/decisions/phase-38-standard-run-gates-and-conformance-decision-record.md`
  (locked 2026-10-05; every decision in it is made);
- `docs/decisions/real-site-run-findings-backlog-2026-10-01.md` for TFP-145,
  TFP-151 and TFP-152;
- `docs/QUALITY_GATES.md` for gates and verification.

## Before anything else: RTK

Use RTK for shell commands, as `CLAUDE.md` says. Emil installed RTK 0.49.0
and ran `rtk init -g` on 2026-10-05; `rtk init --show` reports the hook,
`RTK.md` and `settings.json` as configured. The hook loads when a session
starts, so a session opened before then doesn't use it.

- Check it with `rtk gain` at the start of the session.
- If it isn't working, tell Emil. Don't reinstall it or change the
  user-level settings yourself.

## State on 2026-10-07 (read this first)

`origin/main` is at `bd81c58`; batch 2's nine commits (`c516a1e` to
`c15dd2c`) are committed, not pushed. Phase 38 is complete. Since then:
- **Done and verified:**
  - TFP-151, TFP-159 to TFP-161 (template false failures);
  - TFP-165 (`#/` routes as pages) and TFP-166 (the orphan check on routes);
  - TFP-153 (the Toolshop answer key);
  - TFP-167 (`e812795`, `7577252`): every generated page visit waits for
    network idle, bounded at 5 s;
  - TFP-154: the first score (6 found, 3 hinted, 28 missed of 37) and the
    re-score after TFP-167 (`878a49d`: 9 found, 4 hinted, 24 missed), both
    verified. The known-bug gate is met.
- **Phase 40 is complete** (Gate B passed 2026-10-07, Emil): the automatic
  page selection is kept (9 found, 4 hinted, 24 missed, tying the
  hand-picked list).
- **The batch is done and verified** (2026-10-07): TFP-177, TFP-162 to
  TFP-164, TFP-168 and TFP-178. TFP-169 stays open with diagnostics
  (`3b44370`).
- **Phase 41 Gate A passed 2026-10-08:** TFP-189, TFP-179 and TFP-180
  verified. The local Toolshop runs from `scripts/toolshop-local/` (Docker
  Desktop must be started first; one version at a time).
- **Phase 41 batch 1 verified 2026-10-12** (TFP-181 to TFP-185, `7069078`
  to `7b632cf`): all 10 present targets found on local with-bugs; clean
  has no unlabelled failure.
- **Phase 41 batch 2 verified 2026-10-13** (`6897b1e` to `094e574`): all
  15 present layout and spelling targets found on local with-bugs.
- **Phase 41 is complete** (Gate B passed 2026-10-13, Emil): local 33 found,
  0 hinted, 4 missed; the image-render check kept.
- **TFP-198 and TFP-199 verified 2026-10-13** (`15e0205`, `3a8f420`,
  `3955847`). GitHub issue #2 is fixed; Emil closes it.
- **Phase 42 Gate A passed 2026-10-14** (batch 1, `4841a7a` to `612b144`),
  with four rulings in the Phase 42 record.
- **Phase 42 batch 2 verified 2026-10-14** (`c516a1e` to `c15dd2c`), with
  five rulings in the Phase 42 record.
- **Now: one batch before TFP-197:** TFP-202 (P0: harden the gap writer and
  the tests it writes), TFP-203 (on Standard, a matching candidate becomes
  the gap's test) and TFP-204 (generation applies promoted entries). Each
  with its own commit and targeted tests; the full unit suite, regression
  suite and `check:template-unchanged` once at the end. No real Claude Code
  call yet. Stop for verification; don't start TFP-197.
- **Phase 42** (`phase-42-reusable-suites-and-gap-tests-decision-record.md`,
  locked 2026-10-12, TFP-190 to TFP-197). Not to be started before Phase
  41's Gate B.
- **After Phase 42 (Emil, 2026-10-13):** a full review, then the skills
  relooked (`product-roadmap.md`, "After Phase 42"). Planned in
  Cowork with Emil; nothing for Code to start.
- **Not started, not next:**
  - Phase 39 (`phase-39-run-concurrency-decision-record.md`, locked; after
    the current batch). Docker works on Emil's machine (checked 2026-10-07:
    Docker Desktop 29.4.0, Compose v5.1.2, WSL 2 backend, `hello-world`
    ran), so TFP-158's local Toolshop copy isn't blocked. Docker Desktop
    must be started before use; it isn't running by default.
- **Git:** don't use `git stash` in this repo; Emil keeps an older stash
  entry. Read old versions with `git show <commit>^:<path>`. Don't use
  `git worktree` here either: a worktree linked to this repo's
  `node_modules` deleted it when removed (2026-10-07, restored with
  `npm ci`). To build an older commit, clone it to a separate folder with
  its own `npm ci`.

## Phase 38 is complete (2026-10-06)

Gate A passed 2026-10-05; Gate B passed 2026-10-06 (Emil). See the Phase 38
record. Everything below is the history of how it got there.

**Do next:** commit the uncommitted docs as one `docs(decisions)` commit,
push, and stop. Emil picks the next piece of work. These are ready, and none
is to be started without his word:
- the SEO Standard set;
- the known-bug benchmark (`known-bug-benchmark-backlog-2026-10-06.md`,
  draft);
- Phase 39 (`phase-39-run-concurrency-decision-record.md`, locked);
- the template fixes TFP-151 and TFP-159 to TFP-161 (in
  `real-site-run-findings-backlog-2026-10-01.md`).

## Done

- TFP-145: `0504f92` and its follow-up `4d35b28`, not pushed. Both were
  verified in Cowork on 2026-10-05; see the TFP-145 entries in
  `real-site-run-findings-backlog-2026-10-01.md`.

## Do next, in this order

1. ~~The TFP-145 follow-up commit~~: done, `4d35b28`.
2. **Commit the docs** as one `docs(decisions)` commit:
   - the Phase 38 decision record (new, locked);
   - `product-roadmap.md` (Phase 38 entry);
   - `real-site-run-findings-backlog-2026-10-01.md` (TFP-145 verified,
     with its follow-up; TFP-151 and TFP-152 added);
   - `CLAUDE.md` (the RTK section);
   - this handover, and the deletion of the Phase 35 handover;
   - `benchmarks/2026-10-01-rizonetech/`, the raw evidence the TFP-141 to
     TFP-145 backlog cites (`QUALITY_GATES.md` section 1: raw evidence is
     committed).

   Then push `afe38a1`, `0504f92`, `4d35b28` and this commit.
3. **TFP-146:** `245ea6f` and `b9ca79b`. Gate A passed on 2026-10-05.
   Before pushing, correct RUN-25's numbers as the `b9ca79b` verification
   entry in the Phase 38 record says, in one `docs` commit with these doc
   updates. Then push.
4. **TFP-152:** `34622b0`. Make the whitespace-`alt` fix in its
   verification entry in the backlog, as a follow-up commit with these doc
   updates, then push.
5. **TFP-147, TFP-148, TFP-149:** `fc736cc`, `12ace9c`, `c4f00df`, with
   follow-ups `73aa393` and `da2235f`. All verified on 2026-10-06.
   Commit these doc updates as one `docs` commit, then push. Then run
   **TFP-150** on the final code, at the read-only gate with one worker.
   Real sites: the-internet.herokuapp.com and practicesoftwaretesting.com
   only. **Do not run against rizonetech.com** (Decision 8, amended
   2026-10-06: it is a friend's revenue-earning site). The before runs use
   `d90de57`, back to back with the after runs on each site.
   Stop at Gate B.
   **TFP-150 status (2026-10-06):** `ac9cf44`. Re-run the-internet's
   before/after pair on a healthy host, as its verification entry says,
   then stop for Gate B.
6. TFP-151 waits until after Phase 38.

## TestForge's test account (2026-10-06)

Emil created `testforgeapp@gmail.com` as TestForge's own test identity. Use
`testforgeapp+<site>@gmail.com` to give each site its own address, which
lands in the same inbox. Some sites reject `+`; fall back to the plain
address.
- **Credentials live only in `.env.local`,** which `.env*` in `.gitignore`
  ignores, and in Emil's password manager. Never in `.env.development` or
  `.env.example`: both are tracked by git. Never in a commit, a doc, a test
  fixture, a report or a log. TestForge's report redaction must cover them.
- **Where it may be used:**
  - Emil's own sites and local copies: freely, including registering.
  - Practice sites: use their published demo accounts instead. Don't
    register unless the site invites it.
  - Any other site: registering creates data on someone else's system, so
    it waits for the owner's sign-off on Comprehensive testing (Phase 35
    Decision 8).
- **Variables, set in Emil's `.env.local` on 2026-10-06:**
  `TESTFORGE_ACCOUNT_EMAIL` and `TESTFORGE_ACCOUNT_PASSWORD`.
  - The password is for accounts TestForge creates on test sites. It is
    not the Gmail password, which TestForge never gets.
  - A run's login block references them by name (`"usernameEnv":
    "TESTFORGE_ACCOUNT_EMAIL", "passwordEnv": "TESTFORGE_ACCOUNT_PASSWORD"`),
    as `.env.example` and `docs/AUTOMATED_ACCOUNT_SETUP.md` describe.
  - Never print, log or echo their values.
- Nothing uses the account yet. Wiring it in is a ticket of its own.

## Watch for

- **Decision 6:** until the ownership confirmation exists, the
  script-payload test is Not run, with the reason "attack-shaped input:
  needs the ownership confirmation, not built yet".
- **Every new test names the ISTQB technique it uses** (Decision 2), for
  example boundary value analysis or error guessing.
- **A decision that comes up while writing tests goes to Emil.** Don't make
  it in the ticket. Tests aren't reviewed line by line, but the choices
  behind them are.
- **ASVS 5.0 requirement IDs** are copied from the published source with
  the file and version recorded. Never write them from memory.
- **Core Web Vitals bands** come from web.dev, as Decision 5 records. Don't
  change a threshold without a decision.
- **Stop only the processes you started, by their process ID.** Never by a
  name pattern.

Standing rules as always:
- `TEST_PLAN.md` cases go in the same commit as the code;
- measure output changes with `npm run check:template-unchanged`, don't
  diff-read them;
- report test counts and measurements from unfiltered output (see the RTK
  section of `CLAUDE.md`);
- Conventional Commits, with the why, the alternatives rejected, and what
  the change doesn't do.
