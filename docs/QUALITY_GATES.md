# Quality Gates and Evidence Rules

Status: living document, started 2026-10-01.

This page brings together, in one place:
- what counts as evidence in this repo;
- which gates stand between generated output and a verdict;
- how a piece of work is checked before it is called done.

It links to the records that hold the reasoning and does not restate it.
When a rule changes, change it at its source and update the link here in
the same commit (standing execution policy, rule 2).

## 1. What counts as evidence

- **A measurement, not an assertion.** A claim carries a number someone else
  can re-measure. See `docs/WORKING_AGREEMENTS.md`, "On measured evidence":
  "the repo should meet the bar it sells".
- **Raw evidence is committed.** `benchmarks/<date>-<name>/` holds the
  outputs and the script that produced them. `examples/` is committed too.
  `comparisons/` and `runs/` are gitignored, so anything a decision rests
  on is copied into `benchmarks/` or summarised in the decision record.
- **Every hand-classified failure is labelled.**
  `docs/decisions/data/labelled-failures.md` holds the verdict for each one
  (real, template error, model error, unclear), with its evidence, source
  run and status. A failure on a real site counts as explained only once it
  is recorded there.
- **The decide-before-measuring rule.** Before a measurement is taken, the
  rule for keeping or reverting the change is written down. That rule is
  then applied exactly as written and the result recorded either way.
  Nothing is tuned after the numbers are seen. The model is Phase 37
  Decision 4; Phase 36 Decision 7 is another example.
- **Standards references are copied from the source.** ASVS 5.0
  requirement IDs come from `github.com/OWASP/ASVS` (the 5.0 release), with
  the file and version recorded. They are never written from memory (Phase
  35 Decision 3).

### What the product reports, so its own reports stay honest

| Rule | Where it is set | Test plan |
| --- | --- | --- |
| A test that skipped itself, with a reason, is "Not run". It counts toward neither the pass ratio nor the recommendation (Option C). | Phase 34 Decision 7 | RPT-10, RPT-12 |
| If no test ran, there is no release recommendation and the badge is neutral. | Phase 34, GEN-44 follow-up | RPT-14 |
| A suite with nothing to run says "Nothing to run" and why, not "run failed". | Phase 36 Decision 3 | RPT-15 |
| Findings (hardening gaps, optional items) are not failures. | Phase 34 Decision 3; Phase 36 Decision 2 | RPT-11, GEN-52 |
| Coverage is honest: a gap is named, never rounded up to 100%. | Discovered-coverage report (`src/lib/report/discovered-coverage.ts`) | RUN-10, RUN-11 |
| A Comprehensive report ends with a fixed statement of what it did not test. | Phase 35 Decision 6 | RPT-16 |
| Generation gate verdicts are saved with the run and shown in its report. | Phase 34 Decision 8 | RPT-13 |

## 2. Model output gates

**Principle: detect and fall back, never rewrite** (Phase 30; restated in
Phase 37 Decision 3).
- A local-model suite that fails a gate is replaced by the template suite.
- The result is labelled `generatedBy: "fallback"` with a `fallbackReason`.
- The first rejection ends the check.
- Model output is never edited to make it pass.

**Every gate records a verdict** in one shape: `GateVerdict` in
`src/lib/generate/gates.ts` (Phase 34 Decision 8).
- Fields: gate, bar, measured, verdict (`kept` or `rejected`), evidence.
- Evidence is capped at 5 lines of 300 characters.
- Every bar today is zero (`countGate`). The same shape takes a score and a
  threshold if a calibrated gate is added later.

The gates run in this order, in `src/lib/generate/local-generation.ts`:

| Gate (as recorded) | What it rejects | Code | `fallbackReason` | Introduced | Test plan |
| --- | --- | --- | --- | --- | --- |
| time budget | No answer within `TESTFORGE_OLLAMA_TIMEOUT_MS` (default 180 s) | `ollamaTimeoutMs`, `local-generation.ts` | `timeout` | Phase 30 (TFP-105) | GEN-24 |
| type check | Any TypeScript error against the project's Playwright types | `findTypeErrors`, `validate.ts` | `invalid_output` | Phase 30 (TFP-103 follow-up) | GEN-26 |
| unawaited assertions | A web-first assertion that is never awaited, so it never runs | `findUnawaitedAssertions`, `validate.ts` | `unawaited_assertion` | Phase 33 (TFP-110) | GEN-31 |
| promise to plain matcher | `expect(<Promise>)` followed by a matcher that doesn't retry. `.resolves` and `.rejects` are exempt. | `findPromisesToPlainMatchers`, `validate.ts` | `promise_to_plain_matcher` | Phase 37 Decision 2 (TFP-129) | GEN-56 |
| duplicate tests | Two or more tests with the same body after whitespace and comments are normalised | `findDuplicateTests`, `validate.ts` | `duplicate_tests` | Phase 37 Decision 3 (TFP-130) | GEN-57 |

Some fallbacks happen before any gate runs:
- `ollama_unreachable` (GEN-22);
- `ollama_model_missing` (GEN-23);
- `ollama_error` and `empty_completion` (GEN-25).

### The quality bar the gates don't cover

The gates catch failures that are mechanical. Quality is judged by reading.
- **Phase 33's category bar**, applied by reading each suite by hand. The
  current result for each category on the adopted model is GEN-54.
  `benchmarks/2026-09-30-gap-fill-fix/` holds the gap-fill result.
- **Known failures that need judgement, not yet gated:**
  - titles that don't match the test body (GEN-32's naming half);
  - a database test that never reloads;
  - guessed destinations such as `/dashboard`.

  These are left to the failure-triage gate deferred in Phase 34. That gate
  will be built on the labelled failure set.
- **Model tests in a Comprehensive run are kept outside the verdict**
  (Phase 35 Decision 5). They can count only after the labelled failure set
  shows they are trustworthy for that area. That will be a separate
  decision.

## 3. Template and run gates

- **Standard output stays unchanged.** A change that claims not to alter
  the template's output is checked by measurement: the output on fixed
  inputs must be byte-identical before and after. The regression policies
  of Phases 34, 36 and 37 set this, and so does Phase 35 Acceptance
  Criterion 1. Reading the diff does not count as a check. The check is
  `npm run check:template-unchanged -- <base-ref> [<head-ref>]` (TFP-137,
  GEN-58): 166 fixed inputs, 22 of them with page data, each ref's own
  generator, compared byte for byte. Exit 0 only when all are identical.
- **Form-submitting tests run only with `TESTFORGE_INTERACTIVE=1`** (GEN-44).
- **A healthy real site doesn't turn red because of the template's own
  mistakes** (Phase 36 Decision 1, GEN-50). Every false failure found goes
  into the labelled failure set.
- **The run stays polite on other people's hosts.** A Comprehensive run uses
  one worker on any host that isn't a local development host, and covers 20
  pages by default (Phase 35 Decision 2, RUN-23, RUN-24).
- **The passive security level sends only page loads**, plus one probe for
  a page that cannot exist. A test that records every request proves this
  (Phase 35 Decision 3, TFP-133).
- **A read-only test that interacts sends only GETs and submits no form.**
  It runs its interaction under the request guard, which aborts anything
  else and fails the test as a guard breach, naming the request or the form
  (Phase 41 Decision 3, amending Phase 38 Decision 1; TFP-181, RUN-27).
- **Active security testing needs a typed confirmation of ownership or
  permission**, saved with the run (Phase 35 Decision 8; it will be built
  with the active level).

## 4. Phase and ticket gates

- **Milestone gates.** Each decision record ends with "Suggested Milestone
  Gates". Code is not pushed past a gate until the gate has been
  independently verified. The current handover in `docs/` says which gate
  is next.
- **Standing execution policy** (`docs/decisions/product-roadmap.md`, from
  Phase 18):
  - a defect found while building or verifying a ticket is fixed in that
    ticket;
  - documentation lands in the same commit as the work it describes.
- **`TEST_PLAN.md` cases land with their code**, as each record's
  Regression Policy requires.
- **Status lines match git.** When a phase closes, its record's status line
  is reconciled with what git shows. Phase 36 reconciled ten records.
- **Commits** follow Conventional Commits and give the reason for the
  change, the alternatives that were rejected, and what the change does not
  do.

## 5. Independent verification checklist

Use this for every "done" report before a gate is passed. The builder's
report is a claim; this checklist turns it into evidence.

1. **The commits exist.** Run `git log` and `git show --stat` on the
   reported hashes. Check the changed files match the report and nothing
   outside the ticket changed. Run `git status -sb` to see what is pushed.
   When another agent is using the repo, use `git --no-optional-locks`, so
   no `index.lock` blocks its commits.
2. **Re-run the tests.** Count passed, failed and skipped yourself, and
   compare with the reported counts. A skip needs its reason.
3. **Type check and lint:**
   - `node node_modules/typescript/bin/tsc --noEmit -p .`;
   - eslint on the changed files.
4. **Measure output changes on fixed inputs.** For the template generator,
   run `npm run check:template-unchanged -- <base> <head>` (TFP-137).
   Where the output should not change, require byte-identical output.
   Where it should change, show the difference and check it is the
   intended one.
5. **Read model output by hand** against Phase 33's bar, and record the
   result for each category.
6. **Check each acceptance criterion separately.** Mark each one met, not
   met, or not checkable here, with the reason.
7. **Check the docs landed in the same commit:** `TEST_PLAN.md` case, record
   status, roadmap, handover.
8. **State the limits.** Say what couldn't be verified, and where it can
   be. For example, the verifier's VM has Node 22 and no Chromium, so the
   real-browser tests skip there and run on Emil's machine.
9. **Fix defects in the ticket.** Any defect found goes back to the builder
   in that ticket before the gate passes.
10. **Record the verdict** in the record's status line, the roadmap and the
    status audit, so the next session does not have to verify the work
    again.

The generic method behind this list is the `agent-report-verification`
skill. For refactors that claim unchanged behaviour, it is
`behavior-preservation-verification`.

## 6. Known gaps in this system

- **Closed 2026-10-01 by TFP-137: the fixed-input harness wasn't in the
  repo.** It is now `npm run check:template-unchanged` (sections 3 and 5).
  What follows is the gap as it stood: The 144-input generator
  scripts used to prove Standard output unchanged exist only on the
  verifier's side. One of them reads
  `benchmarks/2026-09-29/content-profile.json`. Until they are committed,
  nobody else can repeat that check. This is tracked as TFP-137 in the
  Phase 35 record, which names the command in sections 3 and 5 and closes
  this gap.
- **Model failures that need judgement aren't gated** (section 2).
- **The local model call is never retried.** A single timeout falls back to
  the template.
- **Live checks need Emil's machine.** Real-browser and live-site checks
  can't run in the verifier's VM.
