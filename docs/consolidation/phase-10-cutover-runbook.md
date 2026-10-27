> **Historical (April 2026).** This describes the consolidation from the FastAPI backend to Next.js. Phase 16 (2026-08-28) deleted the FastAPI backend, the backend-proxy layer and the legacy UI this plan refers to; nothing here describes TestForge today. Kept for history only — see [`README.md`](README.md).

# Phase 10 - Cutover Runbook and Rollback

## Goal

Provide a safe operator runbook for switching to single-UI mode while keeping rollback immediate and low risk.

## Scope

- No behavioral code changes.
- Document production-like cutover settings.
- Define explicit verification and rollback steps.

## Required environment variables

Set these in `.env` for single-UI cutover:

- TESTFORGE_BACKEND_BASE_URL=<http://localhost:8000>
- TESTFORGE_DISABLE_LEGACY_UI=true
- TESTFORGE_NEXT_UI_URL=<http://localhost:3000>

## Cutover procedure

1. Ensure the backend (FastAPI) is running and reachable.
1. Ensure the Next.js app is running at `http://localhost:3000`.
1. Apply the required environment variables.
1. Restart application processes.
1. Validate core workflows from Next.js UI:
   - Generate
   - Introspect
   - Crawl
   - Save suite
   - Run and fetch artifacts
1. Validate legacy UI deprecation behavior:
   - Request `http://localhost:8000/`
   - Confirm HTTP 307 redirect target is Next.js URL

## Rollback procedure

1. Set TESTFORGE_DISABLE_LEGACY_UI=false.
1. Restart FastAPI process.
1. Verify `http://localhost:8000/` serves the legacy UI.
1. If needed, unset TESTFORGE_BACKEND_BASE_URL to return Next.js API routes to local fallback behavior.

## Acceptance criteria

- Operators can perform cutover without code changes.
- Redirect behavior is deterministic and reversible.
- Existing lint/build/self-test checks remain green.
