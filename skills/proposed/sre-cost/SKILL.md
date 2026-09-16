---
name: sre-cost
description: "Budget and bound spend the way SLOs budget reliability. Use when a bill is growing or spiked, when setting quotas, rate limits, concurrency caps or timeouts, when autoscaling or an agent loop could run away, when capacity planning for elastic infrastructure, or when deciding what a feature is allowed to cost. Treats runaway spend as a failure mode with the same mechanics as an error budget."
---

# /sre-cost

**[extension]** — **[supersedes]** the book's capacity planning material (Ch. 1 tenet 6,
Ch. 18). The reasoning survives; the constraint moved.

## The shift

In 2016 the binding constraint was **capacity**: machines were scarce, so the discipline was
forecasting demand and bin-packing cores. Elastic infrastructure removed that constraint and
replaced it with a worse-behaved one.

**Capacity failures are self-limiting. Cost failures are not.** Run out of machines and the
system degrades visibly and stops. Run out of nothing at all — because the provider will
sell you as much as you ask for — and the failure is silent, unbounded, and discovered on an
invoice weeks later. There is no natural backstop and no equivalent of "stop shipping."

Modern capacity planning is therefore **limits engineering**: you are not acquiring
resources, you are placing bounds on things that can otherwise scale to infinity.

## Run a cost budget with the error budget's mechanics

The error budget works because it converts an argument into arithmetic. Spend deserves the
identical treatment:

```
cost budget = agreed spend ceiling for the period
burn rate   = current spend / elapsed fraction of period
```

State the policy explicitly, the same way an error budget policy is stated:

> While spend tracks below the budget line, work proceeds. When burn rate projects an
> overrun, the next change is a cost fix, not a feature. When the budget is exhausted,
> non-essential workloads are shed by criticality.

Both budgets are then a single conversation about what the system is allowed to consume.

- **Track burn rate, not total.** Total spend tells you what happened; burn rate tells you
  what is about to. Alert on the *derivative* — the sharpest signal is a step change in rate.
- **Attribute spend to something meaningful** — service, team, feature, customer, agent
  session. Unattributable spend cannot be governed, only regretted.
- **Set the budget per environment.** Dev and CI are where runaway loops usually start,
  and they are least watched.

## Bound everything that can scale on its own

For each of these, the question is not "what value?" but "what happens at the bound?" —
an unbounded resource has no designed behaviour at its limit, which is the same failure as
an undesigned degraded mode (`sre-architecture`).

- **Autoscaling**: a maximum, not just a policy. Ask what a 100x traffic spike costs before
  it arrives, and whether you would rather serve it or shed it.
- **Concurrency limits** — the modern form of the book's thread-pool exhaustion
- **Rate limits and per-customer quotas** — the book's per-customer CPU-second allocation,
  intact as a pattern (`sre-overload`)
- **Timeouts and deadlines on everything**, especially anything that bills per second.
  An unbounded retry against a metered API is a direct funding transfer.
- **Token and call ceilings** per agent session, per user, per day (`sre-agents`)
- **Storage lifecycle rules** — free-to-hoard is exactly how storage bills grow
- **Cardinality caps on telemetry** — see below

## Saturation is now partly financial

The book's fourth golden signal is **saturation** — how full the constrained resource is.
On elastic infrastructure the constrained resource is frequently **budget**, so treat it as
a genuine saturation signal and alert on it like one (`sre-monitoring`).

The book's rule that *"many systems degrade before 100% utilisation"* has a financial
analogue: the point where unit economics stop working usually arrives well before the
spending limit.

## Observability is where this bites hardest

Telemetry cost is the clearest case of scarcity having quit. The book's advice on bucket
granularity and aggregating before export was **cost advice**, now obsolete as written.
What replaced it is worse: it is cheap enough to collect everything, so people do, and
nobody knows what matters.

- Keep the book's rule — **delete any signal not on a dashboard and not used by an alert** —
  and understand that you are now the enforcement mechanism that cost used to be.
- **Cap cardinality deliberately.** High-cardinality dimensions are affordable individually
  and multiply catastrophically.
- Sample high-volume traces; keep errors and slow requests at full fidelity.

## Cost failures worth designing against

- **The retry-storm invoice.** Retry amplification (4 layers × 3 retries = 64 attempts) is a
  cost multiplier as well as a load multiplier, and against a metered dependency the bill
  arrives even when every attempt fails (`sre-overload`).
- **The agent loop.** An agent retrying a failing action, or two agents triggering each
  other, bills continuously while making no progress. This is why the time-box tripwire in
  `sre-agents` is a cost control, not just a safety one.
- **Scale-to-zero cold start.** Cheap at rest, expensive under bursty load, and the cost
  profile inverts exactly when traffic arrives — the book's cold-cache problem with a price
  attached.
- **Cross-region egress.** Frequently the largest line nobody modelled.
- **The dev-environment loop** that nobody watches because it is "only dev."

## Provisioning still trades three ways

The book's framing holds, with the third term now dominant: **speed, accuracy, and caution**
in acquiring resources. Elastic infrastructure gave you speed for free and quietly removed
caution. Put caution back in deliberately, as limits.

## Output

A cost budget with a stated policy, burn-rate alerting with attribution, an explicit bound
for every resource that can scale on its own, and a named answer to "what happens at the
bound?" for each.
