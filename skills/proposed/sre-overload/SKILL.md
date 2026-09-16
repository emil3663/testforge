---
name: sre-overload
description: "Keep a system standing under more load than it can serve, and stop failures from cascading. Use when designing retries, timeouts, rate limits, backpressure, circuit breakers, load balancing or graceful degradation; when a service falls over under load; when a dependency's slowness is spreading; or during an active cascading failure (see the immediate-steps section). Covers retry budgets, deadline propagation, load shedding, and criticality."
---

# /sre-overload

From SRE Book Ch. 19–22 (Load Balancing at the Frontend / in the Datacenter,
Handling Overload, Addressing Cascading Failures).

**The governing sentence: "When systems are overloaded, something needs to give."**
A system that tries to serve every request under overload serves none of them. Choose what
to drop, deliberately, in advance — or the system will choose for you, at random, by dying.

---

# Part 1 — Active cascading failure: do these now

Working from cheapest and most reversible:

1. **Add resources.** Works only if capacity exists *and* a death spiral hasn't started.
2. **Stop health-check deaths.** When process-level health checks kill tasks that are
   merely overloaded, the survivors get more load and die faster. Temporarily disable, and
   fix the real bug: *process* health ("is the binary responding?") is not *service* health
   ("is it serving?"). Conflating them turns a load problem into a crash loop.
3. **Restart wedged servers** — GC death spirals, deadlocks, in-flight requests with no
   deadlines pinning resources. Identify why first; restarting blindly just resets the clock.
4. **Drop traffic — hard.** Cut to **1%** if crash-looping, let caches warm and connections
   establish, then ramp gradually. Fix the trigger before restoring full traffic. Timid
   traffic reduction is the classic way to stay in a crash loop for an extra hour.
5. **Enter degraded mode** — lower-quality results, drop unimportant traffic.
6. **Eliminate batch load** — index updates, stats jobs, anything sharing serving resources.
7. **Eliminate bad traffic** — block the expensive query or the abusive pattern.

Then go to `sre-incident` for the investigation and `sre-postmortem` for the writeup.

---

# Part 2 — Design so it doesn't happen

## Measure capacity in resources, not QPS

QPS is a bad capacity metric: query cost varies with client, time of day, and software
version, and the ratio drifts — sometimes gradually, sometimes drastically. **Provision
against actual resource consumption, usually CPU.** In garbage-collected runtimes memory
pressure shows up as CPU load anyway, so CPU is a decent single signal.

## Retries — the most common way to turn a blip into an outage

Retries are amplification. Get the arithmetic right or don't retry.

- **Per-request retry budget: 3 attempts maximum.** Then the failure propagates.
- **Per-client retry budget: only retry while the retry ratio stays under 10%** of requests.
- **Randomised exponential backoff always.** Synchronised retries are a self-inflicted DDoS.
- **Never retry at multiple layers.** The killer arithmetic: **4 layers × 3 retries each =
  64 attempts** for one user request. Retry at exactly one layer — usually the highest one
  that can still do something useful — and pass failures straight through the rest.
- **Mark retries in request metadata** (a counter, 0→2). Backends that see a high retry
  fraction can return **"overloaded; do not retry"** instead of a plain rejection, which
  stops the explosion at the source.
- **Distinguish retriable from permanent.** Never retry a 4xx.

When overloaded: if a **large** subset of backends is overloaded, do not retry — bubble the
error up. If a **small** subset is, retry immediately on a different task.

## Deadlines

- Set a deadline on every request, and **propagate it**: pass the *remaining* time downstream.
  Without propagation, servers do full work on requests whose callers gave up long ago —
  pure waste, exactly when you have none to spare.
- **Check the deadline before starting work, and at intermediate stages.** If it's already
  expired, fail fast rather than politely.
- **Beware bimodal latency.** The book's case: a deadline set three orders of magnitude above
  mean latency meant a small number of slow requests exhausted the entire thread pool.
  A deadline that only catches catastrophes is not doing its job. Set deadlines from the
  latency distribution, and monitor the distribution — not the mean.

## Load shedding and graceful degradation

- **Shed early and cheaply.** Reject at the edge before the request consumes resources deep
  in the stack.
- **Degrade rather than fail**: smaller result sets, cheaper algorithms, cached/stale data.
- **Assign criticality** and shed in order. The book's four levels, which propagate
  automatically through RPC layers unless overridden:
  `CRITICAL_PLUS` (serious user-visible impact) → `CRITICAL` (default for serving) →
  `SHEDDABLE_PLUS` (default for batch) → `SHEDDABLE` (occasional full unavailability fine).
- **Exercise the degraded paths regularly.** Unused code paths fail when activated — the
  degraded mode you've never run is not a mitigation, it's a second outage waiting to start
  during the first.

## Client-side adaptive throttling

Let clients stop sending requests that will be rejected anyway. Over a 2-minute window track
`requests` (attempted by the app) and `accepts` (accepted by the backend). When
`requests > K × accepts`, reject locally with probability:

```
p(reject) = (requests − K × accepts) / requests
```

`K = 2` is the common value. Lowering K (e.g. 1.1) throttles more aggressively — at 1.1 the
backend sees roughly 1 rejection per 10 accepts.

## Per-customer quotas

Allocate capacity by negotiated agreement, in resource units
(e.g. premium clients 4,000 CPU-seconds/sec, standard 3,000, everyone else 500). Sum may
exceed total capacity — you're relying on them not all peaking together, which is usually
true and occasionally the reason for your outage. Know which bet you're making.

## Queue management

- Queue length should be **small relative to the thread pool — 50% or less**. Short queues
  reject early; long queues convert an error you could have handled into latency nobody can.
- Consider queueless servers, or **LIFO / CoDel**, which drop the requests least likely to
  still be wanted. Under overload, FIFO is the worst order: it serves the oldest requests,
  which are the ones whose clients have already left.

## Resource exhaustion — know which runs out first

CPU (longer queues → thread starvation → missed deadlines) · memory (task eviction, **GC
death spiral** where collection consumes the CPU needed for work) · threads (connection
failures, health-check timeouts) · file descriptors. These interact: one exhaustion triggers
the next. Identify your binding resource and saturate-test it (`sre-testing`).

## Where the resources moved **[supersedes]**

The exhaustion *mechanics* are unchanged; the resources have different names on managed and
serverless platforms:

| Book (2016) | Modern equivalent |
|---|---|
| Thread pool exhaustion | Concurrency limit / max in-flight invocations |
| File descriptor exhaustion | Connection pool caps, provider socket limits |
| Memory eviction, GC death spiral | OOM kill, container eviction (identical dynamics) |
| Slow startup and cold caches | **Cold starts** — the same chapter, one layer up |
| Machine capacity | Account quotas, per-region limits, rate limits |

Two additions:

- **The constrained resource is often now money** (`sre-cost`). Saturation against budget is
  a real saturation signal, and the only one with no natural backstop: the provider will
  keep selling you capacity after the system has stopped making economic sense.
- **Retry amplification is a cost multiplier as well as a load multiplier.** Against a
  metered dependency, 64 attempts bill even when all 64 fail.

## Agents as a load source **[extension]**

Agent traffic is not shaped like human traffic and breaks assumptions built on the latter:

- **No natural pacing.** A human retries a few times and gives up; an agent retries at
  machine speed until a limit stops it. Client-side throttling and retry budgets are
  therefore *enforced limits*, not conventions — a retry budget in a prompt is a suggestion.
- **Synchronised bursts.** Many agents triggered by the same event behave like the book's
  thundering herd with no jitter at all. Jitter must be applied by the tool, not requested
  in instructions.
- **Feedback loops between agents** — one agent's output triggering another's work — can
  sustain load indefinitely with no user behind it. Time-box them (`sre-agents`).
- **Criticality still works**: classify agent-originated traffic as `SHEDDABLE_PLUS` by
  default, so it is shed before user-facing requests.

## Startup and cold caches

A restarted or newly added server is *slower*, right when you need it fastest. Cold caches
mean expensive lookups; this is why "just add capacity" during a cascade sometimes makes
things worse. Mitigate: overprovision, ramp load gradually to warm caches, use an external
cache tier.

## Topology

**Always go downward in the stack.** Backends proxying to peers in the same layer creates
deadlock risk and propagates failure sideways. Let clients retry against the right backend.

## Load balancing

- **Lame duck state.** Let a backend announce it is shutting down before it becomes
  unavailable; clients redirect within 1–2 RTTs. This is what makes zero-error deploys possible.
- **Subsetting** — each client connects to 20–100 backends, typically 10–30% of the pool.
  Use **deterministic** subsetting, not random: with 300 clients and 300 backends at 10%,
  random subsetting gives the least-loaded backend ~50% of average load and the most-loaded
  ~150%. The variance is too large at scale.
- **Round Robin** spreads up to **2x** CPU between least- and most-loaded tasks — query costs
  vary by 1000x, machines differ, neighbours interfere.
- **Least-Loaded Round Robin** has a trap: a backend that fails *fast* looks idle and
  attracts everything. **Count recent errors as if they were active requests.** Even fixed,
  it still lands around 2x spread — active request count is a poor proxy for capability, and
  each client sees only its own slice of the traffic.
- **Weighted Round Robin** — backends return their own load metrics in responses, clients
  keep a capability score. This is the one to use at scale.
- **Monitor the CPU spread. If it exceeds 1.5x, the policy is wrong.**
- **DNS is not a load balancer.** You see the resolver, not the user; TTL caching means one
  reply may serve one user or thousands; RFC 1035's 512-byte limit caps how many addresses
  you can return. Use it for coarse distribution, then balance properly at the VIP layer
  with **consistent hashing** so connections survive backend churn.

## Test for it

- **Load test to failure**, both gradually and suddenly. Record the breaking point, the
  behaviour past it, and — critically — **whether it recovers on its own when load drops.**
  A system that needs manual intervention to exit overload will need it at 3am.
- **Test with realistic traffic**; synthetic load misses the shape of real queries.
- **Test your biggest clients' failure behaviour** — do they queue work offline and stampede
  on recovery?
- **Test noncritical backends**: confirm that an unavailable non-essential dependency
  doesn't consume resources, especially with long deadlines. Blackhole it and watch.
- Plan **N+2** capacity against known breaking points.

## Triggers worth knowing

Process death · simultaneous binary updates · a rollout changing the request profile ·
organic growth · maintenance drains · load-balancing changes shifting request mix ·
resource-limit changes or loss of slack CPU.
