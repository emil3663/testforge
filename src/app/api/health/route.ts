import { NextResponse } from "next/server";
import { getSiteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function GET() {
    return NextResponse.json({
        status: "ok",
        service: "testforge-next",
        environment: process.env.TESTFORGE_ENV ?? process.env.NODE_ENV ?? "development",
        siteUrl: getSiteUrl(),
        timestamp: new Date().toISOString(),
    });
}