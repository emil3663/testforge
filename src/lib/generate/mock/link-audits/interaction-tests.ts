import { escapeForSingleQuotedString } from "../format";
import { buildLinkLocatorExpression, buildLinkTitle } from "../locators";
import type { LinkDetail } from "../types";
import { buildHiddenLinkLocatorExpression, buildRevealHelper } from "./reveal";

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
        // The link, or what renders it: an anchor around a positioned image has no box of its own.
        const rendered = locator.or(locator.locator('*')).filter({ visible: true }).first();
        await expect(rendered).toBeVisible();

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

        await rendered.click();
        const response = await responsePromise;

${expectedStatusAssertion}
    });`);

            continue;
        }

        // TFP-159: hidden at inspection (a closed menu, a collapsed navbar). Its health is
        // its address and its presence, never whether a menu opened; whether users can
        // reach it is a finding, so a broken menu never hides a dead link.
        if (!link.isVisible) {
            const name = escapeForSingleQuotedString(link.text || link.url);
            const isHttp = ["internal", "external", "download"].includes(link.linkType);
            const healthAssertions = isHttp
                ? `        const response = await request.get('${linkUrl}', {
            failOnStatusCode: false,
            timeout: ${linkAuditTimeoutMs},
            maxRedirects: ${link.targetBehavior === "same-window" ? 5 : 0},
        });
        expect(response.status(), '${name} answered HTTP ' + response.status()).toBeLessThan(400);
        await expect(locator).toHaveAttribute('href', /.+/);`
                : `        await expect(locator).toHaveAttribute('href', '${rawHref}');`;
            tests.push(`  test('navigation link health: ${linkTitle}', async ({ page${isHttp ? ", request" : ""} }) => {
        await page.goto('${escapedPath}');
        await page.waitForLoadState('domcontentloaded');

        // Hidden when the page was inspected: checked by its own address and its presence, not its visibility (TFP-159).
        const locator = ${buildHiddenLinkLocatorExpression(link)};
        await expect(locator, '${name} is not on the page').toBeAttached();
${healthAssertions}

${buildRevealHelper("        ")}
        const reach = await tfReveal(locator, 'click');
        if (!reach.visible) {
            test.info().annotations.push({ type: 'finding', description: '${name} is healthy by its address, but users can\\'t reach it: ' + reach.reason });
        }
    });`);

            continue;
        }

        if (link.linkType === "inert") {
            tests.push(`  test('navigation link health: ${linkTitle}', async ({ page }) => {
        await page.goto('${escapedPath}');
        await page.waitForLoadState('domcontentloaded');

        const locator = ${locatorExpression};
        // The link, or what renders it: an anchor around a positioned image has no box of its own.
        const rendered = locator.or(locator.locator('*')).filter({ visible: true }).first();
        await expect(rendered).toBeVisible();
        await expect(locator).toHaveAttribute('href', '${rawHref}');
    });`);

            continue;
        }

        if (link.linkType === "mailto") {
            tests.push(`  test('navigation link health: ${linkTitle}', async ({ page }) => {
        await page.goto('${escapedPath}');
        await page.waitForLoadState('domcontentloaded');

        const locator = ${locatorExpression};
        // The link, or what renders it: an anchor around a positioned image has no box of its own.
        const rendered = locator.or(locator.locator('*')).filter({ visible: true }).first();
        await expect(rendered).toBeVisible();
        await expect(locator).toHaveAttribute('href', '${rawHref}');
    });`);

            continue;
        }

        if (link.linkType === "anchor") {
            tests.push(`  test('navigation link health: ${linkTitle}', async ({ page }) => {
        await page.goto('${escapedPath}');
        await page.waitForLoadState('domcontentloaded');

        const locator = ${locatorExpression};
        // The link, or what renders it: an anchor around a positioned image has no box of its own.
        const rendered = locator.or(locator.locator('*')).filter({ visible: true }).first();
        await expect(rendered).toBeVisible();
        await rendered.click();

        expect(new URL(page.url()).hash).toBe('${rawHref}');
    });`);

            continue;
        }

        if (link.linkType === "download") {
            tests.push(`  test('navigation link health: ${linkTitle}', async ({ page, request }) => {
        await page.goto('${escapedPath}');
        await page.waitForLoadState('domcontentloaded');

        const locator = ${locatorExpression};
        // The link, or what renders it: an anchor around a positioned image has no box of its own.
        const rendered = locator.or(locator.locator('*')).filter({ visible: true }).first();
        await expect(rendered).toBeVisible();

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
        // The link, or what renders it: an anchor around a positioned image has no box of its own.
        const rendered = locator.or(locator.locator('*')).filter({ visible: true }).first();
        await expect(rendered).toBeVisible();

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
        // The link, or what renders it: an anchor around a positioned image has no box of its own.
        const rendered = locator.or(locator.locator('*')).filter({ visible: true }).first();
        await expect(rendered).toBeVisible();

        const response = await request.get('${linkUrl}', {
            failOnStatusCode: false,
            timeout: ${linkAuditTimeoutMs},
            maxRedirects: 0,
        });
        expect(response.status()).toBeLessThan(400);

        const popupPromise = context.waitForEvent('page');
        await rendered.click();
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
        // The link, or what renders it: an anchor around a positioned image has no box of its own.
        const rendered = locator.or(locator.locator('*')).filter({ visible: true }).first();
        await expect(rendered).toBeVisible();

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
        // The link, or what renders it: an anchor around a positioned image has no box of its own.
        const rendered = locator.or(locator.locator('*')).filter({ visible: true }).first();
        await expect(rendered).toBeVisible();

        const response = await request.get('${linkUrl}', {
            failOnStatusCode: false,
            timeout: ${linkAuditTimeoutMs},
            maxRedirects: 5,
        });
        expect(response.status()).toBeLessThan(400);

        await rendered.click();
        await page.waitForLoadState('domcontentloaded').catch(() => {});
        expect(page.url()).toContain('${escapeForSingleQuotedString(link.url.replace(/[#?].*$/, ""))}');
    });`);
    }

    return tests;
}
