import type { PageTypeCoverageRecord } from "@/lib/report/types";

/**
 * Phase 47 Decision 4 (TFP-245): the generation record a run carries, built from the generate response the same way
 * by the UI and the CLI. A template-only generation answers without `generatedBy` (no model or key configured); the
 * page types and the site suite's record (Phase 42, TFP-190) still need a record to travel in, and "template" is what
 * wrote that suite. No server imports: the UI's bundle includes this.
 */
export function generationRecordFrom(data: Record<string, unknown>, pageTypes: PageTypeCoverageRecord | undefined) {
    const siteSuite = data.siteSuite && typeof data.siteSuite === "object" ? data.siteSuite : undefined;
    const generatedBy = typeof data.generatedBy === "string" ? data.generatedBy : pageTypes || siteSuite ? "template" : null;
    return generatedBy
        ? { generatedBy, model: data.model, fallbackReason: data.fallbackReason, gapFill: data.gapFill, gates: data.gates ?? [], ...(pageTypes ? { pageTypes } : {}), ...(siteSuite ? { siteSuite } : {}) }
        : null;
}
