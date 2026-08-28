import { escapeForSingleQuotedString } from "../format";
import { buildLinkLocatorExpression, buildLinkTitle } from "../locators";
import type { LinkDetail } from "../types";

export function buildBrowserInteractionLinkTests(
    browserInteractionLinks: LinkDetail[],
    escapedPath: string,
    isFastLinkAudit: boolean,
    linkAuditTimeoutMs: number
) {
    const tests: string[] = [];

    for (const link of browserInteractionLinks) {
        const locatorExpression = buildLinkLocatorExpression(link);
        const linkTitle = buildLinkTitle(link);
        const linkUrl = escapeForSingleQuotedString(link.url);
        const rawHref = escapeForSingleQuotedString(link.rawHref);
        const expectedStatusAssertion = typeof link.expectedStatus === "number"
            ? `    expect(response.status()).toBe(${link.expectedStatus});`
            : "    expect(response.status()).toBeLessThan(500);";

        if (link.category === "api") {
            tests.push(`  test('api link response: ${linkTitle}', async ({ page }) => {
        await page.goto('${escapedPath}');
        await page.waitForLoadState('domcontentloaded');

        const locator = ${locatorExpression};
        await expect(locator).toBeVisible();

        const expectedUrl = new URL('${linkUrl}');
        const responsePromise = page.waitForResponse((response) => {
            const request = response.request();
            const resourceType = request.resourceType();
            return (
                (resourceType === 'fetch' || resourceType === 'xhr' || resourceType === 'document') &&
                request.method() !== 'OPTIONS' &&
                response.url().toLowerCase().includes(expectedUrl.pathname.toLowerCase())
            );
        }, { timeout: ${linkAuditTimeoutMs} });

        await locator.click();
        const response = await responsePromise;

${expectedStatusAssertion}
    });`);

            continue;
        }

        if (link.linkType === "inert") {
            tests.push(`  test('navigation link health: ${linkTitle}', async ({ page }) => {
        await page.goto('${escapedPath}');
        await page.waitForLoadState('domcontentloaded');

        const locator = ${locatorExpression};
        await expect(locator).toBeVisible();
        await expect(locator).toHaveAttribute('href', '${rawHref}');
    });`);

            continue;
        }

        if (link.linkType === "mailto") {
            tests.push(`  test('navigation link health: ${linkTitle}', async ({ page }) => {
        await page.goto('${escapedPath}');
        await page.waitForLoadState('domcontentloaded');

        const locator = ${locatorExpression};
        await expect(locator).toBeVisible();
        await expect(locator).toHaveAttribute('href', '${rawHref}');
    });`);

            continue;
        }

        if (link.linkType === "anchor") {
            tests.push(`  test('navigation link health: ${linkTitle}', async ({ page }) => {
        await page.goto('${escapedPath}');
        await page.waitForLoadState('domcontentloaded');

        const locator = ${locatorExpression};
        await expect(locator).toBeVisible();
        await locator.click();

        expect(new URL(page.url()).hash).toBe('${rawHref}');
    });`);

            continue;
        }

        if (link.linkType === "download") {
            tests.push(`  test('navigation link health: ${linkTitle}', async ({ page, request }) => {
        await page.goto('${escapedPath}');
        await page.waitForLoadState('domcontentloaded');

        const locator = ${locatorExpression};
        await expect(locator).toBeVisible();

        const response = await request.get('${linkUrl}', { failOnStatusCode: false, timeout: ${linkAuditTimeoutMs} });
        expect(response.status()).toBeLessThan(400);
        await expect(locator).toHaveAttribute('href', /.+/);
    });`);

            continue;
        }

        if (link.targetBehavior === "new-tab" || link.targetBehavior === "new-window") {
            if (isFastLinkAudit) {
                tests.push(`  test('navigation link health: ${linkTitle}', async ({ page, request }) => {
        await page.goto('${escapedPath}');
        await page.waitForLoadState('domcontentloaded');

        const locator = ${locatorExpression};
        await expect(locator).toBeVisible();

        const response = await request.get('${linkUrl}', {
            failOnStatusCode: false,
            timeout: ${linkAuditTimeoutMs},
            maxRedirects: 0,
        });
        expect(response.status()).toBeLessThan(400);
    });`);

                continue;
            }

            tests.push(`  test('navigation link health: ${linkTitle}', async ({ page, context, request }) => {
        await page.goto('${escapedPath}');
        await page.waitForLoadState('domcontentloaded');

        const locator = ${locatorExpression};
        await expect(locator).toBeVisible();

        const response = await request.get('${linkUrl}', {
            failOnStatusCode: false,
            timeout: ${linkAuditTimeoutMs},
            maxRedirects: 0,
        });
        expect(response.status()).toBeLessThan(400);

        const popupPromise = context.waitForEvent('page');
        await locator.click();
        const popup = await popupPromise;
        await popup.waitForLoadState('domcontentloaded').catch(() => {});
        expect(popup.url()).toContain('${escapeForSingleQuotedString(link.url.replace(/[#?].*$/, ""))}');
        await popup.close().catch(() => {});
    });`);

            continue;
        }

        if (isFastLinkAudit) {
            tests.push(`  test('navigation link health: ${linkTitle}', async ({ page, request }) => {
        await page.goto('${escapedPath}');
        await page.waitForLoadState('domcontentloaded');

        const locator = ${locatorExpression};
        await expect(locator).toBeVisible();

        const response = await request.get('${linkUrl}', {
            failOnStatusCode: false,
            timeout: ${linkAuditTimeoutMs},
            maxRedirects: 5,
        });
        expect(response.status()).toBeLessThan(400);
        await expect(locator).toHaveAttribute('href', /.+/);
    });`);

            continue;
        }

        tests.push(`  test('navigation link health: ${linkTitle}', async ({ page, request }) => {
        await page.goto('${escapedPath}');
        await page.waitForLoadState('domcontentloaded');

        const locator = ${locatorExpression};
        await expect(locator).toBeVisible();

        const response = await request.get('${linkUrl}', {
            failOnStatusCode: false,
            timeout: ${linkAuditTimeoutMs},
            maxRedirects: 5,
        });
        expect(response.status()).toBeLessThan(400);

        await locator.click();
        await page.waitForLoadState('domcontentloaded').catch(() => {});
        expect(page.url()).toContain('${escapeForSingleQuotedString(link.url.replace(/[#?].*$/, ""))}');
    });`);
    }

    return tests;
}
