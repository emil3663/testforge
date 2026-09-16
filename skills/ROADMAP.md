# Skills roadmap

`skills/` is a growing set, not a single product with supporting material.
[`write-playwright-test`](testing/write-playwright-test/SKILL.md) is the
first entry because it was the one already isolated in the codebase — it is
not a flagship, and nothing below is positioned as secondary to it. Each
entry below is a candidate: recorded so the direction doesn't quietly
collapse into "one skill is the product" by default, not a commitment to
build it on any particular timeline. See
[`docs/decisions/phase-17-skills-extraction-backlog.md`](../docs/decisions/phase-17-skills-extraction-backlog.md)
and
[`docs/decisions/phase-18-skills-taxonomy-backlog.md`](../docs/decisions/phase-18-skills-taxonomy-backlog.md)
for the backlogs these came from, and `docs/REIMAGINING.md` for the source
proposal.

`skills/` is split into two categories, `skills/testing/` and
`skills/engineering/` — see [`README.md`](README.md) for what distinguishes
them.

## Testing judgment

Skills about what a test should cover and what it actually proves. Lives in
`skills/testing/`.

### `honest-coverage`

After writing tests, state plainly what they do **not** prove — not just
that they pass.

Generalizes: Emil's own prior writing in `DESKTOP_STABILITY_MATRIX.md` and
`cah-pwa/tests/README.md`, both of which already do this by hand for a
single project. The skill would produce a stability-matrix-shaped output —
every case rated, every limitation named — rather than a one-off document.

Status: not started.

### `dont-stub-what-you-prove`

A review skill. Reads a test and checks whether the thing being asserted is
the same thing being mocked.

Generalizes: TA-227, a defect Emil found and named in his own testing work —
a green test that proves nothing, because the assertion checks a stub
instead of the real dependency.

Status: not started.

### `find-the-hidden-platform`

Audits a repo for code paths that are structurally unreachable by its own
test suite — `skipif` guards, default-off flags, monkeypatches that replace
the thing under test — and reports them.

Generalizes: TA-230, which cost Emil time three times in two days,
including a suite that stayed green while the app died on startup.

Status: not started.

### `plan-to-specs`

Expands a `TEST_PLAN.md` into a spec tree mapped one-to-one onto case IDs,
with two-way drift detection via `--check` — reports real coverage (e.g.
"22 of 181 cases") and exits non-zero on drift between the plan and the
tree.

Generalizes: an existing tool, already built twice (`cah-pwa/scripts/` and
the `generator-improvements` branch). This is generalizing what exists, not
designing something new.

Status: not started.

## Engineering concerns

Skills about how code is structured and where it's likely to break, as
distinct from what a test covers. `skills/engineering/` is empty for now —
approved engineering-concern skills land there once TFP-039 reviews the
drafts below.

### `code-structure` and `refactor-audit`

Two drafts — deciding where new code goes before it's written, and auditing
an existing codebase for structural drift — are written and under
[`skills/proposed/`](proposed/), not yet in `skills/engineering/`.

Generalizes: `cah-pwa/skills/`'s own template, applied to a `useRun.ts`
review (442 lines, 18 `useState` calls in four unrelated groups).

Status: pending review (TFP-039) before promotion into `skills/engineering/`.

## Known gaps / open questions

- **`write-playwright-test` isn't auto-discovered by Claude Code's `Skill`
  tool from a bare top-level `skills/` folder.** Discovery expects
  `.claude/skills/` or a plugin manifest. Worth its own ticket later; not
  fixed as part of TFP-034 or this roadmap.
- **`introspect`/`crawl` (~1,300 lines of DOM exploration)** are flagged in
  `docs/REIMAGINING.md` as a genuine loss if the app is ever trimmed, with a
  suggestion to check whether Playwright MCP already covers that capability.
  That investigation is TFP-036, already ticketed — tracked there, not
  duplicated here.
