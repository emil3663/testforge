# Phase 20 — Build the Remaining Skills Backlog

**Version:** 1.2 — TFP-046 revised: `generator-improvements` located and
read in full, port replaces rebuild-from-spec. TFP-043/044/047/048/049
built and verified. TFP-045 revised: names the ISTQB structural
(white-box) testing category explicitly.
**Date:** 2026-09-16
**Status:** Complete. TFP-043/044/047/048/049 done as this doc already stated; TFP-045 (find-the-hidden-platform), TFP-046 (plan-to-specs), and TFP-050 (observability-check) are also built, contrary to this doc's prior "remaining" claim — confirmed via skills/ROADMAP.md's own "Status: built" entries for all three and the real SKILL.md/support files present on disk. Corrected 2026-09-23 (Cowork verification pass).

## Context

Before Phase 19's dogfooding, Emil asked to confirm every skill discussed
so far actually exists as a real `SKILL.md`, not just a `ROADMAP.md`
entry. Of 11 skills discussed, 3 are built (`write-playwright-test`,
`code-structure`, `refactor-audit`). This backlog is the remaining 8.

Four have no cross-repo dependency and can be built directly from their
`ROADMAP.md` entries and cited source chapters, the same way TFP-034
worked from `prompt.ts` and the README alone: `regression-safety-net`,
`reliability-audit`, `failure-mode-tests`, `observability-check`.

Four depend on material from other repos, per the standing rule in the
Phase 18 backlog. Research for each is included below so it doesn't need
re-deriving:

- **`honest-coverage`** — source material is in better shape than
  `REIMAGINING.md` suggested. `test-assist/DESKTOP_STABILITY_MATRIX.md`
  (v1.18) rates every case stable/moderate/blocked with real per-case
  reasoning, and `cah-pwa/tests/README.md` already does the pattern this
  skill should generalize (229 scaffold files, 1 actually implemented,
  stated plainly).
- **`dont-stub-what-you-prove`** — TA-227's brief
  (`test-assist/docs/ta227-228-e2e-testing-brief.md`) has a concrete,
  ready-to-port example.
- **`find-the-hidden-platform`** — TA-230's write-up is rich but buried
  inside `test-assist/TESTASSIST_BACKLOG.md` (113KB). Needs extracting
  to its own doc first, same as the standing rule already flagged.
- **`plan-to-specs`** — correction after this backlog was first drafted:
  the `generator-improvements` branch does exist on `origin` — Emil
  pointed to it directly
  (`github.com/emil3663/cah-pwa/tree/generator-improvements`). The
  earlier "not recoverable" finding was a miss, not a fact: a bare
  `git branch -a` only shows branches already known to the local clone,
  and this one had never been fetched by name before. Fetching it
  directly (`git fetch origin generator-improvements`) pulled it down
  cleanly. It's real, tested, unmerged work — one commit, authored by
  Martin with Claude Opus 5, never merged into `cah-pwa`'s `main`. It
  does exactly what `REIMAGINING.md` described `--check` doing, plus
  three things neither of us knew to ask for (below). This is now a
  port, not a rebuild — see TFP-046.

## Scope (this phase)

### In scope
Build all 8 remaining skills as real `SKILL.md` files (plus, for
`plan-to-specs`, a companion script — see TFP-046), each landing under
`skills/testing/` or `skills/engineering/` per its existing category in
`ROADMAP.md`.

### Out of scope
- Phase 19's dogfooding — deliberately blocked on this phase finishing.
- Any skill not already discussed and recorded in `ROADMAP.md`.

## Backlog

### TFP-043 - Build honest-coverage

- **Phase:** 20
- **Priority:** P1
- **Suggested labels:** `skills`, `testing`
- **Problem it solves:** the differentiator `REIMAGINING.md` called "the
  whole pitch" doesn't exist as a real skill yet.
- **Scope:**
  - `skills/testing/honest-coverage/SKILL.md`, following the worked-example
    pattern established in `write-playwright-test`.
  - Port real excerpts (not the whole 47KB file) from
    `test-assist/DESKTOP_STABILITY_MATRIX.md`: the stable/moderate/blocked
    rating scheme, and 2-3 real "Moderate" rows with their actual
    reasoning (e.g. the Launcher/Lifecycle rows — substituted APIs,
    monkeypatched methods, what was verified to genuinely fail against
    pre-fix code vs. what wasn't).
  - Port `cah-pwa/tests/README.md`'s framing directly — "a reviewer who
    counts spec files concludes X, a reviewer who opens one concludes
    the opposite" — as the skill's own stated rationale.
  - Output: after writing (or reviewing) a test suite, the skill states,
    per test or per group, a stability-style rating and what remains
    unproven — not a generic disclaimer, a specific one per case.
- **Acceptance criteria:**
  - The skill produces a stability-matrix-shaped output when applied to
    a real suite, not prose.
  - No copied file exceeds a short excerpt — the source documents are
    referenced, not duplicated wholesale.
- **Dependencies:** None.

### TFP-044 - Build dont-stub-what-you-prove

- **Phase:** 20
- **Priority:** P1
- **Suggested labels:** `skills`, `testing`
- **Problem it solves:** no review skill currently checks whether a
  test's assertion targets the same thing its mock replaces.
- **Scope:**
  - `skills/testing/dont-stub-what-you-prove/SKILL.md`.
  - Port the TA-227 example directly (from
    `test-assist/docs/ta227-228-e2e-testing-brief.md`):
    ```python
    calls: list[str] = []
    launcher._start_capture = lambda: calls.append("start_capture")
    ...
    assert calls == ["start_capture"]
    ```
    — a function-was-called assertion standing in for "a capture
    actually happened." The fix retrofits to let the real function run
    and assert the real end state instead.
  - Rules: read a test, identify what's mocked and what's asserted; flag
    when they're the same target (the mock stands between the code and
    the thing the test claims to verify).
- **Acceptance criteria:**
  - Applied to a real test file with this pattern, the skill correctly
    flags it and names what the assertion should check instead.
- **Dependencies:** None.

### TFP-045 - Extract TA-230 and build find-the-hidden-platform

- **Phase:** 20
- **Priority:** P1
- **Suggested labels:** `skills`, `testing`
- **Problem it solves:** TA-230's write-up is real and detailed but
  unusable as skill source material while it's one entry inside a
  113KB backlog file.
- **Scope:**
  - First: extract TA-230's full entry from
    `test-assist/TESTASSIST_BACKLOG.md` (starts "### TA-230 — The
    `register_global_hotkeys` path is structurally untested...") into
    its own short doc, `docs/TA-230.md`, in testforge.
  - Then: `skills/testing/find-the-hidden-platform/SKILL.md`, built from
    that extracted doc. Keep the three-sub-problem structure TA-230
    itself uses — coverage gap, cross-platform blind spot,
    foreign-holder/shared-state collision — since it's a real, useful
    taxonomy, not just narrative.
  - Rules: audit for `skipif` guards, default-off flags gating real
    shared state, and monkeypatches that replace the thing under test;
    report each as a path the suite cannot fail for, with what's
    unverified while it's skipped.
  - Name it explicitly, in the skill's own text, as ISTQB's structural
    (white-box) testing — code coverage of paths the suite doesn't
    reach. This surfaced during the Phase 18 ISTQB pass and Emil
    confirmed: keep the skill named `find-the-hidden-platform` (it's
    specific to what TA-230 actually found), but state the ISTQB
    category plainly rather than leave the connection implicit —
    "coverage" already has a precise, checkable meaning in that
    vocabulary, worth reusing rather than reinventing.
- **Acceptance criteria:**
  - `docs/TA-230.md` exists and is a clean extraction (not a summary —
    the actual content).
  - `SKILL.md` states, in its own words, that this is ISTQB structural
    (white-box) testing — not just implied by what the skill does.
  - Applied to a real codebase with at least one `skipif` or default-off
    flag, the skill finds it.
- **Dependencies:** None.

### TFP-046 - Build plan-to-specs (porting generator-improvements)

- **Phase:** 20
- **Priority:** P2
- **Suggested labels:** `skills`, `testing`, `tooling`
- **Problem it solves:** `TEST_PLAN.md` files exist as manual documents
  with no mechanical way to check whether the actual spec tree matches
  them. `cah-pwa`'s `generator-improvements` branch (unmerged, on
  `origin`, one commit — `78e30de`, Martin + Claude Opus 5) already
  solved this properly. Porting real, evidenced work beats rebuilding
  from a description.
- **What the branch actually contains** (confirmed by fetching it and
  reading every changed file directly — `git fetch origin
  generator-improvements`, `git show origin/generator-improvements:...`
  — not summarized from the commit message alone):
  - `scripts/lib/test-plan.js` — table parsing pulled out of the
    generator so it's independently testable. The bug it fixes is
    concrete: the old regex matched any row whose first cell was
    uppercase-alphanumeric, which a markdown table's header and
    separator rows both satisfy — producing 14 files literally named
    `id.spec.js` and 21 named `.spec.js` (35 of 228 generated files).
    Two of those dot-prefixed files were not empty — 17 real
    implemented Playwright tests, including a full smoke run, sitting
    invisible to `ls` and undercounted in `tests/README.md` (reported
    as 1 file/4 tests when it was 4 files/22 tests). Fix: a case ID
    must match `/^[A-Z]{2,4}-\d{2,3}$/`, not just "looks tableish."
  - `scripts/lib/spec-tree.js` — reads the generated tree back and
    distinguishes an implementation from a scaffold by content
    (`test.skip()` present = scaffold), not filename. This is the part
    that makes `--check` safe to run near real work: only a scaffold
    can ever be reported as an orphan, so a tidy-up guided by this
    skill can't delete someone's finished tests the way a naive
    "delete empty generated files" pass would have.
  - `scripts/generate_playwright_tests.js` (rewritten) — same
    stub-writing behavior as before (never overwrites an existing
    file), plus:
    - stubs now carry the plan's actual Expected Result as a comment,
      not a `(fill expected result)` placeholder
    - `--check` mode: reports cases in the plan with no spec file,
      scaffolds matching no case in the plan (orphans), and real
      coverage as "N of M cases covered by an implemented test" —
      exits non-zero on either kind of disagreement, so CI can hold
      the plan and the tree in step.
  - `scripts/README.md` — explains all four changes with the evidence
    that prompted each; worth porting near-verbatim as the skill's own
    "why" section, since it's already written the way this repo's
    skills explain themselves (a claim plus the evidence, not just an
    assertion).
  - `scripts/test/*.test.js` — 11 tests using `node --test` (no new
    dependency), covering the parser and the spec-tree reader.
- **Scope:**
  - Generalize the three files above out of `cah-pwa`-specific
    assumptions (its own relative paths, its own ID scheme) so they
    work against any repo's `TEST_PLAN.md`.
  - Port `scripts/test/*.test.js` alongside, generalized the same way —
    this is the one skill candidate here that ships with its own tests,
    keep that.
  - `generate_test_stability_matrix.js` (the older, separate script)
    stays out of scope — it has no rating logic of its own and nothing
    in `generator-improvements` touches it; `honest-coverage` (TFP-043)
    is where real stability rating actually lives.
  - `SKILL.md` explains when to invoke the script and how to read
    `--check`'s output; the script itself does the mechanical work —
    this remains a bundled-script skill, not agent judgment re-deriving
    parsing logic each run.
- **Deliverables:**
  - `skills/testing/plan-to-specs/SKILL.md`
  - `skills/testing/plan-to-specs/generate-specs.js` (or split into
    `lib/test-plan.js` + `lib/spec-tree.js` + the main script, matching
    the source's own structure — Claude Code's call, source layout is
    a reasonable default)
  - `skills/testing/plan-to-specs/generate-specs.test.js` (or matching
    split), ported from `scripts/test/*.test.js`
- **Acceptance criteria:**
  - Run against a real `TEST_PLAN.md` (testforge doesn't have one yet;
    use `cah-pwa/TEST_PLAN.md` itself as the trial target, since it's
    the one the source branch was validated against), the script
    generates the tree and `--check` correctly reports a real coverage
    fraction and exits non-zero on an introduced mismatch (delete one
    generated file and confirm `--check` catches it).
  - The ported tests pass.
  - Commit message/skill text credits the source: this is a port of
    `cah-pwa`'s `generator-improvements` branch (commit `78e30de`), not
    original work invented here.
- **Dependencies:** None.

### TFP-047 - Build regression-safety-net

- **Phase:** 20
- **Priority:** P2
- **Suggested labels:** `skills`, `testing`
- **Problem it solves:** change-related testing (ISTQB) — confirmation
  and regression — isn't covered by anything built or candidate so far,
  despite every skill here existing because an agent edits code.
- **Scope:**
  - `skills/testing/regression-safety-net/SKILL.md`, built from its
    `ROADMAP.md` entry — no cross-repo source material, this one's
    fresh.
  - Two distinct jobs, per ISTQB's own split: confirmation (did the
    originally-reported failure actually stop happening) and regression
    (did anything outside the intended change break). Keep them as two
    named checks, not one blended rule — the ticket's own acceptance
    criteria should test each separately.
- **Acceptance criteria:**
  - Applied to a real before/after code change, the skill can state,
    separately: whether the original failure is gone, and whether
    anything else changed behavior.
- **Dependencies:** None.

### TFP-048 - Build reliability-audit

- **Phase:** 20
- **Priority:** P2
- **Suggested labels:** `skills`, `engineering`, `sre`
- **Problem it solves:** nothing currently audits for missing timeouts,
  retries without backoff, or unbounded queues — SRE ch. 21-22's core
  concern, and a real risk category no other skill here covers.
- **Scope:**
  - `skills/engineering/reliability-audit/SKILL.md`, from its
    `ROADMAP.md` entry. No cross-repo source material.
  - Follow `refactor-audit`'s issue-template convention
    (`docs/WORKING_AGREEMENTS.md`'s brief shape) for findings, since it's
    already the established format for this category — consistency
    matters more here than inventing a new shape.
- **Acceptance criteria:**
  - Applied to code making an external call, correctly identifies
    whether a timeout and a bounded retry exist.
- **Dependencies:** None (can reference the now-local
  `docs/WORKING_AGREEMENTS.md` from TFP-039).

### TFP-049 - Build failure-mode-tests

- **Phase:** 20
- **Priority:** P2
- **Suggested labels:** `skills`, `testing`, `sre`
- **Problem it solves:** `write-playwright-test` only covers failure
  scenarios the user explicitly mentions — SRE ch. 17's point is that
  dependency-timeout and partial-failure cases matter as a matter of
  course, not only when asked.
- **Scope:**
  - `skills/testing/failure-mode-tests/SKILL.md`, explicitly framed as a
    sibling to `write-playwright-test` (same output shape — a Playwright
    test file — different judgment: what to test when nothing was said
    about failure).
- **Acceptance criteria:**
  - Given the same login-page scenario `write-playwright-test`'s worked
    example uses, this skill proposes at least one failure-mode test
    (e.g. the auth endpoint timing out) that the original skill's
    output doesn't cover — the two should visibly complement, not
    duplicate.
- **Dependencies:** None.

### TFP-050 - Build observability-check

- **Phase:** 20
- **Priority:** P2
- **Suggested labels:** `skills`, `engineering`, `sre`
- **Problem it solves:** `honest-coverage` states what a green run
  doesn't prove; this extends the same instinct outward — would anyone
  actually notice this breaking in production.
- **Scope:**
  - `skills/engineering/observability-check/SKILL.md`, from its
    `ROADMAP.md` entry.
  - Explicitly cross-reference `honest-coverage` in the skill's own
    text — this is presented as that skill's natural extension, and the
    two should read as a pair, not as unrelated entries that happen to
    share a theme.
- **Acceptance criteria:**
  - Applied to a feature with no logging/metrics/error tracking on its
    failure path, the skill identifies the gap specifically (not "add
    more logging" generically).
- **Dependencies:** None (build after TFP-043 so `honest-coverage` exists
  to reference).

## Recommended Execution Order

1. TFP-043, TFP-044, TFP-047, TFP-048, TFP-049 — no dependencies on each
   other or on anything else in this phase; handed over to Claude Code
   together in one batch, since none of the five touch a file another
   one does.
2. TFP-045 (extraction + build)
3. TFP-046 (a port of real, tested work from `generator-improvements` —
   the most source material to carry over correctly, not the most
   original design work)
4. TFP-050 (references TFP-043's output)

## Suggested Milestone Gates

### Gate A - All discussed skills exist
- All 8 skills have a real `SKILL.md` (and, for `plan-to-specs`, a real
  script) under `skills/testing/` or `skills/engineering/`.
- `ROADMAP.md`'s `Status: not started` lines are all updated.
- Only then does Phase 19 (dogfooding) proceed.
