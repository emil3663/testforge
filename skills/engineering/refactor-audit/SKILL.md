---
name: refactor-audit
description: >
  Read a codebase, find where structure has drifted, and file each finding
  as an issue someone can pick up cold — one issue per seam, with the
  measurement that justifies it. Does not refactor anything; finding and
  fixing are separate jobs. Pairs with code-structure: that one prevents
  drift while code is being written, this one catches what got past it.
  Use this skill when auditing an existing repo, directory, or file for
  structural drift, not while code is actively being written.
---

# Skill: Refactor Audit

## What this skill is for

Read a codebase, find the places where structure has drifted, and **file them
as issues somebody can pick up cold** — one issue per seam, with the
measurement that justifies it.

It does not refactor anything. Finding and fixing are separate jobs, and
separating them is what lets the finding be argued with before the code moves.

Pairs with the `code-structure` skill: that one prevents drift while code is
being written, this one catches what got past it.

## Inputs you need from the user

1. **Scope** — a repo, a directory, or a single file. Default to the whole
   repo but say what you covered.
2. **Where issues go** — a tracker, a backlog file, or "just print them".
   Never file into a tracker without being told which one.
3. **What is already known** — the existing backlog and open issues. A finding
   already recorded is not a finding.

## Output format

One issue per finding, in the repo's own brief shape
([`docs/WORKING_AGREEMENTS.md`](../../../docs/WORKING_AGREEMENTS.md)):

```markdown
## Context
The measurement that justifies this, with file and line references.

## Change
The seam proposed, and what each piece becomes.

## Acceptance
What must be true afterwards — including what must NOT change.

## Not in this issue
Explicit exclusions.

## Provenance
Found by a refactor audit on <date>, scope <what was covered>.
```

Then a summary table, ranked by consequence, so the reader can triage without
opening each one.

## Rules

**Measure, do not assert.** "This file is large" is not a finding. "442 lines
holding 18 `useState` calls that fall into four groups, of which one appears
six times" is. Every issue opens with a number that can be checked.

**One seam per issue.** An issue proposing four extractions cannot be
half-accepted, and will sit unactioned because it is too big to start.

**Rank by consequence, not size.** A 200-line module where a failure blanks
the screen matters more than a 900-line one that only ever grows at the
bottom. Ask what breaks, not what is longest.

**Name what you could not check.** Static reading cannot tell you what is hot,
what users touch, or what is about to be deleted. Say so, in the issue.

**Never file churn.** Renaming for taste, reformatting, restructuring that
crosses a public interface without saying so — these cost review time and
return nothing.

**Do not file what is already known.** Read the backlog first. A finding
already tracked is a duplicate, and duplicates make a tracker unusable faster
than gaps do.

**Propose the test with the seam.** A seam nobody tests stops being one. If
the extraction cannot be tested more easily than the original, say why it is
still worth doing — or drop it.

## What to look for

A starter set. Add to it as the codebase teaches you more.

| Signal | Why it matters | Likely seam |
|---|---|---|
| Same 3–10 lines written three or more times | already diverging, or about to | a named helper |
| A hook or module with unrelated groups of state | four tickets will edit one file | split by group |
| A page or route that implements rather than assembles | reading it requires understanding, not scanning | lift the implementation down |
| A failure that blanks a whole screen | boundary is in the wrong place | isolate the failing piece |
| A module nothing can test without rendering the app | no seam exists yet | extract the pure part |
| A file only ever appended to | no one is reading it, only adding | split by section |
| A conditional guard around a whole path | that path is untested wherever the guard is true | make the logic reachable |

## Worked example

**Finding:** `src/app/_hooks/useRun.ts` — 442 lines, 18 `useState`.

```markdown
## Context
442 lines holding 18 useState calls in four unrelated groups: run execution
(activeRunId, runProgress, runStatus, runDurationMs, isCancellingRun,
result), report viewing (activeTab, statusFilter, selectedSeoPageKey,
isReportCollapsed, openReportInNewPage), transient button labels
(rawOutputCopyLabel, rawOutputExportLabel, htmlReportExportLabel) and rerun
selection (selectedFailedRerunTitles).

The button-label group is the same set-then-revert pattern written six times:

    setRawOutputCopyLabel("Raw output copied");
    setTimeout(() => setRawOutputCopyLabel("Copy raw output"), 2000);

Consequence: a change to how report tabs behave edits the same file as run
polling, and an error thrown while rendering the report takes the run state
with it.

## Change
Extract useTransientLabel(initial) — roughly 15 lines, returns a label and a
flash(text) that reverts after a timeout. Three call sites collapse onto it.

## Acceptance
- The three labels behave identically, including the failure variants.
- useTransientLabel is unit-tested with fake timers and no DOM.
- useRun.ts loses the setTimeout blocks and nothing else changes.

## Not in this issue
Splitting execution from report viewing — a larger seam, filed separately.
No change to run polling, cancellation, or the report itself.

## Provenance
Refactor audit, 16 September 2026, scope src/. Found by the repeated-pattern
signal. Not measured: how often these buttons are used.
```

## Growing this skill

When a finding turns out to be wrong, or a signal keeps producing noise,
**edit this file** rather than remembering the exception:

- A signal that produced a rejected issue gets a caveat added to its row.
- A seam found by hand that no signal caught gets a new row.
- A threshold that fired too early gets moved, with the reason recorded.

The table above is a starter set from one afternoon on one codebase. It is
expected to be wrong in places, and it is more useful edited than admired.

**Correction found during the first real trial (TFP-039, `src/app/_hooks/`,
16 September 2026):** the worked example above undercounted its own finding.
`useRun.ts` has 17 `useState` calls, not 18, and the four listed groups only
account for 15 of them — `reportPopupNotice` and `isBusyTargetListExpanded`
were left uncategorized. The set-then-revert button-label pattern it
describes also exists in `useGeneration.ts` (`copyLabel`, `saveLabel`) — 5
call sites across 2 files, not 3 in 1 file. Full audit output, including
this correction and the finding it was superseded by, is in
[`skills/engineering/CALIBRATION.md`](../CALIBRATION.md).

## How Emil invokes this skill

> "Run a refactor audit over `src/` and file the findings."

Or narrower, which is usually better on a first run:

> "Refactor audit on `_hooks/` only — print the issues, do not file them."
