import { NextRequest, NextResponse } from "next/server";
import { normalizeBaseUrl } from "@/lib/generate/normalize";
import { GAP_WRITERS, loadSiteSettings, saveSiteSettings, type GapWriterSetting } from "@/lib/gap-writer/settings";

/**
 * Phase 42 (TFP-194, Decision 6): a site's settings, by its origin. Today
 * one: who writes its gap tests - "off" (the default), "claude-code" or
 * "local-model". Turning it on sends that site's page structure to the
 * writer on later generations.
 *
 *   GET  /api/site-settings?baseUrl=<url>
 *   POST /api/site-settings { baseUrl, gapWriter }
 */

/** The site's origin; a settings request must name its site (normalizeBaseUrl would put the default one in for none). */
function originOf(baseUrl: unknown): string | null {
    if (typeof baseUrl !== "string" || !baseUrl.trim()) return null;
    const normalized = normalizeBaseUrl(baseUrl);
    return normalized.ok ? new URL(normalized.value).origin : null;
}

export async function GET(req: NextRequest) {
    const origin = originOf(req.nextUrl.searchParams.get("baseUrl"));
    if (!origin) return NextResponse.json({ error: "baseUrl must be a valid http(s) URL" }, { status: 400 });
    return NextResponse.json({ origin, ...(await loadSiteSettings(origin)) });
}

export async function POST(req: NextRequest) {
    const { baseUrl, gapWriter } = await req.json().catch(() => ({}));
    const origin = originOf(baseUrl);
    if (!origin) return NextResponse.json({ error: "baseUrl must be a valid http(s) URL" }, { status: 400 });
    if (!(GAP_WRITERS as readonly unknown[]).includes(gapWriter)) {
        return NextResponse.json({ error: `gapWriter must be one of ${GAP_WRITERS.join(", ")}` }, { status: 400 });
    }
    await saveSiteSettings(origin, { gapWriter: gapWriter as GapWriterSetting });
    return NextResponse.json({ origin, gapWriter });
}
