import type { SiteSuiteRecord } from "./types";

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/**
 * Phase 42 (TFP-190): what the run took from the site's saved suite. One
 * sentence (two when hand-edited tests sit on changed pages) for the app's
 * report and the HTML export alike.
 */
export function describeSiteSuite(record: SiteSuiteRecord): string {
    if (record.firstRun) return `Site suite: first run for this site and suite type, so all ${plural(record.generated, "test")} were generated and saved in ${record.store}.`;
    const parts = [`${plural(record.reused, "test")} reused`, `${record.generated} generated`];
    parts.push(record.regenerated > 0 ? `${record.regenerated} regenerated (page types changed: ${record.changedTypes.join(", ") || "the site's set of page types"})` : "0 regenerated");
    parts.push(record.retired > 0 ? `${record.retired} retired${record.goneTypes.length > 0 ? ` (page types gone: ${record.goneTypes.join(", ")})` : ""}` : "0 retired");
    if (record.edited > 0) parts.push(`${record.edited} edited by hand and kept`);
    const newTypes = record.newTypes.length > 0 ? `; new page types: ${record.newTypes.join(", ")}` : "";
    const flagged = record.editedOnChangedPages.length > 0 ? ` Edited by hand, on a page that changed - check these: ${record.editedOnChangedPages.join("; ")}.` : "";
    return `Site suite: ${parts.join(", ")}${newTypes} (saved in ${record.store}).${flagged}`;
}
