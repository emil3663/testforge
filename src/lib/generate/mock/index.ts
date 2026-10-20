// Mock generator: builds a Playwright suite from URL/keyword heuristics when no OPENAI_API_KEY is set.

import { getBestPracticeAreas, buildCoverageComment, buildManualFollowUpComment } from "./areas";
import { buildContentSuites, buildContentProfileComment } from "./content-suites";
import { buildDemoQaSuites } from "./demoqa-suites";
import { buildJourneyTests, JOURNEY_HELPERS, JOURNEY_TESTS_NOTE } from "./journey-tests";
import { escapeForSingleQuotedString, summarizeDescription, toSentenceCase } from "./format";
import { buildGenericSuites } from "./generic-suites";
import { SUITE_AREA_CODES } from "./suite";
import { withDefaultGate } from "@/lib/run/test-gates";
import type { BestPracticeArea, ContentProfile, ContentRules, GeneratedSuite, TestAuditMode } from "./types";
import { routePageVisits } from "../page-visits";
import { shareReadOnlyVisits } from "../shared-visits";

export { BEST_PRACTICE_OPTIONS } from "./types";
export type {
    ActionableElementDetail,
    ActionableElementType,
    BestPracticeArea,
    ContentProfile,
    ContentProfilePage,
    ContentRules,
    DependencyKind,
    CandidateJourney,
    DependencyMapEntry,
    JourneySource,
    NamedFlow,
    SiteGraph,
    SiteGraphEdge,
    SiteGraphEdgeKind,
    SiteGraphNode,
    DragDropTargetDetail,
    GeneratedSuite,
    InteractionCategory,
    LinkCategory,
    LinkDetail,
    LocatorHint,
    StorageKind,
    StorageUsage,
    TestAuditMode,
} from "./types";

function renderSuites(suites: GeneratedSuite[]) {
    // Numbering runs on across suites that share an area code, so no two
    // tests in one generated file share an ID (Phase 36 Gate A follow-up:
    // the landing-page and per-page SEO suites both began at TFSE-001).
    const lastIdByAreaCode = new Map<string, number>();
    return suites
        .map((suite) => {
            const notes = suite.notes?.length
                ? `${suite.notes.map((note) => `// ${note}`).join("\n")}\n`
                : "";

            const areaCode = SUITE_AREA_CODES[suite.area] ?? "GN";
            const firstId = (lastIdByAreaCode.get(areaCode) ?? 0) + 1;
            lastIdByAreaCode.set(areaCode, firstId + suite.tests.length - 1);
            const numberedTests = suite.tests.map((testStr, index) => {
                const id = `TF${areaCode}-${String(firstId + index).padStart(3, "0")}`;
                // Phase 38 Decision 3: a test that declares no gate is read-only.
                return withDefaultGate(testStr.replace(/^(\s*test\(['"])/, (match) => `${match}${id}: `));
            });

            const preamble = suite.preamble ? `${suite.preamble.trimEnd()}\n\n` : "";
            return `${notes}test.describe('${escapeForSingleQuotedString(
                suite.title
            )}', () => {\n${preamble}${numberedTests.join("\n\n")}\n});`;
        })
        .join("\n\n");
}

export function mockGenerate(
    baseUrl: string,
    description: string,
    selectedPractices: BestPracticeArea[],
    contentProfile: ContentProfile | null,
    contentRules: ContentRules,
    auditMode: TestAuditMode
) {
    return mockGenerateDetailed(baseUrl, description, selectedPractices, contentProfile, contentRules, auditMode).code;
}

export interface TemplateGeneration {
    code: string;
    /** Every area in scope: selected, or keyword-triggered / default. */
    areas: BestPracticeArea[];
    /** Executable test(...) calls written per area. */
    testsByArea: Record<BestPracticeArea, number>;
    /** GEN-43: areas the template inspected and found nothing to test, with why. */
    notApplicable: Partial<Record<BestPracticeArea, string>>;
}

/**
 * mockGenerate plus what it wrote per area. Phase 34 (TFP-118): Option B asks
 * the local model only for areas the template left without tests, so it needs
 * the count, not a parse of the generated code.
 */
export function mockGenerateDetailed(
    baseUrl: string,
    description: string,
    selectedPractices: BestPracticeArea[],
    contentProfile: ContentProfile | null,
    contentRules: ContentRules,
    auditMode: TestAuditMode,
    // Phase 39 (TFP-212): one shared visit per page for its read-only checks. Off only to prove Decision 7, the
    // same results shared and one-page-per-test.
    options: { sharedVisits?: boolean } = {}
): TemplateGeneration {
    const parsedBaseUrl = new URL(baseUrl);
    const escapedBaseUrl = escapeForSingleQuotedString(baseUrl);
    const escapedDescription = escapeForSingleQuotedString(
        summarizeDescription(description)
    );
    const bestPracticeAreas = getBestPracticeAreas(description, selectedPractices);
    const suiteTitle = escapeForSingleQuotedString(
        toSentenceCase(summarizeDescription(description))
    );
    const suites = parsedBaseUrl.hostname.includes("demoqa.com")
        ? buildDemoQaSuites(baseUrl, description, bestPracticeAreas, contentProfile, auditMode)
        : buildGenericSuites(baseUrl, description, bestPracticeAreas, contentProfile, auditMode);
    const contentSuites = buildContentSuites(contentProfile, contentRules, bestPracticeAreas);
    // TFP-091: selected journeys are functional-area tests (walking real
    // flows), so they only join a functional suite that's actually being
    // generated - a run without the functional area gets none, the same as
    // every other functional element.
    const journeyTests = buildJourneyTests(contentProfile, contentRules);
    const functionalSuite = suites.find((suite) => suite.area === "functional");
    const hasJourneyTests = journeyTests.length > 0 && Boolean(functionalSuite);
    if (functionalSuite && hasJourneyTests) {
        functionalSuite.tests.push(...journeyTests);
        functionalSuite.notes = [...(functionalSuite.notes ?? []), JOURNEY_TESTS_NOTE];
    }
    const manualFollowUpComment = buildManualFollowUpComment(bestPracticeAreas);
    const allSuites = [...suites, ...contentSuites];
    const testsByArea = Object.fromEntries(bestPracticeAreas.map((area) => [area, 0])) as Record<BestPracticeArea, number>;
    const notApplicable: Partial<Record<BestPracticeArea, string>> = {};
    for (const suite of allSuites) {
        testsByArea[suite.area] = (testsByArea[suite.area] ?? 0) + suite.tests.length;
        if (suite.notApplicable) notApplicable[suite.area] = suite.notApplicable;
    }

    const code = `import { test, expect } from '@playwright/test';

// Generated by TestForge without an OpenAI API key.
// Scenario: ${escapedDescription}
// Audit mode: ${auditMode}
// Best-practice coverage selected for this suite:
${buildCoverageComment(bestPracticeAreas)}
${buildContentProfileComment(contentProfile, contentRules)}
${manualFollowUpComment ? `${manualFollowUpComment}\n` : ""}

// Suite grouping root: ${suiteTitle}

test.use({ baseURL: '${escapedBaseUrl}' });
${hasJourneyTests ? `
${JOURNEY_HELPERS}
` : ""}
${renderSuites(allSuites)}

// NOTE: This fallback generator uses URL and keyword heuristics.
// Add OPENAI_API_KEY in your .env to generate tests tailored more deeply to the scenario.`;

    // TFP-167: every page visit waits for the page to draw. TFP-212: read-only checks share a visit per page.
    const routed = routePageVisits(code);
    return { code: options.sharedVisits === false ? routed : shareReadOnlyVisits(routed), areas: bestPracticeAreas, testsByArea, notApplicable };
}
