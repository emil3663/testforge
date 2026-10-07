import type { PageTypeCoverageEntry, PageTypeCoverageRecord } from "./types";

/**
 * Phase 40 Decision 7 (TFP-173): the page-type coverage in words, for the
 * app's report and the HTML exports alike. For example: "Found 9 page types.
 * Covered 8: home, detail (35 pages), listing (4 pages), sign-in (login,
 * register), form (contact, forgot-password), content (privacy). Not
 * covered: content (rentals)."
 */

/** The page's own name: the last segment of its route (after `#/` on a hash-routed site). */
function pageName(url: string): string {
    let route = url;
    try {
        const parsed = new URL(url);
        route = parsed.hash.startsWith("#/") || parsed.hash.startsWith("#!/") ? parsed.hash.replace(/^#!?/, "") : parsed.pathname;
    } catch {
        route = url;
    }
    return route.split("/").filter(Boolean).pop() ?? "/";
}

/** Types grouped by label, in order: "detail (35 pages)", "sign-in (login, register)", "home". */
function listTypes(entries: PageTypeCoverageEntry[]): string {
    const byLabel = new Map<string, string[]>();
    for (const entry of entries) {
        const names = byLabel.get(entry.label) ?? [];
        if (entry.label !== "home") names.push(entry.pages > 1 ? `${entry.pages} pages` : pageName(entry.url));
        byLabel.set(entry.label, names);
    }
    return [...byLabel].map(([label, names]) => (names.length > 0 ? `${label} (${names.join(", ")})` : label)).join(", ");
}

export function describePageTypeHeadline(record: PageTypeCoverageRecord): string {
    if (record.selectedBy === "list" && record.found === 0) {
        const pages = coveredPageUrls(record).length;
        return `${pages} page${pages === 1 ? "" : "s"} chosen by the user. The site wasn't crawled, so no page types are named.`;
    }
    const found = `Found ${record.found} page type${record.found === 1 ? "" : "s"}.`;
    const covered = `Covered ${record.covered.length}${record.covered.length > 0 ? `: ${listTypes(record.covered)}` : ""}.`;
    const skipped = record.skipped.length > 0 ? ` Not covered: ${listTypes(record.skipped)}.` : "";
    return `${found} ${covered}${skipped}`;
}

export function describePageTypeSelection(record: PageTypeCoverageRecord): string {
    if (record.selectedBy === "list") {
        const pages = coveredPageUrls(record).length;
        return `Pages chosen by the user: ${pages} page${pages === 1 ? "" : "s"} listed in the URL field, run exactly as listed; selection by page type was skipped.`;
    }
    if (record.selectedBy === "user") {
        const added = record.override?.added ?? [];
        const removed = record.override?.removed ?? [];
        const changes = [
            added.length > 0 ? `added ${added.join(", ")}` : "",
            removed.length > 0 ? `left out ${removed.join(", ")}` : "",
        ].filter(Boolean).join("; ");
        return `Pages chosen by hand: an override of the selection by page type${changes ? ` (${changes})` : ""}.`;
    }
    return record.runType === "comprehensive"
        ? `Pages chosen by page type: one page of every type first, then more pages of the biggest types, up to ${record.cap} pages.`
        : `Pages chosen by page type: one page of each type, up to ${record.cap} types.`;
}

/** Decision 7's copyable re-run list: every covered page's full URL, one per line. */
export function coveredPageUrls(record: PageTypeCoverageRecord): string[] {
    return [...new Set(record.covered.flatMap((entry) => entry.covered))];
}

/** The second list: one page of each skipped type, to add by hand. */
export function skippedPageUrls(record: PageTypeCoverageRecord): string[] {
    return [...new Set(record.skipped.map((entry) => entry.url))];
}
