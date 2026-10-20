# Phase 45 Decision Record — The Docker Sandbox for Model-Written Tests

Date: 2026-10-20
Scope: Every test a model wrote runs inside a Docker container. That means:
- gap tests (Phase 42);
- candidates (Phase 42);
- scenario tests (Phase 44).

The container can reach nothing on the machine and nothing on the network
except the run's target hosts. Only the results leave it. The template's
tests and promoted library entries, which are reviewed code, keep running
as today.

Status: **Locked (Emil, 2026-10-20). Not started.** Decisions, acceptance criteria and tickets approved.
- This is R5's first decision record (`post-phase-42-review-plan.md`).
- Its build order: after D19, before Phase 44's writer (TFP-226)
  (`deferred-work-register.md`).
- Tickets TFP-228 to TFP-231.

## Context

- **Phase 42's batch 2 ruling 5 (2026-10-14).** Gap tests "turn text read
  from a site under test into code that runs on Emil's machine, and
  candidates carry that code to other sites". TFP-202 hardened them (P0),
  and "a real sandbox (the tests run inside Docker) is the follow-up".
- **TFP-202's hardening, as built:**
  - Claude Code is called with every tool off, from an empty temporary
    folder.
  - Tests run with a stripped environment (`src/lib/run/child-env.ts`).
  - The code check parses the body and refuses imports, `process`,
    `require`, network and dynamic code.

  That is a filter on the code. Nothing contains the code if the filter
  misses something.
- **Where model-written code runs today:**
  - gap tests: `runGapSpec` in `src/lib/gap-writer/gap-run.ts`;
  - candidates and bound candidates: bound into the main run
    (`src/lib/candidates/apply.ts`, TFP-203).

  Both run on the host, as the user, with the repo, the data folder and the
  home folder in reach.
- **Phase 44** makes scenario tests the gap writer's purpose. They change
  data on purpose, so containing them matters more.
- **The gap writer is off unless a site opts in.** Nothing runs model code
  by default today, so the sandbox lands before Phase 44's writer, not
  urgently now.

## Decisions

1. What runs in the sandbox, and what doesn't.
- **Inside:** every test a model wrote:
  - gap tests and their revisions;
  - candidates, bound or not;
  - scenario tests.

  It doesn't matter which run mode or which site.
- **Outside, as today:** the reviewed code:
  - the template's tests;
  - promoted library entries (Phase 42's promotion is a reviewed commit
    with Emil's approval).
- **The writer stays on the host.** Claude Code is called with every tool
  off, from an empty folder (TFP-202), and writes text, not running code.
  Running it in the container would need its sign-in inside the container.
  - The writer's revisions read the sandbox's results like any other.
- **Bound candidates leave the main run.** They move into the sandbox run
  of the same job, and their results are merged into the report's
  candidate and gap sections as today.

2. The container.
- **Image:** Microsoft's Playwright image, pinned to the exact version
  `package.json` resolves (`@playwright/test`), and to its digest.
  - A Playwright upgrade moves the pin in the same commit.
  - The tests run in Chromium only (Phase 16).
- **One container per run,** not per test. It holds every model-written
  test of that run and is removed when they finish.
- **Mounts:**
  - the run's model-written specs and their config, read-only;
  - one empty output folder, writable.

  Nothing else: not the repo, not the data folder, not the home folder.
- **Environment:** TFP-202's stripped environment. No keys, tokens or
  TestForge settings.
- **Sign-in state:** a signed-in run's `storageState` (Phase 20) is mounted
  read-only for the run and removed after. It is never written into the
  image or the output folder.
- **Limits:**
  - CPU and memory capped;
  - not privileged;
  - no added capabilities;
  - a non-root user;
  - a read-only root filesystem, apart from the output folder and a
    temporary folder.

3. The network: only the run's target hosts (Emil, 2026-10-20).
- **The way out:** the container's only route is a small forward proxy
  started with it. The proxy allows:
  - the run's target hosts;
  - for a remote site, the hosts its pages load, as recorded by the main
    run's crawl.

  Anything else is refused and named in the results.
- **The browser in the container uses the proxy.** The container sits on
  an internal Docker network with no other way out.
- **Local targets** (the local Toolshop copies, in WSL from D26) are reached
  through the host.
  - The app calls its API at `http://localhost:8091` from the browser, so
    inside the container `localhost:4200` and `localhost:8091` must reach
    the host's ports.
  - The mechanism is named in TFP-229's commit. Proven by Acceptance
    Criteria 3.
- This is defence in depth behind the code check, which already refuses
  `fetch`, `XMLHttpRequest`, `WebSocket` and `page.request`.

4. What leaves, and how it is checked.
- **Only the output folder leaves:**
  - Playwright's JSON report;
  - for failures, traces, screenshots and video.
- **Capped in size.** A run over the cap keeps its report and drops the
  largest attachments, saying so.
- **TestForge reads it as untrusted data,** like the page text in TFP-202.
  - It is parsed, never executed.
  - Every captured file goes through Phase 20's credential scan, as today.

5. No Docker, no model-written tests (Emil, 2026-10-20).
- If Docker isn't running, or the image or proxy won't start, every
  model-written test in the run is Not run, with the reason "sandbox
  unavailable: start Docker Desktop".
- The rest of the run goes ahead.
- They are never run outside the sandbox. There is no setting to allow it.

6. The cost: at most 60 seconds per run (Emil, 2026-10-20).
- **What's measured:** start, proxy, the tests' own time, and removal, on
  local Toolshop. The image pull is done once and measured separately.
- **Up to 60 s more** than the same tests run on the host today: kept.
- **Over 60 s:** the design is revisited before it is kept, for example by
  keeping one container warm between runs. Recorded either way.

7. Results are the same.
- On the fixture, every model-written test gets the same result inside the
  sandbox as it got on the host, apart from tests that reach a host outside
  the allowed set. Those are now refused, and each is named.

## Acceptance Criteria

1. What runs where
- **The model's tests:** on the fixture, with the gap writer (a stand-in
  writer) and candidates on, the run record shows every model-written test
  ran in the sandbox.
- **The rest:** the template's tests and promoted entries ran on the host.
- **The writer:** runs on the host, with TFP-202's flags.

2. Containment
- **Files:** a stand-in test that slips past the code check (a test-only
  bypass) can't read a file in the repo, the data folder or the home
  folder. It can't write outside the output folder.
- **Environment:** it can't read an environment variable TestForge holds.
- **Privileges:** it runs as a non-root user, with a read-only root.

3. Network
- **Blocked:** a request to a host outside the allowed set is refused, and
  the results name the host.
- **Local Toolshop:** a sandboxed test reaches local with-bugs, including
  the app's own calls to `localhost:8091`, and passes where it passed on
  the host.

4. What leaves
- **The cap:** an oversized output is cut to the report, with the drop
  named.
- **The scan:** every captured file goes through the credential scan.
- **Untrusted data:** a report holding a script-shaped string is shown as
  text.

5. No Docker
- **Not run:** with Docker stopped, every model-written test is Not run
  with Decision 5's reason.
- **The rest:** the other tests run and pass as before.
- **No bypass:** no option runs them on the host.

6. Cost and results
- **Overhead:** Decision 6's measurement on local Toolshop, with the 60 s
  rule applied.
- **Same results:** Decision 7's comparison on the fixture.
- **Template:** `check:template-unchanged` reports every fixed input identical against
  the recorded baseline (`TEMPLATE_BASELINE`). The count is whatever the
  check's input set holds at the time, 166 when this was written, not a
  fixed number. Model-written tests
  aren't template output.

## Regression Policy

- **`TEST_PLAN.md` cases:**
  - each mount;
  - each limit;
  - the proxy's allow and refuse;
  - the local-target route;
  - the output cap;
  - the credential scan of sandbox output;
  - Docker unavailable;
  - bound candidates leaving the main run;
  - results unchanged.
- **The image pin:** a unit test fails if the image's Playwright version and
  `package.json`'s resolved version differ.

## Related, deferred (not this phase)

- **The main run in a container.** Not planned: the template is reviewed
  code. Revisit if TestForge is ever deployed (the SaaS phase,
  `saas-prerequisites.md`).
- **The writer in a container,** if Claude Code's sign-in can be used
  there.
- **A warm container between runs,** only if Decision 6's bar is missed.

## Dependencies and order

- **D26:** the local Toolshop copies in WSL. The local-target route is
  proven against them.
- **Phase 43:** none directly.
- **Before Phase 44's TFP-226.**
- **In the build order:** after D19, before Phase 44.

## Backlog

### TFP-228 — The sandbox container and its mounts

- **Phase:** 45 · **Priority:** P1 · **Labels:** `security`, `run`
- **Problem it solves:** model-written code runs on the host with the repo,
  data and home folder in reach.
- **Scope:** Decisions 2 and 5. Acceptance Criteria 2 and 5.
- **Deliverables:**
  - the pinned image and its version test;
  - one container per run;
  - the mounts, environment and limits;
  - the no-Docker rule;
  - `TEST_PLAN.md` cases.
- **Dependencies:** none.

### TFP-229 — The network: target hosts only, and local targets through the host

- **Phase:** 45 · **Priority:** P1 · **Labels:** `security`, `run`
- **Scope:** Decision 3. Acceptance Criteria 3.
- **Deliverables:**
  - the internal network and proxy;
  - the allowed set from the run;
  - the local-target route, named in the commit;
  - `TEST_PLAN.md` cases.
- **Dependencies:** TFP-228; D26.

### TFP-230 — Model-written tests run in the sandbox; results come back

- **Phase:** 45 · **Priority:** P1 · **Labels:** `security`, `run`, `report`
- **Scope:** Decisions 1 and 4. Acceptance Criteria 1 and 4.
- **Deliverables:**
  - gap tests, candidates and bound candidates routed to the sandbox;
  - the output read as data, capped and scanned;
  - the report sections unchanged;
  - `TEST_PLAN.md` cases.
- **Dependencies:** TFP-229.

### TFP-231 — Measure the sandbox (Gate B)

- **Phase:** 45 · **Priority:** P2 · **Labels:** `measurement`
- **Scope:** Decisions 6 and 7. Acceptance Criteria 6.
- **Deliverables:**
  - the overhead on local Toolshop;
  - the same-results comparison on the fixture;
  - an `outcome.md`;
  - the 60 s rule applied.
- **Dependencies:** TFP-230.
- **Stop at Gate B.**

## Recommended Execution Order

1. TFP-228.
2. TFP-229.
3. TFP-230.
4. TFP-231.

## Suggested Milestone Gates

### Gate A — Contained
- TFP-228 and TFP-229 landed and independently verified.
- Acceptance Criteria 2 and 3 are shown.

### Gate B — In use and measured
- TFP-230 and TFP-231 landed and independently verified.
- The 60 s rule is applied and recorded.
