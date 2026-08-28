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
import { SYSTEM_PROMPT } from "@/lib/generate/prompt";

export async function POST(req: NextRequest) {
    const { baseUrl, description, selectedPractices, contentProfile, contentRules, auditMode } = await req.json();

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
    const normalizedAuditMode = normalizeTestAuditMode(auditMode);
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
        const code = mockGenerate(
            normalizedBaseUrl.value,
            description,
            normalizedPractices,
            normalizedContentProfile,
            normalizedContentRules,
            normalizedAuditMode
        );
        return NextResponse.json({ code });
    }

    const client = new OpenAI({ apiKey });

    const chat = await client.chat.completions.create({
        model: "gpt-4o",
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
    });

    const code = chat.choices[0]?.message?.content ?? "";
    return NextResponse.json({ code });
}
