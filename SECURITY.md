# Security policy

## Reporting a vulnerability

**Please don't report security problems in public issues, discussions or
pull requests.**

Report them privately through GitHub: on this repository's **Security**
tab, choose **Report a vulnerability**. That opens a private advisory that
only the maintainer can see.

Please include what you found, how to reproduce it (the request, the
config, the TestForge commit), and what an attacker could do with it.

**What to expect.** TestForge is maintained by one person, so responses are
best effort: an acknowledgement within a week, then updates in the advisory
until it is fixed or declined with a reason. Once a fix lands, the advisory
is published with credit to the reporter, unless you'd rather not be named.

## Supported versions

Versions are numbered from `0.2.0` (see `docs/decisions/workflow-and-ci-backlog-2026-10-26.md`,
TFP-257), but only the current `main` branch is supported. Fixes are not
backported.

## Security model

TestForge is a **local, single-user developer tool**. It is not designed to
be deployed, shared on a network or exposed to the internet.

- **It executes code by design.** `POST /api/run` runs the Playwright suite
  it is given, as the user who started TestForge, with that user's file and
  network access. This is the product working as intended under the local
  model (Phase 16, `docs/decisions/phase-16-local-first-decision-record.md`),
  not a bug to be patched. There is no login, no multi-user isolation and
  no sandbox.
- **So the server must only be reachable from the tester's own machine.**
  TestForge listens on `127.0.0.1` only, and its API refuses requests whose
  `Host` or `Origin` isn't TestForge's own local address and writes
  (`POST`, `PUT`, `PATCH`, `DELETE`) whose body isn't `application/json`,
  so a web page open in the same browser
  can't drive it. Don't override the address, and don't put it behind a
  tunnel, a reverse proxy or port forwarding: anyone who can reach the port
  can run code on the machine.
- **Its test targets are local too.** The optional Docker stacks (Plane,
  MinIO, the local Toolshop copies) are for testing only, and publish their
  ports on `127.0.0.1` only (MinIO 9000 and 9090, Plane's 80, the Toolshop's
  4200, 8091, 8000 and 3306). Don't change the bound address. Their committed
  credentials (`.env.development`, `docker-compose.yml`, and Testsmith's
  MariaDB root password `root`) are well-known development placeholders, not
  secrets; change them, in `.env` for Plane, before running either stack
  anywhere else.

### What TestForge does to limit harm

| Area | What it does | Where |
|---|---|---|
| Generated tests | Read-only by default: a request guard blocks non-GET traffic to the target unless a run turns on the interactive gate; data-changing and attack-shaped tests need a typed ownership confirmation (Phase 43, not yet built: until then they don't run) | `src/lib/run/`, `docs/decisions/phase-38-*`, `phase-43-*` |
| Model-written tests | Restricted to the page and `expect`: imports, Node APIs, non-GET requests, routes and code built at run time are refused before running. **This is a filter, not a sandbox**; the Docker sandbox is Phase 45 | `src/lib/gap-writer/`, `docs/decisions/phase-45-*` |
| The gap writer | Calls the Claude Code CLI with every tool and MCP server off, from an empty temporary folder, with the page's text marked as untrusted data | `src/lib/gap-writer/writers.ts` |
| Child processes | Every Playwright run gets only the environment Playwright needs: no API keys, tokens or TestForge settings | `src/lib/run/child-env.ts` |
| Credentials | Login credentials come only from environment variables; they're redacted from every report, log and saved file; a run's signed-in session file lives in a per-run folder outside the evidence and is deleted when the run's process ends | `src/lib/run/auth.ts`, `redact.ts`, `docs/decisions/phase-20-*` |
| Load on target sites | Hosts other than local ones are capped: at most 3 workers sharing 5 requests per second | `src/lib/run/host-limits.ts`, `request-cap.ts` |
| Local data | Run history, site suites and candidates (target URLs and page structure; from Phase 43, ownership confirmations and their contact email) stay in the local data folder, never in the repo | `src/lib/storage/data-dir.ts` |
| Browser hardening of the UI | Content-Security-Policy without `unsafe-eval` in production, `frame-ancestors 'none'` | `next.config.ts` |

### Testing other people's sites

TestForge sends real traffic to the sites it tests. Only test sites you own
or have permission to test, or the public practice sites listed in
`docs/decisions/practice-site-targets-2026-10-19.md`. Standard runs are
designed not to be intrusive, but they are still automated traffic.

### Known gaps

- No sandbox for generated or model-written code until Phase 45.
- Dependencies are watched, not fixed for you: Dependabot alerts are on, and
  the nightly fails on a high or critical advisory in the app's own
  dependencies (`npm audit --omit=dev`). Dev tooling isn't checked: Allure's
  and ESLint's chains carry advisories `npm audit fix` can't clear.
