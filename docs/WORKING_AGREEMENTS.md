# Working agreements

How work gets tracked and landed, for **both** builds.

`CONTRIBUTING.md` covers setting up and running the browser build — start
there if you are picking up front-end work. This document is the other
half: where work is written down before it is built, and how a change gets
from an idea to `main`.

Nothing here replaces `TEST_PLAN.md`, which remains the source for the
label set and board columns (§6), or `TESTASSIST_BACKLOG.md`, which remains
the desktop build's design record.

---

## The loop

```
issue  ->  branch  ->  PR  ->  merge closes the issue
```

`CONTRIBUTING.md` already says to work on a branch and open a PR rather
than pushing to `main`, and says why: `main` **is** the deployed browser
app, and the live URL is on a CV and in a sent cover letter. This adds the
two ends of that.

### It starts as an issue

Not as a branch, and not as a commit. The issue is where the reasoning
lives; the commit is only where the change lives.

Write it so someone can pick it up **cold** — another contributor, a coding
agent, or you in three weeks — without asking a question first. That is
already the standard `TESTASSIST_BACKLOG.md` meets; this just puts it
somewhere that can be assigned, linked from a commit, and closed by a
merge.

If you cannot write the Acceptance section, the work is not understood well
enough to start.

### It ends with a trailer

Every commit message ends with one:

| Trailer | Meaning |
|---|---|
| `Closes #N` | this commit completes the issue |
| `Refs #N` | progress on it, not done |

GitHub closes the issue when the PR merges. That is the mechanism that
stops what happened to #1 — a report left open while the fix for it was
designed, built, released and verified, because nothing connected the two.

Commit subjects follow [Conventional Commits](CONVENTIONAL_COMMITS.md).

---

## The brief shape

Every issue body, in this order:

```markdown
## Context
Why this exists, with the MEASURED evidence that justified it — numbers,
counts, timings, a reproduction. Not "this feels slow": "this adds 195 ms
to every launch, measured".

## Change
What and where. Files and symbols with line references. The shape of the
fix, and what existing pattern it should mirror.

## Acceptance
Verifiable statements, not intentions. Exact commands. What must be true
afterwards — including what must NOT change.

## Not in this issue
Explicit exclusions. Anything deferred and why. Sibling issues it depends
on or unblocks.

## Provenance
How this was found.
```

**Context and Acceptance are the two that earn their keep.** Context is
what lets someone disagree with the premise before code is written.
Acceptance is what makes "done" a fact rather than an opinion.

`Not in this issue` looks like ceremony and is not: most scope creep is not
a decision, it is the absence of one.

### On measured evidence

"The capture looks soft on a Mac" is a hunch. This is evidence:

> selection 400x300 logical px, screen ratio 2.0, grabbed pixmap 800x600
> (480,000 px), composited result 400x300 (120,000 px) — 4x the captured
> data discarded.

The second can be argued with, tested, and closed. The first cannot. That
matters more than usual here, because the tool exists to make *other*
people's defect reports evidence-based; the repo should meet the bar it
sells.

---

## `TA-NNN` and issue numbers

Both records stay, with distinct jobs:

| | `TESTASSIST_BACKLOG.md` | GitHub Issues |
|---|---|---|
| Holds | the design record, and the reasoning at the time | the live work queue |
| Good at | sequencing, phases, dependencies, narrative | assignment, linking, closing, visibility |
| Audience | whoever is planning | whoever is doing, including outside contributors |

A `TA-NNN` that becomes active work gets an issue, and the issue title
carries the identifier:

```
TA-229 — Capture on a HiDPI display discards 3/4 of the pixels it grabbed
```

so the two read together instead of competing. Work found outside the
backlog — a bug report, something noticed in passing — starts as an issue
and only earns a `TA-NNN` if it needs design work first.

The backlog is not being migrated wholesale. Most of its tickets are closed
or superseded, and bulk-importing them would bury the live ones.

---

## Two things already learned here

Both cost real time in this repo, and both are easy to walk into again.

**A test must not stub the thing it is supposed to prove.** TA-227 exists
because two dispatch tests stubbed the dispatch. A green test that proves
nothing is worse than no test, because it also removes the suspicion that
would have led someone to look.

**A `skipif` guard hides a platform; it does not cover it.** The Win32
hotkey tests are correctly guarded to Windows, which means every other
platform runs a suite that cannot fail for them. The same is true of any
path a suite deliberately avoids: `_apply_hotkey_labels()` runs only when
`register_global_hotkeys=True`, which the suite skips because it claims
real OS state — so a refactor removed two buttons it referenced, 350 tests
stayed green, and the app died on startup. Where logic can be exercised
without the real resource, exercise it that way as well.

**A default-off flag guarding real OS state is a coverage hazard on its
own, separate from what it guards.** `register_global_hotkeys` defaults to
`False` for a sound reason — `RegisterHotKey` claims process-wide state
concurrent tests would fight over — but that same reason means the `True`
path is exercised by a handful of tests, no more, and whatever those tests
assume about the machine they run on becomes an assumption the whole path
inherits silently. TA-230 cost real time three separate ways from this one
flag before the hazard was named: a coverage gap (dead code only the
`True` path reaches), a cross-platform blind spot (a `skipif`-guarded test
rotting unseen off Windows), and a foreign-holder collision (a leftover
`TestAssist.exe` already holding a hotkey, read as a code regression
during a release gate until someone diagnosed it under time pressure).
None of the three announces itself in a green suite — each needed someone
to go looking. Any other default-off flag guarding a real, shared resource
(a port, a file lock, a registered protocol handler) is worth the same
question: what does the suite assume is true about the machine while that
path is skipped, and does anything check the assumption before trusting
its result.
