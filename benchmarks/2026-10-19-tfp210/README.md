# TFP-210: the unit suite and the template check in CI

Post-Phase 42 review, R3's U2 (`docs/decisions/post-phase-42-review-findings.md`,
"Tickets"). The workflow is `.github/workflows/nightly.yml`, added in
`4eff1dc`. On 2026-10-19 both of its jobs, and the regression workflow
changed in the same commit, were dispatched by hand on `4eff1dc`, on
GitHub's `ubuntu-latest`.

| File | What it is |
| --- | --- |
| `unit.log` | Nightly run [39304254711](https://github.com/emil3663/testforge/actions/runs/39304254711), job `unit`: the job's whole log, raw |
| `template-unchanged.log` | The same run, job `template-unchanged` |
| `regression-test.log` | Regression Test run [39304260493](https://github.com/emil3663/testforge/actions/runs/39304260493) |

The job logs were saved with `gh api repos/emil3663/testforge/actions/jobs/<id>/logs`.
GitHub keeps them for 90 days.

## Result

| Job | Result | Job time | Step under test | Locally |
| --- | --- | --- | --- | --- |
| `unit` | 575 tests: 574 passed, 0 failed, 1 skipped | 1,181 s (18:38:58 to 18:58:39 UTC) | `npm run test:unit`: 1,123 s (`duration_ms` 1123183) | 659 to 731 s (TFP-208, `logs/63a69e5/`) |
| `template-unchanged` | `980346f -> 4eff1dc: 166 inputs, 166 identical, 0 different` | 22 s (18:38:58 to 18:39:20) | under 1 s; `npm ci` 14 s | |
| Regression | 57 passed (5.5 min) | 403 s (18:38:59 to 18:45:42) | `test:regression:allure` with its one build: 5 min 41 s | 410 to 412 s with the build |

- **The one skip** is platform-gated, with its reason: "the call through the
  Windows shell (a .cmd claude): the empty --tools value still arrives
  (TFP-202) # Windows only". No real-browser test skipped. Chromium is
  installed, so TST-01's skip doesn't apply.
- **The unit suite takes 1.5 to 1.7 times as long on the runner** as it does
  locally. Nothing timed out; the job's limit is 45 min.
- **`performance-bands.test.ts`** (D23) passed in this run.
- **Regression builds once:** `build:self-test` ("Compiled successfully
  in 5.0s"), then Playwright starts the server. No separate `npm run build`.
