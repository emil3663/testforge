import type { ContentProfile } from "@/lib/generate/mock/types";

// Phase 35 (TFP-132, Decision 2): a Comprehensive run covers every page
// TestForge knows on the site, up to a cap, and names the ones it left out.
// Pages come from introspection (the profile's pages, inspected) and from the
// crawl's site graph (pages only known as another page's link target), in
// that order, same origin only. With no page data at all, the run covers "/".

export interface ComprehensivePageScope {
    /** Paths the run covers, in the order they are tested. */
    covered: string[];
    /** Known pages beyond the cap, named in the report as not covered. */
    notCovered: string[];
    pageCap: number;
}

function sameOriginPath(url: string, origin: string): string | null {
    try {
        const parsed = new URL(url);
        return parsed.origin === origin ? `${parsed.pathname}${parsed.search}` : null;
    } catch {
        return null;
    }
}

export function selectComprehensivePages(contentProfile: ContentProfile | null, baseUrl: string, pageCap: number): ComprehensivePageScope {
    const origin = new URL(baseUrl).origin;
    const known: string[] = [];
    const add = (path: string | null) => {
        if (path && !known.includes(path)) known.push(path);
    };
    for (const page of contentProfile?.pages ?? []) add(sameOriginPath(page.url || new URL(page.path, origin).toString(), origin));
    for (const node of contentProfile?.siteGraph?.nodes ?? []) add(sameOriginPath(node.url || new URL(node.path, origin).toString(), origin));
    if (known.length === 0) known.push("/");
    return { covered: known.slice(0, pageCap), notCovered: known.slice(pageCap), pageCap };
}
