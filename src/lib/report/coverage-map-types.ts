/**
 * Phase 42: the coverage map in a run's report (TFP-192, TFP-201).
 * Re-exported from ./types.
 */

/** Phase 42 (TFP-192, Decision 3): each element and flow the inspection found, and the tests that touch it (src/lib/report/coverage-map.ts). */
export type CoverageMapKind = "element" | "link" | "flow";

export interface CoverageMapEntry {
    /** Stable across runs while the item is the same: an element's page and locator; a link's text and target; a flow's journey. */
    key: string;
    /** The first page it is on. */
    page: string;
    /** TFP-201: every page it is on - a link repeated across pages (header, footer) is one item. Absent on maps from before TFP-201. */
    pages?: string[];
    kind: CoverageMapKind;
    /** What a person reads: "Subject [input]", "Home [link]", "journey ...". */
    name: string;
    /** The full titles (with ids) of the tests that touch it in context: found and checked on its page (Gate A ruling 1). */
    tests: string[];
    /** TFP-201: a link's reachability tier - tests that request its URL without finding it on a page. */
    reachedBy?: string[];
}

export interface CoverageMapType {
    pattern: string;
    pages: number;
    total: number;
    /** Checked in context. */
    covered: number;
    /** TFP-201: not checked in context, but its URL requested. */
    reachedOnly?: number;
    /** Each item not checked in context, "page: name" (the gap list). */
    uncovered: string[];
}

export interface CoverageMap {
    entries: CoverageMapEntry[];
    types: CoverageMapType[];
    total: number;
    /** Checked in context. */
    covered: number;
    /** TFP-201: not checked in context, but its URL requested. */
    reachedOnly?: number;
    /** TFP-201: links as found on each page, and as distinct items. */
    links?: { onPages: number; distinct: number };
}
