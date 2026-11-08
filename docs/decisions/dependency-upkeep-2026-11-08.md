# Dependency upkeep: the watch list and two tickets (2026-11-08)

**Status:** Owner decision (Emil, 2026-11-08). TFP-274 done (`e9ab8b5`); TFP-273 open.

Emil asked for a way to see dependency issues and clear them with patches,
not only dismiss them. Two parts, both chosen on 2026-11-08:

1. **Dependabot version updates** (TFP-273): GitHub opens grouped update
   pull requests once a month, each tested by CI before it is merged.
2. **A monthly check** (a scheduled task, run by Cowork in a fresh cloud
   session on the first Monday of each month at about 10:13 South African
   time): it re-reads this watch list, checks each item, and opens a GitHub
   issue, "Monthly dependency check — <month>", listing what is now ready to
   patch, with a suggested ticket for each. It changes no code.

## The watch list

Each item says what is waiting, what would end the wait, and how to check.
The monthly check reads this section; add an item whenever a fix is held
back, and remove it (with the date and commit) when it is cleared.

| Item | Waiting on | Check | Then |
|---|---|---|---|
| **W1. minimatch below 11.0.1** (GHSA-g3hv-75wg-m249; Dependabot #144 and #145 dismissed as tolerable risk, 2026-11-04 and 2026-11-08) | ESLint's plugins (`eslint-plugin-import`, `jsx-a11y`, `react`) accepting minimatch 11, which has no default export; Allure's path too | `npm view eslint-plugin-import dependencies.minimatch`, the same for the other two and for `@allurereport/ci`; any new Dependabot alert on minimatch | Upgrade, drop any override, reopen nothing |
| **W2. The DOMPurify override** (`package.json` `overrides.dompurify`, TFP-270) | An Allure release whose `@allurereport/web-commons` depends on dompurify 3.4.17 or later | `npm view @allurereport/web-commons dependencies.dompurify` | Upgrade Allure, remove the override and its `"//"` note |
| **W3. Next.js** (16.4.3, pinned) | Patch and minor releases, security advisories; `AGENTS.md` says read the bundled docs before changing code | `npm view next version`; the Next.js security advisories | A ticket per upgrade; majors get a decision record |
| **W4. Playwright** (`@playwright/test` ^1.59.1, Chromium only) | New minors (browser updates, fixes) | `npm view @playwright/test version` | A ticket; the template check and regression suites must stay green |
| **W5. Node** (24, `.nvmrc`) | Node 24 patch releases and security releases; the next LTS | nodejs.org release schedule and security blog | Update `.nvmrc` and CI in a ticket |
| **W6. Open alerts** | Anything open in Dependabot, code scanning or secret scanning | The repo's Security tab | One line each, with severity and a suggested ticket |
| **W7. The nightly's audit** | `npm audit` with dev dependencies included (the nightly only checks production) | `npm audit` and `npm audit --omit=dev` on `main` | New high or critical findings become tickets |

## TFP-273 - Monthly Dependabot version updates

- **Phase:** None — after TFP-274, before TFP-246
- **Priority:** P2
- **Suggested labels:** `ci`, `dependencies`
- **Problem it solves:** today a dependency only moves when an alert or a
  ticket forces it, so fixes and security patches arrive late and in large
  jumps.
- **Scope:**
  - `.github/dependabot.yml` with two ecosystems, `npm` (root) and
    `github-actions`, each on a monthly schedule.
  - npm updates grouped: one pull request for minor and patch updates;
    majors one per package, so each can be judged on its own.
  - `next` majors ignored (a major needs a decision record);
    `@playwright/test` kept to minors in the group.
  - A pull request limit low enough to review (for example 5).
- **Acceptance criteria:**
  - Dependabot's "Version updates" page shows both ecosystems as configured
    and last checked, with no configuration errors.
  - The first run's pull requests run CI; their results are reported.
  - `docs/QUALITY_GATES.md` or `CONTRIBUTING.md` says how a Dependabot pull
    request is merged (CI green, template check identical or explained).
- **Dependencies:** none.

## TFP-274 - CodeQL "Incomplete URL scheme check" in the crawl (High)

- **Status:** Done 2026-11-08: `e9ab8b5`, verified (Cowork, 2026-11-08);
  #6133 closed as fixed by CodeQL's scan of `e9ab8b5` (13:24:46Z;
  JavaScript results 16 to 15). `shouldQueueUrl` queues only `http:` and `https:`
  (`CRAWLED_PROTOCOLS`), exported for its test. **Verified** on a Linux
  clone, the uncommitted files on `59eb2fd`: `crawl.test.ts` and the crawl
  route test 5 of 5 passed, 0 skipped; with the old blocklist (exported),
  the scheme-only test fails on `vbscript:msgbox(1)`, so this ticket's
  "can't fail on today's code" holds only for the origin-level test.
  Claude Code's template check (172 identical) and unit run (769 of 769)
  weren't re-run here. #6133 closing is checked after the push.
- **Phase:** None — next, before TFP-273
- **Priority:** P1 (a High alert open on `main`)
- **Suggested labels:** `security`, `crawl`
- **Problem it solves:** code scanning alert #6133 (High, opened by
  `b493265`'s move) flags `shouldQueueUrl` in `src/lib/pipeline/crawl.ts`
  (line 162 at `6b617b2`): it refuses `mailto:`, `tel:`, `javascript:` and
  `data:` by a blocklist, which misses `vbscript:` and anything else. The
  origin check just before it already refuses every non-`http(s)` URL, so
  it isn't reachable today, but a blocklist is the wrong shape.
- **Scope:** replace the blocklist with an allowlist: queue only `http:`
  and `https:` URLs on the crawl's origin.
- **Acceptance criteria:**
  - A unit test that only `http:` and `https:` URLs on the crawl's origin
    are queued (`vbscript:` and an unknown scheme are not). It can't fail
    on today's code, because the origin check already refuses those
    schemes; the commit says so (`docs/QUALITY_GATES.md` §1).
  - `check:template-unchanged` identical; the crawl tests pass unchanged.
  - Code scanning shows #6133 closed as fixed after the push.
- **Dependencies:** none.
