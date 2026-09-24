# Phase 20 Decision Record — Authenticated Testing (Locked)

Date: 2026-09-23
Scope: Config-driven automation-account login once per run, cached
Playwright `storageState` reused by every generated test in that run,
credentials referenced by name and never inlined, captured, or displayed.
Status: Approved, implemented, Gate B met 2026-09-24 (`227002b`) — TFP-097 remains, not gating

## Context

`docs/decisions/product-roadmap.md`'s Phase 20 paragraph, and its own
"Explicitly out of scope" list (no autonomous login-flow discovery — this
is config-driven, full stop), already lock most of this phase's shape.
This record turns that into buildable decisions. Three things were
genuinely undecided and marked `[PLACEHOLDER]`: the credential-store
mechanism beyond plain environment variables, whether the cached
`storageState` persists to disk across separate runs or is scoped to a
single run, and the exact content of the setup instructions doc the
roadmap says TestForge ships. Resolved (Emil, 2026-09-24) — see
Decisions 3, 5, and 6 below.

**This phase is a hard dependency on Phase 19, not just a suggested
order** — `product-roadmap.md`'s own text: "Deliberately sequenced after
Phases 17–19 are proven on public surface, where the blast radius of a
mistake is zero." Phase 20 tickets do not start until Phase 19's Gate B
is met, even though Phase 18 and 19 themselves run independently of each
other.

**Standing policy for this phase:** same as Phases 18–19 — defects fixed
immediately in the ticket that found them, docs updated in the same
commit as the code. See `product-roadmap.md`'s Sequencing note.

## Decisions

1. Login is config-driven, never auto-discovered.
- The site owner supplies a login URL and field selectors (username,
  password, submit) once, in run config — the same shape already
  locked in the roadmap's "Explicitly out of scope" list.
- No heuristic or AI-assisted discovery of an arbitrary site's login
  flow — that remains explicitly out of scope for this roadmap.

2. TestForge drives the configured login flow once per run and caches
   the resulting `storageState`; every generated test in that run starts
   already authenticated.
- One login per run, not one login per test — the cost and risk of
  re-authenticating is paid once.

3. Credentials are referenced by name, never inlined.
- A generated test references a credential by name (e.g. an env var
  name), never contains the literal username/password string.
- The immediate mechanism is an environment variable, following the
  existing `.env.development`/`.env.example` convention already in this
  repo — no new config surface for the simple case.
- Resolved (Emil, 2026-09-24): env-var-only for this phase. No
  specific secret-store tool is supported now — consistent with the
  rest of this local-only tool, and the simplest path that still meets
  Decision 3's "never inlined" requirement. Deferred explicitly, not
  silently: TFP-093 states this in `TEST_PLAN.md`'s Known Limitations
  rather than leaving the gap unmentioned.

4. Credentials and `storageState` are never captured in traces,
   screenshots, or the HTML report.
- Playwright's own trace/screenshot config is used to exclude the login
  step's captured state, and the report renderer explicitly scrubs any
  `storageState` content before it can reach HTML output — this is a
  redaction requirement, not an assumption that it won't come up.

5. The cached `storageState` is scoped to a single run and never
   persisted to disk across runs.
- Resolved (Emil, 2026-09-24): single-run only. It's captured at run
  start, held for the duration of that run (in memory, or on-disk only
  as a transient artifact of that run's own working directory — never
  written anywhere that outlives the run), and discarded once the run
  finishes. No cross-run cache, no invalidation/expiry policy needed,
  because there's nothing left to invalidate after the run ends. A
  session token never survives on disk between runs — the safer of the
  two risk profiles this decision named, and consistent with Decision
  2's "one login per run" framing already locked above.

6. The setup-instructions doc is generic, not platform-specific.
- Resolved (Emil, 2026-09-24): a new `docs/AUTOMATED_ACCOUNT_SETUP.md`
  covering the four named exemption categories (lockout, rate-limiting,
  MFA interruption, new-sign-in alerts) generically, as the roadmap's
  own "same pattern used for Selenium automation accounts" text already
  implies. Not platform- or identity-provider-specific steps — TestForge
  can't maintain those for every site owner's IdP, and the roadmap never
  asked for that.

7. Login config entry is API-only for Phase 20; a UI field is deferred,
   not required for this phase's gate.
- Raised by Claude Code while building TFP-092: TFP-095's setup doc
  assumed a UI location for login fields to point a user at, and no
  such UI exists — `/api/run`'s `login` block is API-only today.
- Resolved (Emil, 2026-09-24): API-only for this phase, same precedent
  as Phase 19's named flows (API first in TFP-089, UI added after in
  TFP-096, not gating). See TFP-097 below — added to the backlog, not
  required for Gate A or Gate B.

## Acceptance Criteria

1. Config-driven login
- Given a real target with a working login form and correct config
  (URL + selectors), TestForge authenticates once and every generated
  test in that run starts on an authenticated page — verified by an
  assertion only reachable when logged in (not just "no login screen
  shown").

2. Credential handling
- A generated test file contains no literal credential string —
  grepping the output for the configured password value returns nothing.
- A run's trace, screenshots, and HTML report contain no captured
  `storageState` content or literal credential value.

3. Sequencing
- No Phase 20 ticket starts implementation before Phase 19's Gate B is
  marked met in that phase's own decision record.

## Regression Policy

- `TEST_PLAN.md` gets cases for: successful authenticated run against a
  real target (every generated test starts logged in); a failed login
  (wrong config) producing a clear, named error rather than every test
  silently running unauthenticated; and a grep-based regression case
  asserting no credential value appears in generated code, traces, or
  the report. Landed in the same commits as the code, per this phase's
  standing policy.

## Backlog

### TFP-092 — Config-driven login + storageState caching for a run

- **Phase:** 20
- **Priority:** P2
- **Suggested labels:** `feature`, `auth`
- **Problem it solves:** every generated test currently runs
  unauthenticated — real functionality behind a login is entirely
  untested, and this is the core capability the whole phase exists for.
- **Scope:**
  - Accept login config (URL, username/password field selectors, submit
    selector) as part of run config.
  - Drive the login flow once via Playwright at run start; capture
    `storageState`.
  - Reuse that `storageState` for every generated test's browser context
    in the run.
  - A failed login (bad selector, wrong credential) surfaces as a clear,
    named run-level error — not a silent fallback to unauthenticated
    tests.
- **Deliverables:**
  - Run-config schema extension + login-flow driver.
  - `TEST_PLAN.md` case(s) proving authenticated state actually reaches
    every generated test against a real target with a login form.
- **Acceptance criteria:** per Acceptance Criteria §1 above.
- **Dependencies:** Phase 19 Gate B met (this phase's hard sequencing
  rule).
- **Landed (`ca4e10c`):** `/api/run` accepts a `login` block (URL, three
  selectors, `usernameEnv`/`passwordEnv` credential-variable *names*, a
  post-login path or selector); the executor logs in once in Chromium
  before Playwright starts and every test reuses the resulting
  `storageState` via `playwright.config.ts`. The state file lives in a
  per-run directory outside the evidence directory, removed when the
  run's process ends (Decision 5: single-run only), with a sweep for
  any left by a crashed run. A bad selector, wrong credential,
  unreachable page, or unset credential variable is a named 422 with no
  run started; a malformed config (inline credentials under any field
  name, a non-origin-matching `loginUrl`, neither post-login check set)
  is a 400. **Defect found and fixed live:** a target that binds a
  session to the User-Agent and Accept-Language it was issued to
  reported a "successful" login that every test still failed, because
  the login ran in a default browser context while tests ran as Desktop
  Chrome/`en-US` — login and tests now share one options object
  (`src/lib/run/browser-context.ts`). **Judgment call, not escalated:**
  `usernameEnv`/`passwordEnv` accept any syntactically valid environment
  variable name, with no allow-list restricting which names — consistent
  with Phase 16's already-locked unsandboxed, local-only execution
  model (`/api/run` already runs caller-supplied code with the user's
  own privileges), not a new risk this ticket introduces.

### TFP-093 — Named credential references, never inlined

- **Phase:** 20
- **Priority:** P2
- **Suggested labels:** `feature`, `security`, `auth`
- **Problem it solves:** without this, TFP-092's login config would be
  the obvious place for a real username/password to end up hardcoded in
  a committed run config or generated file.
- **Scope:**
  - Run config references a credential by name (env var name); the
    actual value is read from the environment at run time, following
    the `.env.development`/`.env.example` convention.
  - Env-var-only, per Decision 3's resolution — no secret-store
    integration in this ticket. State the deferral explicitly in
    `TEST_PLAN.md`'s Known Limitations, not left silent.
- **Deliverables:**
  - Credential-reference resolution in run config.
  - `TEST_PLAN.md` regression case grepping generated output for the
    literal credential value and asserting it's absent.
- **Acceptance criteria:** per Acceptance Criteria §2 above (the
  grep-based check).
- **Dependencies:** TFP-092.
- **Landed (`622c047`):** grep of the real generated suite, persisted
  `run.json`/`suite.spec.ts`, and API responses finds neither credential
  value; confirmed not vacuous (a deliberately-mutated `run.json` fails
  the check). Hardened: `usernameEnv`/`passwordEnv` must be upper-case
  letters, digits and underscores, so a credential pasted where a name
  belongs is refused with a 400 before lookup instead of being echoed
  back in a "variable X is not set" error — narrows the mistake, does
  not rule it out (an all-upper-case password would still pass), stated
  in `TEST_PLAN.md`'s Known Limitations.

### TFP-094 — Redact credentials and storageState from traces, screenshots, and the report

- **Phase:** 20
- **Priority:** P1
- **Suggested labels:** `bug`, `security`, `reliability`
- **Problem it solves:** Playwright's default trace/screenshot capture
  would otherwise record the authenticated page and, potentially, the
  login step itself — the highest-severity failure mode this phase can
  ship, since it's a credential leak into an artifact TestForge already
  hands back to the user.
- **Scope:**
  - Exclude the login step from trace/screenshot capture via Playwright
    config, not by hoping it doesn't get captured.
  - Explicitly scrub any `storageState` content from the HTML report
    renderer's input before it can reach output, as a defense-in-depth
    second layer independent of the capture-exclusion above.
  - Add a regression test that deliberately tries to make a credential
    or `storageState` value reach the report, and asserts it can't —
    not just asserting the happy path is clean.
- **Deliverables:**
  - Trace/screenshot config changes + report-renderer scrubbing.
  - `TEST_PLAN.md` case(s) per Acceptance Criteria §2's report/trace
    checks.
- **Acceptance criteria:** per Acceptance Criteria §2 above.
- **Dependencies:** TFP-092.
- **Landed (`dad7049`):** probed first, not assumed — a real
  authenticated run's `trace.zip` held the whole `storageState`
  (session cookie and value) even though the login itself ran outside
  any traced context. Two independent layers now scrub every artifact
  before it can reach the result, persisted evidence, or a download:
  value-based redaction (raw/JSON-escaped/percent-encoded, rewriting
  inside zip entries via `playwright-core`'s own bundled zip tools) and
  a structural pass dropping any `storageState` key outright. Fails
  closed: an artifact that can't be scrubbed is deleted, not kept. The
  regression test deliberately tries to leak (prints the session,
  types credentials, fails on an assertion echoing the session) and
  found 31 leaks before the fix, 0 after, with the trace still valid
  and useful. Screenshots/videos are binary and not scrubbed (Known
  Limitations); values under 4 characters are not redacted (would
  shred unrelated text).

### TFP-095 — Automation-account setup instructions

- **Phase:** 20
- **Priority:** P3
- **Suggested labels:** `documentation`
- **Problem it solves:** the roadmap commits to shipping setup
  instructions "the same pattern used for Selenium automation accounts"
  — without this doc, Phase 20's config fields have no guidance on what
  kind of account should be behind them.
- **Scope:** Per Decision 6's resolution — a new
  `docs/AUTOMATED_ACCOUNT_SETUP.md` covering the four named exemption
  categories (lockout, rate-limiting, MFA interruption, new-sign-in
  alerts) generically, not platform- or identity-provider-specific
  steps. Written against TFP-092's actual config field names (login
  URL, selectors) and TFP-093's actual credential-reference shape
  (env var name), not invented ahead of them.
- **Deliverables:**
  - `docs/AUTOMATED_ACCOUNT_SETUP.md`: what an automation account is,
    why it needs the four exemptions, and how to point TestForge's run
    config at one (referencing TFP-092/093's real field names).
  - A pointer to it from `README.md` and `.env.example` (config entry
    is API-only for this phase per Decision 7 below — there is no
    run-config UI field to attach a pointer to yet).
- **Acceptance criteria:**
  - The doc names all four exemption categories and matches the real
    config field names TFP-092/093 shipped, not a stale or assumed
    shape.
- **Dependencies:** TFP-092 (needs the real config shape to document
  against), TFP-093 (needs the real credential-reference shape).

### TFP-097 — Login config entry in the run-config UI

- **Phase:** 20
- **Priority:** P3
- **Suggested labels:** `feature`, `ui`
- **Problem it solves:** TFP-092's `login` block is API-only —
  `/api/run` accepts it, but nothing in the app lets a user enter it, so
  authenticated runs are only reachable by hand-building a request body.
  Raised by Claude Code while building TFP-092, resolved by Decision 7
  above (2026-09-24): API-only for this phase, UI deferred to this
  ticket.
- **Scope:**
  - A login-config section in the run-config UI (URL, three selectors,
    the two credential *variable names*, post-login path/selector) —
    same shape as the existing content-rules fields, wired to
    `/api/run`'s real `login` field names once this lands.
  - The two credential fields take a variable *name* only, never a
    value — the UI must not become a place to type a real password.
- **Deliverables:**
  - Login-config UI section + wiring into the run request.
  - `TEST_PLAN.md` case proving a login entered through the UI produces
    the same authenticated run a direct API call with the same config
    would.
  - Update TFP-095's `docs/AUTOMATED_ACCOUNT_SETUP.md` pointer once a UI
    location exists to point at.
- **Acceptance criteria:**
  - A login config entered in the UI authenticates a real run exactly as
    the equivalent `/api/run` request body would.
- **Dependencies:** TFP-092 (needs the real config shape); independent
  of TFP-093/094/095 — can be built in parallel with any of them, or
  after.

## Recommended Execution Order

1. TFP-092 (the core capability)
2. TFP-093 and TFP-094 in parallel once TFP-092 lands (different
   concerns, no shared files)
3. TFP-095 after TFP-092/093 land (documents the settled shape, not a
   moving target)
4. TFP-097, any time after TFP-092 — doesn't block or depend on
   TFP-093/094/095, so it can slot in wherever's convenient

## Suggested Milestone Gates

### Gate A — Authenticated runs work and leak nothing
**Met, 2026-09-24 (`dad7049`).** TFP-092–094 landed against real targets
(`the-internet.herokuapp.com` and a local fixture), each with a
`TEST_PLAN.md` case proving real (not assumed) behavior — RUN-16/RUN-17
(login + failure handling), RUN-18 (nothing leaks, including the
negative case: 31 leaks found with scrubbing disabled, 0 with it), and
RUN-19 (grep finds no credential, not vacuous — a deliberately-mutated
`run.json` fails the check).

### Gate B — Phase 20 complete
**Met, 2026-09-24 (`227002b`).** TFP-095 landed (RUN-20): a generic
setup doc covering all four exemption categories, kept from drifting by
a unit test that fails if the doc's field table, JSON example, quoted
error messages, or parallelism claim stop matching the real code.
Decisions 3 and 5 are reflected in `TEST_PLAN.md`'s Known Limitations
(env-var-only credentials, single-run `storageState`); Decision 5 was
built, not deferred.
- TFP-097 (login config UI) is not required for this gate — named
  config works end-to-end via the API today, and TFP-097 only closes
  the UI gap, same precedent as Phase 19's TFP-096. Land it whenever
  convenient; don't hold the phase open for it.
