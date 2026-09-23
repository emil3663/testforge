import { chromium, type Request } from "@playwright/test";
import { captureDomSnapshot } from "./dom-snapshot";
import { buildSiteGraph } from "./site-graph";
import { aggregateDependencyMap, dependenciesFromEmbeddedLinks } from "./dependency-map";
import { installStorageAccessProbe, readStorageAccessProbe } from "./storage-probe";
import type { DependencyDetail, PageSnapshot } from "./types";

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

export async function inspectPages(baseUrl: string, paths: string[]) {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    // TFP-086: runs before any of the page's own scripts, on every
    // subsequent navigation (addInitScript persists across page.goto calls
    // on the same page) - a fresh window.__tfStorageAccess per page load.
    await page.addInitScript(installStorageAccessProbe);

    try {
        const pages: PageSnapshot[] = [];
        const warnings: string[] = [];
        const perPageDependencies: { path: string; dependencies: DependencyDetail[] }[] = [];

        for (const path of paths) {
            const targetUrl = new URL(path, baseUrl).toString();
            const requestDependencies: DependencyDetail[] = [];
            const requestListener = (request: Request) => trackXhrFetchRequests(request, baseUrl, requestDependencies);
            page.on("request", requestListener);

            try {
                const response = await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
                await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => { });

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
                warnings.push(
                    `Could not inspect ${targetUrl}: ${error instanceof Error ? error.message : "Unknown error"}`
                );
            } finally {
                page.off("request", requestListener);
            }
        }

        return {
            pages,
            warnings,
            dependencyMap: aggregateDependencyMap(perPageDependencies),
            siteGraph: buildSiteGraph(baseUrl, pages),
        };
    } finally {
        await page.close().catch(() => { });
        await browser.close().catch(() => { });
    }
}
