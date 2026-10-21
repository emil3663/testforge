import { randomBytes } from "node:crypto";
import { copyFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { join, relative } from "node:path";
import { TIMED_CHECK_TITLES } from "@/lib/generate/mock/performance-checks";

/**
 * Phase 39 (TFP-157, Decision 10): a capped host's request cap, shared by all of a run's workers. Workers are separate
 * processes, so the cap is a slot server in the run's own process, on loopback: before each request to the site, a
 * worker asks for a slot and waits until it's given, and hands it back once the request's response has come (or the
 * request failed).
 *
 * At most `perSecond` slots are held at once, and a slot is held until a second after it's handed back. That keeps any
 * one second at the server to the cap, however long a request takes to leave the browser after its slot: a request
 * arrives before its response, so every request arriving within a second still holds its slot at that second's end.
 * Evenly spaced slots can't promise it. Measured on the request-recording test (2026-10-21): a fresh browser's first
 * request reached the server about 250 ms after its slot, so two requests arrived 2 ms apart from slots 250 ms apart,
 * and six within one second.
 *
 * A slot not handed back within LEASE_MS (a worker that died mid-request) is taken back, so a run never stalls on it.
 *
 * Decision 11: the run records how many requests took a slot and how many of them waited.
 */
export const REQUEST_CAP_URL_ENV_VAR = "TESTFORGE_REQUEST_CAP_URL";
export const REQUEST_CAP_TOKEN_ENV_VAR = "TESTFORGE_REQUEST_CAP_TOKEN";
export const REQUEST_CAP_DOMAIN_ENV_VAR = "TESTFORGE_REQUEST_CAP_DOMAIN";
export const NOT_JUDGED_TITLES_ENV_VAR = "TESTFORGE_NOT_JUDGED_TITLES";
export const NOT_JUDGED_REASON_ENV_VAR = "TESTFORGE_NOT_JUDGED_REASON";
/** The module a capped run's units import in place of `@playwright/test`, copied into the run's folder. */
export const REQUEST_CAP_MODULE = "testforge-request-cap.ts";
export const REQUEST_CAP_TOKEN_HEADER = "x-testforge-cap-token";
/** How long a slot stays held after it's handed back. */
export const HOLD_AFTER_RESPONSE_MS = 1000;
const LEASE_MS = 60_000;
/** Decision 10 (Emil, 2026-10-21): a timed check run under the cap measures the cap, not the site. */
export const notJudgedReason = (perSecond: number) =>
    `not judged under the request cap: this host is capped at ${perSecond} requests per second, which slows the page loads a timed check measures (Decision 10)`;

export interface RequestCapStats {
    perSecond: number;
    /** Requests that took a slot. */
    requests: number;
    /** Of them, how many had to wait for theirs, and for how long in all (ms). */
    waited: number;
    waitedMs: number;
}

export interface RequestCap {
    /** POST `${url}/slot` answers with a slot's id once one is free; POST `${url}/release/<id>` hands it back. */
    url: string;
    token: string;
    stats(): RequestCapStats;
    close(): Promise<void>;
}

export async function startRequestCap(perSecond: number): Promise<RequestCap> {
    const token = randomBytes(16).toString("hex");
    const stats: RequestCapStats = { perSecond, requests: 0, waited: 0, waitedMs: 0 };
    const held = new Map<number, NodeJS.Timeout>();
    const waiting: Array<() => void> = [];
    const timers = new Set<NodeJS.Timeout>();
    let nextId = 1;
    let closed = false;

    const free = (id: number) => {
        const lease = held.get(id);
        if (!lease) return;
        clearTimeout(lease);
        held.delete(id);
        waiting.shift()?.();
    };
    const take = () => {
        const id = nextId++;
        held.set(id, setTimeout(() => free(id), LEASE_MS));
        return id;
    };
    const server = createServer((req, res) => {
        if (req.method !== "POST" || req.headers[REQUEST_CAP_TOKEN_HEADER] !== token) {
            res.writeHead(404).end();
            return;
        }
        if (req.url === "/slot") {
            stats.requests++;
            if (held.size < perSecond) {
                res.writeHead(200, { "content-type": "text/plain" }).end(String(take()));
                return;
            }
            const asked = performance.now();
            stats.waited++;
            waiting.push(() => {
                stats.waitedMs += performance.now() - asked;
                if (!closed) res.writeHead(200, { "content-type": "text/plain" }).end(String(take()));
            });
            return;
        }
        const release = /^\/release\/(\d+)$/.exec(req.url ?? "");
        if (release) {
            const id = Number(release[1]);
            const timer = setTimeout(() => {
                timers.delete(timer);
                free(id);
            }, HOLD_AFTER_RESPONSE_MS);
            timers.add(timer);
            res.writeHead(204).end();
            return;
        }
        res.writeHead(404).end();
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    return {
        url: `http://127.0.0.1:${port}`,
        token,
        stats: () => ({ ...stats, waitedMs: Math.round(stats.waitedMs) }),
        close: () => new Promise<void>((resolve) => {
            closed = true;
            for (const timer of [...timers, ...held.values()]) clearTimeout(timer);
            server.closeAllConnections();
            server.close(() => resolve());
        }),
    };
}

/** The environment a capped run's Playwright process needs to reach the slot server. */
export function requestCapEnv(cap: RequestCap, siteDomain: string): Record<string, string> {
    return {
        [REQUEST_CAP_URL_ENV_VAR]: cap.url,
        [REQUEST_CAP_TOKEN_ENV_VAR]: cap.token,
        [REQUEST_CAP_DOMAIN_ENV_VAR]: siteDomain,
        [NOT_JUDGED_TITLES_ENV_VAR]: JSON.stringify(TIMED_CHECK_TITLES.map((pattern) => pattern.source)),
        [NOT_JUDGED_REASON_ENV_VAR]: notJudgedReason(cap.stats().perSecond),
    };
}

/** Copies the cap's fixture module into a run's folder. */
export async function writeRequestCapModule(dir: string) {
    await copyFile(join(process.cwd(), "src", "lib", "run", "request-cap-fixture.ts"), join(dir, REQUEST_CAP_MODULE));
}

/**
 * A unit's code with its `@playwright/test` imports taken from the cap's module (in `moduleDir`, written by
 * writeRequestCapModule) instead. Nothing else in the unit changes: its tests' bodies are as generated (Decision 12).
 */
export function withRequestCap(code: string, unitDir: string, moduleDir: string): string {
    let specifier = relative(unitDir, join(moduleDir, REQUEST_CAP_MODULE.replace(/\.ts$/, ""))).replace(/\\/g, "/");
    if (!specifier.startsWith(".")) specifier = `./${specifier}`;
    return code.replace(/(\bfrom\s*)(['"])@playwright\/test\2/g, `$1$2${specifier}$2`);
}
