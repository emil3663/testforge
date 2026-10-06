import { escapeForSingleQuotedString } from "../format";
import {
    buildActionableElementTitle,
    buildLocatorExpression,
    buildResponseHints,
    findMatchingProfilePage,
} from "../locators";
import type { ActionableElementDetail, ContentProfile } from "../types";
import { buildFormCheckTest } from "./form-check";
import { hiddenAtIntrospectionComment } from "./shared";

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

    // Every recorded form counts towards a form's position, ids or not: they are all <form>s on the page.
    const profileForms = actionableElements.filter((element) => element.elementType === "form");
    return actionableElements.map((element: ActionableElementDetail) => {
        const title = escapeForSingleQuotedString(buildActionableElementTitle(element));
        // TFP-160: a form with an id keeps its id; one without is found by its record, not its text.
        if (element.elementType === "form" && element.category !== "api" && !element.locator.id) {
            return buildFormCheckTest(title, escapeForSingleQuotedString(path), element, profileForms.indexOf(element));
        }

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
