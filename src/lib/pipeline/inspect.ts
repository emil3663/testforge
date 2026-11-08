import { inspectPages } from "@/lib/introspect/inspector";
import { normalizeNamedFlows } from "@/lib/introspect/journeys";
import { normalizeInspectionPathList } from "@/lib/introspect/paths";

/**
 * Phase 47 Decision 4 (TFP-245): the page inspection, shared by `/api/introspect` and the CLI. The base URL is
 * normalised and its paths checked against its origin by the caller; this gives the page data the UI's generation
 * sends on as its `contentProfile`.
 */
export async function inspectSite(baseUrl: string, paths: unknown, namedFlows: unknown) {
    const normalizedPaths = normalizeInspectionPathList(baseUrl, paths);
    const { pages, warnings, requestedPaths, failedPages, dependencyMap, siteGraph, journeys } = await inspectPages(
        baseUrl,
        normalizedPaths,
        normalizeNamedFlows(namedFlows)
    );

    return {
        scannedAt: new Date().toISOString(),
        baseUrl,
        pages,
        warnings,
        requestedPaths,
        failedPages,
        dependencyMap,
        siteGraph,
        journeys,
    };
}
