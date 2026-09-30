# Setting up a local model for TestForge generation

TestForge can generate its Playwright suites with a model running on your own
machine, through [Ollama](https://ollama.com), instead of the OpenAI API. It
costs nothing per request and nothing leaves your machine. This page covers
the one model TestForge is set up for, how to create it, and how to point
TestForge at it.

> **Scope:** one model, `qwen2.5-coder:7b`, in one fixed configuration. It is
> the model that was measured against TestForge's real prompt (Phase 30,
> `docs/decisions/phase-30-local-generation-path-decision-record.md`). Trying
> lighter or different models is deliberately later work, not something this
> page tunes.

---

## What you need

- Ollama installed and running (`ollama --version` answers; the server listens
  on `http://localhost:11434` by default).
- About 5GB of disk for the model.
- Patience: on the reference machine (RTX 2050, 4GB VRAM) one suite takes
  about 40s with this setup (median of 21 measured, p90 57s; Phase 36
  benchmark). More VRAM is faster; no GPU at all is much slower.

## 1. Pull the base model

```sh
ollama pull qwen2.5-coder:7b
```

## 2. Create TestForge's model from the Modelfile

TestForge never calls `qwen2.5-coder:7b` directly. It calls
**`testforge-qwen7b`**, a model defined by
[`ollama/Modelfile.testforge-qwen7b`](../ollama/Modelfile.testforge-qwen7b):

```text
FROM qwen2.5-coder:7b
PARAMETER num_ctx 16384
PARAMETER num_predict 4096
PARAMETER temperature 0.2
PARAMETER num_gpu 29
```

This is not optional tuning. Ollama's OpenAI-compatible endpoint, which
TestForge uses, **silently drops a `num_ctx` sent with a request** and picks a
context size from available VRAM instead. TestForge's prompt carries the whole
page-inspection profile, so a small automatic context would cut it off without
any error. Baking the sizes into the model is the only way to guarantee them.

`num_gpu 29` puts all 29 of the model's layers on the GPU. Left to itself,
Ollama put 11 there on the reference machine and ran 59% of the model on the
CPU while 1.6GB of VRAM sat unused. The Phase 36 benchmark
(`docs/decisions/phase-36-local-model-measurement-report.md`) measured the
median suite at 39.5s instead of 68.2s, with the same quality, and a
back-to-back rerun confirmed it (39.4s against 65.5s). On a 4GB card the full
model does not quite fit: from about 22 layers the VRAM is full, and Windows'
NVIDIA driver moves the overflow into shared system memory rather than
failing, so a first, cold prompt is slower (about 32s to read, against 9s).
Every later request reuses most of that work, so a normal run is faster
overall. With more VRAM everything fits and the setting simply applies. With
less, or on a system without that driver fallback, remove the line and let
Ollama choose.

From the repository root:

```sh
ollama create testforge-qwen7b -f ollama/Modelfile.testforge-qwen7b
```

Use exactly that name. TestForge looks it up by name, and a missing model is
reported as `ollama_model_missing` (below) rather than falling back to the raw
`qwen2.5-coder:7b`.

## 3. Check Ollama sees it

```sh
ollama list
```

`testforge-qwen7b:latest` should be listed. Ollama adds the `:latest` tag
itself; TestForge accepts the name with or without it.

To check the exact endpoint TestForge talks to:

```sh
curl http://localhost:11434/v1/models
```

## 4. Point TestForge at it

Add to `.env.local` (gitignored — not `.env.development`, which is committed):

```sh
TESTFORGE_OLLAMA_MODEL=testforge-qwen7b
```

Restart the dev server. Setting this variable is the whole opt-in:

| Set | TestForge generates with |
| --- | --- |
| `TESTFORGE_OLLAMA_MODEL` | the local model — even if `OPENAI_API_KEY` is also set |
| only `OPENAI_API_KEY` | OpenAI |
| neither | the built-in template generator |

Optional, only if the defaults don't fit:

| Variable | Default | When to change it |
| --- | --- | --- |
| `TESTFORGE_OLLAMA_BASE_URL` | `http://localhost:11434/v1` | Ollama on another port or machine. Keep the `/v1`. |
| `TESTFORGE_OLLAMA_TIMEOUT_MS` | `180000` (3 min) | Slower hardware that needs longer than 3 minutes per generation. |

## 5. Verify a generation

Generate a suite in the app. The `/api/generate` response says which path
produced it:

- `"generatedBy": "ollama", "model": "testforge-qwen7b:latest"` — the local
  model wrote it.
- `"generatedBy": "fallback"` — the local call failed and you got the template
  generator's suite instead. `fallbackReason` says why (next section).

## Read a local suite before trusting it

This model sometimes invents Playwright APIs. Before Phase 31 it wrote
`expect(locator).toBeAccessible()`, a matcher Playwright doesn't have, for
every accessibility request. Two things now guard against that:

- **Local-only rules** (`src/lib/generate/local-rules.ts`) are added to the
  model's instructions: shared API rules, plus a worked example for each
  requested area that has one (accessibility, reliability, performance, SEO,
  database, security). For accessibility they list the matchers that do exist,
  forbid the invented ones, and include a worked example. Since they were
  added, accessibility requests have produced real checks (`toHaveRole`,
  `toHaveAccessibleName`, `toBeFocused`) three times running.
- **A type check.** Every local suite is checked against the installed
  `@playwright/test` before it is returned, and checked for assertions that
  are never awaited. A suite that fails either check never reaches you as
  model output. You get the template generator's suite,
  labelled `"fallbackReason": "invalid_output"`, and the server console lists
  the exact errors.

Compiling is not the same as being right. The check cannot see a missing
`await`, a wrong URL, or an assertion that fails on your real page, and some
categories come back thin: a suite that only checks visibility, filed under a
heading like "SEO". `TEST_PLAN.md` records a per-category baseline (GEN-28)
and the Phase 33 results per area (GEN-32 to GEN-36), and Known Limitations
item 9 lists the details. Reliability suites in particular often repeat one
test under titles naming the page's fields, so read those closely.

## When it falls back

TestForge never fails a generation because the local model did. Any failure
returns the template generator's suite, labelled so it is never mistaken for
model output, and logs the cause on the server console.

| `fallbackReason` | Meaning | Fix |
| --- | --- | --- |
| `ollama_unreachable` | Nothing answered at the base URL. | Start Ollama (`ollama serve`, or the tray app), or fix `TESTFORGE_OLLAMA_BASE_URL`. |
| `ollama_model_missing` | Ollama answered, but has no model by that name. | Run step 2, or fix `TESTFORGE_OLLAMA_MODEL`. |
| `ollama_error` | Ollama answered with an error, e.g. the model failed to load. | Check Ollama's own log; often not enough memory. |
| `timeout` | No answer within `TESTFORGE_OLLAMA_TIMEOUT_MS`. | Raise the timeout, or close other GPU-heavy programs. |
| `empty_completion` | The model returned nothing usable. | Retry; if it repeats, report it. |
| `invalid_output` | The model returned a suite, but it doesn't type-check against Playwright (for example, it calls a matcher Playwright doesn't have). The server console lists the errors. | See [Read a local suite before trusting it](#read-a-local-suite-before-trusting-it). Retrying, or wording the request differently, can help. |
| `unawaited_assertion` | The suite compiled, but has a check on the page or an element without `await`, which never runs. The server console lists the lines. | Retry. The rules already tell the model to await every check. |
| `promise_to_plain_matcher` | The suite compiled, but a check hands a Promise to a plain matcher, e.g. `expect(locator.isDisabled()).toBe(true)`, which compares the Promise, not its value, and can never pass. The server console lists the lines. | Retry. |
| `duplicate_tests` | The suite compiled, but two or more of its tests have the same body under different titles, so it claims checks it doesn't make. The server console lists them. | Retry. |

## Checklist

- [ ] `ollama pull qwen2.5-coder:7b`
- [ ] `ollama create testforge-qwen7b -f ollama/Modelfile.testforge-qwen7b`
- [ ] `ollama list` shows `testforge-qwen7b:latest`
- [ ] `TESTFORGE_OLLAMA_MODEL=testforge-qwen7b` in `.env.local`, server restarted
- [ ] A generation returns `"generatedBy": "ollama"`
