# Mr Onion in CI

Mr Onion can run as one step of your pipeline. It crawls your site,
generates a Playwright suite and runs it, then fails the build when tests
fail. It runs in a pinned Docker image, so the same site gives the same
suite on every machine. On GitHub Actions, a composite action wraps that
image.

> **Before v0.4.0:** the image is published to
> `ghcr.io/emil3663/mr-onion` from v0.4.0 on. Until then, build it from this
> repository (`docker build -t mr-onion .`) and give the action its name
> (`image: mr-onion`). This repository's own CI does that.

## GitHub Actions

The usual pattern: build your app, start it in the job, and test it on
`localhost`.

```yaml
jobs:
  mr-onion:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v7
      - run: npm ci && npm run build
      - run: npm start &                       # your app, on port 3000
      - run: npx wait-on http://localhost:3000
      - uses: emil3663/mr-onion/action@v0.4.0
        with:
          url: http://localhost:3000
```

The step fails when a test fails. Each run attaches its reports to the
workflow run as an artifact (`report.html`, `junit.xml` and the rest of
the folder) and writes a job summary: the verdict, the counts, and the
failing tests.

Pin the action to a version. `@v0.4.0` runs the image
`ghcr.io/emil3663/mr-onion:0.4.0`, so a new release changes nothing until
you move the pin. Pin it to a version tag, not a branch or a commit: the
action runs the image of the version in its own `package.json`, and a
branch's version between releases has no image, so the step can't run
(exit `2`).

Linux runners only. The image is a Linux image, and the run reaches your
app through the runner's own network (`--network host`). A self-hosted
runner needs Docker.

### Inputs

| Input | Default | What it does |
|---|---|---|
| `url` | (required) | The site to test, as the job reaches it |
| `mode` | the config file's, else `standard` | `standard` or `comprehensive` |
| `area` | | Comprehensive only: `security` or `accessibility` |
| `baseline` | | `latest`, or a `run.json` from an earlier run: only new failures then fail the step ([Baselines](#baselines-and-state-between-runs)) |
| `config` | | A JSON file with any of the command's options, plus `login` |
| `report-only` | `false` | `true` reports failures and exits `0`, unless the run couldn't run |
| `out` | `mr-onion-out` | Where the reports go, under the workspace |
| `data-dir` | `.mr-onion` | Mr Onion's data folder, saved runs included, under the workspace |
| `env` | | Names of environment variables to pass into the run, for a login |
| `image` | the action's version | The image to run |
| `upload` | `true` | Attach the `out` folder as an artifact |
| `artifact-name` | `mr-onion-report` | The artifact's name. Give each step its own if a job runs the action more than once |

Outputs: `exit-code`, `out` and `artifact-id`.

The config file takes the command's options by name: `url`, `mode`,
`area`, `pageCap`, `practices`, `auditMode`, `description`, `pages`,
`interactive`, `login`, `out`, `dataDir`, `reportOnly`, `baseline`,
`servers` and `serverTimeout`. An input given to the action wins over the
file. `out` and `dataDir` are the exceptions: under the action, its `out`
and `data-dir` inputs decide them, because the action reads the reports
from there. `mr-onion run --help` lists what each option does.

Paths (`out`, `data-dir`, `config`, `baseline`) are relative to the
workspace, which the image sees as `/work`. An absolute path, such as one
under `runner.temp`, points outside it, and the run can't read or write
there. A job that runs in a `container:` can't use the action either: its
workspace path is the container's, not the runner's that Docker mounts.

## What fails the build

| Exit code | Meaning |
|---|---|
| `0` | No test failed. With a baseline: no test failed that the baseline didn't |
| `1` | A test failed or was blocked. With a baseline: one the baseline didn't have. With `report-only`: reported, and exit `0` |
| `2` | Couldn't run: the site didn't answer, the crawl found no page, or the browser didn't start. It is never a pass |
| `3` | Invalid configuration. The message names the field |

**Findings never fail the build.** SEO, usability and performance
improvements are reported as findings.

**A first run with no baseline fails on any failing test.** A broken site
can't pass its first CI run. To start a baseline on a site that already
has known failures, make the first run `report-only: true`, then compare
later runs with it.

## Baselines, and state between runs

A run saves itself in `data-dir`. A later run with `baseline: latest` takes
the newest run of the same site and the same tests from there. Only
failures that run didn't have fail the step. Known failures and fixed
tests are listed in the summary and in `baseline.json`.

A run whose own verdict failed is never taken as a baseline, so a
regression can't become the new normal.

A runner starts empty, so save `data-dir` after the run and restore it
before the next one. A cache does this:

```yaml
      - uses: actions/cache/restore@v6
        with:
          path: .mr-onion
          key: mr-onion-${{ github.run_id }}
          restore-keys: mr-onion-
      - id: mr-onion
        uses: emil3663/mr-onion/action@v0.4.0
        with:
          url: http://localhost:3000
          baseline: latest
      - uses: actions/cache/save@v6
        if: always()
        with:
          path: .mr-onion
          key: mr-onion-${{ github.run_id }}
```

Save it with `if: always()`. A run that fails is the one a cache saved
only on success would miss, and a first run that fails (any failing test,
with no baseline) would then never be saved, so every run would stay a
first run. Mr Onion's own CI runs the baseline itself (clean twice, with
one data folder, in one job) but not this cache across jobs.

The data folder also holds the site's suite. A page type that hasn't
changed keeps its tests, and one that has changed is regenerated.

If you'd rather review the suite, you can commit the data folder to your
repository instead. Then every run's changes become a commit someone has
to make.

## Logins and secrets

Credentials come only from your pipeline's secrets, as environment
variables. They are redacted from every report and log. Name the
variables in the config file's `login`, never their values:

```json
{
  "login": {
    "loginUrl": "http://localhost:3000/login",
    "usernameSelector": "#email",
    "passwordSelector": "#password",
    "submitSelector": "button[type=submit]",
    "usernameEnv": "SITE_USER",
    "passwordEnv": "SITE_PASSWORD",
    "postLoginPath": "/account"
  }
}
```

Then pass them to the step, and name them in `env` so they reach the
image:

```yaml
      - uses: emil3663/mr-onion/action@v0.4.0
        with:
          url: http://localhost:3000
          config: mr-onion.json
          env: SITE_USER, SITE_PASSWORD
        env:
          SITE_USER: ${{ secrets.SITE_USER }}
          SITE_PASSWORD: ${{ secrets.SITE_PASSWORD }}
```

Docker reads each value from the step's environment by name, so a secret
never appears on a command line. A login needs `postLoginPath` or
`postLoginSelector`, something only true once signed in.
[`AUTOMATED_ACCOUNT_SETUP.md`](AUTOMATED_ACCOUNT_SETUP.md) has every field,
and the automation account a login should use.

## A preview deployment

You can also test a deployed preview URL instead of a server in the job:
[`action/examples/deploy-preview.yml`](../action/examples/deploy-preview.yml).
It is an example. Mr Onion's own CI runs the action against a local
server, not a preview deployment.

A deployed site is treated like any site Mr Onion doesn't host locally.
The run is capped at 3 workers sharing 5 requests per second, and timed
checks are reported Not run, with the reason in the report. That holds
until the site's ownership can be confirmed in CI (Phase 43). A server
the job starts on `localhost` runs uncapped, and its timed checks are
judged.

The URL is printed in the step's log and the job summary. If your host
puts a bypass token in a preview URL, pass the token some other way:
GitHub hides it only if it came from a secret.

## What doesn't run in CI, and why

- **No model.** The gap writer, the local model and the OpenAI path are
  off in CI, whatever the site's settings say. Candidates and promoted
  library tests still run, because they are committed code, not model
  calls. (Phase 47 Decision 9)
- **No active security tests.** Attack-shaped tests need a confirmation
  that you own the site. CI can't give one yet (Phase 43, then TFP-249).
- **Interactive tests are opt-in.** Tests that submit forms run only with
  `"interactive": true` in the config file. Use it only against a site
  whose data you can reset.
- **One Comprehensive area at a time.** Use `mode: comprehensive` with
  `area`. A run of every area isn't available yet.

## Without the action

Any Linux CI system with Docker can run the image directly:

```bash
docker run --rm --init --ipc=host --network host \
  --user "$(id -u):$(id -g)" \
  -v "$PWD:/work" \
  ghcr.io/emil3663/mr-onion:0.4.0 run --url http://localhost:3000 --out mr-onion-out --data-dir .mr-onion
```

- **`--user "$(id -u):$(id -g)"`.** Without it, the image runs as root,
  and on Linux every file it writes into your workspace (`--out`,
  `--data-dir`) is then owned by root. Your job can't easily cache,
  change or delete them, and a self-hosted runner's next checkout can fail
  on them. Create both folders before the run, so they are yours. If you
  must run as root, give the files back afterwards:

  ```bash
  docker run --rm -v "$PWD:/work" --entrypoint chown ghcr.io/emil3663/mr-onion:0.4.0 \
    -R "$(id -u):$(id -g)" /work/mr-onion-out /work/.mr-onion
  ```

- **`-v "$PWD:/work"`.** The image resolves `--out`, `--config`,
  `--data-dir` and `--baseline` against `/work`.
- **`--init --ipc=host`.** These keep Chromium and the servers it starts
  well behaved in a container.
- **`-e NAME`.** This passes a login's variables in, as the action does.

The image is tested on GitHub Actions only. On GitLab CI, Azure DevOps or
any other system it should run the same way, given a runner that can run
Docker with the host's network, but none of them is tested, and nothing
here claims they are supported.

## Without Mr Onion in the pipeline

A suite saved from the UI is plain Playwright: it imports only
`@playwright/test`. You can commit it to your repository and run
`npx playwright test` in your CI. That gives pass or fail on a frozen
suite. It loses the honest coverage, the gap list, the suite's reuse and
regeneration, the comparison with a baseline, and the gates.
