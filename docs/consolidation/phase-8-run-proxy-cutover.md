> **Historical (April 2026).** This describes the consolidation from the FastAPI backend to Next.js. Phase 16 (2026-08-28) deleted the FastAPI backend, the backend-proxy layer and the legacy UI this plan refers to; nothing here describes TestForge today. Kept for history only — see [`README.md`](README.md).

# Phase 8 - /api/run Proxy Cutover

Goal: migrate run lifecycle endpoints safely with opt-in backend forwarding.

## Change implemented

- Updated Next.js route handler:
  - src/app/api/run/route.ts
- Behavior:
  - If TESTFORGE_BACKEND_BASE_URL is configured:
    - POST /api/run proxies to external backend /api/run
    - GET /api/run?runId=... proxies to external backend /api/run?runId=...
    - DELETE /api/run proxies to external backend /api/run
    - GET /api/run?runId=...&artifactId=... forwards binary artifact downloads from backend while preserving content headers
  - If TESTFORGE_BACKEND_BASE_URL is not configured, existing local run lifecycle logic remains unchanged.

## Why this is safe

- Default local behavior remains unchanged.
- Proxy path is additive and opt-in.
- Response status/body are transparently forwarded.
- Artifact download path preserves binary transport and content-disposition headers.

## Non-goals in this phase

- No changes to frontend UI behavior.
- No removal of local run engine.

## Validation checklist

- lint passes
- build passes
- self test passes
