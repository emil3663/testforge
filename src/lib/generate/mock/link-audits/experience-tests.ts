import { escapeForSingleQuotedString } from "../format";
import { pagePathOf } from "../../../introspect/routes";
import type { LinkDetail } from "../types";
import { buildRevealHelper, RUNTIME_HIDDEN_LINK_LOCATOR } from "./reveal";

interface ScannedPage {
    path: string;
    url: string;
    inboundCandidates: string[];
}

/** TFP-161: what inspection was asked for and what it couldn't load. */
export interface OrphanContext {
    requestedPaths: string[];
    failedPages: { path: string; reason: string }[];
}

/**
 * TFP-161 (owner decision, 2026-10-06): the orphan check judges only pages
 * that were loaded. On the-internet (TFP-150 re-run, T24) inspection lost
 * "/", which links to every example, and every other page failed as an
 * orphan. The start page is the first path requested.
 * - Start page not loaded: Not run, naming it - which pages it links to is
 *   unknown.
 * - Another page not loaded: a loaded page with no link from another loaded
 *   page is a finding naming the pages that weren't loaded, not a failure.
 * - Every page loaded: a page with no inbound link fails, as before.
 */
/**
 * TFP-166: a page's identity for the count is its origin and pagePathOf, as
 * the crawl names pages (TFP-165) - a hash route keeps its #/..., an in-page
 * anchor (#top) is dropped. Clearing every # part made each route of a
 * hash-routed site count as "/".
 */
function pageKeyOf(url: string) {
    try {
        const parsed = new URL(url);
        return parsed.origin + pagePathOf(parsed);
    } catch {
        return url.replace(/#.*$/, "");
    }
}

/** A requested or inspected path, named as the crawl names it: /#/ stays /#/, /contact/ is /contact. */
function pagePathName(path: string) {
    return pagePathOf(new URL(path, "http://page.invalid"));
}

function buildOrphanCheck(scannedPages: ScannedPage[], { requestedPaths, failedPages }: OrphanContext) {
    const startPath = pagePathName(requestedPaths[0]);
    const startFailure = failedPages.find((page) => pagePathName(page.path) === startPath);
    const title = "orphan page approximation: each scanned page is linked from another scanned page";
    if (startFailure) {
        const reason = escapeForSingleQuotedString(`the start page ${startPath} could not be loaded when the site was inspected (${startFailure.reason}), so which pages it links to is unknown`);
        return `  test('${title}', async () => {
        // TFP-161: every other page's inbound links come from the start page; it wasn't loaded.
        test.skip(true, '${reason}');
    });`;
    }
    // TFP-166: each page and each link by its page key (origin + pagePathOf), worked out here.
    const pages = scannedPages.map((page) => ({ path: pagePathName(page.path), key: pageKeyOf(page.url), links: page.inboundCandidates.map(pageKeyOf) }));
    const notLoaded = failedPages.map((page) => pagePathName(page.path));
    return `  test('${title}', async () => {
        // Each page and each of its links by page: origin, path and hash route (#/contact), without an in-page anchor (TFP-166).
        const pages = ${JSON.stringify(pages)};
        // TFP-161: inbound links are counted among the pages that were loaded; the start page (${escapeForSingleQuotedString(startPath)}) needs none.
        const startPath = '${escapeForSingleQuotedString(startPath)}';
        const notLoaded: string[] = ${JSON.stringify(notLoaded)};
        const inboundMap = new Map<string, number>();

        for (const page of pages) {
            inboundMap.set(page.key, 0);
        }

        for (const page of pages) {
            for (const linked of page.links) {
                // From another page: a page's links to itself (#top, #details) are not inbound links.
                if (linked !== page.key && inboundMap.has(linked)) {
                    inboundMap.set(linked, (inboundMap.get(linked) ?? 0) + 1);
                }
            }
        }

        for (const page of pages) {
            if (page.path === startPath) continue;
            const inbound = inboundMap.get(page.key) ?? 0;
            if (inbound === 0 && notLoaded.length > 0) {
                test.info().annotations.push({ type: 'finding', description: page.path + ' has no link from another loaded page; ' + notLoaded.join(', ') + ' could not be loaded, so a link from there was not seen' });
                continue;
            }
            expect(inbound, page.path + ' is not linked from any other inspected page').toBeGreaterThan(0);
        }
    });`;
}

export function buildLinkExperienceTests(
    escapedPath: string,
    includeUsabilityLinkAudits: boolean,
    includeAccessibilityLinkAudits: boolean,
    interactionNonApiLinks: LinkDetail[],
    allLinkPayload: string,
    secureLinks: LinkDetail[],
    anchorLinks: LinkDetail[],
    scannedPages: ScannedPage[],
    orphanContext: OrphanContext | null = null
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
        // TFP-142: each hover gets 2 s and the check 15 s. A link that can't
        // be hovered - a skip link parked off-screen, one under an overlay -
        // made hover() retry until the 30 s test timeout (rizonetech.com,
        // 5 of 5 pages). It is now named as not checked, with the reason.
        const deadline = Date.now() + 15000;
        const notHovered: string[] = [];

        for (let index = 0; index < count; index += 1) {
            const locator = visibleLinks.nth(index);
            if (Date.now() > deadline) {
                test.info().annotations.push({ type: 'finding', description: (count - index) + ' of ' + count + ' links not hovered: the check stops after 15 s' });
                break;
            }
            const hovered = await locator.hover({ timeout: 2000 }).then(() => null, (error: Error) => (error.message.match(/outside of the viewport|intercepts pointer events|not stable|not visible/) ?? ['did not respond within 2 s'])[0]);
            if (hovered !== null) {
                notHovered.push((await locator.getAttribute('href')) + ' (' + hovered + ')');
                continue;
            }
            const { cursor, title } = await locator.evaluate((node) => ({ cursor: window.getComputedStyle(node).cursor, title: node.getAttribute('title') }));
            expect(cursor).toBe('pointer');

            if (title) {
                expect(title.trim().length).toBeGreaterThan(0);
            }
        }
        if (notHovered.length > 0) {
            test.info().annotations.push({ type: 'finding', description: 'links that could not be hovered, so their cursor was not checked: ' + notHovered.join(', ') });
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
        const keyboardHasHidden = interactionNonApiLinks.some((link) => !link.isVisible);
        tests.push(`  test('keyboard navigation: links can receive focus and activate with Enter', async ({ page, context }) => {
        const links = ${JSON.stringify(interactionNonApiLinks)};
        const revisitLinksPage = async () => {
            await page.goto('${escapedPath}');
            await page.waitForLoadState('domcontentloaded');
        };

${keyboardHasHidden ? `${buildRevealHelper("        ")}\n` : ""}        await revisitLinksPage();
        for (const link of links) {
            const locator = ${keyboardHasHidden ? `!link.isVisible
                ? ${RUNTIME_HIDDEN_LINK_LOCATOR.replace(/\n/g, "\n    ")}
                : ` : ""}link.text
                ? page.getByRole('link', { name: link.text, exact: true }).first()
                : link.rawHref
                    ? page.locator('a[href="' + link.rawHref.replace(/"/g, '\\"') + '"]:visible, a[href="' + link.rawHref.replace(/"/g, '\\"') + '"]:has(:visible)').first()
                    : page.locator('a[href="' + link.url.replace(/"/g, '\\"') + '"]:visible, a[href="' + link.url.replace(/"/g, '\\"') + '"]:has(:visible)').first();
${keyboardHasHidden ? `            if (!link.isVisible) {
                // TFP-159: hidden at inspection - open its menu by keyboard first; a link users can't reach fails, naming the menu.
                const reach = await tfReveal(locator, 'keyboard');
                expect(reach.visible, (link.text || link.url) + " can't be reached by keyboard: " + reach.reason).toBeTruthy();
            }
` : ""}            await locator.focus();
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
        // TFP-142: each distinct URL is requested once, for up to 5 s, and
        // the check stops after 20 s. Requesting every link in turn at 15 s
        // each - 59 on one rizonetech.com page, many repeated - ran past the
        // 30 s test timeout on 3 of 5 pages. A URL that can't be reached is
        // named as not checked (link health judges reachability), and the
        // ones left when the budget ends are named too.
        const deadline = Date.now() + 20000;
        const checked = new Set<string>();
        const notChecked: string[] = [];
        const urls = links.filter((link) => !link.rawHref.toLowerCase().startsWith('mailto:')).map((link) => link.url);

        for (const link of links) {
            expect(link.url.startsWith('https://') || link.rawHref.toLowerCase().startsWith('mailto:'), link.url + ' is marked secure but is not https').toBeTruthy();
        }
        for (const url of urls) {
            if (checked.has(url)) continue;
            if (Date.now() > deadline) {
                const left = [...new Set(urls)].filter((other) => !checked.has(other));
                test.info().annotations.push({ type: 'finding', description: left.length + ' secure links not checked: the check stops after 20 s (' + left.slice(0, 5).join(', ') + (left.length > 5 ? ', ...' : '') + ')' });
                break;
            }
            checked.add(url);
            const response = await request.get(url, { failOnStatusCode: false, timeout: 5000 }).catch((error: Error) => error);
            if (response instanceof Error) {
                notChecked.push(url + ' (' + (/timeout/i.test(response.message) ? 'no answer within 5 s' : response.message.split('\\n')[0].replace(/^[\\w.]+: /, '')) + ')');
                continue;
            }
            expect(response.url().startsWith('https://'), url + ' ended on ' + response.url() + ', not https').toBeTruthy();
        }
        if (notChecked.length > 0) {
            test.info().annotations.push({ type: 'finding', description: 'secure links that could not be reached, so their HTTPS was not checked: ' + notChecked.join(', ') });
        }
    });`);
    }

    if (anchorLinks.length > 0) {
        tests.push(`  test('anchor links point to existing in-page targets', async ({ page }) => {
        const links = ${JSON.stringify(anchorLinks)};
        await page.goto('${escapedPath}');
        await page.waitForLoadState('domcontentloaded');

        for (const link of links) {
            // TFP-141: the target is looked up by id (or name), never by
            // passing the href to a CSS selector - href="#" made that
            // selector "#" and crashed the test on ordinary sites.
            const fragment = link.rawHref.replace(/^#/, '');
            let target = fragment;
            try { target = decodeURIComponent(fragment); } catch { target = fragment; }
            if (!target) {
                test.info().annotations.push({ type: 'finding', description: 'link "' + (link.text || link.rawHref) + '" has href="' + link.rawHref + '", which points at no in-page target (a placeholder link)' });
                continue;
            }
            // "#top" scrolls to the top of the page even with no element of that id (HTML standard).
            if (target.toLowerCase() === 'top') continue;
            const exists = await page.evaluate((id) => document.getElementById(id) !== null || document.getElementsByName(id).length > 0, target);
            expect(exists, 'Anchor target missing for #' + target).toBeTruthy();
        }
    });`);
    }

    if (orphanContext && orphanContext.requestedPaths.length > 1) {
        tests.push(buildOrphanCheck(scannedPages, orphanContext));
    } else if (scannedPages.length > 1) {
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
