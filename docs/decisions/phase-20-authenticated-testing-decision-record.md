# Phase 20 Decision Record — Authenticated Testing (Locked)

Date: 2026-09-23
Scope: Config-driven automation-account login once per run, cached
Playwright `storageState` reused by every generated test in that run,
credentials referenced by name and never inlined, captured, or displayed.
Status: Approved and in implementation (Decisions 3, 5, 6 resolved 2026-09-24, before TFP-092 started)

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
  - A pointer to it from wherever run config's login fields are
    documented/surfaced in the app, so a user hits it before they need
    to search for it.
- **Acceptance criteria:**
  - The doc names all four exemption categories and matches the real
    config field names TFP-092/093 shipped, not a stale or assumed
    shape.
- **Dependencies:** TFP-092 (needs the real config shape to document
  against), TFP-093 (needs the real credential-reference shape).

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
