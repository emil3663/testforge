# Working agreements

*Rewritten 2026-10-26. The previous version of this file was test-assist's
working agreement, copied in with the skills work on 2026-09-16; it
described `TA-NNN` tickets, `TESTASSIST_BACKLOG.md` and a deployed browser
build, none of which exist here. Its two hard-won lessons live on as the
`dont-stub-what-you-prove` and `find-the-hidden-platform` skills.*

How work on TestForge is decided, built, checked and recorded. Gates,
evidence rules and the verification checklist are in
[`QUALITY_GATES.md`](QUALITY_GATES.md); this document is the process
around them. Review it when the way of working changes, and at least at
every phase completion (see [Docs that must stay true](#docs-that-must-stay-true)).

---

## Decision vocabulary

Documents and code say *what kind* of decision or permission something is,
not *whose name* is attached to it. A name records who decided; it is not
the rule. A reader, a new contributor or a coding agent has to be able to
tell from the words alone whether they may proceed.

| Term | Meaning | What an agent does |
|---|---|---|
| **Owner decision** | A choice between valid options that only the project owner makes: scope, product direction, a gate ruling, a trade-off. | Sets out the options, the evidence and a recommendation, then stops. The decision is recorded with its date in a decision record. |
| **Confirmation required** | An action the agent may prepare but must not perform without an explicit go-ahead in the current session. Approval does not carry over to later actions or sessions. | Prepares the action, says exactly what it will do, waits for a clear yes. |
| **Independent review** | A review by someone who did not produce the work: a separate verifying session, or an outside reviewer at a stage gate. | Hands over the work and the criteria, not the reasoning that produced it. |
| **Recorded rationale** | Why a past decision was taken. | Cites it by reference, e.g. *Phase 42 Decision 8 (2026-10-12)*, rather than restating it. |

**Confirmation required, standing list.** These need a go-ahead every time,
whatever permission mode the session runs in:

- changing machine-level or user-level settings (installing RTK, `rtk init -g`, global git config, anything outside the repo);
- promoting a candidate test into the library;
- deleting files, history or run evidence; rewriting git history; force-pushing;
- starting a long measurement session that locks the machine (these are batched overnight, see the deferred-work register's standing rules);
- running anything against a live site that isn't a listed practice target (`docs/decisions/practice-site-targets-2026-10-19.md`), and anything attack-shaped against a site without an ownership confirmation;
- spending money: paid API calls beyond what a ticket budgets, new services.

**In product code and product docs**, the person approving is **the
tester** (or "the user" in UI copy) — TestForge is meant for other people's
sites and teams. Code and README text never name a maintainer as the
approver.

**Where names still belong:**

- *Attribution and credit:* who proposed a skill, who wrote a draft, the
  plugin's author field, commit authorship.
- *Frozen evidence:* `benchmarks/` and git history are records of what
  happened and are never edited to change their wording.
- *A decision record's own ruling line* may say who ruled; everything that
  cites it uses the reference.

### Roles

| Role | Who, today | Does |
|---|---|---|
| **Owner** | Emil | Makes owner decisions; gives confirmations; rules at gates. |
| **Reviewer** | Martin | Independent review at stage gates; proposes skills and direction. |
| **Planning session** | Claude in chat or Cowork | Decision records, backlogs, handovers, reviews, doc updates. Never edits code or commits. |
| **Implementing session** | Claude Code in VS Code | Builds tickets, runs checks, writes commit messages, commits and pushes. The only git driver on the repo. |
| **Verifying session** | A fresh session that did not build the work | Runs `QUALITY_GATES.md` §5 with the `agent-report-verification` skill. |

The table is the only place names are mapped to roles. Everywhere else,
use the role or the vocabulary above.

---

## The loop

```
owner decision ─► decision record ─► tickets ─► handover ─► build ─► verify ─► gate ruling ─► record
   (planning)       (planning)       (planning)  (planning)  (implementing) (verifying) (owner)  (planning)
```

1. **Decide in a decision record.** A phase is locked by
   `docs/decisions/phase-NN-*-decision-record.md` before it is built
   (`phase-decision-record` skill). Its Acceptance criteria must be
   checkable; if they can't be written, the work isn't understood well
   enough to start.
2. **Break it into tickets.** `TFP-NNN`, in the record or a backlog file
   beside it (`implementation-backlog` skill). Each ticket has a
   problem it solves, scope, acceptance criteria and explicit dependencies.
   Before allocating numbers, check the highest `TFP-` in the repo — two
   sessions can be writing tickets at once.
3. **Hand over.** One current `docs/HANDOVER_TO_CLAUDE_CODE_<date>-<topic>.md`
   per workstream. A new handover deletes the one it replaces in the same
   commit; its history stays in git. The owner points Claude Code at the
   file; nobody pastes its contents into chat.
4. **Build.** Claude Code builds one ticket at a time, runs its checks,
   and shows evidence, not assertions (`QUALITY_GATES.md` §1).
5. **Verify.** A fresh session checks the report against the ticket before
   the next ticket starts at a gate, and on the highest-risk ticket of a
   phase.
6. **Rule.** At each gate the owner rules on the measured results. The
   ruling and its table are recorded under the gate in the decision record.
7. **Record.** The record's status line, `product-roadmap.md`, the
   deferred-work register and `TEST_PLAN.md` are updated in the same
   commit as the work they describe.

**Commits** go to `main` in small, reviewable commits, in Conventional
Commits form (`conventional-commits` skill): the body carries the why,
the alternatives rejected and what the change does not do. A commit that
completes a GitHub issue ends with `Closes #N`; progress on one with
`Refs #N`. GitHub issues hold outside reports and work that needs
visibility; `TFP-` tickets in `docs/decisions/` stay the design record, and
an issue that becomes a ticket carries its `TFP-` number in its title.

---

## Running Claude Code

These follow from the Claude Code team's current guidance (Boris Cherny's
and Cat Wu's practices, 2026) where they fit how TestForge is built.

**Auto mode for ticket implementation.** Auto mode is Claude Code's
starting permission mode from v2.1.283: a separate classifier reviews
actions and blocks risky ones instead of prompting for each. A locked
ticket already has its plan — the decision record — so the implementing
session goes straight to building; plan mode is for work that isn't
ticketed yet, or a change that can't be described in a sentence. Auto mode
does not replace the confirmation-required list above: the classifier
decides what is *risky*, the list decides what needs the *owner*.

**A correction becomes a rule, the same day.** When the owner corrects
Claude Code on something that would recur, the session proposes a one-line
addition to `CLAUDE.md` (or to the skill that should have caught it) in its
next commit. A lesson that lives only in a decision record is invisible to
the next session. Keep `CLAUDE.md` short: for each line, removing it should
cause a mistake. Ticket-specific rulings stay in the records.

**Context is the scarce resource.**
- One handover per fresh session; `/clear` between unrelated tickets.
- Read the section of a large file the ticket names, not the whole file.
  `TEST_PLAN.md` (about 300 KB), the deferred-work register and the roadmap
  are references, not reading lists.
- Research goes to a subagent so the implementing context stays on the
  build.
- RTK compresses shell output (`CLAUDE.md`); evidence stays unfiltered.

**Check before reporting.** Before a ticket is reported done, the session
runs its own checks, then a fresh-context review of the diff against the
ticket (Claude Code's `/code-review`, or a subagent given the ticket's
Acceptance section). Gate verification is still a separate session.

**Parallel work in worktrees — only when it's safe.** Independent tickets
can run in separate git worktrees, one Claude Code session each. Only when:
- the tickets touch different files (an SEO Standard set and an APG pattern
  batch, say), and neither changes the template baseline;
- each worktree has its own `npm install` and its own port;
- no measurement session is running — parallel builds skew timings, and
  measurements need a quiet machine.
Each worktree's work is verified and merged to `main` on its own; the
loop above applies to each.

---

## Routines

Recurring checks run on a schedule rather than when someone remembers.

| Routine | Cadence | What it does | State |
|---|---|---|---|
| Unit suite and template check | Nightly 02:00 UTC, plus manual dispatch | `.github/workflows/nightly.yml` | Running |
| Nightly summary email | After the nightly run | Quick-view summary with a link to results | TFP-217, ticketed |
| Living-docs check | Weekly | Checks `APPLICATION_OVERVIEW.md`, `README.md` and this file against the code and the roadmap (`repo-claim-audit` skill) and reports what is false or stale | Scheduled task, set up 2026-10-26 |
| Nightly-failure triage | After a red nightly | Reads the failing job and drafts an issue with the failing test, the first bad commit and a reproduction | Ticketed (see `docs/decisions/workflow-and-ci-backlog-2026-10-26.md`) |

A routine only *reports* or *drafts*. Anything it finds goes through the
loop like any other work.

---

## Docs that must stay true

| Doc | Says | Update when |
|---|---|---|
| `README.md` | How to set up and use TestForge, and its security model | A user-visible behaviour, setting or command changes |
| `docs/APPLICATION_OVERVIEW.md` | What TestForge is and does now, for a new reader | Every phase completion |
| `docs/decisions/product-roadmap.md` | Every phase, in order, with its status | Every lock, gate and completion |
| `docs/decisions/deferred-work-register.md` | Everything deferred, its build order and standing rules | Whenever a record defers or picks up work |
| `TEST_PLAN.md` | Case-by-case status and known limitations | In the commit that changes the behaviour |
| `docs/QUALITY_GATES.md` | Gates, evidence and verification | When a gate or check changes |
| This file | How work is done | When the loop changes; reviewed at each phase completion |

Each of these should carry its last-reviewed date near the top (the
overview and this file do; TFP-255 and TFP-256 add the rest). The weekly
living-docs check reports any that is older than the last phase completion.
