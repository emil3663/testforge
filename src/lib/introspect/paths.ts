// Which paths an inspection visits. Shared by POST /api/introspect and the
// automatic inspection in POST /api/generate (Phase 34 TFP-122), so a request
// without page data is inspected exactly as the app's own flow would be.
//
// Phase 40 (TFP-172, Decision 5): a run inspects the pages selected for it -
// by page type after a crawl, or by hand - no longer the first 5. The bound
// left is the most any run covers (Comprehensive's largest page cap), so a
// request can't ask for an unbounded inspection.

import { MAX_PAGE_CAP } from "@/lib/comprehensive/run-mode";

export const MAX_INSPECTION_PATHS = MAX_PAGE_CAP;

export function getDefaultInspectionPath(baseUrl: string) {
    try {
        const pathname = new URL(baseUrl).pathname || "/";
        return pathname === "/" ? "/" : pathname.replace(/\/$/, "");
    } catch {
        return "/";
    }
}

const ABSOLUTE = /^[a-zA-Z][a-zA-Z\d+.-]*:/;

/**
 * Phase 40 Decision 8 (TFP-174): a page may be given as a full URL (a list
 * pasted from a report). One on the run's own origin becomes its path, query
 * and hash route (`https://site/#/contact` -> `/#/contact`); any other is
 * rejected before the run. Returns the first such page, or null.
 *
 * TFP-174's follow-up: every page is resolved against the base URL the way
 * the inspector will open it (`new URL(path, baseUrl)`), not only full URLs.
 * A path such as `//evil.test/x` (protocol-relative) or `/\evil.test/x` (a
 * backslash the URL parser reads as a slash) isn't an absolute URL, but
 * resolves to another site; it is rejected the same way.
 */
export function findForeignPath(baseUrl: string, input: unknown): string | null {
    if (!Array.isArray(input)) return null;
    let origin: string;
    try {
        origin = new URL(baseUrl).origin;
    } catch {
        return null;
    }
    for (const item of input) {
        if (typeof item !== "string" || !item.trim()) continue;
        const page = item.trim();
        try {
            // A full URL as given (against the base, as the inspector would); a path as it will be inspected.
            const url = new URL(ABSOLUTE.test(page) ? page : asPath(page, baseUrl), baseUrl);
            if ((url.protocol !== "http:" && url.protocol !== "https:") || url.origin !== origin) return page;
        } catch {
            return page;
        }
    }
    return null;
}

/** The message a rejected page gets, naming it. */
export function foreignPathMessage(baseUrl: string, page: string) {
    let origin = baseUrl;
    try {
        origin = new URL(baseUrl).origin;
    } catch {
        // keep the base URL as given
    }
    return `${page} is not on the run's site (${origin}); every page must be on the same origin.`;
}

/**
 * A page as an inspection path: a same-origin full URL becomes its path,
 * query and hash route. It is resolved against the base URL, as the
 * inspector resolves it (`https:x/y` with an https base is a path there).
 */
function asPath(item: string, baseUrl: string) {
    if (ABSOLUTE.test(item)) {
        const url = new URL(item, baseUrl);
        return `${url.pathname}${url.search}${url.hash}`;
    }
    return item.startsWith("/") ? item : `/${item}`;
}

/** Up to MAX_INSPECTION_PATHS unique paths, each with a leading slash; the base URL's own path when none are given. */
export function normalizeInspectionPathList(baseUrl: string, input: unknown) {
    if (!Array.isArray(input)) {
        return [getDefaultInspectionPath(baseUrl)];
    }

    const uniquePaths = [...new Set(
        input
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim())
            .filter(Boolean)
            // A caller rejects a foreign page first (findForeignPath); one that slips through is dropped, never visited.
            .filter((item) => findForeignPath(baseUrl, [item]) === null)
            .map((item) => asPath(item, baseUrl))
    )].slice(0, MAX_INSPECTION_PATHS);

    return uniquePaths.length > 0 ? uniquePaths : [getDefaultInspectionPath(baseUrl)];
}
