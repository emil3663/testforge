import { escapeForSingleQuotedString } from "../format";
import {
    buildAccessibilityElementTitle,
    buildLocatorExpression,
    findMatchingProfilePage,
    getActionableElementDisplayName,
} from "../locators";
import type { ContentProfile } from "../types";
import { hiddenAtIntrospectionComment } from "./shared";

/**
 * TFP-056: replaces a hardcoded "at least one interactive element exists"
 * accessibility check with one generated per discovered element (same
 * .slice(0, 50) sampling as buildActionableElementTests), asserting a real
 * accessible name and a discoverable role at test-run time - not restating
 * what introspection already found, which would test nothing.
 *
 * Uses the built-in toHaveAccessibleName matcher and locator.ariaSnapshot()
 * rather than a hand-rolled name heuristic (text/aria-label/placeholder/
 * title): a first pass using that heuristic reported a false positive on
 * test-assist's Upload Image input, whose accessible name actually comes
 * from a wrapping <label> - a pattern a from-scratch heuristic would need
 * to keep re-deriving. Playwright's own accname/aria-tree computation
 * already handles this correctly.
 */
export function buildAccessibilityElementTests(
    contentProfile: ContentProfile | null,
    path = "/"
) {
    const matchingPage = findMatchingProfilePage(contentProfile, path);
    const elements = (matchingPage?.actionableElements ?? []).slice(0, 50);
    const escapedPath = escapeForSingleQuotedString(path);

    return elements.map((element) => {
        const name = escapeForSingleQuotedString(getActionableElementDisplayName(element));
        const title = escapeForSingleQuotedString(buildAccessibilityElementTitle(element));
        const locatorExpression = buildLocatorExpression(element);

        // Elements hidden at introspection time are excluded from the
        // accessibility tree entirely (accessible name/role computation
        // is only meaningful for rendered elements) - same root cause
        // TFP-054 fixed for the functional suite. Assert only that they
        // exist, not that they carry a name or role right now.
        if (!element.isVisible) {
            return `  test('${title}', async ({ page }) => {
    await page.goto('${escapedPath}');
    await page.waitForLoadState('domcontentloaded');

${hiddenAtIntrospectionComment}
    const locator = ${locatorExpression};
    await expect(locator).toBeAttached();
  });`;
        }

        return `  test('${title}', async ({ page }) => {
    await page.goto('${escapedPath}');
    await page.waitForLoadState('domcontentloaded');

    const locator = ${locatorExpression};
    await expect(locator, '${name} has no accessible name in the accessibility tree').toHaveAccessibleName(/.+/);

    const ariaSnapshot = (await locator.ariaSnapshot()).trim();
    const role = ariaSnapshot.match(/^-\\s*(\\S+)/)?.[1];
    expect(role, '${name} has no discoverable role in its aria snapshot: ' + ariaSnapshot).toBeTruthy();
  });`;
    });
}
