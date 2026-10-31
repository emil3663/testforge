import { NextResponse } from "next/server";
import { getSiteUrl } from "@/lib/seo";
import { currentVersion } from "@/lib/version";

export const dynamic = "force-dynamic";

export async function GET() {
    return NextResponse.json({
        status: "ok",
        service: "testforge-next",
        ...currentVersion(),
        environment: process.env.TESTFORGE_ENV ?? process.env.NODE_ENV ?? "development",
        mode: "local-in-process",
        siteUrl: getSiteUrl(),
        timestamp: new Date().toISOString(),
    });
}