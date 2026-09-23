# Phase 21 — Make the Skills Actually Discoverable

**Version:** 1.0
**Date:** 2026-09-16
**Status:** Shipped as TFP-051 — skills/.claude-plugin/plugin.json + a local marketplace + a committed .claude/settings.json make every skill under skills/testing/ and skills/engineering/ a real, auto-discovered Claude Code plugin skill, confirmed present on disk and described as fixed in skills/ROADMAP.md's own Known-gaps section. This doc's header was never updated when it landed. Corrected 2026-09-23 (Cowork verification pass).

## Context

`skills/ROADMAP.md`'s "Known gaps" section has flagged this since Phase
17 and it was never picked up: `write-playwright-test` (and now the other
ten) live under a bare top-level `skills/` directory, which Claude Code's
own skill-discovery mechanism does not scan. Every skill built across
Phases 17-20 is real, tested content — but none of it is actually
invocable as a Claude Code skill today. Right now "running a skill" in
this repo has meant a person or an agent manually opening the `SKILL.md`
file and following it, which works but isn't what any of this was built
for.

This matters concretely for Phase 19: TFP-041 asks Claude Code to run
`write-playwright-test` directly against `test-assist` "with no TestForge
app involved — skill judgment in isolation." If that only means "read the
file and follow it," the exercise doesn't actually test whether the skill
works the way `REIMAGINING.md` originally proposed using it — invoked, not
read.

**Findings, checked directly before drafting this** (Claude Code's own
documentation, not assumed):

- Claude Code auto-discovers skills from exactly two locations:
  `.claude/skills/<name>/SKILL.md` (project scope) and
  `~/.claude/skills/<name>/SKILL.md` (user scope). A bare top-level
  `skills/` folder is not one of them, confirming the gap as recorded.
- The supported way to expose a skills directory that lives somewhere
  else is a plugin manifest (`.claude-plugin/plugin.json`), which can
  declare a `"skills"` field pointing at a custom path rather than
  requiring the files to live at the plugin root.
- **Open question, not yet resolved:** whether a single plugin manifest's
  `"skills"` field accepts more than one path (needed here, since this
  repo deliberately splits `skills/testing/` from `skills/engineering/`
  per the Phase 18 taxonomy decision) — or whether that split means two
  plugins, or one plugin with two declared paths. Docs referenced didn't
  settle this; TFP-051 resolves it as its first step rather than guessing.
- Symlinking `.claude/skills/<name>` to files elsewhere in the repo is
  explicitly undocumented/unsupported — not the path to take, even though
  it would technically avoid restructuring anything.

## Scope (this phase)

### In scope
1. Make every skill under `skills/testing/` and `skills/engineering/`
   actually discoverable and invocable by Claude Code, without duplicating
   or moving the canonical files (the testing/engineering split stays;
   it was a deliberate Phase 18 decision).
2. Verify discovery for real — invoke at least one skill from each
   category via Claude Code's actual skill mechanism, not by manually
   reading the file.

### Out of scope
- Making the skills portable to other agents (Copilot, Cursor) — Emil's
  own answer to Martin's Q3 was Claude Code first, that question later.
- Any change to skill content — this is a discovery/packaging fix only.

## Backlog

### TFP-051 - Package skills/ as a discoverable Claude Code plugin

- **Phase:** 21
- **Priority:** P1
- **Suggested labels:** `tooling`, `skills`, `blocking-tfp-041`
- **Problem it solves:** every skill built since Phase 17 is real content
  that Claude Code cannot currently find or invoke on its own — the
  packaging step from `REIMAGINING.md`'s original proposal was never
  actually finished, only the content was.
- **Scope:**
  - First: read `https://code.claude.com/docs/en/plugins-reference.md`
    directly (not from this ticket's summary of it) to confirm whether
    a plugin manifest's `"skills"` field accepts multiple paths/an array,
    or only one. This decides the shape of what follows — don't guess.
  - If one manifest can declare both `skills/testing/` and
    `skills/engineering/`: create a single `.claude-plugin/plugin.json`
    at the repo root declaring both paths.
  - If not: either two manifests (one per category) or restructure the
    manifest's own `skills/` pointer to the parent `skills/` directory
    if Claude Code's scan is recursive by category subfolder — check
    which the docs actually support before picking.
  - Do not move or duplicate any `SKILL.md` file. The manifest points at
    the existing canonical locations.
  - Update `skills/README.md` with a one-line note on how the skills are
    now actually invoked (e.g. `/plugin-name:write-playwright-test`),
    since the current README doesn't mention invocation mechanics at all.
- **Acceptance criteria:**
  - From a Claude Code session in this repo, a skill from
    `skills/testing/` and a skill from `skills/engineering/` are both
    listed as available and successfully invoked through Claude Code's
    own skill-invocation path — not opened and followed manually. Paste
    the actual invocation and its output as evidence, not a description.
  - `skills/ROADMAP.md`'s "Known gaps" entry for this is removed (it's
    fixed, not still open).
- **Dependencies:** None.

## Recommended Execution Order

TFP-051 can run in parallel with TFP-040 (running the app doesn't depend
on skill discovery), but must finish before TFP-041 (which specifically
needs real invocation, not a manual read) starts.

## Suggested Milestone Gates

### Gate A - Skills are real Claude Code skills, not just files
- TFP-051 done and verified.
- TFP-041 can then proceed as actually specified, not as a workaround.
