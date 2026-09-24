import { NextRequest, NextResponse } from "next/server";
import OpenAI, { APIConnectionError } from "openai";
import { mockGenerate } from "@/lib/generate/mock";
import {
    normalizeBaseUrl,
    normalizeContentProfile,
    normalizeContentRules,
    normalizeSelectedPractices,
    normalizeTestAuditMode,
} from "@/lib/generate/normalize";
import { pickModel } from "@/lib/generate/models";
import {
    DEFAULT_OLLAMA_BASE_URL,
    OLLAMA_PLACEHOLDER_API_KEY,
    resolveOllamaModel,
    stripCodeFence,
} from "@/lib/generate/ollama";
import { findTypeErrors, findUnawaitedAssertions } from "@/lib/generate/validate";
import { localRulesFor } from "@/lib/generate/local-rules";
import { getBestPracticeAreas } from "@/lib/generate/mock/areas";
import type { BestPracticeArea } from "@/lib/generate/mock/types";
import { SYSTEM_PROMPT } from "@/lib/generate/prompt";
import { selectJourneys } from "@/lib/introspect/journeys";

export async function POST(req: NextRequest) {
    const { baseUrl, description, selectedPractices, contentProfile, contentRules, auditMode } = await req.json().catch(() => ({}));

    if (!description || typeof description !== "string") {
        return NextResponse.json(
            { error: "description is required" },
            { status: 400 }
        );
    }

    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    if (!normalizedBaseUrl.ok) {
        return NextResponse.json(
            { error: normalizedBaseUrl.message },
            { status: 400 }
        );
    }

    const normalizedPractices = normalizeSelectedPractices(selectedPractices);
    const normalizedContentProfile = normalizeContentProfile(contentProfile);
    const normalizedContentRules = normalizeContentRules(contentRules);
    normalizedContentRules.selectedJourneyIds = selectJourneys(
        normalizedContentProfile?.journeys ?? [],
        normalizedContentRules.selectedJourneyIds
    ).map((journey) => journey.id);
    const normalizedAuditMode = normalizeTestAuditMode(auditMode);
    const apiKey = process.env.OPENAI_API_KEY;

    const template = () =>
        mockGenerate(
            normalizedBaseUrl.value,
            description,
            normalizedPractices,
            normalizedContentProfile,
            normalizedContentRules,
            normalizedAuditMode
        );

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: "system", content: SYSTEM_PROMPT },
        {
            role: "user",
            content: `Base URL: ${normalizedBaseUrl.value}\nAudit mode: ${normalizedAuditMode}\nSelected best-practice coverage: ${normalizedPractices.length > 0 ? normalizedPractices.join(
                ", "
            ) : "infer from prompt"}\nContent rules: ${JSON.stringify(normalizedContentRules, null, 2)}\nPage inspection profile: ${JSON.stringify(normalizedContentProfile, null, 2)}\n\nTest description:\n${description}`,
        },
    ];

    // Phase 30 Decision 5: a configured local model wins over an OpenAI key.
    const ollamaModel = process.env.TESTFORGE_OLLAMA_MODEL?.trim();
    if (ollamaModel) {
        // Phase 33: the same areas the template generator would cover, so only
        // the guides for those categories are sent to the local model.
        const areas = getBestPracticeAreas(description, normalizedPractices);
        return generateWithOllama(ollamaModel, messages, template, areas);
    }

    if (!apiKey) {
        return NextResponse.json({ code: template() });
    }

    // TFP-083: every failure of the OpenAI call (rejection, timeout, no
    // usable model, empty completion) degrades to the template generator and
    // is labelled, so template output is never passed off as AI output.
    // One budget covers the catalog lookup and the completion together.
    const signal = AbortSignal.timeout(timeoutMs("TESTFORGE_OPENAI_TIMEOUT_MS", DEFAULT_OPENAI_TIMEOUT_MS));
    try {
        // maxRetries: 0 - the SDK would otherwise retry timeouts and 5xx,
        // silently multiplying the wait beyond the budget above.
        const client = new OpenAI({ apiKey, maxRetries: 0 });

        const catalog = await client.models.list({ signal });
        const model = pickModel(catalog.data.map((m) => m.id));
        if (!model) {
            return fallback(template(), "no_candidate_model");
        }

        const chat = await client.chat.completions.create({ model, messages, temperature: 0.2 }, { signal });

        const code = chat.choices[0]?.message?.content;
        if (typeof code !== "string" || code.trim() === "") {
            return fallback(template(), "empty_completion", model);
        }
        return NextResponse.json({ code, generatedBy: "openai", model });
    } catch (error) {
        console.error(
            "[api/generate] OpenAI call failed, using template generator:",
            error instanceof Error ? error.message : error
        );
        return fallback(template(), signal.aborted ? "timeout" : "openai_error");
    }
}

/**
 * Phase 30 (TFP-103): the same guard/fallback shape as the OpenAI path, pointed
 * at a local Ollama through its OpenAI-compatible endpoint. Only the base URL,
 * the time budget and the failure labels differ.
 */
async function generateWithOllama(
    configuredModel: string,
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    template: () => string,
    areas: readonly BestPracticeArea[]
) {
    const signal = AbortSignal.timeout(timeoutMs("TESTFORGE_OLLAMA_TIMEOUT_MS", DEFAULT_OLLAMA_TIMEOUT_MS));
    try {
        const client = new OpenAI({
            apiKey: OLLAMA_PLACEHOLDER_API_KEY,
            baseURL: process.env.TESTFORGE_OLLAMA_BASE_URL?.trim() || DEFAULT_OLLAMA_BASE_URL,
            maxRetries: 0,
        });

        const catalog = await client.models.list({ signal });
        const model = resolveOllamaModel(
            catalog.data.map((m) => m.id),
            configuredModel
        );
        if (!model) {
            console.error(`[api/generate] Ollama has no model "${configuredModel}", using template generator.`);
            return fallback(template(), "ollama_model_missing");
        }

        // Phase 31 (TFP-106) / Phase 33: local-only API rules plus the guides
        // for the areas in scope, appended to the system message here so the
        // shared SYSTEM_PROMPT (and the OpenAI path) is untouched.
        const localRules = localRulesFor(areas);
        const localMessages = messages.map((m) =>
            m.role === "system" ? { ...m, content: `${m.content}\n\n${localRules}` } : m
        );
        const chat = await client.chat.completions.create(
            { model, messages: localMessages, temperature: 0.2 },
            { signal }
        );

        const raw = chat.choices[0]?.message?.content;
        const code = typeof raw === "string" ? stripCodeFence(raw) : "";
        if (code === "") {
            return fallback(template(), "empty_completion", model);
        }

        // Phase 30 Acceptance Criterion 1: the local model has invented
        // Playwright APIs (toBeAccessible), so its suite must type-check before
        // it is labelled model output. Fails closed if the check can't run.
        let typeErrors: string[];
        try {
            typeErrors = findTypeErrors(code);
        } catch (checkError) {
            typeErrors = [`type check could not run: ${checkError instanceof Error ? checkError.message : checkError}`];
        }
        if (typeErrors.length > 0) {
            console.error(
                `[api/generate] ${model} returned a suite that does not type-check against @playwright/test, using template generator:\n  ${typeErrors.slice(0, 5).join("\n  ")}`
            );
            return fallback(template(), "invalid_output", model);
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
            unawaited = [`await check could not run: ${checkError instanceof Error ? checkError.message : checkError}`];
        }
        if (unawaited.length > 0) {
            console.error(
                `[api/generate] ${model} returned a suite with assertions that are never awaited, using template generator:\n  ${unawaited.slice(0, 5).join("\n  ")}`
            );
            return fallback(template(), "unawaited_assertion", model);
        }
        return NextResponse.json({ code, generatedBy: "ollama", model });
    } catch (error) {
        console.error(
            "[api/generate] Ollama call failed, using template generator:",
            error instanceof Error ? error.message : error
        );
        // A refused connection surfaces as APIConnectionError; anything else
        // (e.g. Ollama answering 500 because the model failed to load) got a
        // response, so it is not "unreachable".
        const reason: FallbackReason = signal.aborted
            ? "timeout"
            : error instanceof APIConnectionError
              ? "ollama_unreachable"
              : "ollama_error";
        return fallback(template(), reason);
    }
}

type FallbackReason =
    | "openai_error"
    | "timeout"
    | "empty_completion"
    | "no_candidate_model"
    | "ollama_unreachable"
    | "ollama_model_missing"
    | "ollama_error"
    | "invalid_output"
    | "unawaited_assertion";

function fallback(code: string, fallbackReason: FallbackReason, model?: string) {
    return NextResponse.json({ code, generatedBy: "fallback", fallbackReason, ...(model ? { model } : {}) });
}

const DEFAULT_OPENAI_TIMEOUT_MS = 30_000;
// Phase 30 Decision 3: a local 7B model measured 53-74s per generation.
const DEFAULT_OLLAMA_TIMEOUT_MS = 180_000;

// Overridable so tests can prove the timeout path without waiting it out.
function timeoutMs(envName: string, fallbackMs: number): number {
    const raw = Number(process.env[envName]);
    return Number.isFinite(raw) && raw > 0 ? raw : fallbackMs;
}
