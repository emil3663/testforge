import { escapeForSingleQuotedString } from "../format";
import {
    buildAccessibilityElementTitle,
    buildLocatorExpression,
    findMatchingProfilePage,
    getActionableElementDisplayName,
} from "../locators";
import type { ActionableElementDetail, ContentProfile } from "../types";
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
/**
 * TFP-145: how a link's check finds its own link. buildLocatorExpression
 * takes id, then role and name, then getByText - and introspection records
 * a name only for an element with an aria-label or a <label> (its
 * aria-label ?? label ?? text chain stops at the label, which is "" rather
 * than null when there is none). So most links fell to
 * getByText(text, { exact: true }).first(), which resolves to the element
 * holding the text - the <span> inside a WordPress menu link - and a span
 * has no accessible name: a named link failed as unnamed (rizonetech.com
 * TFAC-008 "Home", 009, 018, 038). And .first() made every same-named link
 * test the first one (four distinct "AI" links, one element tested).
 *
 * A link with a target is now found the way introspection recorded it: the
 * <a> whose resolved href and collapsed text match, and the how-manieth of
 * those it was. Links with an id keep the id; links without a target keep
 * the previous locator. buildLocatorExpression itself is unchanged - the
 * functional checks share it.
 */
function linkLookup(element: ActionableElementDetail, occurrence: number, name: string) {
    if (element.elementType !== "link" || !element.url || element.locator.id) {
        return null;
    }
    const target = escapeForSingleQuotedString(element.url);
    const text = escapeForSingleQuotedString(element.text);
    return `    // The link introspection recorded: href ${target}, text '${text}', match ${occurrence + 1} of those.
    let linkIndex = -1;
    await expect.poll(async () => (linkIndex = await page.locator('a').evaluateAll((links, wanted) => links
      .map((link, index) => ({ link, index }))
      .filter(({ link }) => (link as HTMLAnchorElement).href === wanted.url && (link.textContent ?? '').replace(/\\s+/g, ' ').trim() === wanted.text)
      .map(({ index }) => index)[wanted.occurrence] ?? -1, { url: '${target}', text: '${text}', occurrence: ${occurrence} })), { message: '${name} (a link to ${target}) is not on the page' }).toBeGreaterThanOrEqual(0);
    const locator = page.locator('a').nth(linkIndex);`;
}

export function buildAccessibilityElementTests(
    contentProfile: ContentProfile | null,
    path = "/"
) {
    const matchingPage = findMatchingProfilePage(contentProfile, path);
    const allElements = matchingPage?.actionableElements ?? [];
    const elements = allElements.slice(0, 50);
    const escapedPath = escapeForSingleQuotedString(path);

    return elements.map((element, position) => {
        const name = escapeForSingleQuotedString(getActionableElementDisplayName(element));
        const title = escapeForSingleQuotedString(buildAccessibilityElementTitle(element));
        // Which of the recorded links with this target and text this one is, in page order.
        const occurrence = allElements.slice(0, position).filter((other) => other.elementType === "link" && other.url === element.url && other.text === element.text).length;
        const locatorSetup = linkLookup(element, occurrence, name) ?? `    const locator = ${buildLocatorExpression(element)};`;

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
${locatorSetup}
    await expect(locator).toBeAttached();
  });`;
        }

        return `  test('${title}', async ({ page }) => {
    await page.goto('${escapedPath}');
    await page.waitForLoadState('domcontentloaded');

${locatorSetup}
    await expect(locator, '${name} has no accessible name in the accessibility tree').toHaveAccessibleName(/.+/);

    const ariaSnapshot = (await locator.ariaSnapshot()).trim();
    const role = ariaSnapshot.match(/^-\\s*(\\S+)/)?.[1];
    expect(role, '${name} has no discoverable role in its aria snapshot: ' + ariaSnapshot).toBeTruthy();
  });`;
    });
}
