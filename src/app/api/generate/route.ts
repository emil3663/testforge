import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { mockGenerate, mockGenerateDetailed } from "@/lib/generate/mock";
import {
    normalizeBaseUrl,
    normalizeContentProfile,
    normalizeContentRules,
    normalizeSelectedPractices,
    normalizeTestAuditMode,
} from "@/lib/generate/normalize";
import { pickModel } from "@/lib/generate/models";
import { countGate, type GateVerdict } from "@/lib/generate/gates";
import { findGapAreas, mergeLocalSuite } from "@/lib/generate/gap-fill";
import { generateLocalSuite, type LocalFailureReason } from "@/lib/generate/local-generation";
import { findTypeErrors } from "@/lib/generate/validate";
import { inspectForGeneration } from "@/lib/generate/page-inspection";
import type { PageInspectionRecord } from "@/lib/report/types";
import type { BestPracticeArea } from "@/lib/generate/mock/types";
import { buildGapFillMessages, buildGenerationMessages, type GenerationRequestContext } from "@/lib/generate/messages";
import { selectJourneys } from "@/lib/introspect/journeys";
import { isComprehensive, normalizeRunMode, RunModeError, type RunMode } from "@/lib/comprehensive/run-mode";
import { selectComprehensivePages } from "@/lib/comprehensive/pages";
import { buildComprehensiveSuite, mergeComprehensiveScenarios } from "@/lib/generate/comprehensive";

export async function POST(req: NextRequest) {
    const { baseUrl, description, selectedPractices, contentProfile, contentRules, auditMode, autoInspect, runMode } = await req.json().catch(() => ({}));

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

    // Phase 35 (TFP-132): absent means a Standard run, handled exactly as
    // before. An invalid Comprehensive request is refused, never run as
    // something else.
    let normalizedRunMode: RunMode;
    try {
        normalizedRunMode = normalizeRunMode(runMode);
    } catch (error) {
        if (error instanceof RunModeError) return NextResponse.json({ error: error.message }, { status: 400 });
        throw error;
    }

    const normalizedPractices = normalizeSelectedPractices(selectedPractices);
    let normalizedContentProfile = normalizeContentProfile(contentProfile);

    // Phase 34 TFP-122 (Decision 11): no page data in the request means the
    // pages are inspected here, as the app's own flow would, unless the caller
    // opts out with `autoInspect: false`. A failed inspection never blocks
    // generation: it continues without page data and says why.
    let pageInspection: PageInspectionRecord | undefined;
    if (!normalizedContentProfile && autoInspect !== false) {
        const requestedPaths = contentRules && typeof contentRules === "object" ? (contentRules as { paths?: unknown }).paths : undefined;
        const inspection = await inspectForGeneration(normalizedBaseUrl.value, requestedPaths);
        pageInspection = inspection.record;
        normalizedContentProfile = normalizeContentProfile(inspection.profile);
    }
    // Every response below goes through here. Without an automatic inspection
    // it is exactly what it was before TFP-122; with one, it says so.
    const respond = (body: Record<string, unknown>) =>
        NextResponse.json(pageInspection ? { ...body, generatedBy: body.generatedBy ?? "template", pageInspection } : body);

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

    const requestContext: GenerationRequestContext = {
        baseUrl: normalizedBaseUrl.value,
        auditMode: normalizedAuditMode,
        contentRules: normalizedContentRules,
        contentProfile: normalizedContentProfile,
        description,
    };
    // Phase 35 (TFP-132, Decisions 1 and 2): one area, every known page up to
    // the cap, its own suite. TFP-135 (Decision 5): with a local model
    // configured, it is also asked for site-specific scenarios for that area
    // - Phase 37's plain request for the one area - under every existing
    // gate; they are appended in their own block and kept outside the
    // verdict. Rejected or timed out, the template's checks stand alone.
    if (isComprehensive(normalizedRunMode)) {
        const pageScope = selectComprehensivePages(normalizedContentProfile, normalizedBaseUrl.value, normalizedRunMode.pageCap);
        const suite = buildComprehensiveSuite(normalizedBaseUrl.value, normalizedRunMode, pageScope);
        const scope = { runMode: normalizedRunMode, pageScope };
        const localModel = process.env.TESTFORGE_OLLAMA_MODEL?.trim();
        if (!localModel) return respond({ code: suite, generatedBy: "template", ...scope, gates: [] });
        const area = [normalizedRunMode.area];
        const local = await generateLocalSuite(localModel, buildGenerationMessages(requestContext, area), area);
        if (!local.ok) return respond({ code: suite, generatedBy: "fallback", fallbackReason: local.reason, ...(local.model ? { model: local.model } : {}), ...scope, gates: local.gates });
        const merged = mergeComprehensiveScenarios(suite, local.code, local.model, normalizedRunMode);
        let mergeErrors: string[];
        try {
            mergeErrors = findTypeErrors(merged);
        } catch (checkError) {
            mergeErrors = [`type check could not run: ${checkError instanceof Error ? checkError.message : checkError}`];
        }
        const gates = [...local.gates, countGate("merged suite type check", "type errors", mergeErrors)];
        if (mergeErrors.length > 0) return respond({ code: suite, generatedBy: "fallback", fallbackReason: "invalid_output", model: local.model, ...scope, gates });
        return respond({ code: merged, generatedBy: "template+ollama", model: local.model, ...scope, gates });
    }

    const messages = buildGenerationMessages(requestContext, normalizedPractices);

    // Phase 30 Decision 5: a configured local model wins over an OpenAI key.
    // Phase 34 (TFP-118): it no longer replaces the template - it fills only
    // the areas the template left without tests (Phase 21 TFP-100, Option B).
    const ollamaModel = process.env.TESTFORGE_OLLAMA_MODEL?.trim();
    if (ollamaModel) {
        const generated = mockGenerateDetailed(
            normalizedBaseUrl.value,
            description,
            normalizedPractices,
            normalizedContentProfile,
            normalizedContentRules,
            normalizedAuditMode
        );
        const gapAreas = findGapAreas(generated.areas, generated.testsByArea, generated.notApplicable);
        const notApplicableAreas = Object.keys(generated.notApplicable);
        if (gapAreas.length === 0) {
            return respond({ code: generated.code, generatedBy: "template", gapFill: { gapAreas, outcome: "no-gaps", notApplicableAreas }, gates: [] });
        }

        const gapMessages = buildGapFillMessages(requestContext, gapAreas);
        const local = await generateLocalSuite(ollamaModel, gapMessages, gapAreas);
        if (!local.ok) {
            return respond(gapFillFallback(generated.code, local.reason, gapAreas, notApplicableAreas, local.gates, local.model));
        }

        // The merged file is checked again: the wrapping can fail on code the
        // standalone check accepted (another import, a clashing name).
        const merged = mergeLocalSuite(generated.code, local.code, local.model, gapAreas);
        let mergeErrors: string[];
        try {
            mergeErrors = findTypeErrors(merged);
        } catch (checkError) {
            mergeErrors = [`type check could not run: ${checkError instanceof Error ? checkError.message : checkError}`];
        }
        const gates = [...local.gates, countGate("merged suite type check", "type errors", mergeErrors)];
        if (mergeErrors.length > 0) {
            console.error(`[api/generate] ${local.model}'s tests do not type-check once appended to the template suite, using template alone:\n  ${mergeErrors.slice(0, 5).join("\n  ")}`);
            return respond(gapFillFallback(generated.code, "invalid_output", gapAreas, notApplicableAreas, gates, local.model));
        }
        return respond({ code: merged, generatedBy: "template+ollama", model: local.model, gapFill: { gapAreas, outcome: "added", notApplicableAreas }, gates });
    }

    if (!apiKey) {
        return respond({ code: template() });
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
            return respond(fallback(template(), "no_candidate_model"));
        }

        const chat = await client.chat.completions.create({ model, messages, temperature: 0.2 }, { signal });

        const code = chat.choices[0]?.message?.content;
        if (typeof code !== "string" || code.trim() === "") {
            return respond(fallback(template(), "empty_completion", model));
        }
        return respond({ code, generatedBy: "openai", model });
    } catch (error) {
        console.error(
            "[api/generate] OpenAI call failed, using template generator:",
            error instanceof Error ? error.message : error
        );
        return respond(fallback(template(), signal.aborted ? "timeout" : "openai_error"));
    }
}

type FallbackReason = "openai_error" | "timeout" | "empty_completion" | "no_candidate_model" | LocalFailureReason;

function fallback(code: string, fallbackReason: FallbackReason, model?: string) {
    return { code, generatedBy: "fallback", fallbackReason, ...(model ? { model } : {}) };
}

/**
 * Option B's failure shape: the template suite, unchanged, with why the gap
 * areas stayed empty and every gate verdict that led there.
 */
function gapFillFallback(code: string, fallbackReason: LocalFailureReason, gapAreas: BestPracticeArea[], notApplicableAreas: string[], gates: GateVerdict[], model?: string) {
    return {
        code,
        generatedBy: "fallback",
        fallbackReason,
        ...(model ? { model } : {}),
        gapFill: { gapAreas, outcome: "rejected", notApplicableAreas },
        gates,
    };
}

const DEFAULT_OPENAI_TIMEOUT_MS = 30_000;

// Overridable so tests can prove the timeout path without waiting it out.
function timeoutMs(envName: string, fallbackMs: number): number {
    const raw = Number(process.env[envName]);
    return Number.isFinite(raw) && raw > 0 ? raw : fallbackMs;
}
