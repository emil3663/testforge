/**
 * Phase 40 Decisions 4, 5 and 6 (TFP-172): rank a site's page types and
 * choose the pages a run inspects, by type instead of crawl order.
 *
 * Decision 4, as revised at Gate A (Emil, 2026-10-07):
 * - **Always covered first:** home, every type with a form, and the type
 *   covering the most pages.
 * - **Then the ordered rules,** no weights: more pages of that type first;
 *   then more forms on its representative page; then more interactive
 *   elements on it; then crawl order. Each type records the rule that placed
 *   it below the type before it, so a drop is explained in one line.
 * - **The cap is hard.** When the always-covered types alone exceed it, they
 *   are ordered among themselves by the same rules and those that don't fit
 *   are skipped, named.
 * - **Dropped first when over the cap:** content types, then the lowest
 *   ranked. An always-covered type is never dropped for being content.
 * - **The representative page** is the type's page with the most
 *   interactive elements; ties go to crawl order.
 *
 * Decision 5: Standard covers one page of every type up to 8.
 * Decision 6: Comprehensive covers one page of every type, then spends the
 * rest of its page budget on the types with pages left, one more page per
 * type per round, in ranking order (so every type is covered before a
 * second page of any type).
 */

import type { PageOutline } from "./page-outline";

/** Decision 5 (Emil, 2026-10-07): Standard covers up to 8 page types. */
export const STANDARD_TYPE_CAP = 8;

export interface TypeToRank {
    pattern: string;
    label: string;
    /** The type's pages, in crawl order. */
    pages: string[];
    /** The pages' shared form signature (TFP-176); "" when unknown. */
    formSignature: string;
}

export type AlwaysCovered = "home" | "form" | "largest";
/**
 * What placed a type below the one ranked before it: one of the ordered
 * rules, or the group boundary ("always covered" types come first; "content
 * type" puts content types last, since they are dropped first).
 */
export type PlacingRule = "first" | "always covered" | "content type" | "pages" | "forms" | "interactive elements" | "crawl order";

export interface RankedPageType {
    pattern: string;
    label: string;
    pages: string[];
    /** The type's pages, representative first: most interactive elements, ties in crawl order. */
    pagesByInteractive: string[];
    representative: string;
    /** Forms and interactive elements on the representative page; 0 when its outline wasn't read. */
    forms: number;
    interactive: number;
    /** Why the type is always covered; null when the ordered rules alone place it. */
    alwaysCovered: AlwaysCovered[] | null;
    /** 1 is first. */
    rank: number;
    placedBy: PlacingRule;
    /** One line: what placed the type where it is. */
    placement: string;
}

const hasForm = (formSignature: string) => formSignature !== "" && formSignature !== "forms:0";

interface Keyed {
    type: TypeToRank;
    pagesByInteractive: string[];
    forms: number;
    interactive: number;
    crawlIndex: number;
}

/** The ordered rules, as comparisons: the first that differs decides. */
const RULES: Array<{ rule: PlacingRule; compare: (a: Keyed, b: Keyed) => number; say: (type: Keyed) => string }> = [
    { rule: "pages", compare: (a, b) => b.type.pages.length - a.type.pages.length, say: (type) => `${type.type.pages.length} page${type.type.pages.length === 1 ? "" : "s"}` },
    { rule: "forms", compare: (a, b) => b.forms - a.forms, say: (type) => `${type.forms} form${type.forms === 1 ? "" : "s"}` },
    { rule: "interactive elements", compare: (a, b) => b.interactive - a.interactive, say: (type) => `${type.interactive} interactive elements` },
    { rule: "crawl order", compare: (a, b) => a.crawlIndex - b.crawlIndex, say: (type) => `crawled ${ordinal(type.crawlIndex + 1)}` },
];

const byRules = (a: Keyed, b: Keyed) => {
    for (const { compare } of RULES) {
        const order = compare(a, b);
        if (order !== 0) return order;
    }
    return 0;
};

function ordinal(n: number) {
    const tens = n % 100;
    const suffix = tens >= 11 && tens <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
    return `${n}${suffix}`;
}

/** Decision 4: the types in coverage order - always covered, then the rest, content types last. */
export function rankPageTypes(types: TypeToRank[], outlineOf: (path: string) => PageOutline | undefined): RankedPageType[] {
    const interactiveOf = (path: string) => outlineOf(path)?.interactive ?? 0;
    const keyed: Keyed[] = types.map((type, crawlIndex) => {
        // A stable sort: ties keep crawl order.
        const pagesByInteractive = [...type.pages].sort((a, b) => interactiveOf(b) - interactiveOf(a));
        const outline = outlineOf(pagesByInteractive[0]);
        return { type, pagesByInteractive, forms: outline?.forms.length ?? 0, interactive: outline?.interactive ?? 0, crawlIndex };
    });
    const largest = [...keyed].sort(byRules)[0];
    const reasonsOf = (entry: Keyed): AlwaysCovered[] => [
        ...(entry.type.label === "home" ? ["home" as const] : []),
        ...(hasForm(entry.type.formSignature) ? ["form" as const] : []),
        ...(entry === largest ? ["largest" as const] : []),
    ];

    const rest = keyed.filter((entry) => reasonsOf(entry).length === 0);
    const groups: Array<{ boundary: PlacingRule; entries: Keyed[] }> = [
        { boundary: "always covered", entries: keyed.filter((entry) => reasonsOf(entry).length > 0).sort(byRules) },
        { boundary: "always covered", entries: rest.filter((entry) => entry.type.label !== "content").sort(byRules) },
        { boundary: "content type", entries: rest.filter((entry) => entry.type.label === "content").sort(byRules) },
    ];

    const ranked: RankedPageType[] = [];
    for (const [groupIndex, group] of groups.entries()) {
        group.entries.forEach((entry, index) => {
            const above = group.entries[index - 1];
            const reasons = reasonsOf(entry);
            let placedBy: PlacingRule;
            let placement: string;
            if (above) {
                const decisive = RULES.find(({ compare }) => compare(above, entry) !== 0) ?? RULES[RULES.length - 1];
                placedBy = decisive.rule;
                placement = `after ${above.type.pattern} by ${decisive.rule} (${decisive.say(entry)} against ${decisive.say(above)})`;
            } else if (ranked.length === 0) {
                placedBy = "first";
                placement = reasons.length > 0 ? "first of the always-covered types" : "first";
            } else if (group.boundary === "content type") {
                placedBy = "content type";
                placement = "after every other type: content types are dropped first";
            } else {
                placedBy = "always covered";
                placement = "after the always-covered types";
            }
            if (groupIndex === 0) placement = `always covered (${reasons.join(", ")}); ${placement}`;
            ranked.push({
                pattern: entry.type.pattern,
                label: entry.type.label,
                pages: entry.type.pages,
                pagesByInteractive: entry.pagesByInteractive,
                representative: entry.pagesByInteractive[0],
                forms: entry.forms,
                interactive: entry.interactive,
                alwaysCovered: reasons.length > 0 ? reasons : null,
                rank: ranked.length + 1,
                placedBy,
                placement,
            });
        });
    }
    return ranked;
}

export interface SkippedPageType extends RankedPageType {
    /** One line: the cap, and the rule that placed the type where the cap cut it off. */
    reason: string;
}

export interface PageTypeSelection {
    /** The page budget: types for Standard, pages for Comprehensive. */
    cap: number;
    /** Covered types, in rank order, each with the pages chosen from it. */
    covered: Array<RankedPageType & { selected: string[] }>;
    skipped: SkippedPageType[];
    /** Every chosen page, in the order a run inspects them. */
    pages: string[];
}

function skip(type: RankedPageType, cap: number, unit: string): SkippedPageType {
    return { ...type, reason: `over the cap of ${cap} ${unit}: ranked ${ordinal(type.rank)}; ${type.placement}` };
}

/** Decision 5: one page (the representative) of each type, in rank order, up to the cap. */
export function selectStandardPages(ranked: RankedPageType[], cap = STANDARD_TYPE_CAP): PageTypeSelection {
    const covered = ranked.slice(0, cap).map((type) => ({ ...type, selected: [type.representative] }));
    return {
        cap,
        covered,
        skipped: ranked.slice(cap).map((type) => skip(type, cap, "types")),
        pages: covered.map((type) => type.representative),
    };
}

/**
 * Decision 6: one page of every type first (types beyond the budget are
 * skipped, named); then the rest of the budget, one more page per type per
 * round, in rank order, each type's pages by most interactive elements.
 */
export function selectComprehensivePagesByType(ranked: RankedPageType[], budget: number): PageTypeSelection {
    const covered = ranked.slice(0, budget).map((type) => ({ ...type, selected: [type.representative] }));
    const pages = covered.map((type) => type.representative);
    for (let round = 1; pages.length < budget; round += 1) {
        const before = pages.length;
        for (const type of covered) {
            if (pages.length >= budget) break;
            const next = type.pagesByInteractive[round];
            if (next === undefined) continue;
            type.selected.push(next);
            pages.push(next);
        }
        if (pages.length === before) break;
    }
    // In rank order, each type's pages together.
    return { cap: budget, covered, skipped: ranked.slice(budget).map((type) => skip(type, budget, "pages")), pages: covered.flatMap((type) => type.selected) };
}
