---
name: sre-toil
description: "Identify toil, decide what to automate, and keep operational load sustainable. Use when work feels repetitive or manual, when deciding whether to automate something, when on-call is painful or the pager is noisy, when someone is drowning in interrupts and tickets, or when planning what operational work to eliminate. Produces a toil ledger with an automation decision per item. Also carries the on-call health rules."
---

# /sre-toil

From SRE Book Ch. 5 (Eliminating Toil), Ch. 7 (Automation), Ch. 11 (Being On-Call),
Ch. 29 (Dealing with Interrupts).

## What toil actually is

Work tied to running a production service that is **manual, repetitive, automatable,
tactical, devoid of enduring value, and O(n) with service growth.** Six properties:

1. **Manual** — human hands-on time, *including running a script by hand*
2. **Repetitive** — done over and over; not novel problem-solving
3. **Automatable** — a machine could do it, or it could be designed away entirely
4. **Tactical** — interrupt-driven and reactive, not strategy-driven
5. **No enduring value** — the service is in the same state afterwards as before
6. **O(n)** — grows linearly with traffic, users, or size

The last one is the one that matters most. Toil scales your headcount with your traffic.
Everything else is a symptom of that.

## What is *not* toil

- **Overhead** — meetings, HR, reviews, planning. Not toil; it's the cost of employment.
  Don't inflate the toil number with it, or the number stops being actionable.
- **Grungy work with lasting value** — cleaning up a config system is unpleasant and
  permanent. Not toil.
- **Work that requires judgement each time.** Repetition is necessary but not sufficient.

## The 50% rule

**Operational work stays below 50% of time per person.** At least half goes to engineering
that reduces future toil. Google's measured reality: **average 33%, range 0–80%** — the goal
is a ceiling that triggers action, not a fiction that everyone is at 33%.

There is an irreducible floor from on-call alone:
- **6-person rotation** → minimum **33%** toil (2 weeks on-call per 6-week cycle)
- **8-person rotation** → minimum **25%**

So a small team is *structurally* closer to the cap before doing anything else. If you're a
6-person rotation, you have 17 points of headroom, not 50.

**When the cap is breached, the excess goes back to whoever generates it** — the dev team.
This isn't punishment; it's the feedback loop. Unreliability must be expensive for the people
who can fix it, or it never gets fixed.

## Why it's worth fighting

Career stagnation · burnout and attrition of your best people · confusion about what the
role is · slowed feature velocity · a precedent that ops work can be shovelled sideways ·
broken promises to new hires. Toil doesn't just cost the hours it takes; it costs the people.

## Procedure: the toil ledger

1. **Measure before arguing.** Log operational work for 2–4 weeks: task, time,
   trigger, frequency. Everyone guesses wrong about their own ratio.
2. **Classify** each item against the six properties. Anything hitting 4+ is toil.
3. **Compute the ratio.** Toil hours / total hours, per person and for the team.
4. **Rank by `frequency × time × growth rate`** — not by annoyance. The task that irritates
   most is rarely the one that costs most.
5. **Choose a response per item** (below).
6. **Re-measure quarterly.** The ratio is a trend line, not a snapshot.

## Response options, in preference order

**Eliminate** — why does this task exist at all? The best automation is a deleted
requirement. Ask this first, every time; it's the option people skip.

**Design away** — change the system so the task is structurally impossible or unnecessary.

**Make it autonomous** — the system handles it without being told. This is the real target:

> **Autonomy beats automation.** Don't replace a manual action with a script; build a
> system that needs neither. The book's cluster-management arc is exactly this — initial
> automation bought enough time to make the problem *go away*, by treating it as a software
> problem rather than an operations problem.

**Automate** — script it, own it, test it.

**Absorb** — accept it, with an explicit review date. A legitimate answer for genuinely rare
work; illegitimate as a default.

## The cap lost its enforcement mechanism **[extension]**

The 50% rule was never enforced by policy. It was enforced by **human attrition** — toil
above the cap burned people out, they left, and the cost became unignorable. That feedback
loop is what made the number real.

Agents absorb toil without burning out, quitting, or complaining. So:

- **The forcing function is gone. The reason for the cap is not.** O(n) work still scales
  with the service; it now scales into a quietly growing bill rather than a quietly departing
  team (`sre-cost`). Unbounded absorbed toil is the same structural problem with a slower,
  less visible alarm.
- **State the cap explicitly, or it stops binding.** Measure the ratio deliberately. Nothing
  in the environment will surface a breach for you any more.
- **"Automatable" now catches far more work than it did in 2016.** More of what you do
  qualifies as toil under the book's own six tests — which means the ledger gets longer, not
  shorter, and triage by `frequency × time × growth` matters more.
- **Absorbing toil with an agent is a legitimate response — and it is not elimination.**
  It is the *Automate* rung with the cost moved from hours to tokens. Record it as absorbed,
  not solved, and keep it on the ledger with a review date. Toil paid for in tokens is still
  toil, and it still scales with the service.
- **Ask the elimination question first anyway.** The best automation remains a deleted
  requirement. Cheap absorption makes it much easier to skip that question, which is exactly
  why it should be asked first.

## The automation ladder

Know which rung you're on and which you're climbing to:

1. No automation — manual failover, hands on keyboard
2. Externally maintained, system-specific automation — someone's personal script
3. Externally maintained generic automation — a shared tool
4. **Internally maintained, system-specific automation — built into the product itself**
5. **Autonomous systems needing no human intervention**

Ownership moves toward the team that owns the system as you climb, which is what keeps the
automation competent and relevant. Automation owned by a team with no stake in the outcome
rots — the book's turnup team is the cautionary case: nobody had an incentive to reduce the
underlying technical debt.

## What automation buys

**Consistency** (machines don't vary; humans always do) · **a platform** (a bug fixed in
code is fixed once and forever, everywhere) · **faster repair** (lower MTTR) ·
**faster action** (machines react at machine speed) · **time saved**, multiplied across
everyone who uses it.

## Automation safety — non-negotiable

Automation amplifies competence *and* mistakes, at machine speed. The book's Diskerase
incident: decommissioning automation treated an **empty input set as "everything"** and sent
nearly all CDN machines for disk erasure within minutes.

Every destructive automation needs:

- **Sanity checks on semantics** — an empty list means *nothing*, never *all*. Refuse
  suspiciously large operations and require explicit confirmation.
- **Rate limiting** on destructive operations, so a bug has time to be noticed.
- **Idempotent workflows**, so partial execution doesn't leave corrupt state.
- **Comprehensive audit logging** of every automated action.
- **Transparent internal operation** — expose what it's doing, so humans keep an accurate
  mental model. Highly effective automation lulls operators into inattention; they must be
  able to see it working to stay able to reason about it when it stops.

## Agent operators and the ladder **[extension]**

The ladder's top rung — *autonomous systems needing no human intervention* — was written for
deterministic automation. Agents add a rung the book could not describe:

**6. Delegated judgment** — the system handles cases nobody enumerated in advance.

The book's warnings apply with more force at rung 6, not less. **Automation amplifies
competence and failure alike, at machine speed**, and its four safety requirements —
sanity checks on semantics, rate-limited destructive operations, idempotent workflows, and
comprehensive audit logging — are the permission model for delegated judgment (`sre-agents`).

The one requirement that changes character: **transparency of internal operation.** For
deterministic automation this keeps operators' mental models accurate. For delegated
judgment it is also the only way to review a decision that was never specified in advance.

## On-call health

The numbers that define a sustainable rotation:

- **≤2 incidents per 12-hour shift.** Handling one incident properly — response, root cause,
  remediation, follow-up — takes about **6 hours**. Two fills the shift. A third means
  something is being done badly.
- **Median daily incident count near zero**, distributed flatly over time.
- **Minimum 8 engineers** at one site for 24/7 primary + secondary; **6 per site** for a
  two-site follow-the-sun rotation that avoids night shifts. Below that, the rotation eats
  the team.
- **Alert-to-incident ratio ≈ 1:1.** Anything noisier gets tuned (`sre-monitoring`).
- **Compensate on-call** — time off in lieu or capped additional pay. Uncompensated on-call
  is an invisible cost that shows up as attrition.
- **Never expect someone to be on-call and make project progress.** Both jobs get done badly.

**Under stress, people fall back on intuition and heuristic bias instead of reasoning.**
The countermeasures are structural, not motivational: clear escalation paths ·
well-defined incident procedures (`sre-incident`) · playbooks (**~3x MTTR improvement**) ·
blameless postmortems (`sre-postmortem`).

**Operational underload is also a failure.** Everyone should be on-call **at least once or
twice per quarter**, or the knowledge decays. Supplement with **Wheel of Misfortune**
role-play and periodic disaster-recovery exercises.

**Last resort: give back the pager.** If a service's reliability doesn't meet the bar and
the owning team won't fix it, hand on-call responsibility back to the developers until it
does. This is the 50% rule with teeth.

## Interrupts and flow

Interrupts are not free minutes; they are the destruction of flow state. A single 20-minute
interruption costs **2+ hours** of productive work.

**Polarise time.** The core rule: **be fully interruptible or fully uninterruptible, never
both.** Arrive knowing which mode you're in — weekly blocks ideally, daily or half-daily
acceptable. Mixing modes is what makes both feel unbearable.

- **Assign interrupts to a named role** on rotation — one person or a pair. **Stop randomly
  distributing tickets across the team**: it disrespects everyone's time and hides the true
  operational load behind a dozen small taxes nobody measures.
- Distinguish the three streams: **pages** (respond in minutes) · **tickets** (hours to
  weeks) · **ongoing responsibilities** (rollouts, flag changes).
- **Before breaking someone's project time, ask:** Is this person uniquely qualified? Can it
  wait for the next interrupt rotation? Is it worth 2+ hours of their output? Exceptions
  should stay rare.
- **Root-cause tickets and pages regularly.** Ticket scrubs and handoffs are rare and
  disproportionately valuable — they're where you find the systemic cause of a recurring tax.
- **Set boundaries by policy**, and push some preparation back to requesters.
- **If a component generates excessive interrupts and won't get the investment to fix it,
  deprecate it or hand it off.** Permanently under-resourced support is a slow failure that
  nobody ever decides on.

## Output

A toil ledger: each recurring operational task with measured time, frequency, growth,
classification, and a chosen response with an owner. Plus the team's toil ratio against 50%
and the on-call numbers against the thresholds above.
