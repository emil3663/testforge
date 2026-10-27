> **Historical (April 2026).** This describes the consolidation from the FastAPI backend to Next.js. Phase 16 (2026-08-28) deleted the FastAPI backend, the backend-proxy layer and the legacy UI this plan refers to; nothing here describes TestForge today. Kept for history only — see [`README.md`](README.md).

# Phase 4 - /api/generate Proxy Cutover

Goal: migrate one endpoint safely by introducing optional backend forwarding while preserving default behavior.

## Change implemented

- Updated Next.js route handler:
  - src/app/api/generate/route.ts
- Behavior:
  - If TESTFORGE_BACKEND_BASE_URL is configured, POST /api/generate proxies to external backend /api/generate.
  - If TESTFORGE_BACKEND_BASE_URL is not configured, existing in-process generate logic is unchanged.

## Why this is safe

- Default local behavior remains identical (env var unset).
- Proxy path is additive and opt-in.
- Response status/body are transparently forwarded from backend.

## Non-goals in this phase

- No migration of /api/run, /api/crawl, /api/introspect, or /api/save-suite yet.
- No changes to frontend UI behavior.

## Validation checklist

- lint passes
- build passes
- self test passes
