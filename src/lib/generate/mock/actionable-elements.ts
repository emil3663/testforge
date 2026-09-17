import { escapeForSingleQuotedString } from "./format";
import {
    buildInteractionPrefix,
    buildLocatorExpression,
    buildResponseHints,
    findMatchingProfilePage,
    getActionableElementDisplayName,
} from "./locators";
import type { ActionableElementDetail, ContentProfile } from "./types";

// TFP-054: an element discovered but not visible at introspection time is
// not a false claim to make "visible" about - it may be legitimately
// hidden by design until a prerequisite action (a mode switch, an open
// dialog, a different tab), the exact shape behind TFP-040's 7 confirmed
// false positives. Assert only that it exists, and say why nothing
// stronger is claimed. Shared by every builder in this file that walks
// actionable elements (TFP-056, TFP-059 hit the same hidden elements).
const hiddenAtIntrospectionComment =
    "    // Hidden at introspection time - may require a prerequisite action (e.g. a mode switch, an open dialog, a different tab) before it becomes visible. Asserting only that it exists in the DOM, not that it is currently visible or interactable.";

export function buildActionableElementTests(
    contentProfile: ContentProfile | null,
    path = "/"
) {
    const matchingPage = findMatchingProfilePage(contentProfile, path);
    const hasDedicatedLinkDetails = (matchingPage?.linkDetails?.length ?? 0) > 0;
    const actionableElements = (matchingPage?.actionableElements ?? [])
        .filter((element) => !hasDedicatedLinkDetails || element.elementType !== "link")
        .slice(0, 50);

    if (actionableElements.length === 0) {
        const escapedPath = escapeForSingleQuotedString(path);

        return [`  test('actionable element setup for ${escapedPath} did not discover any interactive elements', async ({ page }) => {
    await page.goto('${escapedPath}');
    await page.waitForLoadState('domcontentloaded');

    const elements = await page.locator('a[href], button, input:not([type="hidden"]), select, textarea, form, [role="button"]').evaluateAll((nodes) => {
      return Array.from(nodes)
        .map((node) => ({
          text: node.textContent?.replace(/\s+/g, ' ').trim() ?? '',
          role: node.getAttribute('role') ?? '',
          id: node.getAttribute('id') ?? '',
          tagName: node.tagName.toLowerCase(),
        }))
        .filter((element) => Boolean(element.text || element.role || element.id));
    });

    expect(
      elements.length,
      'No actionable elements were discovered during introspection, so classified interaction results could not be generated.'
    ).toBeGreaterThan(0);
  });`];
    }

    return actionableElements.map((element: ActionableElementDetail) => {
        const elementName = getActionableElementDisplayName(element);
        const label = escapeForSingleQuotedString(elementName);
        const containerSuffix = element.containerLabel
            ? ` [${escapeForSingleQuotedString(element.containerLabel)}]`
            : "";
        const title = `${buildInteractionPrefix(element.category)}: ${label}${containerSuffix} [${element.elementType}]`;

        if (element.category === "api" && element.url) {
            const url = escapeForSingleQuotedString(element.url);
            const expectedStatusComment = typeof element.expectedStatus === "number"
                ? `    expect(response.status()).toBe(${element.expectedStatus});`
                : "    expect(response.status()).toBeLessThan(500);";
            const redirectSetting = typeof element.expectedStatus === "number" && element.expectedStatus >= 300 && element.expectedStatus < 400
                ? "      maxRedirects: 0,\n"
                : "";

            return `  test('${title}', async ({ request }) => {
    const response = await request.get('${url}', {
      failOnStatusCode: false,
      timeout: 15000,
${redirectSetting}    });

${expectedStatusComment}
  });`;
        }

        if (
            element.category === "api" &&
            (element.elementType === "button" ||
                (element.elementType === "input" && ["button", "submit", "reset"].includes(element.locator.inputType || "")) ||
                element.elementType === "link")
        ) {
            const escapedPath = escapeForSingleQuotedString(path);
            const locatorExpression = buildLocatorExpression(element);

            if (!element.isVisible) {
                return `  test('${title}', async ({ page }) => {
        await page.goto('${escapedPath}');
        await page.waitForLoadState('domcontentloaded');

${hiddenAtIntrospectionComment}
        const locator = ${locatorExpression};
        await expect(locator).toBeAttached();
    });`;
            }

            const expectedStatusComment = typeof element.expectedStatus === "number"
                ? `    expect(response.status()).toBe(${element.expectedStatus});`
                : "    expect(response.status()).toBeLessThan(500);";
            const responseHints = buildResponseHints(element);
            const responseHintsLiteral = `[${responseHints
                .map((hint) => `'${escapeForSingleQuotedString(hint)}'`)
                .join(", ")}]`;

            return `  test('${title}', async ({ page }) => {
        await page.goto('${escapedPath}');
        await page.waitForLoadState('domcontentloaded');

        const locator = ${locatorExpression};
        await expect(locator).toBeVisible();
        await expect(locator).toBeEnabled();
        await locator.scrollIntoViewIfNeeded();

        const responseHints = ${responseHintsLiteral};

        const responsePromise = page.waitForResponse((response) => {
            const request = response.request();
            const resourceType = request.resourceType();
            const normalizedUrl = response.url().toLowerCase();
            const hintMatch =
                responseHints.length === 0 ||
                responseHints.some((hint) => normalizedUrl.includes(hint));

            return (
                (resourceType === 'fetch' || resourceType === 'xhr' || resourceType === 'document') &&
                request.method() !== 'OPTIONS' &&
                hintMatch
            );
        }, { timeout: 15000 });

        await locator.click();
        const response = await responsePromise;

${expectedStatusComment}
    });`;
        }

        const escapedPath = escapeForSingleQuotedString(path);
        const locatorExpression = buildLocatorExpression(element);
        const visibilityAssertions = !element.isVisible
            ? `${hiddenAtIntrospectionComment}\n    await expect(locator).toBeAttached();`
            : element.elementType === "form"
                ? `    await expect(locator).toBeVisible();\n\n    const controlCount = await locator.locator('input, textarea, select, button').count();\n    expect(controlCount).toBeGreaterThan(0);`
                : element.elementType === "input" || element.elementType === "textarea"
                    ? `    await expect(locator).toBeVisible();\n    await expect(locator).toBeEditable();`
                    : element.elementType === "select"
                        ? `    await expect(locator).toBeVisible();\n    await expect(locator).toBeEnabled();`
                        : element.elementType === "link"
                            ? `    await expect(locator).toBeVisible();\n    await expect(locator).toHaveAttribute('href', /.+/);`
                            : `    await expect(locator).toBeVisible();\n    await expect(locator).toBeEnabled();`;

        return `  test('${title}', async ({ page }) => {
    await page.goto('${escapedPath}');
    await page.waitForLoadState('domcontentloaded');

    const locator = ${locatorExpression};
${visibilityAssertions}
  });`;
    });
}

const ARIA_STATE_FIELDS = ["ariaPressed", "ariaSelected", "ariaChecked", "ariaExpanded"] as const;
const ARIA_STATE_ATTRIBUTE_NAMES: Record<(typeof ARIA_STATE_FIELDS)[number], string> = {
    ariaPressed: "aria-pressed",
    ariaSelected: "aria-selected",
    ariaChecked: "aria-checked",
    ariaExpanded: "aria-expanded",
};

function activeAriaStateField(element: ActionableElementDetail) {
    return ARIA_STATE_FIELDS.find((field) => element[field] === "true");
}

/**
 * TFP-057: turns TFP-055's captured group data into an actual failing
 * assertion when a detected toggle/selection group has no ARIA state at
 * all - the shape TA-252 was filed from, and the exact gap the generator's
 * own generic Accessibility Coverage test (TFAC-001) has no data to catch.
 * One presence test per group, plus a second toggle-behavior test only when
 * a state attribute is already present on at least one member - asserting
 * presence and asserting correct toggling are different claims, and only
 * the first is honest to make when nothing indicates which attribute (if
 * any) a fix would even use.
 */
export function buildToggleGroupTests(
    contentProfile: ContentProfile | null,
    path = "/"
) {
    const matchingPage = findMatchingProfilePage(contentProfile, path);
    const elements = matchingPage?.actionableElements ?? [];
    const escapedPath = escapeForSingleQuotedString(path);

    const groups = new Map<string, ActionableElementDetail[]>();
    for (const element of elements) {
        if (!element.groupId) {
            continue;
        }
        const members = groups.get(element.groupId) ?? [];
        members.push(element);
        groups.set(element.groupId, members);
    }

    const tests: string[] = [];

    for (const members of groups.values()) {
        const groupLabel = escapeForSingleQuotedString(
            members[0]?.containerLabel || `a ${members.length}-member group`
        );

        const presenceChecks = members
            .map((member) => {
                const name = escapeForSingleQuotedString(getActionableElementDisplayName(member));
                const locatorExpression = buildLocatorExpression(member);
                return `    {
      const locator = ${locatorExpression};
      const [pressed, selected, checked, expanded] = await Promise.all([
        locator.getAttribute('aria-pressed'),
        locator.getAttribute('aria-selected'),
        locator.getAttribute('aria-checked'),
        locator.getAttribute('aria-expanded'),
      ]);
      expect(
        pressed !== null || selected !== null || checked !== null || expanded !== null,
        '${name} is part of a detected toggle/selection group but exposes no ARIA state attribute (aria-pressed/aria-selected/aria-checked/aria-expanded), so assistive technology has no way to tell which member is current'
      ).toBeTruthy();
    }`;
            })
            .join("\n\n");

        tests.push(`  test('toggle group "${groupLabel}" (${members.length} members) exposes ARIA state on every member', async ({ page }) => {
    await page.goto('${escapedPath}');
    await page.waitForLoadState('domcontentloaded');

${presenceChecks}
  });`);

        const activeMember = members.find((member) => activeAriaStateField(member));
        const stateField = activeMember ? activeAriaStateField(activeMember) : undefined;

        if (activeMember && stateField) {
            const targetMember = members.find((member) => member !== activeMember);

            if (targetMember) {
                const attributeName = ARIA_STATE_ATTRIBUTE_NAMES[stateField];
                const activeExpression = buildLocatorExpression(activeMember);
                const targetExpression = buildLocatorExpression(targetMember);
                const activeName = escapeForSingleQuotedString(getActionableElementDisplayName(activeMember));
                const targetName = escapeForSingleQuotedString(getActionableElementDisplayName(targetMember));

                tests.push(`  test('toggle group "${groupLabel}": clicking a member flips its ${attributeName}, and the previously-active member reverts', async ({ page }) => {
    await page.goto('${escapedPath}');
    await page.waitForLoadState('domcontentloaded');

    const active = ${activeExpression}; // ${activeName}, active at introspection time
    const target = ${targetExpression}; // ${targetName}, inactive at introspection time

    await target.click();

    const activeAfter = await active.getAttribute('${attributeName}');
    const targetAfter = await target.getAttribute('${attributeName}');

    expect(targetAfter, '${targetName} should report an active ${attributeName} after being clicked').toBe('true');
    expect(activeAfter, '${activeName} should no longer report an active ${attributeName} once a sibling is selected').not.toBe('true');
  });`);
            }
        }
    }

    return tests;
}

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
        const locatorExpression = buildLocatorExpression(element);

        // Elements hidden at introspection time are excluded from the
        // accessibility tree entirely (accessible name/role computation
        // is only meaningful for rendered elements) - same root cause
        // TFP-054 fixed for the functional suite. Assert only that they
        // exist, not that they carry a name or role right now.
        if (!element.isVisible) {
            return `  test('accessible name and role: ${name} [${element.elementType}]', async ({ page }) => {
    await page.goto('${escapedPath}');
    await page.waitForLoadState('domcontentloaded');

${hiddenAtIntrospectionComment}
    const locator = ${locatorExpression};
    await expect(locator).toBeAttached();
  });`;
        }

        return `  test('accessible name and role: ${name} [${element.elementType}]', async ({ page }) => {
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
