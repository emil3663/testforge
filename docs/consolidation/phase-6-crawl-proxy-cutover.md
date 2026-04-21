# Phase 6 - /api/crawl Proxy Cutover

Goal: migrate crawl lifecycle endpoints safely with opt-in backend forwarding.

## Change implemented

- Updated Next.js route handler:
  - src/app/api/crawl/route.ts
- Behavior:
  - If TESTFORGE_BACKEND_BASE_URL is configured:
    - POST /api/crawl proxies to external backend /api/crawl
    - GET /api/crawl?crawlId=... proxies to external backend /api/crawl?crawlId=...
    - DELETE /api/crawl proxies to external backend /api/crawl
  - If TESTFORGE_BACKEND_BASE_URL is not configured, existing local crawl lifecycle logic remains unchanged.

## Why this is safe

- Default local behavior remains unchanged.
- Proxy path is additive and opt-in.
- Response status/body are transparently forwarded from backend.

## Non-goals in this phase

- No migration of /api/run or /api/save-suite.
- No frontend UI behavior changes.

## Validation checklist

- lint passes
- build passes
- self test passes
