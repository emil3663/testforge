import type { RunRecord } from "@/lib/run/persistence";
import { claimedBy, releaseClaim } from "./claims.ts";
import type { NapiClient } from "./client.ts";

/**
 * A finished run into napi, as it was persisted to runs/<runId>/run.json.
 * The wire is TestForge's own record: napi maps it on its side
 * (testforge-runs · ingest), so nothing here is reshaped for it. Best effort:
 * a push that fails is logged and never fails the run.
 */

/** The record as napi gets it: whole, minus the crawl snapshot napi deliberately does not keep (a page is a path there). */
export function recordForNapi(record: RunRecord): RunRecord {
    return { ...record, contentProfile: null };
}

export async function pushRunToNapi(client: NapiClient, record: RunRecord, log: (line: string) => void = console.log): Promise<boolean> {
    const claim = claimedBy(record.runId);
    try {
        const { status } = await client.ingestRun(recordForNapi(record), claim?.runUid);
        log(`napi: run ${record.runId} ${status === 201 ? "created" : "updated"}${claim ? ` on ${claim.runUid}` : ""}`);
        releaseClaim(record.runId);
        return true;
    } catch (error) {
        log(`napi: run ${record.runId} was not pushed: ${error instanceof Error ? error.message : String(error)}`);
        return false;
    }
}
