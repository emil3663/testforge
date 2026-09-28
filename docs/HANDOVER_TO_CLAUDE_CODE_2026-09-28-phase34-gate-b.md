# Handover to Claude Code — Phase 34 Gate B verified, Gate C next (2026-09-28)

Supersedes `docs/HANDOVER_TO_CLAUDE_CODE_2026-09-24-phase21.md`.

Binding references (read before starting):
- `docs/decisions/phase-34-template-coverage-and-gap-filling-decision-record.md`:
  Decisions 10-11, Acceptance Criteria 5, the three new tickets and Gate C.
- `docs/decisions/phase-34-option-b-measurement-report.md`.

Everything below is decided by Emil (2026-09-28). Nothing is pending.

## Verification result

The 7 unpushed commits (`a77d006`, `a564543`, `17651f2`, `238f406`, `beb896f`,
`6618501`, `f799b7a`) were independently checked in Cowork:

- **Git:** `origin/main` at `13fdffb`, `main` ahead 7, in that order.
- **Checks:** `tsc --noEmit` clean. ESLint clean on every file the 7
  commits touch (a whole-repo run timed out in the verifying sandbox; that
  is the sandbox, not the repo).
- **Unit suite:** 314 pass there, plus the 2 real-browser tests the sandbox
  cannot run (no Linux Chromium), for your 316.
- **Template output:** identical before and after on 144 fixed inputs.
- **Code:** the GEN-43 follow-up matches amended Decision 6. No page data
  is still a gap; inspected-and-found-nothing is not; the local block
  carries one `test.skip` with its reason.
- **Report:** consistent with its own tables.
- **Not reproducible there:** the live Ollama runs, taken from your run.

## Decisions recorded (Emil, 2026-09-28)

- **Decision 9 outcome confirmed:** no UI control for gap-filling; it stays
  an env-var opt-in.
- **Decision 10 (TFP-121):** the accessibility template checks every
  visible form field has a browser-computed accessible name. A missing name
  fails; a placeholder-only name is recorded as a finding.
- **Decision 11 (TFP-122):** `/api/generate` inspects the pages itself when
  no content profile is supplied, with an opt-out flag. It never blocks
  generation if inspection fails.
- **Interactive tests on the-internet in TFP-120:** accepted. It is a
  practice site built for automated form submission.

## Do, in this order

1. **Push** the 7 verified commits.
2. **Commit the docs** as one `docs(decisions)` commit:
   - the Phase 34 record: Gate B met, Decision 9 confirmed, Decisions 10-11,
     Acceptance Criteria 5, three tickets, Gate C;
   - `product-roadmap.md`: the Phase 21 text notes the confirmation and
     TFP-121/122;
   - this handover.
3. **Housekeeping:** delete the untracked, superseded
   `docs/HANDOVER_TO_CLAUDE_CODE_2026-09-24-phase21.md` (Emil's standing
   decision of 2026-09-24: keep only the current handover). Leave the other
   untracked files alone.
4. **RPT-14 follow-up** (a defect, so first). Count only `passed + flaky +
   failed` as run, so an all-interrupted run reads "No recommendation: no
   test ran". Show a neutral badge when no test ran.
5. **TFP-121**, then **TFP-122**, one at a time, so each output measurement
   changes only one thing. Follow the tickets in the record.
6. Stop at **Gate C** for independent verification. Don't push the Gate C
   commits until they are checked.

Standing rules as always: each ticket's `TEST_PLAN.md` case lands in the
same commit as its code; measure output changes rather than diff-read them;
Conventional Commits with the why, the alternatives rejected, and what the
change does not do.

## Known, not acted on

- The real local-model call does not retry. It could in principle hit the
  same reused-socket reset the fake server did (`a564543`). The failure mode
  is safe: the template suite is returned and `ollama_unreachable` is
  recorded. No change unless it is seen live.
