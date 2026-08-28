import { flattenSuites } from "./execution";
import { buildDefects, buildDefectTrend, buildHeatmap } from "./defects";
import { buildCoverageMatrix } from "./coverage";
import { buildPerformanceReport } from "./performance";
import { buildUsabilityReport } from "./usability";
import { buildSeoReport } from "./seo";
import { buildSummary } from "./summary";
import type { JsonReport, RunReport } from "./types";

export function buildReport(
    report: JsonReport,
    selectedPractices: string[],
    output: string,
    baseUrl?: string
): RunReport {
    const execution = flattenSuites(report.suites ?? []);
    const defects = buildDefects(execution);
    const coverage = buildCoverageMatrix(selectedPractices, execution);
    const summary = buildSummary(execution, defects, report.stats?.duration ?? 0);
    const performance = buildPerformanceReport(execution, report.stats?.duration ?? 0);
    const usability = buildUsabilityReport(execution, defects);
    const seo = buildSeoReport(execution, selectedPractices, baseUrl);

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
        performance,
        usability,
        seo,
        rawOutput: output,
    };
}
