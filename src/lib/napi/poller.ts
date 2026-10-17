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

/** What discovery found: the pages the crawl selected, and the inspection of them. */
export interface Discovery {
    paths: string[];
    contentProfile: Record<string, unknown> | null;
    pageTypes?: unknown;
}

/** The body /api/generate takes for a napi run config, with what discovery found. */
export function generateBody(config: NapiRunConfig, discovery?: Discovery): Record<string, unknown> {
    return {
        baseUrl: config.baseUrl,
        description: config.description?.trim() || DEFAULT_DESCRIPTION,
        selectedPractices: config.selectedPractices,
        auditMode: config.auditMode,
        ...(discovery?.paths.length ? { contentRules: { paths: discovery.paths } } : {}),
        ...(discovery?.contentProfile ? { contentProfile: discovery.contentProfile } : {}),
    };
}

/** The body /api/run takes, given what /api/generate answered. */
export function runBody(config: NapiRunConfig, generated: Record<string, unknown>, discovery?: Discovery): Record<string, unknown> {
    const { code, ...rest } = generated;
    return {
        // The inspection is what the report's coverage map and untouched surface are measured against.
        ...(discovery?.contentProfile ? { contentProfile: discovery.contentProfile } : {}),
        code,
        baseUrl: config.baseUrl,
        description: config.description?.trim() || DEFAULT_DESCRIPTION,
        selectedPractices: config.selectedPractices,
        auditMode: config.auditMode,
        login: config.login ?? undefined,
        // A template-only generation answers without `generatedBy`; "template" is what wrote that suite.
        generation: { generatedBy: "template", ...rest, ...(discovery?.pageTypes ? { pageTypes: discovery.pageTypes } : {}) },
    };
}

const CRAWL_POLL_MS = 2000;
const CRAWL_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * Discovery as the UI does it: crawl the site (same-origin, breadth-first),
 * take the pages the crawl selects for a Standard run, inspect them. A crawl
 * that fails or finds nothing falls back to the base page alone, and says so;
 * it never stops the run.
 */
export async function discover(config: NapiRunConfig, selfUrl: string, fetchImpl: FetchLike, log: (line: string) => void, sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))): Promise<Discovery> {
    let paths: string[] = [];
    let pageTypes: unknown;
    try {
        const started = await fetchImpl(`${selfUrl}/api/crawl`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ baseUrl: config.baseUrl }) });
        const first = (await started.json()) as { crawlId?: string };
        const deadline = Date.now() + CRAWL_TIMEOUT_MS;
        let snapshot: { crawlStatus?: string; result?: { pages?: Array<{ path: string }>; pageSelection?: { standard?: { pages?: string[] } } }; error?: string } = {};
        while (first.crawlId && Date.now() < deadline) {
            await sleep(CRAWL_POLL_MS);
            snapshot = (await (await fetchImpl(`${selfUrl}/api/crawl?crawlId=${encodeURIComponent(first.crawlId)}`)).json()) as typeof snapshot;
            if (snapshot.crawlStatus !== "running") break;
        }
        const selected = snapshot.result?.pageSelection?.standard?.pages;
        paths = selected?.length ? selected : (snapshot.result?.pages ?? []).map((page) => page.path);
        pageTypes = snapshot.result?.pageSelection?.standard;
        log(`napi: crawl of ${config.baseUrl}: ${snapshot.crawlStatus ?? "no answer"}, ${snapshot.result?.pages?.length ?? 0} page(s) found, ${paths.length} selected${snapshot.error ? ` (${snapshot.error})` : ""}`);
    } catch (error) {
        log(`napi: crawl of ${config.baseUrl} failed, the base page alone is tested: ${error instanceof Error ? error.message : String(error)}`);
    }

    let contentProfile: Record<string, unknown> | null = null;
    try {
        const inspected = await fetchImpl(`${selfUrl}/api/introspect`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ baseUrl: config.baseUrl, ...(paths.length ? { paths } : {}) }) });
        if (inspected.ok) contentProfile = (await inspected.json()) as Record<string, unknown>;
    } catch {
        // Generation inspects on its own when it gets no profile.
    }
    return { paths, contentProfile, pageTypes };
}

export const DEFAULT_DESCRIPTION = "Run asked for in Lighthouse";

export interface PollerDeps {
    client: NapiClient;
    config: NapiConfig;
    fetchImpl?: FetchLike;
    log?: (line: string) => void;
    sleep?: (ms: number) => Promise<void>;
}

/** One pass: claim and start every queued run, cancel what napi asked to stop. Exported for the tests; the interval calls it. */
export async function pollOnce({ client, config, fetchImpl = fetch, log = console.log, sleep }: PollerDeps): Promise<void> {
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

        const discovery = await discover(row.scope_file, config.selfUrl, fetchImpl, log, sleep);
        const generated = await fetchImpl(`${config.selfUrl}/api/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(generateBody(row.scope_file, discovery)),
        });
        const generatedJson = (await generated.json().catch(() => ({}))) as Record<string, unknown>;
        if (!generated.ok || typeof generatedJson.code !== "string") {
            log(`napi: run ${row.run_uid}: generation failed (${generated.status}) ${String(generatedJson.error ?? "")}`);
            continue;
        }

        const started = await fetchImpl(`${config.selfUrl}/api/run`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(runBody(row.scope_file, generatedJson, discovery)),
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
