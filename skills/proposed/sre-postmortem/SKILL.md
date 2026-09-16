---
name: sre-postmortem
description: "Write a blameless postmortem and track outages over time. Use after an incident or outage is resolved, when asked to write an incident report / RCA / retro for a failure, when reviewing someone's postmortem draft, or when deciding whether an incident warrants one. Enforces blameless language, produces a complete postmortem from the book's template, and covers the outage-tracking data to keep across incidents."
---

# /sre-postmortem

From SRE Book Ch. 15 (Postmortem Culture) and Ch. 16 (Tracking Outages).
Template in `reference/template.md`.

## Does this need a postmortem?

Agree the triggers *before* incidents, so nobody argues about it while raw. Standard set:

- User-visible downtime or degradation past an agreed threshold
- **Any data loss**
- On-call engineer intervention (rollback, traffic rerouting, manual failover)
- Time-to-resolution above a threshold
- A monitoring failure — i.e. a human found it before the alerting did

Any stakeholder may request one regardless of triggers. Err toward writing it: the postmortem
is cheap, and the second occurrence of an undocumented outage is not.

## Blameless is a writing constraint, not a vibe

Assume everyone involved had good intentions and acted correctly given the information they
had. Then the question stops being *who* and becomes *what let this happen* — which is the
only version with an action item at the end.

The practical test: **every sentence should point at a system, a process, or a piece of
information, never at a person.** Name roles and systems, not individuals.

| Accusatory | Blameless |
|---|---|
| "Dave deployed without running the tests" | "The deploy path did not require the test suite to pass, so an untested build reached production" |
| "We need to rewrite the entire complicated backend! It's been breaking weekly for three quarters" | "An action item to rewrite the backend might prevent these pages from recurring; the current design makes failure modes hard to isolate" |
| "The on-call missed the alert" | "The alert was delivered by email, which has no acknowledgement path; there was no escalation after 15 minutes" |

Note what the blameless column does: it converts a complaint into a *fixable property of
the system*. If a rewritten sentence has no fixable property in it, you haven't found the
cause yet.

## Procedure

1. **Start from the live incident document** (`sre-incident`), not from a blank page.
   The timeline already exists.
2. **Fill the template** — `reference/template.md`, all sections.
3. **Quantify impact.** "Some users saw errors" is not an impact statement.
   Users affected, requests failed, duration, revenue or data at risk.
4. **Separate root cause from trigger.** The root cause is the latent condition; the trigger
   is what activated it. A postmortem naming only the trigger produces action items that
   prevent exactly one incident.
5. **Write action items that can be closed.** Each has a **type** (mitigate / prevent /
   process / other), an **owner** (a person, not a team), and a **bug link**. An action item
   without an owner and a tracking link is a wish.
6. **Complete Lessons Learned, all three parts** — including *Where we got lucky*. That
   section is the highest-value one and the most often skipped: it enumerates the failures
   you did not have, which is your list of the next outages.
7. **Get it reviewed** by a senior engineer not involved in the incident. Criteria: was key
   data collected · is impact assessed · is root cause deep enough · are actions prioritised
   and appropriate · were outcomes shared.
   > **"An unreviewed postmortem might as well never have existed."**
8. **Share widely** — first to the team for review, then as broadly as it is useful.
   A postmortem read only by its authors has taught nobody anything.

## When an agent was involved **[extension]**

Blamelessness exists to protect psychological safety so people don't hide errors. **Agents
have no morale to protect and do not hide errors**, so the doctrine survives only on its
weaker justification: systemic causes are more actionable than attribution.

That creates a new failure mode — "blameless" used as a reason not to fix the instructions.

- **Blame the prompt, precisely.** Quote the instruction that produced the behaviour, the
  same way you would quote the config line. An agent acting on its instructions is a
  *systemic* finding, not a personal one, so naming it exactly is entirely blameless.
- **Record the model version and parameters** in the postmortem metadata. A behaviour change
  with no diff in the repository is otherwise unattributable (`sre-code`).
- **Keep humans blameless on the same terms as before.** The person who granted the
  permission, wrote the instruction, or approved the tool acted on the information they had.
- Ask the extra questions: was the action reversible? Did a tripwire exist, and did it fire?
  Should this class of action have required confirmation (`sre-agents`)?

## Making the culture stick

If postmortems are perceived as punishment, you will get fiction. Countermeasures, in
rough order of effect:

- **Reward writing them** — publicly, at team meetings, in performance conversations.
  Visibly reward the person who surfaced their own mistake, or nobody ever will again.
- **Senior leadership participates**, visibly, including in postmortems about their decisions.
- **Postmortem of the month** — circulate an exemplary one.
- **Reading clubs** — a regular session discussing internal and external postmortems.
- **Wheel of Misfortune** — role-play a past incident with new on-callers. Doubles as
  the best on-call training that exists.
- **Survey the team** on whether the process is working, and act on it.
- **Automate the boring parts** — creation, metadata, action-item tracking.
- Ease it in with a trial period rather than a mandate.

## Track outages across incidents, not just within them

One postmortem tells you about one outage. The aggregate tells you where your reliability
actually goes — and low-severity, high-frequency problems never show up in individual
postmortems while dominating the total cost.

Keep, per incident: original notifications · annotations (which were important, which routine)
· follow-up communications · timeline · **tags**.

- **Aggregate related alerts into one incident.** One event fires alerts across many teams;
  without grouping you get redundant debugging, duplicated panic, and an alert count that
  means nothing.
- **Tag with a namespaced free-form scheme** — `cause:network:switch`. Let the taxonomy
  emerge instead of designing a rigid one up front; the categories you'd have guessed are
  not the ones you'll need.
- Support **automatic escalation** of unacknowledged alerts (primary → secondary).

Then answer, quarterly: **How many alerts per shift? What fraction are actionable? Which
services generate the most toil? What's the alert-to-incident ratio?** (Target ≈1:1 —
see `sre-toil`.) These questions are the input to the roadmap conversation.

## Output

A completed postmortem file — `postmortems/YYYY-MM-DD-<short-name>.md` — from the template,
reviewed, with owned and linked action items. Plus, where a tracker exists, tagged incident
records feeding the quarterly review.
