import { NextRequest, NextResponse } from "next/server";
import { diffRuns } from "@/lib/run/diff";
import { isValidRunId } from "@/lib/run/persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const runIdA = req.nextUrl.searchParams.get("a");
    const runIdB = req.nextUrl.searchParams.get("b");

    if (!runIdA || !runIdB) {
        return NextResponse.json({ error: "Both a and b runId query params are required" }, { status: 400 });
    }

    if (!isValidRunId(runIdA) || !isValidRunId(runIdB)) {
        return NextResponse.json({ error: "a and b must be valid UUIDs" }, { status: 400 });
    }

    const result = await diffRuns(runIdA, runIdB);

    if (!result.ok) {
        if (result.error === "different-base-url") {
            return NextResponse.json({ error: "Runs a and b have different baseUrl values and cannot be diffed" }, { status: 400 });
        }

        const which = result.error === "not-found-a" ? "a" : "b";
        return NextResponse.json({ error: `Run ${which} was not found` }, { status: 404 });
    }

    return NextResponse.json(result.diff);
}
