# Claude Skills Reference

A catalog of the Claude skills Emil has enabled on his account. These are not
part of this repo's runtime and are not "installed" here in any executable
sense — they live in Claude's own account-level skill system and are
available across every Claude/Cowork session, on any of his repos. This file
exists purely as a versioned reference so the list is documented somewhere
durable, alongside the rest of the project's docs.

Last synced: 2026-09-16.

## Custom skills (created from work in these sessions)

| Skill | Purpose |
|---|---|
| `conventional-commits` | Write git commit messages in Emil's house style — `type(scope): subject` plus a body giving the why, alternatives rejected, and what the change deliberately does not do. Applies across all repos. |
| `agent-report-verification` | Independently verify an implementing agent's "done" report against a locked ticket/decision record before authorizing the next unit of work. |
| `behavior-preservation-verification` | Prove a refactor/extraction actually preserved behavior, instead of arguing it should have. |
| `test-suite-isolation` | Make a test suite safe to run — isolated from real home dir, app-data folders, databases, storage, clipboard, and network; also covers flakiness from sleeps/timestamps. |
| `verified-release-pipeline` | Build tagged-release CI workflows that prove the built artifact actually runs before attaching it to a release. |
| `repo-claim-audit` | Audit a repo's docs/README/status claims against what the code actually does; report false, stale, or undersold claims. |
| `implementation-backlog` | Break a plan/feature set into a GitHub-issue-ready implementation backlog in Emil's house style — phases, priorities, acceptance criteria, dependencies. |
| `test-plan-doc` | Write/update a `TEST_PLAN.md` / `SMOKE_TEST.md` in Emil's house style — feature-status table, ID-coded cases, known limitations, roadmap. |
| `phase-decision-record` | Write a phase decision record or migration runbook that locks scope/acceptance criteria before implementation starts. |
| `local-first-storage-with-firebase-sync` | Build/extend a vanilla-JS app that works offline on localStorage by default with an optional opt-in Firebase/Firestore sync layer. |
| `pwa-service-worker-cache-versioning` | Write/fix a service worker using versioned cache names plus cache-busting so deploys actually reach users. |
| `capacitor-voice-io-pattern` | Add voice input/output to a Capacitor-wrapped web app reliably — native plugin gating, permission flow, conflict-safe TTS. |
| `wsl-docker-windows-setup` | Diagnose/drive WSL2 + Docker Desktop setup on Windows for multi-container dev stacks. |
| `android-emulator-windows-setup` | Diagnose/drive Android emulator setup for Capacitor-wrapped apps on Windows machines without Hyper-V. |
| `playwright-stability-hardening` | Convert a manual `TEST_PLAN.md` into automated Playwright coverage without producing a flaky suite — stability triage matrix, test hooks, smoke/regression split. |
| `ebora-settlement-codex` | Generate internally-consistent towns/counties/provinces for the Ebora D&D steampunk-fantasy setting. |
| `morning` | Render Emil's morning brief as a styled HTML artifact, or set it up as a recurring weekday task. |

## Built-in / utility skills

| Skill | Purpose |
|---|---|
| `skill-creator` | Create new skills, edit/optimize existing ones, run evals. |
| `import-memory` | Import a memory export from another AI assistant into Claude's memory. |
| `xlsx` | Read/edit/create/convert spreadsheet files (.xlsx, .xlsm, .csv, .tsv). |
| `pptx` | Read/edit/create PowerPoint files (.pptx, .potx). |
| `pdf` | Read/edit/create/merge/split/OCR PDF files. |
| `docx` | Read/edit/create Word documents (.docx, .dotx). |
