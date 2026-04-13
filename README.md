# TestForge

**TestForge is an AI-native test automation assistant that works alongside testers, not instead of them.**  
You tell it what you want to test in plain English. It writes Python Playwright code. You review it, run it, and learn from it. The AI handles the syntax; you provide the judgment.

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

### 7. Start the test target (Plane) with Docker

```bash
docker compose up -d
```

Wait about 60 seconds for all services to initialise. Plane will be available at **http://localhost**.

> **First run**: Plane will prompt you to create an admin account at http://localhost.  
> Use those credentials when describing login tests to TestForge.

### 8. Start TestForge

```bash
uvicorn app:app --reload
```

Open **http://localhost:8000** in your browser.

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
| `pytest runs/ -v` | Run all generated tests directly |


