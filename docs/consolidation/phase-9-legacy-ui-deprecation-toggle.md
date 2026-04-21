# Phase 9 - Legacy UI Deprecation Toggle

Goal: move toward a single Next.js UI while avoiding abrupt breakage for existing users of the legacy FastAPI page.

## Change implemented

- Updated FastAPI entrypoint:
  - app.py
- Added environment controls:
  - TESTFORGE_DISABLE_LEGACY_UI
  - TESTFORGE_NEXT_UI_URL
- Behavior:
  - Default: legacy FastAPI UI remains available on GET /.
  - If TESTFORGE_DISABLE_LEGACY_UI=true: GET / returns a 307 redirect to TESTFORGE_NEXT_UI_URL (default <http://localhost:3000>).

## Why this is safe

- No default behavior change for existing local workflows.
- Transition can be enabled per environment with a single env toggle.
- Makes single-UI migration explicit and reversible.

## Non-goals in this phase

- No removal of legacy FastAPI generate/run endpoints.
- No frontend UI feature changes.

## Validation checklist

- lint passes
- build passes
- self test passes
