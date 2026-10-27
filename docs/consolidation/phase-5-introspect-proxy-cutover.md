> **Historical (April 2026).** This describes the consolidation from the FastAPI backend to Next.js. Phase 16 (2026-08-28) deleted the FastAPI backend, the backend-proxy layer and the legacy UI this plan refers to; nothing here describes TestForge today. Kept for history only — see [`README.md`](README.md).

# Phase 5 - /api/introspect Proxy Cutover

Goal: migrate the introspection endpoint safely with opt-in backend forwarding.

## Change implemented

- Updated Next.js route handler:
  - src/app/api/introspect/route.ts
- Behavior:
  - If TESTFORGE_BACKEND_BASE_URL is configured, POST /api/introspect proxies to external backend /api/introspect.
  - If TESTFORGE_BACKEND_BASE_URL is not configured, existing local Playwright introspection logic remains unchanged.

## Why this is safe

- Default local behavior remains unchanged.
- Proxy path is additive and opt-in.
- Response status/body are transparently forwarded from backend.

## Non-goals in this phase

- No migration of /api/run, /api/crawl, or /api/save-suite.
- No frontend UI behavior changes.

## Validation checklist

- lint passes
- build passes
- self test passes
