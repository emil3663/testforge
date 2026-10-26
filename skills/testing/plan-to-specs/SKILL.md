---
name: plan-to-specs
description: >
  Expand a TEST_PLAN.md into a Playwright spec tree, one file per test case,
  and verify the two stay in step with --check. This is a port of real,
  tested, unmerged work from cah-pwa's generator-improvements branch
  (commit 78e30de) — not agent judgment re-deriving parsing logic each run.
  Use this skill when a repo has a TEST_PLAN.md with stable case IDs and
  needs its spec tree generated or its coverage checked, or when CI should
  fail on drift between the plan and the tree rather than let it go
  unnoticed.
---

# Expand a test plan into a spec tree, and keep the two honest

## Where this came from

This is a port, not original design work. `cah-pwa`'s `generator-improvements`
branch (one commit, `78e30de`, Martin Hugo with Claude Opus 5, never merged
to `cah-pwa`'s `main`) rewrote that repo's own `scripts/generate_playwright_tests.js`
after finding it was quietly wrong. `TEST_PLAN.md` as the source of truth,
mechanically expanded into a spec tree that maps one-to-one onto its case
IDs, is the good idea in that script and didn't change. Four things around
it did, each because it was caught doing something wrong — not cleanup, a
real fix with real evidence behind it each time.

## What changed, and the evidence that prompted each change

**1. Parse the table, don't pattern-match it.** The old regex matched any
row whose first cell was uppercase alphanumeric — which a markdown table's
own header (`| ID | Test | ... |`) and separator (`|----|------|`) rows both
satisfy. It produced 14 files literally named `id.spec.js` and 21 named
`.spec.js` — 35 of 228 generated files, in a tree whose size is the first
thing a reviewer judges. The fix requires the shape of a real case ID
(`/^[A-Z]{2,4}-\d{2,3}$/` in the source repo), not "looks tableish."

**The part that mattered more than the junk:** two of those `.spec.js`
files weren't empty. Someone had implemented into them — 17 real Playwright
tests, including a full smoke run. A leading dot made them invisible to
`ls`, and the project's own `tests/README.md` counted the implemented work
as 1 file and 4 tests when it was 4 files and 22. A parser bug hid roughly
five times the coverage the project was claiming credit for.

**2. Carry the plan's Expected Result into the stub**, instead of a `(fill
expected result)` placeholder. The plan already states it; making someone
retype it is how the test and the plan start disagreeing — and the
expectation is the part of a test that matters most.

**3. `--check` mode.** A generator that only creates is a one-way door: the
plan and the tree drift apart silently, and the drift is invisible because
everything still passes. `--check` compares both directions and exits
non-zero on any disagreement, and reports coverage as **"N of M cases
covered by an implemented test"** — a number that can go up — rather than a
raw file count, which only ever goes up regardless of whether anything real
was written.

**4. Tell a scaffold from an implementation by reading it, never by its
name.** A scaffold calls `test.skip()`; an implementation doesn't, and its
case IDs are read from its test titles, so one file can legitimately cover
several cases. This is what makes `--check` safe to run near real work:
**only a scaffold can ever be reported as an orphan.** A naive "delete empty
generated files" tidy-up would have deleted the 17 rescued tests from
change 1 — this is the mechanism that stops that.

## What was deliberately not changed, and generalized here

Kept, unchanged from the source: the plan stays the source of truth;
existing files are never overwritten; no new dependency (`node --test`,
built in); the one-file-per-case convention.

**Generalized beyond the source**, since the source hardcoded assumptions
specific to `cah-pwa`'s own layout:

- **Paths.** The source resolved everything from `__dirname`, assuming the
  script always lives at `<repo>/scripts/`. This port resolves from
  `process.cwd()` instead, with `--plan` and `--out` flags to override —
  so the same file runs against any repo without being copied into a fixed
  location inside it first.
- **The case-ID shape.** `[A-Z]{2,4}-\d{2,3}` is `cah-pwa`'s own scheme
  (`LG-01`, `GP-23`). It's now a parameter with that as the default, not a
  fixed regex — pass `--case-id` to match a different repo's IDs (e.g.
  `TA-\d{3}` for `test-assist`'s scheme, or `[A-Z]+_\d{3}` for an
  underscore-separated one).

Explicitly out of scope: `generate_test_stability_matrix.js`, the older,
separate script this branch doesn't touch and which has no rating logic of
its own — `honest-coverage` is where real stability rating lives in this
repo.

## Inputs you need from the user

1. **The repo's `TEST_PLAN.md`** — a markdown file with tables carrying
   stable case IDs, section headings (`##`/`###`) grouping them, and an
   Expected Result column. If the ID scheme isn't `cah-pwa`'s own
   `[A-Z]{2,4}-\d{2,3}`, get the actual shape from the user rather than
   guessing.
2. **Whether this is a first run or a check** — writing new stubs
   (`generate-specs.js`) and verifying drift (`generate-specs.js --check`)
   are different operations with different blast radius; don't run the
   write mode without being asked to.
3. **Where the spec tree lives**, if not the default `tests/generated`
   relative to the repo root.

## Output format

This is a bundled-script skill: the script does the mechanical work, this
file explains when to invoke it and how to read what it prints. Don't
re-derive the parsing or drift-detection logic by hand — run the script.

```
node generate-specs.js [--check] [--plan <path>] [--out <dir>] [--case-id <regex>]
```

Every run prints three lines first, regardless of mode:

```
<plan> declares <N> test cases.
Spec tree: <T> files — <I> implemented, <S> scaffolds.
Cases covered by an implemented test: <C> of <N>.
```

**`<C> of <N>` is the number worth reporting to the user, not `<T>`.** A
large `<T>` with a small `<C>` is exactly the gap `honest-coverage` also
names — a reviewer who reads the file count concludes one thing, a reviewer
who reads the coverage fraction concludes another.

In `--check` mode, a non-zero exit additionally prints every case missing a
spec file and every scaffold matching no case in the plan (never an
implementation — see rule below), followed by a one-line instruction: run
without `--check` to add missing stubs, review orphans by hand before
deleting any.

## Rules

**Never delete an orphan without opening it first, no matter what `--check`
says.** `--check` guarantees an orphan is a scaffold (`test.skip()`
present), not that deleting it is harmless — a scaffold might be mid-edit,
or a case ID might have changed in the plan without the old file being
renamed. "Only a scaffold can be an orphan" is a safety property of the
tool, not a license to auto-delete.

**Report the coverage fraction, not the file count, whenever summarizing
results to the user.** This is the same discipline `honest-coverage` asks
for, applied to this tool's own output.

**If the ID scheme doesn't match the default, ask rather than guess.** A
wrong `--case-id` doesn't error — it silently parses zero cases or the
wrong ones, which looks like an empty or broken plan rather than a
configuration mismatch.

**`--check` in CI, not the write mode.** Writing new stubs is a decision
someone should see happen locally; a CI job should verify agreement and
fail loudly on drift, never silently create files during a run.

**Don't hand-edit a generated stub's `test.skip()` call away without also
writing a real assertion.** Removing the skip without adding one turns a
scaffold into a test that passes vacuously — `dont-stub-what-you-prove`'s
territory, not this skill's, but the failure mode is adjacent enough to
flag here.

## Worked example

Run against `cah-pwa`'s own real `TEST_PLAN.md` (181 cases) and the actual
spec tree that was on its `main` branch before `generator-improvements`
landed — the same drift the source branch's own commit found, reproduced
here as a dry run rather than asserted:

```
$ node generate-specs.js --check --plan cah-pwa/TEST_PLAN.md --out <that tree>
cah-pwa/TEST_PLAN.md declares 181 test cases.
Spec tree: 228 files — 3 implemented, 225 scaffolds.
Cases covered by an implemented test: 18 of 181.

2 case(s) in the plan have no spec file:
  GP-23  Live praise generation
  GP-24  Praise fallback on API failure

47 scaffold(s) match no case in the plan:
  .../2-current-feature-status/.spec.js
  .../3-1-authentication-landing/id.spec.js
  ...

The plan and the spec tree disagree. Run without --check to add
missing stubs; review orphans by hand before deleting any.
```

Read this the way the Rules above ask: **"18 of 181" is the number to
report**, not "228 files." The 47 orphans are the exact `id.spec.js` /
`.spec.js` junk change 1 above describes — genuinely orphaned scaffolds
here, confirmed by opening a sample rather than trusted on the strength of
the filename pattern alone, since that's the whole point of reading rather
than pattern-matching.

**Confirmed separately:** generating into an empty directory from the same
plan writes all 181 stubs and a follow-up `--check` reports agreement;
deleting one written stub and re-running `--check` reports that exact case
as missing and exits non-zero. Both the create path and the drift-detection
path were exercised against real data, not assumed from reading the source.

## How to invoke this skill

> "Run plan-to-specs against this repo's TEST_PLAN.md and tell me the real
> coverage number."

Or in CI: "wire `generate-specs.js --check` into the pipeline so a plan/tree
mismatch fails the build" — the script's own exit code is designed for
exactly that.
