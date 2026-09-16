---
name: sre-data-integrity
description: "Protect data from loss and corruption, and build the stateful pieces correctly. Use when designing backups, retention, deletion or recovery; when asked 'are we backed up?'; after data loss or corruption; when implementing leader election, distributed locking or anything needing consensus; and when building cron jobs or data pipelines. Covers defense-in-depth layers, restore testing, consensus deployment, and idempotent scheduling."
---

# /sre-data-integrity

From SRE Book Ch. 23 (Managing Critical State), Ch. 24 (Distributed Periodic Scheduling),
Ch. 25 (Data Processing Pipelines), Ch. 26 (Data Integrity).

---

# Part 1 — Data integrity

**Definition:** the accessibility *and* accuracy of the data needed to provide adequate
service. Note the conjunction — **data you cannot reach is data you have lost**, from the
only perspective that counts. Perfect data in an unrestorable backup is not integrity.

**The reframe that changes behaviour:**
> "No one really *wants* to make backups; what people really want are **restores**."

So the metric is never "do we have backups." It is **"when did we last successfully restore,
and how long did it take?"**

## Where data loss comes from

Three independent dimensions, 24 combinations:

- **Root cause** — user action, operator error, application bug, infrastructure defect,
  faulty hardware, site catastrophe
- **Scope** — widespread vs narrow/targeted
- **Rate** — sudden ("big bang") vs gradual ("creeping")

Google's finding: **most user-visible data loss came from software bugs** causing deletion
or referential-integrity failure, **often discovered weeks or months later.** Design for
that case — slow, quiet, bug-driven corruption found long after the fact — not for the
dramatic datacenter fire. Your backup retention must outlive your detection latency.

## Backups vs archives — not the same thing

- **Backup** — can be *loaded back into the application*. Exists to restore service.
- **Archive** — preserved for compliance/audit. Nobody has checked it loads.

If it has never been restored, you have an archive, whatever you call it.

## Defense in depth: three layers

### Layer 1 — Soft deletion
Mark deleted data inaccessible but retain it. **15–60 days**, set from your incident
detection window. (Google found most account-hijacking cases surface within 60 days.)
Protects against user accident, developer error — especially batch deletion pipelines —
and account compromise. This layer catches the largest number of incidents for the least
engineering.

### Layer 2 — Backups and recovery
Tiered, trading freshness against durability:

| Tier | Frequency | Retention | Restore time |
|---|---|---|---|
| 1 | Snapshots hours apart, local | Days | Minutes |
| 2 | Full/incremental every ~2 days | Days to low tens of days | Hours |
| 3 | Nearline/offline, offsite | Longest | Longest — survives site loss |

- **Retention must exceed your deployment cadence.** Deploy twice a week → retain at least
  1–2 weeks, so a bug shipped last Tuesday is still recoverable.
- **Replication ≠ recoverability.** Synchronous replication faithfully copies your corruption
  to every replica, usually before anyone notices. Replicas protect against hardware; only
  backups protect against software.
- **Diversify storage technology and location.** A bug or a failure mode in one storage
  system should not be able to take every copy.

### Layer 3 — Early detection: out-of-band validators
Continuous jobs that check consistency *within* and *between* datastores, independently of
the application. This is the layer that catches creeping corruption.

- Target **detection within 24 hours** of low-grade corruption.
- Some inconsistency classes can be auto-remediated (Google Drive's validators fix
  file/folder misalignment); **report rather than repair when confidence is low.**
- Validators need real support: monitoring, dashboards, playbooks, an owner. An unmaintained
  validator becomes an ignored alert, which is worse than no validator.
- **[extension]** at small scale this is a scheduled consistency-check job with an alert —
  foreign-key orphans, aggregate drift, row-count anomalies, spike-in-deletions detection.

## What changed since 2016 **[supersedes]**

**The tier table above is now about *recovery speed and blast radius*, not about money.**
Storage is cheap enough that "keep more copies" is rarely the binding decision, and tape has
been replaced by cold object storage. Keep the tiering logic, drop the economics.

**Retention is now bounded by law, not by cost.** The book sets soft-delete windows from
detection latency (15–60 days). That floor still applies — but there is now a *ceiling* from
deletion obligations and data-protection regimes, and "keep everything forever" collides
directly with "prove you deleted it." Retention is a two-sided constraint; state both sides.

**Replication got cheaper, which made the replication trap more tempting.** Cross-region
replication is a checkbox now, and it still does not protect against software. It faithfully
copies corruption to every replica, usually before anyone notices. **[extension]**

## Agents are a new root cause, at machine speed **[extension]**

The book's root-cause list — user action, operator error, application bug, infrastructure
defect, hardware, site catastrophe — needs an entry. An agent with write access is an
*operator*, with the error profile of software and the authority of a person.

This does not need new doctrine; it needs the existing doctrine enforced harder:

- **Soft deletion is the highest-value layer here.** It is the one that turns a confident
  wrong deletion into an inconvenience.
- **Sanity-check semantics**: an empty filter means *nothing*, never *everything* — the
  book's Diskerase lesson, now a plausible one-line mistake (`sre-agents`).
- **Rate-limit destructive operations** so a wrong decision is survivable.
- Recall the book's finding that most real data loss came from **software bugs causing
  deletion, discovered weeks or months later**. Agent-originated loss fits that profile
  exactly, which makes the out-of-band validators in layer 3 the detection mechanism that
  matters most.

## Principles

- **Trust but verify.** Don't assume any API is bug-free, however well tested. Validate
  critical data with an independent check.
- **Hope is not a strategy.** Untested components fail. Continuous *automated* recovery
  testing is the only evidence that recovery works; manual testing does not scale and
  does not happen.
- **Testing is mandatory.** "You only know that you can recover your recent state if you
  actually do so." Restores belong in CI, on a schedule, with alerting when they fail.
- **Rehearse.** Both book case studies — Gmail's 2011 tape recovery of 1.5+ PB, and Google
  Music's 2012 runaway deletion (1.5 PB, 5,000+ tapes, 7 days) — succeeded because a DR
  exercise had been run shortly beforehand. The rehearsal was the difference between a
  catastrophe and an inconvenience.

**Ask on any stateful system:** What's the soft-delete window? Where are the backups, on
what different technology? When did a restore last succeed, and how long did it take? What
would detect silent corruption, and how fast?

---

# Part 2 — Critical state and consensus

> "Whenever you see leader election, critical shared state, or distributed locking, think
> about distributed consensus: any lesser approach is a ticking bomb."

**Do not build it yourself.** Leader election via heartbeats and timeouts is a reformulation
of distributed asynchronous consensus, and **it cannot be solved correctly with timeouts.**
When the network is slow or lossy, two nodes both believe they lead — split brain — and you
get either corruption or total unavailability. Gossip and heartbeat schemes reliably produce
"subtle and hard-to-fix data consistency problems."

Use Paxos, Raft, or Zab — via an existing implementation.

## Patterns

- **Replicated state machine** — same operations, same order, across processes. The
  foundation for everything else; any deterministic program becomes HA this way.
- **Replicated datastore / config store** — consistency in the critical path; read
  optimisations depend on whether you need strong or eventual consistency.
- **Leader election** — write the service as a single-process program, replicate it, use
  consensus to ensure one leader. HA without redesigning your business logic.
- **Distributed locking** — **use leases with timeouts, never indefinite locks**, so a
  crashed holder cannot block forever.
- **Reliable queuing / atomic broadcast** — implement the queue as a replicated state
  machine, or losing the queue disables the system.

## Deployment

- **5 replicas is the standard.** 3 tolerates one failure but leaves no margin during
  maintenance; 5 tolerates two — one down for maintenance *plus* one unplanned. Fewer than
  3 is not fault tolerance.
- **Majority quorums must overlap** (2f+1). **Losing quorum can be unrecoverable** —
  treat it as the thing you never allow.
- **Spread across failure domains**, and pay attention to latency: ~1ms within a datacenter,
  ~45ms US coast-to-coast, ~70ms NYC–London. These land directly in your write latency.
- **Placement traps:** two replicas in one datacenter costs you quorum redundancy when it
  fails. All leaders in one region means a simultaneous mass failover that overwhelms
  everything else. **Distribute leaders deliberately.**
- **Overlapping quorums** for wide-area: 5 replicas as 2 central US + 1 east coast +
  2 Europe lets quorums form regionally most of the time. For extreme cases, hierarchical
  quorums — 9 replicas in 3 groups, majority of groups and majority within each.
- **Scale reads** with more replicas or quorum leases (trading write performance for
  low-latency local reads); **scale writes** by sharding into independent consensus groups,
  remembering each shard multiplies replica cost.

**Monitor:** healthy replicas per group · leader existence (no leader = unavailable) ·
**leader change rate** (flapping means network trouble) · monotonically increasing consensus
transaction number (stagnation = no progress) · proposals vs agreements (mismatch = protocol
violation) · proposal acceptance latency *distribution* · inter-replica network latency ·
disk write time · **lagging replicas** (they don't count toward quorum until caught up, so
a lagging replica is a silently reduced fault tolerance).

---

# Part 3 — Cron and scheduled jobs

- **Know whether each job is idempotent.** Garbage collection can run twice; payroll cannot.
  The handling strategy follows from this, so decide it explicitly per job.
- **Favour skipping over double-firing.** A missed run is detectable and recoverable;
  an unsendable-twice email is not. **Fail closed.**
- **Monitor your own jobs.** Infrastructure won't guarantee exactly-once, so job owners must
  alert on skipped runs and act. Alert on "didn't run," not just "ran and failed" — silence
  is the failure mode people forget to monitor.
- **Put the scheduled launch time in the job name.** It disambiguates runs when a failover
  happens between completion and state propagation.
- **Inform a quorum synchronously before and after each launch** if you're building the
  scheduler. Asynchronous notification loses the record of completed work across failover.
- **For safe recovery after a leader failure, you need at least one of:** external operations
  are idempotent, **or** you can query the external system to find out whether the work
  completed. If neither holds, you cannot recover safely — fix that first.
- **Spread scheduled load.** Everyone picks midnight. Allow a range and hash the job into a
  window so 30 teams' daily jobs don't fire simultaneously. Then provision for the spikes
  that remain, because temporal dependencies make some unavoidable.

---

# Part 4 — Data pipelines

**Periodic batch pipelines degrade badly with growth.** The failure modes, all of which
appear only at scale:

- **Uneven work distribution / hanging chunks** — partition by customer and one large
  customer blocks the pipeline. Without checkpointing, killing and restarting throws away
  all prior computation.
- **Scheduling pressure** — batch jobs run at low priority and get preempted. As frequency
  rises, delays cause jobs to overlap and stack; below a certain interval, increasing
  frequency produces *less* throughput, not more.
- **Monitoring gaps** — metrics collected only during runs and reported only on completion.
  A failed job reports nothing at all, exactly when you need data.
- **Thundering herd** — thousands of workers starting at once overwhelm shared
  infrastructure. Poor retry logic compounds it, and the instinctive fix (add more workers)
  amplifies the overload.
- **Moiré load pattern** — independent pipelines whose schedules drift into phase,
  periodically colliding on a shared resource. Visible only on stacked resource graphs,
  which is why it goes undiagnosed for months.

**Remedies:**

- **Prefer continuous processing** to periodic batch where you can.
- **Make stages hermetic and idempotent**, and **checkpoint** so a restart resumes rather
  than restarts.
- **Unique output naming per attempt**, so a retry cannot collide with its own earlier run.
- **Validate worker leases before committing work** — a worker whose lease expired must not
  write.
- **Verify the coordinator's identity on every operation** (server tokens), so a stale
  leader cannot issue commands.
- **Journal state durably** and run a global coordinator with heartbeat-based failover for
  business continuity.
- **Jitter and stagger** worker starts and retries (`sre-overload`).
