# TFP-063: does link-audit depth need to be relevance-weighted?

**Question:** TFP-040 generated 11 dedicated link-health tests
(`TFFU-029`–`TFFU-039`) for `test-assist`'s two, both-external, both-GitHub
links — classification, target-window behavior, hover/visited styling,
keyboard activation, href-protocol safety, per link. Would weighting
per-element enumeration depth by inferred relevance (e.g. footer/external
links get a lighter check, primary in-app links keep full depth) measurably
reduce noise without losing real coverage?

**Verdict: needs a second target first — not a code change now, and not a
"do it" either.** This is the honest read of a single data point, not a
default deferral.

## Why one target isn't enough to decide this

`test-assist` is a degenerate case for this specific question: exactly two
links, both external, both pointing at the same low-stakes destination class
(GitHub), on an app whose actual functionality (screen capture and
annotation) has nothing to do with link behavior at all. Eleven tests for
that pair looks like breadth without judgment — and on this target,
specifically, it was: none of the 11 caught a real defect (the one arguably
real finding, `TFFU-036`'s missing `:visited` styling, was itself noted as
"genuinely unclear whether worth fixing" for exactly two off-site links, not
a clear miss the depth justified).

But nothing here tests the other side of the claim. A target where links
actually carry the app's core functionality — primary navigation, a
multi-step checkout flow, an internal search-results list — would show
whether uniform depth catches something a relevance-weighted pass would
have skipped. `test-assist` structurally cannot answer that, because it has
no such links to test against.

## The asymmetry that makes this worth being careful about

The two possible mistakes here are not equally bad:

- **Over-testing** (today's behavior) fails loud and cheap: slower runs,
  more generated code to review, at worst a `:visited`-style finding nobody
  acts on. Easy to notice, easy to live with.
- **Under-testing** (what a relevance-weighting heuristic risks, if the
  heuristic is wrong about what's "primary") fails silent: a link the
  heuristic deprioritized breaks, and nothing in the generated suite would
  have caught it, and nobody finds out until a user does.

Building a heuristic on a sample size of one, where that one sample happens
to make uniform depth look wasteful, is exactly how the second, worse
failure mode gets introduced by accident.

## What would actually answer this

A second real dogfooding target with genuine link variety — a multi-page
site where some links are primary in-app navigation and others are
peripheral (footer, external, legal) — run through the same
crawl → introspect → generate pipeline, with the same before/after
comparison method `comparison-test-assist.md` already used. If uniform
depth on *that* target produces the same "breadth nobody needed" result on
the peripheral links while still exercising the primary ones adequately,
that's real evidence either way. Until then, this stays an open question,
not a ticket.

## Disposition

No ticket opened. `phase-17-walkthrough-backlog.md`'s TFP-063 closes as
resolved-by-this-finding: the gate this backlog sets for Phase 17
implementation requires this investigation to *finish*, not to reach a
particular verdict — it has finished, honestly, at "not enough evidence
yet."
