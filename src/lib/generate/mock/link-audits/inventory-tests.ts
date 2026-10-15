import { escapeForDoubleQuotedSelector, escapeForSingleQuotedString, quoteSelector } from "../format";
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
 */

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
    for (const page of contentProfile?.pages ?? []) {
        if (wanted && !wanted.has(page.path)) continue;
        const links = page.linkDetails ?? [];
        // As the link audit builds it: a page gets the linked-routes check when it links a route other than the start.
        const pageHasRouteCheck = links.some((link) => isRouteLink(link) && !isStartRoute(link));
        // Two links a page names alike, to different targets, are told apart by their target, so no two tests share a title.
        const repeated = (link: LinkDetail) => new Set(links.filter((other) => (other.text || other.url) === (link.text || link.url)).map((other) => other.url)).size > 1;
        for (const link of links) {
            const key = JSON.stringify([link.text, link.url]);
            if (seen.has(key)) continue;
            seen.add(key);
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
            const reason = reused(link, pageHasRouteCheck);
            if (reason) {
                lines.push(`    // Its target: ${reason}.`);
            } else if (loads < loadCap) {
                loads++;
                usesGuard = true;
                lines.push(
                    `    // Its target, same-origin and loaded by no other check: through the page, inside the request guard.`,
                    `    await tfReadOnlyGuarded(page, async () => {`,
                    `      const response = await page.goto(new URL(href, page.url()).toString());`,
                    `      expect(response?.status() ?? 0, '${quoted} leads to ' + href + ', which answers ' + (response?.status() ?? 'nothing')).toBeLessThan(400);`,
                    `    });`
                );
            } else {
                lines.push(`    test.info().annotations.push({ type: 'finding', description: '${quoted}: its target (' + href + ') was not loaded, over this run\\'s cap of ${loadCap} link-target loads' });`);
            }
            tests.push(`  test('link ${escapeForSingleQuotedString(`"${name}"${repeated(link) ? ` to ${link.rawHref || link.url}` : ""}`)} on ${path}: on the page, named, with a valid href', { annotation: [{ type: 'gate', description: 'read-only' }, { type: 'page', description: '${path}' }] }, async ({ page }) => {
${lines.join("\n")}
  });`);
        }
    }
    return { tests, usesGuard };
}
