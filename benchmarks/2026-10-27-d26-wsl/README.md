# D26: the local Toolshop copies in WSL (2026-10-27)

Phase 39's Gate D ruling 3 (2026-10-26) moved D26 into Phase 39, before Gate D's re-measurement: the Toolshop copies
move into WSL's Linux filesystem, with the proof that only speed changed (failure sets, score, bug 80).

**Result: the same on both copies.** All six suites, test by test: 0 results unlike every Gate D round. The answer
key's bugs: 0 verdicts changed, bug 80 included. The starts went from 20 to 25 minutes (first) and 14 to 18
minutes (with-bugs, later: 863 to 1,070 s at Gates B to D) to under 70 s. `comparison.txt` is `compare.mjs`'s output.

## The move

- **Ubuntu** under WSL 2 (Ubuntu 26.04.1 LTS, installed 2026-10-27; Docker Desktop 4.70.0's WSL integration on;
  `logs/environment.txt`).
- **The checkout:** `~/practice-software-testing` in Ubuntu, at `5a6ccc26`. Its files are as upstream stores them
  (LF); the old Windows checkout has CRLF in files without their own attributes (`_docker/api.docker`, for one;
  `logs/environment.txt`). Its one change is the clean version's `sprint5/UI/src/environments/version.ts`, which
  compose's own start command rewrites (`set-version.js`), as it did on Windows.
- **The scripts** (`scripts/toolshop-local/`): `start-toolshop.ps1` and `stop-toolshop.ps1` call `toolshop.sh` inside
  Ubuntu (`wsl -d Ubuntu --cd <that folder> -e bash ./toolshop.sh ...`); a start is still one PowerShell command.
  The compose project is still `pst`, so the images and named volumes were reused.
- **The old Windows checkout** (`..\practice-software-testing`) is no longer used, and was left in place.

## The workarounds, re-checked

| Workaround | Kept or removed | Why |
| --- | --- | --- |
| The API's storage given to php-fpm's user once composer has exited | **Kept, and widened** from with-bugs' log folder to `storage/` and `bootstrap/cache`, both versions | Composer's `chown -R www-data` leaves `storage/`, its `framework/views` and `bootstrap/cache` to uid 82, mode 755, and php-fpm runs as uid 1000; a Linux filesystem enforces it. Before the step, the API's documentation page (no database needed) answers 500 three times out of three on both versions, and clean's Laravel error is `tempnam(): file created in the system's temporary directory`: it can't write its compiled views (`logs/evidence-sprint5.txt`, `logs/evidence-sprint5-with-bugs.txt`). The first WSL start stopped there (`logs/start-with-bugs-1-before-the-storage-fix.log`). |
| Installing again with `COMPOSER_PROCESS_TIMEOUT=0` | **Removed** | From a checkout with nothing installed, composer took 14.7 s (with-bugs) and 12.5 s (clean) in WSL, against its 300 s timeout (`logs/evidence-*.txt`); it was for the mounted folder's up to 20 minutes. A composer that fails (its exit code, on any start) or exits without installing now stops the start with an error. |
| `compose.local.yml` (cache in memory, log to stderr) | **Kept** | Its reason (php-fpm couldn't write the Windows folder) is gone. It stays so the copies run as every baseline since Phase 41 did; a file cache could, for example, make the API's throttling count across requests (reasoned, not measured). |
| `compose.with-bugs.yml`'s log volume, and the bug-80 check | **Kept** | Bug 80 answered 200 with a line from that start on each of the three with-bugs starts that reached the check (the first, before the storage fix, stopped earlier). Testsmith tracks only `storage/logs/.gitignore`, so the log could live in the checkout again; the volume stays so with-bugs serves its log as every baseline since TFP-188 did. |
| `compose.with-bugs.yml`'s start command without `set-version.js` | **Kept** | Not about Windows: with-bugs has no `set-version.js`. |

## Start timings (this machine, Plane running, VS Code open)

| Start | Before (Windows folder) | WSL | Log |
| --- | --- | --- | --- |
| with-bugs, first (nothing installed) | 20 to 25 min a first start; with-bugs' packages about 8 min | 65 s; re-taken separately, composer 14.7 s and `npm install` 39 s | `start-with-bugs-2-first-from-scratch.log`; the parts from a pristine checkout, `evidence-sprint5-with-bugs.txt` |
| clean, first | 20 min for its packages | 51 s; re-taken separately, composer 12.5 s and `npm install` 33 s | `start-clean-1-first-from-scratch.log`; `evidence-sprint5.txt` |
| with-bugs, later | 14 to 18 min: 1,070 s (Gate B), 863 s (Gate C), 947 s (Gate D) | 38 to 49 s (49, 38, 39 s) | `start-with-bugs-3-later.log`, `start-sprint5-with-bugs-final-script.log`, `evidence-sprint5-with-bugs.txt` |
| clean, later | 381 s (Gate B), 391 s (Gate C), 389 s (Gate D) | 41 to 46 s (46, 41 s) | `start-sprint5-final-script.log`, `evidence-sprint5.txt` |

The two first starts ran from a checkout cleaned with `git clean -xdf` (with-bugs) and before any clean install
(clean); that state was seen in the session, not logged. `evidence-starts.ps1` re-takes the parts from a logged
pristine checkout.

## The proof

**Method.** Gate D's own `run.mts`, W1 (1 worker, as the app runs units), one round of Standard, security and
accessibility on each copy, compared test by test with Gate D's three W1 rounds (`../2026-10-21-gate-d/runs/W1`).
Then TFP-188's `evidence.mjs` (the answer key's 37 scored bugs) on both, compared per bug.

**The code:** Gate D ran at `54c38eb`, these runs at `41f39ac`. Between them, `src/` has TFP-157's slot fix
(`66cd0c0`, capped runs only; W1 isn't capped) and TFP-250's wording (`1a4f18b`, `18d1e1c`, which keeps generated
text unchanged). The generated suites show it: clean's three, generated now, are identical to Gate D's once the ids
are set aside.

- **with-bugs:** Gate D's suite files themselves (hashes checked). Its product ids are integers, so the suites hold.
- **clean:** crawled, inspected and generated afresh on the WSL start, with Gate D's scripts, then the product ids set
  aside, as TFP-211 and TFP-240 did. Its product ids are ULIDs made when the database is seeded, and every start
  seeds it, so any start after Gate D's would break Gate D's suites. Run on them first (`runs/clean-gate-d-suites/`),
  clean Standard gave 396 / 56 / 20 against 408 / 46 / 18: 14 tests changed, all about the product
  `01M5FQP3BDZR8CEXS8CWP8VX3M` (6 with its page recorded; 8 element and SEO checks on it that record no page, among
  them its title and heading), which this seed doesn't have (the
  API answers 404; the same product is now `01M5XH26SRDETH9NKYZ0E1SMGB`). Accessibility, whose suite covers 9 product
  ids, gave 39 / 10 / 31 against 30 / 19 / 31; security, the same counts. The fresh crawl selected the same 8 Standard
  and 20 Comprehensive pages as Gate D's, ids set aside.

| Copy | Suite | Tests | Passed / failed / not run | WSL time | Gate D W1 times | Results unlike every Gate D round |
| --- | --- | --- | --- | --- | --- | --- |
| with-bugs | Standard | 483 | 379 / 84 / 20 | 604 s | 734, 714, 740 s | 0 |
| with-bugs | security | 122 | 119 / 3 / 0 | 82 s | 133, 113, 108 s | 0 |
| with-bugs | accessibility | 80 | 7 / 41 / 32 | 137 s | 149, 149, 144 s | 0 |
| clean | Standard | 472 | 408 / 46 / 18 | 330 s | 403, 399, 413 s | 0 |
| clean | security | 122 | 120 / 2 / 0 | 79 s | 113, 110, 113 s | 0 |
| clean | accessibility | 80 | 30 / 19 / 31 | 87 s | 98, 97, 98 s | 0 |

No timeouts in any run.

**The answer key.** Every scored bug has the same verdict as in Gate D's rounds, bug 80 included (1 item, as in all
three rounds), and the same number of evidence items but for one. Every item WSL found is in at least one Gate D
round except that one bug's (bug 2's sort messages differ in wording between Gate D's rounds too). The one whose
items differ is bug 4 (card titles with another
`text-align`): with-bugs misaligns different titles on each load, so Gate D's own rounds listed 5, 3 and 4 items; WSL
lists 3. `compare.mjs` shows them and counts only verdicts for a bug that already varied.

**What "the score is unchanged" rests on.** TFP-188's score is read by hand under TFP-154's rule from this evidence;
`compare.mjs` doesn't score. It checks that no bug went from evidence in every Gate D round to none, or the reverse,
and that on bugs whose evidence was steady at Gate D no item appeared or went. A bug whose evidence was kept would
score as before; a reader re-scoring bug 4's three items (card titles misaligned on hand-tools) would find it as
Gate D's rounds did.

**The times are not the new baseline.** One round, on a machine in use (Plane running, VS Code, Claude), not Gate D's
quiet one; they are lower on every suite (Standard: with-bugs 17.7%, clean 18.1% below Gate D's medians), the
direction the move predicts. Gate D's
re-measurement (ruling 4) takes the baseline, three rounds on a quiet machine.

## Files

| File | What |
| --- | --- |
| `compare.mjs` | The proof: test by test against Gate D's three W1 rounds, then the answer key's evidence per bug |
| `comparison.txt` | Its output |
| `runs/W1/` | The suites run (with-bugs: Gate D's; clean: generated on the WSL start) and each run's records and timing |
| `runs/shared/` | The clean copy's crawl, selection and inspection on the WSL start |
| `runs/clean-gate-d-suites/` | The first clean run, on Gate D's suites and their ids from Gate D's seed: kept to show why clean is regenerated |
| `evidence-starts.ps1` | Re-takes the start evidence from a pristine checkout: `logs/environment.txt`, `logs/evidence-<sprint>.txt` |
| `logs/` | Each start, run, crawl, inspection and generation, and the start evidence |

Run, from the repo root with the Toolshop copy started: `node --import ./scripts/register-node-test-ts-resolver.mjs
--experimental-strip-types benchmarks/2026-10-21-gate-d/run.mts <with-bugs|clean> http://localhost:4200
benchmarks/2026-10-27-d26-wsl/runs "W1:standard,security,accessibility" 1`, then `node
benchmarks/2026-10-27-d26-wsl/compare.mjs`.
