# Handover to Claude Code — Phase 35 (2026-09-30, updated 2026-10-01 after Gate A)

Supersedes `docs/HANDOVER_TO_CLAUDE_CODE_2026-09-30-phase37.md` (Phase 37
is complete).

Binding reference: `docs/decisions/phase-35-comprehensive-testing-decision-record.md`.
Read it before starting. Every decision in it is made.

Gate and verification reference: `docs/QUALITY_GATES.md`.

## Done

1. The docs commit (20bd60d).
2. TFP-132 (134b183) and TFP-137 (53d3391).
3. **Gate A verified 2026-10-01 in Cowork.** The results are in the TFP-132
   and TFP-137 status entries of the Phase 35 record.

## Do next, in this order

1. **Commit the Gate A docs** as one `docs(decisions)` commit:
   - the Phase 35 record: verified status entries, TFP-138 added, criteria
     added to TFP-133 and TFP-134;
   - `product-roadmap.md` (Gate A verified);
   - this handover.

   Then **push** 134b183, 53d3391 and this commit.
2. **TFP-138:** the Standard HTML export's tabs. It is one commit; measure
   it as its Acceptance Criterion 2 says.
3. **TFP-133, TFP-134, TFP-135** in any order, including the criteria added
   at Gate A. Then **TFP-136**. Stop at Gate B.

Watch for:
- **ASVS 5.0 requirement IDs** must be copied from the published ASVS 5.0
  source (`github.com/OWASP/ASVS`, the 5.0 release), with the file and
  version recorded. Never write them from memory. `src/lib/comprehensive/asvs.ts`
  was checked against it at Gate A.
- **The passive level sends nothing but page loads and one missing-page
  probe.** The request-recording test proves it.
- **`@axe-core/playwright` is added unmodified** (MPL-2.0).
- **Stop only the processes you started, by their process ID.** Never stop
  processes by a name pattern: on this machine a pattern can match Ollama,
  the dev server or the editor.

Standing rules as always:
- `TEST_PLAN.md` cases go in the same commit as the code;
- measure output changes, don't diff-read them; for the template, use
  `npm run check:template-unchanged`;
- Conventional Commits, with the why in the body.
