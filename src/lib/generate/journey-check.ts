import type { CandidateJourney, SiteGraph, SiteGraphEdgeKind } from "@/lib/generate/mock";

export const SITE_GRAPH_EDGE_KINDS = new Set<string>(["link", "form-submit", "action"]);

// TFP-268: order and repeats kept, for a journey's path, where a page visited
// twice is two entries.
export function normalizeStringSequence(input: unknown) {
    if (!Array.isArray(input)) {
        return [] as string[];
    }

    return input
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.replace(/\s+/g, " ").trim())
        .filter(Boolean);
}

/** TFP-271: a selected journey the route couldn't keep, and why, in words a tester reads. */
export type DroppedJourney = { id: string; reason: string };

type Checked = { journey: CandidateJourney } | { reason: string };

// TFP-089: journeys are derived server-side from the graph; this only
// re-validates the round-tripped JSON. A journey whose steps don't line up
// with its page sequence is dropped rather than repaired. TFP-271: each way
// of failing has its reason, so a selected one dropped can say why.
function checkJourney(item: unknown, graph: SiteGraph): Checked {
    if (!item || typeof item !== "object") {
        return { reason: "it isn't a journey" };
    }

    const journey = item as Record<string, unknown>;
    const path = normalizeStringSequence(journey.path);
    const steps = graph.edges.length > 0 && Array.isArray(journey.steps)
        ? journey.steps.filter((step): step is Record<string, unknown> => !!step && typeof step === "object")
        : [];
    const known = new Set(graph.edges.map((edge) => [edge.from, edge.to, edge.kind, edge.rawValue, edge.text].join("\u0000")));
    const stepEdges = steps.map((step) => ({
        from: typeof step.from === "string" ? step.from : "",
        to: typeof step.to === "string" ? step.to : "",
        kind: (typeof step.kind === "string" && SITE_GRAPH_EDGE_KINDS.has(step.kind) ? step.kind : "link") as SiteGraphEdgeKind,
        text: typeof step.text === "string" ? step.text.replace(/\s+/g, " ").trim() : "",
        rawValue: typeof step.rawValue === "string" ? step.rawValue : "",
        tagName: typeof step.tagName === "string" ? step.tagName.trim() : "",
        attributeName: typeof step.attributeName === "string" ? step.attributeName.trim() : "",
        containerLabel: typeof step.containerLabel === "string" ? step.containerLabel.replace(/\s+/g, " ").trim() : "",
    }));

    if (typeof journey.id !== "string" || (journey.source !== "automatic" && journey.source !== "named")) {
        return { reason: "it has no valid id or source" };
    }
    if (path.length < 2) {
        return { reason: "its path has fewer than two pages" };
    }
    if (graph.edges.length === 0) {
        return { reason: "the page data has no site graph to check its steps against" };
    }
    const lined = stepEdges.length === path.length - 1 && stepEdges.every((step, index) => step.from === path[index] && step.to === path[index + 1]);
    if (!lined) {
        return { reason: "its steps don't match its path" };
    }
    if (!stepEdges.every((step) => known.has([step.from, step.to, step.kind, step.rawValue, step.text].join("\u0000")))) {
        return { reason: "a step isn't in the site graph" };
    }

    return {
        journey: {
            id: journey.id,
            source: journey.source,
            label: typeof journey.label === "string" ? journey.label : null,
            path,
            steps: stepEdges,
            declaredExitPath: typeof journey.declaredExitPath === "string" ? journey.declaredExitPath : null,
            exitInGraph: Boolean(journey.exitInGraph),
            rank: typeof journey.rank === "number" && journey.rank > 0 ? journey.rank : 0,
        },
    };
}

export function normalizeJourneys(input: unknown, graph: SiteGraph): CandidateJourney[] {
    if (!Array.isArray(input)) {
        return [];
    }
    return input.flatMap((item) => {
        const checked = checkJourney(item, graph);
        return "journey" in checked ? [checked.journey] : [];
    });
}

/**
 * TFP-271: why each of the given selected ids got no journey. `input` is the journeys as the request carried them,
 * `graph` the normalized site graph they're checked against.
 */
export function explainDroppedJourneys(input: unknown, graph: SiteGraph, ids: string[]): DroppedJourney[] {
    const items = Array.isArray(input) ? input : [];
    return ids.map((id) => {
        const item = items.find((candidate) => !!candidate && typeof candidate === "object" && (candidate as { id?: unknown }).id === id);
        if (!item) {
            return { id, reason: "it isn't in the page data this suite was generated from" };
        }
        const checked = checkJourney(item, graph);
        return { id, reason: "reason" in checked ? checked.reason : "it was dropped for a reason not recorded" };
    });
}
