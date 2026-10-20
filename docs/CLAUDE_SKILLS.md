# Claude Skills Reference

A catalog of the Claude skills Emil has enabled on his account. These are not
part of this repo's runtime and are not "installed" here in any executable
sense — they live in Claude's own account-level skill system and are
available across every Claude/Cowork session, on any of his repos. This file
exists purely as a versioned reference so the list is documented somewhere
durable, alongside the rest of the project's docs.

Last synced: 2026-10-20 (R6, `docs/decisions/r6-skills-relook-2026-10-20.md`).
- All 17 custom skills were confirmed loaded in a Cowork session that day.
- Two changes saved the same night:
  - `wsl-docker-windows-setup` was updated with the "keep a local stack's
    code in the WSL filesystem" rule;
  - `deferred-work-triage` was added.

  That makes 18.
- The five built-ins added since the last sync are listed below.

This repo's own plugin, `testforge-skills` (`skills/`), is separate: it loads
only in Claude Code sessions in this repo. See `skills/README.md`.

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
| `wsl-docker-windows-setup` | Diagnose/drive WSL2 + Docker Desktop setup on Windows for multi-container dev stacks. Updated 2026-10-20: keep a local stack's code in the WSL filesystem, not a mounted Windows folder. |
| `android-emulator-windows-setup` | Diagnose/drive Android emulator setup for Capacitor-wrapped apps on Windows machines without Hyper-V. |
| `playwright-stability-hardening` | Convert a manual `TEST_PLAN.md` into automated Playwright coverage without producing a flaky suite — stability triage matrix, test hooks, smoke/regression split. |
| `deferred-work-triage` | Keep and triage a project's deferred-work register: status, build order and what each item waits on. Added 2026-10-20 (R6). |
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
| `docs` | Create and edit Claude Docs documents. The default for documents that aren't a named file format. Added since 2026-09-16. |
| `deep-research` | Multi-source research synthesised into a report. Added since 2026-09-16. |
| `chrome-browser` | How to use Claude in Chrome (the browser extension, your real Chrome). Added since 2026-09-16. |
| `built-in-browser` | How to use the browser pane inside the Claude desktop app. Added since 2026-09-16. |
| `computer-use` | Operating desktop apps on the linked computer through screenshots, clicks and typing. Added since 2026-09-16. |
