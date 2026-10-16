# TestForge and Lighthouse (napi)

TestForge stands on its own. This page is about an **optional** second home
for its runs: napi, the back end of Guardian360's Lighthouse, where the
`testforge` plugin keeps every run as records a builder can read beside the
pages they build, and where a failed test can be labelled with the verdicts
`docs/QUALITY_GATES.md` uses (real, template error, model error, unclear).

Nothing in TestForge changes shape for it. The wire is `runs/<runId>/run.json`
as TestForge writes it; napi reads it on its side. Unconfigured, nothing is
attempted and nothing is logged beyond one line at start.

## How it works

```
TestForge (this app)                              napi (Lighthouse)
  run finishes → run.json persisted ──POST ingest──▶ testforge-runs / -tests / -untouched
  poller every N s ──GET queued──────────────────▶ runs asked for in Forge
         └──POST hand-off (taken once) ──────────▶ status: started
         └── /api/generate + /api/run here        … a person labels failures (review)
  push lands the result on the claimed row ──────▶ status: passed | failed | stopped
  poller sees "stopping" → cancels the run here
```

- napi never calls TestForge. The network runs one way, as it does for
  guardian360/pentest's agent: TestForge reaches into napi to push and to
  poll. So TestForge can run anywhere napi is reachable from.
- A run asked for in napi carries the config TestForge is given (`scope_file`:
  address, best-practice areas, mode, what was asked, and the sign-in by
  **variable names only**). The poller drives this server's own `/api/generate`
  and `/api/run` with it, exactly as the UI would, and remembers which napi
  row the run must land on. When it finishes, the push names that row
  (`claimed`) and napi keeps the row, now under TestForge's own `runId`.
- Pushes are best effort: a napi that is down is a logged line, never a
  failed run. The run is on disk either way.
- The crawl snapshot (`contentProfile`) is left out of the push. napi
  deliberately keeps no crawl; a page is a path there.

## Set up

On napi:

```sh
php artisan napi:plugins:install testforge
php artisan napi:clients:create testforge --role=testforge-writer --company=<company uuid>
```

The second prints a client id and secret (shown once). In TestForge's local
`.env` (never a committed file):

```
NAPI_URL=http://localhost:8100
NAPI_CLIENT_ID=<client id>
NAPI_CLIENT_SECRET=<client secret>
NAPI_COMPANY_ID=<company uuid>
NAPI_POLL_SECONDS=30        # optional; 0 pushes only
TESTFORGE_SELF_URL=http://localhost:3000   # optional; defaults to NEXT_PUBLIC_SITE_URL
```

Start TestForge. The server logs `napi: on, pushing runs to …` once.

## Where the code is

`src/lib/napi/`: `config.ts` (the variables), `client.ts` (the four napi
calls), `push.ts` (a persisted run into ingest), `poller.ts` (queued runs
claimed and run here), `claims.ts` (which of this process's runs napi asked
for), `boot.ts` (wired at server start from `src/instrumentation.ts`).
`src/lib/run/persistence.ts` announces a persisted run (`onRunPersisted`);
that is the only touch on existing code. Tests: `src/lib/napi/*.test.ts`.

## What it does not do

Evidence files stay in `runs/<runId>/evidence/`; napi stores references, not
copies. Verdicts given in napi are not yet written back into
`docs/decisions/data/labelled-failures.md`. TestForge exposes no MCP server
of its own yet; when it does, the poller is one of several ways a run can be
asked for.
