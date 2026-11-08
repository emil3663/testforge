import type { DroppedJourney } from "@/lib/generate/journey-check";

/** TFP-271: the generate response's `droppedJourneys`, kept only where each entry is an id and a reason. */
export function readDroppedJourneys(data: unknown): DroppedJourney[] {
    const list = data && typeof data === "object" ? (data as { droppedJourneys?: unknown }).droppedJourneys : undefined;
    if (!Array.isArray(list)) return [];
    return list.filter((item): item is DroppedJourney =>
        !!item && typeof item === "object" && typeof item.id === "string" && typeof item.reason === "string");
}

/** A journey as the review screen names it: its pages, after its label for a named flow (ids read `source|label|pages`). */
export function journeyName(id: string): string {
    const [, label, pages] = id.split("|");
    if (pages === undefined) return id;
    return label ? `${label}: ${pages}` : pages;
}

/** The notice's heading, in plain words. */
export function droppedJourneysHeading(count: number): string {
    return count === 1
        ? "1 selected journey got no test:"
        : `${count} selected journeys got no test:`;
}
