import {
    buildAccessibilityElementTitle,
    buildActionableElementTitle,
    getActionableElementDisplayName,
    resolveLinkAuditPaths,
    findMatchingProfilePage,
} from "@/lib/generate/mock/locators";
import type { ActionableElementDetail, ContentProfile, ContentProfilePage } from "@/lib/generate/mock/types";
import { AREA_LABELS } from "./execution";
import { inferCoverageAreas } from "./coverage";
import type { CoverageMatrixItem, ExecutionRecord, NotTestedElement } from "./types";

// Mirrors buildActionableElementTests'/buildAccessibilityElementTests' own
// .slice(0, 50) sampling cap - an element beyond it never gets a test
// generated, which is a known, named generator limit, not a gap.
const GENERATOR_ELEMENT_CAP = 50;

export type ElementTrackedArea = "functional" | "accessibility";
const ELEMENT_TRACKED_AREAS: ElementTrackedArea[] = ["functional", "accessibility"];

export interface DiscoveredElementMatch {
    area: ElementTrackedArea;
    path: string;
    element: ActionableElementDetail;
    title: string;
    tested: boolean;
}

// A test only counts as having actually run its element's check if it
// reached a real terminal outcome - "Blocked" (Playwright's own
// skipped/interrupted status) means the check never actually executed,
// so it can't be honestly called "the actual subject of an executed test."
function executedTitleSet(records: ExecutionRecord[]) {
    const titles = new Set<string>();
    for (const record of records) {
        if (record.status !== "Blocked") {
            titles.add(record.title);
        }
    }
    return titles;
}

// Same link-exclusion buildActionableElementTests applies before its own
// .slice(0, 50) - replicated here, not re-derived, so "excluded by
// generator logic" can only ever name a pattern the generator actually has.
function functionalCandidateElements(matchingPage: ContentProfilePage | null) {
    const hasDedicatedLinkDetails = (matchingPage?.linkDetails?.length ?? 0) > 0;
    const all = matchingPage?.actionableElements ?? [];
    const linkExcluded = hasDedicatedLinkDetails
        ? all.filter((element) => element.elementType === "link")
        : [];
    const candidates = all.filter((element) => !hasDedicatedLinkDetails || element.elementType !== "link");

    return { linkExcluded, candidates };
}

function notTestedEntry(
    area: ElementTrackedArea,
    path: string,
    element: ActionableElementDetail,
    reason: NotTestedElement["reason"],
    reasonDetail: string
): NotTestedElement {
    return {
        area,
        path,
        elementName: getActionableElementDisplayName(element),
        elementType: element.elementType,
        containerLabel: element.containerLabel,
        reason,
        reasonDetail,
    };
}

/**
 * Phase 17 Groups 2+3 (TFP-071/072): for the practice areas whose generated
 * tests correspond 1:1 to a discovered element (functional, accessibility -
 * usability's own element-derived tests bundle several elements per test
 * and can't be attributed this way), match each discovered element against
 * the run's actual executed tests by the exact title the generator would
 * have produced for it (the same composite identity dom-snapshot.ts already
 * uses, reused via the title text itself - no new ID scheme), and bucket
 * every unmatched element into exactly one reason.
 */
export function computeDiscoveredElementCoverage(
    selectedPractices: string[],
    contentProfile: ContentProfile | null,
    records: ExecutionRecord[],
    baseUrl: string
): { matches: DiscoveredElementMatch[]; notTested: NotTestedElement[] } {
    const matches: DiscoveredElementMatch[] = [];
    const notTested: NotTestedElement[] = [];

    if (!contentProfile || contentProfile.pages.length === 0) {
        return { matches, notTested };
    }

    const executedTitles = executedTitleSet(records);
    const linkAuditPaths = resolveLinkAuditPaths(contentProfile, baseUrl);

    for (const area of ELEMENT_TRACKED_AREAS) {
        const areaSelected = selectedPractices.includes(area);

        for (const path of linkAuditPaths) {
            const matchingPage = findMatchingProfilePage(contentProfile, path);

            if (area === "functional") {
                const { linkExcluded, candidates } = functionalCandidateElements(matchingPage);

                for (const element of linkExcluded) {
                    notTested.push(notTestedEntry(
                        area, path, element, "excluded-by-generator",
                        "link element covered by the dedicated link-audit suite instead of a per-element functional check"
                    ));
                }

                candidates.forEach((element, index) => {
                    if (index >= GENERATOR_ELEMENT_CAP) {
                        notTested.push(notTestedEntry(
                            area, path, element, "excluded-by-generator",
                            `beyond the generator's first ${GENERATOR_ELEMENT_CAP} discovered elements for this page`
                        ));
                        return;
                    }

                    if (!areaSelected) {
                        notTested.push(notTestedEntry(
                            area, path, element, "not-selected",
                            `"${area}" was not a selected practice area for this run`
                        ));
                        return;
                    }

                    const title = buildActionableElementTitle(element);
                    const tested = executedTitles.has(title);
                    matches.push({ area, path, element, title, tested });

                    if (!tested) {
                        notTested.push(notTestedEntry(
                            area, path, element, "generator-gap",
                            "selected and eligible for a generated test, but no matching executed test was found"
                        ));
                    }
                });
            } else {
                const all = matchingPage?.actionableElements ?? [];

                all.forEach((element, index) => {
                    if (index >= GENERATOR_ELEMENT_CAP) {
                        notTested.push(notTestedEntry(
                            area, path, element, "excluded-by-generator",
                            `beyond the generator's first ${GENERATOR_ELEMENT_CAP} discovered elements for this page`
                        ));
                        return;
                    }

                    if (!areaSelected) {
                        notTested.push(notTestedEntry(
                            area, path, element, "not-selected",
                            `"${area}" was not a selected practice area for this run`
                        ));
                        return;
                    }

                    const title = buildAccessibilityElementTitle(element);
                    const tested = executedTitles.has(title);
                    matches.push({ area, path, element, title, tested });

                    if (!tested) {
                        notTested.push(notTestedEntry(
                            area, path, element, "generator-gap",
                            "selected and eligible for a generated test, but no matching executed test was found"
                        ));
                    }
                });
            }
        }
    }

    return { matches, notTested };
}

/**
 * Phase 17 Group 2 (TFP-071): buildCoverageMatrix's replacement for the
 * areas discoveredMatches actually covers (functional, accessibility) -
 * status and the uncovered list are now denominated against discovered
 * elements, not executed tests. Every other area keeps the prior,
 * unchanged test-based rollup: they don't correspond to a discovered
 * element surface in the first place (performance/security/seo/etc. never
 * generated one-test-per-element checks to begin with), so there is
 * nothing dishonest about their existing category-only computation.
 */
export function buildDiscoveredCoverageMatrix(
    selectedPractices: string[],
    records: ExecutionRecord[],
    matches: DiscoveredElementMatch[]
) {
    const targetPractices = selectedPractices.length > 0
        ? selectedPractices
        : inferCoverageAreas(records);

    const matrix = targetPractices.map((practice) => {
        const label = AREA_LABELS[practice] ?? practice;
        const areaMatches = (practice === "functional" || practice === "accessibility")
            ? matches.filter((match) => match.area === practice)
            : [];

        if (areaMatches.length > 0) {
            const coveredMatches = areaMatches.filter((match) => match.tested);
            const status = coveredMatches.length === 0
                ? "uncovered"
                : coveredMatches.length === areaMatches.length
                    ? "covered"
                    : "partial";

            return {
                requirement: label,
                status,
                tests: coveredMatches.map((match) => match.title),
                uncoveredElements: areaMatches
                    .filter((match) => !match.tested)
                    .map((match) => getActionableElementDisplayName(match.element)),
                percentage: Math.round((coveredMatches.length / areaMatches.length) * 100),
            } satisfies CoverageMatrixItem;
        }

        const relatedTests = records.filter((record) => record.area === label);
        const successfulTests = relatedTests.filter(
            (record) => record.status === "Passed" || record.status === "Flaky"
        );
        const status = relatedTests.length === 0
            ? "uncovered"
            : successfulTests.length === relatedTests.length
                ? "covered"
                : "partial";

        return {
            requirement: label,
            status,
            tests: relatedTests.map((record) => `${record.browser}: ${record.title}`),
            percentage: relatedTests.length === 0 ? 0 : Math.round((successfulTests.length / relatedTests.length) * 100),
        } satisfies CoverageMatrixItem;
    });

    const covered = matrix.filter((item) => item.status === "covered").length;
    const total = matrix.length;
    const uncovered = matrix.flatMap((item) =>
        item.uncoveredElements && item.uncoveredElements.length > 0
            ? item.uncoveredElements.map((elementName) => `${item.requirement}: ${elementName}`)
            : item.status === "uncovered" && !item.uncoveredElements
                ? [item.requirement]
                : []
    );

    return {
        percentage: total === 0 ? 100 : Math.round((covered / total) * 100),
        covered,
        total,
        uncovered,
        matrix,
    };
}
