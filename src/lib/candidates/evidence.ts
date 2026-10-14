import type { ExecutionRecord } from "@/lib/report/types";
import { candidateIdOf } from "./apply";
import { recordEvidence } from "./pool";

/**
 * Phase 42 (TFP-195, Decision 8): every run a candidate took part in is on
 * its record - the site, the page, the run and how it ended - so TFP-196's
 * promotion rule can be read from it.
 */
export async function recordCandidateRuns(records: ExecutionRecord[], baseUrl: string | undefined, runId: string): Promise<number> {
    if (!baseUrl) return 0;
    const origin = new URL(baseUrl).origin;
    let recorded = 0;
    for (const record of records.filter((candidate) => candidate.generator === "candidate")) {
        const id = candidateIdOf(record.title);
        if (!id) continue;
        await recordEvidence(id, { origin, page: record.page ?? "", at: new Date().toISOString(), status: record.status, run: runId });
        recorded++;
    }
    return recorded;
}
