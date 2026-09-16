---
name: sre-testing
description: "Decide what to test, how much, and what can only be tested in production. Use when planning a test strategy, arguing about coverage, adding tests to an unfamiliar codebase, designing canary or configuration tests, setting up disaster/chaos testing, or when a bug reached production that tests should have caught. Covers the test taxonomy, the coverage-vs-release-velocity trade-off, and production testing."
---

# /sre-testing

From SRE Book Ch. 17 (Testing for Reliability).

## The framing that makes testing a reliability decision

Reliability is a function of **MTTF** and **MTTR**. Testing buys MTTF; the special property
of a *system test that blocks a push* is **zero MTTR** — the bug never reaches a user, so
there is no repair time at all. That is why pre-release gating is worth more than its
apparent cost.

The second-order effect matters too: higher MTBF gives developers the confidence to ship
faster. Reliable tests increase velocity. This is the same stability-enables-agility
argument as `sre-code`.

## Taxonomy

### Offline (traditional)

- **Unit** — one function or class, no larger context. Milliseconds, local. The foundation;
  everything above is more expensive per bug found.
- **Integration** — assembled components working together. Use dependency injection to swap
  heavy dependencies for mocks with precisely specified behaviour.
- **System** — the whole assembled thing:
  - *Smoke* — critical, simple behaviour; a cheap gate before expensive tests
  - *Performance* — catches gradual degradation that no single commit would flag
  - *Regression* — every historically painful bug, encoded so it cannot return.
    A regression test is a postmortem action item that actually stayed done.

### Online (production)

- **Configuration test** — compare the config a binary is *actually running* against the
  versioned config in source control. Config drift is invisible to every offline test and
  is a leading cause of outages.
- **Stress test** — find where graceful degradation ends and catastrophic failure begins.
  How full can the disk get? How many QPS before the cliff? You cannot design for overload
  (`sre-overload`) without these numbers.
- **Canary test** — not really a test: **structured user acceptance**. Deploy to a subset,
  let the binary *bake*, watch for variance, roll back on surprise. It covers the gap
  between your test environment and the real one.

## How much testing is enough?

The honest answer is "it depends on your reliability target," but two pieces of arithmetic
sharpen it.

**Flakiness compounds brutally.** For a service with 21,000+ tests, accepting only one
incorrect rejection per 100 perfect patches demands per-test reliability around
**99.9999%** (the 42,000th root of 0.99). Practical consequence: **a flaky test is worse
than no test** — it trains everyone to ignore red, which disables the tests that work.
Fix or delete flakes immediately.

**Bugs have orders, and higher orders need exponentially more exposure.**

| Order | Shape | Found by |
|---|---|---|
| 1 | Directly broken code; scales linearly with traffic | Regression/unit tests |
| 2 | Random data corruption that breaks *subsequent* requests | Staged rollout + observation |
| 3 | Corrupted data that happens to be a valid identifier | Statistical estimation over long exposure |

Unit tests do not find order-2 and order-3 bugs. Gradual rollouts and production validators
(`sre-data-integrity`) do. Coverage percentage tells you about order 1 only.

## Where to start in an untested codebase

Start with **business-critical components** — billing, auth, data mutation, APIs other teams
consume — not with the highest-coverage-per-hour targets. Then:

1. Versioned source control over everything, config included.
2. A continuous build that runs on every submission and **notifies immediately on breakage**.
   Treat a broken build as a top-priority failure: the cultural rule does more for
   reliability than the tooling does.
3. A build system with a real dependency graph, so only affected tests run and the feedback
   loop stays short enough to matter.

## Release velocity vs coverage

Shipping more often exposes users to more versions (lower MTBF) but makes each failure
trivially attributable and quickly fixable (lower MTTR). Manage the trade explicitly:

- **Files needing emergency low-MTTR edits should change more slowly than your MTBF.**
- **Frequently-changed config needs test coverage exceeding your application release quality** —
  because it ships more often, with less scrutiny, and breaks production just as hard.
- **Break-glass mechanisms should be noisy and should auto-file a bug** demanding a real fix.
  A silent emergency override becomes a permanent process.

## Configuration testing

- **Use a schema with load-time validation** — protocol buffers, or JSON Schema.
  **[extension]** in TS/Python: zod, pydantic. Schema validation removes toil and gives
  bounded runtime guarantees.
- **Use parsers with bounded runtime** — YAML via `safe_load`, protobuf. Custom syntaxes and
  interpreted config languages can take arbitrarily long, or execute arbitrary things.
- **Defense in depth**: multiple independent tools validate the config and **report
  discrepancies without auto-remediating**. Automatic remediation of a misparse amplifies the
  damage — the book's example is a tool that partially parsed a user list and would have
  "cleaned up" everyone missing from it.

## Testing at scale, and the things only production can tell you

- **Transitive dependencies matter.** Your unit tests are only as trustworthy as the test
  coverage of the libraries under them; an unrelated environment change can produce a false
  negative.
- **Probes and versions.** During a rollout you get all four combinations of old/new probe
  against old/new application. Roll probes and applications gradually together, so
  incompatibility is detected before users hit it.
- **Future-compatibility probes as monitoring** catch old software calling deprecated APIs
  on new peers, and vice versa — a scenario development testing structurally cannot see,
  because frontends and backends have independent release cycles.
- **Three request sets in production**: known-good replays, known-bad requests, and
  production-only requests. The third set is the coverage gap isolated testing always leaves.
- **Fake backends as build dependencies**, released in sync with the real service, so
  hermetic release testing stays honest.

## Evals: the test layer for nondeterministic components **[extension]**

When behaviour is produced by a model rather than a branch, the taxonomy above still holds —
but every layer becomes statistical, and the chapter's own statistical-testing advice becomes
the primary technique rather than an exotic one.

- **An eval is a system test with a pass *rate* instead of a pass.** Set the threshold
  explicitly and treat a drop as a regression.
- **The flaky-test arithmetic bites hardest here.** The chapter's own maths — that thousands
  of tests demand near-perfect per-test reliability — means an eval passing 80% of the time
  trains everyone to ignore red, which disables the evals that work. Either tighten it until
  it is trustworthy, or delete it.
- **Pin the model version and sampling parameters.** An eval against a floating model version
  is not a test, it is a weather report. A model upgrade is a dependency upgrade that changes
  behaviour with no diff in your repository (`sre-code`).
- **Apply the Chaos/Jepsen pattern directly**: log inputs and seeds, then **refactor
  interesting failures into fixed regression cases.** This is how you claw determinism back
  at the edges, and it is the same move the chapter already recommends for randomised testing.
- **Canarying works and matters more.** Statistical acceptance under real traffic is exactly
  the right instrument for a component you cannot fully specify offline.
- **Keep known-bad and adversarial inputs in the suite** — including inputs that attempt to
  cross the data/instruction boundary (`sre-code`).

## Disaster and statistical testing

- Design disaster tools to **compute a checkpoint equivalent to a clean stop**, push a
  loadable checkpoint, and respect standard release barriers. That makes the disaster path
  testable instead of theoretical.
- **Risky tools must check for an explicit barrier** — an "unhealthy replica" flag or similar
  — before acting, so they cannot fire against healthy production by accident.
- **Chaos-style tests aren't repeatable, and that's fine.** Capture value by logging the
  random seed and the actions chosen, then **refactor interesting runs into deterministic
  regression tests.** Randomness finds the case; the regression test keeps it found.
- Automation tools often modify each other's environments. Those circular dependencies need
  robust API restart semantics **and independent tests of those semantics**.

## Output

A test plan naming: which layers cover which risks, the business-critical components tested
first, the config validation approach, what is verified only in production (canary, config
test, probes, validators), and the stress-test numbers feeding `sre-overload`.
