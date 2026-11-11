/**
 * Local (Ollama) generation path helpers (Phase 30, TFP-103).
 *
 * The route reaches Ollama through its OpenAI-compatible endpoint with the
 * same `openai` SDK client the OpenAI path uses - only the base URL and a
 * placeholder key differ. See docs/LOCAL_MODEL_SETUP.md for the Modelfile
 * that pins the model's context and output size (the OpenAI-compatible
 * endpoint silently drops `num_ctx` sent per request).
 */

export const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434/v1";

/** Ollama ignores the key, but the SDK refuses to build a client without one. */
export const OLLAMA_PLACEHOLDER_API_KEY = "ollama";

/**
 * The catalog id matching `configured`, or null. Ollama lists every model
 * with its tag (`testforge-qwen7b:latest`) while `ollama run`/`ollama create`
 * accept the bare name, so an untagged name means `:latest` - the one rule
 * Ollama itself applies. Otherwise exact match, same as TFP-083's picker.
 */
export function resolveOllamaModel(available: Iterable<string>, configured: string): string | null {
    const wanted = configured.includes(":") ? configured : `${configured}:latest`;
    for (const id of available) {
        if (id === configured || id === wanted) return id;
    }
    return null;
}

/** Phase 48 (TFP-278, Decision 3): the tag `ollama/Modelfile.mr-onion-qwen7b` builds, and the one 0.2.x's built. */
export const LOCAL_MODEL_TAG = "mr-onion-qwen7b";
export const OLD_LOCAL_MODEL_TAG = "testforge-qwen7b";

/**
 * As resolveOllamaModel, and when the model asked for is the new tag and only the old one is built, the old one: a
 * tester who built the model before the rename keeps local generation without a rebuild. `oldTag` says so, for the
 * generation record (`ollama cp testforge-qwen7b mr-onion-qwen7b` gives it the new name).
 */
export function resolveLocalModel(available: Iterable<string>, configured: string): { model: string | null; oldTag: boolean } {
    const ids = [...available];
    const model = resolveOllamaModel(ids, configured);
    const [name, tag] = configured.split(":");
    if (model !== null || name !== LOCAL_MODEL_TAG) return { model, oldTag: false };
    const old = resolveOllamaModel(ids, tag === undefined ? OLD_LOCAL_MODEL_TAG : `${OLD_LOCAL_MODEL_TAG}:${tag}`);
    return { model: old, oldTag: old !== null };
}

/**
 * Removes a leading ```<lang> fence line and a trailing ``` line, each only
 * if present. Every local model spiked for Phase 30 wrapped its code in a
 * fence despite the system prompt forbidding it. Deliberately not a parser:
 * prose around the fence is left for the caller to see, not guessed away.
 */
export function stripCodeFence(text: string): string {
    return text
        .trim()
        .replace(/^```[\w+-]*[ \t]*\r?\n/, "")
        .replace(/\r?\n?```$/, "")
        .trim();
}
