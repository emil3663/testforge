# Documentation index

*Last reviewed 2026-10-27.* Start with the overview; everything else is
reference.

## Start here

| Doc | For |
|---|---|
| [`APPLICATION_OVERVIEW.md`](APPLICATION_OVERVIEW.md) | What TestForge is and does today, its architecture, and where it's going |
| [`../README.md`](../README.md) | Setting up and using TestForge; its security model; scripts |
| [`../SECURITY.md`](../SECURITY.md) | The security model, what limits harm, and how to report a vulnerability |
| [`../CONTRIBUTING.md`](../CONTRIBUTING.md) | Issues first, pull requests by invitation; checks and commit style |
| [`WORKING_AGREEMENTS.md`](WORKING_AGREEMENTS.md) | How work is decided, built, verified and recorded; the decision vocabulary |
| [`QUALITY_GATES.md`](QUALITY_GATES.md) | What counts as evidence; model, template, run and phase gates; the verification checklist |

## Decisions and plans

| Doc | For |
|---|---|
| [`decisions/README.md`](decisions/README.md) | Index of every decision record, backlog and report, by phase |
| [`decisions/product-roadmap.md`](decisions/product-roadmap.md) | The map across phases, with each phase's status |
| [`decisions/deferred-work-register.md`](decisions/deferred-work-register.md) | Everything deferred, its build order and the standing rules |
| [`../TEST_PLAN.md`](../TEST_PLAN.md) | Every test case, its status and evidence; known limitations |

## Setup guides

| Doc | For |
|---|---|
| [`AUTOMATED_ACCOUNT_SETUP.md`](AUTOMATED_ACCOUNT_SETUP.md) | Setting up a dedicated automation login for authenticated runs |
| [`LOCAL_MODEL_SETUP.md`](LOCAL_MODEL_SETUP.md) | The optional local model (Ollama) |
| [`../scripts/toolshop-local/README.md`](../scripts/toolshop-local/README.md) | The local Toolshop copies used as test targets |

## Skills and reference

| Doc | For |
|---|---|
| [`CLAUDE_SKILLS.md`](CLAUDE_SKILLS.md) | The account-level Claude skills used on this project |
| [`../skills/README.md`](../skills/README.md) | The `testforge-skills` plugin: what each skill generalises from |
| [`GENERATOR_COMPARISON.md`](GENERATOR_COMPARISON.md) | How the generators were compared |
| [`REIMAGINING.md`](REIMAGINING.md), [`REIMAGINING-RESPONSE.md`](REIMAGINING-RESPONSE.md) | The proposal to rebuild TestForge as skills only, and why it was declined |
| [`../skills/testing/find-the-hidden-platform/TA-230.md`](../skills/testing/find-the-hidden-platform/TA-230.md) | A test-assist defect kept as source material for the `find-the-hidden-platform` skill, beside it (moved from `docs/` by TFP-255) |

## Working files

| Doc | For |
|---|---|
| `HANDOVER_TO_CLAUDE_CODE_*.md` | The current handover per workstream, for the implementing session; replaced, not accumulated |
| [`consolidation/`](consolidation/README.md) | **Historical.** The April 2026 FastAPI-to-Next.js consolidation; superseded by Phase 16 |
