import { chromium, type Request } from "@playwright/test";
import { captureDomSnapshot } from "./dom-snapshot";
import { identifyJourneys } from "./journeys";
import { buildSiteGraph } from "./site-graph";
import { aggregateDependencyMap, dependenciesFromEmbeddedLinks } from "./dependency-map";
import { installStorageAccessProbe, readStorageAccessProbe } from "./storage-probe";
import type { DependencyDetail, NamedFlow, PageSnapshot } from "./types";
import { gotoPage } from "./routes";

const MAX_TEXT_ITEMS = 8;
const MAX_ACTIONABLE_ITEMS = 40;
const MAX_LINK_DETAILS = 100;
const MAX_EMBEDDED_LINK_DETAILS = 150;
const MAX_DRAG_DROP_TARGETS = 10;

function cleanTextList(values: unknown[]) {
    return [...new Set(
        values
            .map((value) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : ""))
            .filter(Boolean)
    )].slice(0, MAX_TEXT_ITEMS);
}

function hostOf(url: string): string | null {
    try {
        return new URL(url).host;
    } catch {
        return null;
    }
}

// TFP-084: XHR/fetch targets can only be observed at the network level, not
// via a static DOM scan - captured from requests the page's own natural load
// already makes (inspectPages' existing goto + networkidle wait), never a
// request TestForge triggers itself.
function trackXhrFetchRequests(request: Request, baseUrl: string, sink: DependencyDetail[]) {
    const resourceType = request.resourceType();
    if (resourceType !== "xhr" && resourceType !== "fetch") {
        return;
    }

    const url = request.url();
    const host = hostOf(url);
    if (!host) {
        return;
    }

    sink.push({
        kind: "xhr-fetch",
        host,
        url,
        sameOrigin: host === hostOf(baseUrl),
        method: request.method(),
        rawValue: null,
    });
}

// Walks Playwright's redirectedFrom() chain on the main navigation response
// to name every intermediate hop as a dependency - the redirect already
// happened as part of the page's own natural navigation.
function redirectDependenciesFromNavigation(
    finalRequest: Request,
    baseUrl: string
): DependencyDetail[] {
    const hops: DependencyDetail[] = [];
    let current = finalRequest.redirectedFrom();

    while (current) {
        const url = current.url();
        const host = hostOf(url);

        if (host) {
            hops.push({
                kind: "redirect",
                host,
                url,
                sameOrigin: host === hostOf(baseUrl),
                method: current.method(),
                rawValue: null,
            });
        }

        current = current.redirectedFrom();
    }

    return hops;
}

export async function inspectPages(baseUrl: string, paths: string[], namedFlows: NamedFlow[] = []) {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    // TFP-086: runs before any of the page's own scripts, on every
    // subsequent navigation (addInitScript persists across page.goto calls
    // on the same page) - a fresh window.__tfStorageAccess per page load.
    await page.addInitScript(installStorageAccessProbe);

    try {
        const pages: PageSnapshot[] = [];
        const warnings: string[] = [];
        // TFP-161: which requested pages could not be loaded, and why.
        const failedPages: { path: string; reason: string }[] = [];
        const perPageDependencies: { path: string; dependencies: DependencyDetail[] }[] = [];

        for (const path of paths) {
            const targetUrl = new URL(path, baseUrl).toString();
            const requestDependencies: DependencyDetail[] = [];
            const requestListener = (request: Request) => trackXhrFetchRequests(request, baseUrl, requestDependencies);
            page.on("request", requestListener);

            try {
                // TFP-165: a hash route (/#/contact) loads as a fresh document, so the network-idle wait means something.
                const response = await gotoPage(page, targetUrl, { timeout: 30000 });
                // TFP-161 (Emil, 2026-10-06): a server error is a page that could not be loaded, like a
                // timeout - an error page's empty snapshot made every page it links to look orphaned.
                // A 4xx stays a page: it is the site's real answer.
                if (response && response.status() >= 500) {
                    throw new Error(`HTTP ${response.status()}`);
                }

                const snapshot = await page.evaluate(captureDomSnapshot, {
                    requestedPath: path,
                    maxActionableItems: MAX_ACTIONABLE_ITEMS,
                    maxLinkDetails: MAX_LINK_DETAILS,
                    maxEmbeddedLinkDetails: MAX_EMBEDDED_LINK_DETAILS,
                    maxDragDropTargets: MAX_DRAG_DROP_TARGETS,
                });

                const storageUsage = await readStorageAccessProbe(page);

                pages.push({
                    ...snapshot,
                    headings: cleanTextList(snapshot.headings),
                    buttons: cleanTextList(snapshot.buttons),
                    links: cleanTextList(snapshot.links),
                    actionableElements: snapshot.actionableElements,
                    linkDetails: snapshot.linkDetails,
                    embeddedLinkDetails: snapshot.embeddedLinkDetails,
                    dragDropTargets: snapshot.dragDropTargets,
                    visibleTextSnippets: cleanTextList(snapshot.visibleTextSnippets),
                    storageUsage,
                });

                const redirectDependencies = response
                    ? redirectDependenciesFromNavigation(response.request(), baseUrl)
                    : [];
                const cookies = await page.context().cookies();
                const cookieDependencies: DependencyDetail[] = cookies.map((cookie) => ({
                    kind: "cookie" as const,
                    host: cookie.domain.replace(/^\./, ""),
                    url: cookie.name,
                    sameOrigin: cookie.domain.replace(/^\./, "") === hostOf(baseUrl),
                    method: null,
                    rawValue: null,
                }));

                perPageDependencies.push({
                    path,
                    dependencies: [
                        ...requestDependencies,
                        ...redirectDependencies,
                        ...cookieDependencies,
                        ...dependenciesFromEmbeddedLinks(snapshot.embeddedLinkDetails),
                    ],
                });
            } catch (error) {
                const reason = error instanceof Error ? error.message : "Unknown error";
                warnings.push(`Could not inspect ${targetUrl}: ${reason}`);
                failedPages.push({ path, reason: reason.split("\n")[0] });
            } finally {
                page.off("request", requestListener);
            }
        }

        const siteGraph = buildSiteGraph(baseUrl, pages);
        const journeyResult = identifyJourneys(siteGraph, namedFlows);

        return {
            pages,
            warnings: [...warnings, ...journeyResult.warnings],
            // TFP-161: the paths asked for, in order (the first is the start page), and those that failed.
            requestedPaths: [...paths],
            failedPages,
            dependencyMap: aggregateDependencyMap(perPageDependencies),
            siteGraph,
            journeys: journeyResult.journeys,
        };
    } finally {
        await page.close().catch(() => { });
        await browser.close().catch(() => { });
    }
}
