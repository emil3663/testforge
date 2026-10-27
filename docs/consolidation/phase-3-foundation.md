> **Historical (April 2026).** This describes the consolidation from the FastAPI backend to Next.js. Phase 16 (2026-08-28) deleted the FastAPI backend, the backend-proxy layer and the legacy UI this plan refers to; nothing here describes TestForge today. Kept for history only — see [`README.md`](README.md).

# Phase 3 - Foundation (No Behavior Change)

Goal: add migration-safe plumbing so endpoint cutover can happen incrementally in later phases.

## What was added

- Shared server utility for backend URL resolution and JSON proxy scaffolding.
  - File: src/lib/backend-proxy.ts
- Optional environment variable documentation for backend routing.
  - File: .env.example
  - Variable: TESTFORGE_BACKEND_BASE_URL

## Behavior impact

- No runtime endpoint behavior was changed in this phase.
- Existing Next.js API handlers continue to execute their current logic.
- The new proxy utility is additive and prepared for later endpoint-by-endpoint migration.

## Why this phase exists

- Keeps future migrations small and reversible.
- Avoids repeating URL/JSON proxy logic in each route handler.
- Allows toggling backend forwarding with a single env variable in later phases.

## Exit criteria

- Lint passes.
- Build passes.
- Only Phase 3 files are changed.
