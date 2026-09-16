# TestForge, Reconsidered

*A reply to `docs/REIMAGINING.md` — Emil, 16 September 2026*

Your brief made me look harder at this than I had in weeks. Here's what's
changed since you wrote it, my answers to your four questions, and the
shape of what I actually want to build.

## First — a correction: the numbers here are already out of date

Phase 16 finished locally back in August, but never got pushed — so
everything you looked at on GitHub was the pre-restructuring codebase.
It's on `origin/main` now. Concretely:

- FastAPI backend (`app.py`) — deleted entirely, not just proposed
- `page.tsx` — 4,739 lines → 353, no code editor left in it
- `run/route.ts` — 2,226 lines → 120
- `generate/route.ts` — 2,415 lines → 67, with the prompt itself already
  living alone in a 29-line file (`src/lib/generate/prompt.ts`)

So "12,000 lines of plumbing around 13 good lines" isn't quite the shape
of the problem anymore — that part's done. I take that as a good sign,
not a rebuttal: we landed on almost the same diagnosis independently.

## Your four questions

**Q1. Is TestForge parked, or paused?**

Paused, deliberately — not abandoned. The plan was always to get
test-assist out the door as a polished product first, before opening
this next question.

**Q2. Does deleting the app feel like losing the work?**

Yes, honestly — especially now that I can see how much of that
"12,000 lines" is real, recently-finished product. But splitting out the
prompt and a problem statement as a starting artifact makes sense to me
now, and I expect more of this to surface as I keep building test-assist,
in the direction your brief is pointing.

**Q3. Which agent do you target first?**

Claude Code. Making it portable to Copilot or Cursor is a real question,
but a later one — I'm not designing for three targets before I've proven
it works for one.

**Q4. Is honest-coverage one skill, or the whole product?**

Not enough on its own. Testing isn't one discipline, and treating a
single skill as the whole product undersells it — though honest-coverage
specifically might stand alone for narrower uses. I want to be careful
not to overstate that.

## Where this leaves me: what I'd like to do

Not a rewrite, and not a deletion — additive. A `skills/` directory that
grows alongside TestForge, not instead of it. Three moves, in order:

1. **Package what's already isolated.** The prompt plus a problem
   statement from the README, built and tested as a real Claude Code
   skill — `write-playwright-test`, the floor skill from your brief, not
   the differentiator.
2. **Write the roadmap down, not just the code.** A `skills/ROADMAP.md`
   recording your other four ideas — `honest-coverage`,
   `dont-stub-what-you-prove`, `find-the-hidden-platform`, `plan-to-specs`
   — as candidates, explicitly not commitments, so this doesn't quietly
   collapse into one flagship skill by accident.
3. **Check before rebuilding.** A short spike on whether Playwright MCP
   already covers what `introspect`/`crawl` do — the one genuine loss you
   flagged — before anyone spends time reconstructing roughly 1,200 lines
   of DOM-exploration logic that might not need reconstructing at all.

Ticketed as TFP-034, TFP-035, and TFP-036 in
[`docs/decisions/phase-17-skills-extraction-backlog.md`](./decisions/phase-17-skills-extraction-backlog.md).
Happy to walk through it in detail.
