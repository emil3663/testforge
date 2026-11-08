import { NextResponse } from "next/server";
import { getSiteUrl } from "@/lib/seo";
import { setting } from "@/lib/settings";
import { currentVersion } from "@/lib/version";

export const dynamic = "force-dynamic";

export async function GET() {
    return NextResponse.json({
        status: "ok",
        service: "testforge-next",
        ...currentVersion(),
        environment: setting("ENV") ?? process.env.NODE_ENV ?? "development",
        mode: "local-in-process",
        siteUrl: getSiteUrl(),
        timestamp: new Date().toISOString(),
    });
}