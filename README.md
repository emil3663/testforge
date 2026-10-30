# TestForge

**TestForge is a test automation assistant that works alongside testers, not instead of them.**  
Point it at a site. It crawls it, inspects one page of each kind, writes a real Playwright TypeScript suite from what it found, runs it, and reports what was tested, how, and what wasn't tested and why. The generator is deterministic and needs no AI or API key; a local model or Claude Code can optionally write tests for the gaps. You review the code, run it, and keep it: it's plain Playwright.

*README last reviewed 2026-10-28 (TFP-256). Also: [what it does today](docs/APPLICATION_OVERVIEW.md) · [all docs](docs/README.md) · [changelog](CHANGELOG.md) · [security](SECURITY.md) · [contributing](CONTRIBUTING.md).*

---

## Security model

TestForge is a local-only developer tool and is not designed to be deployed.
`/api/run` executes caller-supplied code with the privileges of the user
running the dev server — this is intended behaviour under the local-only
model, not a vulnerability to be patched. There is no authentication,
sandboxing, or multi-tenant isolation.

So TestForge listens on `127.0.0.1` only, and its API refuses any request
whose `Host` isn't local, whose `Origin` isn't TestForge's own, or whose
write isn't JSON (TFP-261). **Don't override the address and don't expose
it through a tunnel** (ngrok, Cloudflare Tunnel, port forwarding, a reverse
proxy): anyone who can reach the port can run code on the machine. Full
model and how to report a problem: [`SECURITY.md`](SECURITY.md).

---

## Run persistence and retention

A finished run is written to `runs/<runId>/` on disk (gitignored, no
database dependency): `run.json` (the config that produced it plus the
full result/report), `suite.spec.ts` (the exact code that was executed),
and `evidence/` (trace/video/screenshot files, moved out of Playwright's
shared, reusable output directory so a later run can't overwrite them).
This survives a server restart — the in-memory job map only serves runs
that are still in flight; a finished run's report and evidence are read
back from `runs/<runId>/` regardless of process lifetime.

Runs have a tiered retention state:

- **Full** (default): everything is kept — `run.json`, `suite.spec.ts`,
  and `evidence/`.
- **Archived**: `evidence/` is deleted; `run.json` and `suite.spec.ts` are
  kept in full, so history, coverage numbers, and diffing keep working.
  Nothing about a run's pass/fail record or config is ever deleted by
  archiving, only the heavy replay evidence.
- **Pinned**: a hard override set by an explicit user action. A pinned run
  is never auto-archived, regardless of any other rule.

A non-pinned run becomes eligible for **automatic archiving** once (a) a
newer run of the same suite exists — the same `baseUrl`, the same selected
practices and the same run type (Standard, or Comprehensive for one area)
— and (b) every one of its failing tests, if any, ran and passed in that
newest run. A failing test the newer run didn't run, skipped, or that
failed, was blocked or was flaky there keeps the older run and its
evidence: only a passing re-test shows a defect fixed (TFP-198, GitHub
issue #2). Automatic archiving runs as an on-demand sweep, not a
background daemon; nothing is archived until the sweep is triggered.

Run storage assumes **one TestForge process at a time** on a `runs/`
directory: nothing locks a record, so two processes could lose one
another's pin or archive. Each `run.json` is written to a temporary file
and renamed into place, so an interrupted write leaves the previous record,
never a truncated one.

`lastAccessedAt` is `null` on a freshly persisted run and is set the first
time that run's report is read back through the API — an informational
"has this even been looked at" signal, not itself a reason to delete
anything.

### Site suites (Phase 42)

Each site's template-written suite is saved with the structural
fingerprint of every page type it covers, and later runs reuse it: an
unchanged page type keeps its saved tests, a changed one gets new ones, a
removed page's tests are retired, and a test you edit by hand is kept and
flagged when its page changes. The report says what was reused,
regenerated and retired. Site suites hold one site's selectors and pages,
so they live in TestForge's local data folder, never in the repo:
`%LOCALAPPDATA%\TestForge` on Windows, `~/Library/Application Support/TestForge`
on macOS, `$XDG_DATA_HOME/testforge` (or `~/.local/share/testforge`)
elsewhere. Set `TESTFORGE_DATA_DIR` to put it somewhere else. Edit a saved
test in `site-suites/<site>/<suite>/tests/`.

When a reused test fails, its page is read again after the run. If the
page's structure has changed since the test was saved, that page type's
tests are written again from a fresh inspection and re-run, and only the
re-run's results are reported, with the change named. If it hasn't, the
failure stands.

**Every link on the selected pages** gets its own read-only check: on its
page, named, with a valid `href`, its target loaded once a run (an external
target is checked by its `href` only). So the coverage map leaves no link
uncovered on a page it inspected.

**Gap tests (opt-in per site, off by default).** A site can have its
uncovered elements written for, once per gap: `POST /api/site-settings`
with `{ "baseUrl": "...", "gapWriter": "claude-code" }` (or
`"local-model"`, which needs `TESTFORGE_OLLAMA_MODEL`; `"off"` turns it
back off). Turning it on sends that site's page structure to the writer.
Each written test runs at the read-only gate, inside the request guard; one
that passes joins the site suite, and one that breaches the gate is
rejected. At most 5 gaps per generation (`TESTFORGE_GAP_LIMIT`). The
report says what was written and what Claude Code reported it cost.

Claude Code is called with every tool off (`--tools ""`,
`--disallowedTools "*"`, `--strict-mcp-config`, `--disable-slash-commands`)
from an empty temporary folder, and the page text is marked in the prompt as
untrusted data. A written test may use only the page and `expect`: imports,
Node, the network (`fetch`, `page.request` other than GET, routes) and code
built at run time are refused before it runs. Every Playwright run, gap
tests and candidates included, gets only the environment Playwright needs:
no keys, tokens or TestForge settings. This is not a sandbox.

Each saved gap test is also generalised to its component's pattern and
kept in the candidate pool (`candidates/` in the data folder). On a
Comprehensive run of any site, a candidate whose pattern matches an
uncovered element runs in its own "Candidate tests" section, outside the
verdict, and each run adds to its evidence. On a Standard run, a candidate
matching a gap becomes that gap's test: bound to the site, run through the
same gates, and saved in the site suite under "Gap tests" if it passes. One
that fails the gates there is not bound, and not tried again while the
page type holds.

A candidate that has passed the gates on every run, and has either caught
a real defect or run clean on 3 sites, is offered for promotion
(`GET /api/candidates`); a run's failure is labelled with
`POST /api/candidates { "action": "label", ... }`. Approve or reject it with
`{ "action": "approve", "id", "by" }` or `{ "action": "reject", "id",
"reason" }`. `npm run library:promote` then writes each approved one, with
its evidence, under `src/lib/library/promoted/`, to be reviewed and
committed. Once committed, a promoted entry runs on every Standard run with
the functional area, on each page that has its pattern, inside the verdict
like the rest of the library.

---

## Authenticated runs

A run can log in once and start every test already signed in, so pages behind
a login get tested too. It uses a dedicated **automation account** you
provision for the purpose — never a real user's — which needs four exemptions
(account lockout, rate limiting, MFA, new-sign-in alerts) to work reliably.
Credentials are read from environment variables by *name* and are never put
in a request, generated code, or a committed file; the session is used for
that run only and, like the credentials, is scrubbed from the report and the
saved traces.

Setup, the exact `login` fields for `POST /api/run`, and what each failure
means are in [`docs/AUTOMATED_ACCOUNT_SETUP.md`](docs/AUTOMATED_ACCOUNT_SETUP.md).
Read it before configuring a login. Enter the login in the app's **Authenticated Run** section, or as the `login` field of the API request.

---

## The problem TestForge solves

There's a gap in software testing that nobody talks about honestly.

**Testers** — people who understand quality, who can spot a bug from a mile away, who understand user flows, edge cases, and risk. They've spent years developing this instinct.

**Automation** — code that runs tests automatically, catches regressions, and lets teams ship with confidence. It's become essential.

The gap between these two worlds is brutal. Testers are told: "Learn to code." They struggle — not because they're not smart enough, but because automation frameworks were built by developers for developers.

**TestForge exists to close this gap.**

---

## Tool stack

| Tool | Purpose |
|---|---|
| **Node.js 24** (`.nvmrc`) | TestForge runs on Next.js; the unit tests and scripts need 22.6 or later for `--experimental-strip-types`, and CI uses `.nvmrc` |
| **Docker Desktop** | Runs local test targets: the Toolshop copies (`scripts/toolshop-local/`) and, optionally, Plane |
| **VS Code** | Code editor — open this repo as a workspace (optional) |
| **Claude Code** | Optional: the gap writer can call its CLI (`claude` on the PATH) to write tests for coverage gaps; it's also how this repo is developed |
| **Git** | Version control |

---

## Features

- **Deterministic generation, no API key needed.** A template generator writes a standard Playwright TypeScript suite from what TestForge actually finds on the site. A local model (Ollama) can fill only the areas the template left empty. An OpenAI path exists but is parked: no live completion has succeeded (`TEST_PLAN.md`, known limitation 5).
- **Crawl, page types and inspection.** TestForge crawls the site, groups its pages into page types by address pattern and form signature, and tests one page of each type (up to 8), then inspects those pages so every check targets real elements.
- **Standard and Comprehensive runs.** Standard tests the critical working path. Comprehensive goes deep on one area at a time. The goal is a Comprehensive set for every area, plus an all-areas run that tries to break fields and flows; **built today: security (passive) and accessibility.** The rest are in the build order (`docs/decisions/deferred-work-register.md`).
- **Three gates.** Read-only by default, behind a request guard; interactive when switched on; active (tests that change data, and attack-shaped tests) only behind a typed ownership confirmation per site. **The confirmation isn't built yet (Phase 43), so active tests are reported Not run today.**
- **Polite to other people's sites.** A local host gets up to 3 workers; any other host gets at most 3 workers sharing 5 requests per second, and timed checks there are Not run with the reason, until the ownership confirmation lifts the cap.
- **Checks across the areas.** Functional controls (sorts, filters, steppers, links), layout consistency and overlap, spelling, tab order and grouping, WCAG 2.2 A/AA with axe, passive security headers and probes, SEO, and performance graded by Core Web Vitals bands.
- **Measured against known bugs.** On local copies of the Toolshop practice site with 37 known bugs in reach, Standard alone finds 30 (TFP-207, 2026-10-16), and Standard plus Comprehensive security and accessibility finds 33 (Phase 41 Gate B). See `docs/decisions/phase-41-check-gaps-decision-record.md`.
- **Reusable site suites and a test library.** Each site's Standard suite is kept and reused, regenerated only for page types that changed. Comprehensive tests live in a library written against component patterns.
- **A coverage map.** Element by element, in two tiers: reachability (the URL answered) and in context (the element was found and checked on its page). The gap list shows what no test touches.
- **Run persistence and diffing.** Runs survive a restart; two runs of the same site can be compared test by test.
- **A structured report** with execution, defects, coverage, performance, usability and SEO detail, and an HTML export.
- **No lock-in.** The suite is plain Playwright TypeScript you can copy, version-control and run without TestForge.

---

## Skills library

Beyond the web app, `skills/` packages TestForge's own testing and engineering judgment as real Claude Code skills — 12 in total (8 under `skills/testing/`, 4 under `skills/engineering/`), installable as the `testforge-skills` plugin and invocable directly with no TestForge app involved at all, e.g. `/testforge-skills:write-playwright-test`. See [`skills/README.md`](skills/README.md) for what each one generalizes from and [`skills/ROADMAP.md`](skills/ROADMAP.md) for what's proposed next.

## Getting started

### Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 24 (`.nvmrc`); 22.6 at least | [nodejs.org](https://nodejs.org) |
| Git | any | [git-scm.com](https://git-scm.com) |
| Docker Desktop | latest | [docker.com](https://docker.com) — needed for the local test targets |
| VS Code | latest | [code.visualstudio.com](https://code.visualstudio.com) (optional) |
| Claude Code | latest | Optional, for the gap writer ([code.claude.com](https://code.claude.com/docs)) |

---

### 1. Clone the repo

```bash
git clone https://github.com/emil3663/testforge.git
cd testforge
```

### 2. Install dependencies

```bash
npm install
```

### 3. Install the Playwright browser

```bash
npx playwright install chromium
```

### 4. Configure your environment

```bash
cp .env.example .env
```

Nothing in it is required: the template generator needs no key. Optional
settings are described in the file, including a local model
(`TESTFORGE_OLLAMA_MODEL`; setup in [`docs/LOCAL_MODEL_SETUP.md`](docs/LOCAL_MODEL_SETUP.md))
and the parked OpenAI path (`OPENAI_API_KEY`).

### 5. Start a test target with Docker

TestForge can test any site you're allowed to test. For a local target,
everything measured since Phase 38 uses local copies of the Toolshop
practice site (`practicesoftwaretesting.com`), one version at a time, with
Docker Desktop running. Their code lives in WSL's Linux filesystem, so they
need Ubuntu under WSL (`wsl --install -d Ubuntu`) with Docker Desktop's WSL
integration turned on for it (`scripts/toolshop-local/README.md`):

```powershell
.\scripts\toolshop-local\start-toolshop.ps1 -Sprint sprint5-with-bugs   # or -Sprint sprint5 for the clean copy
```

The site is then at **<http://localhost:4200>**.

The repo's `docker-compose.yml` also starts Plane at **<http://localhost>**
(`docker compose up -d`, then about 60 seconds to initialise; Plane asks
you to create an admin account on first run). That setup hasn't been
re-checked since Phase 38.

### 6. Start TestForge

```bash
npm run dev
```

Open **<http://127.0.0.1:3000>** in your browser (TestForge listens on this machine only).

---

## How it works

1. **Enter the base URL**, e.g. `http://localhost:4200`, and choose Standard or a Comprehensive area.
2. **Crawl.** TestForge finds the pages, groups them into page types and picks one page of each.
3. **Generate.** It inspects the selected pages and writes the suite with the template generator (and a local model or OpenAI for empty areas, if configured). Review or edit the code.
4. **Run.** The suite runs in Chromium at the gate you chose, and the report shows each result, the findings, the page types covered and skipped, and the coverage map.

---

## Example generated test

Two tests from a real generated suite, unedited: the Standard run on the
local clean Toolshop copy in TFP-207
(`benchmarks/2026-10-15-tfp207-regression/runs/clean-standard-suite.spec.ts`).
`tfGoto`, `tfReadOnlyGuarded` and `tfCheckSteppers` are helpers the suite
defines at its top.

```typescript
  test('TFFU-217: quantity steppers change the value by one on /product/01M50R4WFGYYZ0RG0YQDW0DTQ3', { annotation: [{ type: 'page', description: '/product/01M50R4WFGYYZ0RG0YQDW0DTQ3' }, { type: 'gate', description: 'read-only' }] }, async ({ page }) => {
    // ISTQB: state transition (n, n + 1, n, within the field's bounds).
    await tfGoto(page, '/product/01M50R4WFGYYZ0RG0YQDW0DTQ3');
    let result = { problems: [] as string[], checked: 0 };
    await tfReadOnlyGuarded(page, async () => { result = await tfCheckSteppers(page, '/product/01M50R4WFGYYZ0RG0YQDW0DTQ3'); });
    test.skip(result.checked === 0, 'no number field with + and - buttons on /product/01M50R4WFGYYZ0RG0YQDW0DTQ3');
    expect(result.problems, result.problems.join('; ')).toEqual([]);
  });

  test('TFFU-220: option lists show no error text on /category/hand-tools', { annotation: [{ type: 'page', description: '/category/hand-tools' }, { type: 'gate', description: 'read-only' }] }, async ({ page }) => {
    // ISTQB: error guessing.
    await tfGoto(page, '/category/hand-tools');
    const lists = await page.locator('select').evaluateAll((selects) => selects.map((select) => ({
      name: (select.getAttribute('aria-label') || (select as HTMLSelectElement).labels?.[0]?.textContent || select.getAttribute('name') || select.id || 'a list').replace(/\s+/g, ' ').trim(),
      options: Array.from((select as HTMLSelectElement).options).map((option) => (option.textContent || '').replace(/\s+/g, ' ').trim()),
    })));
    const problems = lists.flatMap((list) => list.options.filter((option) => TF_OPTION_ERROR.test(option)).map((option) => 'the "' + list.name + '" list on /category/hand-tools offers "' + option + '"'));
    expect(problems, problems.join('; ')).toEqual([]);
  });
```

On the with-bugs copy, the stepper test fails with `"+" beside "quantity"
left it at 1 (it was 1; expected 2)` (known bug 40).

---

## Running tests directly (without the UI)

Generated suites are standard Playwright `.spec.ts` files. Use "Save to suite" in the UI to write one into `.playwright-runs/generated-suites`, where VS Code's Test Explorer will pick it up automatically, or run it directly:

```bash
npx playwright test .playwright-runs/generated-suites/my-suite.spec.ts --project=chromium
```

Or run every saved suite:

```bash
npx playwright test --project=chromium
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | [Next.js](https://nextjs.org/) (App Router, TypeScript) |
| Browser automation | [Playwright](https://playwright.dev/) |
| Test runner | [Playwright Test](https://playwright.dev/docs/test-intro), Chromium only |
| Generation | Template generator (default); optional local model via [Ollama](https://ollama.com/) or [OpenAI](https://platform.openai.com/) for areas the template leaves empty |
| Reporting | [Allure](https://allurereport.org/) (smoke and regression suites) |
| Test targets | Local Toolshop copies via Docker (`scripts/toolshop-local/`); [Plane](https://plane.so) via `docker-compose.yml` |

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start TestForge (dev mode) |
| `npm run build` | Build TestForge for production |
| `npm run start` | Start the production build |
| `npm run dev:development` | Start TestForge in dev mode with `.env.development` |
| `npm run lint` | Run ESLint |
| `npm run test:unit` | Run the unit suite (about 620 tests; about 14 min) |
| `npm run check:template-unchanged -- <commit>` | Compare the template generator's output on 166 fixed inputs with a commit's |
| `npm run test:self` | Run the smoke suite |
| `npm run test:self:allure` | Run the smoke suite and generate an Allure report in `artifacts/allure-report/smoke` |
| `npm run test:regression` | Run the regression suite |
| `npm run test:regression:allure` | Run the regression suite and generate an Allure report in `artifacts/allure-report/regression` |
| `npm run report:open:smoke` | Open the latest local smoke Allure report |
| `npm run report:open:regression` | Open the latest local regression Allure report |
| `npm run build:self-test` / `start:self-test` / `serve:self-test` | Build and serve the self-test target on :3001 (the regression suite starts it) |
| `npm run library:promote` | Promote a candidate test into the library (with the tester's approval) |
| `npm run compare:generators` | Compare the template alone with the template plus the local model's gap-fill (setup in `docs/GENERATOR_COMPARISON.md`) |
| `npm run benchmark:local` | Benchmark local (Ollama) models |
| `npm run comparison:fixture` | Serve the comparison fixture: a small site with one switchable injected defect per area |
| `npm run check:openai-models` | Check which OpenAI candidate model `/api/generate` would pick, with one tiny live completion (needs `OPENAI_API_KEY`) |
| `docker compose up -d` | Start Plane (test target) |
| `docker compose down` | Stop Plane |
| `docker compose down -v` | Stop Plane and remove all data |

---

## CI reports

- The PR validation workflow runs lint, build, and the smoke suite with Allure on every pull request, and uploads a smoke Allure artifact.
- The self-test workflow runs the same checks on every push to `main` and keeps its smoke-report artifacts for 30 days.
- The regression workflow can be triggered manually from GitHub Actions and keeps its regression-report artifacts for 30 days. It builds once, before Playwright starts the server.
- Running TestForge itself as a step in another project's pipeline is planned as Phase 47 (`docs/decisions/phase-47-ci-integration-decision-record.md`).
- The nightly workflow runs the unit suite and `check:template-unchanged` (against the recorded template baseline) every night at 02:00 UTC and on manual dispatch, not on every push. The unit log is kept as an artifact for 30 days.

---

## Troubleshooting

### WSL update/install issues on Windows

If you see errors like `Windows Subsystem for Linux must be updated` or `Catastrophic failure`:

1. Verify optional features are enabled:

```powershell
Get-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux | Select-Object FeatureName,State
Get-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform | Select-Object FeatureName,State
```

1. Install/update WSL package from winget:

```powershell
winget install --id Microsoft.WSL -e --accept-package-agreements --accept-source-agreements
```

1. Reboot Windows, then verify:

```powershell
wsl --status
wsl -l -v
```

Expected: WSL default version is 2 and status command succeeds.

### Docker Compose proxy restart loop (Plane)

If `plane-proxy` keeps restarting and `http://localhost` is unreachable:

1. Check proxy logs:

```powershell
docker compose logs plane-proxy --tail 100
```

1. If Caddy config errors are shown (for example `server block without any key...`), use the local Nginx proxy setup in this repo:

- `docker-compose.yml` uses `nginx:1.27-alpine` for `plane-proxy`.
- `docker/nginx/plane.conf` defines routes for `/`, `/api/`, and `/spaces/`.

1. Restart services:

```powershell
docker compose up -d
docker compose ps
```

1. Verify endpoints:

```powershell
Invoke-WebRequest http://localhost -UseBasicParsing | Select-Object -ExpandProperty StatusCode
Invoke-WebRequest http://localhost:3000 -UseBasicParsing | Select-Object -ExpandProperty StatusCode
```

Expected: both commands return `200` when Plane and TestForge are running.

## Licence

MIT (`LICENSE`). The spelling check uses `nspell` and two SCOWL-derived
Hunspell dictionaries, whose notices are in `THIRD_PARTY_NOTICES.md`.
