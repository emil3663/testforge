# The Toolshop, locally (Phase 41, TFP-179)

Both versions of Testsmith's Toolshop, run from their own repository under
Docker, so a known-bug benchmark has ground truth (the source shows each
bug), a control (the clean version) and no dependence on the hosted site's
resets.

- **Repository:** `https://github.com/testsmith-io/practice-software-testing`,
  cloned into the WSL distribution `Ubuntu`, at
  `~/practice-software-testing` (D26, 2026-10-27), never inside TestForge.
  Its code stays in WSL's Linux filesystem, so Docker's bind mounts never
  cross the Windows mount: the register's standing rule for every site
  TestForge hosts locally.
- **Pinned commit:** `5a6ccc26` (2026-10-07). `start-toolshop.ps1` checks it
  out, so runs are reproducible; change `$PinnedCommit` there to move it.
- **Versions:** `sprint5` (clean) and `sprint5-with-bugs`.

## Before the first start

- **Docker Desktop** running, with **Settings → Resources → WSL integration**
  turned on for Ubuntu (applying it restarts Docker Desktop).
- **The distribution:** `wsl --install -d Ubuntu`, then its first launch to
  create the Linux user. `start-toolshop.ps1` clones the repository there.

## Start and stop

```powershell
.\scripts\toolshop-local\start-toolshop.ps1 -Sprint sprint5-with-bugs   # or -Sprint sprint5
.\scripts\toolshop-local\stop-toolshop.ps1
```

A start is still one command from PowerShell. Each step inside the
distribution is a command of `toolshop.sh`, which the scripts run with
`wsl -d Ubuntu`.

**Timings, measured on this machine (2026-10-27, in WSL):**
- **A version's first start,** from a checkout with nothing installed:
  with-bugs 65 s, clean 51 s. Composer's install takes 12 to 15 s, Angular's
  `npm install` 33 to 39 s.
- **Later starts:** with-bugs 38 to 49 s, including the wait for Composer and
  the bug-80 check; clean 41 to 46 s.
- **The proof that only speed changed,** and every number here:
  `benchmarks/2026-10-27-d26-wsl/README.md`.
- **Every start** seeds the database again, so data is fresh.

Before D26 the checkout was a Windows folder mounted into Docker: a first
start took 20 to 25 minutes (the clean version's packages 20, with-bugs'
about 8), and a later start, once it waited for Composer, 14 to 18 minutes
for with-bugs (863 to 1,070 s at Gates B to D) and 381 to 391 s for clean.

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
- **The API's storage given to php-fpm's user.** Testsmith's `composer`
  service ends with `chown -R www-data /var/www`, which in its image is
  uid 82, while php-fpm runs as uid 1000. In the Linux filesystem that
  ownership holds, so Laravel can't write its compiled views and every
  request that needs them answers 500: the API's documentation page did on
  both versions (`benchmarks/2026-10-27-d26-wsl/logs/evidence-*.txt`). Once `composer` has
  exited, the script gives `storage/` and `bootstrap/cache` to the user
  php-fpm runs as. Giving them away earlier is undone by composer's own
  `chown`.
- **`compose.with-bugs.yml`.** The with-bugs app has no `set-version.js`
  (`sprint5`'s has), so compose's own start command,
  `npm install --force && node set-version.js && ng serve ...`, stops there
  and the app never answers. This override runs the same command without it.
- **with-bugs keeps its log in a file, so bug 80 is there to find.** Bug 80
  is with-bugs serving `storage/logs/laravel.log` from `/logs/laravel.log`.
  `compose.with-bugs.yml` keeps Laravel's file log in a Docker volume over
  `storage/logs`; the start script makes one API request and stops with an
  error unless `/logs/laravel.log` answers 200 with a line written since the
  start.
- **`compose.local.yml`: the cache in memory, the log to stderr.** Added
  because php-fpm couldn't write to the Windows folder. In WSL, with the
  storage given to php-fpm, it no longer has to be; it is kept so the copies
  run as every measured baseline since Phase 41 did (a file cache could, for
  example, make the API's request throttling count across requests).
- **Only Testsmith's `docker-compose.yml`.** Its override file adds cron,
  phpMyAdmin and MailCatcher, which no TestForge run needs, so it isn't used.
- **`compose.loopback.yml`: this machine only (TFP-260).** Testsmith's file
  publishes 4200, 8091, 8000 and 3306 on every interface, MariaDB with the
  root password `root` among them. This replaces those lists with
  `127.0.0.1` ones; `!override` is what stops compose merging them.

**Removed with D26:** installing the packages again with
`COMPOSER_PROCESS_TIMEOUT=0` when compose's own `composer` service gave up at
Composer's 300 s process timeout. On the mounted folder a first install took
up to 20 minutes; in WSL it takes 15 s. If `composer` exits without
installing them, or fails on any start, the start stops with an error.
