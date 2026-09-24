/**
 * Ordered candidate models for the OpenAI-backed generation path (TFP-083).
 *
 * At request time the route lists the account's live model catalog and uses
 * the FIRST candidate below that is actually present. Order is the whole
 * policy: cheapest-adequate tier first, a known-working fallback after it.
 * Matching is by exact id on purpose - never by name pattern ("anything
 * containing 'mini'"), which breaks silently on the next OpenAI rename.
 *
 * If no candidate is in the live catalog the route falls back to the template
 * generator and says so (`generatedBy: "fallback"`), so a retired model
 * degrades loudly instead of 500ing.
 *
 * Catalog-verified 2026-09-24 (`npm run check:openai-models`, real key): all
 * three ids are exact entries in the live catalog (126 models), so the route
 * picks `gpt-4.1-mini`. A completion against it has NOT yet succeeded - the
 * account had no API credits (429) - so re-run the check after funding it.
 * Phase 21's TFP-099 later scores every entry and may reorder or prune it;
 * that never requires touching the route's guard logic.
 */
export const OPENAI_MODEL_CANDIDATES: readonly string[] = [
    "gpt-4.1-mini",
    "gpt-4o-mini",
    "gpt-4o",
];

/** First candidate present in `available`, or null. Exact-id match only. */
export function pickModel(
    available: Iterable<string>,
    candidates: readonly string[] = OPENAI_MODEL_CANDIDATES
): string | null {
    const live = new Set(available);
    return candidates.find((id) => live.has(id)) ?? null;
}
