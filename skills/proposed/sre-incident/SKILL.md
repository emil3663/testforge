---
name: sre-incident
description: "Run a live incident: triage, structured troubleshooting, and incident command. Use when something is broken right now, when debugging a production outage, when a system is degraded and the cause is unknown, when asked to help with an ongoing incident, or when an investigation has stalled and needs method. Covers stop-the-bleeding triage, the diagnose loop, and the four incident roles."
---

# /sre-incident

From SRE Book Ch. 12 (Effective Troubleshooting), Ch. 13 (Emergency Response),
Ch. 14 (Managing Incidents).

## First: stop the bleeding

> "Your first response in a major outage may be to start troubleshooting and try to find a
> root cause as quickly as possible. **Ignore that instinct.**"

Mitigate before you diagnose. Divert traffic, drop load, disable the subsystem, roll back.
You are not helping users by root-causing a system while it dies. **Preserve evidence
while you stabilise** — snapshot logs, save a heap dump, record the current state — because
the fastest mitigation (restart everything) is also the one that destroys the evidence.

Restoring service and understanding the cause are two separate jobs. Do them in that order,
and say out loud which one you are currently doing.

## Declare an incident early

Declare if **any** of these is true:

- Do you need a **second team** to fix it?
- Is the outage **visible to customers**?
- Is it **still unsolved after an hour** of concentrated analysis?

Under-declaring is the common error. An incident you declared and stood down in ten minutes
costs almost nothing; an incident you should have declared an hour ago costs the hour.

## The troubleshooting loop

```
Problem report → Triage → Examine → Diagnose → Test/Treat ⟲ → Cure
                                        ↑___________|
```

**Problem report** — capture expected behaviour, actual behaviour, and how to reproduce.
A report without all three is not yet a report.

**Examine** — what the system will tell you:
- *Metrics*: graph the time series; correlate the change with other changes
- *Logs*: structured, with verbosity control and a selection language
- *Tracing*: follow one request across the whole stack
- *State endpoints*: recent RPCs, error rates, latency histograms, live config

**Diagnose** — five techniques, roughly in order of payoff:

1. **What touched it last.** Recent changes are the highest-yield starting point —
   ~70% of outages follow a change. Annotate your graphs with deploy timestamps so this
   question is answerable by looking rather than by asking.
2. **Bisect.** Split the system in half, determine which half is wrong, repeat. In a deep
   stack this beats inspecting layers in order.
3. **Simplify and reduce.** Feed components known inputs and check for known outputs.
   Build a reproducible case; it converts debugging from archaeology into experiment.
4. **Ask what / where / why.** The system is malfunctioning while *trying to do something*.
   What is it actually doing? Where are its resources and output going? Why?
5. **Specific diagnoses.** Build service-specific tooling; share it, so the next person
   doesn't rebuild it mid-outage.

**Test and treat** — hypothesis discipline:

- Make alternatives **mutually exclusive** so one test rules out a whole group.
- Test **likely causes first**, weighted by risk to the system.
- Watch for **confounders**.
- Remember that active tests have **side effects that contaminate later tests**.
- Some results are only suggestive — races and deadlocks rarely give clean answers.
- **Take clear, timestamped notes of every idea, test, and outcome.** This is not paperwork;
  by hour three it is the only reason anyone knows what has already been ruled out.

**Cure** — identify probable causal factors (definitive proof is often unavailable in
production, and that's acceptable), document what went wrong and what you did, then hand off
to `sre-postmortem`.

## Pitfalls

- **Misinterpreting metrics** — chasing a symptom that isn't connected to the fault.
- **Bad hypothesis testing** — not knowing how to change the system safely to test an idea.
- **Improbable theories** — "when you hear hoofbeats, think of horses, not zebras."
  Also: don't assume this is a recurrence of the last outage.
- **Spurious correlation** — coincidence, or two symptoms of one hidden cause.
  Correlation is not causation.

## Incident command (any incident with more than one responder)

Unmanaged incidents fail in three specific ways: **sharp focus on the technical problem**
(nobody is thinking about mitigation or impact), **poor communication** (duplicated and
contradictory work), and **freelancing** (uncoordinated changes making it worse).

Four roles. All four start with the Incident Commander and are delegated outward.

| Role | Owns |
|---|---|
| **Incident Command** | High-level state. Structures the response, assigns roles, removes roadblocks. Holds every role not yet delegated. |
| **Operational Work** | Applies the fixes. **The ops lead is the only party who modifies the system.** |
| **Communication** | Public face. Periodic updates to stakeholders; keeps the incident doc accurate. |
| **Planning** | The long tail — files bugs, orders food, handles handoffs, and tracks every divergence from normal so it can be undone later. |

**Recursive separation of responsibilities**: everyone knows their role and does not stray
into someone else's. When a role gets overloaded, the holder delegates and spawns a
sub-incident rather than drowning quietly.

**Live incident state document.** The IC's most important artefact. Concurrently editable,
most important information at the top, messy is fine, templated for consistency. It becomes
the postmortem's timeline, so writing it is not overhead — it's the postmortem, started early.

**Recognised command post.** One known place — a channel, a bridge, a room — that is
reliable and *loggable*. The log is what makes distributed response reconstructable.

**Explicit handoff.** At shift change, brief the incoming commander live, and require verbal
confirmation: *"You're now the incident commander, okay?"* The outgoing IC does not leave
until they've heard the acknowledgement, and the handoff is announced to everyone.

## Behaviour under pressure

- **Don't panic; ask for help.** All problems have solutions. If you feel overwhelmed, pull
  more people in — up to and including paging widely. The person whose action triggered the
  incident usually holds the most valuable context, and is the person least likely to speak
  up unless invited. Invite them.
- **Introspect.** Watch your own state. If you're panicky or tunnelling, escalate.
- **Consider alternatives.** Periodically ask whether the current approach is still the
  right one. Sunk cost is a real hazard at hour four.
- **Trust.** Full autonomy inside an assigned role.
- **Practice.** Use the framework for routine change management and drills, so it's familiar
  before it's needed.
- **Rotate roles** so everyone can run every position.

## Two situations the book did not anticipate **[extension]**

**1. The vendor incident, where troubleshooting is worthless.**
The dominant modern incident is "a provider is degraded." You cannot examine it, bisect it,
or fix it, and root-causing is not merely slow — it is *unavailable*. The only levers are the
ones you built months ago: a designed degradation path, a failable dependency, a second
provider (`sre-architecture`). Recognise this class early and stop investigating; switch
straight to mitigation and communication. Time spent diagnosing someone else's outage is the
most common way to waste an incident.

**2. Nondeterministic components break bisection.**
The method above leans on reproducibility — *"create a reproducible test case"*, then bisect.
Against a nondeterministic component, bisection degrades badly and **there is no clean
replacement.** Partial mitigations: pin versions and parameters, log full inputs and resolved
instructions so a run can be replayed as data, raise sample size where one decisive test used
to do, and convert any interesting failure into a fixed regression case (`sre-testing`).

## When some responders are agents **[extension]**

The book names three ways unmanaged incidents spiral — **sharp focus on the technical
problem**, **poor communication**, and **freelancing**. Parallel agents reproduce all three
natively, at machine speed. The remedies get stricter rather than different:

- **Only one party modifies the system.** The rule that matters most here: two agents will
  apply contradictory fixes within the same second.
- **Keep a human as Incident Commander.** Agents handle Operational Work and Communication
  well; command means holding ambiguous state and deciding under uncertainty, which is the
  weakest agent capacity paired with the highest consequence (`sre-agents`).
- **The live state document is the only shared memory** between agents. For humans it aids
  coordination; here it *is* the coordination.
- **Escalation cannot be self-assessed.** The book's *introspect — escalate if you feel
  overwhelmed* depends on an internal alarm agents lack. Replace it with enforced tripwires:
  blast radius, time box, no matching playbook, state diverging after an action.
- **Agents should take the documented response and hand the novel to humans** — the reverse
  of how agents usually get deployed.

## Make the next one easier

Build in, before you need them: white-box metrics and structured logs in every component ·
observable, well-defined interfaces between components · **a unique request ID propagated
through the whole RPC chain** so logs can be correlated · change tracking at every layer
(code pushes, config changes, environment).

And prefer to find failures on purpose: *"Would you prefer that a failure happen at 2 a.m.
Saturday morning, or when you have your best and brightest close at hand?"*
Ask "what if?" about your dependencies on a schedule. See `sre-testing`.
