---
name: sre-release
description: "Make shipping safe: hermetic builds, progressive rollout, canarying, feature flags, and launch review. Use when setting up CI/CD or a deploy pipeline, planning a launch or a migration, rolling out a risky change, reviewing whether something is ready to ship, or after a bad deploy. Includes the launch coordination checklist in reference/launch-checklist.md."
---

# /sre-release

From SRE Book Ch. 8 (Release Engineering) and Ch. 27 (Reliable Product Launches at Scale).

**Why this skill has outsized value: ~70% of outages are triggered by a change to a live
system.** Every improvement here is leverage on the largest single source of failure.

## Four principles for the release pipeline

**1. Self-service.** Teams control their own releases. Release engineering builds the tools;
it does not become a queue you wait in. A release process requiring a specific human is a
single point of failure with a calendar.

**2. High velocity.** Frequent releases mean fewer changes per release, which means a shorter
list of suspects when something breaks. **Push on green**: every build passing all tests is
a release candidate. Counterintuitively, shipping more often makes each shipment safer.

**3. Hermetic builds.** A build must be reproducible — same source, same artefact, on any
machine, at any time. That means pinned versions of *tools* (compilers) as well as
*dependencies* (libraries), and no reliance on the host's configuration or on a network
service being up. A build you cannot reproduce is a build you cannot bisect, and bisection
is how you find the change that broke it.

**4. Enforced policy.** Gate the operations that matter: code review for essentially all
changes, plus explicit approval for creating a release, deploying, and changing config.

## Pipeline stages

- **Build** — standardised tooling, declared targets, automatic dependency resolution.
- **Branch** — *this is the one stage where the book's answer is wrong for most modern
  services.* **[supersedes]** Its model — cut a release branch at a known revision, never
  merge back, cherry-pick fixes in — is a **large-batch** practice, built for versioned
  releases on a slow cadence. It directly opposes the small-batch, integrate-often property
  that predicts high delivery performance (`dora-capabilities`).

  Choose by **who runs the software**:
  - **A service you operate** → deploy from mainline continuously; use feature flags for
    incomplete work; no release branch. Keep branch lifetime under a day.
  - **Software someone else installs** (mobile, on-prem, a library) → release branches are
    unavoidable, because you must support versions you cannot upgrade. The book's rule
    applies here, and only here: fixes land on mainline first, then cherry-pick.

  Either way the underlying goal is the same and is the thing to state: **small changes,
  integrated often, with the shipped contents exactly knowable.**
- **Test** — continuous tests on mainline, *and* re-run on the release branch, because the
  thing you are shipping is the branch, not mainline.
- **Package** — versioned, **signed** artefacts, with labels (`dev`, `canary`, `production`)
  that move independently of the artefacts they point at.
- **Deploy** — match sophistication to risk, from a direct push to a multi-day
  geographically staggered rollout.

## Configuration

| Approach | Trade-off |
|---|---|
| Config files in mainline | Simple; skew between checked-in and running versions |
| Bundled with the binary | Tight coupling, trivially consistent; no independent change |
| Separate config package | Independent updates, feature flags without a rebuild; more moving parts |
| External store (Chubby/etcd/DB) | Frequent and dynamic changes; adds a runtime dependency on the store |

**Regardless of which you pick: configuration lives in version control under code review.**
Config is the change type most likely to cause an outage and least likely to be reviewed.

## Rolling out safely

**Gradual and staged.** Few machines in one location → observe → one full location →
observe → everywhere. The observation steps are the entire point; a "gradual rollout" with
no soak time between stages is a fast rollout with extra steps.

**Canary.** Run the new version on a small subset under *real* traffic and let it bake.
Canarying is structured user acceptance testing, not a formal test — it catches the things
your test environment isn't shaped like. **Canary rigour must not scale with perceived risk:**
the book's change-induced emergency was a "low-risk" config push that crash-looped globally
because it skipped canarying. The changes that skip canary are, by selection, the changes
nobody worried about.

**Feature flags.** Decouple deploy from release. A good flag framework gives you:
- rollout to a subset of servers, users, entities, or locations
- gradual ramp — **1% → 10% → …** of the user population
- routing by user, session, object, location
- graceful handling when the new path fails
- **independent, immediate revert of a single change**
- measurement of whether the change actually helped

Flags convert "roll back the deploy" into "turn off the feature," which is faster, narrower,
and does not require the release pipeline to be healthy at the time.

**Have a rollback path and test it.** Untested rollback is not a rollback.

## Client behaviour — the thundering herd

If a client (mobile app, agent, cron, browser poller) misbehaves in aggregate, no amount of
server capacity saves you.

- **Add jitter to everything automatic.** Clients that all update at 2 a.m. will DDoS you
  at 2 a.m. Randomise the schedule.
- **Exponential backoff with jitter** on retries — never a fixed interval, never synchronised.
- **Distinguish retriable from non-retriable.** Retrying a 4xx forever is a self-inflicted
  attack.
- **Keep server-side control of client behaviour**: push config that enables/disables
  features and tunes sync frequency and retry parameters. Ship dormant functionality and
  activate it by config, so rollback is a config change rather than an app-store release
  cycle you don't control.

See `sre-overload` for the server side of this.

## Load-test before launch

Services do not degrade linearly. Caches make them look great below capacity and they fall
off a cliff near it. The book's example failure mode: error logging under load consumed more
CPU than normal serving, which caused timeouts, which caused more errors. Load testing is
how you find your actual breaking point and your behaviour past it — both of which you need
for `sre-overload` and capacity planning.

**Launch spikes can reach 15x your estimate.** Plan the ramp, not just the peak.

## Change rate is now the governing variable **[extension]**

~70% of outages come from changes. Agents raise change rate by an order of magnitude, so
**the arithmetic only works if detection and rollback improve proportionally.** Otherwise
higher velocity is simply a faster route to the same incidents.

- **Progressive rollout is no longer a build project.** In 2016 Google had to construct
  Sisyphus; canarying, flags, and staged rollout are commodity infrastructure now. The
  absence of a rollout mechanism is a choice, and there is no remaining excuse for
  push-and-pray.
- **Track what fraction of error-budget burn is agent-originated** (`sre-slo`). If nobody
  measures it, the velocity gain is visible and its cost is not.
- **Attribution requires small diffs.** Many small changes beat few large ones precisely
  because high change rate is only survivable when you can tell which change did it.
- **Agent-authored change gets the same gates as any other** — review, tests, canary,
  rollback. The failure is assuming authorship implies a different risk class; it implies a
  different *volume*, which is the thing the gates exist for.

## The pipeline is an artifact, and it is where the gates live **[extension]**

Answering "does the codebase know what happens in the pipeline?" — mostly it does, because
the pipeline is *in the repo*. `.github/workflows`, `.gitlab-ci.yml`, and their equivalents
are reviewable source, and they are where every rule in this skill is actually enforced or
quietly not.

Review the pipeline as deliberately as you review the code:

- **What does it block on?** A gate that warns but does not block is not a gate. List what
  can reach production while red.
- **Is the rollback path defined here, and is it exercised?** An untested rollback is not a
  rollback, and a rollback that only exists in someone's memory is not defined.
- **Where is the soak time?** Staged rollout with no wait between stages is a fast rollout
  with extra steps.
- **What does it do on failure** — stop, continue, or retry forever?
- **Who can bypass it, and is the bypass noisy?** Break-glass should be loud and should file
  a bug (`sre-testing`).
- **Are secrets and credentials scoped to the stage that needs them?**

And apply `sre-code`'s spec-sheet test to the pipeline definition itself: **can you read it
and know what it will do, without simulating execution in your head?** CI configuration is
the most common place where a declarative format quietly grows conditionals, matrices, and
templating until it becomes an untooled programming language. A thousand-line pipeline nobody
can reason about is a production dependency with no tests.



For anything with real users, walk `reference/launch-checklist.md`. A good launch checklist
is **lightweight, robust, thorough, scalable, and adaptable** — and every question on it
should be traceable to a launch that once went wrong. Add questions only with a concrete,
reasonable action for the developer; review the whole list annually and delete what has
stopped earning its place.

## Output

A deploy pipeline with hermetic builds, a staged rollout plan with explicit soak criteria and
a tested rollback, config under review, and — for a launch — the completed checklist with
owners and contingencies.
