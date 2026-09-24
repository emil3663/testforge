# TestForge — what it actually does

*Living doc, 2026-09-24 — sits alongside `docs/decisions/product-roadmap.md`
(the phase-by-phase decision ledger, deliberately kept as a static outline
per its own header) and `TEST_PLAN.md` (case-by-case status). This doc is
the "what is this, roughly, right now" answer; point new readers here
first.*

## In one paragraph

TestForge is an AI-native test automation assistant with a single Next.js
front end. Point it at a target site, and it crawls and introspects the
site, generates and runs real Playwright test suites against it, and
returns a structured report — one that says not just pass/fail, but what
was actually tested, how, and honestly what wasn't tested and why. It's
local-only today, not a deployed service (Phase 16 decision; a hosted
version is deferred, not cancelled).

## The core idea: honest coverage

The report's coverage number isn't "percentage of generated tests that
passed." It's built from a discovered-surface model (Phase 17): everything
crawl and introspect find on the target — every link, form, button,
outbound dependency — is the denominator, and tested / not-tested-and-why
is measured against that real surface, not against whatever subset
happened to get a generated test.

## What it can test

- **Functional and accessibility surface**, page by page.
- **Integration points** (Phase 18) — every outbound dependency a page
  talks to (network calls, third-party scripts, iframes, storage APIs)
  gets a failure-injection test asserting the page degrades rather than
  breaks.
- **Full paths and journeys** (Phase 19) — a walkable site graph built
  from the same crawl/introspect data, candidate journeys surfaced for
  review, generated end-to-end tests that walk a selected path.
  Interactive by nature, so skipped by default, explicitly enabled per
  run.
- **The logged-in state of a site** (Phase 20) — a config-driven
  automation account (login URL + field selectors, supplied once), session
  cached and reused across a run's generated tests, never persisted to
  disk. Deliberately config-driven, not auto-discovered.

## How it generates tests

The deterministic, no-API-key generator is the foundation and the default
— every capability above works without any AI API key. An OpenAI-backed
path already exists in the code (`/api/generate` calls `gpt-4o` when
`OPENAI_API_KEY` is set) but has never run in CI and isn't yet evaluated
against the deterministic path — that evaluation is Phase 21, not started
as of this doc (see `docs/decisions/phase-21-ai-assisted-generation-decision-record.md`).

## Architecture, as of 2026-09-24

- Next.js UI (`src/app/page.tsx`, 439 lines) as the single front end — no
  separate backend service; the FastAPI backend and a template-based UI
  layer were deleted in the Phase 16 restructuring.
- `/api/generate` (`src/app/api/generate/route.ts`, 72 lines) builds the
  test suite, with the prompt itself isolated in `src/lib/generate/prompt.ts`
  (29 lines); `/api/run` (`src/app/api/run/route.ts`, 182 lines) executes
  it against Chromium via Playwright.
- Local-only by design: `/api/run` executing arbitrary generated code is an
  accepted risk under that model, not an oversight.

*(Line counts move — Phase 19/20 both added real UI, so these will drift
again. Worth a quick `wc -l` before quoting them as current in anything
long-lived.)*

## Relationship to `skills/`

A separate, parallel track, not a replacement of the app above — the
option to rewrite TestForge into pure Claude Code skills was considered
and declined (`docs/REIMAGINING.md` / `REIMAGINING-RESPONSE.md`). Instead,
`skills/` grew alongside the app: 12 skills across `skills/testing/` and
`skills/engineering/`, generalizing techniques TestForge already uses,
packaged as a real installable Claude Code plugin
(`skills/.claude-plugin/plugin.json`). A further `skills/proposed/` holds a
set of SRE-oriented skills not yet promoted. The two tracks are versioned
and picked up independently.

## Where to look next

- Phase-by-phase decisions and status: `docs/decisions/` (start with
  `product-roadmap.md`, then the specific phase's decision record).
- The skills catalog and status: `skills/ROADMAP.md`, `docs/CLAUDE_SKILLS.md`.
- Manual test cases and known limitations: `TEST_PLAN.md`.

---

*This draft was built from the decision records and git history, not a
full line-by-line code read — the Architecture section above was
spot-checked (`wc -l` on the three files named), but treat anything else
here as a starting point worth a skim against the real code before leaning
on it hard.*
