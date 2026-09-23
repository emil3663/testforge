# Phase 22 — introspect/crawl vs. Playwright MCP Spike

**Version:** 1.0
**Date:** 2026-09-16
**Status:** Spike run, real findings — TFP-036 ran the comparison this doc asked for (see skills/INTROSPECT_CRAWL_SPIKE.md), and crawl-and-classify-pages was built directly from it. One genuine gap remains, honestly flagged in skills/ROADMAP.md rather than hidden: the skill has never been run against a real connected browser-automation tool, only verified by reading code and Playwright MCP's documented tool list. This doc's header was never updated to reflect any of that. Corrected 2026-09-23 (Cowork verification pass).

## Context

`TFP-036` was ticketed in Phase 17 (`docs/decisions/phase-17-skills-extraction-backlog.md`)
and never actually run — it's been referenced as "tracked as TFP-036, not
duplicated here" in `skills/README.md` and `skills/ROADMAP.md` ever since,
without anyone doing the spike itself. This phase finally scopes and runs
it, keeping the same ticket ID since it's already cited by name in three
other documents — renumbering would just break those references for no
reason.

**The original stated rationale is now partly stale, worth correcting
rather than copying forward unchanged.** TFP-036 was framed as a
prerequisite for `find-the-hidden-platform`: "before any
find-the-hidden-platform-style skill gets built, confirm whether Playwright
MCP already provides equivalent capability." That skill is now built
(TFP-045) and turned out not to need DOM-exploration logic at all — it
audits `skipif` guards, default-off flags, and monkeypatches, which is a
different problem entirely. So that specific blocking relationship never
materialized, and this phase isn't gated on anything.

**What's still a real, open question:** `src/lib/introspect` and
`src/app/api/crawl/route.ts` are roughly 1,200-1,300 lines of real DOM-
exploration logic, sitting unduplicated and unverified against Playwright
MCP's own equivalent capability. `docs/REIMAGINING.md` flagged this as the
one genuine loss if TestForge's app is ever trimmed. This is also, right
now, unusually well-timed: Phase 19's TFP-040 is about to exercise this
exact code path for real — running TestForge's actual crawl → generate →
run pipeline against `test-assist`. Running this spike first (or at least
before TFP-040 is called done) means its findings can actually inform how
TFP-040's results get read, rather than sitting as a separate, disconnected
investigation.

## Scope (this phase)

### In scope
1. Exercise Playwright MCP's page-exploration/DOM-inspection tools against
   2-3 real pages, the same ones `src/lib/introspect` and
   `crawl/route.ts` already handle.
2. Record what overlaps, what Playwright MCP doesn't cover that
   TestForge's own code does (or vice versa), and state plainly whether a
   future skill needing DOM exploration could lean on Playwright MCP
   instead of reimplementing it.

### Out of scope
- Any change to `src/lib/introspect` or `crawl/route.ts` — spike only, no
  production code changes.
- Deciding to delete or replace TestForge's own introspect/crawl logic —
  this phase produces findings, not a migration.

## Backlog

### TFP-036 - Spike: does Playwright MCP already cover introspect/crawl?

- **Phase:** 22 (originally ticketed Phase 17, never executed)
- **Priority:** P2
- **Suggested labels:** `investigation`, `spike`
- **Problem it solves:** ~1,200-1,300 lines of real DOM-exploration logic
  sit unverified against a possibly-equivalent MCP capability, and
  `docs/REIMAGINING.md` already flagged this as the one loss worth
  checking before anything gets built or trimmed around it.
- **Scope:**
  - Pick 2-3 real pages that `src/lib/introspect`/`crawl/route.ts`
    currently handle — ideally including at least one from
    `test-assist`'s browser build, since that's also Phase 19's target
    and gives this spike a real, shared reference point.
  - Run Playwright MCP's own exploration/inspection tools against the
    same pages.
  - Compare directly: what does each surface (element discovery, DOM
    structure, interactive-element detection, accessibility tree, etc.),
    and what does one do that the other doesn't.
  - Write the comparison up with specifics — named capabilities, not
    "roughly similar."
- **Deliverables:**
  - Findings recorded in `skills/ROADMAP.md` (or linked from it, same as
    the original ticket specified) — supersedes the current placeholder
    reference.
- **Acceptance criteria:**
  - Findings state plainly, for the pages tested: does Playwright MCP
    fully cover what TestForge's own introspect/crawl logic does, partly,
    or not at all — and name the specific gap either way.
  - The `find-the-hidden-platform` prerequisite framing is corrected in
    `skills/ROADMAP.md`'s reference to this ticket, since that
    relationship turned out not to hold.
- **Dependencies:** None. Can run before, alongside, or independently of
  Phase 19 — recommended before TFP-040 is marked complete, since its
  findings are more useful read together with that ticket's real crawl
  output than separately.

## Recommended Execution Order

Single ticket. Suggested: run before or alongside TFP-040 rather than
after, so both pieces of evidence about the same code path land close
together.

## Suggested Milestone Gates

### Gate A - The one genuine loss REIMAGINING.md flagged is actually checked
- TFP-036 has real findings, not a still-open placeholder reference.
