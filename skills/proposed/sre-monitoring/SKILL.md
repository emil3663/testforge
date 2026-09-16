---
name: sre-monitoring
description: "Design monitoring and alerting that pages a human only when it should. Use when adding metrics, building a dashboard, writing alert rules, debugging alert fatigue or a noisy pager, deciding what to instrument, or reviewing whether an alert is worth keeping. Applies the Four Golden Signals and the symptom-vs-cause rule. Produces a signal inventory and alert rules with a stated justification each."
---

# /sre-monitoring

From SRE Book Ch. 6 (Monitoring Distributed Systems) and Ch. 10 (Practical Alerting).

## Vocabulary, precisely

- **White-box** — metrics exposed by the system's internals (logs, /statusz, runtime interfaces).
- **Black-box** — testing externally visible behaviour as a user experiences it.
- **Alert** — a notification pushed to a human. Subtypes: **page** (act now), **ticket**
  (act later), **log** (nobody acts).

You need both boxes. White-box tells you *which component* is sick during an incident and
catches imminent problems. Black-box catches what the service cannot see about itself —
DNS failures, packets dropped before they arrive, the load balancer sending everyone nowhere.
Black-box is symptom-oriented by construction, which is why it's the better pager source.

## The Four Golden Signals

Instrument these four for every user-facing service. If you page on all four (saturation:
*nearly* problematic), coverage is at least decent.

1. **Latency** — time to serve a request. **Separate successful from failed latency.**
   A fast 500 looks wonderful in an undifferentiated latency graph and is the exact thing
   you want to catch.
2. **Traffic** — demand, in units that suit the system: HTTP rps, network I/O rate,
   concurrent sessions, transactions/sec.
3. **Errors** — rate of failed requests: explicit (HTTP 500), implicit (a 200 carrying the
   wrong content), or by policy (any response over 1s counts as an error).
4. **Saturation** — how full the constrained resource is. Target the resource that runs out
   first. Note that **most systems degrade well before 100% utilisation**, so pick the
   threshold from observed degradation, not from the number 100.

## The single most important rule: symptoms, not causes

Monitoring must answer two questions, and they are different:

- **What is broken?** — the symptom. This is what you page on.
- **Why is it broken?** — the cause. This is what you dashboard.

| Symptom (page) | Cause (dashboard) |
|---|---|
| Serving HTTP 500s | Database refusing connections |
| Responses are slow | CPU saturated, or a slow network path |
| Users in one region see nothing | CDN misconfiguration |

Paging on causes means paging on the failure modes you *predicted*. You cannot alert on a
failure you didn't think of, which is precisely the failure that will page you. Paging on
symptoms catches the whole class.

## Writing an alert rule — answer all five, in writing

Before an alert rule is allowed to page:

1. Does it detect a condition that is **urgent, actionable, and actively or imminently
   user-visible**? (All four words are load-bearing.)
2. Is there any circumstance where I'd know this alert was benign and ignore it?
   **If yes, the rule is wrong.** Fix the rule.
3. Does it definitely mean users are being hurt? Suppress for drains, planned maintenance,
   and anything in test.
4. Can I *act*? Must I act *now*? Could the action be automated instead?
   If the response is algorithmic, automate it — an algorithmic response is technical debt
   that pages you.
5. Will someone else be paged for this same event? Deduplicate.

Standing constraints:
- **Every page must be actionable.**
- **Every page must require intelligence.** No page whose response is a rote runbook step —
  that step should be code.
- **Pages should be about novel problems.** A page you've seen ten times is a bug report
  about your automation.
- A human can respond with real urgency only **a few times a day** before fatigue sets in.
  Budget pages accordingly; target **≤2 incidents per 12-hour shift** (see `sre-toil`).

## Rule construction details that prevent noise

- **Require two conditions.** Page on error *ratio* > 1% **AND** absolute error rate
  > 1/sec. Ratio alone screams about a quiet service; absolute alone ignores scale.
- **Require duration.** Demand the condition hold for 2+ evaluation cycles before firing.
  This kills flapping outright.
- **Prefer counters to gauges.** Monotonic counters retain meaning across sample intervals;
  gauges silently miss everything that happened between two scrapes.
- **Aggregate per-task rates first, then sum across instances** (`sum without instance`).
  This survives counter resets, restarts, and missing data points.
- **Label, don't name.** `variable/job/service/zone/instance` labels let one rule cover
  every target. Flat metric names force you to write the rule N times and maintain it N times.
- **Templatise** common patterns (HTTP, RPC, memory) so maintenance grows sublinearly.
- **Test the rules.** Synthesise time-series fixtures and assert the rule fires when it
  should. Alert rules are code, so they belong in CI. **[extension]** modern equivalents:
  Prometheus `promtool test rules`, unit tests over recorded series.

## Resolution: measure no more often than you'll act

Over-frequent collection is a real cost, in money and in noise.

- For a **99.9%** availability target, probing more than **once or twice a minute** is
  unnecessary. Checking disk fullness more than **every 1–2 minutes** is unnecessary.
- But a one-minute CPU average will hide the spikes driving your tail latency.
  Where tails matter, sample fine and aggregate coarse: record per-second internally in
  5%-granularity buckets, export the aggregate every minute.

## What changed since 2016 **[supersedes]**

Most of this chapter's cost advice is obsolete, and the obsolescence created a worse problem.

**Obsolete as written:** recording per-second CPU in 5%-granularity buckets to aggregate
externally, choosing bucket boundaries to save storage, and probing infrequently because
collection is expensive. Storage and query cost no longer force these choices.

**What replaced it:** it is now cheap enough to collect everything, so people do, and nobody
knows which signals matter. The book's rule — **delete any signal not on a dashboard and not
used by an alert** — is *more* load-bearing now, because cost used to enforce it and no
longer does. **You are the enforcement mechanism now.**

What survives untouched: **resolution should still match the decision you will make.** For a
99.9% target, probing more than once or twice a minute buys nothing — not because the storage
is expensive, but because you cannot act faster than that, so the extra data is noise with a
bill attached (`sre-cost`).

Two additions the book has no room for:

- **Cap cardinality deliberately.** High-cardinality dimensions are individually affordable
  and multiply catastrophically. This is the specific form the "collect everything" failure
  takes.
- **Measure time-to-detect as an SLI** (`sre-slo`). Every incident a human reported before
  monitoring caught it is a monitoring defect and should be tracked as one.

## Monitoring is read by agents now **[extension]**

Assume a responder with **no institutional memory**: it cannot recall that this spiked the
same way last spring. That raises the value of things the book already recommends, and
changes what "good" looks like:

- **Machine-readable state endpoints** — recent calls, error rates, latency histograms, live
  config — beat a dashboard that only renders visually.
- **Alerts should carry structured context**: what fired, the threshold, the current value,
  the linked playbook. An alert whose meaning lives in a human's head is unusable by an agent
  and marginal for a new joiner.
- **Playbooks as interfaces, not prose** — symptom → check → action → verification →
  escalation (`sre-agents`).

## Keep it simple — as simple as possible, no simpler

- Rules that catch real incidents should be **simple, predictable, and reliable**.
- **Delete any configuration exercised less than quarterly** — it does not work and you
  will find out at the worst time.
- **Delete any signal not on a dashboard and not used by an alert.**
- Prefer **distinct systems with simple, loosely coupled integration points** over one
  clever integrated system. Decouple collection from rule evaluation from notification;
  that decoupling is why alerting complexity can stay flat as the system grows.

## Trading short-term noise for long-term fixes

It is legitimate to *deliberately relax* an SLO target to stop firefighting and fix the
cause. Bigtable did exactly this — temporarily moved to a 75th-percentile latency target
and turned off email alerts — to buy the room for a real fix. Do this explicitly, with an
end date, not by quietly muting the pager.

Review **pages-per-shift statistics quarterly** with whoever owns the roadmap. Alert volume
is a budget line, and it should be argued about in daylight.

## Output

A signal inventory (the four golden signals per service, with the chosen saturation resource)
and an alert rule set where **every rule carries a one-line justification answering the five
questions**. Rules without that line get deleted.
