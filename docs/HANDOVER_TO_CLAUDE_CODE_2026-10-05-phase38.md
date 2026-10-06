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
6. TFP-151 waits until after Phase 38.

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
