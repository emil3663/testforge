---
name: reliability-audit
description: >
  Audit code that makes external calls — network requests, subprocess calls,
  queues, polling loops — for missing timeouts, retries without backoff, and
  unbounded queues: what happens when the dependency is slow or down. Files
  findings using this repo's issue-template convention. Use this skill when
  reviewing code that talks to something outside the process, or after
  writing a new external call, before assuming it degrades gracefully.
---

# Audit for what happens when a dependency is slow or down

## What this skill is for

Code that calls out — an API, a subprocess, a database, a queue — almost
always has an implicit assumption baked in: that the call returns promptly
and successfully. This skill makes that assumption explicit and checks it,
the same way `refactor-audit` checks structural drift: read the code, find
where the assumption doesn't hold, file it as an issue.

It does not fix anything. Finding and fixing are separate jobs, same
reasoning as `refactor-audit`'s.

Pairs with `refactor-audit` — that one asks whether the code is shaped
right, this one asks whether it survives its dependencies misbehaving.
Generalizes the Google SRE book's chapters on handling overload and
cascading failure: most outages there trace back to one of these three
gaps, not to the dependency itself failing.

## Inputs you need from the user

1. **Scope** — a repo, a directory, or a single file. Default to the whole
   repo but say what you covered.
2. **Where findings go** — a tracker, a backlog file, or "just print them."
   Never file into a tracker without being told which one.
3. **What is already known** — an existing backlog or open issues. A finding
   already recorded is not a finding.

## Output format

One issue per finding, in the repo's own brief shape
([`docs/WORKING_AGREEMENTS.md`](../../docs/WORKING_AGREEMENTS.md)):

```markdown
## Context
The measurement that justifies this, with file and line references — what
call, what's missing, what happens without it.

## Change
The fix proposed: a timeout value and its source, a retry policy with
backoff, or a bound on the queue/buffer.

## Acceptance
What must be true afterwards — including what must NOT change (e.g. success-
path latency, existing error messages).

## Not in this issue
Explicit exclusions.

## Provenance
Found by a reliability audit on <date>, scope <what was covered>.
```

Then a summary table, ranked by consequence, so the reader can triage
without opening each one.

## Rules

**Measure, do not assert.** "This call could hang" is not a finding. "This
`fetch` has no `AbortController` or timeout option set, so a stalled
response blocks this code path indefinitely — the caller has no way to
recover" is.

**Three signals, each independently checkable:**

| Signal | Ask | Consequence if missing |
|---|---|---|
| Missing timeout | Does this call have an explicit bound on how long it will wait? | A slow dependency becomes a hang, not a failure — the caller can't distinguish "still working" from "never coming back." |
| Retry without backoff | If this retries, does the delay between attempts grow, or is every retry immediate? | Immediate retries against a struggling dependency add load exactly when it has the least capacity to handle it — the retry becomes the outage. |
| Unbounded queue | Can this queue, buffer, or in-flight-request count grow without limit while the consumer is slow? | Memory grows until the process dies, trading a graceful slowdown for a hard crash — usually at the worst possible moment. |

**Rank by consequence, not by how easy the fix is.** A missing timeout on a
call in the critical user-facing path outranks the same gap in a background
cron job, even if both fixes are equally small.

**Name what you could not check.** Static reading can't tell you the
dependency's actual failure rate, its real latency distribution, or whether
it has its own server-side timeout that makes the client-side one moot. Say
so in the issue.

**Never file churn.** A `fetch` with no timeout inside a build script that
runs once, by a human, and is killed with Ctrl-C if it hangs, is a different
risk than the same gap in a request handler. Don't file the first just
because the pattern matches.

**Propose the value, not just the gap.** "Add a timeout" without a number
is unfinished. Propose one, and say what it's based on — an existing timeout
elsewhere in the codebase, the dependency's own documented SLA, or an
explicit guess flagged as one.

## Worked example

**Finding:** `useCrawl.ts`'s and `useRun.ts`'s polling loops (both flagged
independently by `refactor-audit`'s trial in `CALIBRATION.md` for their
duplicated fetch/parse/apply-snapshot shape) — applying `reliability-audit`'s
three signals to the same code, not the structural duplication this time:

```markdown
## Context
src/app/_hooks/useCrawl.ts's pollCrawlStatus (lines 28-58) and useRun.ts's
pollRunStatus (lines 52-79) each call `fetch` with no timeout or
AbortController — confirmed by reading both call sites directly, neither
passes a `signal` or races the fetch against a timer. Both are inside a
setInterval loop (500ms crawl / 800ms run), so a single stalled request
doesn't just hang once — the next interval tick fires a second overlapping
request against the same endpoint while the first is still pending, and
that compounds every tick until the endpoint responds or the interval is
cleared, with no bound on how many can be in flight.

## Change
Pass an AbortController's signal to fetch with a timeout (propose 5s —
double the 800ms/500ms poll interval by roughly an order of magnitude, so a
single slow response doesn't trip it, but a truly stuck request does before
too many overlap); on abort, treat it the same as the existing !response.ok
path (typed fallback message, no state corruption). Track the in-flight
controller per hook instance so a new poll tick can abort a still-pending
previous one instead of letting them stack.

## Acceptance
- A response slower than 5s is treated as a failure with the existing
  fallback message shape, not left hanging.
- Normal-speed polling (the common case) is untouched — same interval, same
  success-path behavior.
- No more than one request in flight per hook at a time.

## Not in this issue
Retry/backoff policy for a failed poll — currently the interval itself acts
as a naive fixed-delay retry; whether that needs real backoff is a separate
question from the missing timeout, and this issue doesn't answer it.

## Provenance
Reliability audit, 16 September 2026, scope src/app/_hooks/. Not measured:
how often the polled endpoints actually respond slowly in practice, or what
timeout, if any, the Next.js API routes themselves enforce server-side.
```

## Growing this skill

The three-signal table is a starting set, the same size and shape as
`refactor-audit`'s. When a finding turns out wrong, or a signal produces
noise, edit this file rather than remembering the exception — same
discipline, same reasoning.

## How to invoke this skill

> "Run a reliability audit over `src/app/_hooks/` — print the findings, don't file them."

Or broader: "Reliability audit on `src/` — anything that talks to the network
or a subprocess."
