# Dependency upkeep: the watch list and two tickets (2026-11-08)

**Status:** Owner decision (Emil, 2026-11-08). TFP-274 done (`e9ab8b5`); TFP-273 done (`99b477c`). TFP-285 done (`f48579f`, `f354687`).

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

- **Status:** Done 2026-11-08: `99b477c`, verified (Cowork, 2026-11-08).
  First run (13:48Z, both update jobs succeeded): npm opened 5 pull
  requests, #18 the `nextjs` group (4), #19 `npm-minor-and-patch` (10),
  #20 openai 7, #21 typescript 7, #22 eslint 10; the limit held back none;
  github-actions, none (every action on its latest major). CI: #18, #19,
  #20 and #22 green; #21 fails lint (`typescript-eslint does not support
  TS 7.0`). `.github/dependabot.yml` (npm and github-actions, monthly,
  limit 5; npm minors and patches in one group, majors one per package;
  `next`, `eslint-config-next`, `@playwright/test` and `playwright-core`
  majors ignored) and a merge rule in `docs/QUALITY_GATES.md` §3. **Read
  by Cowork:** the config does what the scope says; the merge rule's
  reason for not using the template check (both refs share one
  `node_modules`) is sound, so the unit and regression suites stand in for
  it. Claude Code's schema check (valid; a broken copy invalid, naming both
  fields) wasn't re-run here (SchemaStore isn't reachable from Cowork's
  workspace). **Rulings (Emil, 2026-11-08):** (1) `next`, `react`,
  `react-dom` and `eslint-config-next` in a group of their own, so a
  Next.js update arrives as its own pull request (W3); (2) `@types/node`
  majors ignored while `.nvmrc` is 24 (W5); (3) the first run's pull
  requests reported, with how many the limit held back; (4) Dependabot
  security updates turned on in the repository's settings (by Cowork), so
  an alert with a patch gets a fix pull request (a minimatch 11 one will
  fail CI and be closed, W1); the config's header says so. All four are
  in the commit.
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

## TFP-285 - fast-xml-parser's quadratic stop-node scan (Dependabot #146, Low)

- **Status:** Done 2026-11-12: `f48579f` (the lockfile), `f354687` (one
  `check:old-name` allowlist entry for the old command's bin line, which
  npm copied into the lockfile; the owner chose this, 2026-11-12), on
  `main` by fast-forward (PR #29). `package-lock.json` has one
  `fast-xml-parser`, 5.12.0. After `npm ci`: `test:unit` 821 of 821,
  0 skipped; `test:self:allure` 5 passed, its Allure report 5 of 5;
  `test:regression:allure` 73 passed, its report 73 of 73. PR
  Validation and CodeQL green on `f354687`. The dependency graph
  shows 5.12.0, and Dependabot closed its own bump PR #27 at 16:19Z.
  Alert #146 was still open at 16:28Z: it closes on Dependabot's next
  scan of `main`. Added 2026-11-12 (owner decision: patch it).
- **Phase:** None — before TFP-247
- **Priority:** P3 (a Low alert open on `main`)
- **Suggested labels:** `security`, `dependencies`
- **Problem it solves:** Dependabot alert #146 (GHSA-474x-hrwr-fgx4,
  CVE-2026-126066, Low), opened 2026-11-11 when Phase 48 reached `main`:
  `fast-xml-parser` up to 5.11.2 rescans the rest of the input from every
  `<` inside a stop node that is never closed, so a crafted input costs
  O(n²) CPU before the parser throws. It needs the non-default `stopNodes`
  option. The advisory calls it a static-analysis finding, not
  benchmarked. Here it is reached only through Allure, a dev dependency:
  `allure` → `@allurereport/core` → `@allurereport/reader` →
  `fast-xml-parser` 5.11.2. The reader parses our own test results when
  `test:self:allure` and `test:regression:allure` build their reports,
  and none of its four parsers sets `stopNodes`. Nothing in `src/`,
  `scripts/` or `bin/` uses the package.
- **Scope:** `npm update fast-xml-parser`. The reader asks for `^5.11.1`,
  so 5.12.0 is within range: only `package-lock.json` changes, with no
  override and no Allure upgrade.
- **Acceptance criteria** (`docs/QUALITY_GATES.md` §3, a dependency
  change):
  - Only `package-lock.json` changes; `npm ls fast-xml-parser` shows
    5.12.0 or later.
  - After `npm ci`: `npm run test:self:allure` and
    `npm run test:regression:allure` pass and write their Allure reports;
    `npm run test:unit` passes. The counts are in the commit body.
  - PR Validation and CodeQL green.
  - Dependabot closes #146 when it rescans `main`, checked after the push.
- **Dependencies:** none.
