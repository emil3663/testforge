/** Phase 40 Decision 7 (TFP-173): the page types a run covered and skipped. Re-exported from ./types. */

/** Phase 40 Decision 7 (TFP-173): one page type in the report. */
export interface PageTypeCoverageEntry {
    /** The address pattern: `/product/:id`, `/#/contact`. */
    pattern: string;
    /** Decision 3's report-only label. */
    label: string;
    /** How many crawled pages the type has. */
    pages: number;
    /** The full URL of the page that represented the type, as the address bar shows it. */
    url: string;
    /** Every page of the type the run covered, as full URLs; empty for a skipped type. */
    covered: string[];
    /** A skipped type: why, in one line. */
    reason?: string;
}

/** Phase 40 Decision 7 (TFP-173): which page types a run covered, and which it skipped. */
export interface PageTypeCoverageRecord {
    /**
     * "type": the pages chosen by type (Decisions 4 to 6); "user": chosen by
     * hand from the crawl, an override; "list": a list of pages pasted into
     * the URL field (Decision 8, TFP-174), so selection by type was skipped.
     */
    selectedBy: "type" | "user" | "list";
    runType: "standard" | "comprehensive";
    /** Standard's type cap (8) or Comprehensive's page budget. */
    cap: number;
    /** Types found by the crawl; 0 for a URL-field list run without a crawl of its site. */
    found: number;
    covered: PageTypeCoverageEntry[];
    skipped: PageTypeCoverageEntry[];
    /** A hand-made selection: full URLs added to, and left out of, what the type selection chose. */
    override?: { added: string[]; removed: string[] };
}
