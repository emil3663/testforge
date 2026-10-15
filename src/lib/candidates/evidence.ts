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
    // TFP-203: a candidate bound as a gap's test on Standard runs in the verdict, named by its annotation.
    for (const record of records.filter((candidate) => candidate.generator === "candidate" || candidate.candidate)) {
        const id = record.candidate ?? candidateIdOf(record.title);
        if (!id) continue;
        // TFP-196: a breach of the read-only gate is what "passed the gates on every run" rules out.
        const breach = /read-only guard breach/.test(record.rawMessage ?? "");
        await recordEvidence(id, { origin, page: record.page ?? "", at: new Date().toISOString(), status: record.status, run: runId, ...(breach ? { breach } : {}) });
        recorded++;
    }
    return recorded;
}
