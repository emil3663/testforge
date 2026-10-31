import type { LinkDetail } from "../types";

export function buildLinkDetailTests(
    escapedPath: string,
    linkAuditTimeoutMs: number,
    isFastLinkAudit: boolean,
    interactionMailtoLinks: LinkDetail[],
    interactionDownloadLinks: LinkDetail[],
    interactionPopupLinks: LinkDetail[],
    interactionProtectedLinks: LinkDetail[]
) {
    const tests: string[] = [];

    if (interactionMailtoLinks.length > 0) {
        tests.push(`  test('mailto links expose the correct recipient address', async ({ page }) => {
        const links = ${JSON.stringify(interactionMailtoLinks)};
        await page.goto('${escapedPath}');
        await page.waitForLoadState('domcontentloaded');

        for (const link of links) {
            const locator = link.text
                ? page.getByRole('link', { name: link.text, exact: true }).first()
                : page.locator('a[href="' + link.rawHref.replace(/["\\\\]/g, '\\\\$&') + '"]:visible, a[href="' + link.rawHref.replace(/["\\\\]/g, '\\\\$&') + '"]:has(:visible)').first();
            // The link, or what renders it: an anchor around a positioned image has no box of its own.
            const rendered = locator.or(locator.locator('*')).filter({ visible: true }).first();
            await expect(rendered).toBeVisible();
            await expect(locator).toHaveAttribute('href', link.rawHref);
        }
    });`);
    }

    if (interactionDownloadLinks.length > 0) {
        tests.push(`  test('download links can be requested successfully and expose downloadable resources', async ({ page, request }) => {
        const links = ${JSON.stringify(interactionDownloadLinks)};
        await page.goto('${escapedPath}');
        await page.waitForLoadState('domcontentloaded');

        for (const link of links) {
            const locator = link.text
                ? page.getByRole('link', { name: link.text, exact: true }).first()
                : page.locator('a[href="' + link.rawHref.replace(/["\\\\]/g, '\\\\$&') + '"]:visible, a[href="' + link.rawHref.replace(/["\\\\]/g, '\\\\$&') + '"]:has(:visible)').first();
            // The link, or what renders it: an anchor around a positioned image has no box of its own.
            const rendered = locator.or(locator.locator('*')).filter({ visible: true }).first();
            await expect(rendered).toBeVisible();
            const response = await request.get(link.url, { failOnStatusCode: false, timeout: ${linkAuditTimeoutMs} });
            expect(response.status()).toBeLessThan(400);
            expect(await locator.getAttribute('href')).toMatch(/\\.(pdf|doc|docx|xls|xlsx|csv|zip|ppt|pptx)([?#].*)?$/i);
        }
    });`);
    }

    if (interactionPopupLinks.length > 0) {
        tests.push(`  test('target window behavior matches the link target configuration', async ({ page }) => {
        const links = ${JSON.stringify(interactionPopupLinks)};
        await page.goto('${escapedPath}');
        await page.waitForLoadState('domcontentloaded');

        for (const link of links) {
            const locator = link.text
                ? page.getByRole('link', { name: link.text, exact: true }).first()
                : page.locator('a[href="' + link.rawHref.replace(/["\\\\]/g, '\\\\$&') + '"]:visible, a[href="' + link.rawHref.replace(/["\\\\]/g, '\\\\$&') + '"]:has(:visible)').first();
            // The link, or what renders it: an anchor around a positioned image has no box of its own.
            const rendered = locator.or(locator.locator('*')).filter({ visible: true }).first();
            await expect(rendered).toBeVisible();
            const target = await locator.getAttribute('target');

            if (link.targetBehavior === 'new-tab') {
                expect(target).toBe('_blank');
            } else if (link.targetBehavior === 'new-window') {
                expect(target).not.toBeNull();
                expect(target).not.toBe('_self');
                expect(target).not.toBe('_blank');
            }
        }
    });`);
    }

    if (interactionProtectedLinks.length > 0 && !isFastLinkAudit) {
        tests.push(`  test('authentication and permissions: protected links redirect or block unauthorized access', async ({ page, request }) => {
        const links = ${JSON.stringify(interactionProtectedLinks)};
        const revisitLinksPage = async () => {
            await page.goto('${escapedPath}');
            await page.waitForLoadState('domcontentloaded');
        };

        await revisitLinksPage();

        for (const link of links) {
            const response = await request.get(link.url, { failOnStatusCode: false, timeout: ${linkAuditTimeoutMs}, maxRedirects: 0 });
            expect([200, 301, 302, 303, 307, 308, 401, 403]).toContain(response.status());

            const locator = link.text
                ? page.getByRole('link', { name: link.text, exact: true }).first()
                : page.locator('a[href="' + link.rawHref.replace(/["\\\\]/g, '\\\\$&') + '"]:visible, a[href="' + link.rawHref.replace(/["\\\\]/g, '\\\\$&') + '"]:has(:visible)').first();
            // The link, or what renders it: an anchor around a positioned image has no box of its own.
            const rendered = locator.or(locator.locator('*')).filter({ visible: true }).first();
            const urlBeforeInteraction = page.url();
            await rendered.click();
            await page.waitForLoadState('domcontentloaded').catch(() => {});
            expect(/login|sign in|unauthorized|forbidden|account/i.test(await page.content()) || page.url().includes('login') || page.url().includes('signin')).toBeTruthy();

            if (page.url() !== urlBeforeInteraction) {
                await page.goBack().catch(async () => {
                    await revisitLinksPage();
                });
                await page.waitForLoadState('domcontentloaded').catch(async () => {
                    await revisitLinksPage();
                });
            } else {
                await revisitLinksPage();
            }
        }
    });`);
    }

    return tests;
}
