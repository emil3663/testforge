import { availableParallelism } from "node:os";
import { isLocalDevelopmentHost } from "@/lib/comprehensive/run-mode";

/**
 * Phase 39 (TFP-157, Decision 10): the worker limit and request cap depend on the host. This replaces Phase 35
 * Decision 2's one worker for Comprehensive runs and Standard's fixed 4 (fast) or 2 (deep).
 *
 * | Host | Workers | Request cap |
 * | --- | --- | --- |
 * | Local development host | The machine's limit | None |
 * | Host with the ownership confirmation | The machine's limit | None |
 * | Any other host | At most 3 | 5 requests per second, shared by all workers |
 *
 * The machine's limit is half the machine's cores (Playwright's own default), at least 1 and at most 3 (Gate D's
 * re-measurement ruling 1, 2026-10-27: with 6 workers the local clean Toolshop's API overloaded and results changed;
 * with 3 they matched 1 worker on every suite).
 */
export type HostRow = "local" | "confirmed" | "capped";

export const MACHINE_MAX_WORKERS = 3;
export const CAPPED_HOST_MAX_WORKERS = 3;
export const CAPPED_HOST_REQUESTS_PER_SECOND = 5;

export interface HostLimits {
    row: HostRow;
    workers: number;
    /** Requests per second, shared by all workers; null when the host's row has no cap. */
    requestsPerSecond: number | null;
    /** Whether the site carried a valid ownership confirmation covering the host (Decision 11). */
    ownershipConfirmed: boolean;
    /**
     * Decision 10 (owner decision, 2026-10-21): counted on the site's host and every host under its domain (www., api.), so a
     * site's own API is capped with its pages; third parties are not counted. Null without a cap.
     */
    siteDomain: string | null;
    /** Decision 11: the worker count, the host's row, and why, as the run and its report say it. */
    note: string;
}

/** Decision 10's machine limit: half the cores, at least 1, at most 3 (re-measurement ruling 1). */
export function machineWorkerLimit(cores: number = availableParallelism()): number {
    return Math.min(MACHINE_MAX_WORKERS, Math.max(1, Math.floor(cores / 2)));
}

export function hostLimitsFor(baseUrl: string | undefined, options: { ownershipConfirmed: boolean; cores?: number }): HostLimits {
    const limits = rowFor(baseUrl, options);
    return { ...limits, note: describeHostLimits(limits) };
}

function rowFor(baseUrl: string | undefined, options: { ownershipConfirmed: boolean; cores?: number }): Omit<HostLimits, "note"> {
    const machine = machineWorkerLimit(options.cores);
    if (isLocalDevelopmentHost(baseUrl)) {
        return { row: "local", workers: machine, requestsPerSecond: null, ownershipConfirmed: options.ownershipConfirmed, siteDomain: null };
    }
    if (options.ownershipConfirmed) {
        return { row: "confirmed", workers: machine, requestsPerSecond: null, ownershipConfirmed: true, siteDomain: null };
    }
    let hostname = "";
    try {
        hostname = new URL(baseUrl ?? "").hostname;
    } catch {
        // No host to count against: the cap then counts every request (siteDomain "").
    }
    return {
        row: "capped",
        workers: Math.min(CAPPED_HOST_MAX_WORKERS, machine),
        requestsPerSecond: CAPPED_HOST_REQUESTS_PER_SECOND,
        ownershipConfirmed: false,
        siteDomain: siteDomainOf(hostname),
    };
}

/** Second-level labels under a country code that are registries, not sites (co.uk, com.au), so a site is one deeper. */
const TWO_PART_SUFFIXES = new Set(["co", "com", "net", "org", "gov", "ac", "edu", "ne", "or", "go"]);

/**
 * The domain a site's requests are counted under: the last two labels (www.example.com → example.com), or three when
 * the second-to-last is a registry label under a country code (shop.example.co.uk → example.co.uk). An IP address is
 * itself. Not the Public Suffix List: a shared host like herokuapp.com counts its neighbours too, which only ever
 * counts more requests, never fewer.
 */
export function siteDomainOf(hostname: string): string {
    const host = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
    if (/^[\d.]+$/.test(host) || host.includes(":")) return host;
    const labels = host.split(".").filter(Boolean);
    if (labels.length <= 2) return labels.join(".");
    const take = labels.at(-1)!.length === 2 && TWO_PART_SUFFIXES.has(labels.at(-2)!) ? 3 : 2;
    return labels.slice(-take).join(".");
}

/** Whether a request to `url` counts against the cap for a site under `siteDomain` ("" counts every request). */
export function countsAgainstCap(url: string, siteDomain: string): boolean {
    let hostname: string;
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
        hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    } catch {
        return false;
    }
    return siteDomain === "" || hostname === siteDomain || hostname.endsWith(`.${siteDomain}`);
}

/** Decision 11's line for the run's output: the worker count, the host's row, and why. */
function describeHostLimits(limits: Omit<HostLimits, "note">): string {
    if (limits.row === "local") return `${limits.workers} worker(s), no request cap: a local development host (Decision 10).`;
    if (limits.row === "confirmed") {
        return `${limits.workers} worker(s), no request cap: the caps are lifted because the site has a valid ownership confirmation covering this host (Decision 10).`;
    }
    return `${limits.workers} worker(s) at most, sharing a cap of ${limits.requestsPerSecond} requests per second to ${limits.siteDomain || "every host"}: this host is not local and has no ownership confirmation (Decision 10).`;
}
