# Phase 17 pre-lock backlog: generator hardening from TFP-042

**Version:** 1.0
**Date:** 2026-09-17
**Status:** Shipped — all 11 tickets (TFP-053 through TFP-063) landed. TFP-053-061 are individually verified live against test-assist per TEST_PLAN.md's own test case table (INT-04/05/06, GEN-11 through GEN-17, all ✅); TFP-062/063 were resolved as doc-only tickets (`eb4ad3f`). This doc's header was never updated when the work landed. Corrected 2026-09-23 (Cowork verification pass).

## Context

`docs/decisions/product-roadmap.md`'s own Sequencing note says Phase 16 is
followed by "a live walkthrough of what \[TestForge\] actually
produced ... before Phase 17's decision record is drafted," and that the
walkthrough "may change what 'honest coverage' needs to mean in practice
before that phase is locked." TFP-040/041/042 (`examples/`) already ran
that walkthrough — TestForge's real generator against `test-assist`,
compared against a hand-authored skill-only suite and against
`test-assist`'s own mature 55-test suite. This backlog is what that
walkthrough actually found, turned into scoped tickets, per Emil's request
to extract concrete enhancements from `examples/comparison-test-assist.md`
rather than leave it as a read-only finding.

Every ticket below is traced to a real file and line in the generator, not
inferred from the comparison doc's summary alone — re-read directly for
this backlog:

- `src/lib/introspect/types.ts` — `ActionableElementDetail` has no
  `isVisible` field. `LinkDetail` and `EmbeddedLinkDetail` do.
- `src/lib/introspect/dom-snapshot.ts` — `isVisibleElement()` (line 317)
  already computes real visibility (`display`, `visibility`, bounding
  rect) and is already called for links (line 555) and embedded links
  (lines 606, 640) — but never for the `actionableElements` array itself
  (built lines 407–493), which is exactly the element type behind all 7
  confirmed false positives (`#btnRecord`, `#btnClearSession`,
  `#uploadImage`, `#btnStopRecord`, `#textInput`, `#btnTextOk`,
  `#btnTextCancel`).
- `src/lib/generate/mock/actionable-elements.ts` — the per-element test
  template emits an unconditional `await expect(locator).toBeVisible();`
  in six separate branches (lines 94, 125, 127, 129, 131, 132), none of
  them able to know an element is conditionally hidden by design, because
  that information doesn't exist upstream.
- `src/lib/generate/mock/generic-suites.ts` — the entire Accessibility
  (line 40), Responsive (line 16), and Usability (line 225, in
  `buildGenericSuites`) best-practice tests are **hardcoded template
  strings that never reference `contentProfile` at all** — unlike
  Functional coverage, which already builds real per-element tests via
  `buildActionableElementTests`. This is the root cause of the comparison's
  "one test each, neither asserts much" finding — it isn't a data gap on
  its own, it's unused data: `LocatorHint.role`/`.name`/`.label` are
  already captured per element and already sitting unused in these three
  templates.

## What this backlog can and can't close

TFP-053 through TFP-059 are mechanical: capture more per-element truth
during introspection, then have the existing best-practice templates
consume it instead of emitting the same fixed string regardless of target.
TFP-060 and TFP-061 extend the same pattern to two specific behavioral
signals (paired actions, drag targets) that are still discoverable
statically.

**TFP-042's own clearest finding doesn't fully close from this backlog**,
and the backlog doesn't pretend it does: `test-assist`'s suite catches
keyboard shortcuts, zoom accuracy, snapshot-gallery CRUD ordering, and
verified *effects* of actions (does Undo actually remove the shape, not
just "does clicking Undo return a response") because it was built
iteratively by someone who used the running app, not from a single static
snapshot of its DOM. Static introspection has no signal for a keyboard
shortcut unless the app declares `aria-keyshortcuts` (most don't, including
`test-assist`), no way to verify a canvas mutation without executing and
inspecting the interaction sequence, and no concept of "the second export
in the same millisecond stays distinct" without knowing the feature exists
to test. That class of gap is what Phase 19 (path/journey mapping) is
roadmapped to narrow — sequences of actions and their observable effects,
not single-element enumeration — and TFP-062 below flags a related scope
gap in Phase 18 worth resolving before that phase locks. Closing the
human-tester-instinct gap entirely isn't this backlog's claim.

## Backlog

### TFP-053 — Capture per-element visibility during introspection

- **Phase:** 17 (pre-lock)
- **Priority:** P0
- **Suggested labels:** `bug`, `introspection`
- **Problem it solves:** `ActionableElementDetail` has no `isVisible`
  field, so every downstream consumer must assume every discovered element
  is unconditionally visible — the exact assumption that produced 7
  confirmed false positives in TFP-040's real run.
- **Scope:**
  - Add `isVisible: boolean` to `ActionableElementDetail`
    (`src/lib/introspect/types.ts`).
  - Populate it in `dom-snapshot.ts`'s actionable-element mapping (~line
    462) using the existing `isVisibleElement()` helper (line 317) — the
    same function already used for `LinkDetail`/`EmbeddedLinkDetail`, not
    a new implementation.
- **Deliverables:**
  - Updated `ActionableElementDetail` interface and population.
- **Acceptance criteria:**
  - Introspecting `test-assist` locally reproduces the known cases:
    `#btnRecord`, `#btnClearSession`, `#uploadImage`, `#btnStopRecord`,
    `#textInput`, `#btnTextOk`, `#btnTextCancel` all report
    `isVisible: false`.
  - Existing introspection tests (`npm run test:regression`) pass
    unchanged except where they assert on the now-larger interface shape.
- **Dependencies:** None.

#### INT-04 evidence

Moved word for word from [`docs/test-plan/INT.md`](../test-plan/INT.md) by TFP-253; the case's row there links here.

**Test:** Actionable elements report `isVisible` (TFP-053, automated: "introspect reports isVisible on every discovered actionable element")

**Expected result:** Every discovered actionable element carries a boolean `isVisible`. Verified live against `test-assist`, separately from this suite: `#btnRecord`, `#btnClearSession`, `#uploadImage`, `#btnStopRecord`, `#textInput`, `#btnTextOk`, `#btnTextCancel` all report `isVisible: false` — this repo's own landing page has no naturally-hidden element to assert the `false` case against directly.

### TFP-054 — Stop asserting unconditional visibility for conditionally-hidden elements

- **Phase:** 17 (pre-lock)
- **Priority:** P0
- **Suggested labels:** `bug`, `generation`
- **Problem it solves:** the actual root cause of TFP-040's 7 false
  positives — the generator has no way today to express "this element
  exists but is legitimately hidden until X happens," so every per-element
  test in `buildActionableElementTests` defaults to the strongest claim.
- **Scope:**
  - In `src/lib/generate/mock/actionable-elements.ts`, gate all six
    `await expect(locator).toBeVisible();` emission points (lines 94, 125,
    127, 129, 131, 132) on `element.isVisible` (from TFP-053).
  - When `element.isVisible` is `false` at introspection time, generate an
    existence/attached assertion (`await expect(locator).toBeAttached();`)
    plus a comment noting the element was hidden at introspection and may
    require a prerequisite action — not a silently dropped test, and not a
    false claim either.
  - Do not change behavior for elements that were visible at introspection
    — this ticket removes false positives, it doesn't loosen real
    coverage.
- **Deliverables:**
  - Updated per-element template branches.
- **Acceptance criteria:**
  - Regenerating TFP-040's exact suite against `test-assist` (same
    description, same `selectedPractices`) produces 0 failures on the 7
    named cases, with the affected tests now asserting attachment instead
    of a false visibility claim.
  - No regression in the 34 currently-passing tests from that same run.
- **Dependencies:** TFP-053.

#### GEN-11 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** An element hidden at introspection time does not get an unconditional visibility claim (TFP-054, automated: "does not assert unconditional visibility for an element hidden at introspection time")

**Expected result:** A synthetic element with `isVisible: false` generates `toBeAttached()` plus a "Hidden at introspection time" comment, not `toBeVisible()`. Verified live against `test-assist`: regenerating TFP-040's exact suite now produces 0 of the 7 originally-confirmed false positives (41 of 42 passing; the 42nd, `TFFU-036`, is a separate, pre-existing finding unrelated to visibility).

### TFP-055 — Capture ARIA state and toggle-group membership during introspection

- **Phase:** 17 (pre-lock)
- **Priority:** P0
- **Suggested labels:** `introspection`, `accessibility`
- **Problem it solves:** introspection captures `role` (via `getRole()`)
  but no ARIA *state* (`aria-pressed`, `aria-selected`, `aria-checked`,
  `aria-expanded`) and no signal that several elements form a
  mutually-exclusive toggle/selection group. This is precisely the shape
  of TA-252's finding (a `.tool-btn` list with only a CSS `.active` class,
  no ARIA state) — a gap TestForge's own generator currently has no data
  to catch, which is why only the hand-directed `write-playwright-test`
  skill run caught it and the generated suite's one `Accessibility
  Coverage` test (`TFAC-001`) didn't.
- **Scope:**
  - Extend `ActionableElementDetail` (or `LocatorHint`) with the four ARIA
    state attributes, read directly off the element in `dom-snapshot.ts`.
  - Detect toggle/selection groups heuristically: elements sharing a
    common container (`containerLabel`, already computed) with role
    `button`/`radio` and near-identical structure — the same kind of
    ancestor/sibling reasoning `findContainerLabel` already does, not a
    new discovery mechanism.
- **Deliverables:**
  - Updated `ActionableElementDetail`/`LocatorHint` with ARIA state fields
    and a group identifier.
- **Acceptance criteria:**
  - Introspecting `test-assist` reports the 7 `.tool-btn` elements as a
    detected group, each with no ARIA state attribute present — the exact,
    correct finding TA-252 was filed from.
- **Dependencies:** None (can land alongside TFP-053).

#### INT-05 evidence

Moved word for word from [`docs/test-plan/INT.md`](../test-plan/INT.md) by TFP-253; the case's row there links here.

**Test:** Actionable elements report ARIA state and toggle-group membership (TFP-055, automated: "introspect reports ARIA state and toggle-group membership on actionable elements")

**Expected result:** Every discovered actionable element carries `ariaPressed`/`ariaSelected`/`ariaChecked`/`ariaExpanded`/`groupId` as `string \| null`. Verified live against `test-assist`, separately from this suite: the seven `.tool-btn` elements are detected as one group (`role` `button` + shared `containerLabel` + 3+ members), each reporting a real `ariaChecked` value now that TA-252 has shipped; `strokeColor`/`strokeSize`/`fillOpacity` (role `textbox`) and `Undo`/`Redo`/`Clear` (one-shot action verbs) are correctly excluded from grouping.

### TFP-056 — Generate accessibility coverage from real per-element data

- **Phase:** 17 (pre-lock)
- **Priority:** P1
- **Suggested labels:** `generation`, `accessibility`
- **Problem it solves:** `buildSharedBestPracticeSuites`'s accessibility
  block (`generic-suites.ts`, line 40) is one hardcoded string —
  `interactiveCount > 0` plus one heading check — regardless of what was
  actually discovered. `LocatorHint.role`/`.name`/`.label` are already
  captured per element and sitting unused here.
- **Scope:**
  - Replace the hardcoded accessibility test with one generated per
    discovered actionable element (or a representative sample, consistent
    with `buildActionableElementTests`'s own `.slice(0, 50)` pattern):
    assert each has a non-empty accessible name (`locator.name`) and a
    valid `role`.
  - Keep the existing structure/heading check as a baseline addition, not
    a replacement.
- **Deliverables:**
  - Data-driven accessibility suite builder.
- **Acceptance criteria:**
  - Regenerating against `test-assist` produces an accessibility suite
    with more than 1 test, each naming a real discovered element.
  - Regenerating against a page with no actionable elements still produces
    a valid (non-empty) suite — no crash on the empty case.
- **Dependencies:** None (independent of TFP-055; stronger in combination
  with it).

#### GEN-13 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** Accessibility suite asserts a real accessible name and role per discovered element (TFP-056, automated: "generates per-element accessible-name and role checks, skipping hidden elements")

**Expected result:** A visible synthetic element generates a `toHaveAccessibleName(/.+/)` plus an `ariaSnapshot()`-derived role check; a hidden one (`isVisible: false`) gets the same `toBeAttached()` treatment as GEN-11 instead, since accessible-name/role computation is undefined for an element excluded from the accessibility tree. Verified live against `test-assist`: 24 of 31 discovered elements got a real per-element check, all passing (`TFAC-002`…`TFAC-031`), including one that caught a genuine finding first try — `#uploadImage` had no accessible name under a hand-rolled text/aria-label/placeholder/title heuristic; switching to Playwright's own `toHaveAccessibleName` (which follows the real accname algorithm, including the wrapping `<label>` test-assist actually uses) resolved the false positive.

### TFP-057 — Generate ARIA-state-toggle assertions for discovered groups

- **Phase:** 17 (pre-lock)
- **Priority:** P1
- **Suggested labels:** `generation`, `accessibility`
- **Problem it solves:** even once ARIA state is known to be missing
  (TFP-055), nothing generates a test that would have flagged it as a
  *defect* rather than just a data point — this ticket is what turns the
  captured gap into an actual failing assertion a generated suite ships
  with.
- **Scope:**
  - For each detected toggle/selection group (TFP-055), generate a test
    asserting every member exposes at least one ARIA state attribute.
  - Where an ARIA state attribute is present, generate a second test that
    clicks one member and asserts its state attribute changes and a
    sibling's changes back — the actual "toggles correctly" behavior, not
    just presence.
- **Deliverables:**
  - Group-level ARIA assertion templates.
- **Acceptance criteria:**
  - Regenerating against `test-assist` today (pre-TA-252 fix) produces a
    failing test naming the `.tool-btn` group's missing ARIA state.
  - Regenerating against `test-assist` after TA-252 lands produces a
    passing test asserting `aria-pressed`/`aria-selected` toggles on
    click.
- **Dependencies:** TFP-055.

#### GEN-12 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** A detected toggle group generates an ARIA-state assertion (TFP-057, automated: "generates a toggle-group ARIA assertion for a detected selection group")

**Expected result:** A synthetic 3-member `groupId`-sharing group generates a presence test (every member exposes an ARIA state attribute) and, since one member's `ariaChecked` is `"true"`, a toggle-behavior test. Verified live against `test-assist`: the generated accessibility suite's `TFAC-002`/`TFAC-003` both pass now that TA-252 has shipped and every `.tool-btn` reports a real `aria-checked`. The pre-TA-252 "produces a failing test naming the missing ARIA state" half of this ticket's acceptance criteria was confirmed by tracing the generator's own logic (no member would have `activeAriaStateField()`, so the toggle test wouldn't generate at all and the presence test's `toBeTruthy()` would fail), not re-verified live against a reverted target.

### TFP-058 — Generate responsive coverage from real elements, add a touch smoke check

- **Phase:** 17 (pre-lock)
- **Priority:** P2
- **Suggested labels:** `generation`, `responsive`
- **Problem it solves:** the Responsive template (`generic-suites.ts`,
  line 16) only checks `body` and the first heading across three
  viewports, regardless of what the page actually contains, and never
  exercises touch input despite apps like `test-assist` wiring
  `touchstart`/`touchmove`/`touchend` handlers separately from mouse ones.
- **Scope:**
  - Extend the viewport loop to also assert a sample of real discovered
    interactive elements (not just body/heading) remain visible and
    tappable at each size.
  - Add a generic touch-dispatch smoke assertion at the mobile viewport
    size for discovered elements — dispatch synthetic touch events via
    Playwright and assert no error / the same response a click would
    produce, since static introspection can't reliably detect
    touch-specific JS handlers without runtime instrumentation, which is
    out of scope here.
- **Deliverables:**
  - Data-driven responsive suite builder with a touch-smoke addition.
- **Acceptance criteria:**
  - Regenerating against `test-assist` produces a responsive suite that
    references at least one real discovered element by name, at each
    viewport.
- **Dependencies:** None.

#### GEN-14 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** Responsive suite checks real discovered elements per viewport and adds a touch smoke test (TFP-058, automated: "checks real discovered elements across viewports and adds a touch smoke test")

**Expected result:** The viewport loop asserts up to 5 real `isVisible: true` elements stay visible at each of mobile/tablet/desktop, in addition to the existing `body`/heading check; a separate test dispatches `touchstart`/`touchend` at mobile viewport on one of those elements as an explicit smoke check (static introspection can't see touch-specific handlers, so this claims only "doesn't error on tap," not app-specific touch behavior). Verified live against `test-assist`: `TFRM-001` (5 real elements checked per viewport) and `TFRM-002` (touch smoke) both pass.

### TFP-059 — Generate usability coverage from real elements instead of duplicating functional's count check

- **Phase:** 17 (pre-lock)
- **Priority:** P2
- **Suggested labels:** `generation`, `usability`
- **Problem it solves:** the usability block in `buildGenericSuites` (line
  225) and the shared usability block in `buildSharedBestPracticeSuites`
  both reduce to "count of visible interactive elements > 0" — functionally
  the same claim `TFUS-001` already makes, giving usability no distinct
  signal at all.
- **Scope:**
  - Replace with assertions specific to usability rather than existence:
    every discovered element with a `label`/`placeholder` has visible,
    non-generic text (not just "Submit" with no context) where
    `LocatorHint` data allows that judgment; primary actions (inferred via
    existing `inferCategory`) are reachable without scrolling on first
    paint at desktop viewport.
- **Deliverables:**
  - Data-driven usability suite builder distinct from the accessibility
    and functional ones.
- **Acceptance criteria:**
  - Usability and Functional suites no longer assert the same claim in
    different words for the same target.
- **Dependencies:** None.

#### GEN-15 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** Usability suite asserts content-specific claims instead of an interactive-element count (TFP-059, automated: "replaces the usability interactive-count check with content-specific assertions")

**Expected result:** Per-element checks assert any labeled/placeholder-bearing element's text isn't a generic phrase (`submit`, `click here`, `ok`, …); a combined check asserts up to 5 `isVisible: true` elements from the `form`/`action` categories have a bounding box above the desktop fold (900px). Elements hidden at introspection time are excluded from the sample entirely, not attach-only fallback like GEN-11/GEN-13 — a first pass without that filter flagged test-assist's own hidden `#btnRecord` as a false "not rendered on first paint" failure. Verified live against `test-assist`: `TFUS-002`…`TFUS-007` all pass.

### TFP-060 — Auto-generate a paired negative assertion for discovered action pairs

- **Phase:** 17 (pre-lock)
- **Priority:** P2
- **Suggested labels:** `generation`, `enhancement`
- **Problem it solves:** every generated test asserts what *should*
  happen; none assert what should *not* — the exact shape of `test-assist`'s
  own `UR-08` ("a bare click adds no undo step"), which neither generated
  suite comes close to because the generator only ever emits positive
  claims.
- **Scope:**
  - Detect common action-pair patterns from discovered elements' inferred
    names/roles (undo/redo, save/discard, open/close — matched by name
    heuristics similar to `inferCategory`'s existing text matching).
  - When a pair is found, generate one companion test: performing an
    unrelated no-op interaction does not enable/trigger the paired
    element's action state.
- **Deliverables:**
  - Paired-action detection and negative-assertion template.
- **Acceptance criteria:**
  - Regenerating against `test-assist` (which has Undo/Redo) produces at
    least one negative-assertion test.
  - No false positive on targets with no matching pairs — the check is
    additive, not required.
- **Dependencies:** None.

#### GEN-16 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** A detected action pair (e.g. Undo/Redo) gets a negative-assertion regression guard, and only a real pair does (TFP-060, automated: "generates a negative-assertion test for a detected action pair, and only for it")

**Expected result:** Two exactly-matching elements from a fixed opposite-word list (undo/redo, save/discard, open/close, …) generate one test asserting a wholly unrelated interaction (a mouse move to a neutral point) doesn't change either element's enabled state or text; an unpaired third element (no matching counterpart) generates nothing. Verified live against `test-assist`: exactly one pair test generated (Undo/Redo), passing, with no spurious pair among Select/Highlight/Text/Circle/Arrow/Rectangle/Pen or Save PNG/Export JSON.

### TFP-061 — Detect drag-and-drop targets and generate a basic coverage test

- **Phase:** 17 (pre-lock)
- **Priority:** P2
- **Suggested labels:** `generation`, `enhancement`
- **Problem it solves:** neither generated suite tests drag-and-drop at
  all (`test-assist`'s `IC-08`, "dropping a non-image file is ignored
  silently," has no equivalent in either), despite drop targets being
  statically discoverable via `[draggable]`/`ondragover`/`ondrop`
  attributes, unlike keyboard shortcuts or touch handlers.
- **Scope:**
  - Extend `dom-snapshot.ts` to flag elements with `[draggable]`, or
    listeners implied by `ondragover`/`ondrop` attributes (same pattern
    already used for the `[onclick]` heuristic scan at line ~605).
  - Generate one basic test per detected drop target: dispatch a file drop
    with valid content and assert some observable change; where feasible,
    a second test with invalid content asserting no crash/silent
    rejection — matching `IC-08`'s actual shape.
- **Deliverables:**
  - Drop-target detection plus a basic drag-and-drop test template.
- **Acceptance criteria:**
  - Regenerating against `test-assist` detects its canvas as a drop
    target and produces at least one drag-and-drop test.
- **Dependencies:** None.

#### GEN-17 evidence

Moved word for word from [`docs/test-plan/GEN.md`](../test-plan/GEN.md) by TFP-253; the case's row there links here.

**Test:** A detected drop target gets valid- and invalid-content drag-and-drop tests (TFP-061, automated: "generates valid- and invalid-content drag-and-drop tests for a detected drop target")

**Expected result:** A drop target generates a valid-content test (drops a real 1x1 PNG via a dragover+drop DragEvent sequence, asserting an observable DOM change and no uncaught page error) and an invalid-content test (drops a text file, asserting only no crash). Verified live against `test-assist`: both generated tests pass against the real canvas.

#### INT-06 evidence

Moved word for word from [`docs/test-plan/INT.md`](../test-plan/INT.md) by TFP-253; the case's row there links here.

**Test:** Pages report drag-and-drop targets (TFP-061, automated: "introspect reports dragDropTargets as a well-shaped array")

**Expected result:** Every page carries a `dragDropTargets` array with `isVisible`/`isDraggableSource`/`isDropTarget` booleans and a string `tagName`. Detection dispatches a non-bubbling synthetic `dragover` event per candidate and checks `defaultPrevented`, since real drop targets (test-assist's canvas included) attach handlers via `addEventListener`, invisible to an attribute-only scan. Verified live against `test-assist`, separately from this suite: introspecting test-assist detects exactly one drop target, the real `<main class="canvas-wrap">` — a first pass with a bubbling probe also flagged 6 of its own descendants as false positives, since the probe's event bubbled into the ancestor's real listener; disabling bubbling on the probe (not on the generated test's own drop simulation, which still bubbles like a real interaction) fixed it.

### TFP-062 — Resolve Phase 18's scope gap on local (non-network) failure injection

- **Status: Resolved.** `product-roadmap.md`'s Phase 18 section now carries
  the addendum directly — local storage-API failure injection is in scope,
  sized alongside the existing network-dependency map, not a placeholder.
- **Phase:** 17 (pre-lock) / informs Phase 18
- **Priority:** P1
- **Suggested labels:** `investigation`, `roadmap`
- **Problem it solves:** TFP-042 found `test-assist`'s own suite covers
  `SP-05`/`SP-06` — a schema-mismatch session discard and a
  storage-unavailable degraded mode — by knowing `app.js`'s real failure
  handling. `docs/decisions/product-roadmap.md`'s Phase 18 scope is
  written specifically around **outbound dependencies** ("XHR/fetch
  targets, form action hosts, third-party scripts... `page.route()` to
  block or fail each dependency"). Local browser-API failure (IndexedDB
  throwing, a corrupted/old-schema record already in storage) is a
  different failure class `page.route()` cannot inject at all, and Phase
  18 as currently scoped doesn't mention it.
- **Scope:**
  - Not a code change: confirm this reading of Phase 18's roadmap text is
    correct (re-read `product-roadmap.md`'s Phase 18 section against this
    finding).
  - If confirmed, propose the smallest addition to Phase 18's eventual
    decision record that covers local-storage-API failure injection
    (seeding a corrupted/old-schema value before load; mocking
    `indexedDB.open` to fail) alongside the existing network-dependency
    scope — sized the same way TFP-052 scoped `sre-release` down to what
    this project actually needs, not a generic "chaos testing" expansion.
- **Deliverables:**
  - A short addendum note in `product-roadmap.md`'s Phase 18 section (or a
    flag in Phase 18's future decision record) naming this as in-scope.
- **Acceptance criteria:**
  - Phase 18's scope, once locked, either explicitly includes local
    failure injection or explicitly and deliberately excludes it — not
    silent on the question the way it is today.
- **Dependencies:** None.

### TFP-063 — Calibrate per-element enumeration depth against target relevance

- **Status: Resolved — verdict "needs a second target first."** Full
  reasoning in `examples/link-audit-depth-findings.md`: one data point can't
  distinguish "uniform depth is generally wasteful" from "it happened to be
  wasteful on test-assist's degenerate two-link case," and the two possible
  mistakes (over-testing vs. silently under-testing something that mattered)
  aren't symmetric enough to guess. No code change; revisit once a second
  real target with genuine link variety has been dogfooded.
- **Phase:** 17 (pre-lock)
- **Priority:** P3
- **Suggested labels:** `investigation`, `generation`
- **Problem it solves:** TFP-040 generated 11 dedicated link-health tests
  (`TFFU-029`–`TFFU-039`) for `test-assist`'s two, both-external GitHub
  links — exhaustive regardless of whether the target warrants it. This
  isn't a defect (it caught nothing wrong to fix), but it's real signal
  that per-element breadth is currently uniform rather than
  relevance-weighted.
- **Scope:**
  - Investigate, don't yet build: would weighting link-audit depth by
    `containerLabel`/role-inferred importance (e.g. footer/external links
    get a lighter check than primary-navigation links) measurably reduce
    noise without losing real coverage on a second real target, not just
    `test-assist`.
  - Explicitly out of scope until that investigation has a real second
    data point: don't reduce coverage based on a sample size of one
    target where the exhaustive approach happened not to matter.
- **Deliverables:**
  - A short findings note, same pattern as `TFP-036`'s spike, before any
    ticket to actually change generation depth is written.
- **Acceptance criteria:**
  - A written recommendation: worth doing, not worth doing, or needs a
    second target first — not a code change in this ticket.
- **Dependencies:** None.

## Recommended Execution Order

TFP-062 and TFP-063 are resolved (see their Status lines above) — the
remaining order is code-only, nine tickets:

1. TFP-053 (visibility capture — unblocks TFP-054)
2. TFP-054 (fixes the 7 confirmed false positives — highest-value, P0)
3. TFP-055 (ARIA state capture — unblocks TFP-057, informs TFP-056)
4. TFP-056 (accessibility coverage from real data)
5. TFP-057 (ARIA-state-toggle assertions — the TA-252-class catch)
6. TFP-058, TFP-059 (responsive/usability from real data — independent of
   each other)
7. TFP-060, TFP-061 (negative assertions, drag-and-drop — independent,
   lower priority)

## Suggested Milestone Gate

### Gate — Ready to implement Phase 17

`docs/decisions/phase-17-run-persistence-decision-record.md` is drafted and
locked. Its Decision 6 raises this gate's bar beyond what this backlog
originally proposed: Emil's confirmed preference is to finish this entire
backlog — all of TFP-053 through TFP-063 — before Phase 17 implementation
starts, not just the subset below, and not in parallel. That's a
product-completeness call ("as complete a product as possible before
stepping into more backlog"), not a technical dependency; the original,
narrower reasoning for a subset gate is kept below because it's still true
on its own terms, it's just no longer the whole bar.

The original subset this backlog proposed as functionally load-bearing for
"honest coverage" specifically:
- [x] TFP-053/054 landed: regenerating TFP-040's exact suite against
  `test-assist` produces 0 of the 7 known false positives.
- [x] TFP-055/056/057 landed: regenerating produces an accessibility suite
  that would have caught TA-252's finding on its own, without needing the
  `write-playwright-test` skill run separately.
- [x] TFP-062 resolved — see its Status line above and
  `product-roadmap.md`'s Phase 18 addendum.
- The "What this backlog can and can't close" section above still holds —
  Phase 17's decision record cites it directly rather than re-litigating
  what a generator patch can and can't fix.

The rest of this backlog, now equally required by the confirmed gate:
- [x] TFP-056, TFP-058, TFP-059: data-driven accessibility/responsive/usability
  generation.
- [x] TFP-060, TFP-061: negative-assertion and drag-and-drop detection.
- [x] TFP-063 resolved — see its Status line above and
  `examples/link-audit-depth-findings.md`.

**Gate closed 2026-09-17.** All nine code tickets landed
(`43718aa`..`47446c5`), verified live against `test-assist`
(introspect/generate/run, not just unit-level) and independently re-checked
from Cowork: `origin/main` at `47446c5` confirmed, regression suite at 32
tests (was 22 before this batch), `npx tsc --noEmit` clean, and two of the
higher-risk diffs (TFP-054's visibility gating, TFP-061's non-bubbling
drag probe) read line-for-line against their own commit messages' claims —
both matched exactly, including the subtler technical details (dropping
the enabled/editable/click assertions too for hidden elements, not just
the visibility check; the bubbling-vs-non-bubbling distinction between the
probe and the generated test's own drop simulation). The one thing not
independently re-run here was the full regression suite itself (a live
Playwright + Next.js server run exceeds a single verification pass in this
environment) — noted as a gap, not silently assumed passing beyond what
the test count and tsc check above actually prove.

`docs/decisions/phase-17-run-persistence-decision-record.md` is unblocked.
Phase 17 implementation can start.
