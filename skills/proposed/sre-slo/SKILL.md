---
name: sre-slo
description: "Set reliability targets and run error-budget math. Use when asked how reliable something should be, when defining SLIs/SLOs/SLAs or an availability target, when someone proposes 'five nines' or '100% uptime', when deciding whether it's safe to ship, or when a latency number needs to become a real target. Produces an SLO document with indicators, targets, measurement spec, and a budget policy."
---

# /sre-slo

From SRE Book Ch. 3 (Embracing Risk) and Ch. 4 (Service Level Objectives).

## The three terms, kept straight

- **SLI** — a quantitative measure of one aspect of service level. *What you measure.*
- **SLO** — a target value or range for an SLI. *What you aim for.* Form: `SLI ≤ target`
  or `lower ≤ SLI ≤ upper`.
- **SLA** — an SLO with a consequence attached. **The test: if missing it costs nothing,
  it is an SLO, not an SLA.** Most things people call SLAs are SLOs.

## Procedure

### 1. Pick indicators — few, and by service type

| Service type | Indicators |
|---|---|
| User-facing serving | availability, latency, throughput |
| Storage | latency, availability, durability |
| Big data / pipelines | throughput, end-to-end latency |
| Everything | correctness |

**Have as few SLOs as possible** — just enough to cover the system's attributes. Every SLO
you add is one more thing that can be argued about at 3am.

### 2. Define availability as a ratio, not a feeling

```
Time-based:      availability = (total time − downtime) / total time
Request-based:   availability = successful requests / total requests
```

Request-based is the one to use for anything serving traffic. A service doing 2.5M requests/day
at a 99.99% target may serve **250 errors/day** and still be in spec.

Annual downtime budgets: **99.9% = 43.2 min/yr · 99.99% = 52.56 min/yr · 99.999% = 5.26 min/yr.**

### 3. Never state a latency SLO as an average

An average latency of 100ms at 1,000 rps comfortably hides 1% of requests taking **5 seconds**.
A "typical 50ms" service can have 5% of requests running 20x slower. The average is the one
number guaranteed not to describe anyone's experience.

Use a percentile curve instead:

```
90% of calls  < 1 ms
99% of calls  < 10 ms
99.9% of calls < 100 ms
```

Collect **request counts bucketed by latency** (histograms), not raw latencies — exponentially
spaced bucket boundaries, roughly factors of 3.

### 4. Write the measurement spec down

Ambiguity here is where SLOs go to die. Pin all six:

- **Aggregation interval** — "averaged over 1 minute"
- **Aggregation region** — "all tasks in a cluster"
- **Measurement frequency** — "every 10 seconds"
- **Which requests count** — "HTTP GETs from black-box probes"
- **How acquired** — "through monitoring, measured at the server"
- **Latency definition** — "time to last byte"

Why it matters: a system serving 200 rps on even seconds and 0 on odd seconds has the same
average as a steady 100 rps service, and **double the instantaneous load**.

Measure **some** metrics client-side. Server-side latency looks fine while JavaScript is
making the page unusable.

### 5. Choose targets — the five rules

1. **Don't pick a target based on current performance.** Adopting today's numbers without
   reflection locks you into heroics forever.
2. **Keep it simple.** Complicated aggregations obscure the changes you built them to see.
3. **Avoid absolutes.** "Infinitely scalable, always available, zero added latency" is not
   a target, it is a wish.
4. **Have as few SLOs as possible.**
5. **Perfection can wait.** Start loose, tighten as you learn. A loose SLO you honour beats
   a tight one you ignore.

Set the target from user need and money, via five questions: expected user service level ·
revenue tie-in · paid vs free · competitor levels · consumer vs enterprise.

Sanity check against background noise: typical ISP error rates run **0.01%–1%**. Reliability
you buy below the noise floor is invisible to users. Be very sure before buying it.

### 6. Do the cost/benefit before adding a nine

Each nine costs roughly an order of magnitude. High-availability infrastructure runs
**2–10x** the cost of throughput-optimised infrastructure on identical hardware.

```
Going 99.9% → 99.99% on a $1M/yr service
  captures at most  $1M × 0.0009 = $900/yr.
  If it costs more than $900, do not do it.
```

Run this arithmetic *out loud* when someone asks for five nines. It ends most of those
conversations in under a minute.

### 7. Derive the error budget and write the policy

```
error budget = 1 − SLO          (measured per quarter)
```

A 99.999% SLO gives a 0.001% budget; a single incident causing a 0.0002% failure rate
burns **20% of the quarter's budget**.

The policy is the whole point — state it explicitly:

> While measured reliability is above SLO, releases proceed. When the budget is exhausted,
> releases stop except for fixes, and engineering effort moves to reliability until the
> budget recovers.

Track daily/weekly; report monthly/quarterly.

### 7b. Split the budget by who spent it **[extension]**

The book assumes you control the numerator. With heavy vendor dependency you do not — a
large share of your budget is spent by providers you cannot page. "Stop shipping features"
is an incoherent response to burn caused by your auth provider.

Track two lines:

- **Self-inflicted burn** — your changes, your bugs, your capacity. The error budget policy
  applies exactly as written.
- **Inherited burn** — vendors, upstream APIs, the platform. The policy response is not
  "ship less"; it is **degrade better** (`sre-architecture`) or **change the dependency**.

Without the split, the budget stops driving behaviour: it gets exhausted by things the
policy has no lever over, and the team learns to ignore it.

### 7c. Time-to-detect deserves its own SLO **[extension]**

The book argues MTTR is cheaper to improve than MTTF. With one-button rollback and feature
flags, MTTR has collapsed — which makes **detection the bottleneck**, and detection is
barely budgeted anywhere.

Set an explicit target: *"95% of user-visible incidents are detected by monitoring within
5 minutes, and by monitoring rather than by a human report."* Then measure the miss rate.
Every incident a human noticed first is a monitoring defect (`sre-monitoring`).

### 8. Guard both edges

- **Keep a safety margin** — run a tighter internal SLO than the one you advertise, so you
  react before anyone outside notices.
- **Don't overachieve.** Users build on the reality you deliver, not the promise you made.
  A service that advertises 99.9% and delivers 99.999% has silently sold the higher number.
  Google's Chubby team deliberately took the service down to stop this. **[extension]** the
  modern equivalent is scheduled dependency-failure drills, not real outages.

## Output

Produce `SLO.md` (or a section in the design doc) containing: indicators with rationale ·
targets · the six-part measurement spec · the error budget and its policy · the internal
safety margin. Anything not written down is not an SLO.

## Failure modes to call out

- A target picked because it's what the system currently does.
- An "SLA" with no consequence.
- Latency stated as a mean.
- Availability measured only server-side.
- A budget nobody has agreed to spend or stop spending.
