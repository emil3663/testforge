import type { Page } from "@playwright/test";

/**
 * TFP-165 (owner decisions, 2026-10-06): sites that route by hash
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
 * TFP-177 (T30): after network idle, a page counts as drawn only once it has
 * been quiet this long - no request in flight and no element added, removed
 * or re-texted. "No request for 500 ms" (network idle) can come true in a gap
 * before an app's data requests start (start-up code still running on a
 * busy machine, or a timer); on TFP-175's with-bugs run, inspection read home
 * and the category drawn but without their product cards, so the product
 * page looked orphaned.
 */
export const DRAWN_QUIET_MS = 1000;

/**
 * Decision 3: moving to another route of the same page doesn't reload it,
 * and Playwright's network-idle state has already fired, so waiting for it
 * would return at once on the old view. A route is therefore loaded as a
 * fresh document - as a link opened in a new tab would be - and the wait is
 * for network idle, bounded. A path-routed URL loads exactly as before.
 *
 * `untilQuiet` (TFP-177, inspection): then also wait for DRAWN_QUIET_MS of
 * quiet, within the same ROUTE_SETTLE_MS bound; the page is never failed for
 * the wait, it is read as it is when the bound runs out.
 */
export async function gotoPage(page: Page, url: string, options: { timeout: number; untilQuiet?: boolean }) {
    const network = { inFlight: 0, last: Date.now() };
    const started = () => {
        network.inFlight += 1;
        network.last = Date.now();
    };
    const ended = () => {
        network.inFlight = Math.max(0, network.inFlight - 1);
        network.last = Date.now();
    };
    if (options.untilQuiet) {
        page.on("request", started);
        page.on("requestfinished", ended);
        page.on("requestfailed", ended);
    }
    try {
        if (isRouteFragment(new URL(url).hash)) {
            await page.goto("about:blank").catch(() => null);
        }
        const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: options.timeout });
        const deadline = Date.now() + ROUTE_SETTLE_MS;
        await page.waitForLoadState("networkidle", { timeout: ROUTE_SETTLE_MS }).catch(() => { });
        if (options.untilQuiet) await waitUntilQuiet(page, network, deadline);
        return response;
    } finally {
        if (options.untilQuiet) {
            page.off("request", started);
            page.off("requestfinished", ended);
            page.off("requestfailed", ended);
        }
    }
}

/** No request in flight, none for DRAWN_QUIET_MS, and no DOM change for as long; or the deadline. */
async function waitUntilQuiet(page: Page, network: { inFlight: number; last: number }, deadline: number) {
    // Elements added, removed or re-texted, timed in the page. Attribute changes (an animation, a
    // spinner's class) don't count: drawing content is what the read waits for.
    await page.evaluate(() => {
        const view = window as unknown as { __tfLastChange?: number; __tfQuiet?: MutationObserver };
        view.__tfLastChange = Date.now();
        view.__tfQuiet ??= new MutationObserver(() => {
            view.__tfLastChange = Date.now();
        });
        view.__tfQuiet.observe(document, { subtree: true, childList: true, characterData: true });
    }).catch(() => { });
    while (Date.now() < deadline) {
        const sinceChange = await page.evaluate(() => Date.now() - ((window as unknown as { __tfLastChange?: number }).__tfLastChange ?? 0)).catch(() => Number.POSITIVE_INFINITY);
        if (network.inFlight === 0 && Date.now() - network.last >= DRAWN_QUIET_MS && sinceChange >= DRAWN_QUIET_MS) return;
        await page.waitForTimeout(100).catch(() => { });
    }
}
