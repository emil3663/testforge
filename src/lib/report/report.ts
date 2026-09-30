import type { ContentProfile } from "@/lib/generate/mock/types";
import { extractDeclaredTestTitles } from "@/lib/run/selection";
import { flattenSuites } from "./execution";
import { buildDefects, buildDefectTrend, buildHeatmap } from "./defects";
import { computeDiscoveredElementCoverage, buildDiscoveredCoverageMatrix } from "./discovered-coverage";
import { buildPerformanceReport } from "./performance";
import { buildUsabilityReport } from "./usability";
import { buildSeoReport } from "./seo";
import { buildSummary } from "./summary";
import { computeEmptyAreas } from "./empty-areas";
import { getBestPracticeAreas } from "@/lib/generate/mock/areas";
import { BEST_PRACTICE_OPTIONS } from "@/lib/generate/mock/types";
import type { BestPracticeArea } from "@/lib/generate/mock/types";
import type { GenerationRecord, JsonReport, RunReport } from "./types";
import { buildComprehensiveReport } from "./comprehensive";
import { isComprehensive, type RunMode } from "@/lib/comprehensive/run-mode";

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
    workerCount: number | undefined = undefined
): RunReport {
    const execution = flattenSuites(report.suites ?? []);
    const defects = buildDefects(execution);
    const { matches, notTested } = computeDiscoveredElementCoverage(
        selectedPractices,
        contentProfile,
        execution,
        baseUrl ?? "",
        suiteCode === null ? null : extractDeclaredTestTitles(suiteCode)
    );
    const coverage = buildDiscoveredCoverageMatrix(selectedPractices, execution, matches);
    const summary = buildSummary(execution, defects, report.stats?.duration ?? 0);
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
        execution,
        defects: {
            issues: defects,
            heatmap: buildHeatmap(defects),
        },
        coverage,
        notTested,
        generation,
        emptyAreas,
        performance,
        usability,
        seo,
        // Phase 35 (TFP-132): only on a Comprehensive run, so a Standard
        // report is exactly what it was.
        ...(isComprehensive(runMode)
            ? { comprehensive: buildComprehensiveReport(execution, runMode, contentProfile, baseUrl ?? "", workerCount ?? null) }
            : {}),
        rawOutput: output,
    };
}
