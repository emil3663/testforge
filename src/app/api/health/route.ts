import { NextResponse } from "next/server";
import { getBackendBaseUrl, isExternalBackendEnabled } from "@/lib/backend-proxy";
import { getSiteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function GET() {
    const backendBaseUrl = getBackendBaseUrl();

    return NextResponse.json({
        status: "ok",
        service: "testforge-next",
        environment: process.env.TESTFORGE_ENV ?? process.env.NODE_ENV ?? "development",
        siteUrl: getSiteUrl(),
        externalBackendEnabled: isExternalBackendEnabled(),
        backendBaseUrl,
        timestamp: new Date().toISOString(),
    });
}