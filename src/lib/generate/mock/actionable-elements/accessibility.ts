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
 *
 * The position counts only links with the visibility introspection
 * recorded, in the recorded data and in the page. Introspection drops a link
 * that repeats another's URL, text and container whatever its visibility, so
 * a hidden mobile copy of a menu link is in the page but not in the data;
 * counted, it shifted the footer copy's check onto itself and failed a
 * named link. The visibility rule is introspection's own isVisibleElement.
 *
 * TFP-152: the name follows HTML-AAM 4.1.10, not Playwright's departure
 * from it (decided by Emil, 2026-10-05: the standard decides, not any one
 * tool). An <img alt=""> is presentational and has no name; its title is
 * used only when there is no alt attribute. Playwright 1.59.1 falls back to
 * the title, so rizonetech.com's logo link - an alt="" image with a title -
 * passed as named. The check takes those titles off before reading the
 * name, and a failure says why. A title on the element itself, or a
 * non-empty alt, still names it. "Empty" is HTML-AAM's "empty when trimmed
 * of whitespace" (ASCII whitespace, as HTML strips it): alt=" " is
 * presentational too, and Playwright treats it as a real image (TFP-152
 * follow-up).
 */
function linkLookup(element: ActionableElementDetail, occurrence: number, name: string) {
    if (element.elementType !== "link" || !element.url || element.locator.id) {
        return null;
    }
    const target = escapeForSingleQuotedString(element.url);
    const text = escapeForSingleQuotedString(element.text);
    const visibility = element.isVisible ? "visible" : "hidden";
    return `    // The link introspection recorded: href ${target}, text '${text}', match ${occurrence + 1} of those that are ${visibility}.
    let linkIndex = -1;
    await expect.poll(async () => (linkIndex = await page.locator('a').evaluateAll((links, wanted) => links
      .map((link, index) => ({ link, index }))
      .filter(({ link }) => (link as HTMLAnchorElement).href === wanted.url && (link.textContent ?? '').replace(/\\s+/g, ' ').trim() === wanted.text)
      .filter(({ link }) => {
        const style = getComputedStyle(link);
        const box = link.getBoundingClientRect();
        return (style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0) === wanted.visible;
      })
      .map(({ index }) => index)[wanted.occurrence] ?? -1, { url: '${target}', text: '${text}', visible: ${element.isVisible}, occurrence: ${occurrence} })), { message: '${name} (a ${visibility} link to ${target}) is not on the page' }).toBeGreaterThanOrEqual(0);
    const locator = page.locator('a').nth(linkIndex);`;
}

/**
 * TFP-151: TFP-145's approach for the other element types. A button,
 * select, textarea or input with no id, label or placeholder was located
 * with getByText(text).first(): the element holding the text - the <span>
 * inside a button - which has no name, and always the first of same-text
 * elements. It is now found among its own kind by the text introspection
 * recorded (computed as introspection does), its visibility and its
 * position among those.
 */
const KIND_SELECTORS: Partial<Record<ActionableElementDetail["elementType"], string>> = {
    button: 'button, input[type="button"], input[type="submit"], input[type="reset"], [role="button"]:not(a)',
    select: "select",
    textarea: "textarea",
    input: 'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"])',
};

function controlLookup(element: ActionableElementDetail, occurrence: number, name: string) {
    const selector = KIND_SELECTORS[element.elementType];
    const locatedByText = !element.locator.id && !(element.locator.role && element.locator.name) && !element.locator.label && !element.locator.placeholder;
    if (!selector || !locatedByText || !element.text) {
        return null;
    }
    const text = escapeForSingleQuotedString(element.text);
    const visibility = element.isVisible ? "visible" : "hidden";
    const kind = escapeForSingleQuotedString(selector);
    return `    // The ${element.elementType} introspection recorded: text '${text}', match ${occurrence + 1} of those that are ${visibility} (TFP-151).
    let elementIndex = -1;
    await expect.poll(async () => (elementIndex = await page.locator('${kind}').evaluateAll((nodes, wanted) => nodes
      .map((node, index) => ({ node, index }))
      .filter(({ node }) => {
        const text = node instanceof HTMLInputElement ? node.value || node.getAttribute('aria-label') || node.getAttribute('placeholder') || node.name || '' : node.textContent ?? '';
        return text.replace(/\\s+/g, ' ').trim() === wanted.text;
      })
      .filter(({ node }) => {
        const style = getComputedStyle(node);
        const box = node.getBoundingClientRect();
        return (style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0) === wanted.visible;
      })
      .map(({ index }) => index)[wanted.occurrence] ?? -1, { text: '${text}', visible: ${element.isVisible}, occurrence: ${occurrence} })), { message: '${name} (a ${visibility} ${element.elementType}) is not on the page' }).toBeGreaterThanOrEqual(0);
    const locator = page.locator('${kind}').nth(elementIndex);`;
}

/**
 * TFP-151 (T23): a form is the <form> itself - by TFP-160's record (action,
 * method, occurrence), or the nth <form> in a profile without one - never the
 * element holding its text, which on practicesoftwaretesting.com was a <div>.
 */
function formLookup(element: ActionableElementDetail, profileFormIndex: number, name: string) {
    if (element.elementType !== "form" || element.locator.id) {
        return null;
    }
    if (!element.form) {
        return `    // The page's form number ${profileFormIndex + 1}, in the order the page was inspected (no form record in this profile).
    const locator = page.locator('form').nth(${profileFormIndex});`;
    }
    const { action, method, occurrence } = element.form;
    return `    // The <form> introspection recorded, by its action and method as written and which of those it is (TFP-160).
    const formIndex = await page.locator('form').evaluateAll((nodes, wanted) => nodes
      .map((node, position) => ({ position, action: node.getAttribute('action') ?? '', method: (node.getAttribute('method') ?? '').toLowerCase() }))
      .filter((form) => form.action === wanted.action && form.method === wanted.method)
      .map((form) => form.position)[wanted.occurrence] ?? -1, { action: '${escapeForSingleQuotedString(action)}', method: '${escapeForSingleQuotedString(method)}', occurrence: ${occurrence} });
    expect(formIndex, '${name} (a form) is not on the page').toBeGreaterThanOrEqual(0);
    const locator = page.locator('form').nth(formIndex);`;
}

/**
 * TFP-151 (decided by Emil, 2026-10-06): an element with no role has no
 * name to check. Under HTML-AAM a <form> has the form role only when it has
 * an accessible name; without aria-label, aria-labelledby or title it is
 * generic. Such a check is Not run, with that reason, not passed.
 */
function noRoleSkip(name: string) {
    return `    // HTML-AAM: a <form> has the form role only when it is named; unnamed, it is generic and has no name to check (TFP-151).
    const unnamedForm = await locator.evaluate((node) => !node.getAttribute('role') && !['aria-label', 'aria-labelledby', 'title'].some((attribute) => (node.getAttribute(attribute) ?? '').trim() !== ''));
    test.skip(unnamedForm, '${name} is a <form> with no accessible name, so it has no role (HTML-AAM): there is no name to check');`;
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
        // Which of the recorded links with this target, text and visibility this one is, in page order.
        const occurrence = allElements.slice(0, position).filter((other) => other.elementType === "link" && other.url === element.url && other.text === element.text && other.isVisible === element.isVisible).length;
        // TFP-151: likewise, which of the recorded elements of its kind, text and visibility this one is.
        const kindOccurrence = allElements.slice(0, position).filter((other) => other.elementType === element.elementType && other.text === element.text && other.isVisible === element.isVisible).length;
        const locatorSetup = linkLookup(element, occurrence, name)
            ?? formLookup(element, allElements.filter((other) => other.elementType === "form").indexOf(element), name)
            ?? controlLookup(element, kindOccurrence, name)
            ?? `    const locator = ${buildLocatorExpression(element)};`;
        const isUnnamedFormCandidate = element.elementType === "form";

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
${isUnnamedFormCandidate ? `${noRoleSkip(name)}
` : ""}    // HTML-AAM 4.1.10: an <img> whose alt is empty once trimmed of whitespace is presentational and has no name; its title
    // counts only when there is no alt. Playwright falls back to that title, so it is taken off before the name is read (the page is not reused).
    const presentationalTitles = await locator.evaluate((element) => Array.from(element.querySelectorAll('img[alt][title]')).filter((image) => /^[\\t\\n\\f\\r ]*$/.test(image.getAttribute('alt') ?? '')).map((image) => {
      const title = image.getAttribute('title') ?? '';
      image.removeAttribute('title');
      return title;
    }));
    await expect(locator, presentationalTitles.length > 0
      ? '${name} has no accessible name: HTML-AAM 4.1.10 gives an <img alt=""> no name and does not use its title ("' + presentationalTitles.join('", "') + '")'
      : '${name} has no accessible name in the accessibility tree').toHaveAccessibleName(/.+/);

    const ariaSnapshot = (await locator.ariaSnapshot()).trim();
    const role = ariaSnapshot.match(/^-\\s*(\\S+)/)?.[1];
    expect(role, '${name} has no discoverable role in its aria snapshot: ' + ariaSnapshot).toBeTruthy();
  });`;
    });
}
