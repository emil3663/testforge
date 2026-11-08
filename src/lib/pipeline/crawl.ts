import { chromium, type Browser, type Page } from "@playwright/test";
import { crawlKeyOf, gotoPage, pagePathOf } from "@/lib/introspect/routes";
import { capturePageOutline, type PageOutline } from "@/lib/selection/page-outline";
import { groupPagesIntoTypes, labelPageType, type OutlinedPageType, type PageTypeLabel } from "@/lib/selection/page-types";
import { rankPageTypes, selectComprehensivePagesByType, selectStandardPages, type PageTypeSelection, type RankedPageType } from "@/lib/selection/select";
import { DEFAULT_PAGE_CAP } from "@/lib/comprehensive/run-mode";

/**
 * Phase 47 Decision 4 (TFP-263): the crawl and page selection, shared by
 * `/api/crawl` and the CLI. Progress, cancellation and the open browser are
 * the caller's callbacks; the job map stays in the route.
 */

// Only correct when TestForge is testing itself. For any other target
// (Plane on :80, test-assist on :4321, ...) the caller must supply baseUrl.
const DEFAULT_BASE_URL = "http://localhost:3000";
const MAX_CRAWL_PAGES = 100;
const MAX_DISCOVERED_LINKS_PER_PAGE = 200;
const SKIPPED_EXTENSIONS = /\.(?:pdf|doc|docx|xls|xlsx|csv|zip|ppt|pptx|jpg|jpeg|png|gif|svg|webp|ico|css|js|json|xml|txt|mp3|mp4|avi|mov|woff|woff2|ttf|eot)(?:[?#].*)?$/i;

interface CrawledPage {
    path: string;
    url: string;
    title: string;
    discoveredFrom: string | null;
    /** Phase 40 Decision 2 (TFP-171): absent when the page's outline couldn't be read. */
    outline?: PageOutline;
}

type CrawledPageType = OutlinedPageType & { label: PageTypeLabel };

/**
 * Phase 40 Decisions 1 to 3 (TFP-170, TFP-171, revised at Gate A in
 * TFP-176): the pages, in discovery order, grouped by address, split by form
 * signature and merged only among siblings under one parent, each labelled
 * for the report. The start page is the first page crawled.
 */
function typesOf(pages: CrawledPage[]): CrawledPageType[] {
    const outlines = new Map(pages.map((page) => [page.path, page.outline]));
    const startPath = pages[0]?.path ?? "/";
    return groupPagesIntoTypes(pages.map((page) => ({ path: page.path, outline: page.outline })))
        .map((type) => ({ ...type, label: labelPageType(type, outlines.get(type.pages[0]), startPath) }));
}

/**
 * Phase 40 Decisions 4 to 6 (TFP-172): the types ranked, and the pages
 * Standard (up to 8 types) and Comprehensive (its default 20-page budget)
 * cover. A Comprehensive run with another budget selects again from the
 * ranking.
 */
function selectionOf(pages: CrawledPage[], types: CrawledPageType[]) {
    const outlines = new Map(pages.map((page) => [page.path, page.outline]));
    const rankedTypes = rankPageTypes(types, (path) => outlines.get(path));
    return {
        rankedTypes,
        pageSelection: { standard: selectStandardPages(rankedTypes), comprehensive: selectComprehensivePagesByType(rankedTypes, DEFAULT_PAGE_CAP) },
    };
}

function typedResultOf(pages: CrawledPage[]) {
    const pageTypes = typesOf(pages);
    return { pageTypes, ...selectionOf(pages, pageTypes) };
}

export interface CrawlResultPayload {
    crawledAt: string;
    baseUrl: string;
    pageCount: number;
    pages: CrawledPage[];
    /** Phase 40 Decision 1 (TFP-170): the pages grouped into types by address pattern. */
    pageTypes?: CrawledPageType[];
    /** Phase 40 Decision 4 (TFP-172): the types in coverage order. */
    rankedTypes?: RankedPageType[];
    /** Phase 40 Decisions 5 and 6 (TFP-172): the pages each run type covers. */
    pageSelection?: { standard: PageTypeSelection; comprehensive: PageTypeSelection };
    warnings?: string[];
}

export interface CrawlProgressSnapshot {
    maxPages: number;
    visitedUrls: number;
    queuedUrls: number;
    discoveredPages: number;
    warningsCount: number;
    currentUrl: string | null;
    currentPath: string | null;
    currentTitle: string | null;
    lastCompletedPath: string | null;
    lastCompletedTitle: string | null;
}

/** What the caller gives a crawl: where to report progress, whether to stop, and where to hand the browser. */
export interface CrawlControl {
    /** The crawl's progress object, updated in place as the crawl goes. */
    progress: CrawlProgressSnapshot;
    isCancelled: () => boolean;
    /** Called with a way to close the open page and browser, which interrupts a navigation; null once they are closed. */
    onBrowser?: (close: (() => Promise<void>) | null) => void;
}

/** How a crawl ended. A failure that isn't a cancellation keeps no result. */
export type CrawlOutcome =
    | { status: "completed" | "cancelled"; finishedAt: number; result: CrawlResultPayload }
    | { status: "failed"; finishedAt: number; error: string };

export function createEmptyCrawlProgress(): CrawlProgressSnapshot {
    return {
        maxPages: MAX_CRAWL_PAGES,
        visitedUrls: 0,
        queuedUrls: 0,
        discoveredPages: 0,
        warningsCount: 0,
        currentUrl: null,
        currentPath: null,
        currentTitle: null,
        lastCompletedPath: null,
        lastCompletedTitle: null,
    };
}

export function normalizeCrawlBaseUrl(baseUrl: unknown) {
    if (typeof baseUrl !== "string" || !baseUrl.trim()) {
        return { ok: true as const, value: DEFAULT_BASE_URL };
    }

    const trimmed = baseUrl.trim();
    const withProtocol = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(trimmed)
        ? trimmed
        : `http://${trimmed}`;

    try {
        const normalized = new URL(withProtocol);
        normalized.hash = "";
        return {
            ok: true as const,
            value: normalized.toString().replace(/\/$/, ""),
        };
    } catch {
        return {
            ok: false as const,
            message: "baseUrl must be a valid URL",
        };
    }
}

// TFP-165: a hash route is a page, named as the address bar shows it (/#/contact).
function normalizePath(url: URL) {
    return pagePathOf(url);
}

// TFP-165: the query and an in-page anchor are dropped, but a hash route
// (#/contact, #!/contact) is kept: it is its own page.
function normalizeCrawlUrl(url: URL) {
    return crawlKeyOf(url);
}

function shouldQueueUrl(candidateUrl: URL, origin: string) {
    if (candidateUrl.origin !== origin) {
        return false;
    }

    if (["mailto:", "tel:", "javascript:", "data:"].includes(candidateUrl.protocol)) {
        return false;
    }

    if (SKIPPED_EXTENSIONS.test(candidateUrl.pathname)) {
        return false;
    }

    return true;
}

export async function crawlSite(baseUrl: string, control: CrawlControl): Promise<CrawlOutcome> {
    const { progress, isCancelled } = control;
    // TFP-272: a browser that can't start ends the crawl as failed, with the cause's first line, never a crawl left running.
    let browser: Browser | undefined;
    let page: Page;
    try {
        browser = await chromium.launch({ headless: true });
        page = await browser.newPage();
    } catch (error) {
        await browser?.close().catch(() => { });
        const cause = error instanceof Error ? error.message.split("\n")[0] : String(error);
        return { status: "failed", finishedAt: Date.now(), error: `The browser for the crawl could not start: ${cause}` };
    }
    const openBrowser = browser;
    control.onBrowser?.(async () => {
        await Promise.all([
            page.close().catch(() => { }),
            openBrowser.close().catch(() => { }),
        ]);
    });
    const startUrl = new URL(baseUrl);
    const normalizedStartUrl = normalizeCrawlUrl(startUrl);
    const queue: Array<{ url: string; discoveredFrom: string | null }> = [{
        url: normalizedStartUrl.toString(),
        discoveredFrom: null,
    }];
    const queued = new Set<string>([normalizedStartUrl.toString()]);
    const visited = new Set<string>();
    const visitedPaths = new Set<string>();
    const pages: CrawledPage[] = [];
    const warnings: string[] = [];

    progress.queuedUrls = queue.length;

    try {
        while (queue.length > 0 && pages.length < MAX_CRAWL_PAGES) {
            if (isCancelled()) {
                break;
            }

            const nextItem = queue.shift();

            if (!nextItem) {
                break;
            }

            const targetUrl = nextItem.url;
            const targetPath = normalizePath(new URL(targetUrl));
            if (visited.has(targetUrl)) {
                progress.queuedUrls = queue.length;
                continue;
            }

            visited.add(targetUrl);
            progress.visitedUrls = visited.size;
            progress.queuedUrls = queue.length;
            progress.currentUrl = targetUrl;
            progress.currentPath = targetPath;
            progress.currentTitle = null;

            try {
                // TFP-165: a hash route loads as a fresh document, so the network-idle wait means something.
                await gotoPage(page, targetUrl, { timeout: 30000 });

                if (isCancelled()) {
                    break;
                }

                const pageData = await page.evaluate(({ origin, limit }) => {
                    const links = Array.from(document.querySelectorAll("a[href]"))
                        .map((anchor) => {
                            const rawHref = anchor.getAttribute("href");
                            if (!rawHref) {
                                return null;
                            }

                            try {
                                const resolved = new URL(rawHref, window.location.href);
                                return resolved.toString();
                            } catch {
                                return null;
                            }
                        })
                        .filter((link): link is string => Boolean(link))
                        .filter((link, index, allLinks) => allLinks.indexOf(link) === index)
                        .filter((link) => link.startsWith(origin))
                        .slice(0, limit);

                    return {
                        title: document.title.replace(/\s+/g, " ").trim(),
                        currentUrl: window.location.href,
                        links,
                    };
                }, {
                    origin: startUrl.origin,
                    limit: MAX_DISCOVERED_LINKS_PER_PAGE,
                });

                const currentUrl = normalizeCrawlUrl(new URL(pageData.currentUrl));
                const path = normalizePath(currentUrl);
                progress.currentTitle = pageData.title || null;

                if (!visitedPaths.has(path)) {
                    visitedPaths.add(path);
                    // Phase 40 Decision 2 (TFP-171): the page's outline, read from the page already open.
                    const outline = await page.evaluate(capturePageOutline).catch(() => undefined);
                    pages.push({
                        path,
                        url: currentUrl.toString(),
                        title: pageData.title,
                        discoveredFrom: nextItem.discoveredFrom,
                        ...(outline ? { outline } : {}),
                    });
                    progress.discoveredPages = pages.length;
                }

                for (const discoveredUrl of pageData.links) {
                    try {
                        const candidateUrl = normalizeCrawlUrl(new URL(discoveredUrl));

                        if (!shouldQueueUrl(candidateUrl, startUrl.origin)) {
                            continue;
                        }

                        const normalizedCandidate = candidateUrl.toString();
                        if (queued.has(normalizedCandidate) || visited.has(normalizedCandidate)) {
                            continue;
                        }

                        queued.add(normalizedCandidate);
                        queue.push({
                            url: normalizedCandidate,
                            discoveredFrom: path,
                        });
                    } catch {
                        continue;
                    }
                }

                progress.lastCompletedPath = path;
                progress.lastCompletedTitle = pageData.title || path;
                progress.queuedUrls = queue.length;
            } catch (error) {
                if (isCancelled()) {
                    break;
                }

                warnings.push(
                    `Could not crawl ${targetUrl}: ${error instanceof Error ? error.message : "Unknown error"}`
                );
                progress.warningsCount = warnings.length;
                progress.queuedUrls = queue.length;
            }
        }

        const sortedPages = [...pages].sort((left, right) => left.path.localeCompare(right.path));

        const finishedAt = Date.now();
        progress.currentUrl = null;
        progress.currentPath = null;
        progress.currentTitle = null;
        progress.queuedUrls = 0;
        progress.discoveredPages = sortedPages.length;
        return {
            status: isCancelled() ? "cancelled" : "completed",
            finishedAt,
            result: {
                crawledAt: new Date(finishedAt).toISOString(),
                baseUrl,
                pageCount: sortedPages.length,
                pages: sortedPages,
                // Phase 40 (TFP-170 to TFP-172): the pages grouped into types, in crawl order; ranked; selected.
                ...typedResultOf(pages),
                warnings,
            },
        };
    } catch (error) {
        const finishedAt = Date.now();
        progress.currentUrl = null;
        progress.currentPath = null;
        progress.currentTitle = null;
        progress.queuedUrls = 0;
        if (isCancelled()) {
            const sortedPages = [...pages].sort((left, right) => left.path.localeCompare(right.path));
            return {
                status: "cancelled",
                finishedAt,
                result: {
                    crawledAt: new Date(finishedAt).toISOString(),
                    baseUrl,
                    pageCount: sortedPages.length,
                    pages: sortedPages,
                    ...typedResultOf(pages),
                    warnings,
                },
            };
        }
        return { status: "failed", finishedAt, error: error instanceof Error ? error.message : "Site crawl failed" };
    } finally {
        control.onBrowser?.(null);
        await page.close().catch(() => { });
        await openBrowser.close().catch(() => { });
    }
}
