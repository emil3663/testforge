import { randomBytes } from "node:crypto";
import { copyFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { join, relative } from "node:path";
import { TIMED_CHECK_TITLES } from "@/lib/generate/mock/performance-checks";

/**
 * Phase 39 (TFP-157, Decision 10): a capped host's request cap, shared by all of a run's workers. Workers are separate
 * processes, so the cap is a slot server in the run's own process, on loopback: before each request to the site, a
 * worker asks for a slot and waits until it's given, and hands it back once the request's response has come (or the
 * request failed).
 *
 * A slot is the connection that asked for it (Gate D ruling 1, 2026-10-26): the server answers when the slot is free and
 * keeps the answer open, and the slot is handed back when that connection closes: the worker closing it on purpose, or
 * the worker's process ending, as Playwright ends one after each failed test. A waiter whose connection closes before
 * its turn is dropped, and the slot goes to the next one still there. Before, a slot was handed back by a second call,
 * and a freed slot went to the next waiter in line whether or not it was still there, so a worker that had gone held
 * it until its 60 s lease ran out. At Gate D that starved capped Standard on the hosted Toolshop: 466 of 484 tests timed
 * out, 902 slots in 8 hours.
 *
 * At most `perSecond` slots are held at once, and a slot is held until a second after it's handed back. That keeps any
 * one second at the server to the cap, however long a request takes to leave the browser after its slot: a request
 * arrives before its response, so every request arriving within a second still holds its slot at that second's end.
 * Evenly spaced slots can't promise it. Measured on the request-recording test (2026-10-21): a fresh browser's first
 * request reached the server about 250 ms after its slot, so two requests arrived 2 ms apart from slots 250 ms apart,
 * and six within one second.
 *
 * A slot still held after LEASE_MS (a worker that kept its connection open but never handed the slot back) is taken
 * back, so a run never stalls on it.
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
/** On a slot's answer: "1" when it waited in the queue, "0" when it was free at once (request-cap-fixture.ts reads it). */
export const REQUEST_CAP_QUEUED_HEADER = "x-testforge-cap-queued";
/** How long a slot stays held after it's handed back. */
export const HOLD_AFTER_RESPONSE_MS = 1000;
const LEASE_MS = 60_000;
/** Decision 10 (owner decision, 2026-10-21): a timed check run under the cap measures the cap, not the site. */
export const notJudgedReason = (perSecond: number) =>
    `not judged under the request cap: this host is capped at ${perSecond} requests per second, which slows the page loads a timed check measures (Decision 10)`;

export interface RequestCapStats {
    perSecond: number;
    /** Requests that took a slot. */
    requests: number;
    /** Of them, how many had to wait for theirs, and for how long in all (ms). */
    waited: number;
    waitedMs: number;
    /** TFP-264: how many tests the cap starved (reported Not run); set on the saved run once its records are read. */
    starved?: number;
}

export interface RequestCap {
    /** POST `${url}/slot` answers (200, headers only) once a slot is free, and holds it until that connection closes. */
    url: string;
    token: string;
    stats(): RequestCapStats;
    close(): Promise<void>;
}

export async function startRequestCap(perSecond: number): Promise<RequestCap> {
    const token = randomBytes(16).toString("hex");
    const stats: RequestCapStats = { perSecond, requests: 0, waited: 0, waitedMs: 0 };
    type Waiter = { res: ServerResponse; asked: number };
    // The slots held, each by its connection's response, with the lease that takes it back.
    const held = new Map<ServerResponse, NodeJS.Timeout>();
    const waiting: Waiter[] = [];
    const timers = new Set<NodeJS.Timeout>();
    let closed = false;

    /** The next waiter whose connection is still open gets the slot; one that has gone is skipped. */
    const grantNext = () => {
        while (!closed && held.size < perSecond && waiting.length > 0) {
            const next = waiting.shift()!;
            if (next.res.destroyed || next.res.writableEnded) continue;
            stats.waitedMs += performance.now() - next.asked;
            grant(next.res, true);
        }
    };
    /** A slot handed back: free once the hold after it has passed, then given to the next waiter. */
    const handBack = (res: ServerResponse) => {
        const lease = held.get(res);
        if (!lease) return;
        clearTimeout(lease);
        if (closed) return;
        const timer = setTimeout(() => {
            timers.delete(timer);
            held.delete(res);
            grantNext();
        }, HOLD_AFTER_RESPONSE_MS);
        timers.add(timer);
    };
    // TFP-264: the answer says whether the slot came from the queue, so the worker counts only real waiting.
    const grant = (res: ServerResponse, queued: boolean) => {
        held.set(res, setTimeout(() => {
            // The lease ran out: the connection is closed, which hands the slot back as any close does.
            res.destroy();
        }, LEASE_MS));
        res.writeHead(200, { "content-type": "text/plain", "cache-control": "no-store", [REQUEST_CAP_QUEUED_HEADER]: queued ? "1" : "0" });
        res.flushHeaders();
    };
    const server = createServer((req, res) => {
        if (req.method !== "POST" || req.url !== "/slot" || req.headers[REQUEST_CAP_TOKEN_HEADER] !== token) {
            res.writeHead(404).end();
            return;
        }
        stats.requests++;
        // However the connection ends - the worker handing the slot back, or its process gone - the slot (or the place
        // in the queue) goes with it.
        res.on("close", () => {
            if (held.has(res)) {
                handBack(res);
                return;
            }
            const index = waiting.findIndex((waiter) => waiter.res === res);
            if (index >= 0) waiting.splice(index, 1);
        });
        if (held.size < perSecond && waiting.length === 0) {
            grant(res, false);
            return;
        }
        stats.waited++;
        waiting.push({ res, asked: performance.now() });
        grantNext();
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
