import { escapeForSingleQuotedString } from "../format";
import {
    buildLocatorExpression,
    findMatchingProfilePage,
    getActionableElementDisplayName,
} from "../locators";
import type { ActionableElementDetail, ContentProfile } from "../types";

// TFP-060: canonical opposite-action vocabulary, same word-list style as
// ONE_SHOT_ACTION_WORDS above. Deliberately narrow (exact antonym pairs
// only, no fuzzy matching) - a broader heuristic risks pairing unrelated
// buttons that happen to share a word, generating a negative-assertion
// test that asserts something false.
const ACTION_PAIR_WORD_GROUPS: readonly [string, string][] = [
    ["undo", "redo"],
    ["save", "discard"],
    ["open", "close"],
    ["show", "hide"],
    ["expand", "collapse"],
    ["lock", "unlock"],
    ["play", "pause"],
    ["mute", "unmute"],
    ["enable", "disable"],
    ["start", "stop"],
];

function elementWords(element: ActionableElementDetail) {
    return getActionableElementDisplayName(element)
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(Boolean);
}

/**
 * TFP-060: detects action-pair buttons (Undo/Redo and similar canonical
 * opposites) and generates one negative-assertion test per pair - an
 * interaction with nothing to do with the pair (a mouse move to a neutral
 * point, the closest thing to a true no-op Playwright can dispatch) must
 * not change the paired element's enabled state or text. This is a
 * regression guard, not expected to catch anything under normal
 * operation - it passes everywhere by construction and exists to fail
 * if some future change makes an unrelated interaction leak into a
 * pair's state.
 *
 * Only pairs where both members match exactly once, and both are
 * isVisible, are used - an ambiguous (0 or 2+) match on either side of a
 * pair is skipped rather than guessed at, and a hidden-at-introspection
 * member would repeat TFP-054/TFP-056's false-positive shape if asserted
 * against directly.
 */
export function buildActionPairTests(
    contentProfile: ContentProfile | null,
    path = "/"
) {
    const matchingPage = findMatchingProfilePage(contentProfile, path);
    const elements = (matchingPage?.actionableElements ?? [])
        .filter((element) => element.isVisible)
        .slice(0, 50);
    const escapedPath = escapeForSingleQuotedString(path);
    const tests: string[] = [];
    const pairedElements = new Set<ActionableElementDetail>();

    for (const [wordA, wordB] of ACTION_PAIR_WORD_GROUPS) {
        const membersA = elements.filter((element) => !pairedElements.has(element) && elementWords(element).includes(wordA));
        const membersB = elements.filter((element) => !pairedElements.has(element) && elementWords(element).includes(wordB));

        if (membersA.length !== 1 || membersB.length !== 1) {
            continue;
        }

        const [elementA] = membersA;
        const [elementB] = membersB;
        pairedElements.add(elementA);
        pairedElements.add(elementB);

        const nameA = escapeForSingleQuotedString(getActionableElementDisplayName(elementA));
        const nameB = escapeForSingleQuotedString(getActionableElementDisplayName(elementB));
        const locatorExpressionA = buildLocatorExpression(elementA);
        const locatorExpressionB = buildLocatorExpression(elementB);

        tests.push(`  test('action pair: ${nameA} / ${nameB} are unaffected by an unrelated interaction', async ({ page }) => {
    await page.goto('${escapedPath}');
    await page.waitForLoadState('domcontentloaded');

    const elementA = ${locatorExpressionA};
    const elementB = ${locatorExpressionB};
    const before = {
      aEnabled: await elementA.isEnabled(),
      aText: (await elementA.textContent())?.trim() ?? '',
      bEnabled: await elementB.isEnabled(),
      bText: (await elementB.textContent())?.trim() ?? '',
    };

    // Unrelated no-op: a mouse move to a neutral point has nothing to do
    // with the ${nameA}/${nameB} pair, so it should never change either
    // element's state.
    await page.mouse.move(0, 0);

    const after = {
      aEnabled: await elementA.isEnabled(),
      aText: (await elementA.textContent())?.trim() ?? '',
      bEnabled: await elementB.isEnabled(),
      bText: (await elementB.textContent())?.trim() ?? '',
    };

    expect(after.aEnabled, '${nameA} enabled state changed after an unrelated interaction').toBe(before.aEnabled);
    expect(after.aText, '${nameA} text changed after an unrelated interaction').toBe(before.aText);
    expect(after.bEnabled, '${nameB} enabled state changed after an unrelated interaction').toBe(before.bEnabled);
    expect(after.bText, '${nameB} text changed after an unrelated interaction').toBe(before.bText);
  });`);
    }

    return tests;
}
