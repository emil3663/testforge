import type { LinkDetail } from "../types";

interface ScannedPage {
    path: string;
    url: string;
    inboundCandidates: string[];
}

export function buildLinkExperienceTests(
    escapedPath: string,
    includeUsabilityLinkAudits: boolean,
    includeAccessibilityLinkAudits: boolean,
    interactionNonApiLinks: LinkDetail[],
    allLinkPayload: string,
    secureLinks: LinkDetail[],
    anchorLinks: LinkDetail[],
    scannedPages: ScannedPage[]
) {
    const tests: string[] = [];

    if (includeUsabilityLinkAudits) {
        tests.push(`  test('visual representation: links are distinguishable from surrounding text', async ({ page }) => {
        await page.goto('${escapedPath}');
        await page.waitForLoadState('domcontentloaded');

        const visibleLinks = page.locator('a[href]:visible');
        const count = await visibleLinks.count();
        expect(count).toBeGreaterThan(0);

        for (let index = 0; index < count; index += 1) {
            const locator = visibleLinks.nth(index);
            const styles = await locator.evaluate((node) => {
                const computed = window.getComputedStyle(node);
                const parent = node.parentElement ? window.getComputedStyle(node.parentElement) : null;
                return {
                    color: computed.color,
                    parentColor: parent?.color ?? '',
                    textDecoration: computed.textDecorationLine,
                };
            });

            expect(
                styles.textDecoration.includes('underline') || styles.color !== styles.parentColor,
                'Link should be visually distinct from surrounding text'
            ).toBeTruthy();
        }
    });`);

        tests.push(`  test('hover state: links show pointer cursor and preserve tooltip attributes', async ({ page }) => {
        await page.goto('${escapedPath}');
        await page.waitForLoadState('domcontentloaded');

        const visibleLinks = page.locator('a[href]:visible');
        const count = await visibleLinks.count();

        for (let index = 0; index < count; index += 1) {
            const locator = visibleLinks.nth(index);
            await locator.hover();
            const cursor = await locator.evaluate((node) => window.getComputedStyle(node).cursor);
            expect(cursor).toBe('pointer');

            const title = await locator.getAttribute('title');
            if (title) {
                expect(title.trim().length).toBeGreaterThan(0);
            }
        }
    });`);

        tests.push(`  test('visited style configuration: stylesheet defines visited-link styling when same-origin rules are inspectable', async ({ page }) => {
        await page.goto('${escapedPath}');
        await page.waitForLoadState('domcontentloaded');

        const hasVisitedRule = await page.evaluate(() => {
            for (const sheet of Array.from(document.styleSheets)) {
                try {
                    for (const rule of Array.from(sheet.cssRules)) {
                        if ('selectorText' in rule && typeof rule.selectorText === 'string' && rule.selectorText.includes(':visited')) {
                            return true;
                        }
                    }
                } catch {
                    continue;
                }
            }

            return false;
        });

        expect(hasVisitedRule).toBeTruthy();
    });`);
    }

    if (includeAccessibilityLinkAudits && interactionNonApiLinks.length > 0) {
        tests.push(`  test('keyboard navigation: links can receive focus and activate with Enter', async ({ page, context }) => {
        const links = ${JSON.stringify(interactionNonApiLinks)};
        const revisitLinksPage = async () => {
            await page.goto('${escapedPath}');
            await page.waitForLoadState('domcontentloaded');
        };

        await revisitLinksPage();
        for (const link of links) {
            const locator = link.text
                ? page.getByRole('link', { name: link.text, exact: true }).first()
                : link.rawHref
                    ? page.locator('a[href="' + link.rawHref.replace(/"/g, '\\"') + '"]:visible, a[href="' + link.rawHref.replace(/"/g, '\\"') + '"]:has(:visible)').first()
                    : page.locator('a[href="' + link.url.replace(/"/g, '\\"') + '"]:visible, a[href="' + link.url.replace(/"/g, '\\"') + '"]:has(:visible)').first();
            await locator.focus();
            await expect(locator).toBeFocused();
            const urlBeforeInteraction = page.url();

            if (link.targetBehavior === 'new-tab') {
                const popupPromise = context.waitForEvent('page');
                await page.keyboard.press('Enter');
                const popup = await popupPromise;
                await popup.waitForLoadState('domcontentloaded').catch(() => {});
                // Same host and path; a site that upgrades http to https (the-internet's
                // Elemental Selenium link, a 301) has still opened the right page.
                expect(popup.url().replace(/^https?:\\/\\//, '')).toContain(link.url.replace(/[#?].*$/, '').replace(/^https?:\\/\\//, ''));
                await popup.close().catch(() => {});
            } else {
                await page.keyboard.press('Enter');
                // Enter only starts the navigation: waiting for the old page's
                // load state returned at once, the URL looked unchanged, and the
                // next link was then looked for on the new site (TFP-123).
                await page.waitForURL((url) => url.href !== urlBeforeInteraction, { timeout: 5000 }).catch(() => {});

                if (page.url() !== urlBeforeInteraction) {
                    // Straight back to the links page: after a cross-site
                    // redirect, goBack() can land on a hop in between.
                    await revisitLinksPage();
                }
            }
        }
    });`);
    }

    tests.push(`  test('technical security: link protocols are safe and do not expose obvious XSS vectors', async ({ page }) => {
        const links = ${allLinkPayload};
        await page.goto('${escapedPath}');
        await page.waitForLoadState('domcontentloaded');

        for (const link of links) {
            const linkLabel = link.text || link.rawHref || link.url;
            expect(/^javascript:/i.test(link.rawHref), 'Unsafe link protocol detected for ' + linkLabel).toBeFalsy();
            expect(/^data:/i.test(link.rawHref), 'Unsafe data protocol detected for ' + linkLabel).toBeFalsy();
            expect(/<script|javascript:/i.test(link.text), 'Suspicious link text detected for ' + linkLabel).toBeFalsy();
        }
    });`);

    if (secureLinks.length > 0) {
        tests.push(`  test('HTTPS/SSL: secure links remain on HTTPS when marked as secure', async ({ request }) => {
        const links = ${JSON.stringify(secureLinks)};

        for (const link of links) {
            expect(link.url.startsWith('https://') || link.rawHref.toLowerCase().startsWith('mailto:')).toBeTruthy();
            if (!link.rawHref.toLowerCase().startsWith('mailto:')) {
                const response = await request.get(link.url, { failOnStatusCode: false, timeout: 15000 });
                expect(response.url().startsWith('https://')).toBeTruthy();
            }
        }
    });`);
    }

    if (anchorLinks.length > 0) {
        tests.push(`  test('anchor links point to existing in-page targets', async ({ page }) => {
        const links = ${JSON.stringify(anchorLinks)};
        await page.goto('${escapedPath}');
        await page.waitForLoadState('domcontentloaded');

        for (const link of links) {
            const selector = link.rawHref;
            expect(await page.locator(selector).count(), 'Anchor target missing for ' + selector).toBeGreaterThan(0);
        }
    });`);
    }

    if (scannedPages.length > 1) {
        tests.push(`  test('orphan page approximation: each scanned page is linked from another scanned page', async () => {
        const pages = ${JSON.stringify(scannedPages)};
        const inboundMap = new Map();

        for (const page of pages) {
            inboundMap.set(page.url.replace(/#.*$/, ''), 0);
        }

        for (const page of pages) {
            for (const linkedUrl of page.inboundCandidates) {
                const normalized = linkedUrl.replace(/#.*$/, '');
                if (inboundMap.has(normalized)) {
                    inboundMap.set(normalized, inboundMap.get(normalized) + 1);
                }
            }
        }

        for (const page of pages.slice(1)) {
            expect(inboundMap.get(page.url.replace(/#.*$/, '')) ?? 0).toBeGreaterThan(0);
        }
    });`);
    }

    return tests;
}
