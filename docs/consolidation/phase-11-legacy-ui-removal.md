# Phase 11 - Legacy UI code path removal

## Goal

Complete consolidation by removing legacy FastAPI HTML UI serving behavior while preserving backend API endpoints.

## Scope

- FastAPI route `/` now always returns HTTP 307 redirect to `TESTFORGE_NEXT_UI_URL`.
- Removed `TESTFORGE_DISABLE_LEGACY_UI` configuration from `.env.example`.
- Updated README consolidation guidance to reflect permanent redirect behavior.

## Safety and compatibility

- No changes to FastAPI API endpoints (`/api/generate`, `/api/run`).
- No changes to Next.js API route behavior.
- Redirect target remains configurable via `TESTFORGE_NEXT_UI_URL`.

## Validation checklist

1. `npm run lint`
1. `npm run build`
1. `npm run test:self`
1. Verify `GET http://localhost:8000/` responds with `307` and redirects to Next.js URL.

## Rollback

1. Revert this phase commit if legacy FastAPI HTML UI must be restored.
2. Keep `TESTFORGE_NEXT_UI_URL` set for redirect behavior in consolidated mode.
