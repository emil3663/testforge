import { expect, test } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import { join } from "node:path";

/**
 * TFP-261: the built server, behind its request guard (src/proxy.ts), refuses an API request from anywhere but the
 * tester's own pages, and a refused run runs nothing. Each run's suite writes a marker file when its test runs, so a
 * missing marker shows nothing ran, and the control run (sent as the UI sends it) shows the marker would have been
 * written. The guard's decisions one by one are src/proxy.test.ts.
 *
 * ISTQB technique: equivalence partitioning (the request as the UI sends it; another site's page; another host name)
 * with a positive control.
 */
const SELF = "http://127.0.0.1:3001";

function markerSuite(marker: string) {
    return `import { test } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('TFP-261 marker: this test ran', async () => {
  writeFileSync(${JSON.stringify(marker)}, 'ran');
});
`;
}

async function waitForRun(request: APIRequestContext, runId: string) {
    let snapshot: { runStatus?: string } = {};
    await expect.poll(async () => (snapshot = await (await request.get(`/api/run?runId=${runId}`)).json()).runStatus, { timeout: 120_000, intervals: [1_000] }).toMatch(/^(?!running$)\w+$/);
    return snapshot;
}

test.describe("TFP-261: the API answers only the tester's own pages on this machine", () => {
    let dir: string;
    test.beforeEach(() => {
        dir = mkdtempSync(join(os.tmpdir(), "testforge-request-guard-"));
    });
    test.afterEach(() => {
        rmSync(dir, { recursive: true, force: true });
    });

    // The refused requests and the control run in one test, the control sent after them: a run either refused request
    // had started would be queued before the control's, so once the control has finished and written its marker,
    // theirs would have been written too; and a further 5 s for one started alongside it.
    test("the 2026-10-27 request (another site's Origin, text/plain) and a same-origin text/plain one get 403 and run nothing; the same suite sent as the UI sends it gets 202 and runs", async ({ request }) => {
        const crossSite = join(dir, "cross-site.txt"), plainText = join(dir, "plain-text.txt"), control = join(dir, "control.txt");
        const body = (marker: string, description: string) => ({ code: markerSuite(marker), selectedPractices: ["functional"], auditMode: "fast", description });

        const refused = await request.post("/api/run", { headers: { origin: "https://attacker.example", "content-type": "text/plain" }, data: JSON.stringify(body(crossSite, "TFP-261 refused, cross-site")) });
        expect(refused.status()).toBe(403);
        expect((await refused.json()).error).toMatch(/another origin \(https:\/\/attacker\.example\)/);
        // The JSON-only rule on its own: the same origin, but a body type a page can send without a preflight.
        const notJson = await request.post("/api/run", { headers: { origin: SELF, "content-type": "text/plain" }, data: JSON.stringify(body(plainText, "TFP-261 refused, text/plain")) });
        expect(notJson.status()).toBe(403);
        expect((await notJson.json()).error).toMatch(/must be Content-Type: application\/json \(it was "text\/plain"\)/);

        const accepted = await request.post("/api/run", { headers: { origin: SELF }, data: body(control, "TFP-261 control") });
        expect(accepted.status()).toBe(202);
        const snapshot = await waitForRun(request, (await accepted.json()).runId);
        expect(existsSync(control), `the control run's code wrote its marker; the run: ${JSON.stringify(snapshot).slice(0, 1500)}`).toBe(true);
        await new Promise((resolve) => setTimeout(resolve, 5_000));
        expect(existsSync(crossSite), "the cross-site request's code wrote its marker").toBe(false);
        expect(existsSync(plainText), "the text/plain request's code wrote its marker").toBe(false);
    });

    test("a request naming another host (DNS rebinding) is refused with 403", async ({ request }) => {
        const response = await request.get("/api/runs", { headers: { host: "attacker.example:3001" } });
        expect(response.status()).toBe(403);
        expect((await response.json()).error).toMatch(/Host "attacker\.example:3001" isn't this machine/);
    });

    // TFP-266: the shapes of Next's Proxy bypasses that can apply to an API route, from another host, each with the exact
    // status measured: GHSA-267c-6grr-h53f and GHSA-26hh-7cqf-hhc6 (the .rsc and segment-prefetch variants of a path), a
    // route parameter in the query, and spellings of the path. Without the guard, /api/runs?_rsc=1 is 200 with the runs,
    // the .segment.rsc path 204 and the diff path the route's own 400, which is why these pin 403, not "no data".
    // Can't apply: GHSA-492v-c6pp-mqqv needs a dynamic route, and src/app/api has none; GHSA-6gpp-xcg3-4w24 needs a single
    // entry in config.i18n.locales, and next.config.ts has no i18n.
    for (const [path, status] of [
        ["/api/runs.rsc", 403],
        ["/api/runs/.rsc", 403],
        ["/api/runs.segments/_tree.segment.rsc", 403],
        ["/api/runs.segments/$c$runs/__PAGE__.segment.rsc", 403],
        ["/api/runs?_rsc=1", 403],
        ["/api/runs/diff?nxtPa=b&nxtPid=b", 403],
        ["/%61pi/runs", 403],
        ["/api%2Fruns", 403],
        // Next's own redirect to /api/runs, before the guard, which then refuses it (the DNS rebinding case above).
        ["/api/runs/", 308],
        ["/api//runs", 308],
        ["//api/runs", 308],
        // Paths are case-sensitive: this is the 404 page, not the API.
        ["/API/runs", 404],
    ] as const) {
        test(`from another host, ${path} gets ${status}, not the API's answer`, async ({ request }) => {
            const response = await request.get(`${SELF}${path}`, { headers: { host: "attacker.example:3001", rsc: "1", "next-router-prefetch": "1" }, maxRedirects: 0 });
            const body = await response.text();
            expect(response.status(), body.slice(0, 200)).toBe(status);
            if (status === 308) expect(response.headers().location).toBe("/api/runs");
            expect(body, "no run data").not.toMatch(/"(runs|runId)"\s*:/);
        });
    }

    test("a POST to /api/run's .rsc variant, from another site, starts nothing", async ({ request }) => {
        const marker = join(dir, "rsc.txt");
        const response = await request.post("/api/run.rsc", { headers: { origin: "https://attacker.example", "content-type": "text/plain", rsc: "1" }, data: JSON.stringify({ code: markerSuite(marker), selectedPractices: ["functional"], auditMode: "fast", description: "TFP-266 refused" }), maxRedirects: 0 });
        expect(response.status(), await response.text()).not.toBe(202);
        await new Promise((resolve) => setTimeout(resolve, 3_000));
        expect(existsSync(marker), "the request's code wrote its marker").toBe(false);
    });
});
