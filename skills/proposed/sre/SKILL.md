---
name: sre
description: "Router and foundations for the SRE skill family — Google's SRE Book, updated for 2026 and extended to agents. Use when a reliability question spans more than one area, when you don't know which sre-* skill applies, when asking what SRE practice says about something generally, or when deciding how much reliability ceremony a project actually warrants. Carries error and cost budgets, the enforcement-mechanism argument, and what the original book got wrong."
---

# /sre

The Google SRE Book (O'Reilly, 2016) converted into executable procedures, then updated
for the decade that followed and extended to systems where **agents are operators**.
Each `sre-*` skill runs a procedure and produces an artifact. None are book summaries.

## Read the book as two halves

**Half one is about Google's 2016 constraints** — machines are scarce, storage is expensive,
you must build your own scheduler, your own consensus, your own rollout system. Largely
obsolete, and dangerous where it's still quoted verbatim.

**Half two is about how failure propagates through systems of interacting parts** — retry
amplification, deadline propagation, cascading overload, defense in depth, symptom versus
cause. Technology-independent, which is why it survived a decade that replaced everything
underneath it. It survives agents too.

The trap is reading the surviving half as timeless wisdom without noticing the first half
rotting inside it. Every skill in this family marks which half it's drawing on.

## The load-bearing update: scarcity used to enforce this

**Many SRE practices were enforced by a cost that has since disappeared. The practice was
right for reasons deeper than the cost — but the enforcement mechanism is gone, so it now
has to become deliberate policy or it simply stops happening.**

| Practice | Was enforced by | Now |
|---|---|---|
| Low cardinality; delete unused signals | Storage and query cost | Free to hoard → nobody knows what matters |
| Small dependency surface | Cost of building it yourself | One signup → availability is a product of vendors you cannot page |
| Deleting dead config and flags | Maintenance pain | Tolerable forever → the state space grows silently |
| Capping toil | Human attrition and morale | Agents absorb it → O(n) becomes a quietly growing bill |
| Few SLOs | The pain of measuring anything | Trivial to measure → dashboards nobody reads |

Scarcity was an unpaid disciplinarian. It quit. Where a skill says "delete this," that
instruction is **more** load-bearing now than when it was written, not less.

## Route by situation

**Design-time** — you are building it. Cheapest place to fix anything.

| The situation | Skill |
|---|---|
| Writing or reviewing code, an API, or prompts / agent instructions | `sre-code` |
| Designing or reviewing a system / failure domains / where state lives | `sre-architecture` |
| What to test, how much, evals, and what only production can tell you | `sre-testing` |

**Runtime** — it exists and has users.

| The situation | Skill |
|---|---|
| "How reliable should this be?" / targets / error budget math | `sre-slo` |
| Metrics, dashboards, alerts / "why is this pager so noisy?" | `sre-monitoring` |
| Shipping, launching, rolling out, canarying | `sre-release` |
| Something is broken **right now** | `sre-incident` |
| The outage is over / writing it up / tracking recurrence | `sre-postmortem` |
| Falls over under load / retries / timeouts / cascading failure | `sre-overload` |
| Backups, restores, corruption, consensus, cron, pipelines | `sre-data-integrity` |
| Repetitive manual work / on-call load / interrupts / automation | `sre-toil` |

**Cross-cutting** — the two dimensions the original book has no chapter for.

| The situation | Skill |
|---|---|
| Agents with production access / agent-driven change / agent failure modes | `sre-agents` |
| Spend, quotas, rate limits, concurrency caps, runaway autoscale | `sre-cost` |

Common orders:

- **New service**: `sre-architecture` → `sre-code` → `sre-testing` → `sre-slo` →
  `sre-monitoring` → `sre-cost` → `sre-release`
- **Existing service hurting**: `sre-toil` (measure) → `sre-monitoring` (quiet the pager) →
  `sre-slo` (set the bar)
- **After an outage**: `sre-incident` → `sre-postmortem` → whichever design skill the cause names
- **Giving an agent production access**: `sre-agents` → `sre-cost` → `sre-toil`

Boundaries between the closest pairs: **`sre-architecture` decides the shape**
(dependency direction, failure domains, whether you need consensus); **`sre-overload` tunes
the runtime knobs** on a shape already chosen. **`sre-slo` budgets correctness and
availability; `sre-cost` budgets spend** — same mechanic, different resource.

## The tenets

**1. 100% is the wrong reliability target for basically everything.** Pick the target from
user need and cost. The gap between target and 100% is the **error budget**, and it exists
to be *spent* — on launches, experiments, risk. This converts "move fast" versus "stay up"
from a political argument into an arithmetic one. Nobody has to win the argument.

**2. There is now a second budget, and it is the one that actually bites.** Compute and
storage became elastic, so the binding constraint moved from *capacity* to *spend*. A
runaway autoscale or a looping agent is a financial outage: silent, unbounded, and with no
equivalent of "stop shipping." Run a **cost budget** with the same mechanic as the error
budget. See `sre-cost`. **[extension]**

**3. Detection is the bottleneck now, not repair.** The book already argued MTTR is cheaper
to improve than MTTF. With one-button rollback and feature flags, MTTR collapsed — so
**time-to-detect is now a first-class SLI**, and it deserves more attention than the book
gives it. The book spends far more pages on response than on noticing. Invert that ratio.

**4. Exactly three valid outputs of monitoring.** **Alerts** (a human acts now), **tickets**
(a human acts later), **logging** (nobody acts; it exists for diagnosis). Email alerts are
not a fourth category, they are a failure mode.

**5. ~70% of outages are caused by a change to a live system** — which is why change
management is the highest-leverage reliability work. **Agents raise change rate by an order
of magnitude, and that arithmetic only works if detection and rollback improve
proportionally.** Otherwise agent velocity is a faster route to the same incidents.

**6. A documented playbook is worth roughly a 3x improvement in MTTR** over improvisation.
The single best-measured intervention in the book. It is also now the interface an agent
reads, which roughly doubles its value.

**7. Toil is a tax that compounds** — manual, repetitive, automatable, tactical, devoid of
enduring value, O(n) with growth. Its cost used to be paid in human attrition, which
enforced the 50% cap automatically. Agents pay it in tokens instead, so **the cap must now
be stated explicitly or it stops binding.** See `sre-toil`.

## What the original gets wrong, explicitly

Where a skill supersedes the book, it says so. The main corrections:

- **Storage-cost advice is obsolete.** Bucket-granularity tricks, per-minute aggregation to
  save money, backup tiers built around tape. Keep the *retention reasoning*, drop the
  economics. Retention is now bounded by law, not by cost (`sre-data-integrity`).
- **Capacity planning has become limits engineering.** You are not bin-packing cores; you
  are placing bounds on things that can scale to infinity (`sre-cost`).
- **The error budget assumed you control the numerator.** With heavy vendor dependency, much
  of your budget is spent by people you cannot page. Split **self-inflicted** from
  **inherited** burn; they demand different responses (`sre-slo`).
- **Troubleshooting assumes reproducibility.** Bisection — the book's sharpest technique —
  degrades badly against nondeterministic systems. There is no clean replacement yet; say so
  rather than pretending (`sre-incident`).
- **"Blameless" rests on protecting humans from blame.** That justification does not transfer
  to agents, though the practice still does, for a weaker reason (`sre-postmortem`).
- **Root-causing is often worthless now.** The dominant incident is "a vendor is degraded,"
  where the only lever is a degradation path designed months earlier (`sre-architecture`).

## Agents are participants, not a special case

The book was written for human operators and never mentions agents. It nevertheless wrote
the agent-safety specification in 2016 and didn't know it: Ch. 7's four requirements for
destructive automation — **rate-limit destructive operations, idempotent workflows, sanity
checks on semantics, comprehensive audit logging** — are, almost exactly, the agent
permission model. It derived them from a script that erased the wrong disks.

Where the mapping is exact, these skills just apply it. Where it inverts, `sre-agents`
says how and why. The default assumption throughout this family is that **the reader and
the operator may both be agents**, which mostly means: instrument for a reader with no
institutional memory, and write playbooks as interfaces rather than as prose.

## The delivery half: DORA

`sre-*` measures the **running** system. [`dora`](../dora/SKILL.md) and
[`dora-capabilities`](../dora-capabilities/SKILL.md) measure the **delivery** system that
produces it, from DORA's research program. Use them when the question is about how the team
ships rather than how the service behaves.

The seams are exact: change fail rate is error-budget burn counted from the other side ·
failed-deployment recovery time is MTTR · deployment rework rate is toil viewed from
delivery. And the gap matters — **DORA does not measure time-to-detect**, which gates
recovery time, so pair the two sets rather than picking one.

Both frameworks independently converge on the same two practices — **working in small
batches** and **test automation** — which is decent evidence they are load-bearing.

## Scaling this down

Most systems are not Google's. Scale the ceremony, keep the reasoning:

- A one-person project still benefits from **a stated SLO**, **symptom-based alerts**, **a
  tested restore**, **a rollback path**, and — if an agent can touch production — **a spend
  cap**. Those five are close to free.
- Incident command roles, launch coordination, and consensus deployment topology are for
  systems with real users and more than one responder. Don't cargo-cult them onto a side project.
- When you skip a practice, skip it *knowingly* and say why.

## Provenance

Each skill cites its chapters. Numbers, formulas, and thresholds are the book's actual
values. Material that postdates the book or corrects it is marked **[extension]** or
**[supersedes]**, so you can always tell distilled from added.

**Layers so far:** `sre-*` covers reliability; `dora*` covers delivery performance and the
capabilities that drive it. Still missing, and worth adding: the *practice* layer — XP,
continuous delivery, small batches integrated often — which is what actually moves the DORA
capabilities, and an *outcome* layer, since neither framework measures whether the thing
being shipped was worth building.
