---
name: sre-agents
description: "Run production when some operators are agents. Use when giving an agent access to production or to a destructive tool, when designing agent permissions or escalation, when agents generate a large share of changes, when deciding which work belongs to an agent versus a human, when multiple agents work in parallel, or when an agent caused an incident. Built on the differences in capacity between agents and humans, not on treating agents as fast junior engineers."
---

# /sre-agents

**[extension]** — the SRE Book has no chapter for this. Its foundations still apply; the
allocation of work does not transfer, and that is what this skill is about.

## Start here: agents are not fast humans

The common failure is analogy by seniority — treating an agent as a quick, tireless junior
engineer. The capacities differ in *both* directions, and the mismatch is what causes
incidents. Sort work by capacity, not by difficulty.

| | Human | Agent |
|---|---|---|
| **Fatigue** | Degrades across a shift; hard ceiling ~2 incidents / 12h | No fatigue; degrades with context length and pollution |
| **Memory** | Years of institutional memory; recalls the weird thing from three years ago | None beyond context and files; **sees only what is instrumented or written down** |
| **True novelty** | Reasons about the genuinely unprecedented — badly, but creatively | Pattern-matches to priors; weakest exactly where the situation has no precedent |
| **Documented recall** | Won't read 400 pages of runbook at 3am | Reads all of it instantly and applies it consistently |
| **Speed** | Minutes per action; errors accrue slowly enough to notice | Milliseconds; **blast radius completes before a human looks up** |
| **Consistency** | Same person does it differently twice | Consistent within a version; nondeterministic per call |
| **Self-assessment** | Feels out of depth, and that feeling is a usable signal | **Confidence is poorly correlated with correctness; no reliable internal alarm** |
| **Ambiguity** | Resolves it by asking | Resolves it by guessing, silently |
| **Parallelism** | One thing at a time | Many at once — the book's *freelancing* failure mode, industrialised |
| **Accountability** | Career and social stake; deterrable | None; cannot be deterred, only constrained |

## The division of labour this implies

**Give agents the documented and the repetitive.** Perfect recall and consistency are their
real advantages — not speed.

**Keep humans on the genuinely novel.** This inverts how agents usually get deployed: people
put agents on the strange new problem and leave humans doing the rote work. That is exactly
backwards on both sides of the table.

**Note this reverses a book rule.** Ch. 6 says *"every page should require intelligence;
pages should be about novel problems"* — because a rote page was wasted human attention.
Now: **agents take the documented response, humans take the undocumented.** The rule's
purpose survives; its application flips.

**Keep a human as Incident Commander.** Of the book's four incident roles, agents do
Operational Work and Communication well. Incident Command means holding ambiguous state and
deciding under uncertainty with incomplete information — the weakest agent capacity on the
table, paired with the highest consequence.

## The book wrote the agent safety spec in 2016

Ch. 7 derived four requirements for destructive automation from an incident where
decommissioning automation **treated an empty input set as "everything"** and sent nearly
all CDN machines to disk erasure within minutes. They are, almost exactly, the agent
permission model:

1. **Sanity checks on semantics.** An empty list means *nothing*, never *all*. Refuse
   suspiciously large operations and require explicit confirmation.
2. **Rate-limit destructive operations**, so a wrong decision has time to be noticed.
   For agents this is not optional the way it arguably is for humans: error rate × machine
   speed is the whole problem.
3. **Idempotent workflows**, so partial execution leaves no corrupt state.
4. **Comprehensive audit logging** of every action taken.

Add a fifth that the book only implies: **classify actions by reversibility**, and let
permissions follow the class rather than the tool. Reversible / slow-reversible /
irreversible is a more useful axis than read / write.

## Escalation must be external, never self-assessed

The book tells on-call humans to **introspect** — *"monitor your emotional state; escalate
if panicky or overwhelmed."* That instruction depends on an internal alarm agents do not
have. Confidence is not correlated with correctness, so an agent cannot be asked to notice
that it is out of its depth.

Replace introspection with **tripwires the environment enforces**:

- **Blast radius** — n resources touched, or any single irreversible action → stop, ask
- **Time box** — n attempts or n minutes without measurable progress → stop, hand to a human
- **Novelty** — no playbook matches the symptom → escalate rather than improvise
- **Divergence** — the system moved away from the expected state after an action → stop
- **Budget** — spend or token thresholds crossed → stop (`sre-cost`)

Every tripwire must be enforced *outside* the agent's own judgment. A tripwire in the prompt
is a suggestion; a tripwire in the tool is a control.

## Multi-agent work is the freelancing failure, industrialised

The book names three ways unmanaged incidents spiral: **sharp focus on the technical problem**,
**poor communication**, and **freelancing** — uncoordinated changes that make things worse.
Parallel agents reproduce all three natively, at speed.

The book's own remedy holds and gets *stricter*:

- **Only one party modifies the system.** With agents this is the rule that matters most,
  because two agents will cheerfully apply contradictory fixes within the same second.
- **Recursive separation of responsibilities** — every actor knows its role and does not
  stray. Scope agents to explicit, disjoint surfaces.
- **A live, shared state document.** For humans this aids coordination; for agents with no
  shared memory it is the *only* coordination mechanism that exists.
- **Explicit handoff with acknowledgement.** Ambiguous ownership is how two agents both
  believe they hold the incident.

## Change rate is the real risk

~70% of outages come from changes to live systems. Agents raise change rate by an order of
magnitude. **That arithmetic only works if detection and rollback improve proportionally.**

- Hold agent-driven change to the **same error budget** as any other change (`sre-slo`) —
  and track what fraction of budget burn is agent-originated. If nobody measures that, the
  velocity gain is invisible and so is its cost.
- **Progressive rollout is not optional for agent-authored change.** It is commodity
  infrastructure now, so there is no remaining excuse (`sre-release`).
- Prefer **many small changes** to few large ones. Attribution is what makes high change
  rate survivable, and attribution requires small diffs (`sre-code`).

## Nondeterminism costs you the sharpest debugging tool

The book's troubleshooting method leans on reproducibility: *"create a reproducible test
case,"* then **bisect**. Bisection degrades badly against a nondeterministic system, and
there is **no clean replacement yet**. Say so rather than pretending otherwise.

Partial mitigations, all weaker than bisection:

- Pin model version and sampling parameters; record them with every run (`sre-code`)
- Log full inputs and the resolved instructions, so a run can be replayed as data even if
  it cannot be reproduced exactly
- Use the statistical-testing pattern from `sre-testing`: capture interesting failures and
  **refactor them into fixed regression cases**, which restores determinism at the edges
- Increase sample size where you would previously have used a single decisive test

## Instrument for a reader with no memory

Agents can only see what is instrumented or written down — they have no equivalent of the
engineer who remembers this failed the same way last spring. This raises the value of
practices the book already recommends:

- **A request ID propagated through every hop** — the highest-value single practice, because
  correlation is what replaces recall
- **Change tracking at every layer**, queryable — *"what touched it last"* is the highest
  yield question and an agent cannot answer it from memory
- **Playbooks as interfaces, not prose.** For a human a playbook is a memory aid; for an
  agent it is the entire competence. Structure them: symptom → check → action →
  verification → escalation. Prose runbooks degrade into improvisation.
- **Machine-readable state endpoints** — recent calls, error rates, live config

## Practices that invert for agents

- **Blamelessness.** For humans it exists to protect psychological safety so people don't
  hide errors. Agents don't hide errors and have no morale, so the practice survives only on
  its weaker justification — systemic causes are more actionable than attribution. And there
  is a new failure: "blameless" used to avoid fixing the instructions. **Blame the prompt,
  precisely and by name** (`sre-postmortem`).
- **On-call limits.** The ≤2 incidents ceiling exists because humans fatigue. Agents don't —
  but they degrade over long context and cost money linearly. Similar ceiling, different
  physics. **Do not naively remove the limit;** re-derive it from context length and spend.
- **Toil classification.** The "automatable" test now catches far more work than it did in
  2016, so more work is toil than the book would have classified. But the 50% cap's
  enforcement mechanism — human attrition — doesn't apply to agents, so **the cap must be
  stated as explicit policy or it stops binding** (`sre-toil`).

## Output

An agent operations note covering: which work is allocated to agents versus humans and why,
the action classes by reversibility with permissions attached, the enforced tripwires, the
coordination rule for parallel agents, and how agent-originated change is tracked against
the error budget.
