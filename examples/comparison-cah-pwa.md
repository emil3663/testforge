# TFP-076: four things compared against cah-pwa

The four, per the ticket: TestForge's own generated suite (TFP-074, 108
tests, template generator, `examples/testforge-app/cah-pwa/`),
`write-playwright-test` applied directly (TFP-075, 15 tests, hand-authored
via the skill, `examples/skills/write-playwright-test/cah-pwa/`), cah-pwa's
own generator (`scripts/generate_playwright_tests.js`, output under
`tests/generated/`), and its hand-authored stability matrix
(`AUTOMATION_TEST_PLAN.md` / `test-stability-matrix.csv`) as context. This
is the comparison Phase 19 structurally couldn't make: two automated
generators on the same app, not just automated-vs-hand-written.

All four are evaluated against the same served instance,
`http://localhost:8001`. Three of the four arms were actually run this
session: TestForge's suite (`run-report.json`: 97 passed / 11 failed), the
skill's suite (15 passed / 0 failed, after fixing two authoring mistakes
mid-session - see below), and the **real** (non-stub) fraction of cah-pwa's
own suite: **18 passed / 0 failed**, `43 skipped` (the still-unimplemented
stubs in the same three directories, correctly skipped rather than run as
no-ops). The stability matrix is reference material, not run - it's a CSV
of test rows, not executable code.

## What cah-pwa's own generator actually is - read before comparing it

`scripts/generate_playwright_tests.js` (39 lines) is not the same kind of
tool as TestForge's generator at all, and that difference is the headline
finding of this comparison. It parses `TEST_PLAN.md`'s markdown tables and
writes one file per test ID, each containing `await test.skip();` and
placeholder comments (`// 1. (step 1)`, `// Expected: (fill expected
result)`) - a **scaffolding generator**, not an attempt at working
assertions. It refuses to overwrite a file that already exists
(`if (fs.existsSync(fileName)) continue`), so it's meant to run once and
then get hand-edited in place.

**228 stub files exist under `tests/generated/`. Only 4 have been
hand-converted into real tests**
(`3-1-authentication-landing/.spec.js`, `3-7-pwa/pw-01.spec.js`,
`3-7-pwa/pw-02.spec.js`, `7-2-quick-run-checklist-15-20-min/.spec.js`) -
confirmed by grepping for the literal string `test.skip()` across the
directory: 224 files still contain it, 4 don't. That 4-of-228 conversion
rate (1.8%) is itself the most honest single fact this comparison can
report about the state of cah-pwa's "own generated suite": almost all of
it is unimplemented scaffolding, not dead weight to route around.

The **stability matrix is in the same state**. `AUTOMATION_TEST_PLAN.md`
describes a workflow where a human triages `test-stability-matrix.csv`,
marking each row Stable/Moderate/Flaky/Blocked. Reading the CSV directly:
**167 of 172 rows (97%) are still the tool's own default, `Needs
Implementation`** - the triage step never happened at the per-row level.
The 5 rows that show something else (`LG-06` through `LG-09`) aren't real
triage either - they're a CSV-quoting bug: a comma inside an unquoted
`RequiredChanges` free-text cell splits into the `Stability` column,
overwriting it with prose (`"Needs Manual Testing - Verify that a new
document is created in the 'users' collection..."`). The real hand
classification that exists lives only as prose in
`AUTOMATION_TEST_PLAN.md`'s per-section narrative (e.g. "3-2 Room
management... Stability: Flaky → Moderate with seeding") and implicitly in
which 4 of 228 stubs got implemented - not in the CSV the plan names as
its deliverable.

## The generator-vs-generator divergence, on the same feature

Both TestForge and cah-pwa's own tooling produced something touching
**sign-in**, which makes it the cleanest same-feature comparison point
across all three automated arms:

- **TestForge** (`TFFU-003`, `TFFU-004`, `TFFU-005`, `TFFU-007` in
  `examples/testforge-app/cah-pwa/generated.spec.ts`): asserts the
  username/email/password fields and the Sign In button exist and are
  visible on the landing page. Never fills them, never clicks Sign In,
  never checks what happens after. Existence only.
- **cah-pwa's own suite** (`LG-18`, the one real sign-in test among the 4
  implemented files): seeds `localStorage`'s `cah_player` directly via
  `page.addInitScript` (`tests/helpers.js`'s `seedRegressionProfile`) to
  trigger `checkAndAutoLoginRegression()`'s auto-login path, then asserts
  the menu renders with the right greeting and the `TEST MODE` debug
  badge. Real behavioral verification of the *outcome* of being signed
  in - but it never touches the sign-in form at all.
- **`write-playwright-test`** (`examples/skills/write-playwright-test/cah-pwa/cah-pwa.spec.ts`,
  `Functional › signing in with the local regression account reaches the
  real main menu`): fills the actual email/password fields and clicks the
  real Sign In button, exercising `handleSignIn()`'s
  `isRegressionCredentialPair` branch (app.js:1650-1668) end-to-end -
  the only one of the three that verifies the form-submission code path
  itself, rather than either ignoring it (TestForge) or bypassing it
  (cah-pwa's own suite, by design, per `AUTOMATION_TEST_PLAN.md`'s own
  stated seeding strategy for exactly this reason).

None of the three subsumes the others: existence, bypassed-outcome, and
actual-submission are three different claims about the same feature, and
only having all three would actually prove sign-in works end-to-end for a
real user typing into the real form.

## What each catches that the others miss

**TestForge's generated suite** is the only one of the four that never
gets past the landing screen - not by choice, but because its crawl
(`src/app/api/crawl/route.ts`) only follows `<a href>` tags and cah-pwa has
zero internal ones (see `examples/testforge-app/cah-pwa/notes.md`). Its 108
tests are all static-DOM-introspection checks against that one page's full
markup (including screens that are hidden until later, discovered because
introspection scans the whole DOM regardless of CSS visibility) - breadth
at a single moment in time, zero coverage of any state transition.

**cah-pwa's own suite goes deepest into actual card play**, further than
either TestForge's or the skill's suite reaches. `QS-09`
(`tests/generated/7-2-quick-run-checklist-15-20-min/.spec.js`) double-taps
a hand card into `#playDropZone` and asserts it landed there; `QS-10`
plays it via `#btnPlayCards` and waits for bot auto-submission; `QS-12`
plays a full game down to `#screen-gameover` with `roundsToWin: 1`. Neither
TestForge's suite (never reaches the game at all) nor the skill's suite
(stops after judging round 1 as Czar - it never has the human player draw
and submit a card themselves in round 2) exercises the human's own
card-submission path. That's a real, honestly-named gap in the skill's
suite, not just a strength of cah-pwa's own.

**`write-playwright-test`'s suite is the only one of the four with any
accessibility coverage at all** - confirmed by grepping all of
`tests/generated/` and `tests/helpers.js` for `aria`: zero matches.
TestForge's suite has accessibility-labeled tests (`TFAC-001`-`TFAC-042`)
but, per `examples/testforge-app/cah-pwa/notes.md`, most either duplicate
the same false-positive pattern as its functional tests or (`TFAC-042`)
actively misclassify a plain navigation menu as a toggle group. The
skill's suite has 3 accessibility tests, one of which is a genuine finding
about the app itself (below) that none of the other three arms comes
anywhere near - none of them assert anything about ARIA state, radio
semantics, or heading structure.

**`write-playwright-test`'s suite is also the only one of the four that
exercises the deck-claiming gate itself.** `requireDeckAccess` (app.js:1545)
redirects to the deck store with a real gating message when a player owns
no decks - the regression account's actual starting state
(`getRegressionProfile`, app.js:186-207: `freeStarterClaimed: false`).
cah-pwa's own suite never sees this: `seedRegressionProfile`
(`tests/helpers.js:12-40`) seeds the profile with
`freeStarterClaimed: true` and `ownedDeckIds: ['general-classic']` already
set, specifically to skip past it. That's a defensible, deliberate choice
for a suite optimizing for stability over first-run coverage - but it
means the gate itself, and the two-click deck-store flow required to clear
it (select a deck name to open its preview panel, *then* claim it - not
obvious from the button alone, see below), has zero coverage anywhere
except the skill's suite.

**`test-stability-matrix.csv` names real future work none of the three
executable arms cover**, even unfilled: AI player determinism (3-8),
multi-client chat via Firestore (3-3), and cross-client room sync (3-2) -
all correctly marked as needing mocks or multi-page contexts neither
TestForge, the skill, nor cah-pwa's own current implemented tests attempt.
Worth keeping visible precisely because nothing here silently closes that
gap.

## Convergence, not just divergence

Independently, without either reading the other's code first,
`write-playwright-test`'s suite and cah-pwa's own `helpers.js`
(`resolveCzarRoundIfCzar`) arrived at **the identical mechanism** for
resolving a judged round: click the bot's `.submission-card` to nominate
it, then click `#btnConfirmWinner` - not the drag-and-drop path the UI's
own instruction text suggests first (*"Drag a card to Winner Zone..."*).
Both independently found `nominateWinner`'s plain `onclick` handler
(app.js:2482) instead. Two independent authors reaching the same
non-obvious implementation detail is a stronger signal that it's actually
the right approach than either one alone would be.

## False positives and real findings, named

**TestForge's generated suite: 10 of 11 failures share one root cause**,
a second, different symptom of the same underlying blind spot documented
in `examples/testforge-app/cah-pwa/notes.md` - `getByRole()` locators
resolve through Chromium's accessibility tree, which excludes
`display:none` subtrees entirely, so conditionally-hidden elements fail as
"not found" (`TFFU-030/031/032`, `TFAC-030/031/032`, and the `TFUS-009/010/011`
30-second timeouts on the same three elements) rather than as `hidden`.
The 11th, `TFFU-048` (no `:visited` link styling), is a verified repeat of
the same low-stakes finding TFP-040 already surfaced against `test-assist`
- now a pattern across two unrelated targets, not a one-off. One failure,
`TFAC-042`, is a genuine generator misclassification (a plain navigation
menu flagged as a missing-ARIA toggle group) - confirmed wrong by reading
`index.html:45-69` and directly contradicted by the skill's own `CONTRAST`
test.

**`write-playwright-test`'s suite: 0 false positives in its final, passing
run - but it didn't start there, and the corrections are worth recording
rather than silently smoothing over**, per this project's own precedent
(`examples/skills/write-playwright-test/test-assist/`'s two caught-and-fixed
bugs). Two authoring mistakes were caught by actually running the suite,
not assumed correct from reading the source once:

- `claimStarterDeckAndReturnToMenu` originally clicked "Claim Free Starter
  Deck" directly after opening the deck store and failed with "element(s)
  not found." The button only renders inside a deck's *preview panel*
  (`renderDeckPreviewCard`), which only appears after clicking the deck's
  *name* in the category list (`renderDeckStore`, app.js:1108-1138) - a
  real two-step UI flow, not a single action.
- `Start Game` was originally located as `exact: true`; the actual button
  text is `▶ Start Game` (index.html:220, a leading play-triangle glyph),
  so the exact match found nothing.

Two more issues turned into real, permanent findings about the app rather
than test bugs to route around:

- **The service worker reloads the page on `controllerchange`**
  (index.html:370-371) - the standard "activate immediately" pattern, but
  in a fresh browser context (every Playwright test's default, and any
  first-time visitor's first load) it fires moments after page load,
  silently wiping whatever the user had already typed into the sign-in
  form. cah-pwa's own `playwright.config.js` already works around this
  with `serviceWorkers: 'block'` project-wide - confirmed directly by
  `tests/generated/3-7-pwa/pw-02.spec.js`, which is permanently
  `test.skip()`-ed with the comment "Service worker is blocked by
  playwright.config.js." Both suites converge on the same workaround,
  independently, for the same reason; cah-pwa's own team just already knew
  it going in, and traded away SW-registration test coverage to get it.
- **The game-mode radio group (`Classic`/`Wild 🔥`/`Question First ❓`) is
  invisible to assistive technology**, despite being built from real
  `<input type="radio">` elements. `style.css:170`'s
  `.mode-opt input { display: none; }` removes the native inputs from the
  accessibility tree entirely (the same `display:none`-exclusion mechanism
  behind TestForge's `TFFU-030`-class failures above, here caused by a
  permanent CSS rule rather than a not-yet-opened screen), while the
  "selected" look is drawn purely in CSS via `:has(input:checked)` on the
  wrapping `<label>`, which carries no role or `aria-checked` of its own.
  Mouse and touch users can't tell anything is wrong, because label-click
  delegates to the hidden input regardless of its accessibility-tree
  membership - exactly why this shipped unnoticed. None of the other three
  arms - TestForge (never reaches this screen), cah-pwa's own suite (never
  asserts anything about ARIA), or the stability matrix (no accessibility
  row exists for this control at all) - surfaces this.

**cah-pwa's own suite: 0 failures across all 18 real tests**, run this
session against the same instance. The deepest and most mature of the
three executable arms, unsurprisingly, since it's the only one built
against actual multi-round gameplay outcomes rather than a single page
state or a single flow.

## Category weakness, per arm

**TestForge's generated suite**: 100% of its coverage is a single static
page state. Zero tests touch any screen transition, any localStorage
persistence, or any gameplay - not weak coverage of those areas, *no*
coverage, a direct consequence of the crawl-reachability fact established
in TFP-074.

**`write-playwright-test`'s suite**: doesn't touch actual card *submission*
by the human player (judges round 1 as Czar but never plays a card in
round 2, unlike cah-pwa's own `QS-09`/`QS-10`), and doesn't test PWA
plumbing (manifest, service worker registration) at all - both real,
addressable gaps for a follow-up pass, now that this comparison has made
them explicit instead of leaving them implicit.

**cah-pwa's own suite**: 224 of 228 files are inert stubs, and the 4 real
ones cover sign-in, PWA manifest, and one smoke path end to end - nothing
about deck-store browsing beyond the starter claim, custom deck import, or
friends. Also: by design, it never tests the deck-gating flow, the
sign-in *form*, or anything ARIA-related, all covered above.

**The stability matrix**: honestly names what's missing (chat, AI
determinism, cross-client sync) but its own per-row Stability column isn't
trustworthy as triage data - 97% still reads the generator's untouched
default, not a human's assessment, contrary to what
`AUTOMATION_TEST_PLAN.md` describes as the completed workflow.
