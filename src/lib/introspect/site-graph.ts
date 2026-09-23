import type {
    EmbeddedLinkDetail,
    LinkDetail,
    PageSnapshot,
    SiteGraph,
    SiteGraphEdge,
    SiteGraphEdgeKind,
    SiteGraphNode,
} from "./types";

// Same normalization the crawl route applies to a discovered URL
// (src/app/api/crawl/route.ts normalizeCrawlUrl/normalizePath): no query or
// hash, no trailing slash except the root. Edges and nodes must agree with
// the crawl's page identity or a graph node wouldn't match its crawled page.
export function pathOfUrl(url: string): string | null {
    try {
        const parsed = new URL(url);
        return parsed.pathname === "/" ? "/" : parsed.pathname.replace(/\/$/, "");
    } catch {
        return null;
    }
}

function originOf(url: string): string | null {
    try {
        return new URL(url).origin;
    } catch {
        return null;
    }
}

function embeddedEdgeKind(link: EmbeddedLinkDetail): SiteGraphEdgeKind | null {
    // form[action] and button/input[formaction] both submit a form.
    if (link.kind === "form" || (link.kind === "button" && link.attributeName === "formaction")) {
        return "form-submit";
    }

    // Navigation the DOM declares by something other than <a href>. Every
    // other embedded kind (script, stylesheet, image, iframe, media,
    // document) is a resource load, not a page-to-page navigation.
    if (link.kind === "interactive" || link.kind === "data") {
        return "action";
    }

    return null;
}

function linkEdge(link: LinkDetail): Omit<SiteGraphEdge, "from" | "to"> | null {
    // "anchor" is an in-page jump, "inert" has no destination, mailto/
    // download leave the page graph, "external" leaves the origin.
    if (link.linkType !== "internal") {
        return null;
    }

    return {
        kind: "link",
        text: link.text,
        rawValue: link.rawHref,
        tagName: "a",
        attributeName: "href",
        containerLabel: link.containerLabel,
    };
}

// Composes the graph from what inspectPages already captured per page:
// linkDetails (<a href>) and embeddedLinkDetails (form actions, formaction,
// onclick/data-href navigation). Only same-origin destinations become edges
// - a link out of the site isn't part of a walkable journey.
//
// A page may legitimately link to itself (the nav bar's "Home" on "/"); a
// plain link/action self-edge can never extend a path, so it's dropped. A
// form-submit self-edge is kept, since "submit this form, land on the same
// page" (a login that re-renders with an error) is real, observable
// structure - path search (TFP-089) is what decides not to revisit a node.
export function buildSiteGraph(baseUrl: string, pages: PageSnapshot[]): SiteGraph {
    const origin = originOf(baseUrl);
    const nodes = new Map<string, SiteGraphNode>();
    const edges = new Map<string, SiteGraphEdge>();

    for (const page of pages) {
        const path = pathOfUrl(page.url) ?? page.path;
        nodes.set(path, { path, url: page.url, title: page.title, inspected: true });
    }

    function addEdge(from: string, targetUrl: string, edge: Omit<SiteGraphEdge, "from" | "to">) {
        if (!origin || originOf(targetUrl) !== origin) {
            return;
        }

        const to = pathOfUrl(targetUrl);
        if (!to || (from === to && edge.kind !== "form-submit")) {
            return;
        }

        // The same element repeated on the same page (a footer link
        // duplicating a nav link) is one edge, not two.
        const key = [from, to, edge.kind, edge.rawValue, edge.text].join("\u0000");
        if (edges.has(key)) {
            return;
        }

        edges.set(key, { from, to, ...edge });

        if (!nodes.has(to)) {
            nodes.set(to, {
                path: to,
                url: new URL(to, origin).toString(),
                title: "",
                inspected: false,
            });
        }
    }

    for (const page of pages) {
        const from = pathOfUrl(page.url) ?? page.path;

        for (const link of page.linkDetails) {
            const edge = linkEdge(link);
            if (edge) {
                addEdge(from, link.url, edge);
            }
        }

        for (const embedded of page.embeddedLinkDetails) {
            const kind = embeddedEdgeKind(embedded);
            if (!kind) {
                continue;
            }

            addEdge(from, embedded.url, {
                kind,
                text: embedded.text,
                rawValue: embedded.rawValue,
                tagName: embedded.tagName,
                attributeName: embedded.attributeName,
                containerLabel: embedded.containerLabel,
            });
        }
    }

    return {
        nodes: [...nodes.values()].sort((left, right) => left.path.localeCompare(right.path)),
        edges: [...edges.values()],
    };
}
