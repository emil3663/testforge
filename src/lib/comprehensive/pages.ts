import type { ContentProfile } from "@/lib/generate/mock/types";

// Phase 35 (TFP-132, Decision 2): a Comprehensive run covers every page
// TestForge knows on the site, up to a cap, and names the ones it left out.
// Pages come from introspection (the profile's pages, inspected) and from the
// crawl's site graph (pages only known as another page's link target), in
// that order, same origin only. With no page data at all, the run covers "/".
//
// TFP-136 (found on the-internet, 2026-10-01): a page known only from the
// graph is loaded by the href a link to it really uses - the graph's own path
// is normalised (/add_remove_elements for the real /add_remove_elements/,
// which answers 404 without its slash) - and a node reached only by a form
// submit or a scripted action is not a page to load (/authenticate is the
// login form's POST target; a GET of it answers 404).

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
    const pageUrls = new Map((contentProfile?.pages ?? []).map((page) => [page.path, page.url || new URL(page.path, origin).toString()]));
    for (const url of pageUrls.values()) add(sameOriginPath(url, origin));

    const graph = contentProfile?.siteGraph;
    for (const node of graph?.nodes ?? []) {
        if (node.inspected || pageUrls.has(node.path)) continue;
        // The first link that leads here, resolved against the page it is on.
        const link = (graph?.edges ?? []).find((edge) => edge.to === node.path && edge.kind === "link");
        if (!link) continue;
        const from = pageUrls.get(link.from) ?? new URL(link.from, origin).toString();
        let href: string | null = null;
        try {
            href = new URL(link.rawValue || node.path, from).toString();
        } catch {
            href = null;
        }
        add(href ? sameOriginPath(href, origin) : null);
    }
    if (known.length === 0) known.push("/");
    return { covered: known.slice(0, pageCap), notCovered: known.slice(pageCap), pageCap };
}
