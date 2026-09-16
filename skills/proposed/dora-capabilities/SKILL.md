---
name: dora-capabilities
description: "Diagnose which practices to change when delivery performance is poor. Use when DORA metrics look bad and you need to know what to actually do, when planning engineering improvement work or a platform roadmap, when deciding what to fix first, when adopting AI tooling across a team, or when someone asks how to ship faster without breaking more. Maps metric symptoms to the capabilities DORA research shows predict improvement."
---

# /dora-capabilities

From **DORA Core** ([dora.dev/capabilities](https://dora.dev/capabilities/)) — the
capability catalogue, used as a diagnostic. `dora` measures; this decides what to change.

## The model

```
capabilities  →  performance metrics  →  organisational outcomes
(what you do)    (dora)                  (the thing you wanted)
```

DORA Core deliberately **lags** the cutting edge of the research, holding only findings that
have replicated. That conservatism is the point: it is the stable subset, safe to act on.

Two consequences for how you use it:

- **Capabilities are the levers; metrics are the readout.** Never work on a metric directly —
  that is how you get Goodhart. Work on a capability and watch the metric respond.
- **These are correlational.** They predict performance; they are not proven causes. Treat
  the catalogue as a well-evidenced prior, not a guarantee.

## The catalogue

**Technical**
version control · trunk-based development · continuous integration · continuous delivery ·
deployment automation · test automation · test data management · database change management ·
loosely coupled architecture · code maintainability · monitoring and observability ·
proactive failure notification · flexible infrastructure · pervasive security ·
empowering teams to choose their own tools

**Process**
working in small batches · streamlining change approval · visibility of work in the value
stream · work-in-process limits · visual management · customer feedback · team
experimentation · monitoring systems to inform business decisions · documentation quality

**Cultural**
generative organisational culture · learning culture · transformational leadership ·
job satisfaction · well-being

**AI-era (added 2024–2025)**
clear and communicated AI stance · AI-accessible internal data · healthy data ecosystems ·
platform engineering · user-centric focus

## Diagnose from the symptom

Start with the metric that is worst, then work the capabilities most likely to move it.

| Symptom | Work on, roughly in order |
|---|---|
| **Low deployment frequency** | working in small batches · short branch lifetime (integrate daily) · deployment automation · continuous integration · streamlining change approval |
| **Long change lead time** | streamlining change approval (usually the largest single block) · CI · test automation · working in small batches · WIP limits |
| **High change fail rate** | test automation · continuous integration · database change management · loosely coupled architecture · working in small batches |
| **Slow failed-deployment recovery** | deployment automation and one-step rollback · monitoring and observability · proactive failure notification · loosely coupled architecture |
| **High deployment rework rate** | test automation · monitoring and observability · code maintainability · customer feedback |
| **Metrics fine, people burning out** | well-being · job satisfaction · generative culture · WIP limits — and `sre-toil` |
| **Everything is slow and nobody knows why** | visibility of work in the value stream · visual management · documentation quality |

### On "trunk-based development"

DORA names the capability *trunk-based development*, and that name causes arguments about
branching policy that miss the finding. **The property being measured is integration
frequency and branch lifetime, not the absence of branches.**

What the research actually associates with high performance:

- **Branches are short-lived** — ideally under a day, and merged before they diverge
- **Few branches are active at once**
- **Everyone integrates to a shared mainline frequently**
- **No long-lived release branches** requiring merge-back or extensive cherry-picking

Trunk-based development is one implementation. **Short-lived feature branches merged daily
achieve the same property** and satisfy the finding equally. So does stacked-PR work. The
anti-pattern is not *having* branches; it is branches living long enough to diverge.

So state the goal as **small batches, integrated often**, and let teams pick the mechanism.
That is both the honest reading of the research and the version people will actually adopt —
a branching mandate produces compliance theatre, while a batch-size goal produces the
behaviour the data is about.

**[extension]** This gets sharper with agents: agent-authored change fills a long-lived
branch far faster than a human would, so divergence — and the merge conflict that follows —
arrives sooner. Short branch lifetime matters more as change rate rises, not less.

Two capabilities appear in nearly every row — **working in small batches** and **test
automation**. If you can only fund two things, fund those. They are also the two that
`sre-code` and `sre-testing` independently arrive at from the reliability side, which is
reasonable evidence they are load-bearing.

**Streamlining change approval** deserves a specific note: DORA's finding is that *external*
change-approval boards do not improve stability and do measurably damage throughput. Peer
review does. This is the most commonly resisted result in the catalogue, and among the
best supported — expect the argument and bring the citation.

## Adopting AI: the amplifier finding

DORA's 2025 research is direct about this:

> **"AI acts as an amplifier"** — magnifying an organisation's existing strengths and
> weaknesses. The greatest returns come from focusing on the underlying sociotechnical system.

The operative consequence: **AI does not fix a broken delivery system, it accelerates it.**
A team with weak tests, manual deploys, and no rollback path will generate more changes it
cannot verify and cannot reverse. The same tooling on a team with strong CI, small batches,
and one-step rollback compounds in the other direction.

So the sequencing is: **fix the delivery fundamentals first, then adopt.** The AI-era
capabilities are the prerequisites, not the payoff:

- **Clear and communicated AI stance** — ambiguity about what is sanctioned produces shadow
  usage and no shared learning
- **AI-accessible internal data** and **healthy data ecosystems** — an agent's competence is
  bounded by what it can reach (`sre-agents`: it has no institutional memory)
- **Platform engineering** — paved paths make generated changes land safely by default
- **User-centric focus** — throughput gains are worthless when pointed at the wrong thing

Also expect a **productivity dip during rollout**. DORA notes this explicitly; teams that
abandon adoption during the dip conclude the tooling does not work, when they measured the
transition rather than the steady state. Decide the evaluation window in advance.

## Procedure

1. **Measure first** (`dora`). Improving without a baseline is indistinguishable from
   rearranging.
2. **Pick the single worst metric.** Not all five.
3. **Choose one or two capabilities** from its row. More than two in flight and you cannot
   attribute the change.
4. **Set a review window** — one quarter is typical — and state the expected direction of
   movement before you start.
5. **Re-measure. Attribute honestly**, including "no effect," which is a real and common
   result worth recording.
6. **Repeat on the next-worst metric.**

This is the same loop as `sre-slo`'s control loop and `sre-toil`'s ledger: measure, change
one thing, re-measure, attribute. The discipline is in changing one thing.

## Output

An improvement plan naming: the baseline, the one metric being targeted, the one or two
capabilities being invested in, the expected direction, the review date, and what will be
concluded if nothing moves.
