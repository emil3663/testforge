# Changelog

What changed in TestForge, for someone using it. Each entry links the
decision record behind it; [`docs/decisions/README.md`](docs/decisions/README.md)
indexes them all.

**Versioning** (TFP-257, decided 2026-10-27): semantic versioning, below 1.0
while the report format can still change. The minor version goes up when a
phase completes; the patch version for fixes between phases. 1.0 comes when
the report and the CI command are declared stable, after Phase 47.

## [Unreleased]

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

[Unreleased]: https://github.com/emil3663/testforge/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/emil3663/testforge/releases/tag/v0.2.0
