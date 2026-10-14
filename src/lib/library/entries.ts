import type { ContentProfile, ContentProfilePage } from "@/lib/generate/mock/types";
import { inspectedPagePaths } from "@/lib/generate/mock/suite";
import { anyPage, hasFilterField, hasNumberField, hasSelect, hasSortSelect } from "./patterns";

/**
 * Phase 42 (TFP-193, Decision 2): the library - tests written for a
 * component pattern, not a site, reviewed in the repo like code. Seeded
 * with Phase 41's checks.
 *
 * An entry says what it is for and what it has proved; applying it means
 * matching its pattern against the pages inspection found and binding the
 * check to those pages (or, for a site binding, to the run). The check's
 * code stays with its generator (`builder`), which asks the library which
 * pages each entry applies to.
 *
 * `caught` is the benchmark bugs each check found on the local Toolshop
 * with-bugs copy at Phase 41's Gate B (TFP-188, the keep-rule table in the
 * Phase 41 record), by the answer key's numbers
 * (benchmarks/2026-10-06-toolshop-known-bugs/answer-key.md).
 */

export type LibraryBinding = "page" | "site";

export interface LibraryEntry {
    id: string;
    /** The test's title, as written (with `<page>` for the bound page's path). */
    title: string;
    /** The ticket that wrote the check. */
    ticket: string;
    /** The component pattern, in words. */
    pattern: string;
    /** Whether a page has the pattern, from what inspection recorded. */
    matches: (page: ContentProfilePage) => boolean;
    /** "page": a test on each matching page. "site": one test per run, once enough pages match. */
    binding: LibraryBinding;
    /** A site entry's fewest matching pages (default 1). */
    minPages?: number;
    /** The ISTQB technique the check applies. */
    technique: string;
    /** The gate it runs behind. Every Phase 41 check is read-only (the interacting ones under TFP-181's request guard). */
    gate: "read-only";
    /** Where it runs: Standard's area, or a Comprehensive area. */
    runsIn: string[];
    /** The benchmark bugs it has caught. */
    caught: { benchmark: string; bugs: number[] };
    /** The generator function that writes it. */
    builder: string;
}

const TOOLSHOP = "Toolshop with-bugs, local, Phase 41 Gate B (TFP-188)";

export const LIBRARY: readonly LibraryEntry[] = [
    {
        id: "controls.sort",
        title: "sort options order the items on <page>",
        ticket: "TFP-182",
        pattern: "a list whose options name two orders or more",
        matches: hasSortSelect,
        binding: "page",
        technique: "decision table (each sort option's label sets the expected order)",
        gate: "read-only",
        runsIn: ["Standard functional"],
        caught: { benchmark: TOOLSHOP, bugs: [2] },
        builder: "src/lib/generate/mock/controls.ts buildControlTests",
    },
    {
        id: "controls.filters",
        title: "filters send and respect the chosen values on <page>",
        ticket: "TFP-182",
        pattern: "a checkbox or a range field",
        matches: hasFilterField,
        binding: "page",
        technique: "boundary value analysis (one step in from each handle's value)",
        gate: "read-only",
        runsIn: ["Standard functional"],
        caught: { benchmark: TOOLSHOP, bugs: [27] },
        builder: "src/lib/generate/mock/controls.ts buildControlTests",
    },
    {
        id: "controls.steppers",
        title: "quantity steppers change the value by one on <page>",
        ticket: "TFP-182",
        pattern: "a number field",
        matches: hasNumberField,
        binding: "page",
        technique: "state transition (n, n + 1, n, within the field's bounds)",
        gate: "read-only",
        runsIn: ["Standard functional"],
        caught: { benchmark: TOOLSHOP, bugs: [40] },
        builder: "src/lib/generate/mock/controls.ts buildControlTests",
    },
    {
        id: "controls.option-lists",
        title: "option lists show no error text on <page>",
        ticket: "TFP-182",
        pattern: "a list",
        matches: hasSelect,
        binding: "page",
        technique: "error guessing",
        gate: "read-only",
        runsIn: ["Standard functional"],
        caught: { benchmark: TOOLSHOP, bugs: [60] },
        builder: "src/lib/generate/mock/controls.ts buildControlTests",
    },
    {
        id: "controls.link-destination",
        title: "navigation links land where their text says, from <page>",
        ticket: "TFP-182",
        pattern: "a header or nav link, from the run's first page",
        matches: anyPage,
        binding: "site",
        technique: "decision table (a \"Home\" link must reach the start page; any other must share a word with where it lands)",
        gate: "read-only",
        runsIn: ["Standard functional"],
        caught: { benchmark: TOOLSHOP, bugs: [29] },
        builder: "src/lib/generate/mock/controls.ts buildControlTests",
    },
    {
        id: "keyboard.tab-order",
        title: "<page> is tabbed through in reading order",
        ticket: "TFP-183",
        pattern: "a page with fields to tab through (the check skips one without)",
        matches: anyPage,
        binding: "page",
        technique: "decision table (fields in reading order; positive tabindex; laid out against the reading order)",
        gate: "read-only",
        runsIn: ["Standard accessibility", "Comprehensive accessibility"],
        caught: { benchmark: TOOLSHOP, bugs: [53] },
        builder: "src/lib/generate/comprehensive-accessibility.ts keyboardAndGroupingTests",
    },
    {
        id: "keyboard.grouping",
        title: "<page> groups its checkboxes and radio buttons",
        ticket: "TFP-183",
        pattern: "a page with checkboxes or radio buttons (the check skips one without)",
        matches: anyPage,
        binding: "page",
        technique: "decision table (choices in a fieldset or a named group, or not)",
        gate: "read-only",
        runsIn: ["Standard accessibility", "Comprehensive accessibility"],
        caught: { benchmark: TOOLSHOP, bugs: [94] },
        builder: "src/lib/generate/comprehensive-accessibility.ts keyboardAndGroupingTests",
    },
    {
        id: "probes.known-paths",
        title: "known paths that leak",
        ticket: "TFP-184",
        pattern: "a site and the API hosts its first page calls",
        matches: anyPage,
        binding: "site",
        technique: "decision table (whether a known path leaks, and where)",
        gate: "read-only",
        runsIn: ["Comprehensive security"],
        caught: { benchmark: TOOLSHOP, bugs: [80] },
        builder: "src/lib/generate/security-probes.ts knownPathsTest",
    },
    {
        id: "probes.guessable-ids",
        title: "<page> uses no guessable sequential ids in its addresses (recorded as a finding)",
        ticket: "TFP-184",
        pattern: "a page whose links carry ids in their addresses (the check finds them at run time)",
        matches: anyPage,
        binding: "page",
        technique: "decision table (integer ids counting up, or not)",
        gate: "read-only",
        runsIn: ["Comprehensive security"],
        caught: { benchmark: TOOLSHOP, bugs: [82] },
        builder: "src/lib/generate/security-probes.ts guessableIdsTest",
    },
    {
        id: "api.internal-fields",
        title: "<page> fetches no internal fields it never shows (recorded as a finding)",
        ticket: "TFP-185",
        pattern: "a page that draws from its own API (the check reads the responses at run time)",
        matches: anyPage,
        binding: "page",
        technique: "decision table (what the API items carry beyond what the page shows)",
        gate: "read-only",
        runsIn: ["Comprehensive security"],
        caught: { benchmark: TOOLSHOP, bugs: [75] },
        builder: "src/lib/generate/api-fields.ts apiFieldsTest",
    },
    {
        id: "layout.consistency",
        title: "<page> keeps its forms, lists and cards consistent (recorded as findings)",
        ticket: "TFP-186",
        pattern: "a form, a list or a set of cards (the check skips a page without)",
        matches: anyPage,
        binding: "page",
        technique: "equivalence partitioning (each group's members should look alike)",
        gate: "read-only",
        runsIn: ["Standard usability"],
        caught: { benchmark: TOOLSHOP, bugs: [4, 19, 26, 59, 63, 67] },
        builder: "src/lib/generate/mock/layout.ts buildLayoutTests",
    },
    {
        id: "layout.overlap",
        title: "<page> has no overlapping controls",
        ticket: "TFP-186",
        pattern: "any page with controls",
        matches: anyPage,
        binding: "page",
        technique: "boundary value analysis (boxes that touch or share a border against boxes that overlap)",
        gate: "read-only",
        runsIn: ["Standard usability"],
        caught: { benchmark: TOOLSHOP, bugs: [45] },
        builder: "src/lib/generate/mock/layout.ts buildLayoutTests",
    },
    {
        id: "layout.images",
        title: "<page> shows every image it loads",
        ticket: "TFP-186",
        pattern: "any page with images",
        matches: anyPage,
        binding: "page",
        // Gate B: no present target of its own (26 is the consistency check's); it fails 28 and 30, found by older checks. Kept (Emil).
        technique: "error guessing (an image that loaded but can't be shown)",
        gate: "read-only",
        runsIn: ["Standard usability"],
        caught: { benchmark: TOOLSHOP, bugs: [] },
        builder: "src/lib/generate/mock/layout.ts buildLayoutTests",
    },
    {
        id: "layout.across-pages",
        title: "the same components look the same on every inspected page (recorded as findings)",
        ticket: "TFP-186",
        pattern: "components shared by two inspected pages or more",
        matches: anyPage,
        binding: "site",
        minPages: 2,
        technique: "equivalence partitioning (one component on different pages is one partition)",
        gate: "read-only",
        runsIn: ["Standard usability"],
        caught: { benchmark: TOOLSHOP, bugs: [4, 58, 66] },
        builder: "src/lib/generate/mock/layout.ts buildLayoutTests",
    },
    {
        id: "spelling",
        title: "<page> spells its interface text correctly (recorded as findings)",
        ticket: "TFP-187",
        pattern: "a page with English interface text (the check skips another language)",
        matches: anyPage,
        binding: "page",
        technique: "error guessing (the slips that reach an interface)",
        gate: "read-only",
        runsIn: ["Standard seo/content"],
        caught: { benchmark: TOOLSHOP, bugs: [31, 33, 34, 42, 62] },
        builder: "src/lib/generate/mock/spelling.ts buildSpellingTests",
    },
];

export function libraryEntry(id: string): LibraryEntry {
    const entry = LIBRARY.find((candidate) => candidate.id === id);
    if (!entry) throw new Error(`no library entry "${id}"`);
    return entry;
}

/**
 * Applying an entry: does it bind to this page? A page inspection didn't
 * record (a Comprehensive page known only by its path) matches an entry for
 * any page, and nothing narrower.
 */
export function entryApplies(id: string, page: ContentProfilePage | undefined): boolean {
    const entry = libraryEntry(id);
    return page ? entry.matches(page) : entry.matches === anyPage;
}

/** The inspected pages an entry binds to, in inspection order ("/" when the run has no page data); none when a site entry has too few. */
export function boundPaths(id: string, contentProfile: ContentProfile | null): string[] {
    const entry = libraryEntry(id);
    const pages = contentProfile?.pages ?? [];
    const paths = inspectedPagePaths(contentProfile).filter((path) => entryApplies(id, pages.find((page) => page.path === path)));
    return paths.length >= (entry.minPages ?? 1) ? paths : [];
}
