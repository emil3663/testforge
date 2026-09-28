import type { GenerationGateVerdict, GenerationRecord } from "@/lib/report/types";

// Phase 34 (TFP-119): /api/run accepts the generation record the client got
// from /api/generate and persists it with the run. It comes from the request
// body, so it is untrusted: only the known shape is kept, and every string and
// list is capped so a run record can't be bloated through it.

const MAX_TEXT = 200;
const MAX_EVIDENCE_LINE = 400;
const MAX_EVIDENCE_LINES = 6;
const MAX_GATES = 10;
const MAX_AREAS = 12;

function text(value: unknown, max = MAX_TEXT): string | undefined {
    return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined;
}

function gate(value: unknown): GenerationGateVerdict | null {
    if (!value || typeof value !== "object") return null;
    const v = value as Record<string, unknown>;
    const name = text(v.gate);
    const bar = text(v.bar);
    const measured = text(v.measured);
    if (!name || !bar || !measured || (v.verdict !== "kept" && v.verdict !== "rejected")) return null;
    const evidence = Array.isArray(v.evidence)
        ? v.evidence.map((line) => text(line, MAX_EVIDENCE_LINE)).filter((line): line is string => Boolean(line)).slice(0, MAX_EVIDENCE_LINES)
        : [];
    return { gate: name, bar, measured, verdict: v.verdict, evidence };
}

export function normalizeGenerationRecord(input: unknown): GenerationRecord | null {
    if (!input || typeof input !== "object") return null;
    const v = input as Record<string, unknown>;
    const generatedBy = text(v.generatedBy);
    if (!generatedBy) return null;
    const record: GenerationRecord = {
        generatedBy,
        gates: Array.isArray(v.gates) ? v.gates.map(gate).filter((g): g is GenerationGateVerdict => g !== null).slice(0, MAX_GATES) : [],
    };
    const model = text(v.model);
    if (model) record.model = model;
    const fallbackReason = text(v.fallbackReason);
    if (fallbackReason) record.fallbackReason = fallbackReason;
    if (v.gapFill && typeof v.gapFill === "object") {
        const g = v.gapFill as Record<string, unknown>;
        const outcome = text(g.outcome);
        if (outcome) {
            record.gapFill = {
                gapAreas: Array.isArray(g.gapAreas) ? g.gapAreas.map((a) => text(a)).filter((a): a is string => Boolean(a)).slice(0, MAX_AREAS) : [],
                outcome,
            };
        }
    }
    return record;
}
