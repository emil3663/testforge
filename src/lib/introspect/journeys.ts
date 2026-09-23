import { pathOfUrl } from "./site-graph";
import type { CandidateJourney, NamedFlow, SiteGraph, SiteGraphEdge } from "./types";

// Decision 6's starting defaults - explicitly meant to be retuned against
// real data, so they live here as named constants and nowhere else.
export const MAX_JOURNEY_HOPS = 6;
export const MAX_JOURNEYS = 20;

// Safety valve, not a product limit: automatic enumeration expands paths
// breadth-first (shortest first), so a densely cross-linked graph (every
// page's nav bar linking to every other) stops early having already found
// the shortest journeys, instead of walking every 6-hop permutation.
const MAX_EXPANDED_PATHS = 50_000;

type Adjacency = Map<string, Map<string, SiteGraphEdge[]>>;

interface PartialPath {
    nodes: string[];
    edges: SiteGraphEdge[];
}

function buildAdjacency(graph: SiteGraph): Adjacency {
    const adjacency: Adjacency = new Map();

    for (const edge of graph.edges) {
        const targets = adjacency.get(edge.from) ?? new Map<string, SiteGraphEdge[]>();
        targets.set(edge.to, [...(targets.get(edge.to) ?? []), edge]);
        adjacency.set(edge.from, targets);
    }

    return adjacency;
}

// Several elements can connect the same two pages (a nav link and a footer
// link). A journey is a page sequence (Decision 4 dedupes on it), so one
// edge per hop is chosen: the first in graph order, preferring a plain
// navigation over a form submit for a mid-path hop, and the form submit for
// the final hop.
function hopEdge(edges: SiteGraphEdge[]) {
    return edges.find((edge) => edge.kind !== "form-submit") ?? edges[0];
}

function submitEdge(edges: SiteGraphEdge[]) {
    return edges.find((edge) => edge.kind === "form-submit");
}

// Every simple path from `starts` of at most MAX_JOURNEY_HOPS hops whose
// last hop is a form-submit edge. A page may not be revisited, except that
// the final form-submit may land on the page it left (a contact form that
// posts to itself is a real journey, and a 1-hop one).
function enumerateSubmitPaths(adjacency: Adjacency, starts: string[]) {
    const found: PartialPath[] = [];
    let frontier: PartialPath[] = starts.map((node) => ({ nodes: [node], edges: [] }));
    let expanded = 0;
    let truncated = false;

    for (let hops = 1; hops <= MAX_JOURNEY_HOPS && frontier.length > 0 && !truncated; hops++) {
        const next: PartialPath[] = [];

        for (const partial of frontier) {
            const node = partial.nodes[partial.nodes.length - 1];

            for (const [to, edges] of adjacency.get(node) ?? []) {
                const submit = submitEdge(edges);
                const revisits = partial.nodes.includes(to);

                if (submit && (!revisits || to === node)) {
                    found.push({ nodes: [...partial.nodes, to], edges: [...partial.edges, submit] });
                }

                if (hops < MAX_JOURNEY_HOPS && !revisits) {
                    next.push({ nodes: [...partial.nodes, to], edges: [...partial.edges, hopEdge(edges)] });
                }

                if (++expanded >= MAX_EXPANDED_PATHS) {
                    truncated = true;
                }
            }
        }

        frontier = next;
    }

    return { found, truncated };
}

// Shortest page sequence from entry to exit, unbounded, so a path that
// exists but is longer than the cap can be told apart from no path at all.
function shortestPath(adjacency: Adjacency, entry: string, exit: string): PartialPath | null {
    const seen = new Set([entry]);
    let frontier: PartialPath[] = [{ nodes: [entry], edges: [] }];

    while (frontier.length > 0) {
        const next: PartialPath[] = [];

        for (const partial of frontier) {
            const node = partial.nodes[partial.nodes.length - 1];

            for (const [to, edges] of adjacency.get(node) ?? []) {
                if (seen.has(to)) {
                    continue;
                }

                const extended = { nodes: [...partial.nodes, to], edges: [...partial.edges, hopEdge(edges)] };
                if (to === exit) {
                    return extended;
                }

                seen.add(to);
                next.push(extended);
            }
        }

        frontier = next;
    }

    return null;
}

function pathKey(path: string[]) {
    return path.join(" > ");
}

function journeyId(source: string, label: string | null, path: string[]) {
    return [source, label ?? "", pathKey(path)].join("|");
}

function normalizeFlowPath(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }

    return pathOfUrl(new URL(trimmed.startsWith("/") ? trimmed : `/${trimmed}`, "http://flow.invalid").toString());
}

// Re-validates the optional config list (request body): a flow needs a
// label and both paths; anything else is dropped.
export function normalizeNamedFlows(input: unknown): NamedFlow[] {
    if (!Array.isArray(input)) {
        return [];
    }

    return input.flatMap((item) => {
        if (!item || typeof item !== "object") {
            return [];
        }

        const { label, entryPath, exitPath } = item as Record<string, unknown>;
        const entry = typeof entryPath === "string" ? normalizeFlowPath(entryPath) : null;
        const exit = typeof exitPath === "string" ? normalizeFlowPath(exitPath) : null;

        return typeof label === "string" && label.trim() && entry && exit
            ? [{ label: label.trim(), entryPath: entry, exitPath: exit }]
            : [];
    });
}

// TFP-089. Automatic candidates: every path through the graph ending in a
// form-submit action. Named candidates: one per config-named flow, resolved
// per Decision 4 and its amendment. A named flow outranks an automatic one
// over the same page sequence, which is then surfaced once; the rest of the
// automatic list ranks shorter-first.
export function identifyJourneys(graph: SiteGraph, namedFlows: NamedFlow[] = []) {
    const adjacency = buildAdjacency(graph);
    const nodePaths = new Set(graph.nodes.map((node) => node.path));
    const warnings: string[] = [];
    const named: CandidateJourney[] = [];

    for (const flow of namedFlows) {
        if (!nodePaths.has(flow.entryPath) || !adjacency.has(flow.entryPath)) {
            warnings.push(
                `Named flow "${flow.label}": entry ${flow.entryPath} ${nodePaths.has(flow.entryPath) ? "was not introspected, so no element leaves it" : "is not a page in the site graph"}.`
            );
            continue;
        }

        const toExit = nodePaths.has(flow.exitPath) ? shortestPath(adjacency, flow.entryPath, flow.exitPath) : null;

        if (toExit) {
            if (toExit.edges.length > MAX_JOURNEY_HOPS) {
                warnings.push(
                    `Named flow "${flow.label}": the shortest path from ${flow.entryPath} to ${flow.exitPath} is ${toExit.edges.length} hops, over the ${MAX_JOURNEY_HOPS}-hop limit; excluded.`
                );
                continue;
            }

            named.push({
                id: journeyId("named", flow.label, toExit.nodes),
                source: "named",
                label: flow.label,
                path: toExit.nodes,
                steps: toExit.edges,
                declaredExitPath: flow.exitPath,
                exitInGraph: true,
                rank: 0,
            });
            continue;
        }

        // Decision 4's amendment: the graph can't reach exitPath (introspect
        // never submits a form), so match as far as a form-submit and carry
        // exitPath as declared, unverified.
        const { found } = enumerateSubmitPaths(adjacency, [flow.entryPath]);
        if (found.length === 0) {
            warnings.push(
                `Named flow "${flow.label}": ${flow.exitPath} is not reachable in the graph and no form submit is reachable from ${flow.entryPath} within ${MAX_JOURNEY_HOPS} hops; excluded.`
            );
            continue;
        }

        for (const path of found) {
            named.push({
                id: journeyId("named", flow.label, path.nodes),
                source: "named",
                label: flow.label,
                path: path.nodes,
                steps: path.edges,
                declaredExitPath: flow.exitPath,
                exitInGraph: false,
                rank: 0,
            });
        }
    }

    const { found, truncated } = enumerateSubmitPaths(adjacency, [...adjacency.keys()].sort());
    if (truncated) {
        warnings.push(
            `Journey search stopped after ${MAX_EXPANDED_PATHS} expanded paths; the shortest journeys were found first, but the automatic list may be incomplete.`
        );
    }

    const namedKeys = new Set(named.map((journey) => pathKey(journey.path)));
    const automatic: CandidateJourney[] = found
        .filter((path) => !namedKeys.has(pathKey(path.nodes)))
        .map((path) => ({
            id: journeyId("automatic", null, path.nodes),
            source: "automatic" as const,
            label: null,
            path: path.nodes,
            steps: path.edges,
            declaredExitPath: null,
            exitInGraph: false,
            rank: 0,
        }))
        .sort((left, right) =>
            left.steps.length - right.steps.length || pathKey(left.path).localeCompare(pathKey(right.path))
        );

    // Named in config order, shortest first within one flow; then automatic.
    const flowOrder = new Map(namedFlows.map((flow, index) => [flow.label, index]));
    named.sort((left, right) =>
        (flowOrder.get(left.label ?? "") ?? 0) - (flowOrder.get(right.label ?? "") ?? 0) ||
        left.steps.length - right.steps.length
    );

    const journeys = [...named, ...automatic]
        .slice(0, MAX_JOURNEYS)
        .map((journey, index) => ({ ...journey, rank: index + 1 }));

    if (named.length + automatic.length > MAX_JOURNEYS) {
        warnings.push(`${named.length + automatic.length} candidate journeys found; showing the top ${MAX_JOURNEYS}.`);
    }

    return { journeys, warnings };
}
