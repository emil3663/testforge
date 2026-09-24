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
