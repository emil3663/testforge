# Comparing the template generator with the local model

TestForge can write a test suite in two ways: the built-in **template
generator** (deterministic, instant) and a **local model** running in Ollama
(see [LOCAL_MODEL_SETUP.md](LOCAL_MODEL_SETUP.md)). This page shows how to run
both against the same site and get a side-by-side report.

It runs **on demand, on your own machine**. There is no CI job: Ollama runs
only on your machine, and a hosted CI runner can't reach it (Phase 21 record,
Amendment). The latest report is in
[`decisions/phase-21-comparison-report.md`](decisions/phase-21-comparison-report.md).

---

## What you need

- The local model set up and working ([LOCAL_MODEL_SETUP.md](LOCAL_MODEL_SETUP.md), steps 1-3).
- A TestForge server to run the suites. Any running instance works, and it
  does **not** need `TESTFORGE_OLLAMA_MODEL` set. The comparison picks the
  generator itself, per request. From the repository root:

  ```sh
  npx dotenv -e .env.development -- npx next build
  npx dotenv -e .env.development -- npx next start --hostname 127.0.0.1 --port 3100
  ```

  Port 3100 keeps it clear of a `next dev` on 3000. Only one `next dev` can
  run per checkout, but `next start` can run alongside it.

## 1. Pick a target

Targets are JSON configs in `scripts/comparison-configs/`:

| Config | Target | What it's for |
| --- | --- | --- |
| `fixture.json` | The comparison fixture, a small local site started below | Every dimension, including defect detection: each case can switch on one injected defect |
| `the-internet.json` | `https://the-internet.herokuapp.com` (public) | A real site nobody tuned for either generator. There's no defect switch, so defect detection is reported as skipped |

To use the fixture, start it in another terminal:

```sh
npm run comparison:fixture
```

It serves a home page, a sign-in form and a notes page on
`http://127.0.0.1:4410`. It can switch on one defect at a time: a missing meta
description, an unlabelled field, notes that aren't saved, 4-second responses,
an uncaught error when its API fails, or a note rendered as raw HTML. The
comparison switches them itself.

## 2. Run the comparison

```sh
npm run compare:generators -- --config scripts/comparison-configs/fixture.json
```

Options: `--server http://127.0.0.1:3100` (default), `--model testforge-qwen7b`
(default), and `--only functional,accessibility` to run some cases only.

A case can set `"enableInteractive": true`. Tests that submit forms on the
site (journeys, and the template's database round trip) are skipped unless a
run enables interactive tests, so without it they show up as skipped.

For each case, the command:

1. Inspects the target once, so both generators get the same page data.
2. Generates a suite with the template generator and with the local model,
   through the real `/api/generate` code.
3. Runs both suites through the TestForge server, like any other run. Both
   runs are saved in `runs/`, and you can open them in the app.
4. Diffs the two runs with the run-diff API (`/api/runs/diff`).
5. If the case names a defect, runs both suites again with that defect on.

It prints progress as it goes and writes everything to
`comparisons/<timestamp>-<config>/`: the shared page data, both suites for
each case, and `results.json`. The `comparisons/` folder is gitignored. The
fixture run takes about 15 minutes, almost all of it spent generating with
the local model (about 1 minute per suite).

If the local model falls back to the template (`invalid_output`,
`unawaited_assertion`, etc.), that case's local runs are skipped and the
report says why. Running the template's suite twice would compare nothing.

## 3. Build the report

```sh
node scripts/comparison-report.mjs comparisons/<dir> [comparisons/<dir> ...] > report.md
```

Per case, the report scores:

| Dimension | How |
| --- | --- |
| Latency and cost | Generation and run wall time. Cost is $0 for both: no API is involved. |
| Coverage | Two numbers, both shown. The run report's discovered-surface coverage only credits a test whose title matches the template generator's naming, so it structurally scores model-written tests near 0% whatever they test. Next to it: how many distinct discovered elements each suite's code refers to by name, a title-independent proxy. |
| Pass/fail agreement | Per area. The two generators never share test titles, so a title-by-title comparison would find no overlap. |
| Defect detection | A generator detects an injected defect when one of its tests passes on the clean site and fails with the defect on. Without an injected defect this is reported as skipped, never guessed. |

Read the suites too (they sit next to `results.json`). "Passes" and
"detected" are facts about a run, and whether the tests are *good* still
takes a person reading them.
