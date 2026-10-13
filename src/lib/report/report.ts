import type { ContentProfile } from "@/lib/generate/mock/types";
import { extractDeclaredTestTitles } from "@/lib/run/selection";
import { flattenSuites } from "./execution";
import { buildDefects, buildDefectTrend, buildHeatmap } from "./defects";
import { computeDiscoveredElementCoverage, buildDiscoveredCoverageMatrix } from "./discovered-coverage";
import { buildCoverageMap } from "./coverage-map";
import { buildPerformanceReport } from "./performance";
import { buildUsabilityReport } from "./usability";
import { buildSeoReport } from "./seo";
import { buildSummary } from "./summary";
import { computeEmptyAreas } from "./empty-areas";
import { getBestPracticeAreas } from "@/lib/generate/mock/areas";
import { BEST_PRACTICE_OPTIONS } from "@/lib/generate/mock/types";
import type { BestPracticeArea } from "@/lib/generate/mock/types";
import type { ComprehensiveIssue, ExecutionRecord, GenerationRecord, JsonReport, RunReport } from "./types";
import { buildComprehensiveReport } from "./comprehensive";
import { isComprehensive, type RunMode } from "@/lib/comprehensive/run-mode";

/** Phase 38 (TFP-148): every item a Standard test listed for manual review (the axe scan's "incomplete"), by page. */
function standardManualReview(execution: ExecutionRecord[]): ComprehensiveIssue[] {
    return execution.flatMap((record) => (record.issues ?? [])
        .filter((issue) => issue.kind === "manual-review")
        .map((issue) => ({ page: record.page ?? "(no page)", title: record.title, detail: `${issue.category} ${issue.detail}` })));
}

export function buildReport(
    report: JsonReport,
    selectedPractices: string[],
    output: string,
    baseUrl?: string,
    contentProfile: ContentProfile | null = null,
    suiteCode: string | null = null,
    generation: GenerationRecord | null = null,
    description = "",
    runMode: RunMode | undefined = undefined,
    workerCount: number | undefined = undefined,
    /** Phase 38: whether the run turned interactive tests on, for the per-gate Not run count. */
    interactiveEnabled = false
): RunReport {
    const allExecution = flattenSuites(report.suites ?? []);
    // Phase 35 (TFP-135, Decision 5): in a Comprehensive run the local
    // model's tests count toward nothing - no pass/fail, recommendation or
    // coverage figure. They stay in the execution list and get their own
    // report section. A Standard run is unchanged: this is all of them.
    const execution = isComprehensive(runMode) ? allExecution.filter((record) => record.generator !== "local model") : allExecution;
    const defects = buildDefects(execution);
    const { matches, notTested } = computeDiscoveredElementCoverage(
        selectedPractices,
        contentProfile,
        execution,
        baseUrl ?? "",
        suiteCode === null ? null : extractDeclaredTestTitles(suiteCode)
    );
    const coverage = buildDiscoveredCoverageMatrix(selectedPractices, execution, matches);
    // Phase 42 (TFP-192): what each test touches, read from the suite that ran.
    const coverageMap = buildCoverageMap(contentProfile, suiteCode);
    const summary = buildSummary(execution, defects, report.stats?.duration ?? 0, interactiveEnabled);
    const performance = buildPerformanceReport(execution, report.stats?.duration ?? 0);
    const usability = buildUsabilityReport(execution, defects);
    const seo = buildSeoReport(execution, selectedPractices, baseUrl);
    // Phase 34 (TFP-119): the same areas the template generator put in scope.
    const knownPractices = selectedPractices.filter((p): p is BestPracticeArea => (BEST_PRACTICE_OPTIONS as readonly string[]).includes(p));
    const emptyAreas = computeEmptyAreas(getBestPracticeAreas(description, knownPractices), execution, suiteCode, generation);

    return {
        summary: {
            ...summary,
            defectTrend: buildDefectTrend(execution),
        },
        execution: allExecution,
        defects: {
            issues: defects,
            heatmap: buildHeatmap(defects),
        },
        coverage,
        notTested,
        ...(coverageMap ? { coverageMap } : {}),
        generation,
        emptyAreas,
        ...(!isComprehensive(runMode) && standardManualReview(execution).length > 0 ? { manualReview: standardManualReview(execution) } : {}),
        performance,
        usability,
        seo,
        // Phase 35 (TFP-132): only on a Comprehensive run, so a Standard
        // report is exactly what it was.
        ...(isComprehensive(runMode)
            ? { comprehensive: buildComprehensiveReport(allExecution, runMode, contentProfile, baseUrl ?? "", workerCount ?? null, generation) }
            : {}),
        rawOutput: output,
    };
}
