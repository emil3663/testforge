# TFP-042: three suites, compared against test-assist

The three: TestForge's own generated suite (TFP-040, 42 tests, template
generator), `write-playwright-test` applied directly (TFP-041, 16 tests,
hand-authored via the skill), and `test-assist`'s own existing suite (55
tests: 8 smoke + 47 regression, both run for real this session -
`8 passed`, `47 passed`, `0 failures` in either).

All three run against the same served instance, `http://localhost:4321`.
Findings below are specific - named test, named gap - per the ticket's own
acceptance bar, not "roughly similar coverage."

## What each catches that the others miss

**`test-assist`'s own suite catches real edge-case behavior neither
generated suite touches at all:**

- `AT-16 — annotation coordinates stay accurate under browser zoom`. Neither
  other suite tests zoom at all.
- `UR-08 — a move can be undone, and a bare click adds no undo step`. A
  negative assertion (something should *not* happen) - exactly the shape
  neither generator produces, since both only assert what's present.
- `SG-01`–`SG-04` (snapshot gallery: reload a thumbnail, delete one, two
  exports in the same millisecond stay distinct, newest-first ordering).
  Nothing in either generated suite exercises the snapshot list at all.
- `SP-05 — a session saved under an old schema is discarded, not
  half-read` and `SP-06 — the app still works when storage is unavailable`.
  Both require knowing `app.js`'s actual failure-mode handling
  (`saved.schema !== SCHEMA` discards rather than half-reading;
  `openDb()`'s catch path degrades to "works, remembers nothing"), not
  just what's in the DOM.
- `KS-01` through `KS-07` (all seven keyboard shortcuts) and
  `IC-08 — dropping a non-image file is ignored silently`. Neither
  generated suite tests keyboard shortcuts or drag-and-drop at all.

This is the clearest finding of the three: **none of this is visible from
static DOM introspection or from reading the source once.** It's the
product of a suite built iteratively against the real, running app over
time - exactly the gap between "what a tool can discover" and "what a
tester who's used the thing knows to check."

**`write-playwright-test`'s suite catches one specific thing neither of the
other two does:** the annotation tool list's missing accessible
selected-state (`FINDING: the annotation tool list has no accessible
selected-state`, `examples/skills/write-playwright-test/test-assist/test-assist.spec.ts`).
`test-assist`'s own 55-test suite is functionally-focused and asserts
nothing about ARIA state anywhere. TestForge's generated `TFAC-001` is the
only other accessibility-labeled test in either suite, and it asserts only
`interactiveCount > 0` and that one heading is visible - see below, that's
not the same claim.

It also independently exercises `app.js`'s own documented test hook,
`window.__saveSessionNow()`, to wait for the debounced autosave
deterministically rather than an arbitrary timeout - the same discipline
`test-assist`'s own `SP-01`–`SP-06` presumably use (not independently
re-verified from their source in this pass, but the hook's own comment
says it exists "so tests drive this directly").

**TestForge's generated suite catches something at a breadth neither other
suite bothers with:** exhaustive external-link auditing -
`TFFU-029`–`TFFU-039`, eleven tests covering link classification (internal/
external/anchor/mailto/download), target-window behavior, hover/visited
styling, keyboard activation, and href-protocol safety, applied to both of
`test-assist`'s two external links. Neither the hand-written suite nor the
skill-authored one tests link behavior this specifically, because two
GitHub links didn't seem worth a dedicated pass to either. The generator
does it mechanically regardless of whether the target has one external
link or fifty - breadth without judgment about whether the breadth is
warranted, which cuts both ways.

## False positives, named

**TestForge's generated suite: 7 confirmed false positives**, all one root
cause. `TFFU-006`, `TFFU-022`, `TFFU-023`, `TFFU-025`, `TFFU-026`,
`TFFU-027`, `TFFU-028` all fail with `expect(locator).toBeVisible()` /
`Received: hidden` against elements `test-assist` hides *correctly*, by
design, until a prerequisite action (entering Video mode, restoring a
session, opening the text popup). Full detail in
`examples/testforge-app/test-assist/notes.md`. This is systematic, not
occasional: the introspection step that feeds the generator records that
an element exists, not whether its visibility is conditional, so every
per-element check defaults to the unconditional claim.

**`write-playwright-test`'s suite: 2 real bugs, caught and fixed before
being trusted, not shipped as false positives.** First run: 14 passed, 2
failed. `Functional › uploading an image loads it onto the canvas and
hides the placeholder` expected the text `"Screenshot loaded..."`, but
`app.js`'s `loadImageSrc()` (the upload path) actually sets `"Image
loaded..."` - `"Screenshot loaded..."` is `loadImageBitmap()`'s text, the
*screen-capture* path, a different function entirely; a transcription
error against the real source, not a guess. Second:
`Functional › a text annotation can be added via the popup` failed because
the test's own fixture image was 2×2 pixels, and `resizeCanvases()` sizes
the on-screen canvas container to the image's *own* natural dimensions -
making the interactive canvas ~2 CSS pixels on screen, so a click 30px
offset from its origin landed nowhere near it. Both fixed (correct text;
a real 100×100 fixture) and re-run clean: 16 passed, 0 failed. Recorded
here rather than silently corrected, because a hand-authored,
skill-directed suite making - and catching - this exact class of error is
itself informative: the "drawing tools" test that used the same undersized
fixture *before* the fix happened to still pass, because its own
assertions (click Undo, click Redo) never actually verified a shape got
drawn - a real, if minor, instance of exactly what `dont-stub-what-you-prove`
exists to catch, found here by hand rather than by that skill.

**`test-assist`'s own suite: 0 failures** in either lane, this run. No
false positives observed - the most mature of the three, which tracks with
being the only one built and refined against the real app over an extended
period rather than generated or written once.

## Category weakness, per suite

**TestForge's generated suite** is heavily functional-weighted (39 of 42
tests) and thin everywhere else: `Usability Coverage` and `Accessibility
Coverage` are one test each, and neither asserts much - `TFUS-001` checks
that a heading is visible and `visibleInteractive.count() > 0`; `TFAC-001`
checks the same heading plus `interactiveCount > 0` across `a, button,
input, textarea, select, [role="button"]`. Neither inspects a single ARIA
attribute, label, or keyboard path. `Responsive Coverage` (`TFRM-001`)
checks `body` and a heading stay visible at three viewport sizes - no
touch-specific assertion, despite `app.js` wiring real
`touchstart`/`touchmove`/`touchend` handlers separately from its mouse
handlers. **Zero tests touch session persistence at all**, despite it
being one of the app's more involved features.

**`write-playwright-test`'s suite** is narrower by design (16 tests) and
doesn't attempt exhaustive per-element enumeration or link auditing - a
deliberate scope choice, not an oversight, but it means no coverage of
keyboard shortcuts, the snapshot gallery, or zoom behavior; a second pass
informed by actually having seen `test-assist`'s own suite would likely
add at least the negative-assertion pattern (`UR-08`'s shape) and the
schema-mismatch/storage-unavailable session cases, none of which were
visible from reading `app.js` once without also knowing what to look for.

**`test-assist`'s own suite** is the strongest overall and the hardest to
find a specific gap in - the one found here is the same accessibility gap
`write-playwright-test`'s suite caught: nothing in 55 tests asserts
anything about ARIA state, so the tool-list's missing `aria-pressed`/
`aria-selected` equivalent would ship unnoticed by this suite alone.
