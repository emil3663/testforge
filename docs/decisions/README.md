# Decisions index

*Last reviewed 2026-10-27, against `main` at `6bd7fc0`.* Every file in
`docs/decisions/`, grouped by phase. **Status** is the phase's state as the
roadmap and the record agree on it; where they disagree, the note says so
and the record's own status line needs correcting.

- **The map across phases:** [`product-roadmap.md`](product-roadmap.md).
- **Everything deferred, and the build order after Phase 39:**
  [`deferred-work-register.md`](deferred-work-register.md).
- **How a phase is decided and recorded:** `../WORKING_AGREEMENTS.md`.

Kinds: **DR** decision record (locks scope before building) · **BL** backlog
(tickets) · **MR** measurement or gate report · **REF** reference or
research, nothing locked.

## Phases

| Phase | Topic | Status | Documents |
|---|---|---|---|
| 16 | Local-first: delete the FastAPI backend and proxy, Chromium only, decompose the large files | Complete (2026-08-28 to 09-17) | DR [`phase-16-local-first-decision-record.md`](phase-16-local-first-decision-record.md) · BL [`phase-16-implementation-backlog.md`](phase-16-implementation-backlog.md) |
| 17 | Run persistence and honest coverage | Complete (2026-09-22) | DR [`phase-17-run-persistence-decision-record.md`](phase-17-run-persistence-decision-record.md) · BL [`phase-17-walkthrough-backlog.md`](phase-17-walkthrough-backlog.md), [`phase-17-skills-extraction-backlog.md`](phase-17-skills-extraction-backlog.md) |
| 18 | Integration mapping and failure injection | Complete (2026-09-23) | DR [`phase-18-integration-mapping-decision-record.md`](phase-18-integration-mapping-decision-record.md) · BL [`phase-18-skills-taxonomy-backlog.md`](phase-18-skills-taxonomy-backlog.md) |
| 19 | Path and journey mapping | Complete (2026-09-24) | DR [`phase-19-path-journey-mapping-decision-record.md`](phase-19-path-journey-mapping-decision-record.md) · BL [`phase-19-dogfooding-backlog.md`](phase-19-dogfooding-backlog.md) |
| 20 | Authenticated testing | Complete (2026-09-24) | DR [`phase-20-authenticated-testing-decision-record.md`](phase-20-authenticated-testing-decision-record.md) · BL [`phase-20-remaining-skills-backlog.md`](phase-20-remaining-skills-backlog.md) |
| 21 | AI-assisted generation, measured against the template | Complete; retargeted at the local model | DR [`phase-21-ai-assisted-generation-decision-record.md`](phase-21-ai-assisted-generation-decision-record.md) · MR [`phase-21-comparison-report.md`](phase-21-comparison-report.md) · BL [`phase-21-skill-discovery-backlog.md`](phase-21-skill-discovery-backlog.md) |
| 22 | Spike: introspect and crawl vs. Playwright MCP | Spike run | BL [`phase-22-introspect-crawl-spike-backlog.md`](phase-22-introspect-crawl-spike-backlog.md) |
| 23 | Trial: release and rollback skills on test-assist | Trial complete | BL [`phase-23-release-rollback-trial-backlog.md`](phase-23-release-rollback-trial-backlog.md) |
| 24 | Reliability audit | Complete (2026-09-23) | BL [`phase-24-reliability-audit-backlog.md`](phase-24-reliability-audit-backlog.md) |
| 25 | Dogfooding against cah-pwa | Complete (2026-09-23) | BL [`phase-25-cah-pwa-dogfooding-backlog.md`](phase-25-cah-pwa-dogfooding-backlog.md) |
| 26 | In-app help | Complete (2026-09-23) | BL [`phase-26-in-app-help-backlog.md`](phase-26-in-app-help-backlog.md) |
| 27 | Sprint 3 loose ends | Complete (2026-09-23) | BL [`phase-27-sprint3-loose-ends-backlog.md`](phase-27-sprint3-loose-ends-backlog.md) |
| 28 | Harden the OpenAI path | **Parked** (2026-10-19); Gate A open | BL [`phase-28-openai-path-hardening-backlog.md`](phase-28-openai-path-hardening-backlog.md) |
| 29 | Skills maintenance: `crawl-and-classify-pages` drift | Not started; in the register's build order | BL [`phase-29-skills-maintenance-backlog.md`](phase-29-skills-maintenance-backlog.md) |
| 30 | Local (Ollama) generation path | Implemented (2026-09-24) | DR [`phase-30-local-generation-path-decision-record.md`](phase-30-local-generation-path-decision-record.md) |
| 31 | Local model tuning | Implemented (2026-09-24) | DR [`phase-31-local-model-tuning-decision-record.md`](phase-31-local-model-tuning-decision-record.md) |
| 32 | Local model follow-ups | Implemented (2026-09-24) | DR [`phase-32-local-model-followups-decision-record.md`](phase-32-local-model-followups-decision-record.md) |
| 33 | Local model category coverage | Implemented (2026-09-24) | DR [`phase-33-local-model-category-coverage-decision-record.md`](phase-33-local-model-category-coverage-decision-record.md) |
| 34 | Template coverage and additive gap-filling (Option B) | Complete (2026-09-29) | DR [`phase-34-template-coverage-and-gap-filling-decision-record.md`](phase-34-template-coverage-and-gap-filling-decision-record.md) · MR [`phase-34-option-b-measurement-report.md`](phase-34-option-b-measurement-report.md) |
| 35 | Comprehensive testing, first slice (security, accessibility) | First slice built (2026-10-01); later areas in the register | DR [`phase-35-comprehensive-testing-decision-record.md`](phase-35-comprehensive-testing-decision-record.md) · MR [`phase-35-first-slice-measurement-report.md`](phase-35-first-slice-measurement-report.md) · REF [`phase-35-security-testing-research.md`](phase-35-security-testing-research.md), [`phase-35-security-reviewer-questions.md`](phase-35-security-reviewer-questions.md) |
| 36 | Trust in results; measuring the local model | Complete (2026-09-30) | DR [`phase-36-trust-and-local-model-measurement-decision-record.md`](phase-36-trust-and-local-model-measurement-decision-record.md) · MR [`phase-36-local-model-measurement-report.md`](phase-36-local-model-measurement-report.md) · data [`data/labelled-failures.md`](data/labelled-failures.md) |
| 37 | Gap-fill prompt fix; two model gates | Complete (2026-09-30) | DR [`phase-37-gap-fill-prompt-and-model-gates-decision-record.md`](phase-37-gap-fill-prompt-and-model-gates-decision-record.md) |
| 38 | Standard run: three gates, conformance checks, performance bands | Complete (2026-10-06) | DR [`phase-38-standard-run-gates-and-conformance-decision-record.md`](phase-38-standard-run-gates-and-conformance-decision-record.md) · MR [`phase-38-standard-run-measurement-report.md`](phase-38-standard-run-measurement-report.md) |
| 39 | Run speed: fewer page visits, then workers | **In progress.** Gates A–D measured (2026-10-20 to 10-26); Decision 13 open; TFP-157's fix built | DR [`phase-39-run-concurrency-decision-record.md`](phase-39-run-concurrency-decision-record.md) · MR [`phase-39-tfp211-measurement-report.md`](phase-39-tfp211-measurement-report.md), [`phase-39-gate-b-report.md`](phase-39-gate-b-report.md), [`phase-39-gate-c-report.md`](phase-39-gate-c-report.md) |
| 40 | Page-type selection | Complete (2026-10-07) | DR [`phase-40-page-type-selection-decision-record.md`](phase-40-page-type-selection-decision-record.md) |
| 41 | Check gaps the benchmark missed | Complete (2026-10-13) | DR [`phase-41-check-gaps-decision-record.md`](phase-41-check-gaps-decision-record.md) · BL [`known-bug-benchmark-backlog-2026-10-06.md`](known-bug-benchmark-backlog-2026-10-06.md), [`real-site-run-findings-backlog-2026-10-01.md`](real-site-run-findings-backlog-2026-10-01.md), [`run-evidence-sweep-backlog-2026-10-13.md`](run-evidence-sweep-backlog-2026-10-13.md) · MR [`known-bug-benchmark-report-2026-10-06.md`](known-bug-benchmark-report-2026-10-06.md) |
| 42 | Reusable suites, a test library, gap tests | Complete (2026-10-15) | DR [`phase-42-reusable-suites-and-gap-tests-decision-record.md`](phase-42-reusable-suites-and-gap-tests-decision-record.md) |
| — | Post-Phase 42 review (R1–R6) | Done (2026-10-15 to 10-20) | [`post-phase-42-review-plan.md`](post-phase-42-review-plan.md) · [`post-phase-42-review-findings.md`](post-phase-42-review-findings.md) · [`post-phase-42-review-notes-2026-10-15.md`](post-phase-42-review-notes-2026-10-15.md) · [`r6-skills-relook-2026-10-20.md`](r6-skills-relook-2026-10-20.md) |
| 43 | Ownership confirmation and the active gate | Locked (2026-10-19), not started | DR [`phase-43-ownership-confirmation-decision-record.md`](phase-43-ownership-confirmation-decision-record.md) |
| 44 | Scenario gaps, slice 1 | Locked (2026-10-20), not started | DR [`phase-44-scenario-gaps-decision-record.md`](phase-44-scenario-gaps-decision-record.md) · REF [`scenario-gap-candidates-2026-10-19.md`](scenario-gap-candidates-2026-10-19.md) |
| 45 | Docker sandbox for model-written tests | Locked (2026-10-20), not started | DR [`phase-45-docker-sandbox-decision-record.md`](phase-45-docker-sandbox-decision-record.md) |
| 46 | App screens | Locked (2026-10-20), not started | DR [`phase-46-app-screens-decision-record.md`](phase-46-app-screens-decision-record.md) |
| 47 | TestForge in a target's CI pipeline | Locked (2026-10-27), not started; after Phase 39, before Phase 43 | DR [`phase-47-ci-integration-decision-record.md`](phase-47-ci-integration-decision-record.md) · BL [`workflow-and-ci-backlog-2026-10-26.md`](workflow-and-ci-backlog-2026-10-26.md) Part 1 |

## Not tied to one phase

| Document | What it is |
|---|---|
| [`deferred-work-register.md`](deferred-work-register.md) | Every deferred item (D1–D30), its status and the build order |
| [`workflow-and-ci-backlog-2026-10-26.md`](workflow-and-ci-backlog-2026-10-26.md) | Working-agreement follow-ups, architect-facing docs, CI integration |
| [`practice-site-targets-2026-10-19.md`](practice-site-targets-2026-10-19.md) | The practice sites TestForge should eventually find every issue in |
| [`saas-prerequisites.md`](saas-prerequisites.md) | What a hosted version would need; deferred, not scheduled |
| [`data/`](data/) | Data files the records cite |

Phases 1–15 predate this folder. They were the April 2026 consolidation
from the FastAPI backend to Next.js: 1–12 are kept for history in
`../consolidation/`; 13–15 (environment config, health and observability,
security headers, all 2026-04-22) exist only as commits (`597879a`,
`01810a4`, `437f1aa`).
