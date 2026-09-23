import { escapeForSingleQuotedString } from "../format";
import {
    buildLocatorExpression,
    findMatchingProfilePage,
    getActionableElementDisplayName,
} from "../locators";
import type { ActionableElementDetail, ContentProfile } from "../types";

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
