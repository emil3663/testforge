> **Historical (April 2026).** This describes the consolidation from the FastAPI backend to Next.js. Phase 16 (2026-08-28) deleted the FastAPI backend, the backend-proxy layer and the legacy UI this plan refers to; nothing here describes TestForge today. Kept for history only — see [`README.md`](README.md).

# Phase 1 - Capability Parity Checklist

Goal: establish a complete inventory of current functionality before migration so no behavior is lost.

## Current Surfaces

- Next.js UI: src/app/page.tsx
- Next.js API routes: src/app/api/*/route.ts
- Legacy FastAPI UI/API: app.py + templates/index.html
- Regression coverage focused on Next.js API behavior: tests/regression/testforge.sections.spec.ts

## Endpoint Inventory

| Endpoint | Implemented In | Purpose | Status For Consolidation |
|---|---|---|---|
| GET / | app.py (legacy template UI) | Serves legacy HTML app | Legacy-only; plan deprecate after parity |
| POST /api/generate | app.py | Generate Python Playwright code | Legacy-only API contract |
| POST /api/run | app.py | Execute generated Python test | Legacy-only API contract |
| POST /api/generate | src/app/api/generate/route.ts | Generate TypeScript Playwright suite with best-practice + content-aware options | Primary target |
| POST /api/run | src/app/api/run/route.ts | Async run lifecycle, structured report, artifacts, reruns | Primary target |
| GET /api/run?runId=... | src/app/api/run/route.ts | Poll run status/progress | Primary target |
| DELETE /api/run | src/app/api/run/route.ts | Cancel active run | Primary target |
| POST /api/crawl | src/app/api/crawl/route.ts | Crawl site pages async | Primary target |
| GET /api/crawl?crawlId=... | src/app/api/crawl/route.ts | Poll crawl status/progress | Primary target |
| DELETE /api/crawl | src/app/api/crawl/route.ts | Cancel crawl | Primary target |
| POST /api/introspect | src/app/api/introspect/route.ts | Inspect pages for headings/text/links/actionables | Primary target |
| POST /api/save-suite | src/app/api/save-suite/route.ts | Save generated suites to .playwright-runs | Primary target |

## UI Feature Parity Matrix

| Capability | Next.js UI (src/app/page.tsx) | FastAPI UI (templates/index.html) | Parity Risk |
|---|---|---|---|
| Generate suite | Yes | Yes | Low |
| Edit/copy generated code | Yes | Yes | Low |
| Run suite | Yes | Yes | Low |
| Async run progress + cancel | Yes | No | High |
| Structured report tabs (summary/execution/defects/coverage/performance/usability/seo) | Yes | No | High |
| Crawl pages + selection/filter | Yes | No | High |
| Introspect + content-aware rules | Yes | No | High |
| Save suite to explorer | Yes | No | Medium |
| Rerun failed selection | Yes | No | Medium |
| Artifact download linkage | Yes | No | High |

## Data Contract Differences To Preserve

- Legacy run response (FastAPI): passed/output/duration only.
- Next.js run flow: runId + polling + rich result.report object + artifact references.
- Legacy generate request: baseUrl + description.
- Next.js generate request: baseUrl + description + selectedPractices + auditMode + contentRules + contentProfile.

## Phase 1 Decisions

- Canonical user-facing UI will be Next.js only.
- Canonical feature contract to preserve is the richer Next.js contract, not the legacy FastAPI template contract.
- FastAPI UI route (GET /) is marked for eventual deprecation after migration gates pass.

## Migration Guardrails

- Do not remove legacy FastAPI routes yet.
- Do not change Next.js response shapes during Phase 2.
- Every migrated endpoint must pass lint/build and existing regression tests before next phase.

## Exit Criteria For Phase 1

- Full inventory documented (this file).
- Canonical contracts and deprecation targets identified.
- Stakeholder review and sign-off before Phase 2 begins.
