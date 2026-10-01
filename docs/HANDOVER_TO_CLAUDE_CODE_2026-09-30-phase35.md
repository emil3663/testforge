# Handover to Claude Code — Phase 35 (2026-09-30, updated 2026-10-01, Gate B passed)

Supersedes `docs/HANDOVER_TO_CLAUDE_CODE_2026-09-30-phase37.md` (Phase 37
is complete).

Binding reference: `docs/decisions/phase-35-comprehensive-testing-decision-record.md`.
Read it before starting. Every decision in it is made.

Gate and verification reference: `docs/QUALITY_GATES.md`.

## Done

1. Gate A: TFP-132 (134b183) and TFP-137 (53d3391), verified and pushed.
2. TFP-138 (163b4c7), verified and pushed.
3. **Gate B verified and passed 2026-10-01 in Cowork:**
   - TFP-133 to 136 and `198dbec` (a7fae28..7f7829b);
   - the Gate B finding's fix (`ab60f46`).

   Emil accepted Decision 5's amendment and `198dbec`. Phase 35's first
   slice is complete.

## Do next, in this order

1. **Commit the Gate B verification docs** as one `docs(decisions)` commit:
   - the Phase 35 record (Gate B passed, TFP-134's status entry);
   - `product-roadmap.md` (Gate B verified);
   - this handover.

   Then **push** all seven commits.
2. **TFP-139** and **TFP-140**, in any order, one commit each. Stop and
   report for verification before pushing.

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
