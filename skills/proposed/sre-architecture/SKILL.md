---
name: sre-architecture
description: "Design-time system structure: failure domains, dependency direction, where state lives, degradation paths, and which problems require consensus. Use when designing a new service or system, reviewing an architecture or design doc, choosing between stateful and stateless approaches, deciding how components depend on each other, planning for partial failure, or when asked 'will this scale / survive?'. Decides structure; sre-overload handles the runtime tactics."
---

# /sre-architecture

From SRE Book Ch. 19–26, read as design decisions rather than operational tactics.

Division of labour: **this skill decides the shape.** `sre-overload` tunes the runtime knobs
(retry budgets, deadlines, shedding thresholds), `sre-code` covers the code itself, and
`sre-data-integrity` covers protecting the data once you've decided where it lives.

## The design question behind all of it

**What happens when each part of this is slow, wrong, or gone — and is the resulting
behaviour something I chose, or something I'll discover?**

Every principle below is a way of making that answer designed rather than emergent.

## 1. Dependency direction: always go downward

**Calls flow down the stack. Never sideways.**

Backends that call peers in their own layer create deadlock risk and propagate failure
laterally — a single slow instance becomes a whole-layer stall. If two components at the same
level need each other's work, either the caller belongs a layer up, or they should be one
component.

When a client needs a different backend, let the *client* retry against the right one rather
than having backends proxy for each other.

## 2. Draw the failure domains explicitly

For each component, name what takes it out, and check the blast radius is what you intended:

- What single failure removes more than one replica?
- Which components share a fate — same host, same zone, same dependency, same config push,
  same deploy?
- **Does any "redundant" pair share a hidden failure domain?** This is the most common
  architectural self-deception: two replicas behind one config source, one storage system,
  or one deployment pipeline.

Design target for anything that matters: **N+2** — one unit down for maintenance, plus one
unplanned failure, and you're still serving.

## 3. Decide the degradation path at design time

A system without a designed degraded mode has one anyway; it's called "falling over."

- What does this return when its primary dependency is unavailable? Cached data? Partial
  results? A cheaper algorithm? An honest error?
- **Rank dependencies by criticality**, and make that ranking a real property of the request
  (the book's four levels: `CRITICAL_PLUS` → `CRITICAL` → `SHEDDABLE_PLUS` → `SHEDDABLE`),
  propagating automatically through call layers.
- **Non-critical dependencies must be failable.** Explicitly design so an unavailable
  nice-to-have consumes no resources and blocks nothing — especially with long deadlines.
  Then test it by blackholing that dependency (`sre-testing`).
- **The degraded path must be exercised routinely.** Unused code paths fail when activated.
  A degraded mode you've never run is not a mitigation; it's a second outage that starts
  during the first.

## 4. Capacity is a resource question, not a QPS question

Design your capacity model around **actual resource consumption (usually CPU)**, not request
counts. Query cost varies by client, time of day, and software version, and the ratio drifts.
An architecture whose scaling story is "requests per second" has an unstated assumption that
will quietly stop being true.

Related design consequence: **systems do not degrade linearly.** Caches make them look great
below capacity and they fall off a cliff near it. Know where your cliff is before you design
around the plateau.

## 5. State: put it in as few places as possible

Statelessness is the cheapest reliability property available. For each piece of state, ask
in order:

1. **Can this be derived instead of stored?**
2. **Can it live in one existing store** rather than a new one?
3. **Does it need to be strongly consistent, or is eventual fine?**
4. **Only then**: does it need consensus?

Every new stateful component adds backup, restore, corruption, capacity, and failover
concerns that a stateless one simply doesn't have.

## 6. Some problems require consensus — and you cannot fake them

> "Whenever you see leader election, critical shared state, or distributed locking, think
> about distributed consensus: any lesser approach is a ticking bomb."

**Leader election via heartbeats and timeouts cannot be made correct.** It is a reformulation
of distributed asynchronous consensus, which timeouts do not solve. Under a slow or lossy
network, two nodes both believe they lead — split brain — and you get corruption or total
unavailability. Gossip and heartbeat schemes reliably produce "subtle and hard-to-fix data
consistency problems."

If your design contains any of these, it needs a real consensus implementation
(Paxos / Raft / Zab), not one you wrote:

- electing a leader or primary
- a lock held across processes
- a queue whose loss would disable the system
- any state two processes must agree on to stay correct

The patterns to reach for: **replicated state machine** (the foundation — any deterministic
program becomes HA), **replicated datastore**, **leader election** (write it as a
single-process program, replicate it, let consensus pick the one that runs), **leases with
timeouts** — never indefinite locks — and **replicated queues**.

Sizing and placement live in `sre-data-integrity`; the architectural point is simply:
**recognise the problem class, and don't hand-roll it.**

## 7. Prefer continuous to periodic

Periodic batch pipelines degrade badly with growth, in ways that only appear at scale:

- **Uneven partitioning / hanging chunks** — one large partition blocks everything; without
  checkpointing, a restart discards all prior work
- **Scheduling pressure** — below a certain interval, running *more often* produces *less*
  throughput, as jobs overlap and stack
- **Monitoring blindness** — metrics collected only during runs; a failed job reports nothing,
  exactly when you need data
- **Thundering herd** — thousands of workers starting at once; the instinctive fix (add
  workers) amplifies it
- **Moiré load pattern** — independent schedules drifting into phase and periodically
  colliding on a shared resource. Visible only on stacked resource graphs, which is why it
  goes undiagnosed for months

If you must be periodic: make stages **hermetic and idempotent**, **checkpoint** so restarts
resume, use **unique output names per attempt**, **validate the worker's lease before
committing**, and **jitter the start times**.

## 8. Design for the herd, not the request

Anything that many clients do on a schedule will happen simultaneously unless you prevent it.

- **Jitter every automatic action** — polls, retries, refreshes, cron. Everyone picks
  midnight; hash jobs into a window instead.
- **Retry at exactly one layer.** The arithmetic that kills systems:
  **4 layers × 3 retries = 64 attempts** for one user request.
- **Keep client behaviour server-controllable** — sync frequency, retry parameters, feature
  enablement pushed as config, so you can change client behaviour without a client release
  you don't control.

## 9. Choose the load-balancing layer deliberately

- **DNS is not a load balancer.** You see the resolver, not the user; TTL caching means one
  reply may serve one user or thousands; the 512-byte limit caps returnable addresses.
  Use it for coarse distribution only.
- Balance properly at the VIP layer, with **consistent hashing** so connections survive
  backend churn.
- **Design in a lame-duck state** — a backend announces it is going away before it becomes
  unavailable, and clients redirect within 1–2 RTTs. This is what makes zero-error deploys
  possible, and it must be built into the protocol, not bolted on.
- Expect **Round Robin to spread CPU by up to 2x**; plan to move to load-aware
  (weighted) balancing at scale.

## 9b. Treat dependencies as a portfolio you cannot page **[extension]**

The book assumes the thing that broke is yours to fix. Increasingly it is not: auth,
payments, CDN, mail, telemetry, feature flags, model APIs. **Your availability is a product
of vendors you have no authority over**, and the dominant incident is now "a provider is
degraded," where troubleshooting is unavailable as a lever (`sre-incident`).

This raises the value of a rule already stated above — *non-critical dependencies must be
failable* — from good practice to the primary defence. For each external dependency, decide
at design time:

- **Critical or failable?** If critical, its availability is multiplied into yours: state
  that arithmetic explicitly in your SLO rather than discovering it (`sre-slo`).
- **What is the degraded behaviour** when it is slow, wrong, or gone — and is that path
  exercised?
- **Is there a second provider, and is the abstraction honest enough to switch?** An adapter
  written against one vendor's semantics is not portability.
- **Which budget does its failure burn?** Inherited burn needs a different response from
  self-inflicted burn (`sre-slo`).
- **Is it metered?** A metered dependency behind a retry loop is a cost failure as well as a
  reliability one (`sre-cost`).

## 9c. Control planes converge at machine speed **[extension]**

Everyone now runs a declarative control plane — the descendant of the book's Borg — and most
teams run one they do not fully understand. The consequence is specific: **a bad desired
state converges globally, fast.** The book's Diskerase lesson (automation treating an empty
set as "everything") is now reachable by a one-line manifest error.

Design implications: stage changes to desired state as you would code (`sre-release`) ·
require sanity checks on any operation whose scope is computed rather than written ·
ensure a human-reachable brake exists that does not depend on the control plane being
healthy.

## 10. Build for diagnosis

An architecture is also a debugging surface. Require, at design time: a **request ID
propagated across every hop** · observable interfaces between components · per-component
white-box metrics · change tracking at every layer. These are architectural commitments —
you cannot add cross-service request correlation to a running incident.

## Design review checklist

- [ ] Do all calls flow downward? Any same-layer dependencies?
- [ ] For each dependency: what happens when it's slow / wrong / gone? Chosen, or emergent?
- [ ] Do any "redundant" components share a hidden failure domain?
- [ ] Is there a designed degraded mode, and is it exercised?
- [ ] Are non-critical dependencies genuinely failable?
- [ ] Is capacity modelled in resources, not QPS? Where is the cliff?
- [ ] What state exists, why can't it be derived, and does it need consensus?
- [ ] Is anything doing leader election / distributed locking by hand?
- [ ] Is anything periodic that should be continuous?
- [ ] Is every automatic client action jittered?
- [ ] Is retry confined to one layer?
- [ ] Can a request be traced end to end?
