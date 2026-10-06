# TFP-154 scoring rule and page set (fixed before the first run)

Written 2026-10-06, before any TFP-154 run, as the ticket's first acceptance
criterion asks. It applies Decision 3 of
`docs/decisions/known-bug-benchmark-backlog-2026-10-06.md`.

## Runs

On each site, at the read-only gate (`TESTFORGE_INTERACTIVE` unset to 0,
the active gate closed), one worker, Chromium:
- **Standard:** all ten areas, fast mode, the generated suite for the first
  5 pages of the set below (inspected first, as the app does).
- **Comprehensive security (passive)** and **Comprehensive accessibility**,
  the two Comprehensive areas that exist, on every page of the set.

## Page set (the same on both sites; chainsaws on with-bugs only)

| Page | with-bugs (hash routes) | clean (paths) |
| --- | --- | --- |
| home | `/#/` | `/` |
| category | `/#/category/hand-tools` | `/category/hand-tools` |
| product | `/#/product/1` (Combination Pliers) | `/product/01M48AGCWN26TFYQ1FQ6S7FNJF` (Combination Pliers) |
| contact | `/#/contact` | `/contact` |
| login | `/#/auth/login` | `/auth/login` |
| register | `/#/auth/register` | `/auth/register` |
| forgot-password | `/#/auth/forgot-password` | `/auth/forgot-password` |
| rentals | `/#/rentals` | `/rentals` |
| chainsaws | `/#/chainsaws` | - |

Standard's first 5: home, category, product, contact, login.

## Scoring (Decision 3)

For each bug, from the with-bugs runs' failures and findings (and axe's
manual-review items, which count as findings):
- **found:** a failure or finding names the bug's page and its cause. "Names
  the cause" means a reader of the message alone can tell what is wrong:
  the element, rule or value at fault (for example axe `label` on the login
  email field, or the broken image's URL).
- **hinted:** a failure or finding on the bug's page that touches it (the
  same element or the same kind of fault) without naming the cause.
- **missed:** neither.

**Control.** A failure or finding that also appears on the clean site, on
the matching page, with the same cause, is not a find: it is the site's
shared behaviour, not a planted bug. The clean site is an approximate
control (the two versions' code has drifted).

**Which bugs are scored.** Every bug whose gate is read-only (R) and that
shows in Chromium. The others are listed, not scored: interactive (I) and
active (A) gates are closed for these runs (Decision 4), and Firefox- or
Edge-only bugs are out of Chromium's reach. A scored bug whose page is not
in the set is still scored (it can only be missed), and the report says so.

**Presence.** Decision 1 leaves a bug that isn't on the hosted site out of
the score. 15 bugs were confirmed present by hand. A missed bug that was
never checked is scored "missed" and flagged "presence not checked", so a
reader can tell a miss from a bug that may not be there.

**Every other failure** on the with-bugs site, one that matches no bug, is
read by hand and recorded in `docs/decisions/data/labelled-failures.md`.
