# Phase 20 Decision Record — Authenticated Testing (Locked)

Date: 2026-09-23
Scope: Config-driven automation-account login once per run, cached
Playwright `storageState` reused by every generated test in that run,
credentials referenced by name and never inlined, captured, or displayed.
Status: Approved and in implementation

## Context

`docs/decisions/product-roadmap.md`'s Phase 20 paragraph, and its own
"Explicitly out of scope" list (no autonomous login-flow discovery — this
is config-driven, full stop), already lock most of this phase's shape.
This record turns that into buildable decisions. Three things are
genuinely undecided and marked `[PLACEHOLDER]`: the credential-store
mechanism beyond plain environment variables, whether the cached
`storageState` persists to disk across separate runs or is scoped to a
single run, and the exact content of the setup instructions doc the
roadmap says TestForge ships.

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
- `[PLACEHOLDER: "or a local secret store" — the roadmap names this as
  an alternative to plain env vars but doesn't say which tool, if any.
  Confirm whether Phase 20 ships only the env-var path (simplest,
  consistent with the rest of this local-only tool) and defers any
  secret-store integration, or whether a specific tool needs supporting
  now.]`

4. Credentials and `storageState` are never captured in traces,
   screenshots, or the HTML report.
- Playwright's own trace/screenshot config is used to exclude the login
  step's captured state, and the report renderer explicitly scrubs any
  `storageState` content before it can reach HTML output — this is a
  redaction requirement, not an assumption that it won't come up.

5. `[PLACEHOLDER: does the cached storageState persist to disk across
  separate runs (saving a repeat login, with some invalidation/expiry
  policy), or is it held only in memory/on-disk for the duration of a
  single run and discarded after? This has real security weight — a
  session token surviving on disk between runs is a different risk
  profile than one that never leaves memory — so it needs an explicit
  answer, not a default assumed from "caches."]`

6. `[PLACEHOLDER: the roadmap says TestForge "ships setup instructions...
  the same pattern used for Selenium automation accounts" (exempted from
  lockout, rate-limiting, MFA interruption, new-sign-in alerts). Confirm
  this becomes a new doc (e.g. docs/AUTOMATED_ACCOUNT_SETUP.md) covering
  those four exemption categories generically, rather than
  platform-specific steps TestForge can't maintain for every site owner's
  identity provider.]`

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
  - Add the `[PLACEHOLDER]`-resolved secret-store path only if Decision
    3's placeholder is answered in favor of building it now; otherwise
    this ticket ships env-var-only and the secret-store question is
    explicitly deferred, stated as such in `TEST_PLAN.md`'s Known
    Limitations, not left silent.
- **Deliverables:**
  - Credential-reference resolution in run config.
  - `TEST_PLAN.md` regression case grepping generated output for the
    literal credential value and asserting it's absent.
- **Acceptance criteria:** per Acceptance Criteria §2 above (the
  grep-based check).
- **Dependencies:** TFP-092.

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

### TFP-095 — Automation-account setup instructions

- **Phase:** 20
- **Priority:** P3
- **Suggested labels:** `documentation`
- **Problem it solves:** the roadmap commits to shipping setup
  instructions "the same pattern used for Selenium automation accounts"
  — without this doc, Phase 20's config fields have no guidance on what
  kind of account should be behind them.
- **Scope:** Resolved once Decision 6's `[PLACEHOLDER]` is answered;
  covers the four named exemption categories (lockout, rate-limiting,
  MFA interruption, new-sign-in alerts) generically, not
  platform-specific steps.
- **Deliverables:** TBD pending Decision 6.
- **Acceptance criteria:** TBD pending Decision 6.
- **Dependencies:** TFP-092 (needs the real config shape to document
  against).

## Recommended Execution Order

1. TFP-092 (the core capability)
2. TFP-093 and TFP-094 in parallel once TFP-092 lands (different
   concerns, no shared files)
3. TFP-095 last (documents the settled shape, not a moving target)

## Suggested Milestone Gates

### Gate A — Authenticated runs work and leak nothing
- TFP-092–094 landed against a real target with a real login form, each
  with a `TEST_PLAN.md` case proving real (not assumed) behavior,
  including the negative case (grep finds no credential, no
  storageState in report/trace).

### Gate B — Phase 20 complete
- TFP-095 landed; Decisions 3 and 5 above answered and reflected in
  `TEST_PLAN.md`'s Known Limitations if either was deferred rather than
  built.
