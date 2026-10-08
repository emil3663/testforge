# The Toolshop, locally (Phase 41, TFP-179)

Both versions of Testsmith's Toolshop, run from their own repository under
Docker, so a known-bug benchmark has ground truth (the source shows each
bug), a control (the clean version) and no dependence on the hosted site's
resets.

- **Repository:** `https://github.com/testsmith-io/practice-software-testing`,
  cloned next to TestForge (`..\practice-software-testing`), never inside it.
- **Pinned commit:** `5a6ccc26` (2026-10-07). `start-toolshop.ps1` checks it
  out, so runs are reproducible; change `$PinnedCommit` there to move it.
- **Versions:** `sprint5` (clean) and `sprint5-with-bugs`.

## Start and stop

Docker Desktop must be running first.

```powershell
.\scripts\toolshop-local\start-toolshop.ps1 -Sprint sprint5-with-bugs   # or -Sprint sprint5
.\scripts\toolshop-local\stop-toolshop.ps1
```

**Timings, measured on this machine:**
- **A version's first start:** 20 to 25 minutes. Most of it is the API's PHP
  packages on a Windows folder mounted into Docker; the clean version's
  install took 20 minutes, with-bugs' about 8.
- **Later starts:** about a minute; the packages stay installed.
- **Every start** seeds the database again, so data is fresh.

## Addresses

| What | URL |
| --- | --- |
| The app | http://localhost:4200 (with-bugs routes by hash, `/#/contact`; clean by path, `/contact`, as their hosted sites do) |
| The API | http://localhost:8091 |
| API documentation | http://localhost:8091/api/documentation |
| Database | localhost:3306 (MariaDB) |

## One version at a time

- **Both versions' apps call their API at `http://localhost:8091`**
  (`src/environments/environment.ts`). Running both at once would mean
  editing Testsmith's source, which the local copies are meant to show as it
  is.
- **Starting one version stops the other** (`docker compose down`, then `up`).

## What TestForge adds, and why

Testsmith's files are not changed. TestForge adds:
- **Packages installed without Composer's 300 s timeout.** Compose's own
  `composer` service gives up after Composer's 300 s process timeout, which a
  first install on the mounted folder exceeds. The script installs again
  with `COMPOSER_PROCESS_TIMEOUT=0` when `vendor/autoload.php` is missing.
- **`compose.with-bugs.yml`.** The with-bugs app has no `set-version.js`
  (`sprint5`'s has), so compose's own start command,
  `npm install --force && node set-version.js && ng serve ...`, stops there
  and the app never answers. This override runs the same command without it.
- **Only Testsmith's `docker-compose.yml`.** Its override file adds cron,
  phpMyAdmin and MailCatcher, which no TestForge run needs, so it isn't used.
