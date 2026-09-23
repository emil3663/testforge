# Phase 18 — Skills Taxonomy & Reliability Backlog

**Version:** 1.0
**Date:** 2026-09-16
**Status:** Shipped — TFP-039 landed (code-structure and refactor-audit calibrated/trial-run, docs/WORKING_AGREEMENTS.md now exists in this repo, skills/engineering/CALIBRATION.md has the full output); skills/ROADMAP.md marks both "Status: shipped." This doc's header was never updated when the work landed. Corrected 2026-09-23 (Cowork verification pass).

## Context

`skills/` currently holds one shipped skill (`write-playwright-test`, all
testing-judgment), four recorded candidates that are also testing-judgment
(`honest-coverage`, `dont-stub-what-you-prove`, `find-the-hidden-platform`,
`plan-to-specs`), and two drafts under `skills/proposed/`
(`code-structure`, `refactor-audit`) that are a different kind of thing —
engineering discipline, not testing judgment. Emil confirmed these should
be split into two explicit categories rather than left flat, and asked to
look at the Google SRE book
(https://sre.google/sre-book/table-of-contents/) as a source for a third
kind of judgment: identifying where reliability issues are likely to
occur, as part of the test harness itself.

Since only one skill exists so far, restructuring now is cheap — later,
with more skills and cross-references, it wouldn't be.

**Standing rule, added after this backlog was first drafted:** a skill's
instructions must resolve inside this repo. If a skill's format, examples,
or tooling come from another one of Emil's repos, that material gets
copied into `testforge` as part of the ticket that builds the skill — a
skill that only works if another repo happens to be checked out next to
this one is not actually usable. This was found the hard way once
already (TFP-039, `WORKING_AGREEMENTS.md`) and a full pass turned up more
of the same, so it's recorded here rather than left to be rediscovered
one candidate at a time:

| Candidate | What it needs | Where it actually is |
|---|---|---|
| `honest-coverage` | the two example write-ups it generalizes | `test-assist/DESKTOP_STABILITY_MATRIX.md`, `cah-pwa/tests/README.md` |
| `dont-stub-what-you-prove` | TA-227's write-up | `test-assist/docs/ta227-228-e2e-testing-brief.md` |
| `find-the-hidden-platform` | TA-230's write-up | one entry inside `test-assist/TESTASSIST_BACKLOG.md` — worth extracting to its own short doc rather than porting the whole backlog file |
| `plan-to-specs` | the working tool it generalizes | `cah-pwa/scripts/generate_playwright_tests.js` + `generate_test_stability_matrix.js` (built once); the `--check` version REIMAGINING.md describes is on a `generator-improvements` branch not yet located — that's a gap, not just a copy |

Also worth a decision before more skills get built: `code-structure` and
`refactor-audit` both follow `cah-pwa/skills/`'s own template (*What this
skill is for / Inputs / Output format / Rules / Worked example / How Emil
invokes this*), but `write-playwright-test` — the one skill actually
shipped — doesn't use that shape. Converging on one format is cheap now
and gets more disruptive the more skills exist.

## Scope (this phase)

### In scope
1. Split `skills/` into `skills/testing/` and `skills/engineering/`.
2. Record three new engineering-concern candidates grounded in specific
   SRE book chapters — reliability risk, not general reliability
   philosophy.
3. Review and fix the two existing engineering-concern drafts
   (`skills/proposed/`) before any decision to promote them.

### Out of scope
- Building `honest-coverage`, `dont-stub-what-you-prove`,
  `find-the-hidden-platform`, or `plan-to-specs` (still TFP-035's
  candidates, untouched here).
- Building any of the three new SRE-informed candidates — recorded only.
- Org-process SRE chapters (on-call, incident response, postmortems,
  team scaling) — these describe how a team operates, not something a
  code-reading skill can audit for. Not proposed as skills.
- Release engineering as a new skill — already covered by the existing
  `verified-release-pipeline` account skill; noted, not duplicated.

## Backlog

### TFP-037 - Split skills/ into testing/ and engineering/

- **Phase:** 18
- **Priority:** P1
- **Suggested labels:** `refactor`, `skills`, `taxonomy`
- **Problem it solves:** `skills/` mixes testing-judgment skills with
  engineering-concern skills with no structural distinction. That's
  manageable with one skill; it won't be once the four testing
  candidates and three engineering candidates below are built.
  Restructuring now, while only `write-playwright-test` has to move,
  avoids paying for it later.
- **Scope:**
  - Move `skills/write-playwright-test/` to
    `skills/testing/write-playwright-test/`.
  - Update `skills/README.md` and `skills/ROADMAP.md` to reflect the new
    structure and the two categories.
  - Leave `skills/proposed/` where it is for now — still pending review
    (TFP-039) — but note in `ROADMAP.md` that approved engineering-concern
    skills land in `skills/engineering/`.
- **Deliverables:**
  - Updated `skills/` tree, `skills/README.md`, `skills/ROADMAP.md`.
- **Acceptance criteria:**
  - `skills/testing/write-playwright-test/SKILL.md` exists; nothing
    remains at the old path.
  - The skill still produces the same output for the same login-page
    scenario used to verify TFP-034 originally — the move didn't change
    behavior.
  - That login-page scenario — the description, and the test file it
    produced — is captured as a real worked example inside `SKILL.md`
    itself, not left implicit. ISTQB's own definition of a test case
    (preconditions, inputs, expected results) is exactly what this skill
    produces, but right now the only instance of it lives in a past
    conversation rather than the document — this closes that gap, and
    brings the file a step closer to the `cah-pwa/skills/` template's
    shape without a full rewrite.
  - `ROADMAP.md` shows both categories as explicit headings.
- **Dependencies:** None.

### TFP-038 - Record SRE-informed and ISTQB-informed candidates

- **Phase:** 18
- **Priority:** P2
- **Suggested labels:** `documentation`, `planning`, `sre`, `istqb`
- **Problem it solves:** identifying where reliability issues are likely
  to occur is a distinct kind of judgment from coverage honesty or
  mocking hygiene (TFP-035's four candidates), and a comparison against
  the ISTQB testing framework separately surfaced a real, unrelated gap:
  nothing currently shipped, candidate, or proposed covers change-related
  testing (confirmation and regression) — whether a fix actually fixed
  what it claimed to, and whether a change broke something that already
  worked. That's a strange thing to be missing given every skill here
  exists because an agent is editing code.
- **Scope:**
  - Add three candidates to `skills/ROADMAP.md` under a new "Engineering
    concerns" heading, alongside `code-structure` and `refactor-audit`
    (referenced via the existing `skills/proposed/` pointer, not
    duplicated):
    - **`reliability-audit`** — generalizes SRE ch. 21-22 (Handling
      Overload, Addressing Cascading Failures): audits external calls
      for missing timeouts, retries without backoff, and unbounded
      queues — "what happens when this dependency is slow or down."
    - **`failure-mode-tests`** — generalizes SRE ch. 17 (Testing for
      Reliability): a sibling to `write-playwright-test` that covers
      dependency-timeout and partial-failure scenarios as a matter of
      course, not only when the user happens to mention them.
    - **`observability-check`** — generalizes SRE ch. 6 (Monitoring
      Distributed Systems): checks whether a feature under test has any
      way to tell, in production, that it's broken — extends
      `honest-coverage`'s "what a green run doesn't prove" into "and
      would anyone notice."
  - Add a fourth candidate under the existing "Testing judgment" heading
    (alongside `honest-coverage` and the other three from TFP-035) — this
    one belongs there, not with the engineering-concern group, since it's
    dynamic testing of the app itself, the same category
    `write-playwright-test` is in:
    - **`regression-safety-net`** — generalizes ISTQB's change-related
      testing (confirmation testing + regression testing): after a fix,
      confirm the originally-reported failure is actually gone;
      separately, confirm the change didn't break anything in areas it
      wasn't meant to touch. Not generalized from any of Emil's own prior
      work the way the others are — a fresh candidate, so no cross-repo
      material to port, unlike the standing-rule table above.
  - Note explicitly that release engineering (SRE ch. 8) is already
    covered by the `verified-release-pipeline` account skill — record
    that instead of proposing a duplicate.
  - Documentation only — no skill files get built in this ticket.
- **Deliverables:**
  - Updated `skills/ROADMAP.md`.
- **Acceptance criteria:**
  - All four candidates (three engineering, one testing) recorded with a
    one-line description, what each generalizes from, and
    `Status: not started`, matching the format of the existing entries.
  - `regression-safety-net` is filed under "Testing judgment," not
    "Engineering concerns" — the category matters here, it's not just
    filing.
  - `ROADMAP.md` states that release engineering is covered elsewhere,
    rather than silently omitting it.
- **Dependencies:** TFP-037 (so "Engineering concerns" has a real folder
  to point at).

### TFP-039 - Review, fix, and trial skills/proposed/ before promotion

- **Phase:** 18
- **Priority:** P2
- **Suggested labels:** `review`, `skills`
- **Problem it solves:** `code-structure` and `refactor-audit` are
  well-built but explicitly marked as not yet run for real, and
  `refactor-audit`'s issue template points at
  `docs/WORKING_AGREEMENTS.md`, which doesn't exist in this repo (it's
  in `test-assist`). Both need a real, narrow run before being trusted
  enough to promote.
- **Scope:**
  - Fix `refactor-audit.md`'s template reference by copying
    `docs/WORKING_AGREEMENTS.md` from `test-assist` into `testforge`
    (e.g. `docs/WORKING_AGREEMENTS.md`) — per the standing rule above,
    the skill's instructions need to resolve in this repo, not point
    across to another one.
  - Run `code-structure`'s thresholds against `page.tsx` (353 lines,
    already reviewed and trusted from Phase 16) as a calibration check —
    does the ~300-line "implementing, not assembling" rule fire, and if
    so, is that a real finding or a miscalibration.
  - Run `refactor-audit` against `src/app/_hooks/` only, printed rather
    than filed, per the authors' own suggested first run.
  - Decide, based on those two results, whether to promote both into
    `skills/engineering/` as-is, promote with threshold adjustments, or
    send back for more work.
- **Deliverables:**
  - A findings note (in `skills/ROADMAP.md` or linked from it).
  - If promoted: both files moved into `skills/engineering/`.
- **Acceptance criteria:**
  - The `WORKING_AGREEMENTS.md` reference is fixed before any promotion.
  - The `page.tsx` calibration result and the `_hooks/` audit output are
    both recorded, not summarized as "looked fine."
  - Promotion, if it happens, is a stated decision with a reason.
- **Dependencies:** TFP-037.

## Recommended Execution Order

1. TFP-037
2. TFP-038
3. TFP-039

## Suggested Milestone Gates

### Gate A - Phase 18 taxonomy checkpoint
- TFP-037 is complete and `write-playwright-test` still works identically
  from its new path.
- TFP-038 and TFP-039 can then proceed independently, in either order.
