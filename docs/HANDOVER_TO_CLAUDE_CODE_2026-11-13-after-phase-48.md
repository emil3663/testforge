# Handover to Claude Code — after Phase 48 (2026-11-13)

Use this now. In the commit that adds the first work from this file:
- delete `HANDOVER_TO_CLAUDE_CODE_2026-10-30-after-phase-39.md` (`git rm`).
  This file replaces it; its history is in git and the records;
- remove that file's entry from `scripts/old-name/allowlist.json`. Once the
  file is gone the entry allows nothing, and `check:old-name` fails on an
  entry that allows nothing.

## Read first

- `CLAUDE.md` and `docs/WORKING_AGREEMENTS.md`: the loop, the decision
  vocabulary, and what needs confirmation.
- `docs/decisions/phase-47-ci-integration-decision-record.md`: Phase 47,
  done up to TFP-247. Read Decisions 8 to 11 and Acceptance Criteria 4
  and 5.
- `docs/decisions/workflow-and-ci-backlog-2026-10-26.md`: TFP-248 (Part 1),
  and TFP-282 to TFP-284 (after TFP-272).
- `docs/decisions/phase-48-rename-to-mr-onion-decision-record.md`, only if
  a ticket touches a name: what was renamed, what stays, and the
  compatibility rules that hold until 1.0 (Decisions 3 to 8).

## Standing rules for this stretch

- One ticket at a time. Each stops for verification unless its entry says
  otherwise. Commit and push each verified ticket before the next.
- No timing or measurement sessions are planned. If one becomes necessary,
  ask first, and follow `CLAUDE.md`'s measurement rules.
- Template output changes only where a ticket says so, with
  `check:template-unchanged` showing exactly what changed.
- Every test and live check uses a temporary `LOCALAPPDATA` (and
  `XDG_DATA_HOME` in WSL), never the real data folder.
- Run `npm run check:old-name` before every push, not only in CI. A
  lockfile update can bring an old name back in (TFP-285).
- CI stays pinned to `ubuntu-24.04` until TFP-284.
- Planning sessions may have uncommitted docs in the tree. Leave files you
  didn't change alone, and say so.

## Work, in order (owner decisions, 2026-11-13)

1. **TFP-248: the GitHub Action, an example workflow and the CI guide.**
   This is Phase 47's Gate A. The backlog entry was written before the
   rename, so read its names as Phase 48 decided (Decision 13's amendment
   to Phase 47):
   - the action is used as `emil3663/mr-onion/action@v<version>`, the
     command is `mr-onion run`, and the image is
     `ghcr.io/emil3663/mr-onion:<version>`;
   - no image is published yet: the first is `v0.4.0`'s (item 2). So the
     action takes the image as an input, defaulting to the published one
     for its version, and the repo's own CI builds the image in the job and
     passes it in. Gate A runs against that local build, never a pulled
     image;
   - **the two notes from TFP-247's verification are part of this
     ticket:**
     - the image runs as root, so files it writes into the mounted
       workspace (`--out`, `--data-dir`) are owned by root on a Linux
       runner. The action leaves the workspace's files owned by the job's
       user (for example `--user` with a writable folder for the run, or
       handing the files back afterwards). The guide says what a team
       running the image without the action must do;
     - `scripts/image/verify-image.mjs` asserts that the fixture run fails
       at least one test and exits `1`, so the failing path is exercised
       on every release. Show it red with a fixture that passes
       everything;
   - Acceptance: the entry's Gate A criteria (clean passes, with-bugs
     fails, both reports attached, a broken URL is exit `2`), plus the two
     notes above.
   - **Stop for independent verification.** It's Phase 47's Gate A, so the
     owner rules on it.

2. **Phase 47 completes, and `v0.4.0` is released** (owner decision,
   2026-11-13: Phase 47 completes at TFP-248; TFP-249 stays deferred as
   D31, after Phase 43).
   - One docs commit:
     - the record's status line, the roadmap, the decisions index and the
       register's Phase 47 lines say Complete;
     - the changelog's Unreleased entries move to `0.4.0` with the date;
     - `package.json` goes to `0.4.0`;
     - close Phase 47's tracking issue (#24).
   - **Ask the owner before pushing the `v0.4.0` tag.** The tag runs
     `release-image.yml`, which verifies the image and then publishes
     `ghcr.io/emil3663/mr-onion:0.4.0`: that is the first public image.
     Then make the GitHub release from the changelog, as for `v0.3.0`.
   - After the publish, report the package's visibility. A new package on
     a personal account may start private. Making it public is the owner's
     step in the package settings, and the planning session walks him
     through it.

3. **TFP-282: the link-health route test passes without checking its
   route.** As its backlog entry says. It changes the test, not the
   template.

4. **TFP-283: the self-test's server times out on a cold build.** As its
   backlog entry says.

5. **TFP-284: Playwright on the current GitHub runner image.** As its
   backlog entry says. The browser version moves with Playwright, so any
   difference in the template output is shown and named, and the owner
   accepts it before the ticket is done. The Docker image's pins
   (`Dockerfile`, `scripts/image/check-pins.mjs`) and its Ubuntu base
   move with CI's runner. A rebuilt image is verified, but it's published
   only with the next version tag.

6. **Stop before Phase 43.** Its record (locked 2026-10-19) predates
   Phases 47 and 48. A planning session checks it against the renamed code
   and the CI work before it is built, and writes the next handover.

## Not for this handover

- Phase 43 onwards: the register's build order, after item 6 above.
- TFP-249 (D31): interactive and active gates in CI, after Phase 43.
- D25, a summary email after a site run: its record is still to write.
- Dependabot alert #146: it closes on Dependabot's next scan of `main`
  (TFP-285 is done). If it's still open when item 1 starts, report it.
