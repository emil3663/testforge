# TestForge — a creative brief for the second version

**From:** Martin
**Date:** 15 September 2026
**Status:** A proposal. Disagree with any of it.

---

## The short version

TestForge v1 is a 12,000-line application wrapping a 13-line prompt.

Those 13 lines are the valuable part. The reimagining keeps them, deletes the
application, and adds the thing you have that nobody else is encoding:
**judgment about what a test actually proves.**

Not a smaller app. Not an app at all.

---

## Why the premise moved

When you started in April, the thesis was right:

> *"Testers are told: 'Learn to code.' They struggle — not because they're not
> smart enough, but because automation frameworks were built by developers for
> developers."*

That is still the best sentence in any of your repos. But the gap it names has
changed shape underneath you. In April, closing it needed a bespoke app that
turned English into Playwright. Today Copilot and Cursor are already installed
in most testers' VS Code and write Playwright natively, without TestForge.

**The syntax gap is closing on its own. The judgment gap is not.**

Nobody is shipping the thing that stops an agent writing a test that passes
and proves nothing. That is the gap worth owning, and you are unusually
well placed to own it — because you have already been caught by it and wrote
down what you learned each time.

---

## What v1 proves, and what it costs

Look at what `src/app/api/generate/route.ts` actually contains. 2,415 lines, of
which the part that matters is:

```
- Prefer user-visible locators (getByRole, getByLabel...) over CSS selectors.
- Include assertions that verify visible outcomes, not implementation details.
- Write descriptive test names that a non-developer tester could understand.
- Keep the code concise but complete — no TODO stubs.
```

Thirteen lines of real expertise. The remaining 2,400 are plumbing to deliver
them to a model.

The same pattern repeats:

| File | Lines | What it rebuilds |
|---|---|---|
| `src/app/page.tsx` | 4,739 | a code editor |
| `src/app/api/run/route.ts` | 2,226 | a terminal |
| `src/app/api/generate/route.ts` | 2,415 | a model call around 13 good lines |

An agent already has an editor, a terminal, file access and repo context. The
harness is the expensive half and the replaceable half.

**None of that was wasted.** You could not have found the 13 lines without
building the thing around them, and the problem statement in that README came
out of doing it. v1 is how you learned what v2 should be.

---

## The idea

Take an agent that already exists — Claude Code, Copilot, Cursor — and give it
a set of skills that make it a good tester rather than merely a fast typist.

**You have already built this pattern.** `cah-pwa/skills/` holds four of them,
and they are well-formed:

```
skills/phase-decision-record.md
skills/runtime-prompt-replacement.md
skills/prompt-template-format.md
skills/llm-fallback-pattern.md
```

Opening with *"What this skill is for"* and *"Inputs you need from the user"*
is exactly the right shape. This brief is not asking you to learn a new
pattern. It is asking you to point one you already built at the subject you
know better than the people writing the agents.

---

## What goes in it

Five skills. One is table stakes; four are yours alone.

### 1. `write-playwright-test` — the foundation

The 13 lines from `SYSTEM_PROMPT`, expanded properly. User-visible locators,
assertions on outcomes not implementation, names a non-developer can read, no
TODO stubs.

**Be honest that this one is not a differentiator.** Every Playwright skill on
GitHub has a version of it. It is the floor, and it needs to be there so the
rest has something to stand on.

### 2. `honest-coverage` — the one nobody else has

After the agent writes tests, it must state what they **do not** prove.

You have done this twice, unprompted, better than most professional teams:

> *"Offscreen testing does not prove that Qt dispatches events correctly in a
> real window, that the layout is usable, that anything is legible, or that a
> capture on real mixed-DPI hardware comes out the right size."*
> — `DESKTOP_STABILITY_MATRIX.md`

> *"Read this before drawing conclusions from the number of files in this
> directory. The count is large and most of it is scaffolding."*
> — `cah-pwa/tests/README.md`

Encode that. The skill produces a stability-matrix-shaped output: every case
rated, every limitation named, and a plain statement of what a green run still
leaves unknown.

**This is the whole pitch.** An agent that writes tests is commonplace. An
agent that tells you what its tests are not covering does not exist.

### 3. `dont-stub-what-you-prove` — TA-227, generalised

A review skill. It reads a test and asks whether the thing being asserted is
the thing being mocked.

Your own words on finding this in your code:

> *"A green test that proves nothing is worse than no test, because it also
> removes the suspicion that would have led someone to look."*

Agents produce this failure constantly — it is the path of least resistance
when a dependency is awkward. Nothing currently catches it.

### 4. `find-the-hidden-platform` — TA-230, generalised

A `skipif` guard hides a platform; it does not cover it. So does any
default-off flag, any `monkeypatch` that replaces the thing under test, any
path the suite avoids for a good reason.

You wrote TA-230 after this cost time **three times in two days** — including
twice in one week of outside contributions, where a suite stayed green while
the application died on startup.

The skill audits a repo for paths that are structurally unreachable by its own
tests, and reports them as a list. That is a five-minute answer to a question
most teams never think to ask.

### 5. `plan-to-specs` — the generator, portable

`TEST_PLAN.md` as the source of truth, mechanically expanded into a spec tree
that maps one-to-one onto case IDs, with drift detection in both directions.

You have now built this twice — in `cah-pwa/scripts/` and again in the
`generator-improvements` branch. The second version added the part that makes
it a tool rather than a script: **`--check`**, which reports coverage as
*"22 of 181 cases"* rather than *"229 spec files"*, and exits non-zero when
the plan and the tree disagree.

Generalise it so it works against any repo's test plan, not just that one.

---

## What gets deleted

- The Next.js application
- The FastAPI backend
- The in-browser editor
- The run endpoint

Roughly 12,000 lines. Keep the README's problem statement — it is the best
thing in the repository and it survives the change unaltered.

**One genuine loss worth naming:** `introspect` (868 lines) and `crawl` (439)
explore the app under test to find real selectors. That is the one capability
an agent does not have out of the box. Check whether Playwright MCP covers it
before rebuilding — it probably does, and if it does, that is 1,300 lines you
do not maintain.

---

## What the repo becomes

```
README.md              the problem statement, unchanged
skills/                five files
examples/              a real suite built with them, warts recorded
CONTRIBUTING.md        how to add a skill
```

Plus one thing that would make it genuinely uncommon: **the skills tested
against themselves.** Run an agent with `honest-coverage` over a repo with a
known blind spot and assert it finds it. You already built the equivalent for
the generator — 11 tests for the thing that produced 228 files.

---

## What success looks like

Not stars. Someone you have never met using `honest-coverage` on their own
repo and finding something they did not know.

The narrower measure: **a hiring manager reading `honest-coverage.md` and
understanding within thirty seconds that you think about testing differently
from the last twenty candidates.** v1 could not do that — it needed Docker, a
running Plane instance and ten minutes. Five markdown files do it in a
browser tab.

---

## Questions only you can answer

1. **Is TestForge parked or paused?** Nothing since 9 July. If you moved on
   deliberately, this brief is a proposal to come back; if you got pulled into
   `test-assist`, it is a suggestion about where to point the next stretch.
2. **Does deleting the app feel like losing the work?** It should not — the
   13 lines and the problem statement are the work — but that is a real
   feeling and worth saying out loud rather than arguing away.
3. **Which agent do you target first?** Skills that work everywhere are
   weaker than skills that work excellently somewhere. Pick one, do it
   properly, generalise later.
4. **Is `honest-coverage` one skill or the whole product?** It may be strong
   enough to stand alone, with the other four as supporting material.

---

## Why this one and not the others

You have six public repos. This is the only one whose subject is the thing you
are actually expert in — and the only one where the expertise is not
incidental to the app, but is the entire product.

Everything else demonstrates that you can build. This would demonstrate that
you know something.
