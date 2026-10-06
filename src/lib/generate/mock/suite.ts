import { MAX_INSPECTION_PATHS } from "@/lib/introspect/paths";
import type { BestPracticeArea, ContentProfile, GeneratedSuite } from "./types";

/**
 * Phase 38 (TFP-147, TFP-148; Decision 4): the pages the shared conformance
 * checks cover in a Standard run - every inspected page, up to
 * MAX_INSPECTION_PATHS, in inspection order; "/" without page data.
 */
export function inspectedPagePaths(contentProfile: ContentProfile | null): string[] {
    const paths = [...new Set((contentProfile?.pages ?? []).map((page) => page.path))].slice(0, MAX_INSPECTION_PATHS);
    return paths.length > 0 ? paths : ["/"];
}

export const SUITE_AREA_CODES: Record<BestPracticeArea, string> = {
    functional: "FU",
    "responsive/mobile": "RM",
    "performance/load": "PL",
    security: "SC",
    accessibility: "AC",
    usability: "US",
    "seo/content": "SE",
    "cookie/session": "CS",
    database: "DB",
    reliability: "RL",
};

export const SUITE_TITLES: Record<BestPracticeArea, string> = {
    functional: "Functional Coverage",
    "responsive/mobile": "Responsive Coverage",
    "performance/load": "Performance Coverage",
    security: "Security Coverage",
    accessibility: "Accessibility Coverage",
    usability: "Usability Coverage",
    "seo/content": "SEO and Content Coverage",
    "cookie/session": "Cookie and Session Coverage",
    database: "Database Coverage",
    reliability: "Reliability Coverage",
};

export function createSuite(
    area: BestPracticeArea,
    tests: string[],
    notes?: string[]
): GeneratedSuite | null {
    if (tests.length === 0 && (!notes || notes.length === 0)) {
        return null;
    }

    return {
        area,
        title: SUITE_TITLES[area],
        tests,
        notes,
    };
}
