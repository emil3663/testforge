# Handover to Claude Code — Phase 35 (2026-09-30, updated 2026-10-01)

Supersedes `docs/HANDOVER_TO_CLAUDE_CODE_2026-09-30-phase37.md` (Phase 37
is complete).

Binding reference: `docs/decisions/phase-35-comprehensive-testing-decision-record.md`.
Read it before starting. Every decision in it is made.

Gate and verification reference: `docs/QUALITY_GATES.md`.

## Done

1. The docs commit (20bd60d).
2. TFP-132, committed as 134b183, not pushed, waiting for Gate A.
3. TFP-137, committed after 134b183, not pushed. Its Acceptance Criterion 3
   on 134b183: 166 of 166 identical, exit 0 (Windows).

## Do next, in this order (updated 2026-10-01)

1. **TFP-137:** commit the check that proves the template's output is
   unchanged. It is one commit, holding:
   - the code and `TEST_PLAN.md` GEN-58;
   - `docs/QUALITY_GATES.md` (new, written in Cowork), with sections 3, 5
     and 6 updated as the ticket says;
   - a one-line pointer in `CLAUDE.md` to `docs/QUALITY_GATES.md`;
   - the updated Phase 35 record and this handover.
2. **Run TFP-137's Acceptance Criterion 3** on 134b183 and report the
   result as it is. A result other than 166 of 166 identical is a TFP-132
   defect, fixed in TFP-132.
3. **Stop at Gate A** for independent verification. **Push nothing until
   it is verified.** 134b183 and the TFP-137 commit go up together after
   that.
4. After Gate A is verified: **TFP-133, TFP-134, TFP-135** in any order,
   then **TFP-136**. Stop at Gate B.

Watch for:
- **ASVS 5.0 requirement IDs** must be copied from the published ASVS 5.0
  source (`github.com/OWASP/ASVS`, the 5.0 release), with the file and
  version recorded. Never write them from memory.
- **The passive level sends nothing but page loads and one missing-page
  probe.** The request-recording test proves it.
- **`@axe-core/playwright` is added unmodified** (MPL-2.0).

Standing rules as always:
- `TEST_PLAN.md` cases go in the same commit as the code;
- measure output changes, don't diff-read them;
- Conventional Commits, with the why in the body.
