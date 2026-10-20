# TFP-216: CI on Node 24, with current actions

Post-Phase 42 review, R4 (`docs/decisions/post-phase-42-review-plan.md`).
The change is `a064008`: `.nvmrc` (24) read by every `setup-node` step, and
checkout v7, setup-node v7, upload-artifact v7 and github-script v9.
Each of the four workflows ran once on GitHub on 2026-10-20, all on
`a064008`. The job logs are saved raw here, through the GitHub API; GitHub
keeps them 90 days.

| Workflow, job | Trigger, run | Result | Job time (UTC) | Node | Node 20 warning |
| --- | --- | --- | --- | --- | --- |
| PR Validation, `validate` (`pr-validation.log`) | pull request #4, [39352473289](https://github.com/emil3663/testforge/actions/runs/39352473289) | green: lint, build, smoke | 328 s (01:16:05 to 01:21:33) | v24.21.0, "Resolved .nvmrc as 24" | none |
| Smoke Test, `smoke-test` (`self-test.log`) | push to `main`, [39353231411](https://github.com/emil3663/testforge/actions/runs/39353231411) | green: 5 passed (4.1 min) | 327 s (01:24:16 to 01:29:43) | v24.21.0, "Resolved .nvmrc as 24" | none |
| Regression Test, `regression-test` (`regression-test.log`) | dispatch, [39353251006](https://github.com/emil3663/testforge/actions/runs/39353251006) | green: 57 passed (6.0 min) | 441 s (01:24:29 to 01:31:50) | v24.21.0, "Resolved .nvmrc as 24" | none |
| Nightly, `unit` (`nightly-unit.log`) | dispatch, [39353254115](https://github.com/emil3663/testforge/actions/runs/39353254115) | green: 580 tests, 579 passed, 0 failed, 1 skipped (the Windows-only TFP-202 case); suite 1,047 s | 1,095 s (01:24:31 to 01:42:46) | v24.21.0, "Resolved .nvmrc as 24" | none |
| Nightly, `template-unchanged` (`nightly-template-unchanged.log`) | the same run | green: `980346f -> a064008: 166 inputs, 166 identical, 0 different` | 34 s (01:24:31 to 01:25:05) | v24.22.0, "Resolved .nvmrc as 24" | none |

- **Node 20:** no log mentions it. The only "deprecated" line in them is
  npm's, about the `glob` package.
- **Two patch versions of 24:** the template job ran v24.22.0, the other
  jobs v24.21.0. `.nvmrc` names the major; each runner took the 24.x it had
  cached or could download.
- **The unit step** still runs under
  `shell: /usr/bin/bash --noprofile --norc -e -o pipefail {0}` (TFP-210).
