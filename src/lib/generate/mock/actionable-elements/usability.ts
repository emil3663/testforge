import { escapeForSingleQuotedString } from "../format";
import {
    buildLocatorExpression,
    findMatchingProfilePage,
    getActionableElementDisplayName,
} from "../locators";
import type { ContentProfile } from "../types";

const GENERIC_GUIDANCE_TEXT = ["submit", "click here", "ok", "button", "click", "link", "here"];
const PRIMARY_ACTION_CATEGORIES = ["form", "action"];
const DESKTOP_FOLD_HEIGHT_PX = 900;

/**
 * TFP-059: replaces the usability block's "count of visible interactive
 * elements > 0" - functionally the same claim Functional's own
 * TFUS-001-style check already makes - with two claims specific to
 * usability rather than existence: guidance text that isn't a
 * context-free generic label, and primary actions (category "form"/
 * "action", already inferred at introspection time by inferCategory) not
 * requiring a scroll to reach on first paint at desktop viewport.
 */
export function buildUsabilityElementTests(
    contentProfile: ContentProfile | null,
    path = "/"
) {
    const matchingPage = findMatchingProfilePage(contentProfile, path);
    const elements = (matchingPage?.actionableElements ?? []).slice(0, 50);
    const escapedPath = escapeForSingleQuotedString(path);
    const tests: string[] = [];

    for (const element of elements) {
        if (!element.locator.label && !element.locator.placeholder) {
            continue;
        }

        const name = escapeForSingleQuotedString(getActionableElementDisplayName(element));
        const locatorExpression = buildLocatorExpression(element);
        const genericTextLiteral = `[${GENERIC_GUIDANCE_TEXT.map((word) => `'${word}'`).join(", ")}]`;

        tests.push(`  test('usability: ${name} [${element.elementType}] uses non-generic guidance text', async ({ page }) => {
    await page.goto('${escapedPath}');
    await page.waitForLoadState('domcontentloaded');

    const locator = ${locatorExpression};
    const text = ((await locator.textContent()) || '').trim().toLowerCase();
    const genericPhrases = ${genericTextLiteral};
    expect(genericPhrases.includes(text), '${name} uses a generic, context-free label ("' + text + '") instead of guidance specific to what it does').toBe(false);
  });`);
    }

    const primaryActions = elements
        // TFP-054 established that an element hidden at introspection time
        // (e.g. behind a mode switch) can't be asserted visible or
        // in-viewport without reproducing the same false positive that
        // fix removed - exclude those here too, same as isVisible gating
        // in buildActionableElementTests.
        .filter((element) => element.isVisible && PRIMARY_ACTION_CATEGORIES.includes(element.category))
        .slice(0, 5);

    if (primaryActions.length > 0) {
        const checks = primaryActions
            .map((element) => {
                const name = escapeForSingleQuotedString(getActionableElementDisplayName(element));
                const locatorExpression = buildLocatorExpression(element);
                return `    {
      const locator = ${locatorExpression};
      const box = await locator.boundingBox();
      expect(box, '${name} has no bounding box - not rendered on first paint').not.toBeNull();
      if (box) {
        expect(box.y, '${name} requires scrolling to reach on first paint at desktop viewport').toBeLessThan(${DESKTOP_FOLD_HEIGHT_PX});
      }
    }`;
            })
            .join("\n\n");

        tests.push(`  test('usability: primary actions are reachable without scrolling at desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('${escapedPath}');
    await page.waitForLoadState('domcontentloaded');

${checks}
  });`);
    }

    return tests;
}
