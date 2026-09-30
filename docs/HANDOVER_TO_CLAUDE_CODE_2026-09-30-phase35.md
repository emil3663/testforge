# Handover to Claude Code — Phase 35 (2026-09-30)

Supersedes `docs/HANDOVER_TO_CLAUDE_CODE_2026-09-30-phase37.md` (Phase 37
is complete).

Binding reference: `docs/decisions/phase-35-comprehensive-testing-decision-record.md`.
Read it before starting. Every decision in it is made.

## Do, in this order

1. **Commit the docs** as one `docs(decisions)` commit:
   - the new Phase 35 record;
   - `product-roadmap.md` (Phase 35 marked locked);
   - the Phase 37 record's status line (complete);
   - this handover.
   Delete the superseded Phase 37 handover in the same commit, then push.
2. **TFP-132** (Comprehensive run mode). Stop at Gate A for independent
   verification before pushing, with the Standard run's output shown
   unchanged by measurement.
3. After Gate A is verified: **TFP-133, TFP-134, TFP-135** in any order,
   then **TFP-136**. Stop at Gate B.

Watch for:
- **ASVS 5.0 requirement IDs** must be copied from the published ASVS 5.0
  source (`github.com/OWASP/ASVS`, the 5.0 release), with the file and
  version recorded. Never write them from memory.
- **The passive level sends nothing but page loads and one missing-page
  probe.** The request-recording test proves it.
- **`@axe-core/playwright` is added unmodified** (MPL-2.0).

Standing rules as always: `TEST_PLAN.md` cases in the same commit as the
code; measure output changes, don't diff-read them; Conventional Commits with
the why.
