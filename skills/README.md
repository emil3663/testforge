# Skills

This directory holds Claude Code skills generalized from TestForge's own
testing and engineering judgment, plus material Martin proposed directly
(`code-structure`, `refactor-audit`) and one ported from a sibling repo
(`plan-to-specs`). It's split into two categories so the distinction stays
structural as more skills land, rather than flat and increasingly mixed —
see
[`docs/decisions/phase-18-skills-taxonomy-backlog.md`](../docs/decisions/phase-18-skills-taxonomy-backlog.md)
for why. Neither category has a flagship, and none of these are positioned
as secondary to another — see [`ROADMAP.md`](ROADMAP.md) for full detail on
what each one generalizes from and how it was verified.

As of Phase 20, all 11 skills discussed since `docs/REIMAGINING.md` first
raised the question are built. None are pure agent judgment with nothing to
check against: each names the real case it generalizes from, and most were
run against a real target before being called done.

## Testing judgment

Skills about what a test should cover and what it actually proves. Lives in
[`skills/testing/`](testing/).

- **[`write-playwright-test`](testing/write-playwright-test/SKILL.md)** —
  writes a Playwright suite for a described feature, judging which test
  categories (functional, responsive, accessibility, etc.) actually apply
  rather than generating one of everything. The floor skill: packages the
  coverage reasoning that was already isolated in
  `src/lib/generate/prompt.ts`.
- **[`honest-coverage`](testing/honest-coverage/SKILL.md)** — after writing
  or reviewing tests, states per test or per group what's actually proven
  and what remains unproven, with a Stable/Moderate/Blocked rating and real
  reasoning per case — not a generic disclaimer. Generalizes the rating
  scheme Emil was already doing by hand in `DESKTOP_STABILITY_MATRIX.md`.
- **[`dont-stub-what-you-prove`](testing/dont-stub-what-you-prove/SKILL.md)**
  — reads a test and flags when what's mocked is the same thing the
  assertion claims to verify. Generalizes TA-227, a real defect: a green
  test that proved nothing because its assertion checked a stub instead of
  the dependency it stood in for.
- **[`find-the-hidden-platform`](testing/find-the-hidden-platform/SKILL.md)**
  — audits for `skipif` guards, default-off flags, and monkeypatches that
  make a real code path structurally unreachable by the suite, on any run.
  Named explicitly as ISTQB's structural (white-box) testing. Generalizes
  TA-230, which cost real time three separate times in two days, including
  a suite that stayed green while the app crashed on startup.
- **[`plan-to-specs`](testing/plan-to-specs/SKILL.md)** — expands a
  `TEST_PLAN.md` into a spec tree mapped one-to-one onto case IDs, with a
  `--check` mode that reports real coverage ("18 of 181 cases", not a file
  count) and exits non-zero when the plan and the tree drift apart. Ported
  from Martin's own `generator-improvements` branch on `cah-pwa`
  (unmerged, commit `78e30de`, with Claude Opus 5) rather than rebuilt from
  scratch — that branch fixed a real bug that had hidden 17 implemented
  tests inside files a broken parser had named `.spec.js`.
- **[`regression-safety-net`](testing/regression-safety-net/SKILL.md)** —
  after a fix, separately confirms the originally-reported failure is gone
  (confirmation testing) and that nothing outside the intended change broke
  (regression testing). Generalizes ISTQB's change-related testing category
  directly — the one gap the ISTQB pass over this whole set turned up that
  wasn't already covered by something built or proposed.
- **[`failure-mode-tests`](testing/failure-mode-tests/SKILL.md)** — a
  sibling to `write-playwright-test` that writes dependency-timeout and
  partial-failure tests as a matter of course, not only when asked.
  Generalizes the Google SRE book, ch. 17 (Testing for Reliability).

## Engineering concerns

Skills about how code is structured and where it's likely to break, as
distinct from what a test covers. Lives in
[`skills/engineering/`](engineering/).

- **[`code-structure`](engineering/code-structure.md)** — judges where new
  code should go and whether a file is implementing rather than assembling,
  before it's written. Martin's proposal, calibrated against
  `src/app/page.tsx` and promoted after a real trial run — see
  [`CALIBRATION.md`](engineering/CALIBRATION.md).
- **[`refactor-audit`](engineering/refactor-audit.md)** — audits an
  existing codebase for structural drift against the same thresholds.
  Also Martin's proposal, trial-run against `src/app/_hooks/`
  (`useRun.ts`: 442 lines, 17 `useState` calls across four unrelated
  concerns) before promotion.
- **[`reliability-audit`](engineering/reliability-audit/SKILL.md)** —
  audits external calls for missing timeouts, retries without backoff, and
  unbounded queues. Generalizes the Google SRE book, ch. 21-22 (Handling
  Overload, Addressing Cascading Failures).
- **[`observability-check`](engineering/observability-check/SKILL.md)** —
  checks whether a feature has any way to tell, in production, that it's
  broken. Explicitly framed as `honest-coverage`'s sibling — same instinct,
  aimed at production instead of the test run. Generalizes the Google SRE
  book, ch. 6 (Monitoring Distributed Systems).

Release engineering (SRE ch. 8) was deliberately not added as a twelfth
candidate — it's already covered by the existing `verified-release-pipeline`
account skill, not duplicated here.

## Provenance, in one place

Every skill above traces to something real rather than a generic best
practice: five to Emil's own prior incidents and write-ups (TA-227, TA-230,
`DESKTOP_STABILITY_MATRIX.md`), two to Martin's own proposed drafts, one to
Martin's own unmerged branch on a sibling repo, three to named chapters of
the Google SRE book, and one directly to the ISTQB testing taxonomy. Full
citation and verification detail for each is in
[`ROADMAP.md`](ROADMAP.md) and the Phase 17-20 decision records under
[`docs/decisions/`](../docs/decisions/).

## Known gaps / open questions

- **`write-playwright-test` isn't auto-discovered by Claude Code's `Skill`
  tool from a bare top-level `skills/` folder.** Discovery expects
  `.claude/skills/` or a plugin manifest. Worth its own ticket; not fixed
  as part of this roadmap.
- **`introspect`/`crawl` (~1,300 lines of DOM exploration)** are flagged in
  `docs/REIMAGINING.md` as a genuine loss if the app is ever trimmed, with
  a suggestion to check whether Playwright MCP already covers that
  capability — tracked as TFP-036, not duplicated here.

## What's next

Phase 19's dogfooding (TFP-040/041/042) — running TestForge's actual app
and `write-playwright-test` directly against `test-assist`, and comparing
both to its existing hand-written suite — was deliberately blocked on this
set being real rather than aspirational. It resumes now.
