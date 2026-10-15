# Post-Phase 42 Review Plan

Date: 2026-10-15
Scope: the review the roadmap lists under "After Phase 42" (Emil,
2026-10-13), in the order it is done, with who does each step and what
counts as done.
Status: Agreed with Emil 2026-10-15. Code builds and runs only from a ticket
below; planning steps happen in Cowork first.

## Order

| # | Step | Who | Ticket |
| --- | --- | --- | --- |
| R1 | Baseline: the full regression | Code | TFP-207 |
| R2 | Flakes, from R1's evidence | Code | TFP-208 (written after R1) |
| R3 | Claims audit: every phase's claims against code and measurements | Cowork, with Emil | tickets it finds |
| R4 | Small security items | Code | TFP-206, TFP-209 |
| R5 | Three decisions: the Docker sandbox, app screens, scenario gaps | Cowork, with Emil | a decision record each |
| R6 | The skills relook | Cowork, with Emil | skill proposals |

R1 comes first so every later step works from today's numbers. R3 needs
R1's numbers. R4 can run alongside R3. R5 builds nothing until a decision
record is locked. R6 is last, so the skills describe what the review left.

## R1 — Baseline (TFP-207)

### TFP-207 — The full regression after Phase 42

- **Priority:** P1 · **Labels:** `measurement`, `benchmark`
- **Problem it solves:** the last clean full unit run predates TFP-205, the
  Toolshop score hasn't been taken since Phase 41's Gate B, and three test
  files fail once in a full run and pass alone.
- **Scope:**
  - the full unit suite three times, the regression suite once,
    `check:template-unchanged` once (against `18b47d8`: expected 166/166);
  - the Toolshop known-bug benchmark, Standard, both local copies
    (with-bugs, then clean, one at a time), Phase 40's selection unedited,
    the gap writer **off**, scored with TFP-154's rule;
  - every unit failure logged with its file, test, run number and message.
- **No Claude Code calls.** No code changes: a failure found here is
  recorded, not fixed (that is TFP-208, or a ticket from R3).
- **Acceptance criteria:**
  - evidence and a short `outcome.md` committed under
    `benchmarks/2026-10-1x-tfp207-regression/`;
  - the Toolshop score compared bug for bug with Phase 41's Gate B local
    score (TFP-188), each difference explained;
  - on clean, every failure matched to Gate B's labelled list; any new one
    named;
  - TFP-205's link tests: how many ran per copy, how many failed, and the
    in-context gap list per copy (expected: no links);
  - the flake table: each failing test, in how many of the three unit runs.
- **Time:** about 30 min of unit runs, 7 min regression, about 1.5 h for
  the two Toolshop copies. Projected times reported as it goes.
- **Stop for verification.**

## R2 — Flakes (TFP-208)

Written after R1 from its flake table. Done when each flaky test either has
its cause fixed (timing, a shared resource, load), with three full unit runs
clean, or is recorded as a known flake with its cause and a ticket.

## R3 — Claims audit (Cowork)

Each phase record (38 to 42), the README, `TEST_PLAN.md` and the handover
checked against the code and R1's numbers: claims that are false, stale or
undersold. Done when the findings are listed in a review findings doc, the
doc fixes are made from Cowork, and anything needing code is a ticket.

## R4 — Small security items (Code)

- **TFP-206** (in the Phase 42 record): allow exactly
  `response.request().method()` in the code check.
- **TFP-209 — Gap writer and run environment, the two batch 3 notes.**
  - Claude Code as gap writer stops loading Emil's CLAUDE.md, memory and
    hooks: `--safe-mode` if Claude Code 2.1.238 has it (check its CLI
    reference), otherwise the nearest documented equivalent, named in the
    commit; a stand-in test shows the flag is passed.
  - The run environment passes on proxy settings (`HTTP_PROXY`,
    `HTTPS_PROXY`, `NO_PROXY`, `NODE_EXTRA_CA_CERTS`) when they are set,
    and nothing else new; a test of `runEnv` shows it.
  - Done: targeted tests, unit and regression suites pass; no Claude Code
    call.

## R5 — Three decisions (Cowork first)

Each gets a decision record locked with Emil before any code:
1. **The Docker sandbox** for gap and candidate tests: what runs inside it,
   what leaves it, and the cost in run time.
2. **App screens** for the gap-writer opt-in and candidate promotion
   (today API routes only): what Emil sees and approves.
3. **Scenario gaps,** the gap writer's redefined purpose: how a scenario
   gap is found, what Claude Code is asked, how it is measured (a benchmark
   that can discriminate, unlike TFP-197's), and the rule against
   self-confirming checks.

Done when each record is locked; its tickets then join the backlog.

## R6 — The skills relook (Cowork)

`docs/CLAUDE_SKILLS.md`, Martin's draft QA/SRE skills and the Cowork skills
read against what Phases 38 to 42 and the review changed. Done when each
skill is kept, updated or retired, and new skills for repeatable procedures
seen in this work are proposed for Emil to save.
