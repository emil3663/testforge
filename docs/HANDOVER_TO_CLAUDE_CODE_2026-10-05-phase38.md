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

`origin/main` is at `7e84497`; `878a49d` (the re-score) is committed, not
pushed. Phase 38 is complete. Since then:
- **Done and verified:**
  - TFP-151, TFP-159 to TFP-161 (template false failures);
  - TFP-165 (`#/` routes as pages) and TFP-166 (the orphan check on routes);
  - TFP-153 (the Toolshop answer key);
  - TFP-167 (`e812795`, `7577252`): every generated page visit waits for
    network idle, bounded at 5 s;
  - TFP-154: the first score (6 found, 3 hinted, 28 missed of 37) and the
    re-score after TFP-167 (`878a49d`: 9 found, 4 hinted, 24 missed), both
    verified. The known-bug gate is met.
- **Next: Phase 40, locked 2026-10-07**
  (`docs/decisions/phase-40-page-type-selection-decision-record.md`,
  TFP-170 to TFP-175). Emil confirmed every value: a Standard cap of 8,
  exact structural signatures (no threshold), ordered ranking rules (no
  weights), the keep rule in Decision 9, and Phase 40 before Phase 39.
  Start with TFP-170, then TFP-171, and stop at Gate A. Each ticket stops
  for verification before the next.
- **Not started, not next:**
  - TFP-168 (model and OpenAI visits through `tfGoto`) and TFP-169 (TFP-147's
    security case resets at fixture start-up), in
    `known-bug-benchmark-backlog-2026-10-06.md`;
  - TFP-162 to TFP-164 (`real-site-run-findings-backlog-2026-10-01.md`);
  - Phase 39 (`phase-39-run-concurrency-decision-record.md`, locked; after
    Phase 40; needs Docker on Emil's machine for TFP-158).
- **Git:** don't use `git stash` in this repo; Emil keeps an older stash
  entry. Read old versions with `git show <commit>^:<path>`.

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
