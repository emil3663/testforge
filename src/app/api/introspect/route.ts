import { NextRequest, NextResponse } from "next/server";
import { inspectPages } from "@/lib/introspect/inspector";

// Only correct when TestForge is testing itself. For any other target
// (Plane on :80, test-assist on :4321, ...) the caller must supply baseUrl.
const DEFAULT_BASE_URL = "http://localhost:3000";
const MAX_PATHS = 5;

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

function getDefaultInspectionPath(baseUrl: string) {
    try {
        const pathname = new URL(baseUrl).pathname || "/";
        return pathname === "/" ? "/" : pathname.replace(/\/$/, "");
    } catch {
        return "/";
    }
}

function normalizePaths(baseUrl: string, input: unknown) {
    if (!Array.isArray(input)) {
        return [getDefaultInspectionPath(baseUrl)];
    }

    const uniquePaths = [...new Set(
        input
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim())
            .filter(Boolean)
            .map((item) => (item.startsWith("/") ? item : `/${item}`))
    )].slice(0, MAX_PATHS);

    return uniquePaths.length > 0 ? uniquePaths : [getDefaultInspectionPath(baseUrl)];
}

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
        return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
    }

    const { baseUrl, paths } = body;

    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

    if (!normalizedBaseUrl.ok) {
        return NextResponse.json({ error: normalizedBaseUrl.message }, { status: 400 });
    }

    const normalizedPaths = normalizePaths(normalizedBaseUrl.value, paths);
    const { pages, warnings } = await inspectPages(normalizedBaseUrl.value, normalizedPaths);

    return NextResponse.json({
        scannedAt: new Date().toISOString(),
        baseUrl: normalizedBaseUrl.value,
        pages,
        warnings,
    });
}
