import { test, expect, type Page } from '@playwright/test';

// Applying testforge/skills/testing/write-playwright-test/SKILL.md directly
// against cah-pwa's browser build (app.js, index.html, js/gemini.js), served
// at http://localhost:8001 - no TestForge app involved.
//
// Category judgment (step 1 of the skill), reading the actual source rather
// than a plain-English description someone else supplied:
//
// - Functional: in scope. This is the interesting case for cah-pwa: real
//   gameplay is described everywhere (README, TEST_PLAN.md,
//   AUTOMATION_TEST_PLAN.md) as gated behind Firebase. Reading app.js closely
//   shows that's only half true. `useFirestoreRoomSync()` (app.js:480-482)
//   returns `Boolean(window.firebaseDb && window.firebaseAuth?.currentUser)`
//   - and the local dev sign-in bypass (`canUseAdminLogin`/
//   `canUseRegressionLogin`, app.js:140-168, gated to private-network hosts
//   which localhost satisfies) never touches `firebaseAuth`, so
//   `currentUser` stays null even after a successful local sign-in. Room
//   creation and the entire round/judging engine (`finishCreateRoom`,
//   `startGame`, `startRound`, app.js:1843-2192) branch on that same flag and
//   fall back to plain localStorage + fully local game state when it's
//   false. That means real single-player-vs-AI-bot gameplay - deal, submit,
//   judge, score - is reachable with zero Firebase and zero Gemini
//   connectivity, a materially different fact than "gameplay is gated behind
//   Firebase," which is true only for cross-client realtime sync.
// - Session persistence: in scope, the same way test-assist earned this
//   category (a real, observable, user-visible session mechanism, not a
//   guess). `checkAndAutoLoginRegression()` (app.js:1713-1745) re-reads
//   `cah_player` from localStorage on every load and silently re-enters the
//   menu screen if it matches the regression profile - a real reload-safe
//   session, distinct from (and not a proxy for) Firebase auth state.
// - Accessibility: in scope, pragmatically, and it produces a genuine
//   divergence from TestForge's own generated suite worth naming: TestForge
//   flagged the six main-menu buttons (TFAC-042 in
//   examples/testforge-app/cah-pwa/) as a "toggle/selection group" missing
//   ARIA state, because introspection saw them share one container
//   (`groupId: "group-1"`). Reading index.html:45-69 directly shows they are
//   plain navigation entries (`class="menu-card"`, each routes to a
//   different screen) - not a segmented control with shared selection
//   state. No `aria-pressed` is needed and none should be added. That's
//   asserted below as a documented contrast, not silently agreed with. A
//   second, real defect turned up while writing the radio-group test right
//   below it in the same describe block: style.css:170's
//   `.mode-opt input { display: none; }` hides the actual
//   <input type="radio"> elements from the accessibility tree entirely, so
//   the game-mode picker has no accessible radio semantics at all, despite
//   being built from real radio inputs - the opposite direction of mistake
//   from TFAC-042, and the test below documents it as a FINDING rather
//   than the "confirms good semantics" test originally planned before that
//   test's first run failed and pointed at the real cause.
// - Responsive/mobile: in scope. Real, deliberate mobile support - three
//   breakpoints in style.css (max-width: 760/420/340px, style.css:560-739),
//   a manifest.json + service worker (an installable PWA), and a
//   grid-based menu (`menu-grid`, style.css:125) that has to reflow, not
//   just shrink.
// - Performance/load, security, SEO/content, database: out of scope, per
//   the skill's own rule against reflexive coverage. Nothing in scope here
//   touches a load profile, a public SEO surface, or persistence beyond
//   what Functional already covers via the localStorage-backed room/friends
//   state.
//
// One deliberate technical choice, stated up front: resolving a round calls
// `await ask('praise', ...)` (app.js:2543), which is `js/gemini.js`'s `ask()`
// - a real fetch to `generativelanguage.googleapis.com` with an empty
// `GEMINI_API_KEY` constant (js/gemini.js:4), no timeout, and no retry. The
// call is wrapped in try/catch at the call site, so it fails safe onto
// `WINNER_PRAISES` - but "fails safe" still means a real, unbounded network
// round-trip on every test run, to a real external API, with no timeout to
// force it to give up. That's exactly the reliability gap already flagged
// (not actioned) in docs/decisions/phase-25-cah-pwa-dogfooding-backlog.md's
// aside. Rather than let a test suite depend on that gap's runtime behavior
// - fast in a sandbox with a live network path, indefinitely slow in one
// without - the round-resolution test below intercepts and aborts that one
// request, forcing the documented fallback path deterministically. This is
// a test-suite-isolation call (don't let a suite's pass/fail depend on a
// third-party API's reachability), not a workaround for a bug in the app.

// FINDING, caught by actually running this file rather than just writing it:
// index.html:366-371 registers service-worker.js and reloads the page on
// every `controllerchange` (`navigator.serviceWorker.addEventListener(
// 'controllerchange', () => window.location.reload())`) - the standard
// "activate the new SW immediately" PWA pattern. In a fresh browser context
// (every Playwright test's default, and any first-time visitor's first
// load), that reload fires moments after the initial page load, while a
// human or a test is already typing into the sign-in form - wiping it
// silently with no error and no visible cause. This is a real, reproducible
// UX defect (a first-time visitor who types quickly enough loses their
// input), not a test-authoring mistake: it was caught by watching this
// spec's own early runs fail with "Enter a valid email and password to sign
// in." despite `.fill()` having set both fields correctly moments earlier,
// then confirmed by logging the console output across the click and seeing
// the entire app re-initialize mid-test. cah-pwa's own playwright.config.js
// already works around exactly this with `serviceWorkers: 'block'` - this
// suite adopts the same setting, for the same reason, arrived at
// independently rather than copied in.
test.use({ serviceWorkers: 'block' });

const BASE_URL = 'http://localhost:8001';

const REGRESSION_LOGIN = { email: 'regression@test.local', password: 'Regression123!' };

async function signInAsRegression(page: Page) {
  await page.goto(BASE_URL);
  await page.getByPlaceholder('Email address').fill(REGRESSION_LOGIN.email);
  await page.getByPlaceholder('Password (6+ characters)').fill(REGRESSION_LOGIN.password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'What would you like to do?' })).toBeVisible();
}

// The local admin/regression bypass (app.js:1630-1668) checks the email and
// password directly against these constants and never calls
// firebaseAuth.signInWithEmailAndPassword - confirmed by reading
// isRegressionCredentialPair (app.js:160-163) before relying on it here.
async function claimStarterDeckAndReturnToMenu(page: Page) {
  // The deck store doesn't put the claim button on the category list itself
  // - each category (`core-expansions` here, cards.js:36194's
  // categoryId for the free starter deck) only lists deck NAMES as buttons
  // (renderDeckStore, app.js:1108-1138); clicking one renders its preview
  // card into a separate panel, and only that preview card carries the
  // "Claim Free Starter Deck" action (renderDeckPreviewCard, app.js:1148+).
  // Found by a real failed run (getByRole timing out) before this second
  // click was added, not assumed correct from reading the code once.
  await page.getByRole('button', { name: 'Classic Chaos' }).click();
  await page.getByRole('button', { name: 'Claim Free Starter Deck' }).click();
  await expect(page.getByText('Starter deck claimed and added to your deck pool. You can now create or join games.')).toBeVisible();
  await page.getByRole('button', { name: '← Back' }).click();
  await expect(page.getByRole('heading', { name: 'What would you like to do?' })).toBeVisible();
}

test.describe('Functional', () => {
  test('the landing screen shows the sign-in form and real CAH branding', async ({ page }) => {
    await page.goto(BASE_URL);

    await expect(page.getByRole('heading', { name: 'Cards Against Humanity' })).toBeVisible();
    await expect(page.getByText('A party game for horrible people.')).toBeVisible();
    await expect(page.getByPlaceholder('Choose a username')).toBeVisible();
    await expect(page.getByPlaceholder('Email address')).toBeVisible();
    await expect(page.getByPlaceholder('Password (6+ characters)')).toBeVisible();
  });

  test('signing in with the local regression account reaches the real main menu', async ({ page }) => {
    await signInAsRegression(page);

    // getEffectiveAuthUser() / updateAuthTopbar (app.js:170-184) - a real,
    // signed-in-looking UI state, distinct from an actual Firebase session.
    await expect(page.getByText('Regression QA', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: '🏠 Create Room' })).toBeVisible();
    await expect(page.getByRole('button', { name: '🚪 Join Room' })).toBeVisible();
    await expect(page.getByRole('button', { name: '👥 Friends' })).toBeVisible();
  });

  test('creating a room is genuinely gated on owning a deck, not just a UI suggestion', async ({ page }) => {
    await signInAsRegression(page);

    // The regression profile seeds with zero owned decks (getRegressionProfile,
    // app.js:186-207: freeStarterClaimed: false, ownedDeckIds: []) - so this
    // isn't a hypothetical edge case, it's the account's real starting state.
    await page.getByRole('button', { name: '🏠 Create Room' }).click();

    // requireDeckAccess (app.js:1545-1549) redirects to the deck store with a
    // specific message rather than blocking in place - asserted on the actual
    // redirected screen and its real message, not assumed from reading the
    // handler alone.
    await expect(page.getByText('Claim or add at least one deck to your pool before creating rooms.')).toBeVisible();
    // The "Claim Free Starter Deck" action itself only renders inside a
    // deck's preview panel once its name is clicked (see
    // claimStarterDeckAndReturnToMenu below) - what's actually on screen at
    // this point is the category already expanded with the deck name listed.
    await expect(page.getByRole('button', { name: 'Classic Chaos' })).toBeVisible();
  });

  test('claiming the starter deck unblocks room creation for real', async ({ page }) => {
    await signInAsRegression(page);
    await page.getByRole('button', { name: '🏠 Create Room' }).click();
    await claimStarterDeckAndReturnToMenu(page);

    await page.getByRole('button', { name: '🏠 Create Room' }).click();
    // No redirect this time - the create-room form itself is now reachable.
    await expect(page.getByText('Room Name', { exact: true })).toBeVisible();
    // A CSS attribute locator, not getByRole - see the Accessibility describe
    // block below for why role='radio' doesn't resolve here at all
    // (style.css:170's `.mode-opt input { display: none; }`).
    await expect(page.locator('input[name="gameMode"][value="classic"]')).toBeChecked();
  });

  test('creating a room with an AI player reaches a real lobby with that bot seated', async ({ page }) => {
    await signInAsRegression(page);
    await page.getByRole('button', { name: '🏠 Create Room' }).click();
    await claimStarterDeckAndReturnToMenu(page);
    await page.getByRole('button', { name: '🏠 Create Room' }).click();

    await page.getByPlaceholder('e.g. Friday Night Chaos').fill('QA Smoke Room');
    // aiPlayers defaults to 0 (app.js:1824's `|| 0` fallback) - has to be set
    // explicitly to get a bot seated, not assumed present.
    await page.locator('#aiPlayers').fill('1');
    await page.getByRole('button', { name: 'Create & Start' }).click();

    // finishCreateRoom (app.js:1843-1867) takes the useFirestoreRoomSync()===false
    // branch here (no real Firebase user), writing straight to
    // localStorage's cah_rooms and opening the lobby locally - no network
    // dependency, confirmed by the assertions below succeeding without any
    // Firestore connectivity in this environment.
    await expect(page.locator('#lobbyTitle')).toHaveText('QA Smoke Room');
    await expect(page.locator('#lobbyPlayerCount')).toHaveText('2');
    await expect(page.locator('#lobbyPlayers .player-chip.host')).toContainText('Regression QA');
    // The second chip is the bot - generateBotPlayers (app.js:1829) names it
    // from BOT_PERSONAS, not asserted by exact name since that's randomized,
    // but its presence and bot-specific markup (an avatar img) are real.
    await expect(page.locator('#lobbyPlayers .player-chip:not(.host)')).toBeVisible();
    await expect(page.locator('#lobbyPlayers .player-chip:not(.host) img.bot-avatar')).toBeVisible();
  });

  test('starting the game launches the real local round engine, and judging a round advances the score', async ({ page }) => {
    // See the file-level comment: this is the one test that reaches
    // resolveRound's Gemini call, so the request is intercepted here rather
    // than left to depend on live network access.
    await page.route('**/generativelanguage.googleapis.com/**', (route) => route.abort());

    await signInAsRegression(page);
    await page.getByRole('button', { name: '🏠 Create Room' }).click();
    await claimStarterDeckAndReturnToMenu(page);
    await page.getByRole('button', { name: '🏠 Create Room' }).click();
    await page.locator('#aiPlayers').fill('1');
    await page.getByRole('button', { name: 'Create & Start' }).click();
    await expect(page.locator('#lobbyTitle')).toBeVisible();

    await page.getByRole('button', { name: 'Start Game' }).click();

    // startGame -> startRound (app.js:2062-2192) runs entirely client-side:
    // deals real hands from cards.js, picks a real black card, and - because
    // czarIndex starts at 0 and room.players is [human, ...bots]
    // (finishCreateRoom, app.js:1844-1853) - the human is Card Czar for
    // round 1. simulateBotSubmissions() (app.js:2764-2784) is synchronous
    // local logic (a text-scoring heuristic, chooseBotCards app.js:2713+),
    // not a network call, so by the time this state is asserted the single
    // bot has already submitted and maybeEnterJudgingPhase() (app.js:2396-2404)
    // has already flipped the round straight to judging.
    await expect(page.locator('#gameRoundInfo')).toHaveText('Round 1');
    await expect(page.locator('#blackCardText')).not.toBeEmpty();
    await expect(page.locator('#judgeInstruction')).toHaveText(/Choose the best answer/);

    // Judging a round: click the bot's submitted card to nominate it
    // (nominateWinner, app.js:2482-2488 - a plain onclick, not a
    // drag-and-drop-only interaction, confirmed by reading renderSubmissions
    // rather than assumed from the "drag to Winner Zone" instruction text),
    // then confirm.
    const submission = page.locator('#submittedCards .submission-card').first();
    await expect(submission).not.toBeEmpty();
    await submission.click();
    await expect(page.getByRole('button', { name: 'Confirm Winner' })).toBeEnabled();
    await page.getByRole('button', { name: 'Confirm Winner' }).click();

    // resolveRound (app.js:2509+) shows the result screen with a real score
    // update - the aborted Gemini call falls back to WINNER_PRAISES
    // (app.js:2544-2546), so #roundPraise is non-empty either way.
    await expect(page.locator('#roundWinnerBox')).toContainText('wins the round!');
    await expect(page.locator('#roundPraise')).not.toBeEmpty();
    await expect(page.locator('#scoreBoard')).toContainText('1 ✦');
  });

  test('adding a friend persists locally and appears without a reload', async ({ page }) => {
    await signInAsRegression(page);
    await page.getByRole('button', { name: '👥 Friends' }).click();

    await page.getByPlaceholder("Friend's player name").fill('Alex the Tester');
    await page.getByRole('button', { name: 'Add', exact: true }).click();

    // renderFriends (app.js:2900-2910) re-renders immediately from the
    // in-memory `friends` array app.js:2894 just pushed to and app.js:2895
    // just persisted to localStorage's cah_friends - a real round trip
    // through both, not just an optimistic DOM update.
    await expect(page.getByText('👤 Alex the Tester')).toBeVisible();

    await page.reload();
    await page.getByRole('button', { name: '👥 Friends' }).click();
    await expect(page.getByText('👤 Alex the Tester')).toBeVisible();
  });
});

test.describe('Session persistence', () => {
  test('reloading after a local regression sign-in re-enters the menu without resubmitting credentials', async ({ page }) => {
    await signInAsRegression(page);

    await page.reload();

    // checkAndAutoLoginRegression (app.js:1713-1745) runs on every load,
    // finds cah_player already matches REGRESSION_TEST_LOGIN.id, and jumps
    // straight to the menu - the sign-in form is never shown again on this
    // origin. This is a real session mechanism, and it is explicitly NOT the
    // same thing as a Firebase session: isLocalRegressionSession stays true
    // and window.firebaseAuth.currentUser stays null throughout, which is
    // exactly why the earlier gameplay tests can run without Firebase.
    await expect(page.getByRole('heading', { name: 'What would you like to do?' })).toBeVisible();
    await expect(page.getByPlaceholder('Email address')).not.toBeVisible();
  });
});

test.describe('Accessibility', () => {
  test('CONTRAST: the main menu\'s six buttons are plain navigation, not a toggle group', async ({ page }) => {
    await signInAsRegression(page);

    // TestForge's own generated suite (examples/testforge-app/cah-pwa/,
    // TFAC-042) flagged this exact button set as a "toggle/selection group"
    // missing aria-pressed/aria-selected, because its introspection grouped
    // them by shared container (groupId: "group-1" in its own captured
    // introspect response). Reading index.html:45-69 directly: each button
    // is class="menu-card" and each click navigates to a different screen
    // (btnCreateRoom -> 'create', btnJoinRoom -> 'join', etc., app.js:1789-1802)
    // - there is no shared selection state for any of them to expose, so no
    // aria-pressed belongs on any of them. This test documents that
    // judgment call as a real, checkable assertion rather than leaving it
    // as an unstated disagreement with the other suite's finding.
    const menuButtons = ['🏠 Create Room', '🚪 Join Room', '👥 Friends', '📊 My Stats', '🗂️ Decks'];
    for (const name of menuButtons) {
      const button = page.getByRole('button', { name });
      await expect(button).not.toHaveAttribute('aria-pressed');
      await expect(button).not.toHaveAttribute('aria-selected');
    }
  });

  test('FINDING: the game-mode radios are invisible to assistive technology, despite being real <input type="radio"> elements', async ({ page }) => {
    await signInAsRegression(page);
    await page.getByRole('button', { name: '🏠 Create Room' }).click();
    await claimStarterDeckAndReturnToMenu(page);
    await page.getByRole('button', { name: '🏠 Create Room' }).click();

    // The expectation going in (see the file-level comment block) was that
    // these being real <input type="radio"> elements meant role="radio"
    // would resolve cleanly, the same conclusion drawn for the accessible
    // menu buttons above. It doesn't, and that's the finding: this test
    // originally used getByRole('radio', ...) and failed with "element(s)
    // not found" on a screen that was genuinely open and visible - not the
    // TFP-074 "hidden until a later screen" pattern, a different cause.
    // style.css:170 sets `.mode-opt input { display: none; }` - the native
    // input is unconditionally hidden, and the "selected" look is drawn
    // entirely in CSS via `.mode-opt:has(input:checked)` (style.css:169) on
    // the wrapping <label>, which carries no role or aria-checked of its
    // own. A display:none element is excluded from the accessibility tree
    // outright (the same mechanism behind TestForge's TFFU-030/031/032 and
    // TFAC-030/031/032 in examples/testforge-app/cah-pwa/, just triggered
    // here by a permanent CSS rule instead of a not-yet-opened screen) - so
    // a screen reader user has no radio group to hear at all, not even one
    // with a missing state announcement. Mouse and touch users can still
    // select a mode, because label-click delegates to its wrapped input
    // regardless of its accessibility-tree membership - which is exactly
    // why this shipped without visibly breaking anything.
    const wildInput = page.locator('input[name="gameMode"][value="wild"]');
    await expect(page.getByRole('radio', { name: 'Wild 🔥' })).toHaveCount(0);

    // The click still lands, via the label, not via any accessible role.
    await page.getByText('Wild 🔥', { exact: true }).click();
    await expect(wildInput).toBeChecked();
    await expect(page.locator('input[name="gameMode"][value="classic"]')).not.toBeChecked();
  });

  test('the landing and menu screens each expose a real, single top-level heading', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page.getByRole('heading', { level: 1, name: 'Cards Against Humanity' })).toBeVisible();

    await signInAsRegression(page);
    await expect(page.getByRole('heading', { level: 2, name: 'What would you like to do?' })).toBeVisible();
  });
});

test.describe('Responsive/mobile', () => {
  const viewports = [
    { name: 'phone', width: 375, height: 667 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1440, height: 900 },
  ];

  for (const viewport of viewports) {
    test(`the main menu stays usable at ${viewport.name} size`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await signInAsRegression(page);

      await expect(page.getByRole('button', { name: '🏠 Create Room' })).toBeVisible();
      await expect(page.getByRole('button', { name: '🚪 Join Room' })).toBeVisible();
    });
  }

  test('the create-room form remains fully usable at phone width, not just present', async ({ page }) => {
    // A longer form than test-assist's tool panel had reason to check - CAH's
    // own three explicit breakpoints (style.css:560,658,724) suggest this
    // form specifically was a real reflow target, not an incidental one.
    await page.setViewportSize({ width: 375, height: 667 });
    await signInAsRegression(page);
    await page.getByRole('button', { name: '🏠 Create Room' }).click();
    await claimStarterDeckAndReturnToMenu(page);
    await page.getByRole('button', { name: '🏠 Create Room' }).click();

    await expect(page.getByPlaceholder('e.g. Friday Night Chaos')).toBeVisible();
    // The visible custom control, not the display:none input behind it -
    // see the Accessibility FINDING above for why getByRole('radio', ...)
    // doesn't apply here.
    await expect(page.getByText('Classic', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create & Start' })).toBeVisible();
  });
});
