import { NextRequest, NextResponse } from "next/server";
import { inspectPages } from "@/lib/introspect/inspector";
import { normalizeNamedFlows } from "@/lib/introspect/journeys";
import { normalizeInspectionPathList } from "@/lib/introspect/paths";

// Only correct when TestForge is testing itself. For any other target
// (Plane on :80, test-assist on :4321, ...) the caller must supply baseUrl.
const DEFAULT_BASE_URL = "http://localhost:3000";

function normalizeBaseUrl(baseUrl: unknown) {
    if (typeof baseUrl !== "string" || !baseUrl.trim()) {
        return { ok: true as const, value: DEFAULT_BASE_URL };
    }

    const trimmed = baseUrl.trim();
    const withProtocol = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(trimmed)
        ? trimmed
        : `http://${trimmed}`;

    try {
        const normalized = new URL(withProtocol);
        normalized.hash = "";
        return {
            ok: true as const,
            value: normalized.toString().replace(/\/$/, ""),
        };
    } catch {
        return {
            ok: false as const,
            message: "baseUrl must be a valid URL",
        };
    }
}

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
        return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
    }

    const { baseUrl, paths, namedFlows } = body;

    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

    if (!normalizedBaseUrl.ok) {
        return NextResponse.json({ error: normalizedBaseUrl.message }, { status: 400 });
    }

    const normalizedPaths = normalizeInspectionPathList(normalizedBaseUrl.value, paths);
    const { pages, warnings, dependencyMap, siteGraph, journeys } = await inspectPages(
        normalizedBaseUrl.value,
        normalizedPaths,
        normalizeNamedFlows(namedFlows)
    );

    return NextResponse.json({
        scannedAt: new Date().toISOString(),
        baseUrl: normalizedBaseUrl.value,
        pages,
        warnings,
        dependencyMap,
        siteGraph,
        journeys,
    });
}
