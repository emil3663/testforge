import { NextRequest, NextResponse } from "next/server";
import { archiveRun, listRunRecords, setRunPinned, sweepAutomaticArchiving } from "@/lib/run/persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    const records = await listRunRecords();
    return NextResponse.json({ runs: records });
}

export async function PATCH(req: NextRequest) {
    const { runId, pinned, archive } = await req.json().catch(() => ({}));

    if (!runId || typeof runId !== "string") {
        return NextResponse.json({ error: "runId is required" }, { status: 400 });
    }

    if (archive === true) {
        const record = await archiveRun(runId);

        if (!record) {
            return NextResponse.json({ error: "Run not found" }, { status: 404 });
        }

        return NextResponse.json(record);
    }

    if (typeof pinned === "boolean") {
        const record = await setRunPinned(runId, pinned);

        if (!record) {
            return NextResponse.json({ error: "Run not found" }, { status: 404 });
        }

        return NextResponse.json(record);
    }

    return NextResponse.json({ error: "pinned (boolean) or archive: true is required" }, { status: 400 });
}

export async function POST(req: NextRequest) {
    const { action } = await req.json().catch(() => ({}));

    if (action !== "sweep") {
        return NextResponse.json({ error: "Only the 'sweep' action is supported" }, { status: 400 });
    }

    const archivedRunIds = await sweepAutomaticArchiving();
    return NextResponse.json({ archivedRunIds });
}
