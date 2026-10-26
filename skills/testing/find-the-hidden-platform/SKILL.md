---
name: find-the-hidden-platform
description: >
  Audit a repo for code paths that are structurally unreachable by its own
  test suite — skipif guards, default-off flags gating real shared state,
  and monkeypatches that permanently stand in for the thing under test —
  and report each as a path the suite cannot fail for, naming what's
  unverified while it's skipped. This is ISTQB's structural (white-box)
  testing: measuring which paths the suite actually reaches, not whether
  the assertions on the paths it does reach are correct. Use this skill
  when auditing test coverage for a gap hidden by a guard rather than by a
  missing assertion.
---

# Find the hidden platform

## What kind of testing this is

This is ISTQB's **structural (white-box) testing** category: code coverage
of the paths a suite's execution actually reaches, as distinct from
black-box testing's question of whether the assertions on the paths it does
reach are the right ones. A suite can have excellent assertions and still
have this problem — the two questions are independent. "Coverage" already
has a precise, checkable meaning in that vocabulary (statement, branch,
condition coverage), and this skill reuses it rather than inventing a new
category: a `skipif`-guarded test, a default-off flag, or a permanent
monkeypatch each produce the same structural fact — a real code path exists
that the suite's own execution graph never touches, on any run, regardless
of what the tests that do run assert.

## The gap this closes

`test-assist`'s TA-230 ([`docs/TA-230.md`](../../../docs/TA-230.md)) is the
concrete case. `FloatingLauncher`'s `register_global_hotkeys` parameter
defaults to `False`, for a sound reason — the `True` path claims real,
process-wide OS state (`RegisterHotKey`) that concurrent tests would fight
over. That single flag cost real time three times in two days, in three
genuinely different ways:

1. **A coverage gap.** `_apply_hotkey_labels()` runs only when the flag is
   `True`. A launcher rebuild removed two widgets it referenced. The app
   died on startup with an `AttributeError` — while 350 tests stayed green,
   because every one of them avoided the only path that would have caught
   it.
2. **A cross-platform blind spot.** Three tests referencing the same removed
   attributes were `skipif`-guarded to Windows. Every run on a Mac reported
   green **by construction** — not because the code was fine, but because
   the only tests that could have failed never ran there. It surfaced on
   someone else's Windows machine, the worst place to find it.
3. **A foreign-holder collision.** A leftover `TestAssist.exe` from an
   unrelated manual check still held the real Win32 hotkeys mid-release,
   so the guarded tests' own `RegisterHotKey` calls failed for a reason
   that had nothing to do with the code change being gated. Not a defect —
   the OS call was behaving correctly — but the failure read as a
   regression, under time pressure, during a release.

None of the three announces itself in a green suite. Each needed someone to
go looking. This skill is that looking, generalized past this one flag.

## Inputs you need from the user

1. **Scope** — a repo, a directory, or a single file. Default to the whole
   repo but say what you covered.
2. **Where findings go** — a tracker, a backlog file, or "just print them."
   Never file into a tracker without being told which one.
3. **What is already known** — an existing backlog or open issues. A finding
   already recorded is not a finding.

## Output format

For each path found, report it as a path the suite cannot fail for — not as
a generic "consider adding a test":

```markdown
## Path
The guard, and exactly what it hides — file, line, condition.

## What runs it
Which tests, if any, execute this path at all, and under what conditions
(a specific CI job, a specific platform, an opt-in flag no default run
sets).

## What's unverified while it's skipped
The specific thing that could be wrong here and the suite would still
report green. Not "this might have bugs" — the actual shape of a defect
this gap would hide, if one exists.

## Consequence if it breaks silently
What a real break here looks like from the outside — a crash on startup,
a feature quietly absent, a security check that never ran.

## Provenance
Found by a find-the-hidden-platform audit on <date>, scope <what was
covered>.
```

Then a summary table, ranked by consequence, so the reader can triage
without opening each one — same discipline as `refactor-audit`'s.

## Rules

**Three signals to audit for, each a different mechanism for the same
structural fact:**

| Signal | What it hides | Ask |
|---|---|---|
| `skipif` (or equivalent) guard | A whole test, on some platforms/environments, all the time | Does *any* CI job or local run actually execute this test, or does every run this project has satisfy the skip condition? |
| Default-off flag gating real shared state | An entire code path, everywhere, unless something opts in | How many tests run with the flag flipped on? If it's a handful, whatever those tests assume about the machine they run on is now an assumption the whole path inherits silently. |
| A monkeypatch that permanently stands in for the thing under test | The real implementation, forever, in every run | Does *any* test in the suite ever exercise the real function this patches, anywhere — or does every path to it go through the substitute? |

**Distinguish this from `dont-stub-what-you-prove`.** That skill asks
whether a single test's assertion targets the same thing its own mock
replaces — a claim-correctness question, scoped to one test. This skill
asks whether the *real* implementation is ever executed by *anything* in
the suite, on any run — a reachability question, scoped to the whole test
suite's execution graph. A test can pass `dont-stub-what-you-prove`'s check
(its assertion targets something other than what it mocks) while the thing
it mocks is never exercised for real anywhere else either — that's this
skill's finding, not that one's.

**A default-off flag is a hazard independent of what it guards.** Even if
the `True` path is itself fully covered by the handful of tests that flip
it, the flag being off everywhere else means every *other* test's
assumptions about the machine — that this OS resource is free, that this
state is untouched — go unchecked by anything. Name that separately from
whether the guarded path itself has coverage.

**"Partly mitigated" is not "closed."** TA-230's own coverage and
cross-platform fixes existed on an unmerged branch for a period before
landing on `main` — a mitigation that hasn't shipped protects nothing yet.
State what's actually running against the default branch, not what exists
somewhere.

**Rank by what a silent break looks like, not by how obscure the guard
is.** A `skipif`-guarded test for a rarely-touched debug flag matters less
than a default-off flag gating the one code path a startup crash lives in.

**Name what you could not check.** Whether a guarded path actually gets
exercised in *any* real usage — production traffic, a manual QA pass,
another team's fork — isn't visible from reading the suite. Say so.

## Worked example

**Applying the three signals to the flag TA-230 itself is about**
(`register_global_hotkeys`, before its fixes landed):

```markdown
## Path
FloatingLauncher(register_global_hotkeys=True) — every function this flag
gates, including _apply_hotkey_labels() and the real RegisterHotKey/
UnregisterHotKey calls. The flag defaults to False; roughly 20+ tests
construct a launcher for unrelated reasons and never touch it.

## What runs it
A handful of TA-211 tests explicitly pass register_global_hotkeys=True.
Three of those are additionally skipif-guarded to Windows — so on any
non-Windows run, even that handful shrinks further, to whatever remains
unguarded.

## What's unverified while it's skipped
Every other test's assumption that constructing a launcher has no
side effect on real OS state goes unchecked outside the guarded handful.
Separately, on a non-Windows run, nothing at all exercises the Windows-only
subset — a regression there is invisible until it reaches a Windows
machine, which is exactly what happened (surfaced on someone else's
Windows machine, not caught locally).

## Consequence if it breaks silently
Demonstrated, not hypothetical: a removed-widget AttributeError crashed
the app on startup while 350 unrelated tests stayed green, because the
only path that would have called the missing method was the one every
test defaults away from.

## Provenance
find-the-hidden-platform audit (worked example), applying TA-230's own
findings (docs/TA-230.md) to its own subject rather than a new codebase.
Not measured here: whether this specific flag's mitigations (coverage for
the widget-existence check, a cross-platform-safe attribute scan) have
landed on the default branch at the time this audit runs — check docs/TA-230.md's
own closing note for the latest status.
```

**Summary table:**

| Finding | Consequence | Signal |
|---|---|---|
| `register_global_hotkeys=True` path | High — demonstrated startup crash, real | Default-off flag gating real shared state |
| The three Windows-only TA-211 tests | High — regression invisible off Windows until it reaches one | `skipif` guard |

## How to invoke this skill

> "Run find-the-hidden-platform over this repo — what paths can the suite never fail for?"

Or narrower, once a suspicious flag or guard is already spotted: "is this
`skipif`/default-off flag hiding anything real?"
