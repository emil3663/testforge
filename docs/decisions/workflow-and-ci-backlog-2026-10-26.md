# Workflow, documentation and CI integration backlog (2026-10-26)

**Status:** Draft, proposed in a planning session 2026-10-26. Nothing here
is locked. The CI tickets (TFP-244 to TFP-249) need their own decision
record before they are built; TFP-244 is that record. The rest are small and
can be picked up between Phase 39's tickets, after TFP-157's verification.

**Ticket numbers:** TFP-244 to TFP-257, allocated against `main` at
`8e93998` (highest then: TFP-243). Re-check before committing; renumber if
another session took any of them.

**Why this exists:**
- the owner was asked whether TestForge can run in a CI/CD pipeline;
- a documentation pass found docs an enterprise or system architect would
  read first that are missing, stale, or describe another project;
- the working agreement was rewritten (`docs/WORKING_AGREEMENTS.md`) and
  some of what it adopts needs code, config or a larger edit.

---

## Part 1 — TestForge in a target's CI pipeline (proposed Phase 47)

### Where it stands today

- **TestForge's own CI exists:** PR validation, regression, self-test and
  nightly workflows in `.github/workflows/`.
- **Running TestForge as a step in someone else's pipeline is not possible
  yet.** Everything goes through the Next.js server and the UI: a run is
  three API calls (`/api/crawl`, `/api/generate`, then `POST /api/run`, which
  returns a 202 job that the UI polls). Nothing sets a process exit code;
  the report is JSON and HTML only; site suites and run history live in a
  local data folder that a CI runner wipes; ownership confirmation (Phase 43)
  is designed as a local, interactive step.
- **What works today, as a stopgap:** a generated suite is self-contained
  Playwright (it imports only `@playwright/test`). Save it, commit it to the
  target's repo and run `npx playwright test` in that repo's CI. This gives
  pass/fail on a frozen suite, and loses everything that makes TestForge
  TestForge: honest coverage, the gap list, suite reuse and regeneration on
  changed pages, run diffing, and the gates. It is worth saying when asked;
  it is not the product answer.

### TFP-244 - Decision record: TestForge in CI

- **Phase:** 47 (proposed)
- **Priority:** P0
- **Suggested labels:** `decision`, `ci`
- **Problem it solves:** Phase 16 locked TestForge as local-only, with
  `/api/run`'s code execution accepted under that model. Running on a
  target's CI runner is neither local nor the deferred SaaS, and it changes
  where state lives and what "failed" means. Those are owner decisions and
  need recording before anything is built.
- **Scope:** decide and record:
  - the first CI scope (proposed: Standard at the read-only gate only;
    interactive opt-in by flag; active not before TFP-249);
  - the trust model on a runner: the target's own CI, the target's own
    secrets, TestForge executing only code it generated in that job;
  - what fails the build (proposed: new failures against the baseline;
    known failures and findings are reported, not failing; a "couldn't run"
    is its own exit code, never a pass);
  - where the baseline and site suite live (target repo, CI cache or
    artifact);
  - distribution (npm package, Docker image, or both) and versioning
    (TFP-257);
  - whether the gap writer and local model are ever allowed in CI
    (proposed: no, for the first slice).
- **Deliverables:**
  - `docs/decisions/phase-47-ci-integration-decision-record.md`, locked;
  - an amendment note on Phase 16's local-only decision.
- **Acceptance criteria:**
  - each bullet in Scope has a recorded decision with its date, or is
    explicitly deferred with a reason;
  - the record names the measurement Gate A will use (see TFP-248).
- **Dependencies:** None.

### TFP-245 - Headless runner with a verdict, exit codes and JUnit output

- **Phase:** 47
- **Priority:** P0
- **Suggested labels:** `ci`, `run`, `report`
- **Problem it solves:** a pipeline needs one command that runs crawl,
  generate and run without a UI or a long-lived server, and a result a
  pipeline can act on. Today the result exists only as JSON for the UI.
- **Scope:**
  - a CLI entry point (e.g. `npx testforge run --url <base> --mode standard
    --out <dir>`), plus a config file for anything longer than a flag
    (login config, page cap, selected practices);
  - calls the same `src/lib` modules the API routes use — no second
    implementation of generation or running;
  - exit codes: `0` passed (no new failures); `1` test failures; `2`
    couldn't run (target unreachable, crawl found nothing, browser failed);
    `3` invalid configuration;
  - outputs in `--out`: `report.json` (the existing report), the HTML export,
    a JUnit XML file, the executed `suite.spec.ts`, and evidence for
    failures;
  - credentials only from environment variables, as today (Phase 20);
    redaction applies to every output file.
- **Deliverables:** the CLI, its unit tests, a `README.md` section.
- **Acceptance criteria:**
  - against local Toolshop **clean**: exit 0, and the JUnit file's counts
    equal `report.json`'s;
  - against local Toolshop **with-bugs**: exit 1, and the failing JUnit
    cases name the same tests as the report;
  - against an unreachable URL: exit 2, never 0;
  - a malformed config: exit 3 with a message naming the field;
  - template output for the same site is byte-identical to the UI path
    (`check:template-unchanged`'s inputs).
- **Dependencies:** [TFP-244]

### TFP-246 - Baselines and state on an ephemeral runner

- **Phase:** 47
- **Priority:** P1
- **Suggested labels:** `ci`, `site-suites`
- **Problem it solves:** without the previous run and the site suite, every
  CI run regenerates from scratch and every known failure fails the build.
  Phase 42's reuse and Phase 17's diff are what make CI results trustworthy
  rather than noisy.
- **Scope:**
  - `--data-dir` (or `TESTFORGE_DATA_DIR`) pointed at a workspace folder
    that the pipeline restores and saves (cache or artifact), per the
    TFP-244 decision;
  - `--baseline <run.json>`: compare with the run diff and fail only on new
    failures; report fixed, still-failing and new separately;
  - a documented way to commit a site suite into the target's repo when the
    team prefers that over a cache.
- **Deliverables:** the flags, unit tests, a docs section.
- **Acceptance criteria:**
  - two consecutive runs on with-bugs with the first as baseline: the
    second exits 0 and lists every failure as known;
  - with one bug fixed in the local copy, the second run reports it fixed
    and exits 0; with one new bug planted, it exits 1 naming only that one;
  - a changed page type is regenerated, not failed, as in the UI path
    (RUN-30).
- **Dependencies:** [TFP-245]

### TFP-247 - Packaging: a pinned, reproducible runner

- **Phase:** 47
- **Priority:** P1
- **Suggested labels:** `ci`, `release`
- **Problem it solves:** "the same site gives the same suite" only holds if
  Node, Playwright and Chromium are the same between runs and machines.
- **Scope:** a Docker image (Node 24, Playwright's Chromium, the CLI) and/or
  an npm package, per TFP-244; versions pinned; image tagged with the
  TestForge version (TFP-257).
- **Deliverables:** Dockerfile and/or package config; a release workflow.
- **Acceptance criteria:**
  - the image runs TFP-245's clean and with-bugs checks with the same
    results as a local run;
  - the release workflow executes the built image and asserts on its output
    (`verified-release-pipeline` skill), so a green release could have gone
    red.
- **Dependencies:** [TFP-245, TFP-257]

### TFP-248 - GitHub Action, example workflow and CI guide

- **Phase:** 47
- **Priority:** P1
- **Suggested labels:** `ci`, `docs`
- **Problem it solves:** the person who asked wants to drop TestForge into a
  pipeline, not assemble one.
- **Scope:**
  - a composite GitHub Action (`uses: emil3663/testforge/action@<version>`)
    wrapping the image: inputs for URL, mode, baseline and config;
    uploads the HTML report and JUnit results; writes a job summary;
  - an example workflow for a deploy-preview URL;
  - `docs/CI_INTEGRATION.md`: setup, secrets, what fails the build, what
    doesn't run in CI and why, and the stopgap described above;
  - a short note on running the image from other CI systems (GitLab, Azure
    DevOps), without claiming support that isn't tested.
- **Deliverables:** the action, the example, the guide.
- **Acceptance criteria (Gate A for Phase 47):**
  - TestForge's own CI runs the action against local Toolshop clean and
    with-bugs in Docker: clean passes, with-bugs fails, and both reports are
    attached;
  - a deliberately broken target URL turns the job red with exit 2.
- **Dependencies:** [TFP-246, TFP-247]

### TFP-249 - Interactive and active gates in CI

- **Phase:** 47
- **Priority:** P2
- **Suggested labels:** `ci`, `ownership`
- **Problem it solves:** forms, flows and attack-shaped tests are where real
  defects are, but they must never run against a site whose owner hasn't
  confirmed it.
- **Scope:** a non-interactive form of Phase 43's ownership confirmation: a
  committed confirmation file naming exact hosts, plus a CI secret; expiry
  enforced as in Phase 43; active tests skipped (Not run, with the reason)
  when either is missing.
- **Acceptance criteria:**
  - without the file or the secret, no active test runs and the report says
    why;
  - with both, for a listed host only, active tests run; an unlisted host in
    the same run gets none.
- **Dependencies:** [TFP-248, TFP-218, TFP-219, TFP-220, TFP-221]

---

## Part 2 — Working agreement follow-ups

### TFP-250 - Replace names used as permissions with the decision vocabulary

- **Phase:** None (between tickets)
- **Priority:** P1
- **Suggested labels:** `docs`, `chore`
- **Problem it solves:** rules are written as "with Emil's approval", "ask
  Emil first", "Emil's machine". A reader can't tell a standing rule from a
  one-off, and TestForge's own code reads as if only one person will ever
  use it. `WORKING_AGREEMENTS.md` now defines *owner decision*,
  *confirmation required*, *independent review* and, in product code,
  *the tester*.
- **Scope (counts on `8e93998`, excluding "Saint Martin" fixtures):**
  - `src/`: 81 lines in 56 files, all comments and test descriptions; no
    user-visible string names anyone. The candidate API already takes the
    approver as data (`approve`'s `by`). Rewrite authority comments
    ("offered for Emil's approval" → "offered for the tester's approval")
    and provenance ("decided by Emil 2026-10-06" → the decision reference);
    test fixtures may keep a name as a value or use `"tester"`.
  - `README.md` (1 line), `docs/QUALITY_GATES.md` (2: "Emil's machine" →
    "the local dev machine, with a real browser"), `TEST_PLAN.md` (27:
    provenance → decision references). `CLAUDE.md`'s one line was done in
    the planning pass that wrote this backlog.
  - `skills/`: 31 lines in 16 files. "How Emil invokes this skill" →
    "How to invoke this skill" in every SKILL.md and in the template note in
    the READMEs. Credit lines (Martin's proposals and branch, the plugin
    author) stay.
  - Not in scope: `benchmarks/`, git history, decision records' own ruling
    lines, `docs/decisions/` citations (planning sessions update those as
    they touch each record), already-committed promoted library entries'
    `approved.by` (a record of who approved).
- **Acceptance criteria:**
  - `git grep -nE "\b(Emil|Martin)\b" -- src README.md docs/QUALITY_GATES.md
    CLAUDE.md TEST_PLAN.md` returns only test-fixture values and credit lines, each
    listed in the commit body;
  - no `SKILL.md` heading contains a person's name;
  - `npm run test:unit` and `check:template-unchanged` unchanged (comments
    only; template output byte-identical);
  - the plugin still loads (TFP-236's check).
- **Dependencies:** None. Do it after TFP-157's verification, not inside it.

### TFP-251 - A deterministic stop check for implementing sessions

- **Phase:** None
- **Priority:** P2
- **Suggested labels:** `tooling`
- **Problem it solves:** "check before reporting" is advisory in
  `CLAUDE.md`. A Claude Code Stop hook makes the cheap checks unskippable.
- **Scope:** measure first: time `tsc --noEmit` and eslint on changed files
  on this machine. If the pair takes under 30 s, add a project Stop hook in
  `.claude/settings.json` that runs eslint on changed files and `tsc`,
  and blocks the turn from ending on failure. If it's slower, eslint only,
  and say so.
- **Acceptance criteria:**
  - the measured times are in the commit body;
  - a session that introduces a type error cannot end its turn until it is
    fixed (shown once, deliberately);
  - the existing `SessionStart` lock-file hook is unchanged.
- **Dependencies:** None. Changing `.claude/settings.json` affects every
  session on the repo: confirmation required.

### TFP-252 - Nightly-failure triage

- **Phase:** None
- **Priority:** P2
- **Suggested labels:** `ci`
- **Problem it solves:** a red nightly is only useful if someone reads it
  the next morning with the failing test and the first bad commit in front
  of them.
- **Scope:**
  - in `nightly.yml`, a step on failure that opens or updates one GitHub
    issue ("Nightly failing") with the failing tests, the run link and the
    commit range since the last green run — deterministic, no model;
  - the TFP-217 summary email links that issue;
  - optionally later, a scheduled Claude Code routine that reads the issue
    and drafts a reproduction. Not in this ticket.
- **Acceptance criteria:**
  - a forced failure on a branch's manual dispatch opens the issue; a second
    forced failure updates it rather than opening another; the next green
    run comments and closes it.
- **Dependencies:** [TFP-217]

### TFP-253 - Trim `TEST_PLAN.md` to cases, not narratives

- **Phase:** None
- **Priority:** P2
- **Suggested labels:** `docs`, `context`
- **Problem it solves:** `TEST_PLAN.md` is 298 KB; 163 rows exceed 400
  characters and the longest is 5,923. Every session that reads it spends
  context on measurement narratives that already live in the decision
  records and `benchmarks/`.
- **Scope:** each row keeps ID, case, expected result, status and one
  evidence pointer (record, ticket, test file). Narrative moves to the
  record it came from if it isn't already there.
- **Acceptance criteria:**
  - the set of case IDs is identical before and after (diffed);
  - no row over 400 characters; file size before and after in the commit
    body;
  - every removed sentence's content exists in a decision record or
    benchmark folder (spot-check of 20 rows recorded in the commit body).
- **Dependencies:** None. Not while another session is editing
  `TEST_PLAN.md`.

---

## Part 3 — Docs an architect would read first

Found 2026-10-26. A reviewer evaluating TestForge for a team would open, in
roughly this order: README, a security policy, an architecture overview, a
decisions index, the contribution rules, the version and release notes.

### TFP-254 - `SECURITY.md` and `CONTRIBUTING.md`

- **Priority:** P1
- **Suggested labels:** `docs`, `security`
- **Problem it solves:** the repo is public and shared with outside readers.
  There is no way to report a vulnerability, and the security model —
  arbitrary code execution by design, loopback only — lives only in the
  README. There is no contribution guide; the old working agreement pointed
  at a `CONTRIBUTING.md` that never existed here.
- **Scope:**
  - `SECURITY.md`: how to report, what's supported, the security model
    (from README), and a short threat model: generated-code execution,
    model-written tests (restrictions, not a sandbox; Phase 45), the gap
    writer's tool-less Claude Code call, credentials (env only, redacted,
    storageState never persisted), local data (site details, contact email);
  - `CONTRIBUTING.md`: setup pointer to README, the loop and vocabulary
    from `WORKING_AGREEMENTS.md`, Conventional Commits, the test commands,
    and that outside changes come as issues or PRs, not direct pushes;
  - note in `SECURITY.md` that `.env.development`'s committed values are
    local development placeholders for the optional Plane stack, not
    secrets.
- **Acceptance criteria:** both files exist; every claim in the threat model
  points at the code or record that implements it.
- **Dependencies:** None. Planning session can write these.

### TFP-255 - Decisions index, roadmap header, and historical docs marked

- **Priority:** P1
- **Suggested labels:** `docs`
- **Problem it solves:** `docs/decisions/` has 60+ files and no index; the
  roadmap's header still says "Version 1.0, 2026-08-28, Draft" with a
  pre-Phase 16 baseline, and its Phase 39 heading says "not started" though
  Gates A to D are measured. `docs/consolidation/` (April 2026) describes
  the FastAPI backend and proxy cutover that Phase 16 deleted, including a
  CI plan for that architecture, with nothing saying it's historical.
  `docs/TA-230.md` is test-assist material kept as skill source.
- **Scope:**
  - `docs/README.md`: an index of the docs and what each is for;
  - a decisions table (phase, title, status, record, backlog) at the top of
    `product-roadmap.md` or in `docs/decisions/README.md`;
  - roadmap header: current version, date, a baseline that is today's, and
    Phase 39's status;
  - a banner on each `docs/consolidation/` file: historical, superseded by
    Phase 16; or move the folder under `docs/history/`;
  - move `docs/TA-230.md` beside the skill that cites it.
- **Acceptance criteria:** every file under `docs/` is reachable from
  `docs/README.md`; no phase heading's status contradicts its record's
  status line.
- **Dependencies:** None.

### TFP-256 - README claims check

- **Priority:** P2
- **Suggested labels:** `docs`
- **Problem it solves:** the README is mostly current (2026-10-20) but
  overstates in places: "Comprehensive goes deep on one area, or all of
  them" — `COMPREHENSIVE_AREAS` is security and accessibility only, and
  all-areas runs are D5, planned.
- **Scope:** run the `repo-claim-audit` skill on README and fix what it
  finds; add a last-reviewed date.
- **Acceptance criteria:** the audit's findings list is in the commit body,
  each resolved or justified.
- **Dependencies:** None.

### TFP-257 - Versions and release notes

- **Priority:** P1 (blocks TFP-247)
- **Suggested labels:** `release`
- **Problem it solves:** `package.json` says `0.1.0` and the repo has no
  tags, so "which TestForge found this?" has no answer. CI users need a
  version to pin.
- **Scope:** a versioning rule (proposed: minor version per completed phase,
  patch for fixes between), tags from now on, and a `CHANGELOG.md` written
  from phase completions in the roadmap (not from commit subjects).
- **Acceptance criteria:** the current `main` is tagged; the changelog's
  entries each cite their phase record; the report includes the TestForge
  version and commit.
- **Dependencies:** [TFP-244] for the rule.

---

## Recommended execution order

Phase 39 and its tickets stay first. These slot in between gates:

1. TFP-250 (names) and TFP-254/TFP-255 (docs) — no dependencies, small,
   and they change what any outside reader sees first.
2. TFP-244 — the decision record, so the answer to "can it run in CI?"
   becomes a dated plan.
3. TFP-257, then TFP-245.
4. TFP-246 and TFP-247 (independent of each other once TFP-245 lands).
5. TFP-248 — Gate A for Phase 47.
6. TFP-252, TFP-253, TFP-256, TFP-251 — whenever a slot opens.
7. TFP-249 — after Phase 43.

Where Phase 47 sits relative to the deferred-work build order (after
Phase 39; ownership confirmation; Standard sets…) is an owner decision,
taken in TFP-244.

## Suggested milestone gates

### Gate A — TestForge runs in a pipeline (Phase 47)
- TFP-248's acceptance criteria met in TestForge's own CI: clean passes,
  with-bugs fails, unreachable is exit 2.
- Independent verification of TFP-245's exit codes and JUnit counts.

### Gate B — A second run is trustworthy
- TFP-246's baseline criteria met: known failures don't fail the build; a
  planted new bug does; a fixed bug is reported fixed.
