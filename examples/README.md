# examples/

Real output from actually using TestForge and its skills, not documentation
about what they'd produce. Per `docs/REIMAGINING.md`'s original proposal: "a
real suite built with them, warts recorded." Nothing in here is cleaned up
before showing - a failing test, a false positive, or a judgment call that
turned out wrong stays in, with a note explaining what happened.

## The pattern

```
examples/<category>/<skill-or-app>/<target>/
```

- **`<category>`** is `testforge-app/` (the full TestForge pipeline: crawl
  → introspect → generate → run, through the app itself) or `skills/` (one
  skill, applied directly, no app involved).
- **`<skill-or-app>`** is `testforge-app` itself, or the skill's own name
  exactly as it appears under `skills/testing/` or `skills/engineering/`
  (e.g. `write-playwright-test`, `code-structure`).
- **`<target>`** is the real external codebase or site the run was against
  - `test-assist` so far, since it's the browser-reachable target Phase 19
  chose deliberately (see `docs/decisions/phase-19-dogfooding-backlog.md`).

This repeats for every future skill against the same target, so results
stay comparable over time instead of each run inventing its own shape:

- `examples/testforge-app/test-assist/` - TFP-040, the full pipeline.
- `examples/skills/write-playwright-test/test-assist/` - TFP-041, the skill
  alone.
- `examples/skills/code-structure/test-assist/` - not yet run. `code-structure`
  judges where *new* code should go; it needs a real feature request against
  a codebase being actively extended, which `test-assist` (external,
  read-only per this phase's own scope) doesn't offer. Worth running against
  `testforge`'s own codebase instead, once there's a real feature to place -
  noted here so the gap isn't silently assumed closed.
- `examples/skills/refactor-audit/test-assist/` - not yet run, once promoted
  further than its current trial-only status; `test-assist`'s own codebase
  (Python desktop build, JS browser build) is a real, available target for
  it whenever it runs.
- `examples/skills/<sre-or-istqb-candidate>/test-assist/` - for any
  `skills/proposed/` candidate that gets promoted, same pattern, same target
  where the skill's own scope allows it (some, like `sre-release`, are
  about a *pipeline*, not a page - their target would be `test-assist`'s
  `.github/workflows/`, not its served instance, and the folder name should
  say so plainly when that run happens rather than forcing every skill into
  an identical shape it doesn't fit).

## What belongs in a `<target>/` folder

- The real output file(s) - a generated `.spec.ts`, a written-by-hand
  `.spec.ts`, a findings doc - saved as-is, not summarized.
- For anything that was actually run: the real report or output (a
  structured JSON report, a `playwright test` pass/fail count), not a
  description of what running it would show.
- A short notes file when the run surfaced something worth flagging - a
  false positive, a method deviation, a bug the run itself found (including
  in the test file the run was checking, if that's what happened - see
  `skills/write-playwright-test/test-assist/`'s own history for an example
  of catching and fixing two real bugs in a hand-authored suite before
  trusting its output).

## What this is not

Not a place for aspirational or hypothetical output - "here's what
`code-structure` would probably say" doesn't belong here. If a skill hasn't
actually been run against a real target yet, its folder doesn't exist yet
either; say so in this file (see the not-yet-run entries above) rather than
create an empty placeholder.
