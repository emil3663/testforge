# Handover to Claude Code — Phase 36 (2026-09-29)

Supersedes `docs/HANDOVER_TO_CLAUDE_CODE_2026-09-28-phase34-gate-b.md`
(Phase 34 is complete).

Binding reference: `docs/decisions/phase-36-trust-and-local-model-measurement-decision-record.md`.
Read it before starting.

## Do, in this order

1. **Commit the docs** as one `docs(decisions)` commit:
   - the new Phase 36 record;
   - `product-roadmap.md` (Phase 36 added);
   - the Phase 34 record's status line (Phase 34 complete);
   - the status lines of ten phase documents, reconciled with git (Phases
     16 ×2, 17, 18, 19, 20, 24, 25, 26, 27);
   - this handover.
   Delete the superseded 2026-09-28 handover in the same commit, then push.
2. **TFP-126:** build the benchmark and run it on C1 only. Stop and report the
   C1 numbers, including the measured prompt sizes that set `num_ctx` N,
   before running anything else.
3. **TFP-127:** pull the two approved models (`qwen2.5-coder:7b-instruct-q3_K_M`,
   `qwen3.5:4b`, approved by Emil 2026-09-29). Pull nothing else. Run C2-C6,
   then C7, and apply the Decision 7 rule exactly as written. Close other
   GPU programs first.
4. **TFP-123** and **TFP-125**, while the benchmark isn't running.
5. **TFP-124** after TFP-123 and TFP-125.

Stop at Gate A for independent verification; don't push Phase 36's code
commits until they are checked. Standing rules as always: `TEST_PLAN.md`
cases in the same commit as the code; measure output changes, don't
diff-read them; Conventional Commits with the why.
