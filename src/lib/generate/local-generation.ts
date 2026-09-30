import OpenAI, { APIConnectionError } from "openai";
import { countGate, type GateVerdict } from "./gates";
import { localRulesFor } from "./local-rules";
import type { BestPracticeArea } from "./mock/types";
import { DEFAULT_OLLAMA_BASE_URL, OLLAMA_PLACEHOLDER_API_KEY, resolveOllamaModel, stripCodeFence } from "./ollama";
import { findPromisesToPlainMatchers, findTypeErrors, findUnawaitedAssertions } from "./validate";

// The local (Ollama) model call and every gate its output must pass - moved
// out of the generate route in Phase 34 (TFP-118) so Option B's gap-filling
// can use it, unchanged in behaviour. Phase 30 (TFP-103) guard/timeout/
// fallback; Phase 31/33 local rules; TFP-103 type check; TFP-110 unawaited
// assertions; Phase 37 TFP-129 Promises handed to a plain matcher. Each gate's verdict is returned (Phase 34 Decision 8).

export type LocalFailureReason =
    | "timeout"
    | "empty_completion"
    | "ollama_unreachable"
    | "ollama_model_missing"
    | "ollama_error"
    | "invalid_output"
    | "unawaited_assertion"
    | "promise_to_plain_matcher";

/** Tokens the model reported for the call (Ollama's OpenAI-compatible `usage`). */
export interface LocalSuiteUsage {
    promptTokens: number;
    completionTokens: number;
}

// `usage`, and `code` on a gate rejection, are for the Phase 36 benchmark
// (TFP-126), which scores rejected suites too; the route ignores both.
export type LocalSuiteResult =
    | { ok: true; code: string; model: string; gates: GateVerdict[]; usage?: LocalSuiteUsage }
    | { ok: false; reason: LocalFailureReason; model?: string; gates: GateVerdict[]; code?: string; usage?: LocalSuiteUsage };

// Phase 30 Decision 3: a local 7B model measured 53-74s per generation.
export const DEFAULT_OLLAMA_TIMEOUT_MS = 180_000;

export function ollamaTimeoutMs(): number {
    const raw = Number(process.env.TESTFORGE_OLLAMA_TIMEOUT_MS);
    return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_OLLAMA_TIMEOUT_MS;
}

/**
 * Phase 31 (TFP-106) / Phase 33: local-only API rules plus the guides for the
 * areas asked for, appended to the system message so the shared SYSTEM_PROMPT
 * (and the OpenAI path) is untouched.
 */
export function withLocalRules(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    areas: readonly BestPracticeArea[]
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    const localRules = localRulesFor(areas);
    return messages.map((m) => (m.role === "system" ? { ...m, content: `${m.content}\n\n${localRules}` } : m));
}

function errorText(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

export async function generateLocalSuite(
    configuredModel: string,
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    areas: readonly BestPracticeArea[]
): Promise<LocalSuiteResult> {
    const budget = ollamaTimeoutMs();
    const signal = AbortSignal.timeout(budget);
    const gates: GateVerdict[] = [];
    let model: string | undefined;
    let started: number | null = null;
    try {
        const client = new OpenAI({
            apiKey: OLLAMA_PLACEHOLDER_API_KEY,
            baseURL: process.env.TESTFORGE_OLLAMA_BASE_URL?.trim() || DEFAULT_OLLAMA_BASE_URL,
            maxRetries: 0,
        });

        const catalog = await client.models.list({ signal });
        model = resolveOllamaModel(
            catalog.data.map((m) => m.id),
            configuredModel
        ) ?? undefined;
        if (!model) {
            console.error(`[api/generate] Ollama has no model "${configuredModel}", using template generator.`);
            return { ok: false, reason: "ollama_model_missing", gates };
        }

        const localMessages = withLocalRules(messages, areas);
        started = Date.now();
        const chat = await client.chat.completions.create({ model, messages: localMessages, temperature: 0.2 }, { signal });
        const elapsed = Date.now() - started;
        gates.push({ gate: "time budget", bar: `answer within ${budget} ms`, measured: `${elapsed} ms`, verdict: "kept", evidence: [] });

        const usage = chat.usage ? { promptTokens: chat.usage.prompt_tokens, completionTokens: chat.usage.completion_tokens } : undefined;
        const raw = chat.choices[0]?.message?.content;
        const code = typeof raw === "string" ? stripCodeFence(raw) : "";
        if (code === "") {
            return { ok: false, reason: "empty_completion", model, gates, usage };
        }

        // Phase 30 Acceptance Criterion 1: the local model has invented
        // Playwright APIs (toBeAccessible), so its suite must type-check before
        // it is labelled model output. Fails closed if the check can't run.
        let typeErrors: string[];
        try {
            typeErrors = findTypeErrors(code);
        } catch (checkError) {
            typeErrors = [`type check could not run: ${errorText(checkError)}`];
        }
        gates.push(countGate("type check", "type errors", typeErrors));
        if (typeErrors.length > 0) {
            console.error(
                `[api/generate] ${model} returned a suite that does not type-check against @playwright/test, using template generator:\n  ${typeErrors.slice(0, 5).join("\n  ")}`
            );
            return { ok: false, reason: "invalid_output", model, gates, code, usage };
        }

        // Phase 33 (TFP-110): an unawaited web-first assertion is not a type
        // error, but it never runs - the test passes while checking nothing.
        // Only promise-returning ones are rejected: an unawaited synchronous
        // expect(value).toBe(...) still checks (the template generator writes
        // those itself). Detect and fall back, never rewrite; fails closed.
        let unawaited: string[];
        try {
            unawaited = findUnawaitedAssertions(code)
                .filter((a) => a.returnsPromise)
                .map((a) => `line ${a.line}: ${a.text}`);
        } catch (checkError) {
            unawaited = [`await check could not run: ${errorText(checkError)}`];
        }
        gates.push(countGate("unawaited assertions", "never-awaited web-first assertions", unawaited));
        if (unawaited.length > 0) {
            console.error(
                `[api/generate] ${model} returned a suite with assertions that are never awaited, using template generator:\n  ${unawaited.slice(0, 5).join("\n  ")}`
            );
            return { ok: false, reason: "unawaited_assertion", model, gates, code, usage };
        }

        // Phase 37 (TFP-129, Decision 2): expect(locator.isDisabled()).toBe(true)
        // type-checks and is awaited, but compares the Promise object, so the
        // test can never pass. Detect and fall back; fails closed.
        let promiseMatchers: string[];
        try {
            promiseMatchers = findPromisesToPlainMatchers(code);
        } catch (checkError) {
            promiseMatchers = [`Promise check could not run: ${errorText(checkError)}`];
        }
        gates.push(countGate("promise to plain matcher", "Promises handed to a plain matcher", promiseMatchers));
        if (promiseMatchers.length > 0) {
            console.error(
                `[api/generate] ${model} returned a suite that hands a Promise to a plain matcher, using template generator:\n  ${promiseMatchers.slice(0, 5).join("\n  ")}`
            );
            return { ok: false, reason: "promise_to_plain_matcher", model, gates, code, usage };
        }
        return { ok: true, code, model, gates, usage };
    } catch (error) {
        console.error("[api/generate] Ollama call failed, using template generator:", errorText(error));
        if (signal.aborted) {
            gates.push({ gate: "time budget", bar: `answer within ${budget} ms`, measured: `no answer within ${budget} ms`, verdict: "rejected", evidence: [] });
            return { ok: false, reason: "timeout", model, gates };
        }
        // A refused connection surfaces as APIConnectionError; anything else
        // (e.g. Ollama answering 500 because the model failed to load) got a
        // response, so it is not "unreachable".
        return { ok: false, reason: error instanceof APIConnectionError ? "ollama_unreachable" : "ollama_error", model, gates };
    }
}
