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

Built as [`skills/testing/honest-coverage/SKILL.md`](testing/honest-coverage/SKILL.md)
by TFP-043, porting the Stable/Moderate/Blocked scheme and real excerpted
rows from `DESKTOP_STABILITY_MATRIX.md` plus `cah-pwa/tests/README.md`'s
"a reviewer who counts spec files" framing.

Status: built.

### `dont-stub-what-you-prove`

A review skill. Reads a test and checks whether the thing being asserted is
the same thing being mocked.

Generalizes: TA-227, a defect Emil found and named in his own testing work —
a green test that proves nothing, because the assertion checks a stub
instead of the real dependency.

Built as [`skills/testing/dont-stub-what-you-prove/SKILL.md`](testing/dont-stub-what-you-prove/SKILL.md)
by TFP-044, porting TA-227's `_start_capture` example verbatim from
`test-assist/docs/ta227-228-e2e-testing-brief.md`.

Status: built.

### `find-the-hidden-platform`

Audits a repo for code paths that are structurally unreachable by its own
test suite — `skipif` guards, default-off flags, monkeypatches that replace
the thing under test — and reports them.

Generalizes: TA-230, which cost Emil time three times in two days,
including a suite that stayed green while the app died on startup.

Built as [`skills/testing/find-the-hidden-platform/SKILL.md`](testing/find-the-hidden-platform/SKILL.md)
by TFP-045, from a full extraction of TA-230 into
[`docs/TA-230.md`](../docs/TA-230.md). States explicitly, in its own text,
that this is ISTQB's structural (white-box) testing category — code
coverage of unreached paths — rather than leaving the connection implicit.

Status: built.

### `plan-to-specs`

Expands a `TEST_PLAN.md` into a spec tree mapped one-to-one onto case IDs,
with two-way drift detection via `--check` — reports real coverage (e.g.
"22 of 181 cases") and exits non-zero on drift between the plan and the
tree.

Generalizes: an existing tool, already built twice (`cah-pwa/scripts/` and
the `generator-improvements` branch). This is generalizing what exists, not
designing something new.

Built as [`skills/testing/plan-to-specs/SKILL.md`](testing/plan-to-specs/SKILL.md)
by TFP-046, porting `generator-improvements` (cah-pwa, commit `78e30de`,
Martin Hugo + Claude Opus 5) rather than rebuilding from a description —
generalized past that branch's hardcoded `cah-pwa` paths and case-ID scheme
so it runs against any repo's `TEST_PLAN.md`. Verified against `cah-pwa`'s
own real plan and spec tree: reports real coverage ("18 of 181"), and
correctly catches a deleted spec file on `--check`, exiting non-zero.

Status: built.

### `regression-safety-net`

After a fix, confirm the originally-reported failure is actually gone
(confirmation testing); separately, confirm the change didn't break
anything outside what it was meant to touch (regression testing).

Generalizes: ISTQB's change-related testing. Unlike the four candidates
above, not generalized from any of Emil's own prior work — a fresh
candidate, so there's no cross-repo material to port.

Built as [`skills/testing/regression-safety-net/SKILL.md`](testing/regression-safety-net/SKILL.md)
by TFP-047, keeping confirmation and regression as two separately-testable
checks rather than one blended verdict, per its own acceptance criteria.

Status: built.

## Engineering concerns

Skills about how code is structured and where it's likely to break, as
distinct from what a test covers. Lives in `skills/engineering/`, holding
`code-structure` and `refactor-audit` (below) since TFP-039.

### `code-structure` and `refactor-audit`

Deciding where new code goes before it's written, and auditing an existing
codebase for structural drift. Promoted into
[`skills/engineering/`](engineering/) by TFP-039, after `code-structure`'s
thresholds were calibrated against `src/app/page.tsx` and `refactor-audit`
was trial-run against `src/app/_hooks/` (printed, not filed). Full output:
[`skills/engineering/CALIBRATION.md`](engineering/CALIBRATION.md).

Generalizes: `cah-pwa/skills/`'s own template, applied to a `useRun.ts`
review (442 lines, 17 `useState` calls in four unrelated groups).

Status: shipped.

### `reliability-audit`

Audits external calls for missing timeouts, retries without backoff, and
unbounded queues — "what happens when this dependency is slow or down."

Generalizes: the Google SRE book, ch. 21-22 (Handling Overload, Addressing
Cascading Failures).

Built as [`skills/engineering/reliability-audit/SKILL.md`](engineering/reliability-audit/SKILL.md)
by TFP-048, following `refactor-audit`'s own issue-template convention
(`docs/WORKING_AGREEMENTS.md`'s brief shape) for consistency, with a
three-signal table (missing timeout, retry without backoff, unbounded queue)
in place of `refactor-audit`'s structural-drift signals.

Status: built.

### `failure-mode-tests`

A sibling to `write-playwright-test` that covers dependency-timeout and
partial-failure scenarios as a matter of course, not only when the user
happens to mention them.

Generalizes: the Google SRE book, ch. 17 (Testing for Reliability).

Built as [`skills/testing/failure-mode-tests/SKILL.md`](testing/failure-mode-tests/SKILL.md)
by TFP-049, verified against `write-playwright-test`'s own login-page worked
example: proposes timeout, connection-abort, and malformed-response tests
that output doesn't cover.

Status: built.

### `observability-check`

Checks whether a feature under test has any way to tell, in production,
that it's broken — extends `honest-coverage`'s "what a green run doesn't
prove" into "and would anyone notice."

Generalizes: the Google SRE book, ch. 6 (Monitoring Distributed Systems).

Built as [`skills/engineering/observability-check/SKILL.md`](engineering/observability-check/SKILL.md)
by TFP-050, cross-referencing `honest-coverage` directly as its sibling —
same instinct, aimed at production rather than the test run — rather than
sharing the theme by coincidence.

Status: built.

Release engineering (SRE ch. 8) is deliberately not proposed as a new
candidate here — it's already covered by the existing
`verified-release-pipeline` account skill.

## Known gaps / open questions

- **All 11 skills are now real Claude Code plugin skills, not just files.**
  Fixed by TFP-051: a plugin manifest (`skills/.claude-plugin/plugin.json`)
  declares both `skills/testing/` and `skills/engineering/` via the
  `skills` field's array support, registered through a local marketplace
  (`.claude-plugin/marketplace.json`) and a committed
  `.claude/settings.json` (`extraKnownMarketplaces` + `enabledPlugins`) so
  every trusted collaborator gets it, no manual install step. Not a
  restructure of `skills/`'s own testing/engineering split — the canonical
  files stayed where Phase 18 put them (two flat files,
  `code-structure.md`/`refactor-audit.md`, did need moving into
  `<name>/SKILL.md` form with real frontmatter, since that exact shape is
  what Claude Code's plugin scanner requires — a fix the ticket didn't
  originally anticipate, found by reading the reference doc rather than
  assuming the existing layout already qualified). See
  [`skills/README.md`](README.md) for the actual invocation syntax.
- **`introspect`/`crawl` (~1,200-1,300 lines of DOM exploration) does not
  duplicate Playwright MCP — spiked, not still an open placeholder.**
  TFP-036 (Phase 22) ran the comparison `docs/REIMAGINING.md` asked for:
  `crawl/route.ts`'s BFS same-origin crawl has no equivalent anywhere in
  Playwright MCP's real, published 73-tool list — `browser_navigate` is
  explicitly single-page, and no tool follows links automatically.
  `dom-snapshot.ts`'s element-role/name discovery has a real, arguably
  better partial equivalent in `browser_snapshot`'s accessibility-tree
  read, but its actual value — testing-semantic classification (interaction
  category, expected HTTP status, `requiresAuth`, embedded-resource kind,
  link-type, container labeling) — has no equivalent at all, since a
  general-purpose browser-automation surface has no reason to make those
  judgments. **Not covered, on both halves, not a close call.** Method
  caveat, stated plainly: no live browser-automation tool was available in
  the session that ran this spike, so the comparison is built from a full
  read of TestForge's own code plus Playwright MCP's real tool
  documentation (fetched directly, all 73 tools), not a live run against
  the two originally-intended target pages. Full comparison, including the
  per-tool breakdown: [`skills/INTROSPECT_CRAWL_SPIKE.md`](INTROSPECT_CRAWL_SPIKE.md).
