import { activeClaims, claimRun } from "./claims.ts";
import type { FetchLike, NapiClient, NapiRunConfig } from "./client.ts";
import type { NapiConfig } from "./config.ts";

/**
 * Runs asked for in napi (Lighthouse's Forge): the poller finds queued runs,
 * claims one (hand-off, taken once), and runs it through this server's own
 * /api/generate and /api/run, exactly as the UI would. When the run finishes,
 * the push lands its record on the claimed row. A stop asked for in napi
 * ("stopping") cancels the run here. napi never calls TestForge: the network
 * runs one way, as it does for guardian360/pentest's agent.
 */

/** The body /api/generate takes for a napi run config. */
export function generateBody(config: NapiRunConfig): Record<string, unknown> {
    return {
        baseUrl: config.baseUrl,
        description: config.description?.trim() || DEFAULT_DESCRIPTION,
        selectedPractices: config.selectedPractices,
        auditMode: config.auditMode,
    };
}

/** The body /api/run takes, given what /api/generate answered. */
export function runBody(config: NapiRunConfig, generated: Record<string, unknown>): Record<string, unknown> {
    const { code, ...rest } = generated;
    return {
        code,
        baseUrl: config.baseUrl,
        description: config.description?.trim() || DEFAULT_DESCRIPTION,
        selectedPractices: config.selectedPractices,
        auditMode: config.auditMode,
        login: config.login ?? undefined,
        // A template-only generation answers without `generatedBy`; "template" is what wrote that suite.
        generation: { generatedBy: "template", ...rest },
    };
}

export const DEFAULT_DESCRIPTION = "Run asked for in Lighthouse";

export interface PollerDeps {
    client: NapiClient;
    config: NapiConfig;
    fetchImpl?: FetchLike;
    log?: (line: string) => void;
}

/** One pass: claim and start every queued run, cancel what napi asked to stop. Exported for the tests; the interval calls it. */
export async function pollOnce({ client, config, fetchImpl = fetch, log = console.log }: PollerDeps): Promise<void> {
    for (const [runId, claim] of activeClaims()) {
        const row = await client.run(claim.uuid).catch(() => null);
        if (row?.status === "stopping") {
            // Asked every tick until the run is actually running here (a job
            // still generating has no process to kill yet), said once.
            await fetchImpl(`${config.selfUrl}/api/run`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ runId }) }).catch(() => null);
            if (!claim.cancelled) log(`napi: run ${runId} cancelled, as napi asked`);
            claim.cancelled = true;
        }
    }

    for (const row of await client.queuedRuns()) {
        if (!row.scope_file || typeof row.scope_file.baseUrl !== "string") {
            log(`napi: queued run ${row.run_uid} has no config; left alone`);
            continue;
        }
        if (!(await client.handOff(row.uuid))) continue; // another TestForge took it

        const generated = await fetchImpl(`${config.selfUrl}/api/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(generateBody(row.scope_file)),
        });
        const generatedJson = (await generated.json().catch(() => ({}))) as Record<string, unknown>;
        if (!generated.ok || typeof generatedJson.code !== "string") {
            log(`napi: run ${row.run_uid}: generation failed (${generated.status}) ${String(generatedJson.error ?? "")}`);
            continue;
        }

        const started = await fetchImpl(`${config.selfUrl}/api/run`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(runBody(row.scope_file, generatedJson)),
        });
        const job = (await started.json().catch(() => ({}))) as { runId?: string; error?: string };
        if (!started.ok || typeof job.runId !== "string") {
            log(`napi: run ${row.run_uid}: did not start (${started.status}) ${job.error ?? ""}`);
            continue;
        }
        claimRun(job.runId, { uuid: row.uuid, runUid: row.run_uid });
        log(`napi: run ${row.run_uid} started here as ${job.runId}`);
    }
}

export function startNapiPoller(deps: PollerDeps): () => void {
    let busy = false;
    const tick = async () => {
        if (busy) return;
        busy = true;
        try {
            await pollOnce(deps);
        } catch (error) {
            (deps.log ?? console.log)(`napi: poll failed: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            busy = false;
        }
    };
    const handle = setInterval(() => void tick(), deps.config.pollSeconds * 1000);
    handle.unref?.();
    void tick();
    return () => clearInterval(handle);
}
