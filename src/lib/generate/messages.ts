import type OpenAI from "openai";
import type { ContentProfile, ContentRules, TestAuditMode } from "./mock/types";
import { SYSTEM_PROMPT } from "./prompt";

// The chat messages POST /api/generate sends a model, moved out of the route
// in Phase 36 (TFP-126) so the local-model benchmark sends exactly what the
// route does instead of a retyped copy. Unchanged in content: measured by
// capturing every chat body the route sent before and after the move.

export interface GenerationRequestContext {
    baseUrl: string;
    auditMode: TestAuditMode;
    contentRules: ContentRules;
    contentProfile: ContentProfile | null;
    description: string;
}

type Messages = OpenAI.Chat.Completions.ChatCompletionMessageParam[];

function userMessage(ctx: GenerationRequestContext, coverage: string, extra = "") {
    return `Base URL: ${ctx.baseUrl}\nAudit mode: ${ctx.auditMode}\nSelected best-practice coverage: ${coverage}\nContent rules: ${JSON.stringify(ctx.contentRules, null, 2)}\nPage inspection profile: ${JSON.stringify(ctx.contentProfile, null, 2)}\n\nTest description:\n${ctx.description}${extra}`;
}

/** The OpenAI path: the whole suite, for the selected areas or the prompt's. */
export function buildGenerationMessages(ctx: GenerationRequestContext, selectedPractices: readonly string[]): Messages {
    return [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage(ctx, selectedPractices.length > 0 ? selectedPractices.join(", ") : "infer from prompt") },
    ];
}

/** Option B (Phase 34): the local model is asked only for the gap areas. */
export function buildGapFillMessages(ctx: GenerationRequestContext, gapAreas: readonly string[]): Messages {
    return [
        { role: "system", content: SYSTEM_PROMPT },
        {
            role: "user",
            content: userMessage(
                ctx,
                gapAreas.join(", "),
                `\n\nWrite tests only for these coverage areas: ${gapAreas.join(", ")}. The other areas are already covered by another generator - do not write tests for them.`
            ),
        },
    ];
}
