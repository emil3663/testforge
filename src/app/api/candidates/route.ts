import { NextRequest, NextResponse } from "next/server";
import { loadPool } from "@/lib/candidates/pool";
import { approveCandidate, labelRun, offeredCandidates, PromotionError, promotionVerdict, rejectCandidate } from "@/lib/candidates/promotion";

/**
 * Phase 42 (TFP-196): the candidate pool and its promotion decisions.
 *
 *   GET  /api/candidates   every candidate with its verdict on the rule, and
 *                          `offered`: the ones meeting it, for Emil's approval
 *   POST /api/candidates   { action: "approve", id, by }
 *                          { action: "reject", id, reason }
 *                          { action: "label", id, run, label: "real" | "not a defect", bug? }
 *
 * Approval only marks a candidate for its library commit, which Claude Code
 * makes (`npm run library:promote`, then a reviewed commit).
 */

export async function GET() {
    const pool = await loadPool();
    const offered = await offeredCandidates();
    return NextResponse.json({
        candidates: pool.map((candidate) => ({ ...candidate, verdict: promotionVerdict(candidate) })),
        offered: offered.map(({ candidate }) => candidate.id),
    });
}

export async function POST(req: NextRequest) {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const id = typeof body.id === "string" ? body.id : "";
    try {
        if (body.action === "approve") {
            if (typeof body.by !== "string" || !body.by.trim()) return NextResponse.json({ error: "an approval names who approved it (by)" }, { status: 400 });
            return NextResponse.json(await approveCandidate(id, body.by.trim()));
        }
        if (body.action === "reject") return NextResponse.json(await rejectCandidate(id, typeof body.reason === "string" ? body.reason : ""));
        if (body.action === "label") {
            if (body.label !== "real" && body.label !== "not a defect") return NextResponse.json({ error: 'label must be "real" or "not a defect"' }, { status: 400 });
            const bug = typeof body.bug === "number" && Number.isInteger(body.bug) && body.bug > 0 ? body.bug : undefined;
            return NextResponse.json(await labelRun(id, typeof body.run === "string" ? body.run : "", body.label, bug));
        }
        return NextResponse.json({ error: 'action must be "approve", "reject" or "label"' }, { status: 400 });
    } catch (error) {
        if (error instanceof PromotionError) return NextResponse.json({ error: error.message }, { status: 409 });
        throw error;
    }
}
