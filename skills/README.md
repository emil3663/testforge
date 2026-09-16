# Skills

This directory holds Claude Code skills generalized from TestForge's own
testing and engineering judgment. It's split into two categories so the
distinction stays structural as more skills land, rather than flat and
increasingly mixed — see
[`docs/decisions/phase-18-skills-taxonomy-backlog.md`](../docs/decisions/phase-18-skills-taxonomy-backlog.md)
for why, and
[`docs/decisions/phase-17-skills-extraction-backlog.md`](../docs/decisions/phase-17-skills-extraction-backlog.md)
for where the first skill came from. Neither category has a flagship —
see [`ROADMAP.md`](ROADMAP.md) for the full candidate list.

## Testing judgment

Skills about what a test should cover and what it actually proves. Lives in
[`skills/testing/`](testing/), currently holding
[`write-playwright-test`](testing/write-playwright-test/SKILL.md), which
packages the best-practice coverage reasoning from
`src/lib/generate/prompt.ts` so it can be used directly inside a coding
agent's workflow without running the TestForge app.

## Engineering concerns

Skills about how code is structured and where it's likely to break, as
distinct from what a test covers. `skills/engineering/` is empty for now —
`code-structure` and `refactor-audit` stay under
[`skills/proposed/`](proposed/) until TFP-039 reviews them; approved
engineering-concern skills land in `skills/engineering/` once that happens.
