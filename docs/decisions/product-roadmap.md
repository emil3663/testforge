# TestForge Product Roadmap

**Version:** 1.0
**Date:** 2026-08-28
**Status:** Draft — phase outlines only; each phase is locked by its own decision
record before implementation starts

This document is the map across phases. It does not replace
`docs/decisions/phase-16-local-first-decision-record.md` or
`docs/decisions/phase-16-implementation-backlog.md`, which remain the locked,
ticket-level source for the work in progress now. Phases 17–21 below are
intentionally one paragraph each — they get their own decision record and
backlog when they are actually picked up, in the same style as Phase 16.

## Product Vision

TestForge tests any website with reproducible results, and shows what was
tested and how — not just what passed. A tester describes what to check in
plain English or picks from best-practice coverage areas; TestForge crawls the
site, inspects what's actually on each page, and generates a deterministic
Playwright suite from that inspection — no AI required for the core product.
Runs, evidence and coverage are persisted so two runs of the same site can be
compared and trusted. Later phases extend this to the dependencies a page
talks to, the paths a user can walk through it, and the logged-in state where
most real functionality lives. An AI-assisted generation path and a hosted
SaaS version are both deliberate, deferred extensions of this same foundation
— not the foundation itself.

## Current Functionality (Baseline, pre-Phase 16)

- Next.js UI; crawl, introspect, generate, run and report as five API routes.
- Deterministic suite generation from crawled/introspected pages plus
  best-practice coverage selection — no OpenAI key required.
- Optional OpenAI-backed generation as an alternate path (untested in CI,
  deferred as a product priority — see Phase 21).
- Async run lifecycle with live progress, cancellation, targeted rerun, and a
  seven-tab report with HTML export.
- Run state is in-memory only; nothing persists across a server restart.
- Coverage is computed from the tests that ran, not against a discovered
  surface — see Phase 17.
- Legacy FastAPI backend and a backend-proxy layer, both being removed in
  Phase 16.

## Scope

### In scope (locked for Phase 16, in progress)
1. Local-only posture; no deployment surface.
2. Removal of the FastAPI backend and the proxy layer.
3. Chromium-only execution scope.
4. Decomposition of the three oversized source files.
5. Documentation that matches the shipped product.

### In scope (roadmapped, not yet locked)
1. Persisted, comparable runs with an honest coverage denominator (Phase 17).
2. Integration-point mapping and dependency failure-injection tests (Phase 18).
3. Site path and user-journey mapping (Phase 19).
4. Authenticated testing via a dedicated automation account and a cached
   Playwright `storageState` (Phase 20).
5. AI-assisted generation evaluated against the deterministic baseline
   (Phase 21).

### Explicitly out of scope
- A deployed or hosted version of TestForge (deferred; see
  `docs/decisions/saas-prerequisites.md`, itself deferred to Phase 16D).
- Fully autonomous discovery of arbitrary login flows. Phase 20 is
  config-driven: the site owner supplies the login URL and field selectors
  once. General-purpose login-form discovery is a distinct, harder problem
  and is not assumed by this roadmap.
- Interactive tests that submit, mutate or trigger side effects by default on
  a live site. These are generated but skipped unless explicitly enabled per
  run (locked direction, formalized when Phase 18/19 tickets are written).
- API contract testing (asserting response shapes don't drift between runs).
  A natural extension of Phase 17's run persistence, but it turns TestForge
  into a contract-testing tool as well and is not assumed here.

## Development Phases

### Phase 17 — Run persistence and honest coverage
Runs get identity and land on disk: the config that produced the suite, the
suite itself, the result, and the captured evidence. Coverage is recomputed
against the discovered surface from crawl and introspect — pages, actionable
elements, selected practice areas — instead of against the tests that
happened to run, and the report gains a "not tested, and why" section.
Persisted runs unlock diffing two runs of the same site against each other.
This is the foundation every later phase depends on, including making the
AI-vs-deterministic comparison in Phase 21 measurable rather than a guess.

### Phase 18 — Integration mapping and failure injection
During crawl and introspect, TestForge records every outbound dependency a
page talks to — XHR/fetch targets, form action hosts, third-party scripts,
iframes, auth redirects, cookies set — and aggregates it into a dependency
map per site. Generated tests use Playwright's `page.route()` to block or fail
each dependency in turn and assert the page degrades gracefully rather than
breaking. This is observation plus deterministic testing, consistent with the
product's core thesis, and requires no AI. Depends on Phase 17 for the map to
extend the coverage denominator rather than living outside it.

### Phase 19 — Path and journey mapping
The page graph from crawl and the actionable elements from introspect combine
into a walkable graph of the site. TestForge surfaces likely user journeys —
sequences of pages and actions — for review, and generates tests that walk
selected paths end to end rather than page by page. Independent of Phase 18;
sequencing between the two is a scheduling choice, not a dependency.

### Phase 20 — Authenticated testing
A site owner provisions a dedicated automation account, following setup
instructions TestForge ships with the product (the same pattern used for
Selenium automation accounts: exempted from lockout, rate-limiting, MFA
interruption and new-sign-in alerts). TestForge drives a config-supplied login
flow once per run and caches the resulting Playwright `storageState`; every
generated test in that run starts already authenticated. Credentials are
referenced by name from environment or a local secret store, never inlined in
generated code, and never captured in traces, screenshots or the HTML report.
Deliberately sequenced after Phases 17–19 are proven on public surface, where
the blast radius of a mistake is zero.

### Phase 21 — AI-assisted generation as a measured alternative
The existing OpenAI-backed generation path is brought back into active
development: given CI coverage, and evaluated against the deterministic
generator on the same sites using Phase 17's run persistence and diffing.
The product decision — default generator, opt-in, or user's choice per run —
is made from that comparison rather than in advance of it.

---

## Sequencing note

Phase 16 is followed by a live walkthrough of what it actually produced —
stepping through the crawl, introspect, generate and run flow against a real
target — before Phase 17's decision record is drafted. Phase 17's scope above
is a starting outline, not a lock; the walkthrough may change what "honest
coverage" needs to mean in practice before that phase is locked.
