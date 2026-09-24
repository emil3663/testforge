import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { mockGenerate } from "@/lib/generate/mock";
import {
    normalizeBaseUrl,
    normalizeContentProfile,
    normalizeContentRules,
    normalizeSelectedPractices,
    normalizeTestAuditMode,
} from "@/lib/generate/normalize";
import { pickModel } from "@/lib/generate/models";
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

    if (!apiKey) {
        return NextResponse.json({ code: template() });
    }

    // TFP-083: every failure of the OpenAI call (rejection, timeout, no
    // usable model, empty completion) degrades to the template generator and
    // is labelled, so template output is never passed off as AI output.
    // One budget covers the catalog lookup and the completion together.
    const signal = AbortSignal.timeout(openAiTimeoutMs());
    try {
        // maxRetries: 0 - the SDK would otherwise retry timeouts and 5xx,
        // silently multiplying the wait beyond the budget above.
        const client = new OpenAI({ apiKey, maxRetries: 0 });

        const catalog = await client.models.list({ signal });
        const model = pickModel(catalog.data.map((m) => m.id));
        if (!model) {
            return fallback(template(), "no_candidate_model");
        }

        const chat = await client.chat.completions.create(
            {
                model,
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    {
                        role: "user",
                        content: `Base URL: ${normalizedBaseUrl.value}\nAudit mode: ${normalizedAuditMode}\nSelected best-practice coverage: ${normalizedPractices.length > 0 ? normalizedPractices.join(
                            ", "
                        ) : "infer from prompt"}\nContent rules: ${JSON.stringify(normalizedContentRules, null, 2)}\nPage inspection profile: ${JSON.stringify(normalizedContentProfile, null, 2)}\n\nTest description:\n${description}`,
                    },
                ],
                temperature: 0.2,
            },
            { signal }
        );

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

type FallbackReason = "openai_error" | "timeout" | "empty_completion" | "no_candidate_model";

function fallback(code: string, fallbackReason: FallbackReason, model?: string) {
    return NextResponse.json({ code, generatedBy: "fallback", fallbackReason, ...(model ? { model } : {}) });
}

const DEFAULT_OPENAI_TIMEOUT_MS = 30_000;

// Overridable so tests can prove the timeout path without waiting it out.
function openAiTimeoutMs(): number {
    const raw = Number(process.env.TESTFORGE_OPENAI_TIMEOUT_MS);
    return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_OPENAI_TIMEOUT_MS;
}
