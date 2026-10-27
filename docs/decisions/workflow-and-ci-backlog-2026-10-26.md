# Workflow, documentation and CI integration backlog (2026-10-26)

**Status:** Draft, proposed in a planning session 2026-10-26. Nothing here
is locked. The CI tickets (TFP-244 to TFP-249) need their own decision
record before they are built; TFP-244 is that record. The rest are small and
can be picked up between Phase 39's tickets, after TFP-157's verification.

**Ticket numbers:** TFP-244 to TFP-257, allocated against `main` at
`8e93998` (highest then: TFP-243); TFP-259 and TFP-260 added 2026-10-27
(TFP-258 was taken meanwhile); TFP-261 and TFP-262 added 2026-10-27. Re-check before committing; renumber if
another session took any of them.

**Why this exists:**
- the owner was asked whether TestForge can run in a CI/CD pipeline;
- a documentation pass found docs an enterprise or system architect would
  read first that are missing, stale, or describe another project;
- the working agreement was rewritten (`docs/WORKING_AGREEMENTS.md`) and
  some of what it adopts needs code, config or a larger edit.

---

## Part 0 — Found 2026-10-27, fix first

### TFP-261 - Make the server reachable from this machine only, and refuse cross-site requests

- **Phase:** None — fix before anything else in this backlog
- **Priority:** P0
- **Suggested labels:** `security`, `bug`
- **Problem it solves:** the README's security model says TestForge must
  never be reachable beyond the tester's own machine, because `/api/run`
  executes the code it is given. Two things contradict it today, both
  measured 2026-10-27 on `6bd7fc0`:
  - **It listens on every interface.** `npm run dev` and `npm start` run
    `next dev` / `next start` with no hostname, and Next.js defaults to
    `0.0.0.0`; the dev server announces a Network address. Anyone on the
    same network who can reach port 3000 can call the API.
  - **The API accepts cross-site requests.** No route checks `Host` or
    `Origin`, and `POST /api/run` parses its body with `req.json()`
    whatever the `Content-Type`. A `POST` carrying a foreign `Origin` and
    `Content-Type: text/plain` — the kind of request any web page can send
    without a CORS preflight — was accepted (202) and the code in it ran.
    Whether a given browser will send it to `localhost` depends on the
    browser (current Chrome asks the user first for public sites reaching
    local addresses; not every browser does). A missing `Host` check also
    leaves DNS rebinding open.
- **Scope:**
  - bind to loopback: `-H 127.0.0.1` on `dev`, `dev:development` and
    `start` (the self-test scripts already do);
  - one request guard for every `/api/*` route (Next's `proxy`/middleware):
    refuse when `Host` isn't `localhost`, `127.0.0.1` or `[::1]` on the
    server's port; refuse when `Origin` is present and isn't the same
    origin; refuse a `POST`, `PUT` or `DELETE` that isn't
    `Content-Type: application/json`. Refusals are 403 with a message that
    says why;
  - the UI's own requests keep working unchanged.
- **Acceptance criteria:**
  - the dev server's startup output shows no LAN address, and the port
    isn't reachable on the machine's LAN address (reworded, owner
    decision 2026-10-27: Next.js still prints a "Network:" line, which
    names the bound loopback address);
  - regression tests: the 2026-10-27 request (foreign `Origin`,
    `text/plain`) gets 403 and runs nothing (checked with a marker the code
    would have written); a foreign `Host` gets 403; a same-origin JSON
    request from the UI still gets 202;
  - the self-test and regression suites pass unchanged.
- **Dependencies:** None. `SECURITY.md` (TFP-254) describes the server as
  it is *after* this ticket, so it is committed with or after this fix,
  never before.
- **Done 2026-10-27:** `6d1e854` (the fix, RUN-43), then `SECURITY.md`
  and `CONTRIBUTING.md` (`c284e82`). The startup criterion reworded to
  "no LAN address" (owner decision, 2026-10-27).

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

- **Status:** Built 2026-10-27 (`1a4f18b`, `6d82c2e`, `18d1e1c`); not yet
  independently verified. Its fresh-context review caught one reworded line
  inside generated-suite helper code that `check:template-unchanged` misses
  (TFP-258). Left for an owner decision: two helper-template lines
  (`controls.ts:245`, `:282`) still carry a name, and changing them moves
  the template baseline.

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
- **Done 2026-10-27:** measured 11.8 to 14.2 s for both, so both run;
  `scripts/hooks/stop-check.sh` (`818936f`, the type-error case shown
  once), wired in as a project Stop hook (owner decision the same day),
  the `SessionStart` hook unchanged.

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

### TFP-253 - Split `TEST_PLAN.md` by area and slim its rows

- **Phase:** None
- **Priority:** P1
- **Suggested labels:** `docs`, `context`
- **Problem it solves:** `TEST_PLAN.md` is 298 KB in one file; 163 rows
  exceed 400 characters and the longest (RUN-42) is 5,923. A session that
  needs one case pays for all of them, and most of each row is a
  measurement narrative that already lives in a decision record or under
  `benchmarks/`. The information is already filed; the plan should point
  at it, not repeat it.
- **Scope (revised 2026-10-27):**
  - **Split by area.** `TEST_PLAN.md` keeps the feature-status table, the
    known limitations and an index; each case prefix moves to its own file
    under `docs/test-plan/` (`GEN.md`, `RUN.md`, `RPT.md`, `HLT.md`, …).
    A ticket names the area it touches, so a session reads one file.
  - **Slim each row** to: ID, case, expected result, status, and one
    evidence pointer — the record's decision, the ticket, the test file.
    The "Proven (…)" narratives move to the decision record the ticket
    belongs to, under that ticket, where they aren't already.
  - **No separate outstanding-work file.** What's left is already in the
    deferred-work register (build order) and the current handover (next
    tickets); a third copy would drift. Instead, `CLAUDE.md` gets one line:
    read the handover, then only the test-plan area and record section the
    ticket names.
- **Acceptance criteria:**
  - the set of case IDs across the split files equals the set before
    (diffed, in the commit body);
  - no row over 400 characters; total bytes before and after in the commit
    body;
  - every moved narrative is findable in its record (spot-check of 20 rows
    listed in the commit body);
  - links from records and the README to `TEST_PLAN.md#…` anchors still
    resolve, or are updated;
  - `test-plan-doc` skill updated to the split layout.
- **Dependencies:** None. Not while another session is editing
  `TEST_PLAN.md`.

### TFP-259 - Dead-code pass, and a check that keeps it clean

- **Phase:** None
- **Priority:** P2
- **Suggested labels:** `chore`, `tooling`
- **Problem it solves:** the last deliberate cleanups were Phase 16's
  deletions (2026-08-28) and TFP-070's dead env var (2026-09-23); nothing
  checks for unused code since. A scan on 2026-10-27 (`knip` 5, scoped to
  `src/`, `scripts/`, `tests/`, with the unit tests as entry points) found
  the codebase lean, with a few real leftovers:
  - `getDefaultInspectionPath` is defined twice, identically:
    `src/app/_lib/derive.ts:220` and `src/lib/introspect/paths.ts:14`;
  - `websiteSchema` is defined in `src/app/_lib/constants.ts:118` and again
    in `src/app/page.tsx:36`; only the second is used;
  - `playwright-core` is imported directly (`src/lib/run/redact.ts`) but
    isn't in `package.json` (it arrives through `@playwright/test`);
  - `.env.example` still describes `TESTFORGE_ENV` as a FastAPI overlay
    (it now only labels `/api/health`'s output) and says that without an
    OpenAI key TestForge "falls back to a sample test template" (the
    template is the default generator); `.gitignore` keeps a Python
    section for a toolchain Phase 16 removed.
  Not findings: knip also lists `@axe-core/playwright`, `nspell` and the
  dictionaries as unused (they're used by generated suites and by
  `src/lib/generate`, which knip can't see through code strings) and
  `request-cap-fixture.ts` (copied into run folders by path); 79 exports
  are only used inside their own file — over-exported, not dead.
- **Scope:** remove the duplicates (one implementation, imported where
  needed), declare `playwright-core` or import through `@playwright/test`,
  fix the `.env.example` and `.gitignore` text; commit a `knip.json` with
  the false positives explained, and add `npx knip` to `nightly.yml`.
- **Acceptance criteria:**
  - `npx knip` exits 0 on the committed config, and fails when an unused
    file is added (shown once);
  - `check:template-unchanged` byte-identical; unit suite unchanged.
- **Dependencies:** None.

### TFP-260 - Bind the local Docker stacks to loopback

- **Phase:** None
- **Priority:** P1
- **Suggested labels:** `security`, `config`
- **When (owner decision, 2026-10-27):** after Gate D's re-measurement
  session, as the Toolshop setup isn't changed before it.
- **Problem it solves:** `docker-compose.yml` publishes Plane on port 80
  and MinIO on 9000 and 9090 on every network interface (measured
  2026-10-27: `docker ps` shows MinIO on `0.0.0.0:9000` and
  `0.0.0.0:9090`), and the local Toolshop copies publish 4200 (the app),
  8091 (the API), 8000 and 3306 (MariaDB, root password `root`) the same
  way, from Testsmith's own `docker-compose.yml` in WSL; all with credentials
  that are defaults in a public repo (`plane-access-key` /
  `plane-secret-key`, `change-me-before-production`). On a shared network
  anyone who can reach the machine can open the MinIO console with them.
  TestForge itself is loopback-only by rule; its test targets should be too.
- **Scope:** publish as `127.0.0.1:<port>:<port>` in `docker-compose.yml`
  and for the Toolshop (D26). Testsmith's file isn't TestForge's to edit
  (`scripts/toolshop-local/README.md`), so the Toolshop's go in a
  TestForge override beside `compose.local.yml`, which replaces the
  `ports` of `angular-ui`, `web` and `mariadb` (compose merges `ports`
  lists, so the override needs `!override` or a reset, to be checked);
  then remove the known gap from `SECURITY.md`; say in
  `.env.development` and the README that the values are local placeholders,
  and how to override them. Owner decision first: is Plane still used as a
  target? If not, remove it (compose file, env vars, README sections)
  instead.
- **Acceptance criteria:**
  - with the stacks up, `netstat` shows the ports bound to `127.0.0.1`
    only; `http://localhost` still serves Plane, and `localhost:4200` and
    `:8091` the Toolshop, with its start script's bug-80 check passing;
  - from another machine on the network, the ports don't answer.
- **Dependencies:** None.

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
- **Decided 2026-10-27 (owner):** reports through GitHub private
  vulnerability reporting; best effort, acknowledgement within a week;
  `main` supported until versioning starts; issues first, pull requests by
  invitation.
- **Status:** both files drafted 2026-10-27 in a planning pass. Before they
  are committed: TFP-261 lands (SECURITY.md describes the fixed server),
  and the owner switches on private vulnerability reporting in the
  repository's Security settings (the policy points readers there).
- **Acceptance criteria:** both files exist; every claim in the threat model
  points at the code or record that implements it.
- **Dependencies:** None. Planning session can write these.

### TFP-262 - GitHub Issues as the public front door

- **Priority:** P1
- **Suggested labels:** `docs`, `process`
- **Problem it solves:** the repo is public and shared, but its history of
  found-and-fixed problems is spread across 60+ decision records. Issues
  were used in September (`Closes #67` to `#82`) and for #2 and #3, then
  work moved entirely to `TFP-` tickets in docs. An outside reader can't
  see what is known, what was found or what was done about it without
  digging. Mirroring every `TFP-` ticket would be noise; nothing at all
  hides a well-run project.
- **Scope (decided 2026-10-27):**
  - **Issue templates** (`.github/ISSUE_TEMPLATE/`): bug report (the fields
    in `CONTRIBUTING.md`), idea, and a `config.yml` that disables blank
    issues and links security reports to private reporting;
  - **labels** from `TEST_PLAN.md`'s set, plus `known-limitation` and
    `phase`;
  - **known limitations as issues:** one open issue per item in
    `TEST_PLAN.md`'s known-limitations list, linking the case and the
    record that would close it;
  - **one tracking issue per phase** from Phase 39 on: opened when the
    record locks, linking the record; gate rulings summarised as comments;
    closed by the commit that completes the phase. Earlier phases are not
    back-filled (the index covers them);
  - **outside reports** stay issues; one that becomes planned work gets its
    `TFP-` number in its title (as `WORKING_AGREEMENTS.md` says).
- **Acceptance criteria:** the templates show on "New issue"; a blank issue
  can't be opened; every known limitation has an open issue; Phase 39 has a
  tracking issue linking its record; `WORKING_AGREEMENTS.md` and
  `CONTRIBUTING.md` describe the same rules.
- **Dependencies:** None. Creating issues and labels needs GitHub access
  with write permission: confirmation required.
- **Done 2026-10-27** (owner decision the same day for the labels and the
  issues): the templates and `config.yml` (`97e3d2f`); 8 labels added
  (`technical-debt`, `refactor`, `testing`, `investigation`, `skills`,
  `chore`, `known-limitation`, `phase`; `bug` and `documentation` already
  existed); #5 to #13, one per known limitation, each linked from its
  item in `TEST_PLAN.md`; #14, Phase 39's tracking issue; the same rules
  in `WORKING_AGREEMENTS.md` and `CONTRIBUTING.md`.

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
- **Done 2026-10-27 in a planning pass:** `docs/README.md`,
  `docs/decisions/README.md` (the index), the roadmap header and Phase 39's
  heading, a historical banner on every `docs/consolidation/` file and a
  `consolidation/README.md`. **Done 2026-10-27 (Claude Code):** the move
  of `docs/TA-230.md` to `skills/testing/find-the-hidden-platform/`, with
  its links, and the three status lines, which the index no longer flags.
  **Was left:** moving `docs/TA-230.md` beside its
  skill (a `git mv`), and correcting three records' own status lines the
  index flags: Phase 42 ("Locked", complete 2026-10-15), Phases 35 and 36
  ("Approved").
- **Acceptance criteria:** every file under `docs/` is reachable from
  `docs/README.md`; no phase heading's status contradicts its record's
  status line.
- **Dependencies:** None.

### TFP-256 - README claims check

- **Priority:** P2
- **Suggested labels:** `docs`
- **Problem it solves:** the README is mostly current (2026-10-20) but
  states the goal as if it were built: "Comprehensive goes deep on one area,
  or all of them". The goal is a Comprehensive set for every area and an
  all-areas run (D5); today `COMPREHENSIVE_AREAS` is security and
  accessibility. The fix is to say both — the goal, and what's built —
  wherever the README describes coverage.
- **Scope:** run the `repo-claim-audit` skill on README and fix what it
  finds; add a last-reviewed date.
- **Acceptance criteria:** the audit's findings list is in the commit body,
  each resolved or justified.
- **Dependencies:** None.

### TFP-257 - Start versioning

- **Priority:** P1 (blocks TFP-247)
- **Suggested labels:** `release`
- **Problem it solves:** `package.json` says `0.1.0`, unchanged since the
  start, and the repo has no tags, so "which TestForge found this?" has no
  answer, and a CI user has nothing to pin.
- **What it takes:**
  1. **The rule (owner decision).** Proposed: semantic versioning, staying
     below 1.0 while the report format can still change; the minor version
     goes up when a phase completes (Phase 39 → `0.2.0`), the patch for fixes
     between phases; 1.0 when the report and CLI are declared stable
     (after Phase 47).
  2. **One source of truth:** `package.json`'s `version`.
  3. **The product says its version:** `/api/health`, every run's
     `run.json` and the report footer carry the version and the commit,
     so a saved report answers the question by itself.
  4. **A changelog:** `CHANGELOG.md`, one entry per version, written from
     the phase records (what changed for a user), not from commit
     subjects. The first entry, `0.1.0`, summarises Phases 16–38 in a few
     lines and links the index.
  5. **Tags and releases:** an annotated tag `v0.1.0` on the commit that
     starts versioning, and `v0.2.0` when Phase 39 completes; a GitHub
     release per tag with the changelog entry. Tags are pushed by Claude
     Code; creating the first one is confirmation required.
  6. **Later, with TFP-247:** a release workflow that builds the image
     from the tag and tests it before publishing.
- **Acceptance criteria:** `v0.1.0` exists; `/api/health` and a fresh
  `run.json` show the version and commit; the changelog's entries each cite
  their phase record.
- **Dependencies:** None for steps 1–5 (the rule is decided first);
  TFP-247 for step 6.

---

## Recommended execution order

Phase 39 and its tickets stay first. These slot in between gates:

0. **TFP-261 first.**
1. TFP-250 (names), TFP-254 (with or after TFP-261), TFP-255 and TFP-262 —
   small, and they change what any outside reader sees first.
2. TFP-244 — the decision record, so the answer to "can it run in CI?"
   becomes a dated plan.
3. TFP-257 (steps 1–5 can go first, independently), then TFP-245.
4. TFP-246 and TFP-247 (independent of each other once TFP-245 lands).
5. TFP-248 — Gate A for Phase 47.
6. TFP-260 and TFP-253 soon; TFP-252, TFP-259, TFP-256, TFP-251 whenever a slot opens.
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
