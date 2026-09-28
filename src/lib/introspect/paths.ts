// Which paths an inspection visits. Shared by POST /api/introspect and the
// automatic inspection in POST /api/generate (Phase 34 TFP-122), so a request
// without page data is inspected exactly as the app's own flow would be.

export const MAX_INSPECTION_PATHS = 5;

export function getDefaultInspectionPath(baseUrl: string) {
    try {
        const pathname = new URL(baseUrl).pathname || "/";
        return pathname === "/" ? "/" : pathname.replace(/\/$/, "");
    } catch {
        return "/";
    }
}

/** Up to 5 unique paths, each with a leading slash; the base URL's own path when none are given. */
export function normalizeInspectionPathList(baseUrl: string, input: unknown) {
    if (!Array.isArray(input)) {
        return [getDefaultInspectionPath(baseUrl)];
    }

    const uniquePaths = [...new Set(
        input
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim())
            .filter(Boolean)
            .map((item) => (item.startsWith("/") ? item : `/${item}`))
    )].slice(0, MAX_INSPECTION_PATHS);

    return uniquePaths.length > 0 ? uniquePaths : [getDefaultInspectionPath(baseUrl)];
}
