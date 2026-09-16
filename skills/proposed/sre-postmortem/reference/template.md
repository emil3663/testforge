# Postmortem: <short incident name>

Structure from the SRE Book's example postmortem (sre.google/sre-book/example-postmortem).
Fill every field. "N/A" is an acceptable answer; a blank is not.

---

**Date:** <date of the incident>
**Authors:** <who wrote this>
**Status:** <Draft | In review | Complete | Complete, action items in progress>

**Summary:**
<One or two sentences: what broke, for whom, for how long. Written so someone outside
the team understands it without reading further.>

**Impact:**
<Quantified. Users affected, requests failed, data lost, revenue at risk, duration.
Estimates are fine — say they are estimates and show the reasoning.>

**Root causes:**
<The underlying conditions that made this possible. Usually plural. Keep asking "and what
allowed that?" until you reach something you can change.>

**Trigger:**
<The specific event or change that activated the latent root cause. Distinct from the
root cause — the trigger is what happened on the day.>

**Resolution:**
<What was actually done to mitigate and resolve. Include what was tried and did not work.>

**Detection:**
<How the problem was found, and how long that took. If a human noticed before monitoring
did, say so explicitly — that is itself an action item.>

---

## Action Items

| Action Item | Type | Owner | Bug | Status |
|---|---|---|---|---|
| <what will be done> | mitigate / prevent / process / other | <a person> | <link> | <open/closed> |

Types:
- **mitigate** — reduces the impact next time it happens
- **prevent** — stops this class of incident from happening
- **process** — changes how people work (docs, training, review, on-call)
- **other** — anything else worth doing

Every row needs a named owner and a tracking link. Rows without both do not get done.

---

## Lessons Learned

### What went well
<Responses, tooling, and preparation that actually worked. Name them so they are protected
from future cost-cutting.>

### What went wrong
<Processes, gaps, and assumptions that failed. Systems and processes only — no names.>

### Where we got lucky
<The things that could have made this much worse and happened not to. Coincidences,
near-misses, the thing that was down for maintenance anyway. This section is the most
valuable one in the document: it is a list of your next outages.>

---

## Timeline

All times in a single stated timezone. Include detection, escalation, each hypothesis and
what disproved it, each mitigation attempt, and resolution.

| Time | Event |
|---|---|
| HH:MM | <what happened, or what someone observed/did> |

---

## Supporting Information

Links to dashboards, log queries, graphs (with the time window pinned), the incident
channel log, relevant code or config diffs, and the live incident document.
