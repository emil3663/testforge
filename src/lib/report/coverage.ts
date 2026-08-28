import { AREA_LABELS } from "./execution";
import type { CoverageMatrixItem, ExecutionRecord } from "./types";

export function inferCoverageAreas(records: ExecutionRecord[]) {
    const areas = new Set<string>();

    for (const record of records) {
        const key = Object.entries(AREA_LABELS).find(
            ([, label]) => label === record.area
        )?.[0];

        if (key) {
            areas.add(key);
        }
    }

    return [...areas];
}

export function buildCoverageMatrix(
    selectedPractices: string[],
    records: ExecutionRecord[]
) {
    const targetPractices = selectedPractices.length > 0
        ? selectedPractices
        : inferCoverageAreas(records);

    const matrix = targetPractices.map((practice) => {
        const label = AREA_LABELS[practice] ?? practice;
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
        } satisfies CoverageMatrixItem;
    });

    const covered = matrix.filter((item) => item.status === "covered").length;
    const total = matrix.length;

    return {
        percentage: total === 0 ? 100 : Math.round((covered / total) * 100),
        covered,
        total,
        uncovered: matrix
            .filter((item) => item.status === "uncovered")
            .map((item) => item.requirement),
        matrix,
    };
}
