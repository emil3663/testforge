# Handover to Claude Code — Phase 37 (2026-09-30)

Supersedes `docs/HANDOVER_TO_CLAUDE_CODE_2026-09-29-phase36.md` (Phase 36
is complete).

Binding reference: `docs/decisions/phase-37-gap-fill-prompt-and-model-gates-decision-record.md`.
Read it before starting.

## Do, in this order

1. **Push `d59c2cf`** (the diagnostic, verified in Cowork).
2. **Commit the docs** as one `docs(decisions)` commit: the new Phase 37
   record, `product-roadmap.md` (Phase 37 added) and this handover. Delete
   the superseded 2026-09-29 handover in the same commit. Push.
3. **TFP-128, TFP-129, TFP-130**, one commit each.
4. **TFP-131** last: measure, read by hand, and apply the Decision 4 rule
   exactly as written. If the fix falls short, record that and tune nothing.

Stop at Gate A for independent verification; don't push the Phase 37 code
commits until they are checked. Standing rules as always: `TEST_PLAN.md`
cases in the same commit as the code; measure output changes, don't
diff-read them; Conventional Commits with the why.
