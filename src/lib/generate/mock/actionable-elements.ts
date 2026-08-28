import { escapeForSingleQuotedString } from "./format";
import {
    buildInteractionPrefix,
    buildLocatorExpression,
    buildResponseHints,
    findMatchingProfilePage,
    getActionableElementDisplayName,
} from "./locators";
import type { ActionableElementDetail, ContentProfile } from "./types";

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
        const visibilityAssertions = element.elementType === "form"
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
