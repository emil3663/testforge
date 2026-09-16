# Engineering concerns

Skills about how code is structured and where it's likely to break, as
distinct from what a test covers (see [`skills/testing/`](../testing/) for
that category). Two skills, promoted here from `skills/proposed/` by TFP-039
after a real trial run — see
[`CALIBRATION.md`](CALIBRATION.md) for the full output that decision was
based on.

| | What it does | When it runs |
|---|---|---|
| [`code-structure.md`](code-structure.md) | decides where new code goes, before it is written | while building |
| [`refactor-audit.md`](refactor-audit.md) | finds drift and files it as issues | after the fact |

They are a pair. The first prevents; the second catches what got past it.

## Where they came from

A conversation about `useRun.ts` — 442 lines holding 17 `useState` calls in
four unrelated groups, one of which (a set-label-then-revert-after-2s pattern)
is written three times in that file.

The observation that prompted both: **the monolith was useful.** Those four
groups were discovered by letting the hook grow until they were visible.
Splitting it earlier would have put the boundary in the wrong place, and
nobody would have guessed `useTransientLabel` up front. The seams were found,
not designed.

That is why `code-structure` frames its thresholds as conversation triggers
rather than limits — the point is to notice at 250 lines rather than 4,700,
not to forbid the file from growing.

## What to be sceptical about, and what the trial changed

- **The thresholds are judgements, not facts.** 250 lines for a component is
  a guess calibrated on one codebase in one language. TFP-039's calibration
  against `src/app/page.tsx` found the ~300-line page/route threshold
  overclaimed — see `CALIBRATION.md` — and the rule's wording was adjusted as
  a result, not left as-is.
- **The signal table in `refactor-audit` is one afternoon's work.** It will
  produce false positives and miss things. It is more useful edited than
  admired — there is a section in that file about how to grow it. The trial
  run already used that mechanism once, to correct the file's own worked
  example.
- **Both have now been run once, not "in anger."** TFP-039 ran
  `code-structure`'s thresholds against one already-reviewed file and
  `refactor-audit` against one directory, printed rather than filed. That's
  a real trial, not a rubber stamp, but it's still a sample size of one
  codebase and one afternoon — treat early findings from either skill with
  the same scepticism the trial applied to them.
- **Format follows `cah-pwa/skills/`** — *What this skill is for*, *Inputs you
  need from the user*, *Output format*, *Rules*, *Worked example*, *How Emil
  invokes this skill* — because that convention is already yours and worth
  keeping consistent.
