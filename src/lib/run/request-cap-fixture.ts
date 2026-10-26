/**
 * Phase 39 (TFP-157, Decision 10): copied into a capped run's folder as `testforge-request-cap.ts`, and imported by
 * its units in place of `@playwright/test` (src/lib/run/request-cap.ts). Never imported by the app.
 *
 * It is `@playwright/test` with four fixtures wrapped, so every request a test makes to the site waits for a slot from
 * the run's slot server first, whichever worker it runs in, and hands it back once its response has come:
 * - `context`: a route on each test's context (its page loads, their resources and `page.request`);
 * - `browser`: a context a test opens itself (`browser.newContext()`) gets the same route;
 * - `request`: the API requests a test sends (`request.get` and the rest);
 * - an automatic fixture: a timed check (its title in TESTFORGE_NOT_JUDGED_TITLES) is Not run, with the reason
 *   (TESTFORGE_NOT_JUDGED_REASON), as
 *   a page load slowed by the cap measures the cap, not the site (owner decision, 2026-10-21).
 *
 * Not counted, as Playwright doesn't route them: a redirect's later hops, a service worker's own requests and
 * WebSockets.
 */
import { test as base } from "@playwright/test";
import type { APIRequestContext, Browser, BrowserContext } from "@playwright/test";

export * from "@playwright/test";

const SLOT_URL = process.env.TESTFORGE_REQUEST_CAP_URL ?? "";
const TOKEN = process.env.TESTFORGE_REQUEST_CAP_TOKEN ?? "";
const DOMAIN = process.env.TESTFORGE_REQUEST_CAP_DOMAIN ?? "";
const NOT_JUDGED = (JSON.parse(process.env.TESTFORGE_NOT_JUDGED_TITLES ?? "[]") as string[]).map((source) => new RegExp(source));
const NOT_JUDGED_REASON = process.env.TESTFORGE_NOT_JUDGED_REASON ?? "not judged under the request cap";

/** As countsAgainstCap in host-limits.ts. */
function counts(url: string): boolean {
    let hostname: string;
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
        hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    } catch {
        return false;
    }
    return DOMAIN === "" || hostname === DOMAIN || hostname.endsWith(`.${DOMAIN}`);
}

const HEADERS = { "x-testforge-cap-token": TOKEN };

/**
 * Waits for a slot when the request counts; returns the call that hands it back (the server holds it a second more).
 * The slot is this fetch's open answer: handing it back closes the connection, and so does this process ending, so a
 * worker Playwright restarts after a failed test never keeps one (Gate D ruling 1). `signal` gives up the place in the
 * queue: a test's context closing while its requests still wait.
 */
async function slot(url: string, signal?: AbortSignal): Promise<() => void> {
    if (!SLOT_URL || !counts(url)) return () => undefined;
    const connection = new AbortController();
    const giveUp = () => connection.abort();
    signal?.addEventListener("abort", giveUp, { once: true });
    try {
        const response = await fetch(`${SLOT_URL}/slot`, { method: "POST", headers: HEADERS, signal: connection.signal });
        if (response.status !== 200) throw new Error(`the request cap's slot server answered HTTP ${response.status}`);
    } catch (error) {
        connection.abort();
        throw error;
    } finally {
        signal?.removeEventListener("abort", giveUp);
    }
    return () => connection.abort();
}

const capped = new WeakSet<object>();

const METHODS = ["fetch", "get", "post", "put", "patch", "delete", "head"] as const;

function capRequests(request: APIRequestContext, baseURL: string | undefined) {
    if (capped.has(request)) return;
    capped.add(request);
    const target = request as unknown as Record<string, (input: unknown, options?: unknown) => Promise<unknown>>;
    for (const method of METHODS) {
        const original = target[method].bind(request);
        target[method] = async (input: unknown, options?: unknown) => {
            const address = typeof input === "string" ? input : (input as { url(): string }).url();
            const release = await slot(new URL(address, baseURL).href);
            try {
                return await original(input, options);
            } finally {
                release();
            }
        };
    }
}

async function capContext(context: BrowserContext, baseURL: string | undefined) {
    if (capped.has(context)) return;
    capped.add(context);
    // Registered first, so it runs after any route a test adds (Playwright runs the newest first): a request a test
    // aborts or fulfils never leaves the browser and takes no slot.
    // The slot goes back once the response has come, or the request failed (null), never before it left. A context that
    // closes gives up the places its requests still hold in the queue; a request whose route can no longer go on (its
    // context closed while it waited) hands its slot straight back.
    const closing = new AbortController();
    context.once("close", () => closing.abort());
    await context.route("**/*", async (route) => {
        const release = await slot(route.request().url(), closing.signal);
        try {
            await route.fallback();
        } catch (error) {
            release();
            throw error;
        }
        void route.request().response().catch(() => null).then(release);
    });
    capRequests(context.request, baseURL);
}

export const test = base.extend<{ testforgeNotJudged: void }, { browser: Browser }>({
    browser: [async ({ browser }, provide) => {
        const newContext = browser.newContext.bind(browser);
        browser.newContext = async (options) => {
            const context = await newContext(options);
            await capContext(context, options?.baseURL);
            return context;
        };
        await provide(browser);
    }, { scope: "worker" }],
    context: async ({ context, baseURL }, provide) => {
        await capContext(context, baseURL);
        await provide(context);
    },
    request: async ({ request, baseURL }, provide) => {
        capRequests(request, baseURL);
        await provide(request);
    },
    testforgeNotJudged: [async ({}, provide, testInfo) => {
        testInfo.skip(NOT_JUDGED.some((pattern) => pattern.test(testInfo.title)), NOT_JUDGED_REASON);
        await provide();
    }, { auto: true }],
});
