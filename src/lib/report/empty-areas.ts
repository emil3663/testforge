import { SUITE_TITLES } from "@/lib/generate/mock/suite";
import type { BestPracticeArea } from "@/lib/generate/mock/types";
import { AREA_LABELS } from "./execution";
import type { EmptyAreaRecord, ExecutionRecord, GenerationRecord } from "./types";

// Phase 34 (TFP-119, Decision 7): an area in scope that ended up with no test
// is reported with why, never silently dropped. Two sources, most specific
// first: the template generator's own note for the area (renderSuites writes
// notes as comment lines directly above the area's describe block, so they
// are read back from the suite that actually ran), then what happened on the
// local-model side (Option B's gap-fill outcome, recorded at generation).

const LOCAL_FAILURE_REASONS: Record<string, string> = {
    timeout: "the local model did not answer within its time budget",
    invalid_output: "the local model's tests were rejected: they do not type-check (see the type check gate)",
    unawaited_assertion: "the local model's tests were rejected: an assertion in them is never awaited (see the unawaited assertions gate)",
    promise_to_plain_matcher: "the local model's tests were rejected: one compares a Promise instead of its value, so it can never pass (see the promise to plain matcher gate)",
    empty_completion: "the local model answered with nothing usable",
    ollama_unreachable: "the local model could not be reached (is Ollama running?)",
    ollama_model_missing: "the configured local model is not installed in Ollama",
    ollama_error: "Ollama answered with an error",
};

/** The comment lines directly above an area's describe block in the suite. */
export function templateNotesFor(area: BestPracticeArea, suiteCode: string | null): string[] | null {
    if (!suiteCode) return null;
    const lines = suiteCode.split("\n");
    const at = lines.findIndex((line) => line.startsWith(`test.describe('${SUITE_TITLES[area]}'`));
    if (at < 0) return null;
    const notes: string[] = [];
    for (let i = at - 1; i >= 0 && lines[i].startsWith("// "); i--) notes.unshift(lines[i].slice(3).trim());
    return notes;
}

function localReason(area: BestPracticeArea, generation: GenerationRecord | null): string | null {
    if (area === "reliability") return "reliability is never sent to the local model (Phase 33, GEN-32 open)";
    if (!generation) return "no local model result was recorded for this run - the local model only fills gaps when TESTFORGE_OLLAMA_MODEL is set";
    const gapFill = generation.gapFill;
    if (!gapFill || !gapFill.gapAreas.includes(area)) return null;
    if (gapFill.outcome === "rejected") {
        return LOCAL_FAILURE_REASONS[generation.fallbackReason ?? ""] ?? `the local model's tests were rejected (${generation.fallbackReason ?? "no reason recorded"})`;
    }
    return "the local model was asked for this area but wrote no test for it";
}

export function computeEmptyAreas(
    areasInScope: readonly BestPracticeArea[],
    execution: readonly ExecutionRecord[],
    suiteCode: string | null,
    generation: GenerationRecord | null
): EmptyAreaRecord[] {
    const empty: EmptyAreaRecord[] = [];
    for (const area of areasInScope) {
        const label = AREA_LABELS[area];
        if (execution.some((record) => record.area === label)) continue;
        const notes = templateNotesFor(area, suiteCode);
        const reasons = notes && notes.length > 0 ? [...notes] : ["the template generator wrote no test for this area on this target"];
        const local = localReason(area, generation);
        if (local) reasons.push(local);
        empty.push({ area: label, reasons });
    }
    return empty;
}
