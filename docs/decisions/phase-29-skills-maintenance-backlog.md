# Phase 29 — Skills Maintenance: Close the `crawl-and-classify-pages` Gaps

**Version:** 1.0
**Date:** 2026-09-24
**Status:** Draft — for review, not yet started

## Context

`skills/ROADMAP.md`'s own entry for `crawl-and-classify-pages` already
states its status honestly: "built, unverified live" — the skill has never
been driven against a real connected browser-automation tool, and that's
flagged in the doc, not hidden. This phase formalizes that already-known
caveat into an actionable ticket (TFP-102) rather than leaving it as a
status line nobody is assigned to close.

The second finding is new, not previously flagged anywhere in the repo:
the skill was built by directly reproducing
`src/lib/introspect/dom-snapshot.ts`'s classification logic at a point in
time (per `skills/ROADMAP.md`'s own "Generalizes" note). That file has
since picked up four real commits the skill never absorbed:

- `43718aa` — TFP-053, per-element visibility capture
- `d892f66` — TFP-055, ARIA state and toggle-group membership
- `47446c5` — TFP-061, drag-and-drop target detection (a 68-line addition)
- `58f55c3` — generic storage-entry-point failure injection (Phase 18)

None of this appears in `skills/ROADMAP.md`'s Known Gaps section or the
skill's own `SKILL.md` — confirmed by direct grep against both files on
2026-09-24. The skill's classification output no longer matches what
TestForge's own introspection actually reports for the same page,
silently.

## Scope

### In scope
1. Diff `dom-snapshot.ts`'s current classification logic against
   `skills/testing/crawl-and-classify-pages/SKILL.md`'s Step B algorithm;
   port the four gaps above into the skill's worked-through rules.
2. Add a "last synced against commit X" marker to the skill so future
   drift is visible without another full audit.
3. Formalize the already-flagged live-verification gap into a real ticket
   with a named target and a worked example, closing the "unverified
   live" status line in `skills/ROADMAP.md`.

### Out of scope
- Any change to `dom-snapshot.ts` itself — this phase brings the skill's
  documentation up to date with the code, not the other way around.
- The other 11 skills — this phase is scoped to the one skill with a
  confirmed, dated drift gap.

## Backlog

Ticket numbers continue from Phase 21's above (TFP-098–100) — confirm
against the live backlog before filing.

### TFP-101 — Sync `crawl-and-classify-pages` with `dom-snapshot.ts`'s drift

- **Phase:** 29
- **Priority:** P2
- **Suggested labels:** `skills`, `maintenance`
- **Problem it solves:** see Context above — four real commits' worth of
  classification logic the skill doesn't reflect.
- **Scope:**
  - Port ARIA state/toggle-group handling, drag-and-drop target detection,
    the Phase 18 storage-entry-point tweak, and confirm the skill's
    existing generic visibility check actually matches TFP-053's real
    capture behavior.
  - Add the sync-marker line described above.
- **Deliverables:** Updated `SKILL.md`.
- **Acceptance criteria:** Running the skill's classification steps
  against a page containing a toggle-group, a drag-and-drop element, and
  an ARIA-state-driven control produces the same classification
  TestForge's own introspect endpoint reports for that page.
- **Dependencies:** None.

### TFP-102 — Validate `crawl-and-classify-pages` against a live browser tool

- **Phase:** 29
- **Priority:** P2
- **Suggested labels:** `skills`, `verification`
- **Problem it solves:** closes `skills/ROADMAP.md`'s own "unverified
  live" status line with a real run instead of leaving it open
  indefinitely.
- **Scope:**
  - Pick a small multi-page target already used elsewhere for dogfooding
    (`cah-pwa` or `the-internet.herokuapp.com`, per Phase 17/19
    precedent) for consistency with existing verified runs.
  - Drive the skill's Step A/B loop with a real connected browser tool and
    record the output; fix the skill's own text wherever the live tool's
    behavior doesn't match the description.
- **Deliverables:** A worked-example record (page list, one page's full
  classification); corrections folded into `SKILL.md`; `skills/ROADMAP.md`'s
  status line updated from "unverified live" to the real result.
- **Acceptance criteria:** A named target produces a page list and
  per-page classification via the skill's actual documented steps, run
  for real.
- **Dependencies:** A connected browser-automation tool available in
  whatever session runs this ticket.

## Recommended Execution Order
1. TFP-101 (no dependencies, start anytime)
2. TFP-102 (independent of TFP-101, but doing 101 first means 102
   validates the corrected version rather than the stale one)

## Suggested Milestone Gate

### Gate — Phase 29 complete
- TFP-101 lands with a real before/after classification comparison;
  TFP-102 lands with a real live-tool run; `skills/ROADMAP.md`'s
  crawl-and-classify-pages entry updated to reflect both.
