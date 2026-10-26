---
name: code-structure
description: >
  Decide where new code goes — a new component, hook, page, or module — and
  whether a file is implementing rather than assembling, before writing it.
  Not a refactoring skill; it applies while code is being written, the only
  time the placement decision is still cheap. Use this skill when building
  a feature, adding a screen, or extending an existing module, especially
  once a file is approaching this skill's own thresholds.
---

# Skill: Code Structure

## What this skill is for

When the user asks you to build a feature, add a screen, or extend an
existing module, decide **where the code goes** before writing it — and say
so. This skill exists because structure is decided by default when nobody
decides it on purpose, and the default is always "add it to the file that is
already open."

It is not a refactoring skill. It applies while code is being written, which
is the only time the decision is cheap.

## Inputs you need from the user

Before writing code, make sure you have:

1. **What the feature does**, in a sentence.
2. **Which existing modules it touches** — if none, say so; a feature that
   touches nothing is usually a feature that has not been placed yet.
3. **Whether it needs state**, and if so, whose.

If the user has not said, ask. Do not infer placement from whichever file was
most recently discussed.

## Output format

Before the code, state the plan in three lines:

```
Files:     <new or changed, with line-count estimate for new ones>
Placement: <why each piece goes where it goes>
Seams:     <what can be tested without rendering the app>
```

Then write the code.

## Rules

**One reason to change.** A module should have a single reason to be edited.
A hook that fetches, transforms, tracks loading state and formats output has
four, and will be edited by four unrelated tickets.

**Fail independently.** A composable should be able to break without taking
its siblings with it. If a failure in one piece leaves the screen blank
rather than one section empty, the boundary is in the wrong place.

**Pages assemble, they do not implement.** A page or route should read as a
list of what is on it. If reading it requires understanding how something
works rather than what is present, the implementation belongs one level down.

**Prefer a testable seam to a tidy one.** The useful question is not "is this
file long?" but "can I test this without rendering the app?" A pure function
taking plain values is a seam. A component reaching into module state is not.

**In React and vanilla JS, the discipline is yours.** Angular and Vue enforce
structure; React and plain JS make it optional and will let a file grow
indefinitely without complaint. This is not a reason to avoid them — it is
the reason to state the convention explicitly, because the framework will not
state it for you.

**Extract on the second use, not the third.** The cost of extracting early is
a small indirection. The cost of extracting late is that two copies have
already diverged.

## Thresholds, and what they are for

These are conversation triggers, not limits. Crossing one means say something,
not refuse:

| | |
|---|---|
| Component over ~250 lines | name the sections; propose the split |
| Hook over ~150 lines, or more than 3 pieces of state | probably two hooks |
| Page or route over ~300 lines | check the split between composition and inline derived-state logic before calling it implementation |
| Any file over ~500 lines | stop and ask before adding to it |

**The number is not the point.** A 4,700-line file was never made in one
commit — it was made in three hundred commits that each added forty lines,
and at no point did anyone see something worth stopping for. The threshold
exists to make that moment visible while it is still small.

**Calibrated against `src/app/page.tsx`** (353 lines, TFP-039, 16 September
2026): the 300-line threshold fired, but the file turned out to be mostly
legitimate assembly — roughly 150 lines of JSX composing four already-
extracted section components, plus ~40 lines of imports and a static SEO
schema object. The real, extractable seam was smaller than the line count
implied: about 85 lines of inline derived-view-readiness logic
(`isContentAwareReady`, `runBlockedMessage`, the `busy*` fallbacks) that
could become one more pure function in `_lib/derive.ts`, alongside the
functions already extracted there. Raw line count doesn't distinguish
"assembling from extracted pieces" from "still implementing" — that's why
the row above asks for a check rather than asserting the conclusion
outright. Full calibration writeup, including the Files/Placement/Seams
treatment applied as if this were a real finding, is in
[`skills/engineering/CALIBRATION.md`](../CALIBRATION.md).

## Worked example

**Request:** "Add a section that shows discovered pages, with a refresh
button."

**Bad:** the section's markup, its fetch, its loading state and its error
handling all go into the page component, because that is where the other
sections already are. The page grows by 200 lines. Nothing is testable
without rendering the whole app. When the fetch needs a retry, the page is
edited.

**Good:**

```
Files:     _components/DiscoveredPagesSection.tsx  (~80)
           _hooks/useDiscoveredPages.ts            (~60)
           lib/discovery/parse-pages.ts            (~40)
Placement: the page gains one line. Fetch and state live in the hook so the
           section renders from props. Parsing is pure, so it is testable
           with plain values and no DOM.
Seams:     parse-pages.ts — unit-testable directly
           useDiscoveredPages — testable with a stubbed fetch
```

The section can now fail on its own: a discovery error empties one panel
rather than blanking the page.

## The early-warning point

A composable that is hard to test in isolation is telling you it is coupled —
and it tells you at 200 lines, not at 4,000. That signal is the cheapest
structural review available, and it arrives without anyone having to remember
to look.

So when this skill proposes a seam, propose the test with it. A seam nobody
tests is a boundary that will quietly stop being one.

## How to invoke this skill

> "Use the code-structure skill — where should this go?"

Or implicitly: any request to add a feature to a file already over the
thresholds above should trigger the three-line plan before code.
