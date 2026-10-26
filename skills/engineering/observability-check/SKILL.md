---
name: observability-check
description: >
  Checks whether a feature under test has any way to tell, in production,
  that it's broken — a log line, a metric, or an error-tracking hook on its
  failure path. Extends honest-coverage's "what a green run doesn't prove"
  outward, from the test run to production: not just would this test catch
  a defect, but if it broke for real, would anyone notice. Use this skill
  after writing or reviewing tests for a feature, alongside honest-coverage,
  when the question isn't just what's proven but what's watched.
---

# Would anyone notice this breaking in production?

## The gap this closes

[`honest-coverage`](../../testing/honest-coverage/SKILL.md) states plainly
what a green test run does and doesn't prove — a Stable/Moderate/Blocked
rating per test, not a generic disclaimer. Its own opening frames the
problem it's generalized from: "a reviewer who counts spec files concludes
there's a large suite. A reviewer who opens one concludes the opposite." A
green suite can quietly mean less than it appears to.

This skill is that instinct's sibling, aimed at production instead of the
test run. A green suite proves a code path behaves correctly *right now,
under test conditions*. It says nothing about whether anyone would find out
if that same path started failing for real users tomorrow. Those are
independent properties — a well-tested feature can be completely unwatched
in production, and a well-monitored one can be undertested. This skill
checks the second property specifically: not "is this correct," but "if
this breaks, does anything downstream of the code know."

Generalizes the Google SRE book's ch. 6 (Monitoring Distributed Systems):
the chapter's core claim is that a system you cannot observe is a system
you can only debug after a user files a report, and that the gap between
"looks monitored" and "is monitored" is where outages hide the longest.

## Inputs you need from the user

1. **The feature or code path** — a file, a function, or a flow already
   covered (or about to be covered) by tests.
2. **What "broken" means for this path** — an exception, a wrong value
   returned, a request that silently never completes. Different failure
   shapes need different observability, and the user's description of the
   feature usually implies which ones are possible.
3. **What observability tooling exists in this codebase already** — a
   logger, a metrics client, an error-tracking SDK (Sentry, etc.). Don't
   propose inventing a new mechanism if one is already in use elsewhere;
   flag the gap in terms of the existing one.

## Output format

For each failure path checked:

```
Path:          <function/file/flow and the specific failure being asked about>
Failure shape: <exception | wrong value | silent non-completion | ...>
On failure:    <what actually happens right now — quote the code>
Verdict:       <observed | silent | false-observed>
Gap:           <the specific thing missing, named — not "add logging">
```

Where `Verdict` is one of:

| Verdict | Meaning |
|---|---|
| **Observed** | The failure path has a log line, metric, or error-tracking hook that actually fires and carries enough detail to diagnose from. |
| **Silent** | Nothing runs on this path at all — no log, no metric, no hook. The failure vanishes. |
| **False-observed** | Something that *looks* like observability sits on the path — a `catch` block, a log statement — but it doesn't actually fire, or fires without the detail needed to diagnose anything. Worse than Silent, because it reads as covered on a code review. |

## Rules

**Distinguish "no observability" from "observability that never fires."** A
bare `catch (e) {}` or a `catch (e) { return null; }` is not more observable
than no `try/catch` at all — it's less safe than that, because it *looks*
handled. Reviewing code for a `catch` block's presence is not this skill;
reviewing what's actually inside it is.

**Name the failure path and the specific missing piece, never "add more
logging."** "This function could use better error handling" is not a
finding — it's the thing this skill exists to replace. "The `catch` block
in `pollRunStatus` (useRun.ts) swallows the fetch error into a state field
the UI reads, but nothing writes it anywhere durable — a user who never
looks at that screen mid-poll never surfaces the failure, and no metric
increments" is.

**A user-visible error message is not the same claim as an operator-visible
one.** A toast that says "Something went wrong" tells the one user who hit
it. It doesn't tell whoever's on call that it's happening to everyone, at
what rate, or whether it just started. Check both separately — this skill's
job is the second one; a UI-facing error banner passing does not close this
skill's finding.

**Ask what the log or metric would need to contain to actually diagnose
from, not just whether one exists.** A log line that fires but omits the
input that caused the failure is closer to Silent than Observed — it tells
you *that* something broke, not *what*.

**Rank by how quietly a break could go unnoticed, not by how likely the
break is.** A rarely-hit path with zero observability that could fail for
days before a user complains outranks a common path with the same gap that
someone would notice within the hour just from support volume.

**This is not `reliability-audit`.** That skill asks whether a call to an
external dependency degrades gracefully — a timeout, a bounded retry, a
capped queue. This skill asks whether *any* failure on a path, degraded or
not, leaves a trace anyone would see. A path can have perfect timeout
handling and still be this skill's finding, if the timeout itself is never
logged or counted anywhere.

## Worked example

**Applied to `write-playwright-test`'s own worked example's failure
handling** (the login page's invalid-credentials case, as implied by the
scenario description — no actual frontend code exists for it in this repo,
so this reasons from the described behavior, stated as such):

```
Path:          Login form submission, invalid-credentials branch
Failure shape: Server returns an auth failure; the page shows an inline
               error and stays on /login (per the scenario description).
On failure:    Not knowable from the description alone — no server-side
               code was provided alongside the scenario, only the observed
               client behavior the test asserts against.
Verdict:       Cannot be rated from a test scenario alone — this is the
               limit of what this skill can check without the
               implementation. Flagging that limit explicitly, rather than
               guessing, is itself the honest-coverage discipline applied
               to this skill's own output.
Gap:           Ask for the server-side handler before rating this path —
               specifically, whether a spike in invalid-credential
               responses (which could mean a credential-stuffing attempt,
               not just a typo) increments any counter, or whether it's
               indistinguishable from background noise in whatever the app
               currently logs.
```

**A gap this skill is built to actually catch, from `useRun.ts`'s real
polling code** (the same file `refactor-audit`'s trial in
`CALIBRATION.md` and `reliability-audit`'s worked example both already
examined, for different properties):

```
Path:          pollRunStatus, src/app/_hooks/useRun.ts
Failure shape: fetch throws, or the response's !response.ok branch fires.
On failure:    The catch block sets a typed fallback message into
               component state (setRunStatus/setResultError-shaped), which
               the UI can render if the user is looking at this screen at
               that moment.
Verdict:       False-observed. The failure is caught and given a
               user-facing message, which reads as "handled" on review -
               but nothing here writes to a log, increments a metric, or
               reports to an error tracker. It is entirely dependent on a
               human being looking at the right screen at the right
               second.
Gap:           No durable record of a poll failure exists once the
               component unmounts or the user navigates away. A run that
               starts failing in a tab nobody's watching produces zero
               trace. Missing specifically: a console.error or logger call
               in the catch block carrying the run ID and status code, at
               minimum - not a general call to "add observability."
```

## What this skill deliberately does not cover

**Release engineering** (SRE ch. 8 — deployment, rollback, canarying) is
out of scope here on purpose, not an oversight. It's already covered by the
existing `verified-release-pipeline` account skill; duplicating it under a
different name would just split one concern across two places.

## How to invoke this skill

> "Run observability-check on this feature — if it breaks in prod, would we know?"

Or paired with its sibling: "run honest-coverage and observability-check on
this together" — one rates what the tests prove, the other rates what
production would tell you if they were wrong.
