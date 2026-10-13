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
    return `Site suite: ${parts.join(", ")}${newTypes} (saved in ${record.store}).${flagged}${describeRecheck(record)}`;
}

/** TFP-191: what reading the failing reused tests' pages again found, after the run. */
function describeRecheck(record: SiteSuiteRecord): string {
    const recheck = record.recheck;
    if (!recheck || recheck.failedReused === 0) return "";
    const sentences = recheck.regenerations.map((regeneration) => {
        const changes = regeneration.pages.map((page) => `${page.path}: ${page.before} -> ${page.after}`).join("; ");
        return ` ${regeneration.type} changed since its tests were saved (${changes}), so ${plural(regeneration.failed.length, "failing reused test")} (${regeneration.failed.join("; ")}) and the rest of its tests were regenerated from a fresh inspection and re-run: ${regeneration.passed} passed, ${regeneration.failedAgain} failed of ${regeneration.rerun}. Only the re-run's results are reported.`;
    });
    const unchanged = recheck.unchanged > 0 ? ` ${plural(recheck.unchanged, "failing reused test")} ${recheck.unchanged === 1 ? "is" : "are"} on ${recheck.unchanged === 1 ? "a page" : "pages"} that has not changed: reported as ${recheck.unchanged === 1 ? "it is" : "they are"}.` : "";
    return `${sentences.join("")}${unchanged}`;
}
