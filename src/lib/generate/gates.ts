// Phase 34 Decision 8: every generation gate's verdict is recorded with its
// stated bar, the measured result, and the evidence - so disagreeing with a
// decision to keep or drop local output means arguing with a recorded number,
// not a guess. Today's gates are binary (their bar is zero); the same shape
// takes a score and a threshold if a calibrated gate is added later.

export interface GateVerdict {
    /** e.g. "type check" */
    gate: string;
    /** e.g. "0 type errors" */
    bar: string;
    /** e.g. "2 type errors" */
    measured: string;
    verdict: "kept" | "rejected";
    /** The error messages or source lines behind the verdict, capped. */
    evidence: string[];
}

const MAX_EVIDENCE_LINES = 5;
const MAX_EVIDENCE_CHARS = 300;

export function capEvidence(lines: string[]): string[] {
    const capped = lines.slice(0, MAX_EVIDENCE_LINES).map((line) => (line.length > MAX_EVIDENCE_CHARS ? `${line.slice(0, MAX_EVIDENCE_CHARS)}...` : line));
    if (lines.length > MAX_EVIDENCE_LINES) capped.push(`... and ${lines.length - MAX_EVIDENCE_LINES} more`);
    return capped;
}

export function countGate(gate: string, unit: string, found: string[]): GateVerdict {
    return {
        gate,
        bar: `0 ${unit}`,
        measured: `${found.length} ${unit}`,
        verdict: found.length === 0 ? "kept" : "rejected",
        evidence: capEvidence(found),
    };
}
