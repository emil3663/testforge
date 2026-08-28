# TestForge

**TestForge is an AI-native test automation assistant that works alongside testers, not instead of them.**  
You tell it what you want to test in plain English. It writes Python Playwright code. You review it, run it, and learn from it. The AI handles the syntax; you provide the judgment.

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
| **VS Code** | Code editor — open this repo as a workspace |
| **GitHub Copilot** | AI assistant in VS Code (install from the extension marketplace) |
| **Python 3.11+** | TestForge runs on Python |
| **Docker Desktop** | Runs Plane — the test target application |
| **Git** | Version control |

---

## Features

- **Plain-English input** — Describe what you want to test the way you'd explain it to a colleague.
- **AI-generated Python code** — Clean, idiomatic `pytest-playwright` test files with descriptive names and inline comments so you can learn from them.
- **In-browser code editor** — Review and edit the generated code before running it.
- **One-click test execution** — Run the test directly from the UI and see pass/fail results with output.
- **No lock-in** — The generated code is standard Python you can copy, version-control, and extend.

---

## Getting started

### Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Python | 3.11+ | [python.org](https://python.org) |
| Git | any | [git-scm.com](https://git-scm.com) |
| Docker Desktop | latest | [docker.com](https://docker.com) — needed to run Plane |
| VS Code | latest | [code.visualstudio.com](https://code.visualstudio.com) |
| GitHub Copilot | extension | Install from VS Code marketplace |

---

### 1. Clone the repo

```bash
git clone https://github.com/emil3663/testforge.git
cd testforge
```

### 2. Open in VS Code

```bash
code .
```

When prompted, install the **recommended extensions** (GitHub Copilot, Python, Playwright, Docker). Or open the Extensions panel and search `@recommended`.

### 3. Create a Python virtual environment

```bash
python -m venv .venv
```

Activate it:

| Platform | Command |
|---|---|
| macOS / Linux | `source .venv/bin/activate` |
| Windows (PowerShell) | `.venv\Scripts\Activate.ps1` |
| Windows (cmd.exe) | `.venv\Scripts\activate.bat` |

VS Code will detect `.venv` automatically and use it as the Python interpreter.

### 4. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 5. Install the Playwright browser

```bash
playwright install chromium
```

### 6. Configure your environment

```bash
cp .env.example .env
```

Edit `.env` and add your OpenAI API key (optional — TestForge works without it using a sample template):

```
OPENAI_API_KEY=sk-...
```

Environment-specific templates are also available:

- `.env.development`
- `.env.staging`
- `.env.production`

FastAPI loads `.env` first and then overlays `.env.<TESTFORGE_ENV>` when `TESTFORGE_ENV` is set.
Next.js can be started with the matching scripts such as `npm run dev:staging` or `npm run build:production`.

### 7. Start the test target (Plane) with Docker

```bash
docker compose up -d
```

Wait about 60 seconds for all services to initialise. Plane will be available at **<http://localhost>**.

> **First run**: Plane will prompt you to create an admin account at <http://localhost>.  
> Use those credentials when describing login tests to TestForge.

### 8. Start TestForge

```bash
uvicorn app:app --reload
```

Open **<http://localhost:8000>** in your browser.

---

## How it works

1. **Enter the base URL** — e.g. `http://localhost` (where Plane is running).
2. **Describe your test** — in plain English, as you'd explain it to a colleague.
3. **Click "Generate test"** — TestForge calls OpenAI and receives a complete `pytest-playwright` Python test file.
4. **Review the code** — read the comments, understand each step, edit if needed.
5. **Click "Run test"** — the test runs on the server and results appear instantly.

---

## Example generated test

```python
from playwright.sync_api import Page, expect


def test_login_with_valid_credentials(page: Page) -> None:
    """User can sign in and reach the workspace dashboard."""
    # Open the Plane login page
    page.goto("http://localhost")

    # Fill in credentials
    page.get_by_label("Email").fill("admin@example.com")
    page.get_by_label("Password").fill("your-password")
    page.get_by_role("button", name="Sign in").click()

    # Verify the dashboard is visible after login
    expect(page.get_by_role("heading", name="Home")).to_be_visible()


def test_login_with_wrong_password_shows_error(page: Page) -> None:
    """Wrong password displays a helpful error message."""
    page.goto("http://localhost")
    page.get_by_label("Email").fill("admin@example.com")
    page.get_by_label("Password").fill("wrong-password")
    page.get_by_role("button", name="Sign in").click()

    # Error message should be visible
    expect(page.get_by_text("Invalid credentials")).to_be_visible()
```

---

## Running tests directly (without the UI)

Generated tests are standard pytest files. Copy one and run it directly:

```bash
pytest my_test.py -v --browser=chromium
```

Or run all tests in the `runs/` folder:

```bash
pytest runs/ -v --browser=chromium
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Language | Python 3.11+ |
| Web framework | [FastAPI](https://fastapi.tiangolo.com/) |
| Browser automation | [Playwright for Python](https://playwright.dev/python/) |
| Test runner | [pytest](https://pytest.org) + [pytest-playwright](https://github.com/microsoft/playwright-pytest) |
| AI | [OpenAI GPT-4o](https://platform.openai.com/) |
| Test target | [Plane](https://plane.so) via Docker |

---

## Scripts

| Command | Description |
|---|---|
| `uvicorn app:app --reload` | Start TestForge (dev mode with auto-reload) |
| `uvicorn app:app` | Start TestForge (production mode) |
| `docker compose up -d` | Start Plane (test target) |
| `docker compose down` | Stop Plane |
| `docker compose down -v` | Stop Plane and remove all data |
| `npm run test:self:allure` | Run the smoke suite and generate an Allure report in `artifacts/allure-report/smoke` |
| `npm run test:regression:allure` | Run the regression suite and generate an Allure report in `artifacts/allure-report/regression` |
| `npm run report:open:smoke` | Open the latest local smoke Allure report |
| `npm run report:open:regression` | Open the latest local regression Allure report |
| `pytest runs/ -v` | Run all generated tests directly |

---

## CI reports

- The smoke workflow uploads an Allure artifact on every CI run and keeps the latest 5 smoke-report artifacts.
- The regression workflow can be triggered manually from GitHub Actions and also keeps the latest 5 regression-report artifacts.

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
Invoke-WebRequest http://localhost:8000 -UseBasicParsing | Select-Object -ExpandProperty StatusCode
```

Expected: both commands return `200` when Plane and TestForge are running.

## Consolidation cutover (single UI mode)

TestForge is being consolidated so the Next.js app at <http://localhost:3000> is the primary UI.

Current state:

1. FastAPI no longer serves the legacy HTML UI at `/`; it redirects to Next.js.

Recommended cutover settings in .env:

- TESTFORGE_NEXT_UI_URL=<http://localhost:3000>

Recommended environment selection:

- Local development: `TESTFORGE_ENV=development`
- Shared test or preview: `TESTFORGE_ENV=staging`
- Production deployment: `TESTFORGE_ENV=production`

Verification checklist:

1. Start Next.js and FastAPI services.
1. Open <http://localhost:3000> and confirm generate/introspect/crawl/run/save-suite flows work.
1. Open <http://localhost:8000> and confirm it redirects to <http://localhost:3000>.

Rollback:

1. Keep TESTFORGE_NEXT_UI_URL set to your preferred UI host.
