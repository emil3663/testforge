import {
    buildAccessibilityElementTitle,
    buildActionableElementTitle,
    getActionableElementDisplayName,
    resolveLinkAuditPaths,
    findMatchingProfilePage,
} from "@/lib/generate/mock/locators";
import { buildDependencyFailureTitle, isRoutableDependencyKind } from "@/lib/generate/mock/dependency-failure-injection";
import { buildJourneyTitle } from "@/lib/generate/mock/journey-tests";
import { buildStorageFailureTitle, STORAGE_KINDS } from "@/lib/generate/mock/storage-failure-injection";
import type { ActionableElementDetail, CandidateJourney, ContentProfile, ContentProfilePage, DependencyMapEntry, StorageKind } from "@/lib/generate/mock/types";
import { AREA_LABELS } from "./execution";
import { inferCoverageAreas } from "./coverage";
import type { CoverageMatrixItem, ExecutionRecord, NotTestedElement } from "./types";

// Mirrors buildActionableElementTests'/buildAccessibilityElementTests' own
// .slice(0, 50) sampling cap - an element beyond it never gets a test
// generated, which is a known, named generator limit, not a gap.
const GENERATOR_ELEMENT_CAP = 50;

export type ElementTrackedArea = "functional" | "accessibility" | "reliability";
// Reliability is tracked separately below, since its discovered surface
// (dependencyMap) is per-baseUrl, not per-page like functional/accessibility's
// actionableElements - it doesn't fit this per-path loop's shape.
const ELEMENT_TRACKED_AREAS: Exclude<ElementTrackedArea, "reliability">[] = ["functional", "accessibility"];

export interface DiscoveredElementMatch {
    area: ElementTrackedArea;
    path: string;
    // Only set for functional/accessibility - reliability matches a
    // DependencyMapEntry instead, which carries no ActionableElementDetail.
    element?: ActionableElementDetail;
    displayName: string;
    title: string;
    tested: boolean;
}

// Generated test titles carry a "TFxx-000: " id prefix (mock/index.ts's
// renderSuites), and Playwright reports them with it; every title builder
// this file matches against returns the title without it. Matching without
// stripping made every real run report every element as untested (found
// while building TFP-091: the unit tests used bare titles, so they never
// exercised the prefixed form a real run produces).
const TEST_ID_PREFIX = /^TF[A-Z]{2}-\d{3}:\s*/;
export function stripTestIdPrefix(title: string) {
    return title.replace(TEST_ID_PREFIX, "");
}

// A test only counts as having actually run its element's check if it
// reached a real terminal outcome - "Blocked" (Playwright's own
// skipped/interrupted status) means the check never actually executed,
// so it can't be honestly called "the actual subject of an executed test."
function executedTitleSet(records: ExecutionRecord[]) {
    const titles = new Set<string>();
    for (const record of records) {
        if (record.status !== "Blocked") {
            titles.add(stripTestIdPrefix(record.title));
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

// Reliability's discovered "elements" are DependencyMapEntry rows (TFP-084),
// not ActionableElementDetail - same NotTestedElement shape, a different
// source of elementName/elementType.
function notTestedDependencyEntry(
    entry: DependencyMapEntry,
    reason: NotTestedElement["reason"],
    reasonDetail: string
): NotTestedElement {
    return {
        area: "reliability",
        path: entry.paths[0] ?? "/",
        elementName: `${entry.host} [${entry.kind}]`,
        elementType: entry.kind,
        containerLabel: "",
        reason,
        reasonDetail,
    };
}

// TFP-086: reliability's other discovered "element" - a (page, storage
// kind) pair the introspect-time behavioral probe actually detected in use.
function notTestedStorageEntry(
    path: string,
    kind: StorageKind,
    reason: NotTestedElement["reason"],
    reasonDetail: string
): NotTestedElement {
    return {
        area: "reliability",
        path,
        elementName: `${kind} on ${path}`,
        elementType: kind,
        containerLabel: "",
        reason,
        reasonDetail,
    };
}

// TFP-091: a journey is a functional-area discovered "element" - one
// (candidate journey), not one DOM element - reported through the same
// NotTestedElement shape.
function notTestedJourneyEntry(
    journey: CandidateJourney,
    reason: NotTestedElement["reason"],
    reasonDetail: string
): NotTestedElement {
    return {
        area: "functional",
        path: journey.path[0] ?? "/",
        elementName: buildJourneyTitle(journey),
        elementType: "journey",
        containerLabel: journey.label ?? "",
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
    baseUrl: string,
    // TFP-091: the titles declared in the suite that actually ran. A journey
    // is "selected" exactly when it was generated into that suite; null
    // (suite source unavailable) falls back to "has an execution record".
    declaredTestTitles: string[] | null = null
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
                    matches.push({ area, path, element, displayName: getActionableElementDisplayName(element), title, tested });

                    if (!tested) {
                        notTested.push(notTestedEntry(
                            area, path, element, "generator-gap",
                            "selected and eligible for a generated test, but no matching executed test was found"
                        ));
                    }
                });
            } else if (area === "accessibility") {
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
                    matches.push({ area, path, element, displayName: getActionableElementDisplayName(element), title, tested });

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

    // TFP-091: candidate journeys, per-baseUrl like the dependency map. A
    // journey that wasn't generated into the suite (not selected on the
    // review screen) is listed but not counted; one that was generated
    // counts, and if it was skipped (interactive tests not enabled for this
    // run) it stays uncovered with that reason - never silently "covered".
    const functionalSelected = selectedPractices.includes("functional");
    const declaredSet = declaredTestTitles ? new Set(declaredTestTitles.map(stripTestIdPrefix)) : null;
    const recordsByTitle = new Map(records.map((record) => [stripTestIdPrefix(record.title), record]));

    for (const journey of contentProfile.journeys ?? []) {
        const title = buildJourneyTitle(journey);
        const generated = declaredSet ? declaredSet.has(title) : recordsByTitle.has(title);

        if (!generated) {
            notTested.push(notTestedJourneyEntry(
                journey, "not-selected",
                "candidate journey was not selected on the review screen, so no test was generated for it"
            ));
            continue;
        }

        if (!functionalSelected) {
            notTested.push(notTestedJourneyEntry(
                journey, "not-selected",
                '"functional" was not a selected practice area for this run'
            ));
            continue;
        }

        const record = recordsByTitle.get(title);
        const tested = Boolean(record) && record?.status !== "Blocked";
        matches.push({
            area: "functional",
            path: journey.path[0] ?? "/",
            displayName: title,
            title,
            tested,
        });

        if (!tested) {
            notTested.push(record
                ? notTestedJourneyEntry(
                    journey, "interactive-skipped",
                    "generated and selected, but skipped or blocked: journey tests submit forms on the live site and only run when interactive tests are enabled for the run"
                )
                : notTestedJourneyEntry(
                    journey, "generator-gap",
                    "selected and generated, but no matching executed test was found"
                ));
        }
    }

    // Reliability (TFP-085): dependencyMap is per-baseUrl, not per-page, so
    // it sits outside the path loop above rather than forcing a fake path
    // iteration over a list that already spans every introspected page.
    const reliabilitySelected = selectedPractices.includes("reliability");
    for (const entry of contentProfile.dependencyMap ?? []) {
        if (!isRoutableDependencyKind(entry.kind)) {
            notTested.push(notTestedDependencyEntry(
                entry, "excluded-by-generator",
                "cookie-kind dependencies aren't a routable network request - page.route() has nothing to block"
            ));
            continue;
        }

        if (!reliabilitySelected) {
            notTested.push(notTestedDependencyEntry(
                entry, "not-selected",
                '"reliability" was not a selected practice area for this run'
            ));
            continue;
        }

        const path = entry.paths[0] ?? "/";
        const title = buildDependencyFailureTitle(entry);
        const tested = executedTitles.has(title);
        matches.push({
            area: "reliability",
            path,
            displayName: `${entry.host} [${entry.kind}]`,
            title,
            tested,
        });

        if (!tested) {
            notTested.push(notTestedDependencyEntry(
                entry, "generator-gap",
                "selected and eligible for a generated failure-injection test, but no matching executed test was found"
            ));
        }
    }

    // TFP-086: same reliability area, a different discovered surface - one
    // (page, storage kind) pair per kind the introspect-time behavioral
    // probe actually detected in use. Unlike dependencyMap's cookie
    // exclusion, every detected kind here is routable (there's no kind
    // storage-failure-injection can't act on), so only not-selected /
    // generator-gap apply.
    for (const page of contentProfile.pages) {
        const usage = page.storageUsage;
        if (!usage) {
            continue;
        }

        for (const kind of STORAGE_KINDS) {
            if (!usage[kind]) {
                continue;
            }

            if (!reliabilitySelected) {
                notTested.push(notTestedStorageEntry(
                    page.path, kind, "not-selected",
                    '"reliability" was not a selected practice area for this run'
                ));
                continue;
            }

            const title = buildStorageFailureTitle(page.path, kind);
            const tested = executedTitles.has(title);
            matches.push({
                area: "reliability",
                path: page.path,
                displayName: `${kind} on ${page.path}`,
                title,
                tested,
            });

            if (!tested) {
                notTested.push(notTestedStorageEntry(
                    page.path, kind, "generator-gap",
                    "selected and eligible for a generated storage-failure test, but no matching executed test was found"
                ));
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
        const areaMatches = (practice === "functional" || practice === "accessibility" || practice === "reliability")
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
                    .map((match) => match.displayName),
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
