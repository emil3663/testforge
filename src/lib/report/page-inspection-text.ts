import type { PageInspectionRecord } from "./types";

/**
 * Phase 34 TFP-122: how the suite got its page data, when TestForge gathered
 * it itself. One sentence for the app's report and the HTML export alike.
 */
export function describePageInspection(record: PageInspectionRecord): string {
    const paths = record.paths.join(", ");
    if (record.status === "inspected") {
        const partial = record.warnings.length > 0 ? ` Not inspected: ${record.warnings.join("; ")}.` : "";
        return `No page data was supplied, so TestForge inspected ${paths} automatically (${record.pages} ${record.pages === 1 ? "page" : "pages"}) and generated from it.${partial}`;
    }
    return `No page data was supplied and automatic inspection of ${paths} failed (${record.reason ?? "no page could be inspected"}), so the suite was generated without page data.`;
}
