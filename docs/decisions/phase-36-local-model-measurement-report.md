# Phase 36 Measurement Report — Local Model Configurations

Date: 2026-09-29 to 2026-09-30
Tickets: TFP-126 (the benchmark), TFP-127 (the runs and the choice)
Record: `phase-36-trust-and-local-model-measurement-decision-record.md`,
Decisions 4-7, as amended 2026-09-29 (N = 12288; C8 added).
Machine: Windows 11 (10.0.26200.9457), NVIDIA GeForce RTX 2050 (4 GB),
driver 610.78, Ollama 0.34.4. No other GPU programs were running for any
configuration.
Raw data: `benchmarks/2026-09-29/<config>/` (per-call `results.json`, every
generated suite, machine details, the Modelfile Ollama ran) and
`benchmarks/2026-09-29-confirm/` (the confirmation run).
Reproduce: `npm run benchmark:local -- --config <id> ...`, then
`node scripts/benchmark-summary.mjs benchmarks/<date>/<id>`.

> **Correction, 2026-09-30 (after independent verification).** The benchmark
> ran each model suite on its own, without the `test.use({ baseURL })` that
> TestForge's merged gap-fill suite gives it. Suites that navigated to a
> relative URL (`page.goto('/login')`) therefore failed with "Cannot
> navigate to invalid URL", which would have worked in TestForge. Only C3
> (3 suites) and C6 (2) wrote relative URLs. Those 5 suites were re-run
> with the base URL, with no new model calls (`--rerun-relative`,
> `benchmarks/2026-09-29/C3|C6/rerun-with-base-url.json`). Corrected:
> **C3 now meets the bar** (19 clean-run passes, not 17); C6 still does
> not. **The choice is unchanged:** C8 is still the fastest qualifier,
> and still C7's base. The original figures stay in `results.json`; the
> tables below show both where they differ. The benchmark now adds the
> base URL itself.

## Bottom line

**C8 wins: `testforge-qwen7b` unchanged except `num_gpu 29`**, which puts
all 29 of the model's layers on the GPU (Ollama chose 11 by itself). It
meets Decision 7's quality bar, and it is the fastest of all that do
(C3 also qualifies, after the correction above, at 56.9 s): median **39.5 s** per suite against C1's **68.2 s**
(p90 56.3 s against 129.9 s), with the same code quality and defect
detection. A back-to-back confirmation run on the same machine gave the
same result: C8 39.4 s, C1 65.5 s.

- Of the smaller, lower-precision or different models, only the q3_K_M 7B
  (C3) qualified, after the correction, and it is slower than C8. The rest
  lost suites to the gates, to false failures on the healthy fixture, or to
  timeouts.
- `qwen3.5:4b` (C5) timed out on 16 of 21 calls: it reasons before
  answering by default, and at under 5 tokens per second that doesn't fit
  in TestForge's 180 s budget. The 5 it finished were good.
- Flash attention with a q8_0 KV cache (C7, on C8's settings) made things
  **slower** (median 92.8 s) and cost two suites to type errors.
- Adopted per Decision 7: `ollama/Modelfile.testforge-qwen7b` gains
  `num_gpu 29`, and `docs/LOCAL_MODEL_SETUP.md` explains it. The default
  model name, `testforge-qwen7b`, is unchanged.
- **Phase 33's category bar on C8, run 2026-09-30:** performance, SEO,
  security and accessibility meet it (3/3). Reliability (1/3), database
  (1/3) and functional (0/3 without an invented destination) do not. See
  "Phase 33 category bar on C8" below.

## The comparison

Out of 21 suites per configuration: 7 fixture cases × 3 calls, each case's
page data inspected once and shared by every configuration. Decision 7's
bar: no more than 1 worse than C1 on each of the four quality measures, and
no more timeouts than C1.

| Config | Model, quantisation, context | Median / p90 | Timeouts | Both gates | Category signal | Clean-run passes | Defects caught | Loaded size, CPU/GPU | Bar |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **C1** | qwen2.5-coder 7B q4_K_M, 16384 (today) | 68.2 / 129.9 s | 0 | 21 | 21 | 20 | 16 of 18 | 5.8 GB, 59/41 | baseline |
| C2 | same, 12288 | 65.9 / 118.6 s | 0 | 21 | 21 | 18 | 16 of 18 | 5.6 GB, 59/41 | ✗ clean −2 |
| C3 | qwen2.5-coder 7B q3_K_M, 12288 | 56.9 / 106.4 s | 0 | 21 | 21 | ~~17~~ **19** | 15 of 18 | 4.7 GB, 52/48 | ~~✗ clean −3~~ **✓** (corrected) |
| C4 | qwen2.5-coder 3B q4_K_M, 12288 | 12.3 / 148.7 s | 0 | 16 | 21 | 12 | 12 of 15 | 2.8 GB, 14/86 | ✗ gates −5 |
| C5 | qwen3.5 4B q4_K_M, 12288 | 180 / 180 s | 16 | 5 | 5 | 4 | 5 of 5 | 4.0 GB, 54/46 | ✗ timeouts |
| C6 | llama3.1 8B q4_K_M, 12288 | 117.7 / 177.1 s | 2 | 19 | 19 | ~~10~~ **12** | ~~11~~ **13** of 16 | 6.7 GB, 67/33 | ✗ |
| C7 | C8 + flash attention + q8_0 KV cache | 92.8 / 135.7 s | 0 | 19 | 21 | 17 | 13 of 16 | 5.0 GB, 100% GPU | ✗ gates −2 |
| **C8** | C1 + `num_gpu 29` | **39.5 / 56.3 s** | 0 | 21 | 21 | 19 | 16 of 18 | 5.5 GB, 100% GPU | **✓** |

"Clean-run passes" and "defects caught" count only suites that passed both
gates; a suite rejected by a gate is never run. "Defects caught" is out of
the gate-passing suites whose case has an injected defect (functional has
none).

**Applying Decision 7:** C8 qualifies (clean-run passes 19, one fewer than
C1, within the bar; every other measure equal), and so, after the
correction, does C3 (clean-run passes 19 and detections 15, each one fewer
than C1). C7's base is the faster of the two, C8, and C7 does not qualify.
Among qualifiers the lowest median wins: **C8** (39.5 s against C3's
56.9 s).

### Confirmation run (added at Emil's request)

Other applications were closed partway through C5, so C2-C4 and the first
part of C5 ran on a busier machine than the rest. To rule that out, C1 and
the winner were run again back to back, on the same page data:

| Config | Median / p90 | Timeouts | Both gates | Signal | Clean-run passes | Defects caught | Split |
| --- | --- | --- | --- | --- | --- | --- | --- |
| C1 (confirm) | 65.5 / 125.0 s | 0 | 21 | 21 | 18 | 16 of 18 | 59/41 |
| C8 (confirm) | 39.4 / 56.7 s | 0 | 21 | 21 | 21 | 16 of 18 | 100% GPU |

The result holds: C8 is 40% faster, and no worse on quality.

## Per configuration

- **C1 (baseline).** Output speed, not prompt size, sets the time: about
  3.7 tokens per second out, so a 468-token reliability suite takes 130 s
  and a 141-token database suite 38 s. Ollama put 11 of 29 layers on the
  GPU and left 1.6 GB of VRAM unused.
- **C2.** A smaller context saved 0.2 GB and changed nothing else about the
  split; the small speed-up is within run-to-run variation.
- **C3.** Smaller and a little faster (the prompt is read at half the speed,
  output slightly faster). Its functional suites navigated to relative
  URLs, so as first run all three failed on the missing base URL (see the
  correction). Re-run with it, two pass; the third fails on a guessed form
  role named "Sign in" that the page doesn't expose. One accessibility
  suite also failed clean. Corrected, C3 meets the bar, and is slower than
  C8.
- **C4.** Fast whenever it answers normally (median 12.3 s, 86% on the GPU),
  but 5 suites failed the gates: 3 accessibility suites invented APIs, 2
  functional suites left assertions unawaited. Two accessibility calls ran to
  the 4,096-token output limit without stopping (about 150 s each).
- **C5.** Qwen 3.5 thinks before it answers by default, and TestForge's path
  doesn't turn that off (Decision 5 changes only model, quantisation and
  context). It wrote 820-930 output tokens when it finished, at under 5 per
  second, so 16 of 21 calls hit the 180 s budget. The 5 it finished (SEO and
  database) passed the gates, and 4 of them passed clean and caught the
  defect. **Not measured:** the same model with thinking off, which would be
  a new configuration and needs Emil's approval.
- **C6.** The general-purpose model is slowest (a third of it fits on the
  GPU), timed out twice, and its suites failed on the healthy fixture 9
  times (functional, SEO, performance and security assumptions that don't
  match the page).
- **C8.** Found by stepping `num_gpu` from 12 to 29 and recording every
  attempt (`benchmarks/2026-09-29/C8/num-gpu-steps.json`). **Every value
  loaded without an error.** From 22 layers on, VRAM stays full at about
  3.9 GB and a cold 6,608-token prompt takes 32-40 s to read instead of
  9 s: the Windows NVIDIA driver moves the overflow into shared system
  memory rather than failing. By the amended rule (the largest value that
  loads without error), C8 uses 29. In measured calls this cold cost
  disappears, because every request reuses the prompt prefix all requests
  share, and output runs at about 9.6 tokens per second instead of 3.7.
  **Not measured:** 21 layers, the largest value that fits in VRAM without
  spilling.
- **C7.** The runner showed `--flash-attn on --cache-type-k q8_0
  --cache-type-v q8_0 -ngl 29`. Normal runs already start Ollama's runner
  with `--flash-attn auto`, so the q8_0 cache is the real difference. It
  was more than twice as slow as C8, and two reliability suites failed the
  type check. The server was put back to normal afterwards.

## Method

- **The real path.** Each fixture case's messages are built by the route's
  own code (`buildGapFillMessages`, moved out of the route with its chat
  bodies proven byte-identical) and sent through `generateLocalSuite`, the
  route's own call and gates, on the OpenAI-compatible endpoint TestForge
  uses. The same messages then go to Ollama's native `/api/chat`, which
  reports timings. Prompt token counts matched on every call where both
  endpoints answered.
- **Call order.** Ollama reuses its cached prompt when a request repeats the
  one before it, so each round makes all seven TestForge-path calls, then all
  seven native calls; every call follows a different request. That is the
  steady state a user sees: the shared system prompt, rules and page data
  (about 6,000 of the ~6,300 prompt tokens) are cached, the request isn't.
- **Cold numbers** come from one unscored native warm-up per configuration,
  with the model unloaded first.
- **Settings** are baked into a Modelfile per configuration
  (`benchmarks/2026-09-29/modelfiles/`), because the OpenAI-compatible
  endpoint drops `num_ctx`. temperature 0.2 and num_predict 4096 everywhere.
- **Quality** per suite: both gates, at least one test, the area's category
  signal, leaked example data and duplicate titles (unit-tested,
  `benchmark-quality.test.ts`). Gate-passing suites run against the fixture
  clean and with the case's defect on, through TestForge's `/api/run`.

## Caveats (not smoothed over)

- **Run-to-run variation is about the size of the bar.** C1 scored 20
  clean-run passes in the first run and 18 in the confirmation run, with the
  same settings. Decision 7 allows one fewer than C1. C2 (18) was ruled
  out by a margin of that size, so "C2 is worse than C1" is not
  established by this data; it is only that it did not meet the bar in
  this run. C8 was never below C1 (19 then 21).
- **Most clean-run failures come from one case.** Functional suites
  invented a check for an "error message for invalid credentials" that the
  fixture's sign-in page doesn't show. The model writes it some of the time,
  so it moves the clean-run count by one or two either way. That is the
  GEN-35-style weakness (inventing page behaviour), not a speed setting.
- **Security detection is timing-dependent.** The model's security test
  checks for an alert immediately after clicking Save, without waiting for
  the saved page to render. C1's three security suites were byte-identical
  and caught the defect once. A test written this way detects
  unreliably; it counts as the model's quality, and it would read the same
  for every configuration that writes it.
- **The fixture is biased** toward the model's worked examples (Phase 21,
  Phase 34), so its detection counts flatter every configuration.
- **Category signal is an automated proxy** for Phase 33's by-reading
  check. Functional's signal ("interacts with the page") is TestForge's own;
  Decision 6 names none.
- **Mixed machine conditions.** Applications were closed during C5; the
  confirmation run covers the one comparison that decides the result.
- **Round 1 runs slower** on TestForge's path than on the native endpoint
  (5-33% per output token, C1), rounds 2-3 agree within about 1%. Medians
  over three rounds absorb it the same way for every configuration.

## Adoption

- `ollama/Modelfile.testforge-qwen7b`: `PARAMETER num_gpu 29` added.
  `docs/LOCAL_MODEL_SETUP.md` explains why, the 4 GB overflow behaviour, and
  to remove the line on machines where it doesn't load. Anyone already set
  up re-runs `ollama create testforge-qwen7b -f ollama/Modelfile.testforge-qwen7b`
  once.
- `TESTFORGE_OLLAMA_MODEL` stays `testforge-qwen7b`.
- **Phase 33 category bar on C8:** run, recorded below; three categories
  fall short.

## Phase 33 category bar on C8

Run 2026-09-30 on the rebuilt `testforge-qwen7b` (C8: `num_gpu 29`,
`ollama ps` 100% GPU, context 16384). Evidence:
`benchmarks/2026-09-30-phase33-c8/` (the 21 suites, `results.json`, and
`run.mts`, which repeats the run). TEST_PLAN GEN-54.

**Method.** Phase 33's bar: three consecutive real generations per
category, each suite read by hand for a check that belongs to the category
as `BEST_PRACTICE_GUIDANCE` describes it, clean under both gates, and free
of example data. Reliability needs a working `page.route()` failure
simulation. Phase 33's own wordings, with no page data, as Phase 33 ran.
Since Phase 34 the model is called only for areas the template leaves
without tests, so each call is the production gap-fill call for that one
area: `buildGapFillMessages` then `generateLocalSuite`, the route's own
call and gates. Each accepted suite also passed a standalone strict `tsc`.
No suite contains an `example.invalid` URL or an `EXAMPLE-` name.

| Category | Result | What the three suites do | Phase 33 (2026-09-24) |
| --- | --- | --- | --- |
| Reliability | ❌ 1/3 | 1: rejected at the type-check gate (`.disabled` on an `SVGElement`). 2: aborts `'**/api/**'` before load and asserts the page survived (status < 500, body visible, no page error): the real trait, but its three tests are identical, under titles naming a "disabled" email field, password field and button, and it covers one failure kind of three. 3: passes both gates but can never pass: `expect(locator.isDisabled()).toBe(true)` compares a Promise with `true`, and it expects the fields to be disabled, which nothing asked for. | ⚠️ 3/3 had the trait, 1/3 with accurate names |
| Performance | ✅ 3/3 | Load time under 3000 ms, first byte under 800 ms and DOM ready under 2000 ms from Navigation Timing. The example's budgets, near-verbatim. | ✅ 3/3 |
| SEO | ✅ 3/3 | Title, meta description and exactly one `h1`, in every suite. | ✅ 3/3 (`h1` 2/3) |
| Database | ❌ 1/3 | 1: saves a unique `TestForge check …` value, sees it, reloads, sees it again: genuine. 2: saves and sees it, never reloads, so persistence is not checked. 3: reloads, then asserts the form fields still hold the typed values (fails on a correct form that clears) and waits for an invented "Thank you for your message!". | ✅ 3/3 |
| Security | ✅ 3/3 | HTTPS behind the positive skip, invalid email and invalid password stay on the page, script-like input opens no dialog. All three checks in every suite. | ✅ 3/3 (all three checks 2/3) |
| Accessibility | ✅ 3/3 | Role and accessible name for the email field, password field and Sign in button. No focus check (Phase 31/33 suites had one). `toHaveRole('textbox')` on the password field was checked in Chromium: Playwright gives it that role, so it is not a false failure. | ✅ 3/3 |
| Functional | ⚠️ 0/3 clean | All three fill the fields and click Sign in, and all three assert a guessed `/dashboard` destination, with a comment saying so, which fails on any site that goes elsewhere. Suite 2's first test (fields accept input, checked with `toHaveValue`) is sound. The one Phase 33 functional suite guessed `/dashboard` too; Phase 33 counted it as passing on the gates alone. | ✅ 1/1 (gates) |

**Read together.**

- **Three runs are close to one.** At temperature 0.2 the SEO and
  security suites are byte-identical across all three calls, accessibility
  differs only by a trailing `/`, and performance only by one title. For
  those categories, "3/3" is one answer given three times, not three
  independent samples.
- **Not attributable to C8 alone.** Two things changed since Phase 33: the
  model's settings (C8), and the prompt: Phase 34's gap-fill messages
  (`ef736c5`) replaced the full-generation request. The local rules
  themselves are unchanged since Phase 33 (`4215d82`). This run doesn't
  separate the two. C8 changes only where
  the layers run and the context size, so the prompt is the likelier cause
  of the reliability and database drop, but that is a reading, not a
  measurement.
- **What production sees.** With page data (since Phase 34 a request that
  brings none has the site inspected), the template itself writes reliability tests and,
  where a suitable form exists, a database round trip, so the model is
  called for those areas only when the template wrote nothing. The drop
  matters exactly there.
- **The benchmark's automated category signal** (21/21 for C8, with the
  fixture's page data and wordings) did not predict this. It detects that a
  category's trait is present, not whether the test can pass on a correct
  site.

---

# Per-configuration summaries (generated)

Output of `node scripts/benchmark-summary.mjs` for every configuration, then
the confirmation run, unedited.

## C1: testforge-qwen7b, num_ctx 16384, num_predict 4096, temperature 0.2

Machine: Microsoft Windows [Version 10.0.26200.9457] | GPU NVIDIA GeForce RTX 2050, 610.78, 4096 MiB | ollama version is 0.34.4 | other GPU programs: none | finished 2026-09-29T14:13:19.335Z
Cold warm-up (native, model unloaded first, not scored): 143.3 s total; load 6.3 s; prompt 6608 tokens in 9.5 s (694.2 tokens per s in); output 464 tokens at 3.6 per s.
Memory after warm-up:
```
NAME                       ID              SIZE      PROCESSOR          CONTEXT    UNTIL              
testforge-qwen7b:latest    bb433a6046ef    5.8 GB    59%/41% CPU/GPU    16384      4 minutes from now
nvidia-smi memory used, total: 2389 MiB, 4096 MiB
```

| Measure | Value |
| --- | --- |
| Suites measured | 21 |
| Wall time per call, OpenAI-compatible endpoint (TestForge's path): median / p90 | 68.2 s / 129.9 s |
| Wall time, native /api/chat, same messages: median / p90 | 67.8 s / 129.3 s |
| Load duration (native): median / p90 | 0.0 s / 0.0 s |
| Prompt tokens: median / max | 6266 / 6608 |
| Prompt eval time, steady state (Ollama reuses the prefix every request shares; the cold rate is in the warm-up line): median / p90 | 0.3 s / 0.5 s |
| Output tokens: median / p90 | 251 / 468 |
| Generation: tokens per s out, median | 3.7 |
| Output cut at num_predict (native done_reason "length") | 0 of 21 |
| Timeouts at 180 s (TestForge path) | 0 |
| Endpoints agree: identical prompt token count | 21 of 21 |
| Endpoints agree: wall time per output token, difference median / max (21 pairs) | 0.7% / 32.7% |
| Wall time per output token: TestForge path / native, median | 270.5 ms / 269.5 ms |
| Route outcome | ok 21 |
| **Both gates passed** | **21 of 21** |
| At least one test | 21 of 21 |
| **Category signal present** | **21 of 21** |
| Leaked example data | 0 |
| Duplicate test titles | 0 |
| **Clean-run passes** (of suites passing both gates) | **20 of 21** |
| **Defect detections** (of gate-passing suites with a defect to find) | **16 of 18** |
| Context holds the largest prompt (6608) + num_predict (4096) = 10704 | yes: num_ctx 16384 |

| Case | Wall median | Prompt tokens | Gates | Signal | Clean | Detected |
| --- | --- | --- | --- | --- | --- | --- |
| functional | 99.0 s | 5918 | 3/3 | 3/3 | 2/3 | no defect |
| accessibility | 86.8 s | 6359 | 3/3 | 3/3 | 3/3 | 3/3 |
| seo | 56.4 s | 6199 | 3/3 | 3/3 | 3/3 | 3/3 |
| performance | 61.6 s | 6266 | 3/3 | 3/3 | 3/3 | 3/3 |
| database | 37.7 s | 6202 | 3/3 | 3/3 | 3/3 | 3/3 |
| security | 67.9 s | 6399 | 3/3 | 3/3 | 3/3 | 1/3 |
| reliability | 129.9 s | 6608 | 3/3 | 3/3 | 3/3 | 3/3 |

## C2: testforge-bench-c2 (FROM qwen2.5-coder:7b), num_ctx 12288, num_predict 4096, temperature 0.2

Machine: Microsoft Windows [Version 10.0.26200.9457] | GPU NVIDIA GeForce RTX 2050, 610.78, 4096 MiB | ollama version is 0.34.4 | other GPU programs: none | finished 2026-09-29T16:22:12.366Z
Cold warm-up (native, model unloaded first, not scored): 131.3 s total; load 5.9 s; prompt 6608 tokens in 9.5 s (696.2 tokens per s in); output 467 tokens at 4.0 per s.
Memory after warm-up:
```
NAME                         ID              SIZE      PROCESSOR          CONTEXT    UNTIL              
testforge-bench-c2:latest    414d2bb5228e    5.6 GB    59%/41% CPU/GPU    12288      4 minutes from now
nvidia-smi memory used, total: 2337 MiB, 4096 MiB
```

| Measure | Value |
| --- | --- |
| Suites measured | 21 |
| Wall time per call, OpenAI-compatible endpoint (TestForge's path): median / p90 | 65.9 s / 118.6 s |
| Wall time, native /api/chat, same messages: median / p90 | 61.4 s / 117.2 s |
| Load duration (native): median / p90 | 0.0 s / 0.0 s |
| Prompt tokens: median / max | 6266 / 6608 |
| Prompt eval time, steady state (Ollama reuses the prefix every request shares; the cold rate is in the warm-up line): median / p90 | 0.3 s / 0.4 s |
| Output tokens: median / p90 | 251 / 468 |
| Generation: tokens per s out, median | 4.2 |
| Output cut at num_predict (native done_reason "length") | 0 of 21 |
| Timeouts at 180 s (TestForge path) | 0 |
| Endpoints agree: identical prompt token count | 21 of 21 |
| Endpoints agree: wall time per output token, difference median / max (21 pairs) | 1.2% / 21.4% |
| Wall time per output token: TestForge path / native, median | 245.9 ms / 243.7 ms |
| Route outcome | ok 21 |
| **Both gates passed** | **21 of 21** |
| At least one test | 21 of 21 |
| **Category signal present** | **21 of 21** |
| Leaked example data | 0 |
| Duplicate test titles | 0 |
| **Clean-run passes** (of suites passing both gates) | **18 of 21** |
| **Defect detections** (of gate-passing suites with a defect to find) | **16 of 18** |
| Context holds the largest prompt (6608) + num_predict (4096) = 10704 | yes: num_ctx 12288 |

| Case | Wall median | Prompt tokens | Gates | Signal | Clean | Detected |
| --- | --- | --- | --- | --- | --- | --- |
| functional | 116.4 s | 5918 | 3/3 | 3/3 | 1/3 | no defect |
| accessibility | 78.8 s | 6359 | 3/3 | 3/3 | 2/3 | 3/3 |
| seo | 59.4 s | 6199 | 3/3 | 3/3 | 3/3 | 3/3 |
| performance | 55.7 s | 6266 | 3/3 | 3/3 | 3/3 | 3/3 |
| database | 34.9 s | 6202 | 3/3 | 3/3 | 3/3 | 3/3 |
| security | 61.7 s | 6399 | 3/3 | 3/3 | 3/3 | 1/3 |
| reliability | 118.6 s | 6608 | 3/3 | 3/3 | 3/3 | 3/3 |

## C3: testforge-bench-c3 (FROM qwen2.5-coder:7b-instruct-q3_K_M), num_ctx 12288, num_predict 4096, temperature 0.2

Machine: Microsoft Windows [Version 10.0.26200.9457] | GPU NVIDIA GeForce RTX 2050, 610.78, 4096 MiB | ollama version is 0.34.4 | other GPU programs: none | finished 2026-09-29T17:17:28.340Z
Cold warm-up (native, model unloaded first, not scored): 133.9 s total; load 8.2 s; prompt 6608 tokens in 19.9 s (331.9 tokens per s in); output 468 tokens at 4.4 per s.
Memory after warm-up:
```
NAME                         ID              SIZE      PROCESSOR          CONTEXT    UNTIL              
testforge-bench-c3:latest    78f6c580f488    4.7 GB    52%/48% CPU/GPU    12288      4 minutes from now
nvidia-smi memory used, total: 2287 MiB, 4096 MiB
```

| Measure | Value |
| --- | --- |
| Suites measured | 21 |
| Wall time per call, OpenAI-compatible endpoint (TestForge's path): median / p90 | 56.9 s / 106.4 s |
| Wall time, native /api/chat, same messages: median / p90 | 73.2 s / 116.1 s |
| Load duration (native): median / p90 | 0.0 s / 0.0 s |
| Prompt tokens: median / max | 6266 / 6608 |
| Prompt eval time, steady state (Ollama reuses the prefix every request shares; the cold rate is in the warm-up line): median / p90 | 0.3 s / 0.4 s |
| Output tokens: median / p90 | 291 / 467 |
| Generation: tokens per s out, median | 4.5 |
| Output cut at num_predict (native done_reason "length") | 0 of 21 |
| Timeouts at 180 s (TestForge path) | 0 |
| Endpoints agree: identical prompt token count | 21 of 21 |
| Endpoints agree: wall time per output token, difference median / max (21 pairs) | 2.8% / 22.0% |
| Wall time per output token: TestForge path / native, median | 224.2 ms / 226.9 ms |
| Route outcome | ok 21 |
| **Both gates passed** | **21 of 21** |
| At least one test | 21 of 21 |
| **Category signal present** | **21 of 21** |
| Leaked example data | 0 |
| Duplicate test titles | 0 |
| **Clean-run passes** (of suites passing both gates) | **17 of 21** |
| **Defect detections** (of gate-passing suites with a defect to find) | **15 of 18** |
| Context holds the largest prompt (6608) + num_predict (4096) = 10704 | yes: num_ctx 12288 |

| Case | Wall median | Prompt tokens | Gates | Signal | Clean | Detected |
| --- | --- | --- | --- | --- | --- | --- |
| functional | 97.5 s | 5918 | 3/3 | 3/3 | 0/3 | no defect |
| accessibility | 74.1 s | 6359 | 3/3 | 3/3 | 2/3 | 3/3 |
| seo | 46.6 s | 6199 | 3/3 | 3/3 | 3/3 | 3/3 |
| performance | 50.1 s | 6266 | 3/3 | 3/3 | 3/3 | 3/3 |
| database | 30.7 s | 6202 | 3/3 | 3/3 | 3/3 | 3/3 |
| security | 57.2 s | 6399 | 3/3 | 3/3 | 3/3 | 0/3 |
| reliability | 107.2 s | 6608 | 3/3 | 3/3 | 3/3 | 3/3 |

## C4: testforge-bench-c4 (FROM qwen2.5-coder:3b), num_ctx 12288, num_predict 4096, temperature 0.2

Machine: Microsoft Windows [Version 10.0.26200.9457] | GPU NVIDIA GeForce RTX 2050, 610.78, 4096 MiB | ollama version is 0.34.4 | other GPU programs: none | finished 2026-09-29T17:41:20.136Z
Cold warm-up (native, model unloaded first, not scored): 26.9 s total; load 7.3 s; prompt 6608 tokens in 3.6 s (1834.5 tokens per s in); output 468 tokens at 29.4 per s.
Memory after warm-up:
```
NAME                         ID              SIZE      PROCESSOR          CONTEXT    UNTIL              
testforge-bench-c4:latest    98d5a44ee269    2.8 GB    14%/86% CPU/GPU    12288      4 minutes from now
nvidia-smi memory used, total: 2353 MiB, 4096 MiB
```

| Measure | Value |
| --- | --- |
| Suites measured | 21 |
| Wall time per call, OpenAI-compatible endpoint (TestForge's path): median / p90 | 12.3 s / 148.7 s |
| Wall time, native /api/chat, same messages: median / p90 | 11.7 s / 26.0 s |
| Load duration (native): median / p90 | 0.0 s / 0.0 s |
| Prompt tokens: median / max | 6266 / 6608 |
| Prompt eval time, steady state (Ollama reuses the prefix every request shares; the cold rate is in the warm-up line): median / p90 | 0.0 s / 0.0 s |
| Output tokens: median / p90 | 335 / 749 |
| Generation: tokens per s out, median | 29.2 |
| Output cut at num_predict (native done_reason "length") | 2 of 21 |
| Timeouts at 180 s (TestForge path) | 0 |
| Endpoints agree: identical prompt token count | 21 of 21 |
| Endpoints agree: wall time per output token, difference median / max (21 pairs) | 2.3% / 37.4% |
| Wall time per output token: TestForge path / native, median | 36.2 ms / 35.1 ms |
| Route outcome | unawaited_assertion 2, invalid_output 3, ok 16 |
| **Both gates passed** | **16 of 21** |
| At least one test | 21 of 21 |
| **Category signal present** | **21 of 21** |
| Leaked example data | 0 |
| Duplicate test titles | 3 |
| **Clean-run passes** (of suites passing both gates) | **12 of 16** |
| **Defect detections** (of gate-passing suites with a defect to find) | **12 of 15** |
| Context holds the largest prompt (6608) + num_predict (4096) = 10704 | yes: num_ctx 12288 |

| Case | Wall median | Prompt tokens | Gates | Signal | Clean | Detected |
| --- | --- | --- | --- | --- | --- | --- |
| functional | 16.8 s | 5918 | 1/3 | 3/3 | 0/1 | no defect |
| accessibility | 148.8 s | 6359 | 0/3 | 3/3 | 0/0 | no defect |
| seo | 7.4 s | 6199 | 3/3 | 3/3 | 3/3 | 3/3 |
| performance | 7.9 s | 6266 | 3/3 | 3/3 | 3/3 | 3/3 |
| database | 5.2 s | 6202 | 3/3 | 3/3 | 3/3 | 3/3 |
| security | 12.3 s | 6399 | 3/3 | 3/3 | 0/3 | 0/3 |
| reliability | 16.9 s | 6608 | 3/3 | 3/3 | 3/3 | 3/3 |

## C5: testforge-bench-c5 (FROM qwen3.5:4b), num_ctx 12288, num_predict 4096, temperature 0.2

Machine: Microsoft Windows [Version 10.0.26200.9457] | GPU NVIDIA GeForce RTX 2050, 610.78, 4096 MiB | ollama version is 0.34.4 | other GPU programs: none | finished 2026-09-29T19:51:27.312Z
Cold warm-up (native, model unloaded first, not scored): no answer (timeout) after 180.0 s, so no cold timings.
Memory after warm-up:
```
NAME                         ID              SIZE      PROCESSOR          CONTEXT    UNTIL              
testforge-bench-c5:latest    126fd23f9ecb    4.0 GB    54%/46% CPU/GPU    12288      4 minutes from now
nvidia-smi memory used, total: 2609 MiB, 4096 MiB
```

| Measure | Value |
| --- | --- |
| Suites measured | 21 |
| Wall time per call, OpenAI-compatible endpoint (TestForge's path): median / p90 | 180.0 s / 180.0 s |
| Wall time, native /api/chat, same messages: median / p90 | 180.0 s / 180.0 s |
| Load duration (native): median / p90 | 0.0 s / 0.0 s |
| Prompt tokens: median / max | 7012 / 7012 |
| Prompt eval time, steady state (Ollama reuses the prefix every request shares; the cold rate is in the warm-up line): median / p90 | 0.3 s / 0.3 s |
| Output tokens: median / p90 | 831 / 851 |
| Generation: tokens per s out, median | 5.3 |
| Output cut at num_predict (native done_reason "length") | 0 of 21 |
| Timeouts at 180 s (TestForge path) | 16 |
| Endpoints agree: identical prompt token count | 2 of 2 |
| Endpoints agree: wall time per output token, difference median / max (2 pairs) | 1.0% / 1.5% |
| Wall time per output token: TestForge path / native, median | 191.9 ms / 190.9 ms |
| Route outcome | timeout 16, ok 5 |
| **Both gates passed** | **5 of 21** |
| At least one test | 5 of 21 |
| **Category signal present** | **5 of 21** |
| Leaked example data | 0 |
| Duplicate test titles | 0 |
| **Clean-run passes** (of suites passing both gates) | **4 of 5** |
| **Defect detections** (of gate-passing suites with a defect to find) | **5 of 5** |
| Context holds the largest prompt (7012) + num_predict (4096) = 11108 | yes: num_ctx 12288 |

| Case | Wall median | Prompt tokens | Gates | Signal | Clean | Detected |
| --- | --- | --- | --- | --- | --- | --- |
| functional | 180.0 s | 0 | 0/3 | 0/3 | 0/0 | no defect |
| accessibility | 180.0 s | 0 | 0/3 | 0/3 | 0/0 | no defect |
| seo | 173.8 s | 7011 | 2/3 | 2/3 | 2/2 | 2/2 |
| performance | 180.0 s | 0 | 0/3 | 0/3 | 0/0 | no defect |
| database | 170.0 s | 7012 | 3/3 | 3/3 | 2/3 | 3/3 |
| security | 180.0 s | 0 | 0/3 | 0/3 | 0/0 | no defect |
| reliability | 180.0 s | 0 | 0/3 | 0/3 | 0/0 | no defect |

## C6: testforge-bench-c6 (FROM llama3.1:latest), num_ctx 12288, num_predict 4096, temperature 0.2

Machine: Microsoft Windows [Version 10.0.26200.9457] | GPU NVIDIA GeForce RTX 2050, 610.78, 4096 MiB | ollama version is 0.34.4 | other GPU programs: none | finished 2026-09-29T21:28:53.706Z
Cold warm-up (native, model unloaded first, not scored): no answer (timeout) after 180.0 s, so no cold timings.
Memory after warm-up:
```
NAME                         ID              SIZE      PROCESSOR          CONTEXT    UNTIL              
testforge-bench-c6:latest    48774d8eb23f    6.7 GB    67%/33% CPU/GPU    12288      4 minutes from now
nvidia-smi memory used, total: 2233 MiB, 4096 MiB
```

| Measure | Value |
| --- | --- |
| Suites measured | 21 |
| Wall time per call, OpenAI-compatible endpoint (TestForge's path): median / p90 | 117.7 s / 177.1 s |
| Wall time, native /api/chat, same messages: median / p90 | 119.0 s / 180.0 s |
| Load duration (native): median / p90 | 0.0 s / 0.0 s |
| Prompt tokens: median / max | 6119 / 6465 |
| Prompt eval time, steady state (Ollama reuses the prefix every request shares; the cold rate is in the warm-up line): median / p90 | 0.4 s / 0.5 s |
| Output tokens: median / p90 | 342 / 469 |
| Generation: tokens per s out, median | 2.9 |
| Output cut at num_predict (native done_reason "length") | 0 of 21 |
| Timeouts at 180 s (TestForge path) | 2 |
| Endpoints agree: identical prompt token count | 16 of 16 |
| Endpoints agree: wall time per output token, difference median / max (16 pairs) | 0.6% / 8.7% |
| Wall time per output token: TestForge path / native, median | 349.3 ms / 347.0 ms |
| Route outcome | ok 19, timeout 2 |
| **Both gates passed** | **19 of 21** |
| At least one test | 19 of 21 |
| **Category signal present** | **19 of 21** |
| Leaked example data | 0 |
| Duplicate test titles | 0 |
| **Clean-run passes** (of suites passing both gates) | **10 of 19** |
| **Defect detections** (of gate-passing suites with a defect to find) | **11 of 16** |
| Context holds the largest prompt (6465) + num_predict (4096) = 10561 | yes: num_ctx 12288 |

| Case | Wall median | Prompt tokens | Gates | Signal | Clean | Detected |
| --- | --- | --- | --- | --- | --- | --- |
| functional | 88.4 s | 5783 | 3/3 | 3/3 | 0/3 | no defect |
| accessibility | 118.4 s | 6224 | 3/3 | 3/3 | 3/3 | 3/3 |
| seo | 135.5 s | 6064 | 2/3 | 2/3 | 0/2 | 2/2 |
| performance | 177.1 s | 6119 | 2/3 | 2/3 | 0/2 | 0/2 |
| database | 93.6 s | 6067 | 3/3 | 3/3 | 3/3 | 3/3 |
| security | 111.9 s | 6264 | 3/3 | 3/3 | 1/3 | 0/3 |
| reliability | 159.8 s | 6465 | 3/3 | 3/3 | 3/3 | 3/3 |

## C7: testforge-bench-c7 (FROM qwen2.5-coder:7b), num_ctx 16384, num_predict 4096, temperature 0.2

Machine: Microsoft Windows [Version 10.0.26200.9457] | GPU NVIDIA GeForce RTX 2050, 610.78, 4096 MiB | ollama version is 0.34.4 | other GPU programs: none | finished 2026-09-29T23:09:29.974Z
Cold warm-up (native, model unloaded first, not scored): no answer (timeout) after 180.0 s, so no cold timings.
Memory after warm-up:
```
NAME                         ID              SIZE      PROCESSOR    CONTEXT    UNTIL              
testforge-bench-c7:latest    b53e7242ef75    5.0 GB    100% GPU     16384      4 minutes from now
nvidia-smi memory used, total: 3925 MiB, 4096 MiB
```

| Measure | Value |
| --- | --- |
| Suites measured | 21 |
| Wall time per call, OpenAI-compatible endpoint (TestForge's path): median / p90 | 92.8 s / 135.7 s |
| Wall time, native /api/chat, same messages: median / p90 | 72.4 s / 138.7 s |
| Load duration (native): median / p90 | 0.0 s / 0.0 s |
| Prompt tokens: median / max | 6266 / 6608 |
| Prompt eval time, steady state (Ollama reuses the prefix every request shares; the cold rate is in the warm-up line): median / p90 | 0.3 s / 0.3 s |
| Output tokens: median / p90 | 251 / 468 |
| Generation: tokens per s out, median | 3.5 |
| Output cut at num_predict (native done_reason "length") | 0 of 21 |
| Timeouts at 180 s (TestForge path) | 0 |
| Endpoints agree: identical prompt token count | 21 of 21 |
| Endpoints agree: wall time per output token, difference median / max (21 pairs) | 1.2% / 42.5% |
| Wall time per output token: TestForge path / native, median | 291.4 ms / 284.4 ms |
| Route outcome | ok 19, invalid_output 2 |
| **Both gates passed** | **19 of 21** |
| At least one test | 21 of 21 |
| **Category signal present** | **21 of 21** |
| Leaked example data | 0 |
| Duplicate test titles | 0 |
| **Clean-run passes** (of suites passing both gates) | **17 of 19** |
| **Defect detections** (of gate-passing suites with a defect to find) | **13 of 16** |
| Context holds the largest prompt (6608) + num_predict (4096) = 10704 | yes: num_ctx 16384 |

| Case | Wall median | Prompt tokens | Gates | Signal | Clean | Detected |
| --- | --- | --- | --- | --- | --- | --- |
| functional | 131.8 s | 5918 | 3/3 | 3/3 | 1/3 | no defect |
| accessibility | 93.4 s | 6359 | 3/3 | 3/3 | 3/3 | 3/3 |
| seo | 66.1 s | 6199 | 3/3 | 3/3 | 3/3 | 3/3 |
| performance | 65.5 s | 6266 | 3/3 | 3/3 | 3/3 | 3/3 |
| database | 40.1 s | 6202 | 3/3 | 3/3 | 3/3 | 3/3 |
| security | 73.3 s | 6399 | 3/3 | 3/3 | 3/3 | 0/3 |
| reliability | 138.9 s | 6608 | 1/3 | 3/3 | 1/1 | 1/1 |

## C8: testforge-bench-c8 (FROM qwen2.5-coder:7b), num_ctx 16384, num_predict 4096, temperature 0.2

Machine: Microsoft Windows [Version 10.0.26200.9457] | GPU NVIDIA GeForce RTX 2050, 610.78, 4096 MiB | ollama version is 0.34.4 | other GPU programs: none | finished 2026-09-29T21:59:11.772Z
Cold warm-up (native, model unloaded first, not scored): 91.1 s total; load 9.1 s; prompt 6608 tokens in 32.2 s (205.0 tokens per s in); output 468 tokens at 9.4 per s.
Memory after warm-up:
```
NAME                         ID              SIZE      PROCESSOR    CONTEXT    UNTIL              
testforge-bench-c8:latest    b53e7242ef75    5.5 GB    100% GPU     16384      4 minutes from now
nvidia-smi memory used, total: 3923 MiB, 4096 MiB
```

| Measure | Value |
| --- | --- |
| Suites measured | 21 |
| Wall time per call, OpenAI-compatible endpoint (TestForge's path): median / p90 | 39.5 s / 56.3 s |
| Wall time, native /api/chat, same messages: median / p90 | 26.6 s / 50.1 s |
| Load duration (native): median / p90 | 0.0 s / 0.0 s |
| Prompt tokens: median / max | 6266 / 6608 |
| Prompt eval time, steady state (Ollama reuses the prefix every request shares; the cold rate is in the warm-up line): median / p90 | 0.1 s / 0.1 s |
| Output tokens: median / p90 | 251 / 468 |
| Generation: tokens per s out, median | 9.6 |
| Output cut at num_predict (native done_reason "length") | 0 of 21 |
| Timeouts at 180 s (TestForge path) | 0 |
| Endpoints agree: identical prompt token count | 21 of 21 |
| Endpoints agree: wall time per output token, difference median / max (21 pairs) | 1.6% / 65.0% |
| Wall time per output token: TestForge path / native, median | 107.9 ms / 106.0 ms |
| Route outcome | ok 21 |
| **Both gates passed** | **21 of 21** |
| At least one test | 21 of 21 |
| **Category signal present** | **21 of 21** |
| Leaked example data | 0 |
| Duplicate test titles | 0 |
| **Clean-run passes** (of suites passing both gates) | **19 of 21** |
| **Defect detections** (of gate-passing suites with a defect to find) | **16 of 18** |
| Context holds the largest prompt (6608) + num_predict (4096) = 10704 | yes: num_ctx 16384 |

| Case | Wall median | Prompt tokens | Gates | Signal | Clean | Detected |
| --- | --- | --- | --- | --- | --- | --- |
| functional | 56.3 s | 5918 | 3/3 | 3/3 | 1/3 | no defect |
| accessibility | 28.0 s | 6359 | 3/3 | 3/3 | 3/3 | 3/3 |
| seo | 24.2 s | 6199 | 3/3 | 3/3 | 3/3 | 3/3 |
| performance | 24.6 s | 6266 | 3/3 | 3/3 | 3/3 | 3/3 |
| database | 15.5 s | 6202 | 3/3 | 3/3 | 3/3 | 3/3 |
| security | 27.1 s | 6399 | 3/3 | 3/3 | 3/3 | 1/3 |
| reliability | 50.5 s | 6608 | 3/3 | 3/3 | 3/3 | 3/3 |

## Confirmation run

### C1: testforge-qwen7b, num_ctx 16384, num_predict 4096, temperature 0.2

Machine: Microsoft Windows [Version 10.0.26200.9457] | GPU NVIDIA GeForce RTX 2050, 610.78, 4096 MiB | ollama version is 0.34.4 | other GPU programs: none | finished 2026-09-30T00:13:14.081Z
Cold warm-up (native, model unloaded first, not scored): 136.9 s total; load 5.7 s; prompt 6608 tokens in 9.4 s (704.1 tokens per s in); output 468 tokens at 3.8 per s.
Memory after warm-up:
```
NAME                       ID              SIZE      PROCESSOR          CONTEXT    UNTIL              
testforge-qwen7b:latest    bb433a6046ef    5.8 GB    59%/41% CPU/GPU    16384      4 minutes from now
nvidia-smi memory used, total: 2389 MiB, 4096 MiB
```

| Measure | Value |
| --- | --- |
| Suites measured | 21 |
| Wall time per call, OpenAI-compatible endpoint (TestForge's path): median / p90 | 65.5 s / 125.0 s |
| Wall time, native /api/chat, same messages: median / p90 | 65.3 s / 127.7 s |
| Load duration (native): median / p90 | 0.0 s / 0.0 s |
| Prompt tokens: median / max | 6266 / 6608 |
| Prompt eval time, steady state (Ollama reuses the prefix every request shares; the cold rate is in the warm-up line): median / p90 | 0.3 s / 0.4 s |
| Output tokens: median / p90 | 251 / 468 |
| Generation: tokens per s out, median | 3.9 |
| Output cut at num_predict (native done_reason "length") | 0 of 21 |
| Timeouts at 180 s (TestForge path) | 0 |
| Endpoints agree: identical prompt token count | 21 of 21 |
| Endpoints agree: wall time per output token, difference median / max (21 pairs) | 2.1% / 16.2% |
| Wall time per output token: TestForge path / native, median | 260.9 ms / 257.2 ms |
| Route outcome | ok 21 |
| **Both gates passed** | **21 of 21** |
| At least one test | 21 of 21 |
| **Category signal present** | **21 of 21** |
| Leaked example data | 0 |
| Duplicate test titles | 0 |
| **Clean-run passes** (of suites passing both gates) | **18 of 21** |
| **Defect detections** (of gate-passing suites with a defect to find) | **16 of 18** |
| Context holds the largest prompt (6608) + num_predict (4096) = 10704 | yes: num_ctx 16384 |

| Case | Wall median | Prompt tokens | Gates | Signal | Clean | Detected |
| --- | --- | --- | --- | --- | --- | --- |
| functional | 125.0 s | 5918 | 3/3 | 3/3 | 0/3 | no defect |
| accessibility | 83.2 s | 6359 | 3/3 | 3/3 | 3/3 | 3/3 |
| seo | 54.7 s | 6199 | 3/3 | 3/3 | 3/3 | 3/3 |
| performance | 58.9 s | 6266 | 3/3 | 3/3 | 3/3 | 3/3 |
| database | 36.4 s | 6202 | 3/3 | 3/3 | 3/3 | 3/3 |
| security | 65.5 s | 6399 | 3/3 | 3/3 | 3/3 | 1/3 |
| reliability | 124.7 s | 6608 | 3/3 | 3/3 | 3/3 | 3/3 |

### C8: testforge-bench-c8 (FROM qwen2.5-coder:7b), num_ctx 16384, num_predict 4096, temperature 0.2

Machine: Microsoft Windows [Version 10.0.26200.9457] | GPU NVIDIA GeForce RTX 2050, 610.78, 4096 MiB | ollama version is 0.34.4 | other GPU programs: none | finished 2026-09-30T00:44:27.982Z
Cold warm-up (native, model unloaded first, not scored): 110.2 s total; load 16.2 s; prompt 6608 tokens in 38.4 s (172.3 tokens per s in); output 468 tokens at 8.4 per s.
Memory after warm-up:
```
NAME                         ID              SIZE      PROCESSOR    CONTEXT    UNTIL              
testforge-bench-c8:latest    b53e7242ef75    5.5 GB    100% GPU     16384      4 minutes from now
nvidia-smi memory used, total: 3923 MiB, 4096 MiB
```

| Measure | Value |
| --- | --- |
| Suites measured | 21 |
| Wall time per call, OpenAI-compatible endpoint (TestForge's path): median / p90 | 39.4 s / 56.7 s |
| Wall time, native /api/chat, same messages: median / p90 | 28.0 s / 55.9 s |
| Load duration (native): median / p90 | 0.0 s / 0.1 s |
| Prompt tokens: median / max | 6266 / 6608 |
| Prompt eval time, steady state (Ollama reuses the prefix every request shares; the cold rate is in the warm-up line): median / p90 | 0.1 s / 0.1 s |
| Output tokens: median / p90 | 251 / 468 |
| Generation: tokens per s out, median | 9.3 |
| Output cut at num_predict (native done_reason "length") | 0 of 21 |
| Timeouts at 180 s (TestForge path) | 0 |
| Endpoints agree: identical prompt token count | 21 of 21 |
| Endpoints agree: wall time per output token, difference median / max (21 pairs) | 1.7% / 61.2% |
| Wall time per output token: TestForge path / native, median | 111.3 ms / 110.6 ms |
| Route outcome | ok 21 |
| **Both gates passed** | **21 of 21** |
| At least one test | 21 of 21 |
| **Category signal present** | **21 of 21** |
| Leaked example data | 0 |
| Duplicate test titles | 0 |
| **Clean-run passes** (of suites passing both gates) | **21 of 21** |
| **Defect detections** (of gate-passing suites with a defect to find) | **16 of 18** |
| Context holds the largest prompt (6608) + num_predict (4096) = 10704 | yes: num_ctx 16384 |

| Case | Wall median | Prompt tokens | Gates | Signal | Clean | Detected |
| --- | --- | --- | --- | --- | --- | --- |
| functional | 40.5 s | 5918 | 3/3 | 3/3 | 3/3 | no defect |
| accessibility | 35.4 s | 6359 | 3/3 | 3/3 | 3/3 | 3/3 |
| seo | 23.6 s | 6199 | 3/3 | 3/3 | 3/3 | 3/3 |
| performance | 25.4 s | 6266 | 3/3 | 3/3 | 3/3 | 3/3 |
| database | 15.9 s | 6202 | 3/3 | 3/3 | 3/3 | 3/3 |
| security | 27.9 s | 6399 | 3/3 | 3/3 | 3/3 | 1/3 |
| reliability | 52.1 s | 6608 | 3/3 | 3/3 | 3/3 | 3/3 |

