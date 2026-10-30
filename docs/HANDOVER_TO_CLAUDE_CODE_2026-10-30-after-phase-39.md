# Handover to Claude Code — after Phase 39 (2026-10-30)

**Use this only once Phase 39 is verified complete** (Gate D closed, step 3f
of the Phase 39 handover verified). In the commit that adds the first work
from this file, delete both `HANDOVER_TO_CLAUDE_CODE_2026-10-21-phase-39-gate-d.md`
and `HANDOVER_TO_CLAUDE_CODE_2026-10-26-workflow-and-names.md` (`git rm`):
this replaces them. Their history is in git and the records.

## Read first

- `CLAUDE.md` and `docs/WORKING_AGREEMENTS.md`: the loop, the decision
  vocabulary, what needs confirmation.
- `docs/decisions/workflow-and-ci-backlog-2026-10-26.md`: TFP-250 to 262's
  tickets and decisions.
- `docs/decisions/phase-47-ci-integration-decision-record.md`: Phase 47.
- `docs/decisions/deferred-work-register.md`: the build order, D36 to D40,
  and **D39, the rename** ("Mr Onion" proposed; see its checklist).

## Standing rules for this stretch

- One ticket at a time; each stops for verification unless its entry says
  otherwise. Commit and push each verified ticket before the next.
- No timing or measurement sessions are planned. If one becomes necessary,
  ask first, and follow `CLAUDE.md`'s measurement rules.
- Template output changes only where a ticket says so, with
  `check:template-unchanged` showing exactly what changed.
- Planning sessions may have uncommitted docs in the tree; leave files you
  didn't change alone and say so.

## Work, in order (owner decision, 2026-10-30)

1. **The helper lines and the template baseline** (TFP-250 follow-up,
   backlog's TFP-250 entry): reword `src/lib/generate/mock/controls.ts`
   lines 245 and 282 to their decision references; re-record
   `TEMPLATE_BASELINE` in `nightly.yml` in its own commit, with the template
   check showing only those lines changed.
2. **The version stamp and `v0.2.0`** (TFP-257, steps 3 and 5): the version
   and commit in `/api/health`, each `run.json` and the report footer;
   `package.json` to `0.2.0`; move `CHANGELOG.md`'s Phase 39 entry from
   Unreleased to `0.2.0` with the date. Then tag **`v0.2.0`** and make its
   GitHub release from the changelog: **ask the owner before pushing the
   tag.** It's tagged under the current name (D39).
3. **TFP-260, the local Docker stacks on loopback.** Plane stays (owner
   decision, 2026-10-28): Plane's 80 and MinIO's 9000/9090 on `127.0.0.1` in
   `docker-compose.yml`; the Toolshop's 4200, 8091, 8000 and 3306 through a
   TestForge override file (check Compose's `!override` for port lists);
   `.env.example` and `SECURITY.md` updated (SECURITY.md's known gap
   removed).
4. **TFP-259, the dead-code pass** and a nightly `knip` check, as the
   ticket lists.
5. **The review's leftovers,** one at a time: TFP-209, TFP-217 (the
   nightly summary email; Part B can be built — the owner finished the Gmail
   and GitHub setup on 2026-10-30; prove it with one manual dispatch that
   sends the email, and check the password appears nowhere in the log), TFP-242, TFP-243, TFP-258 (`docs/decisions/post-phase-42-review-plan.md`).
6. **TFP-252, the nightly-failure issue** (with TFP-217).
7. **TFP-253, splitting `TEST_PLAN.md` by area**, as revised in the backlog.
   Nothing else may be editing it at the time.
8. **Phase 47**, from its record: TFP-263 (the pipeline move), TFP-245 (the
   CLI), TFP-246 (baselines). **Stop before TFP-247:** the rename phase
   (D39) comes first, once the owner's trademark check is done.

## Not for this handover

- The rename (D39): its own decision record, written in a planning session.
- Phase 43 onwards: after Phase 47's Gate A, per the register.
