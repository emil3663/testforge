import type { Page } from "@playwright/test";

/**
 * TFP-165 (decisions approved by Emil, 2026-10-06): sites that route by hash
 * (Angular's and Vue's hash modes, React Router's HashRouter) address pages
 * as `#/contact` or `#!/contact`. Until now the crawl cleared every URL's
 * `#…` part, so each route counted as `/`, and introspection recorded each
 * route link as an in-page anchor.
 *
 * Decision 1: a `#` link is a page when what follows the `#` starts with
 * `/` or `!/`. Everything else - `#top`, `#filters`, a bare `#` - stays an
 * in-page anchor.
 */
export function isRouteFragment(hash: string) {
    const fragment = hash.startsWith("#") ? hash.slice(1) : hash;
    return fragment.startsWith("/") || fragment.startsWith("!/");
}

function trimTrailingSlash(pathname: string) {
    return pathname === "/" ? "/" : pathname.replace(/\/$/, "");
}

/**
 * Decision 2: a route page is named as the address bar shows it - the path,
 * then the route - `/#/contact`, everywhere. A path-routed page keeps its
 * path (`/contact`), as before.
 */
export function pagePathOf(url: URL) {
    const pathname = trimTrailingSlash(url.pathname);
    if (!isRouteFragment(url.hash)) {
        return pathname;
    }
    const route = url.hash.length > 2 ? url.hash.replace(/\/$/, "") : url.hash;
    return `${pathname}${route}`;
}

/** The crawl's de-duplication key: no query, no in-page anchor, but a route fragment is kept. */
export function crawlKeyOf(url: URL) {
    const normalized = new URL(url.toString());
    normalized.search = "";
    if (!isRouteFragment(normalized.hash)) {
        normalized.hash = "";
    } else if (normalized.hash.length > 2) {
        normalized.hash = normalized.hash.replace(/\/$/, "");
    }
    if (normalized.pathname !== "/") {
        normalized.pathname = normalized.pathname.replace(/\/$/, "");
    }
    return normalized;
}

/** How long to wait for an app to finish drawing a route (Decision 3, bounded as TFP-142 bounded other waits). */
export const ROUTE_SETTLE_MS = 10000;

/**
 * Decision 3: moving to another route of the same page doesn't reload it,
 * and Playwright's network-idle state has already fired, so waiting for it
 * would return at once on the old view. A route is therefore loaded as a
 * fresh document - as a link opened in a new tab would be - and the wait is
 * for network idle, bounded. A path-routed URL loads exactly as before.
 */
export async function gotoPage(page: Page, url: string, options: { timeout: number }) {
    if (isRouteFragment(new URL(url).hash)) {
        await page.goto("about:blank").catch(() => null);
    }
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: options.timeout });
    await page.waitForLoadState("networkidle", { timeout: ROUTE_SETTLE_MS }).catch(() => { });
    return response;
}
