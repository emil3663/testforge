/**
 * Phase 40 Decision 7 (TFP-173): which page types a run covered and which it
 * skipped, for the report. Built when the run's pages came from a crawl,
 * from the crawl's ranking and the pages actually sent to inspection.
 *
 * - Chosen by type (the default): covered and skipped are Decision 5's or
 *   6's selection, each skip with the one-line reason TFP-172 recorded.
 * - A list of pages from the URL field (Decision 8, TFP-174): "pages chosen
 *   by the user". Selection by type is skipped. With a crawl of the site, the
 *   report still says which types the list covered and which it left out; a
 *   listed page the crawl didn't find is its own entry. Without a crawl,
 *   each page is its own entry and no type is named.
 * - Chosen by hand: an override, recorded as such. A type is covered when
 *   any of its pages was chosen; a skipped type says it wasn't chosen and
 *   whether the type selection would have covered it. The pages added to
 *   and left out of the type selection are listed.
 *
 * Every page is named by its full URL as the address bar shows it
 * (`https://with-bugs.practicesoftwaretesting.com/#/product/1`), so the
 * covered list can be pasted back into the URL field (TFP-174).
 */

import type { RunMode } from "@/lib/comprehensive/run-mode";
import type { PageTypeCoverageEntry, PageTypeCoverageRecord } from "@/lib/report/types";
import { selectComprehensivePagesByType, selectStandardPages, type RankedPageType } from "./select";

export interface CoverageInput {
    baseUrl: string;
    /** The crawl's pages, for their full URLs. */
    pages: Array<{ path: string; url: string }>;
    /** The crawl's ranking; empty for a URL-field list without a crawl of its site. */
    rankedTypes: RankedPageType[];
    runMode: RunMode;
    /** The pages sent to inspection, in order. */
    selectedPaths: string[];
    selectedBy: "type" | "user" | "list";
}

export function buildPageTypeCoverage(input: CoverageInput): PageTypeCoverageRecord {
    const urls = new Map(input.pages.map((page) => [page.path, page.url]));
    const urlOf = (path: string) => {
        const known = urls.get(path);
        if (known) return known;
        try {
            return new URL(path, input.baseUrl).toString();
        } catch {
            return path;
        }
    };
    const selection = input.runMode.kind === "comprehensive"
        ? selectComprehensivePagesByType(input.rankedTypes, input.runMode.pageCap)
        : selectStandardPages(input.rankedTypes);
    const entry = (type: RankedPageType, covered: string[], reason?: string): PageTypeCoverageEntry => ({
        pattern: type.pattern,
        label: type.label,
        pages: type.pages.length,
        url: urlOf(covered[0] ?? type.representative),
        covered: covered.map(urlOf),
        ...(reason ? { reason } : {}),
    });
    const base = { runType: input.runMode.kind, cap: selection.cap, found: input.rankedTypes.length } as const;

    if (input.selectedBy === "type") {
        return {
            selectedBy: "type",
            ...base,
            covered: selection.covered.map((type) => entry(type, type.selected)),
            skipped: selection.skipped.map((type) => entry(type, [], type.reason)),
        };
    }

    if (input.selectedBy === "list") {
        const covered: PageTypeCoverageEntry[] = [];
        const skipped: PageTypeCoverageEntry[] = [];
        for (const type of input.rankedTypes) {
            const picked = input.selectedPaths.filter((path) => type.pages.includes(path));
            if (picked.length > 0) covered.push(entry(type, picked));
            else skipped.push(entry(type, [], "not in the list of pages"));
        }
        const typed = new Set(input.rankedTypes.flatMap((type) => type.pages));
        for (const path of input.selectedPaths.filter((page) => !typed.has(page))) {
            covered.push({ pattern: path, label: "page", pages: 1, url: urlOf(path), covered: [urlOf(path)] });
        }
        // In the order the list named them.
        const at = (item: PageTypeCoverageEntry) => input.selectedPaths.findIndex((path) => urlOf(path) === item.covered[0]);
        covered.sort((a, b) => at(a) - at(b));
        return { selectedBy: "list", ...base, cap: input.selectedPaths.length, covered, skipped };
    }

    const chosen = new Set(input.selectedPaths);
    const skippedByType = new Map(selection.skipped.map((type) => [type.pattern + "\n" + type.representative, type.reason]));
    const covered: PageTypeCoverageEntry[] = [];
    const skipped: PageTypeCoverageEntry[] = [];
    for (const type of input.rankedTypes) {
        // The type's chosen pages, in the order they were chosen.
        const picked = input.selectedPaths.filter((path) => type.pages.includes(path));
        if (picked.length > 0) {
            covered.push(entry(type, picked));
            continue;
        }
        const typeReason = skippedByType.get(type.pattern + "\n" + type.representative);
        skipped.push(entry(type, [], typeReason
            ? `not chosen by hand; the type selection would also have skipped it (${typeReason})`
            : "not chosen by hand; the type selection would have covered it"));
    }
    const typePages = new Set(selection.pages);
    return {
        selectedBy: "user",
        ...base,
        covered,
        skipped,
        override: {
            added: input.selectedPaths.filter((path) => !typePages.has(path)).map(urlOf),
            removed: selection.pages.filter((path) => !chosen.has(path)).map(urlOf),
        },
    };
}
