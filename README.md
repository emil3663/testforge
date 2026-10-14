# TestForge

**TestForge is an AI-native test automation assistant that works alongside testers, not instead of them.**  
You tell it what you want to test in plain English. It writes TypeScript Playwright code. You review it, run it, and learn from it. The AI handles the syntax; you provide the judgment.

---

## Security model

TestForge is a local-only developer tool and is not designed to be deployed.
`/api/run` executes caller-supplied code with the privileges of the user
running the dev server — this is intended behaviour under the local-only
model, not a vulnerability to be patched. There is no authentication,
sandboxing, or multi-tenant isolation.

**Do not bind TestForge to a non-loopback interface and do not expose it
through a tunnel** (ngrok, Cloudflare Tunnel, port forwarding, etc.). Doing
so exposes arbitrary remote code execution to anyone who can reach the port.

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

**Gap tests (opt-in per site, off by default).** A site can have its
uncovered elements written for, once per gap: `POST /api/site-settings`
with `{ "baseUrl": "...", "gapWriter": "claude-code" }` (or
`"local-model"`, which needs `TESTFORGE_OLLAMA_MODEL`; `"off"` turns it
back off). Turning it on sends that site's page structure to the writer.
Each written test runs at the read-only gate, inside the request guard; one
that passes joins the site suite, and one that breaches the gate is
rejected. At most 5 gaps per generation (`TESTFORGE_GAP_LIMIT`). The
report says what was written and what Claude Code reported it cost.

Each saved gap test is also generalised to its component's pattern and
kept in the candidate pool (`candidates/` in the data folder). On a
Comprehensive run of any site, a candidate whose pattern matches an
uncovered element runs in its own "Candidate tests" section, outside the
verdict, and each run adds to its evidence. Standard never runs them.

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
| **Node.js 20+** | TestForge runs on Next.js |
| **Docker Desktop** | Runs Plane — the test target application |
| **VS Code** | Code editor — open this repo as a workspace (optional) |
| **GitHub Copilot** | AI assistant in VS Code (optional, install from the extension marketplace) |
| **Git** | Version control |

---

## Features

- **Plain-English input** — Describe what you want to test the way you'd explain it to a colleague.
- **AI-generated TypeScript code** — OpenAI GPT-4o generates `.spec.ts` Playwright suites with descriptive test names; a template-based generator produces a working suite when no API key is configured.
- **Site crawl and page introspection** — TestForge can crawl the target site and inspect individual pages to generate content-aware coverage instead of guessing at selectors. Coverage is denominated against that discovered element surface, not just the tests that ran: every unmatched element is bucketed as not-selected, excluded-by-generator, or a genuine generator gap.
- **In-browser code editor** — Review and edit the generated suite before running it.
- **Async run lifecycle** — Runs execute in the background with live progress, cancellation, and targeted rerun of just the failed tests.
- **Seven-tab structured report** — Summary, execution, defects, coverage, performance, usability, and (when SEO coverage is selected) SEO, each with an HTML export.
- **Run diffing** — Compare two persisted runs of the same target: which tests flipped pass/fail, the coverage-percentage delta per practice area, and elements newly discovered or newly missing between runs.
- **No lock-in** — The generated code is a standard Playwright TypeScript suite you can copy, version-control, and extend, or open directly in VS Code's Test Explorer.

---

## Skills library

Beyond the web app, `skills/` packages TestForge's own testing and engineering judgment as real Claude Code skills — 12 in total (8 under `skills/testing/`, 4 under `skills/engineering/`), installable as the `testforge-skills` plugin and invocable directly with no TestForge app involved at all, e.g. `/testforge-skills:write-playwright-test`. See [`skills/README.md`](skills/README.md) for what each one generalizes from and [`skills/ROADMAP.md`](skills/ROADMAP.md) for what's proposed next.

## Getting started

### Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |
| Git | any | [git-scm.com](https://git-scm.com) |
| Docker Desktop | latest | [docker.com](https://docker.com) — needed to run Plane |
| VS Code | latest | [code.visualstudio.com](https://code.visualstudio.com) (optional) |
| GitHub Copilot | extension | Install from VS Code marketplace (optional) |

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

Edit `.env` and add your OpenAI API key (optional — TestForge works without it using a template-based generator):

```
OPENAI_API_KEY=sk-...
```

### 5. Start the test target (Plane) with Docker

```bash
docker compose up -d
```

Wait about 60 seconds for all services to initialise. Plane will be available at **<http://localhost>**.

> **First run**: Plane will prompt you to create an admin account at <http://localhost>.  
> Use those credentials when describing login tests to TestForge.

### 6. Start TestForge

```bash
npm run dev
```

Open **<http://localhost:3000>** in your browser.

---

## How it works

1. **Enter the base URL** — e.g. `http://localhost` (where Plane is running).
2. **Describe your test** — in plain English, as you'd explain it to a colleague. Optionally crawl the site or introspect a page first so generation is content-aware.
3. **Click "Generate test suite"** — TestForge calls OpenAI and returns a complete TypeScript Playwright `.spec.ts` file.
4. **Review the code** — read it, understand each step, edit if needed.
5. **Click "Run suite"** — the suite runs against Chromium and a structured report appears with execution, defect, coverage, performance, usability, and (when applicable) SEO detail.

---

## Example generated test

```typescript
import { test, expect } from '@playwright/test';

test.describe('Login flow', () => {
  test('user can sign in and reach the workspace dashboard', async ({ page }) => {
    // Open the Plane login page
    await page.goto('http://localhost');

    // Fill in credentials
    await page.getByLabel('Email').fill('admin@example.com');
    await page.getByLabel('Password').fill('your-password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Verify the dashboard is visible after login
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  });

  test('wrong password shows an error', async ({ page }) => {
    await page.goto('http://localhost');
    await page.getByLabel('Email').fill('admin@example.com');
    await page.getByLabel('Password').fill('wrong-password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Error message should be visible
    await expect(page.getByText('Invalid credentials')).toBeVisible();
  });
});
```

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
| AI | [OpenAI GPT-4o](https://platform.openai.com/) |
| Reporting | [Allure](https://allurereport.org/) (smoke and regression suites) |
| Test target | [Plane](https://plane.so) via Docker |

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start TestForge (dev mode) |
| `npm run build` | Build TestForge for production |
| `npm run start` | Start the production build |
| `npm run lint` | Run ESLint |
| `npm run test:self` | Run the smoke suite |
| `npm run test:self:allure` | Run the smoke suite and generate an Allure report in `artifacts/allure-report/smoke` |
| `npm run test:regression` | Run the regression suite |
| `npm run test:regression:allure` | Run the regression suite and generate an Allure report in `artifacts/allure-report/regression` |
| `npm run report:open:smoke` | Open the latest local smoke Allure report |
| `npm run report:open:regression` | Open the latest local regression Allure report |
| `docker compose up -d` | Start Plane (test target) |
| `docker compose down` | Stop Plane |
| `docker compose down -v` | Stop Plane and remove all data |

---

## CI reports

- The PR validation workflow runs lint, build, and the smoke suite with Allure on every pull request, and uploads a smoke Allure artifact.
- The self-test workflow runs the same checks on every push to `main` and keeps the latest 5 smoke-report artifacts.
- The regression workflow can be triggered manually from GitHub Actions and keeps the latest 5 regression-report artifacts.

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
