# Proposed skills — for review, not for use

Two drafts, written after the `REIMAGINING.md` exchange. **Neither is Phase 17
work.**

Phase 17 scopes the other skills as *"candidates only in this phase"*, and
these arrived after that was written — so they are placed here rather than in
`skills/`, to avoid quietly widening a boundary that was set on purpose. If
they are worth keeping they belong on TFP-035's candidate list; if not, this
directory deletes cleanly.

| | What it does | When it runs |
|---|---|---|
| `code-structure.md` | decides where new code goes, before it is written | while building |
| `refactor-audit.md` | finds drift and files it as issues | after the fact |

They are a pair. The first prevents; the second catches what got past it.

## Where they came from

A conversation about `useRun.ts` — 442 lines holding 18 `useState` calls in
four unrelated groups, one of which (a set-label-then-revert-after-2s pattern)
is written six times.

The observation that prompted both: **the monolith was useful.** Those four
groups were discovered by letting the hook grow until they were visible.
Splitting it earlier would have put the boundary in the wrong place, and
nobody would have guessed `useTransientLabel` up front. The seams were found,
not designed.

That is why `code-structure` frames its thresholds as conversation triggers
rather than limits — the point is to notice at 250 lines rather than 4,700,
not to forbid the file from growing.

## What to be sceptical about

- **The thresholds are judgements, not facts.** 250 lines for a component is
  a guess calibrated on one codebase in one language.
- **The signal table in `refactor-audit` is one afternoon's work.** It will
  produce false positives and miss things. It is more useful edited than
  admired — there is a section in that file about how to grow it.
- **Neither has been run in anger.** They have been written against this
  repository and reasoned about; they have not yet found anything nobody
  already knew.
- **Format follows `cah-pwa/skills/`** — *What this skill is for*, *Inputs you
  need from the user*, *Output format*, *Rules*, *Worked example*, *How Emil
  invokes this skill* — because that convention is already yours and worth
  keeping consistent.

## A suggested first run

Narrow, and printing rather than filing, so the output can be judged before it
becomes a dozen issues:

> "Refactor audit on `src/app/_hooks/` only — print the issues, do not file
> them."
