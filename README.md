# TestForge

**TestForge is an AI-native test automation assistant that works alongside testers, not instead of them.**  
You tell it what you want to test in plain English. It writes the Playwright automation code. You review it, run it, and learn from it. The AI handles the syntax; you provide the judgment.

---

## The problem TestForge solves

There's a gap in software testing that nobody talks about honestly.

**Testers** — people who understand quality, who can spot a bug from a mile away, who understand user flows, edge cases, and risk. They've spent years developing this instinct.

**Automation** — code that runs tests automatically, catches regressions, and lets teams ship with confidence. It's become essential.

The gap between these two worlds is brutal. Testers are told: "Learn to code." They struggle — not because they're not smart enough, but because automation frameworks were built by developers for developers. The learning curve is steep, the feedback loops are slow, and the frustration is real.

Meanwhile, developers write automation but often don't know *what* to test. They automate the happy path and miss the edge cases.

**TestForge exists to close this gap.**

---

## Features

- **Plain-English input** — Describe what you want to test the way you'd explain it to a colleague.
- **AI-generated Playwright code** — Clean, idiomatic TypeScript test files with descriptive names and inline comments so you can learn from them.
- **In-browser code editor** — Review and edit the generated code before running it.
- **One-click test execution** — Run the test directly from the UI and see pass/fail results with output.
- **No lock-in** — The generated code is standard Playwright TypeScript you can copy, version-control, and extend.

---

## Getting started

### Prerequisites

- Node.js ≥ 18
- An [OpenAI API key](https://platform.openai.com/api-keys) (optional — the app works without one using a sample template)

### Installation

```bash
git clone https://github.com/emil3663/testforge.git
cd testforge
npm install
npx playwright install chromium   # install the browser used for test runs
```

### Configuration

```bash
cp .env.example .env.local
# Edit .env.local and add your OPENAI_API_KEY
```

### Running locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## How it works

1. **Enter a base URL** — the root of the application you want to test.
2. **Describe your test** — in plain English, as you'd explain it to a colleague.
3. **Click "Generate test"** — TestForge sends your description to OpenAI and receives a complete Playwright test file.
4. **Review the code** — read the comments, understand what each step does, edit if needed.
5. **Click "Run test"** — the test runs on the server with Playwright and results appear instantly.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 16](https://nextjs.org/) (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| AI | [OpenAI GPT-4o](https://platform.openai.com/) |
| Test runner | [Playwright](https://playwright.dev/) |

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Build for production |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |

