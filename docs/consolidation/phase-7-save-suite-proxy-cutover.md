# Phase 7 - /api/save-suite Proxy Cutover

Goal: migrate save-suite endpoint safely with opt-in backend forwarding.

## Change implemented

- Updated Next.js route handler:
  - src/app/api/save-suite/route.ts
- Behavior:
  - If TESTFORGE_BACKEND_BASE_URL is configured, POST /api/save-suite proxies to external backend /api/save-suite.
  - If TESTFORGE_BACKEND_BASE_URL is not configured, existing local save behavior remains unchanged.

## Why this is safe

- Default local behavior remains unchanged.
- Proxy path is additive and opt-in.
- Response status/body are transparently forwarded from backend.

## Non-goals in this phase

- No migration of /api/run yet.
- No frontend UI behavior changes.

## Validation checklist

- lint passes
- build passes
- self test passes
