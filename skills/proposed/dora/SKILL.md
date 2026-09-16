---
name: dora
description: "Measure software delivery performance with DORA's metrics. Use when asked how fast or how safely a team ships, when setting up engineering metrics or a delivery dashboard, when someone proposes measuring developer productivity, when arguing about whether speed costs stability, or when justifying investment in delivery tooling. Covers the current five metrics, how to compute each from tools you already have, benchmarks, and the ways these metrics get misused."
---

# /dora

From **DORA** (DevOps Research and Assessment, now part of Google Cloud) — a multi-year
survey research program, published at [dora.dev](https://dora.dev). Companion to the
`sre-*` family: **DORA measures the delivery system; SRE measures the running system.**

## What DORA actually is, and its one big claim

A correlational research program. It identifies capabilities that **predict** delivery
performance across thousands of surveyed teams. That is weaker than causal proof, and worth
stating when someone quotes it as law.

Its central and best-replicated finding is nevertheless strong, and it is the reason to care:

> **Throughput and stability are not a trade-off.** The teams that deploy most often also
> have the lowest change failure rates. Speed and safety rise together, because the same
> practices — small batches, automation, fast feedback — produce both.

This kills the most common argument in software management. It is also the precise
counterpart to `sre-slo`'s error budget, which says the same thing in the other direction:
reliability is a budget you spend on velocity, not a tax you pay against it.

## The metrics — there are now five, not four

DORA expanded past the famous "four keys." Current set:

**Throughput**

| Metric | Definition |
|---|---|
| **Deployment Frequency** | How often you deploy to production — count over a period, or time between deployments |
| **Change Lead Time** | Time from *committed to version control* to *running in production* |
| **Failed Deployment Recovery Time** | Time to recover from a deployment that required intervention |

**Instability**

| Metric | Definition |
|---|---|
| **Change Fail Rate** | Proportion of deployments requiring immediate intervention |
| **Deployment Rework Rate** | Proportion of deployments that were *unplanned*, made in response to a production incident |

Note the renames: *Time to Restore Service* became **Failed Deployment Recovery Time**,
narrowing it to deployment-caused failures. **Deployment Rework Rate** is the newest and
catches something the original four missed — unplanned work created by earlier deploys, the
delivery-side view of `sre-toil`.

## Benchmarks

The 2024 report's four tiers, the last comprehensive tier-based data:

| Metric | Elite | High | Medium | Low |
|---|---|---|---|---|
| Deployment frequency | On-demand, multiple/day | Daily → weekly | Weekly → monthly | < monthly |
| Change lead time | < 1 day | < 1 week | 1 week – 1 month | > 1 month |
| Failed deployment recovery | < 1 hour | < 1 day | < 1 week | > 1 week |
| Change fail rate | < 5% | ~16–30% | ~16–30% | > 30% |

Roughly 19% of surveyed teams reached Elite in 2024.

**[unverified]** Several secondary sources state the 2025 program **retired the
Elite/High/Medium/Low clusters in favour of seven team archetypes**. I could not confirm this
from dora.dev — the 2025 material sits behind a gated report. Treat the tiers above as the
last confirmed public benchmark, and verify against the current report before quoting tiers
to anyone who matters.

Use benchmarks to locate yourself, never as a target. See misuse, below.

## How to compute these from tools you already have

None of this needs a vendor. **[extension]**

- **Deployment frequency** — count production deploy events. Deploy pipeline runs that
  reached production, or tags, or release records. Decide once whether a multi-service
  release counts as one deploy or many, and never change it.
- **Change lead time** — for each deploy, the time from each included commit's authored
  timestamp to the deploy timestamp. Report the **median and the 85th percentile**; the
  distribution is heavily skewed and the mean lies (`sre-slo`).
- **Change fail rate** — deploys followed by a hotfix, rollback, revert, or incident,
  divided by total deploys. The classifier is the hard part: pick a rule (a revert commit,
  a deploy tagged rollback, an incident linked to a release) and apply it mechanically.
- **Failed deployment recovery time** — from the failing deploy to the restoring deploy.
- **Deployment rework rate** — deploys flagged as unplanned/incident-driven over total.
  Needs a deliberate flag at deploy time; nothing infers this for you.

**Instrument once, define carefully, then leave the definitions alone.** A metric whose
definition drifts is worse than no metric, because trends become fiction.

## What the codebase knows, and what it doesn't **[extension]**

A real boundary: **these metrics are properties of the pipeline and of production, not of the
source.** Reading a repository tells you nothing about deploy frequency. But the repo does
carry **leading indicators** of every one of them — and unlike the real metrics, they need no
platform, no instrumentation, and no budget.

**Derivable from git and the repo alone, today:**

| Repo signal | Predicts |
|---|---|
| Diff size distribution per merge | batch size → deployment frequency, change fail rate |
| Branch lifetime (first commit → merge) | integration frequency → lead time |
| Number of simultaneously active branches | divergence and merge risk |
| Revert / hotfix commit rate | change fail rate |
| Time from PR open → merge | the approval segment of lead time |
| Presence and content of CI config | whether gates exist at all |
| Whether a rollback path is defined anywhere | failed deployment recovery time |
| Test-to-source ratio, and what CI actually blocks on | change fail rate |

**Needs pipeline or production data, and cannot be inferred from source:**
actual deploy events · true lead time to production · change fail rate (needs
deploy↔incident linkage) · recovery time · rework rate.

The practical consequence: **start with the repo-derived proxies.** They are available
immediately, they move earlier than the real metrics, and they point at the same capabilities
(`dora-capabilities`). Add the pipeline-derived metrics when you have somewhere to put deploy
events. Waiting for a metrics platform before improving anything is itself the anti-pattern
DORA warns about — *prefer improving to measuring*.



- **Do not set them as organisational goals.** Goodhart's law applies immediately and
  brutally: deployment frequency is trivially gamed by splitting deploys, lead time by
  committing later. They are **diagnostic instruments, not targets.**
- **Do not compare across applications** with different technology or risk profiles. A
  payments service and a marketing site are not on the same scale.
- **Never measure individuals.** These are team- and service-level. Individual DORA metrics
  are an anti-pattern that destroys the trust the data depends on.
- **Never use one metric alone.** Throughput without instability tells you a team ships fast
  and breaks things. The set is the measurement; any single number is propaganda.
- **Measure at application or service level**, not across disparate systems.
- **Prefer improving to measuring.** Elaborate dashboards are a common substitute for change.

A useful reframe: **these are the vital signs, not the treatment.** They tell you whether
something is wrong. `dora-capabilities` tells you what to change.

## Where this meets the SRE family

The two frameworks measure opposite ends of the same pipe, and the seams are exact:

| DORA | SRE counterpart |
|---|---|
| Change fail rate | Error-budget burn from change (`sre-slo`) — the same events, counted differently |
| Failed deployment recovery time | MTTR, and the ~3x playbook effect (`sre-incident`) |
| Deployment frequency, lead time | Push-on-green, progressive rollout (`sre-release`) |
| Deployment rework rate | Unplanned operational work — toil, from the delivery side (`sre-toil`) |
| — | Time-to-detect (`sre-slo`), which DORA does **not** measure and which gates recovery time |

Notice the gap in the last row. DORA measures how fast you *recover*, never how fast you
*noticed*. Since detection is now the bottleneck, pair the two sets or you will optimise a
number that starts after the expensive part is over.

## Agents change what these numbers mean **[extension]**

Agent-authored change raises deployment frequency and cuts lead time almost immediately.
Those two will look like a win within weeks. The honest test is whether the **instability**
metrics hold:

- **If deployment frequency rises and change fail rate holds, the velocity is real.**
- **If change fail rate or rework rate rises with it, you have bought incidents with speed** —
  exactly the failure `sre-agents` warns about, now with a number attached.
- **Segment by author.** Track agent-originated and human-originated change separately, or
  the two trends cancel out in the aggregate and you learn nothing.
- Deployment rework rate is the most sensitive early indicator here, because unplanned
  incident-driven deploys are what agent-induced breakage actually looks like.

This is the measurement that makes `sre`'s tenet 5 — *agent velocity only works if detection
and rollback keep pace* — falsifiable rather than rhetorical.

## Output

A delivery metrics definition doc: the five metrics with your exact computation rule and data
source for each, the reporting cadence, the level (team/service), a written statement that
these are diagnostic and not targets, and — where agents contribute changes — segmentation
by author.
