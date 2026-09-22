import { AREA_LABELS } from "./execution";
import type { ExecutionRecord } from "./types";

// Still used by buildDiscoveredCoverageMatrix (discovered-coverage.ts) to
// infer practice areas from executed tests when a run has no
// selectedPractices recorded. buildCoverageMatrix itself was replaced by
// buildDiscoveredCoverageMatrix as part of Phase 17 Group 2 (TFP-071) -
// see discovered-coverage.ts.
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
