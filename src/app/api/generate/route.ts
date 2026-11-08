import { NextRequest, NextResponse } from "next/server";
import { generateSuite } from "@/lib/pipeline/generate";

// Phase 47 Decision 4 (TFP-263): the generation is in src/lib/pipeline, shared with the CLI; this is the HTTP front end.
export async function POST(req: NextRequest) {
    const outcome = await generateSuite(await req.json().catch(() => ({})));
    return outcome.ok
        ? NextResponse.json(outcome.body)
        : NextResponse.json({ error: outcome.error }, { status: 400 });
}
