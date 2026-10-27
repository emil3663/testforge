# Consolidation (April 2026) — historical

These twelve documents planned and recorded TestForge's first restructuring,
in April 2026: moving the UI and every API route from a FastAPI backend to
Next.js, behind a backend-proxy layer that was cut over route by route
(Phases 1–12), then environment config, health and observability, and
security headers (Phases 13–15, commits only).

**None of it describes TestForge today.** Phase 16 (2026-08-28,
`../decisions/phase-16-local-first-decision-record.md`) deleted the FastAPI
backend (`app.py`, `requirements.txt`, `templates/index.html`), the
backend-proxy layer and `TESTFORGE_BACKEND_BASE_URL`, and made TestForge a
local-only Next.js app. In particular, `phase-12-ci-cd-pipeline.md` is the
CI plan for that earlier architecture; TestForge's CI now is
`.github/workflows/`, and running TestForge inside another project's
pipeline is proposed as Phase 47 (`../decisions/workflow-and-ci-backlog-2026-10-26.md`).

The files are kept because the decision records cite them and because they
show how the codebase got here. Don't plan from them.

| Phase | Document |
|---|---|
| 1 | [`phase-1-parity-checklist.md`](phase-1-parity-checklist.md) |
| 2 | [`phase-2-api-contract.md`](phase-2-api-contract.md) |
| 3 | [`phase-3-foundation.md`](phase-3-foundation.md) |
| 4–8 | Proxy cutovers: [generate](phase-4-generate-proxy-cutover.md), [introspect](phase-5-introspect-proxy-cutover.md), [crawl](phase-6-crawl-proxy-cutover.md), [save-suite](phase-7-save-suite-proxy-cutover.md), [run](phase-8-run-proxy-cutover.md) |
| 9 | [`phase-9-legacy-ui-deprecation-toggle.md`](phase-9-legacy-ui-deprecation-toggle.md) |
| 10 | [`phase-10-cutover-runbook.md`](phase-10-cutover-runbook.md) |
| 11 | [`phase-11-legacy-ui-removal.md`](phase-11-legacy-ui-removal.md) |
| 12 | [`phase-12-ci-cd-pipeline.md`](phase-12-ci-cd-pipeline.md) |
