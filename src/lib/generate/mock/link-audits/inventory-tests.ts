import { isIdSegment } from "../../../selection/page-types";
import { escapeForDoubleQuotedSelector, escapeForSingleQuotedString, escapeRegExp, quoteSelector } from "../format";
import { buildLinkLocatorExpression } from "../locators";
import type { ContentProfile, LinkDetail } from "../types";
import { buildHiddenLinkLocatorExpression } from "./reveal";
import { isRouteLink, isStartRoute } from "./routes";

/**
 * Phase 42 (TFP-205; Gate B ruling, Emil 2026-10-15): the template checks
 * every link on the pages it selects. On the Toolshop copies the coverage
 * map's in-context gap list was links only: the template checked every
 * element in context, and every link only by its URL (link health) or in
 * one loop over a page's payload, which finds no link by its own locator.
 * TFP-197 paid Claude Code to write the missing checks; they are
 * inventory, and inventory is the template's job.
 *
 * One read-only test per distinct link (its text and target, counted once
 * as the coverage map counts it, on the first selected page it is on), in
 * the functional area, at the end of its suite so no existing test's id
 * moves:
 * - the link is on its page, by the generator's own locator expression (so
 *   the map counts it covered in context), or failing that by its own
 *   address. A link inspection found visible must be visible and have a
 *   name. One found hidden (a closed menu) only needs to be present, as
 *   TFP-159 checks them; whether users can reach it is the keyboard check's
 *   question;
 * - its `href` is a valid URL;
 * - its target: a same-origin page is loaded once in a run, so a page the
 *   site-wide checks already load isn't loaded again. Link health requests
 *   every internal and download link; the linked-routes check draws every
 *   hash route; the start page is every test's first visit. Any other
 *   same-origin target is loaded here, through the page (tfGoto) inside the
 *   request guard, up to LINK_TARGET_LOAD_CAP a run, and one over the cap
 *   is named as not loaded. An external target gets the `href` check only,
 *   with no request from this test (link health's own request to it is
 *   unchanged).
 *
 * TFP-208 (ruling confirmed by Emil 2026-10-19; R1, TFP-207): links inside a
 * listing's repeated cards get no test each. A listing can change between
 * loads: the Toolshop pages a category's products with no order (the API's
 * paginate(9) has no ORDER BY, in both versions), so with-bugs'
 * /#/category/hand-tools showed products 1 to 9 at Gate B and 6 to 14 at R1's
 * inspection, and 5 of R1's link tests failed on cards that were gone. A card
 * group is CARD_GROUP_MIN or more links on a page whose targets share one
 * address but for a last segment that is an identifier (Phase 40's
 * isIdSegment: "#/product/1", "/product/01M50R4WF..."). It gets one test: the
 * page has such cards, and each card there at run time, by position, is
 * visible and named (when inspection found the cards visible) and has a valid
 * href of that pattern. Its targets are loaded as a single link's would be:
 * the inspected cards' by link health, which is unchanged. Rejected: finding
 * each card by its target's pattern instead of its name, which keeps one test
 * per card checking the same thing. Emil's condition: a failure names the
 * product, not only the slot. Each failing card is named by its position and
 * what it showed at run time (its name, a price if it shows one, its href),
 * and every card is checked before the test fails once listing them all.
 */

export const CARD_GROUP_MIN = 3;

export interface CardGroup {
    /** What each card's href starts with, up to the identifier: "#/product/". */
    hrefPrefix: string;
    /** The pattern, as titles and messages name it: "#/product/:id". */
    pattern: string;
    /** The cards' links, by the key the coverage map uses ([text, url]). */
    keys: Set<string>;
    /** Every card inspection found visible. */
    visible: boolean;
    first: LinkDetail;
}

export const linkKey = (link: LinkDetail) => JSON.stringify([link.text, link.url]);

/** TFP-208: a page's repeated cards, grouped by the address their links share. */
export function cardGroups(links: LinkDetail[]): CardGroup[] {
    const byPrefix = new Map<string, LinkDetail[]>();
    for (const link of links) {
        if (link.linkType !== "internal") continue;
        const match = /^(.*\/)([^/?#]+)$/.exec(link.rawHref || link.url);
        if (!match || !isIdSegment(match[2])) continue;
        byPrefix.set(match[1], [...(byPrefix.get(match[1]) ?? []), link]);
    }
    return [...byPrefix].filter(([, cards]) => new Set(cards.map((card) => card.url)).size >= CARD_GROUP_MIN).map(([hrefPrefix, cards]) => ({
        hrefPrefix,
        pattern: `${hrefPrefix}:id`,
        keys: new Set(cards.map(linkKey)),
        visible: cards.every((card) => card.isVisible),
        first: cards[0],
    }));
}

/** The locator a card group's test finds its cards by, as written in the test (the coverage map looks for it). */
export function cardGroupLocator(group: CardGroup) {
    return `page.locator(${quoteSelector(`a[href^="${escapeForDoubleQuotedSelector(group.hrefPrefix)}"]`)})`;
}

export const LINK_TARGET_LOAD_CAP = 20;

/** Which existing check already loads a link's target in this run, or null when none does. */
export function reusedTargetLoad(link: LinkDetail, pageHasRouteCheck: boolean): string | null {
    if (link.linkType === "anchor") return "an anchor on this page, not a page to load";
    if (link.linkType === "mailto" || link.linkType === "inert") return `a ${link.linkType} link, not a page to load`;
    if (link.linkType === "external") return "external: its href only, no request";
    if (isRouteLink(link)) {
        if (isStartRoute(link)) return "the start page, every test's first visit";
        if (pageHasRouteCheck) return "loaded by the linked-routes check";
        return null;
    }
    if (link.linkType === "internal" || link.linkType === "download") return "loaded by the link-health check";
    return null;
}

function hrefLocator(link: LinkDetail) {
    return `page.locator(${quoteSelector(`a[href="${escapeForDoubleQuotedSelector(link.rawHref || link.url)}"]`)}).first()`;
}

export function buildLinkInventoryTests(
    contentProfile: ContentProfile | null,
    paths?: string[],
    options: { loadCap?: number; reused?: (link: LinkDetail, pageHasRouteCheck: boolean) => string | null } = {}
): { tests: string[]; usesGuard: boolean } {
    const loadCap = options.loadCap ?? LINK_TARGET_LOAD_CAP;
    const reused = options.reused ?? reusedTargetLoad;
    const wanted = paths ? new Set(paths) : null;
    const seen = new Set<string>();
    const tests: string[] = [];
    let loads = 0;
    let usesGuard = false;
    // Its target's lines: a check that already loads it, or a load here under the cap, or a note that it is over the cap.
    const targetLines = (link: LinkDetail, pageHasRouteCheck: boolean, quoted: string, indent: string) => {
        const reason = reused(link, pageHasRouteCheck);
        if (reason) return [`${indent}// Its target: ${reason}.`];
        if (loads < loadCap) {
            loads++;
            usesGuard = true;
            return [
                `${indent}// Its target, same-origin and loaded by no other check: through the page, inside the request guard.`,
                `${indent}await tfReadOnlyGuarded(page, async () => {`,
                `${indent}  const response = await page.goto(new URL(href, page.url()).toString());`,
                `${indent}  expect(response?.status() ?? 0, '${quoted} leads to ' + href + ', which answers ' + (response?.status() ?? 'nothing')).toBeLessThan(400);`,
                `${indent}});`,
            ];
        }
        return [`${indent}test.info().annotations.push({ type: 'finding', description: '${quoted}: its target (' + href + ') was not loaded, over this run\\'s cap of ${loadCap} link-target loads' });`];
    };
    for (const page of contentProfile?.pages ?? []) {
        if (wanted && !wanted.has(page.path)) continue;
        const links = page.linkDetails ?? [];
        // As the link audit builds it: a page gets the linked-routes check when it links a route other than the start.
        const pageHasRouteCheck = links.some((link) => isRouteLink(link) && !isStartRoute(link));
        // Two links a page names alike, to different targets, are told apart by their target, so no two tests share a title.
        const repeated = (link: LinkDetail) => new Set(links.filter((other) => (other.text || other.url) === (link.text || link.url)).map((other) => other.url)).size > 1;
        const groups = cardGroups(links);
        for (const link of links) {
            const key = linkKey(link);
            // TFP-208: a card's link is its group's, tested with the group, where the page's first card is. Every listing
            // gets its group's test, even when its cards were seen on another page first; no card gets a test of its own.
            const group = groups.find((candidate) => candidate.keys.has(key));
            const seenBefore = seen.has(key);
            seen.add(key);
            if (!group && seenBefore) continue;
            if (group) {
                if (group.first === link) {
                    const path = escapeForSingleQuotedString(page.path);
                    const pattern = escapeForSingleQuotedString(group.pattern);
                    const lines = [
                        `    await page.goto('${path}');`,
                        `    // The cards can change from one load to the next (a listing with no fixed order), so they are found by the address`,
                        `    // their links share and checked by position, not by name.`,
                        `    const cards = ${cardGroupLocator(group)};`,
                        `    await expect(cards.first(), 'a card linking to ${pattern} is on ${path}').toBeAttached();`,
                        `    const count = await cards.count();`,
                        `    // Every card is checked, and the test fails once naming each card that failed, so one broken product doesn't hide another.`,
                        `    const problems: string[] = [];`,
                        `    for (let index = 0; index < count; index++) {`,
                        `      const card = cards.nth(index);`,
                        `      const href = (await card.getAttribute('href')) ?? '';`,
                        `      // What the card showed at run time, so a failure names the product, not only its position.`,
                        `      const shown = await card.evaluate((element) => {`,
                        `        const text = (element as HTMLElement).innerText ?? element.textContent ?? '';`,
                        `        const heading = element.querySelector('h1, h2, h3, h4, h5, h6, [role="heading"]')?.textContent ?? '';`,
                        `        const name = (heading.trim() || text.split('\\n').map((line) => line.trim()).find(Boolean) || element.getAttribute('aria-label') || element.getAttribute('title') || '').replace(/\\s+/g, ' ');`,
                        `        const price = /[$\\u20ac\\u00a3\\u00a5] ?\\d[\\d.,]*/.exec(text) ?? /\\d[\\d.,]* ?[$\\u20ac\\u00a3\\u00a5]/.exec(text);`,
                        `        return { name, price: price?.[0] ?? '' };`,
                        `      });`,
                        `      const label = 'card ' + (index + 1) + ' of ' + count + ' on ${path} (' + [shown.name ? JSON.stringify(shown.name) : '', shown.price, href || 'no href'].filter(Boolean).join(', ') + ')';`,
                    ];
                    if (group.visible) {
                        lines.push(
                            `      try { await expect(card.or(card.locator('*')).filter({ visible: true }).first()).toBeVisible(); } catch { problems.push(label + ': not visible'); }`,
                            `      try { await expect(card).toHaveAccessibleName(/\\S/); } catch { problems.push(label + ': has no name'); }`
                        );
                    }
                    lines.push(
                        `      if (!new RegExp('^${escapeForSingleQuotedString(escapeRegExp(group.hrefPrefix))}[^/?#]+$').test(href)) problems.push(label + ': does not link to ${pattern}');`,
                        `      else try { new URL(href, page.url()); } catch { problems.push(label + ': has an invalid href'); }`,
                        `    }`,
                        `    expect(problems, problems.length + ' of ' + count + ' cards on ${path} failed:\\n' + problems.join('\\n')).toEqual([]);`,
                        `    const href = (await cards.first().getAttribute('href')) ?? '';`,
                        ...targetLines(group.first, pageHasRouteCheck, `the first card to ${pattern}`, "    ")
                    );
                    tests.push(`  test('cards linking to ${pattern} on ${path}: each on the page${group.visible ? ", named" : ""}, with a valid href', { annotation: [{ type: 'gate', description: 'read-only' }, { type: 'page', description: '${path}' }] }, async ({ page }) => {
${lines.join("\n")}
  });`);
                }
                continue;
            }
            const name = link.text || link.url;
            const quoted = escapeForSingleQuotedString(`"${name}"`);
            const path = escapeForSingleQuotedString(page.path);
            const located = link.isVisible ? buildLinkLocatorExpression(link) : buildHiddenLinkLocatorExpression(link);
            const lines = [
                `    await page.goto('${path}');`,
                `    // By the generator's own locator, or by its own address when the page names it otherwise.`,
                `    const link = ${located}.or(${hrefLocator(link)}).first();`,
                `    await expect(link, '${quoted} is on ${path}').toBeAttached();`,
            ];
            if (link.isVisible) {
                lines.push(
                    `    // The link, or what renders it: an anchor around a positioned image has no box of its own.`,
                    `    await expect(link.or(link.locator('*')).filter({ visible: true }).first(), '${quoted} is visible on ${path}').toBeVisible();`,
                    `    await expect(link, '${quoted} has a name').toHaveAccessibleName(/\\S/);`
                );
            }
            lines.push(
                `    const href = (await link.getAttribute('href')) ?? '';`,
                `    expect(href.trim(), '${quoted} has an href').not.toBe('');`,
                `    expect(() => new URL(href, page.url()), '${quoted} has a valid href: ' + href).not.toThrow();`
            );
            lines.push(...targetLines(link, pageHasRouteCheck, quoted, "    "));
            tests.push(`  test('link ${escapeForSingleQuotedString(`"${name}"${repeated(link) ? ` to ${link.rawHref || link.url}` : ""}`)} on ${path}: on the page, named, with a valid href', { annotation: [{ type: 'gate', description: 'read-only' }, { type: 'page', description: '${path}' }] }, async ({ page }) => {
${lines.join("\n")}
  });`);
        }
    }
    return { tests, usesGuard };
}
