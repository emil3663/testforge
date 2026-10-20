# R6 — The Skills Relook

Date: 2026-10-20
Scope: R6 of `post-phase-42-review-plan.md`:
- read every skill against what Phases 38 to 46 and the review changed;
- decide for each whether it is kept, updated, adopted or retired;
- settle the register's D12 (the crawl skill's drift) and D20 (skills at
  run time, and proving the skills).

Status: **Decided with Emil (2026-10-20).**
- Tickets TFP-236 to TFP-239.
- They are built with R4, after Phase 39 or between its gates.
- The proposals for Emil's own account skills are made separately (the
  review card).

## Are the skills still active?

| Set | Where it lives | Active? |
| --- | --- | --- |
| **Emil's account skills** (17 custom, plus built-ins) | Claude's account skill system, in every Claude, Cowork and Claude Code session | **Yes.** All are loaded in the Cowork session of 2026-10-20 (two used in it). `docs/CLAUDE_SKILLS.md` was resynced the same day |
| **The repo's plugin, `testforge-skills`** (`skills/testing/`, `skills/engineering/`) | This repo; enabled by `.claude/settings.json` through the local marketplace (`.claude-plugin/marketplace.json`, `skills/.claude-plugin/plugin.json`) | **Wired correctly on paper.** The files are valid and the paths exist. Its last proof by real invocation is 2026-09-16. Cowork doesn't load repo plugins, so TFP-236 re-proves it in a Claude Code session |
| **Martin's proposals** (`skills/proposed/`, 16) | The repo, not in the plugin | **Not active by design.** Four are adopted below |

No skill points at a file that's gone: the four code files the plugin's
skills cite all exist. The drift is in judgement, not in broken links.

## Verdicts

### Testing (`skills/testing/`)

| Skill | Verdict | Why |
| --- | --- | --- |
| `write-playwright-test` | **Update** (TFP-238) | Still teaches the Phase 17 categories from `prompt.ts` (the parked OpenAI path, D11). It knows none of what Phases 38 to 44 settled. See TFP-238 |
| `crawl-and-classify-pages` | **Update: method plus pointer** (TFP-237; D12) | A frozen copy of `dom-snapshot.ts`'s rules on 2026-09-24. It missed four changes then, and Phases 38 to 42 changed introspection much more (label names, controls, `#/` routes, link inventories). It has never run against a live browser |
| `honest-coverage` | **Keep** | Already a run-time rule since Phase 35 Decision 6 (the fixed "not tested" statement), extended by Phase 44's scenario pairs. Its judgement is unchanged |
| `dont-stub-what-you-prove` | **Keep** | Phase 44 Decision 2 (a test must be able to fail) is this skill applied to model-written tests. TFP-197's tautologies are its worked case. TFP-239 adds that case to its known answers |
| `failure-mode-tests` | **Keep, with a pointer** | Overlaps Phase 44's scenario 6 and Phase 18's failure injection. A one-line pointer to Phase 44's harness is added in TFP-238 |
| `find-the-hidden-platform` | **Keep** | Unchanged judgement |
| `regression-safety-net` | **Keep** | Unchanged judgement. Tonight's TFP-210 fix is a fresh example (a green CI step that couldn't fail) |
| `plan-to-specs` | **Keep** | A port with its own `--check`. Nothing since affects it |

### Engineering (`skills/engineering/`)

| Skill | Verdict | Why |
| --- | --- | --- |
| `code-structure`, `refactor-audit`, `observability-check`, `reliability-audit` | **Keep** | Generic judgement. Their cited files (`page.tsx`, `useRun.ts`, `useCrawl.ts`) still exist |

### Martin's proposals (`skills/proposed/`)

| Skill | Verdict | Why |
| --- | --- | --- |
| `sre-testing` | **Adopt** (TFP-236) | Test strategy: what to test, how much, what only production can test. Closest to TestForge's own purpose |
| `sre-agents` | **Adopt** (TFP-236) | Agents with access to production or destructive tools: the gap writer, scenario tests, Phase 45's sandbox |
| `sre-overload` | **Adopt** (TFP-236) | Retries, timeouts, rate limits and cascading failure: scenario 6 (Phase 44) and load testing (D24) |
| `sre-release` | **Adopt** (TFP-236) | Safe shipping and CI: the nightly workflow, TFP-216 and TFP-217. It overlaps Emil's `verified-release-pipeline`. The overlap note it already carries stays |
| The other 12 (`sre`, `sre-architecture`, `sre-code`, `sre-cost`, `sre-data-integrity`, `sre-incident`, `sre-monitoring`, `sre-postmortem`, `sre-slo`, `sre-toil`, `dora`, `dora-capabilities`) | **Stay proposed** | Not needed by anything in the build order. A note asks Martin which, if any, he wants adopted. His own first pick was `sre-code` (below) |

## D12 — the crawl skill (Emil, 2026-10-20)

The skill describes the **method**:
- breadth-first, same-origin mapping;
- what to classify about each element and link;
- why each classification matters for testing.

For the **current rules**, it points to the code:
- `dom-snapshot.ts` and the introspect modules (`src/lib/introspect/`);
- Phase 40's page types;
- Phase 41's controls;
- Phase 42's coverage map.

It no longer copies the rules, so it can't drift from them again.
Rejected:
- syncing it with a drift check, which would keep a second copy to
  maintain;
- retiring it, because the method is useful outside TestForge.

## D20 — skills at run time, and proving them (Emil, 2026-10-20)

- **No new run-time rules.**
  - `honest-coverage` is already one (Phase 35 Decision 6).
  - Phase 44's must-fail rule is `dont-stub-what-you-prove` applied to
    model-written tests.
  - Running `dont-stub-what-you-prove` over every generated suite was
    rejected: the template is reviewed code, and model-written tests get
    Phase 44's stronger check.
- **Proving the skills (Martin's idea), TFP-239.** Each skill in the plugin
  gets a small set of known-answer cases, run through its real invocation
  path, not read by hand. A skill is "proven" when its cases pass, as
  TestForge's own checks are proven against fixtures.

## Note for Martin

> Hi Martin — Emil and I went through your sixteen SRE/DORA proposals in
> the skills relook (R6, 2026-10-20). Four join the `testforge-skills`
> plugin now because the build order needs them: `sre-testing`,
> `sre-agents` (the gap writer and the Docker sandbox), `sre-overload`
> (retry scenarios and load testing) and `sre-release` (the nightly CI).
> The other twelve stay in `skills/proposed/`, untouched. Your own first
> pick was `sre-code`; if you'd like it or any of the others adopted,
> say which and why it earns its place, and it'll go to Emil.

## Backlog

### TFP-236 — Re-prove the plugin loads; adopt four of Martin's skills

- **Priority:** P2 · **Labels:** `skills`
- **Problem it solves:**
  - the plugin's last real invocation was 2026-09-16;
  - four proposals are wanted in it.
- **Scope:**
  - **Re-prove the plugin.** In a fresh Claude Code session in the repo,
    `claude plugin list` (or `/plugin`) shows `testforge-skills` enabled,
    with every skill. One testing and one engineering skill are invoked
    through the `Skill` tool, as at Phase 21 (TFP-051).
  - **Adopt the four.** `sre-testing`, `sre-agents`, `sre-overload` and
    `sre-release` move to `skills/reliability/`, which is added to
    `plugin.json`'s skill paths.
    - Their references to skills still in `proposed/` become plain mentions
      with that path, so no link breaks.
    - Any reference file they need from `proposed/sre/` is copied with them.
  - **Update the docs:** `skills/README.md` and `skills/ROADMAP.md`, and
    `skills/proposed/README.md`'s list.
- **Acceptance criteria:**
  - the plugin list and the two invocations, recorded;
  - each adopted skill invoked once through the plugin;
  - no broken relative link in `skills/`, shown by a link check.
- **Dependencies:** none.

### TFP-237 — The crawl skill: the method, pointing to the code (D12)

- **Priority:** P2 · **Labels:** `skills`
- **Scope:** D12 above.
- **Deliverables:**
  - `crawl-and-classify-pages/SKILL.md` rewritten: the method and its
    reasons, with pointers to the current code and phase records for the
    rules;
  - its worked example re-run against a live page (the local Toolshop
    copy), which it never had.
- **Acceptance criteria:**
  - no classification rule is copied from the code;
  - every pointer resolves;
  - the worked example's output is recorded.
- **Dependencies:** none.

### TFP-238 — `write-playwright-test` brought up to Phases 38 to 44

- **Priority:** P2 · **Labels:** `skills`
- **Scope:** add what TestForge has since settled, as judgement for anyone
  writing tests:
  - **the three gates:** read-only, interactive, active. No attack-shaped
    input without the owner's permission;
  - **performance bands:** 2.5 to 4 s is an improvement, not a failure,
    and poor is a failure (Phase 38);
  - **the ISTQB technique** named for each test;
  - **repeated cards** on a listing get one test by position, and the
    failing ones are named (TFP-208);
  - **content that changes between loads** is found by something stable;
  - **a test must be able to fail:** no tautologies (TFP-197, Phase 44);
  - **`failure-mode-tests`** gets a pointer to Phase 44's scenarios.
- **Acceptance criteria:**
  - the worked example re-run through the real invocation, showing the
    gate, technique and band in its output;
  - the categories still match the template's areas.
- **Dependencies:** none.

### TFP-239 — Prove the skills: known-answer cases (D20)

- **Priority:** P3 · **Labels:** `skills`, `test`
- **Scope:** for every skill in the plugin (the 12 plus the 4 adopted):
  - 2 to 4 cases with a known answer, in `skills/<category>/<skill>/cases/`,
    using `skill-creator`'s eval format where it fits;
  - each run through the real invocation;
  - a short report of which pass.
- **Known answers include:**
  - `dont-stub-what-you-prove` on TFP-197's tautologies (must flag);
  - `regression-safety-net` on the TFP-210 pipe (must say the green step
    proved nothing);
  - `honest-coverage` on a Phase 44 scenario section.
- **Acceptance criteria:**
  - every skill has cases and a recorded result;
  - a failing case is either fixed in the skill or recorded with its
    reason.
- **Dependencies:** TFP-236 to TFP-238.
