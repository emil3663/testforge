# Changelog

What changed in Mr Onion, for someone using it. Each entry links the
decision record behind it; [`docs/decisions/README.md`](docs/decisions/README.md)
indexes them all.

**Versioning** (TFP-257, decided 2026-10-27): semantic versioning, below 1.0
while the report format can still change. The minor version goes up when a
phase completes; the patch version for fixes between phases. 1.0 comes when
the report and the CI command are declared stable, after Phase 47.

## [Unreleased]

### Renamed: TestForge is now Mr Onion (0.3.0)

The app, its reports, the command, the settings, the data folder, the
GitHub repo and the Claude Code plugin all take the new name
([Phase 48](docs/decisions/phase-48-rename-to-mr-onion-decision-record.md)).
Ticket and test IDs, saved runs, baselines and site suites are unchanged.

- **The command is `mr-onion`** (`mr-onion run`, `npm run mr-onion`). The
  default output folder is `./mr-onion-out`. `testforge` and
  `npm run testforge` still work until 1.0: they print one line saying the
  name has changed, then run the same command with the same exit code.
- **Settings are named `MRONION_*`** in place of `TESTFORGE_*`, with the
  rest of each name unchanged (`MRONION_DATA_DIR`, `MRONION_OLLAMA_MODEL`,
  ...). The old names still work until 1.0, with one notice per setting
  naming both. If both are set, the new one wins, unless the new one is
  blank. Every setting Mr Onion sets for a run reaches its tests under both
  names, so a suite saved before the rename runs as it did, interactive tests
  included.
- **The data folder moves once.** On the first start, `%LOCALAPPDATA%\TestForge`
  becomes `%LOCALAPPDATA%\MrOnion` (macOS: `~/Library/Application Support/MrOnion`;
  Linux: `~/.local/share/mr-onion`). Your runs, site suites and candidates
  move with it, and one notice says where they went. A folder you set
  yourself (`--data-dir`, `MRONION_DATA_DIR` or `TESTFORGE_DATA_DIR`) is
  never moved. If the move can't happen (a file in the folder held open),
  the old folder is used and the next start tries again.
- **Generated suites say Mr Onion.** Their header, the setting they check
  (`MRONION_INTERACTIVE`), and the test data and probe routes they send to
  a site use the new name.
- **The local model's tag is `mr-onion-qwen7b`**, built from
  `ollama/Modelfile.mr-onion-qwen7b`. A model you built as
  `testforge-qwen7b` is used when the new tag is missing, and the
  generation record says so; `ollama cp testforge-qwen7b mr-onion-qwen7b`
  gives it the new name with no rebuild.
- **Reinstall the Claude Code plugin.** It is now `mr-onion-skills` in
  `mr-onion-skills-marketplace`. Once your checkout has the renamed
  marketplace, `testforge-skills@testforge-skills-marketplace` no longer
  resolves ("not found in marketplace"). Updating the marketplace isn't
  enough, as it keeps its old registered name; remove it and add it again,
  from your checkout's folder:

  ```sh
  claude plugin uninstall testforge-skills@testforge-skills-marketplace
  claude plugin marketplace remove testforge-skills-marketplace
  claude plugin marketplace add <your checkout>
  claude plugin install mr-onion-skills@mr-onion-skills-marketplace
  ```

  (In Claude Code, the same with `/plugin`.) The skills are the same twelve,
  and the repo's `.claude/settings.json` enables the new name.
- **The repo is `github.com/emil3663/mr-onion`.** Old links and clones
  redirect.
- **Going back to 0.2.x** reads only the old data folder, which has moved.
  Set `TESTFORGE_DATA_DIR` to the moved folder (`%LOCALAPPDATA%\MrOnion` and
  so on) so 0.2.x finds your runs and suites.

### Security

- Plane, MinIO and the local Toolshop copies answer on this machine only.
  MinIO's console and the Toolshop's MariaDB were open to the local network,
  with credentials that are defaults in a public repo
  ([TFP-260](docs/decisions/workflow-and-ci-backlog-2026-10-26.md)).
- Claude Code as the gap writer no longer loads this machine's CLAUDE.md,
  auto memory or hooks
  ([TFP-209](docs/decisions/post-phase-42-review-plan.md)).

### Changed

- A run's environment now passes on `HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY`
  and `NODE_EXTRA_CA_CERTS` when they are set. Mr Onion doesn't yet set
  Playwright's own proxy option, so this hasn't been shown to carry a run
  through a proxy ([TFP-209](docs/decisions/post-phase-42-review-plan.md)).

### Fixed

- Starting a run now clears `artifacts-<id>` folders left by interrupted runs:
  older than an hour, of no active run, and needed by no saved run. A folder
  whose saved run can't be read is kept
  ([TFP-242](docs/decisions/post-phase-42-review-plan.md)).
- A failed check on a shared page no longer lists its `error-context.md`
  twice, one link of which answered HTTP 400. Runs saved before this keep the
  broken link; the working one still serves the file
  ([TFP-243](docs/decisions/post-phase-42-review-plan.md)).

## [0.2.0] — 2026-10-31

The first tagged version.

### Which TestForge found this

- `/api/health`, each run's `run.json` and the report's last line now give
  the TestForge version and commit that ran it. Runs from before say the
  version wasn't recorded ([TFP-257](docs/decisions/workflow-and-ci-backlog-2026-10-26.md)).

### Security

- Next.js 16.4.3 (from 16.2.3), which fixes the 33 advisories on
  `next`, among them Proxy bypasses and remote code execution on
  Windows-hosted servers. The app's own
  dependencies have no known advisory, and the nightly fails if a high or
  critical one appears ([TFP-266](docs/decisions/workflow-and-ci-backlog-2026-10-26.md)).
- A `.rsc` or segment-prefetch spelling of an API path can't reach the API
  from another site or host: each is pinned in the regression suite
  (TFP-266).
- Code scanning moved to a committed setup that ignores frozen evidence:
  no alert is left open that isn't dismissed with a reason
  ([TFP-267](docs/decisions/workflow-and-ci-backlog-2026-10-26.md)).

### Fixed

- A link with no text whose address holds `"` or `\` no longer fails its
  check on TestForge's own error instead of the site's (TFP-267).
- DemoQA's suites go only to DemoQA itself, not to a host that merely
  contains its name, and a journey step's attribute name is escaped for
  CSS whatever it holds (TFP-267).
- Run ids are held inside the runs folder on every path, and a stray folder
  there is passed over (TFP-267).

### Run speed and honest capped runs (Phase 39)

- A page's read-only checks, from every area, share one visit of the page
  instead of loading it once per check; shared checks wait 2 s, not 5 s, for
  an assertion; a failing shared check keeps its trace, screenshot and the
  visit's video.
- A suite runs as several files across workers; data-changing tests run one
  at a time, after the read-only ones.
- Workers and request rate are set by host: a local host gets the machine's
  limit; any other host gets at most 3 workers sharing 5 requests per
  second, and timed checks (load, LCP, CLS, TBT) are Not run there, with
  the reason. The ownership confirmation (Phase 43) will lift the cap.
- The run record says where the run's time went.
- At most 3 workers on any host: 6 overloaded a modest local site and
  changed its results.
- On a capped host, a test the request cap starved is reported **Not run,
  "starved by the request cap"**, with its wait, not Failed; real defects
  stay Failed. Tests no longer fail with `AbortError` when their context
  closes while requests wait. The cap is proven at the server: never more
  than 5 arrivals in a second.
- Record: [`phase-39-run-concurrency-decision-record.md`](docs/decisions/phase-39-run-concurrency-decision-record.md).

## [0.1.0] — untagged starting point

*Not tagged (owner decision, 2026-10-28): Phase 39 completes before the
version stamp lands, so the first tag is `v0.2.0`. This entry stays as the
baseline it describes.*

Everything built from Phase 16 to Phase 42,
except Phase 39 (above). Before this, Phases 1–15 (April 2026) moved
TestForge from a FastAPI backend to Next.js ([history](docs/consolidation/README.md)).

### Security
- **The API answers only the tester's own pages on this machine.**
  TestForge listens on `127.0.0.1`, and every `/api/*` request is refused
  unless its `Host` is local, its `Origin` is TestForge's own, and a write is
  JSON. Before this, any device on the network, and possibly a web page open
  in the same browser, could make TestForge run code (TFP-261). See
  [`SECURITY.md`](SECURITY.md).
- Credentials for authenticated runs come only from environment variables,
  are redacted everywhere, and the signed-in session is deleted when its run
  ends (Phase 20).
- Child test processes get only the environment Playwright needs; no keys or
  tokens (Phase 42).

### Running a site
- **Local-only, Chromium-only, one Next.js app.** The FastAPI backend, the
  proxy layer and cross-browser projects are gone
  ([Phase 16](docs/decisions/phase-16-local-first-decision-record.md)).
- **Page types.** The crawl groups pages by address pattern and form
  signature; Standard tests one page of each type, up to 8, and the report
  names the types covered and skipped. A pasted list of URLs re-runs exactly
  those pages ([Phase 40](docs/decisions/phase-40-page-type-selection-decision-record.md)).
- **Standard and Comprehensive runs.** Standard is the critical working path.
  Comprehensive goes deep on one area; security (passive) and accessibility
  are built, the other areas are planned
  ([Phase 35](docs/decisions/phase-35-comprehensive-testing-decision-record.md)).
- **Three gates.** Read-only by default, behind a request guard; interactive
  when switched on; active (data-changing, attack-shaped) only behind an
  ownership confirmation, which isn't built yet, so active tests are Not run
  ([Phase 38](docs/decisions/phase-38-standard-run-gates-and-conformance-decision-record.md)).
- **Authenticated runs** through a configured automation account
  ([Phase 20](docs/decisions/phase-20-authenticated-testing-decision-record.md);
  [setup](docs/AUTOMATED_ACCOUNT_SETUP.md)).

### What gets tested
- Functional controls on read-only pages (sorts, filters, steppers, option
  lists, link destinations), every link on the selected pages, layout and
  overlap, images that don't render, spelling, keyboard order and grouping,
  read-only security probes and API fields with internal-sounding names
  ([Phase 41](docs/decisions/phase-41-check-gaps-decision-record.md)).
- Passive security headers, the axe WCAG 2.2 A/AA scan, baseline SEO, and
  performance graded in Core Web Vitals bands — a result that misses the
  target but isn't poor is an improvement, not a failure
  ([Phase 38](docs/decisions/phase-38-standard-run-gates-and-conformance-decision-record.md)).
- Every outbound dependency a page uses gets a failure-injection test
  ([Phase 18](docs/decisions/phase-18-integration-mapping-decision-record.md)).
- Paths and journeys through the site, opt-in per run
  ([Phase 19](docs/decisions/phase-19-path-journey-mapping-decision-record.md)).
- Measured on local copies of the Toolshop practice site with 37 known bugs
  in reach: Standard finds 30; with Comprehensive security and
  accessibility, 33.

### Reports and history
- **Honest coverage:** measured against everything the crawl and inspection
  found, with a "not tested, and why" section; runs saved to disk, survive a
  restart, and two runs of a site can be compared test by test
  ([Phase 17](docs/decisions/phase-17-run-persistence-decision-record.md)).
- **A coverage map**, element by element, and a gap list of what no test
  touches ([Phase 42](docs/decisions/phase-42-reusable-suites-and-gap-tests-decision-record.md)).
- A run's evidence is kept until its failures are shown fixed by a later run
  (TFP-198, GitHub issue #2).

### Reuse instead of regeneration
- Each site's Standard suite is saved and reused; only changed page types
  are regenerated, and a reused test that fails on a changed page is
  regenerated and re-run before it counts.
- A library of tests written against component patterns, applied to any
  site that has the pattern.
- Opt-in gap tests for uncovered elements, written by Claude Code (with its
  tools off) or a local model, kept as candidates and promoted to the
  library only with the tester's approval
  ([Phase 42](docs/decisions/phase-42-reusable-suites-and-gap-tests-decision-record.md)).

### Generation
- The deterministic template generator is the default and needs no API key.
- An optional local model (Ollama) fills only areas the template leaves
  empty, labelled and kept apart
  ([Phases 30–34, 36, 37](docs/decisions/README.md)). The OpenAI path exists
  but is parked (Phase 28).

### Also
- In-app help for non-technical users (Phase 26).
- The `testforge-skills` Claude Code plugin: 12 testing and engineering
  skills, usable without the app ([`skills/README.md`](skills/README.md)).

[Unreleased]: https://github.com/emil3663/mr-onion/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/emil3663/mr-onion/releases/tag/v0.2.0
