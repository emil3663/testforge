# Handover to Claude Code — Phase 35 (2026-09-30, updated 2026-10-01 at Gate B)

Supersedes `docs/HANDOVER_TO_CLAUDE_CODE_2026-09-30-phase37.md` (Phase 37
is complete).

Binding reference: `docs/decisions/phase-35-comprehensive-testing-decision-record.md`.
Read it before starting. Every decision in it is made.

Gate and verification reference: `docs/QUALITY_GATES.md`.

## Done

1. Gate A: TFP-132 (134b183) and TFP-137 (53d3391), verified and pushed.
2. TFP-138 (163b4c7), verified and pushed.
3. TFP-133 to 136 and `198dbec` (a7fae28..7f7829b), not pushed.
   **Verified at Gate B in Cowork, 2026-10-01, except for one finding**
   (see TFP-134's status entry). Emil accepted Decision 5's amendment and
   `198dbec`.

## Do next, in this order

1. **Fix TFP-134's Gate B finding** in one new commit, before any push.
   Don't amend the earlier commits.
   - The Comprehensive copy of TFP-121's field-name check is Not run on a
     page answering 400 or more, as the axe scan already is. The Standard
     template stays 166 of 166 identical.
   - Drop `wcag22a` from `WCAG_TAGS`.
   - Correct the measurement report's accessibility counts on the-internet
     (14 passed, 20 failed, 6 not run), from a re-run or from the committed
     evidence, saying which.
   - Commit it together with this handover and the updated Phase 35 record
     (Decision 5 amended; Gate B verification; TFP-139 and TFP-140 added).
2. **Stop and report** with the commit, the template check and the
   corrected counts. When that is verified, push everything.
3. Then **TFP-139** and **TFP-140**, in any order.

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
