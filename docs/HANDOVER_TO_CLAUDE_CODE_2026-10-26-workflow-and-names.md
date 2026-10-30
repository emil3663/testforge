# Handover to Claude Code — workflow, names and CI backlog (2026-10-26)

This is a **second workstream**. It does **not** replace
`HANDOVER_TO_CLAUDE_CODE_2026-10-21-phase-39-gate-d.md`, which stays
current for Phase 39. Pick this up only **after TFP-157's leak fix is
verified** (Gate D ruling, step 1), and don't mix its commits into
TFP-157's. When everything below is done, delete this file in the last
commit (`git rm`); its history is in git and in the backlog.

## Read first

- `docs/WORKING_AGREEMENTS.md` — rewritten today. The decision vocabulary
  (*owner decision*, *confirmation required*, *independent review*, *the
  tester*) and the loop.
- `docs/decisions/workflow-and-ci-backlog-2026-10-26.md` — the tickets
  below, with their acceptance criteria.
- `CLAUDE.md` — two new sections: corrections become rules; review your
  diff before reporting.

## State on 2026-10-26

- `origin/main` at `8e93998`; local `main` one ahead with TFP-157's leak fix
  (`66cd0c0`), not yet verified or pushed.
- A planning session wrote these files and **did not commit them**:
  - `docs/WORKING_AGREEMENTS.md` (rewritten; the old one was test-assist's);
  - `docs/APPLICATION_OVERVIEW.md` (refreshed to Phase 39);
  - `docs/decisions/workflow-and-ci-backlog-2026-10-26.md` (new, TFP-244
    to TFP-257);
  - `CLAUDE.md` (two sections added; "ask Emil first" → confirmation
    required);
  - this handover.

## Do, in order

0000. **(Added 2026-10-27, 15:30) Planning pass 3, docs only, one `docs`
      commit, any time before or after tonight's run:** TFP-250's
      verification note and the two owner decisions (helper lines;
      versioning rule) in the backlog, and the new `CHANGELOG.md`.
      **After Gate D's re-measurement is analysed** (it changes generated
      output, so not before):
      - TFP-250's follow-up: reword `src/lib/generate/mock/controls.ts`
        lines 245 and 282 to their decision references, re-record
        `TEMPLATE_BASELINE` in `nightly.yml` in its own commit, with
        `check:template-unchanged` showing only those lines changed;
      - TFP-257: version and commit in `/api/health`, `run.json` and the
        report footer; then, once Phase 39 is complete, set `package.json`
        to `0.2.0`, tag **`v0.2.0`** (the first tag; `0.1.0` stays untagged,
        owner decision 2026-10-28) and make its GitHub release from the
        changelog — **confirmation required before the tag is pushed**.

000. **(Added 2026-10-27, 13:30) Commit Phase 47's lock as one `docs`
     commit:** `docs/decisions/phase-47-ci-integration-decision-record.md`
     (new, locked), the dated amendment in the Phase 16 record, D31–D35 and
     the build-order entry in the deferred-work register, the roadmap's
     Phase 47 section, the decisions index row, the backlog's Part 1 note
     and the overview's "Where it's going" line. Don't start TFP-263 until
     Phase 39 is complete: it changes code every run uses.

00. **(Added 2026-10-27, 05:30) TFP-261 — P0, before anything else here,
    and between Phase 39 tickets if one is mid-way.** The server listens on
    every interface and `/api/run` accepts a cross-site `text/plain` POST
    and runs it (measured; details in the backlog). Fix, test, and push it
    first. Then commit the new `SECURITY.md` and `CONTRIBUTING.md` (repo
    root) — SECURITY.md describes the fixed server, so never before the
    fix. Don't push the backlog's TFP-261 text ahead of the fix either:
    commit it with the fix.
0. **(Added 2026-10-27.)** A second planning pass left docs uncommitted:
   `docs/README.md`, `docs/decisions/README.md` (new index),
   `docs/consolidation/README.md` and a historical banner on each
   `docs/consolidation/*.md`, the roadmap header and Phase 39 heading, and
   backlog updates (TFP-253 revised, TFP-257 expanded, TFP-259 and TFP-260
   added, TFP-250's status). Commit them as one `docs` commit, apart from
   any benchmark or code commit.

1. **Commit the planning files** above as one `docs` commit, separate from
   any code. Check the TFP numbers first: if anything above TFP-243 was
   allocated since `8e93998`, renumber the backlog before committing.
2. **TFP-250 — names to the vocabulary.** Comments, test descriptions,
   README, QUALITY_GATES, TEST_PLAN provenance, skill headings. Comments
   and docs only: `check:template-unchanged` must stay byte-identical and
   the unit suite unchanged. One commit for `src/` + root docs, one for
   `skills/` (re-prove the plugin loads, as TFP-236 does).
3. **TFP-253 — trim `TEST_PLAN.md`,** once no other ticket has it open.
4. **TFP-252 — nightly-failure issue,** together with or after TFP-217.
5. **TFP-251 — stop check.** Measure first. Changing
   `.claude/settings.json`: **confirmation required** before you commit it.

Don't start TFP-244 to TFP-249: TFP-244 is a decision record, written in a
planning session, and the rest wait for it. TFP-254 to TFP-257 are docs a
planning session will write unless the owner hands them to you.

## Stop and ask

- Anything that would change template output.
- Any name occurrence where it's unclear whether it's a rule, provenance or
  credit — list them and ask, don't guess.
