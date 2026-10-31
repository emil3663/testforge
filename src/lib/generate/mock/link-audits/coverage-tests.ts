import type { LinkDetail } from "../types";
import { RUNTIME_HIDDEN_LINK_LOCATOR } from "./reveal";
import { buildRouteHelpers, isStartRoute, routePathOf } from "./routes";

export function buildLinkCoverageTests(
    escapedPath: string,
    linkAuditTimeoutMs: number,
    allLinkPayload: string,
    interactionNonApiLinks: LinkDetail[],
    isFastLinkAudit: boolean,
    escapedCurrentPageUrl: string,
    hasHiddenLinks = false,
    routeLinks: LinkDetail[] = []
) {
    const tests: string[] = [];

    tests.push(`  test('link health: internal, external, and download links do not return broken responses', async ({ request }) => {
        const links = ${allLinkPayload};

        for (const link of links) {
            if (!['internal', 'external', 'download'].includes(link.linkType)) {
                continue;
            }
${routeLinks.length > 0 ? `            // TFP-165: a hash route (#/contact) is checked by what the app draws there, below; the server answers every route the same.
            if (/^#!?\\//.test(link.rawHref)) {
                continue;
            }
` : ""}
            const response = await request.get(link.url, {
                failOnStatusCode: false,
                timeout: ${linkAuditTimeoutMs},
                maxRedirects: link.targetBehavior === 'same-window' ? 5 : 0,
            });

            expect(response.status(), 'Broken link detected for ' + (link.text || link.url)).toBeLessThan(400);
        }
    });`);

    // TFP-165 (Decision 4): every linked route of a hash-routed app, each once, against
    // what the app draws for a route that can't exist. Bounded like TFP-142's checks: the
    // routes left when 14 s have gone are named as not checked.
    const routes = [...new Map(routeLinks.filter((link) => !isStartRoute(link)).map((link) => [link.url, { url: link.url, route: routePathOf(link) }])).values()];
    if (routes.length > 0) {
        tests.push(`  test('link health: linked routes draw a page, not the app\\'s "not found" view', async ({ page }) => {
        const routes = ${JSON.stringify(routes)};
${buildRouteHelpers("        ")}
        const deadline = Date.now() + 14000;
        const notFound: string[] = [];
        const notChecked: string[] = [];
        for (const { url, route } of routes) {
            if (Date.now() > deadline) {
                notChecked.push(route);
                continue;
            }
            const probe = await tfMissingRoute(url);
            if ((await tfRouteView(url)) === probe.view) notFound.push(route + ' (draws the same as ' + probe.route + ', a route that cannot exist)');
        }
        if (notChecked.length > 0) {
            test.info().annotations.push({ type: 'finding', description: notChecked.length + ' linked routes not checked: the check stops after 14 s (' + notChecked.slice(0, 5).join(', ') + (notChecked.length > 5 ? ', ...' : '') + ')' });
        }
        expect(notFound, 'linked routes that show the app\\'s "not found" view: ' + notFound.join('; ')).toEqual([]);
    });`);
    }

    if (interactionNonApiLinks.length > 0 && !isFastLinkAudit) {
        tests.push(`  test('navigation destination: links navigate to their required destination', async ({ page, context }) => {
        const links = ${JSON.stringify(interactionNonApiLinks)};
        const revisitLinksPage = async () => {
            await page.goto('${escapedPath}');
            await page.waitForLoadState('domcontentloaded');
        };

        await revisitLinksPage();
        for (const link of links) {
${interactionNonApiLinks.some((link) => !link.isVisible) ? `            // TFP-162 (TFP-159's approach): a link hidden at inspection (a closed menu) goes where its own
            // address says; whether users can reach it is the keyboard check's question, not this one's.
            if (!link.isVisible) {
                const hiddenLocator = ${RUNTIME_HIDDEN_LINK_LOCATOR};
                await expect(hiddenLocator, (link.text || link.url) + ' is not on the page').toBeAttached();
                const href = await hiddenLocator.getAttribute('href');
                expect(new URL(href ?? '', page.url()).toString(), (link.text || link.url) + ' does not lead to its destination').toContain(link.url.replace(/[#?].*$/, ''));
                continue;
            }
` : ""}            const linkLocator = link.text
                ? page.getByRole('link', { name: link.text, exact: true }).first()
                : link.rawHref
                    ? page.locator('a[href="' + link.rawHref.replace(/["\\\\]/g, '\\\\$&') + '"]:visible, a[href="' + link.rawHref.replace(/["\\\\]/g, '\\\\$&') + '"]:has(:visible)').first()
                    : page.locator('a[href="' + link.url.replace(/["\\\\]/g, '\\\\$&') + '"]:visible, a[href="' + link.url.replace(/["\\\\]/g, '\\\\$&') + '"]:has(:visible)').first();
            // The link, or what renders it: an anchor around a positioned image has no box of its own.
            const renderedLink = linkLocator.or(linkLocator.locator('*')).filter({ visible: true }).first();

            await expect(renderedLink).toBeVisible();
            const urlBeforeInteraction = page.url();

            if (link.linkType === 'anchor') {
                await renderedLink.click();
                expect(new URL(page.url()).hash).toBe(link.rawHref);
                if (page.url() !== urlBeforeInteraction) {
                    await page.goBack().catch(async () => {
                        await revisitLinksPage();
                    });
                    await page.waitForLoadState('domcontentloaded').catch(async () => {
                        await revisitLinksPage();
                    });
                }
                continue;
            }

            if (link.targetBehavior === 'new-tab') {
                const popupPromise = context.waitForEvent('page');
                await renderedLink.click();
                const popup = await popupPromise;
                await popup.waitForLoadState('domcontentloaded').catch(() => {});
                expect(popup.url()).toContain(link.url.replace(/[#?].*$/, ''));
                await popup.close().catch(() => {});
                continue;
            }

            await renderedLink.click();
            await page.waitForLoadState('domcontentloaded').catch(() => {});
            expect(page.url()).toContain(link.url.replace(/[#?].*$/, ''));

            if (page.url() !== urlBeforeInteraction) {
                await page.goBack().catch(async () => {
                    await revisitLinksPage();
                });
                await page.waitForLoadState('domcontentloaded').catch(async () => {
                    await revisitLinksPage();
                });
            }
        }
    });`);
    }

    tests.push(`  test('link types: internal, external, anchor, mailto, and download links are classified correctly', async ({ page }) => {
        const links = ${allLinkPayload};
        await page.goto('${escapedPath}');
        await page.waitForLoadState('domcontentloaded');

        for (const link of links) {
${hasHiddenLinks ? `            // TFP-159: a link hidden at inspection (a closed menu, a collapsed navbar) is classified by its
            // own address and its presence; whether users can reach it is the keyboard check's question.
            if (!link.isVisible) {
                const hiddenLocator = ${RUNTIME_HIDDEN_LINK_LOCATOR};
                await expect(hiddenLocator, (link.text || link.url) + ' is not on the page').toBeAttached();
                if (link.linkType === 'internal') {
                    expect(new URL(link.url).origin).toBe(new URL('${escapedCurrentPageUrl}').origin);
                } else if (link.linkType === 'external') {
                    expect(new URL(link.url).origin).not.toBe(new URL('${escapedCurrentPageUrl}').origin);
                } else if (link.linkType === 'anchor') {
                    expect(link.rawHref.startsWith('#')).toBeTruthy();
                } else if (link.linkType === 'mailto') {
                    await expect(hiddenLocator).toHaveAttribute('href', /^mailto:/i);
                } else if (link.linkType === 'download') {
                    await expect(hiddenLocator).toHaveAttribute('href', /\\.(pdf|doc|docx|xls|xlsx|csv|zip|ppt|pptx)([?#].*)?$/i);
                }
                continue;
            }
` : ""}            const locator = link.text
                ? page.getByRole('link', { name: link.text, exact: true }).first()
                : link.rawHref
                    ? page.locator('a[href="' + link.rawHref.replace(/["\\\\]/g, '\\\\$&') + '"]:visible, a[href="' + link.rawHref.replace(/["\\\\]/g, '\\\\$&') + '"]:has(:visible)').first()
                    : page.locator('a[href="' + link.url.replace(/["\\\\]/g, '\\\\$&') + '"]:visible, a[href="' + link.url.replace(/["\\\\]/g, '\\\\$&') + '"]:has(:visible)').first();
            // The link, or what renders it: an anchor around a positioned image has no box of its own.
            const rendered = locator.or(locator.locator('*')).filter({ visible: true }).first();

            await expect(rendered).toBeVisible();

            if (link.linkType === 'internal') {
                expect(new URL(link.url).origin).toBe(new URL('${escapedCurrentPageUrl}').origin);
            } else if (link.linkType === 'external') {
                expect(new URL(link.url).origin).not.toBe(new URL('${escapedCurrentPageUrl}').origin);
            } else if (link.linkType === 'anchor') {
                expect(link.rawHref.startsWith('#')).toBeTruthy();
            } else if (link.linkType === 'mailto') {
                await expect(locator).toHaveAttribute('href', /^mailto:/i);
            } else if (link.linkType === 'download') {
                await expect(locator).toHaveAttribute('href', /\\.(pdf|doc|docx|xls|xlsx|csv|zip|ppt|pptx)([?#].*)?$/i);
            }
        }
    });`);

    return tests;
}
