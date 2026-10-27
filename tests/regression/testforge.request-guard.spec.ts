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
});
