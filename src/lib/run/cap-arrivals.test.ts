/**
 * TFP-265 (Phase 39 ruling 4 amended, item 3, and the rulings on TFP-265): the request cap, proven at the server.
 *
 * ISTQB techniques:
 * - Request recording, in a real browser, through the executor, 3 runs on the recording site (a host Decision 10
 *   doesn't treat as local): tests that pass, fail or time out while their requests still wait for slots, the last two
 *   followed by a worker Playwright starts anew (each test tells a loopback site its worker index); no second has more
 *   than 5 arrivals, at least as many slots were given as arrived, and the requests counted beyond those given gave up
 *   waiting. A test that passes while its requests wait stays Passed.
 * - State transition, in a real browser, Playwright directly: a context closing after its request's slot came, before
 *   the request went on. Playwright 1.59 drops the request quietly and rejects its response at once (so, read from
 *   the fixture, not measured on a slot: the slot goes back at once).
 * - The slot server's counts and the run line: host-limits.test.ts.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/run/cap-arrivals.test.ts
 */
import assert from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import type { ExecutionRecord } from "../report/types.ts";

const scratch = mkdtempSync(join(tmpdir(), "testforge-cap-arrivals-"));
process.env.TESTFORGE_RUNS_ROOT = join(scratch, "runs");
process.env.TESTFORGE_DATA_DIR = join(scratch, "data");
after(() => rmSync(scratch, { recursive: true, force: true }));

const { startRunJob } = await import("./executor.ts");
const { waitForSavedRun } = await import("../../test-support/saved-run.ts");
const { chromiumSkipReason } = await import("../../test-support/chromium.ts");
const { runPlaywrightSpec } = await import("../../test-support/playwright-cli.ts");
const { flattenSuites } = await import("../report/execution.ts");
const { lanAddress, withRecordingSite, busiestSecond } = await import("../../test-support/recording-site.ts");
const needsChromium = await chromiumSkipReason();
const lanSkip = needsChromium || (lanAddress ? false : "this machine has no LAN IPv4 address to serve a remote-looking host from");
/** A run finalized: its result set and its record saved (run.json written, no .tmp left: waitForSavedRun). */
const finished = (id: string, timeoutMs: number) => waitForSavedRun(id, timeoutMs);

/**
 * TFP-265 (ruling 5): a context that closes after its request got a slot but before the route handed it on. The cap's
 * route does `await slot(...)`, then `route.fallback()`, then hands the slot back when the request's response settles;
 * nothing stops the context closing between the first two. Playwright 1.59 drops such a request quietly: the call
 * resolves, the request never reaches the site, and its response rejects at once, which hands the slot back (the
 * route's `.then(release)`; inferred, not measured on a slot here), and no test fails. This pins that, so an upgrade that changes it is seen (the fixture would then drop it as it does a waiter).
 */
const slotThenCloseSpec = `import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';

for (const how of ['fallback', 'continue']) {
  test('slot given, context closed, then ' + how, async ({ browser }) => {
    const arrived = [];
    const server = createServer((req, res) => {
      arrived.push(req.url);
      if (req.url === '/') res.writeHead(200, { 'content-type': 'text/html' }).end('<h1>x</h1><img src="/a.png">');
      else res.writeHead(200, { 'content-type': 'image/png' }).end('');
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    const context = await browser.newContext();
    let entered, slotGiven, settled;
    const inHandler = new Promise((resolve) => { entered = resolve; });
    const slot = new Promise((resolve) => { slotGiven = resolve; });
    const outcome = new Promise((resolve) => { settled = resolve; });
    await context.route('**/*.png', async (route) => {
      entered();
      await slot;
      const steps = [];
      try {
        await (how === 'fallback' ? route.fallback() : route.continue());
        steps.push('resolved');
      } catch (error) {
        steps.push('threw: ' + String(error.message).split('\\n')[0]);
      }
      const started = Date.now();
      await route.request().response().then(() => steps.push('response settled'), () => steps.push('response rejected'));
      settled({ steps, ms: Date.now() - started });
    });
    const page = await context.newPage();
    await page.goto(origin + '/', { waitUntil: 'commit' });
    await inHandler;
    await context.close();
    slotGiven();
    const result = await Promise.race([outcome, new Promise((resolve) => setTimeout(() => resolve({ steps: ['still pending after 10 s'], ms: 10000 }), 10000))]);
    await new Promise((resolve) => setTimeout(resolve, 500));
    server.closeAllConnections();
    server.close();
    const said = JSON.stringify({ ...result, arrived });
    expect(result.steps, said).toEqual(['resolved', 'response rejected']);
    expect(result.ms, said).toBeLessThan(1000);
    expect(arrived.filter((url) => url.endsWith('.png')), said).toEqual([]);
  });
}
`;

test("in a real browser: a context that closes after its request got a slot but before the route handed it on drops the request quietly, and its response rejects at once (Playwright 1.59; TFP-265, ruling 5)", { skip: needsChromium }, async () => {
    const { report } = await runPlaywrightSpec(slotThenCloseSpec, "slot-then-close", ["--workers=1"], { TESTFORGE_INTERACTIVE: "0" });
    const records = flattenSuites(report.suites);
    assert.equal(records.length, 2);
    for (const record of records) assert.equal(record.status, "Passed", `${record.title}: ${record.rawMessage ?? ""}`);
});
/**
 * TFP-265: tests that end while their requests still wait for slots: one passes and closes its context with a page of
 * 200 images queued; one fails at once, and one times out, while theirs wait, so Playwright goes on in a new worker
 * (ruling 4). Ordinary page loads and API requests run beside them. Each test first tells `workerSite` its worker
 * (`/<workerIndex>/<tag>`): a worker Playwright starts has a new index, and a group's tests otherwise run in order in
 * one worker. Node's own fetch to loopback: neither capped nor counted at the recording site, so a test that times out
 * waiting for slots still says where it ran.
 */
function waitingSuiteFor(origin: string, workerSite: string) {
    const worker = (tag: string) => `await fetch('${workerSite}/' + test.info().workerIndex + '/${tag}');`;
    return `import { test, expect } from '@playwright/test';

test.describe('Ends', () => {
  test('Ends: passes while its images wait', async ({ page }) => {
    ${worker("ends-1")}
    await page.goto('${origin}/many', { waitUntil: 'commit' });
    await expect(page.locator('h1')).toHaveText('many');
  });
  test('Ends: the next page loads', async ({ page }) => {
    ${worker("ends-2")}
    await page.goto('${origin}/p1');
    await expect(page.locator('h1')).toHaveText('/p1');
  });
});

test.describe('Fails', () => {
  test('Fails: on purpose while its images wait', async ({ page }) => {
    ${worker("fails-1")}
    await page.goto('${origin}/heavy', { waitUntil: 'commit' });
    expect(1, 'fails on purpose').toBe(2);
  });
  test('Fails: the API answers', async ({ request }) => {
    ${worker("fails-2")}
    expect((await request.get('${origin}/api/p2')).ok()).toBe(true);
  });
});

test.describe('Times out', () => {
  test('Times out: while its images wait', async ({ page, request }) => {
    test.setTimeout(5000);
    ${worker("times-out-1")}
    await page.goto('${origin}/many');
  });
  test('Times out: the next page loads', async ({ page }) => {
    ${worker("times-out-2")}
    await page.goto('${origin}/p3');
    await expect(page.locator('h1')).toHaveText('/p3');
  });
});
`;
}

/** A loopback site each test of waitingSuiteFor tells its worker index (`/<index>/<tag>`), by tag. */
async function withWorkerSite(run: (url: string, workers: Record<string, number>) => Promise<void>) {
    const workers: Record<string, number> = {};
    const server = createServer((req, res) => {
        const match = /^\/(\d+)\/(.+)$/.exec(req.url ?? "");
        if (match) workers[match[2]] = Number(match[1]);
        res.writeHead(204).end();
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
        await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`, workers);
    } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
    }
}

test("in a real browser: on a capped host, no second has more than 5 arrivals at the site across 3 runs, with tests passing, failing and timing out while their requests wait, and workers restarting after the failures; at least as many slots given as arrivals, and what was counted beyond the slots given gave up waiting (TFP-265)", { skip: lanSkip }, async (t) => {
    for (const run of [1, 2, 3]) {
        await withWorkerSite((workerSite, workers) => withRecordingSite(async (origin, arrivals) => {
            const snapshot = await startRunJob(waitingSuiteFor(origin, workerSite), ["functional"], "fast", origin, [], [], "Check the site.");
            const job = await finished(snapshot.runId, 300_000);
            const report = job.result?.report;
            assert.ok(report, job.result?.output);
            const records = report.execution as ExecutionRecord[];
            const statuses = records.map((record) => `${record.title}: ${record.status} ${record.requestCapWaitMs} ms ${(record.rawMessage ?? "").slice(0, 160)}`).join(" | ");
            // The suite did what it is for: tests ended with requests waiting, and two failed (restarting their workers).
            assert.equal(records.find((record) => /passes while its images wait/.test(record.title))?.status, "Passed", statuses);
            const fails = records.find((record) => /on purpose while its images wait/.test(record.title));
            assert.equal(fails?.status, "Failed", statuses);
            assert.ok((fails?.requestCapWaitMs ?? 0) > 0, `it ended with its images waiting: ${statuses}`);
            // It ran out of time waiting (TFP-264 reports it Not run, starved; either way, it didn't pass).
            const timesOut = records.find((record) => /Times out: while its images wait/.test(record.title));
            assert.notEqual(timesOut?.status, "Passed", statuses);
            assert.match(timesOut?.rawMessage ?? "", /Test timeout of 5000ms exceeded/, statuses);
            assert.ok(records.filter((record) => /next page loads|API answers/.test(record.title)).every((record) => record.status === "Passed"), statuses);
            // Ruling 4: after each failure, its group went on in a worker Playwright started anew, while the failed
            // test's images still waited; the group whose tests both passed stayed in one worker.
            const restarts = `workers: ${JSON.stringify(workers)}`;
            for (const tag of ["ends-1", "ends-2", "fails-1", "fails-2", "times-out-1", "times-out-2"]) assert.ok(workers[tag] !== undefined, `${tag} told its worker: ${restarts}`);
            assert.equal(workers["ends-2"], workers["ends-1"], restarts);
            // Not just another worker: one none of the groups' first tests ran in, so Playwright started it.
            const firstWorkers = [workers["ends-1"], workers["fails-1"], workers["times-out-1"]];
            assert.ok(!firstWorkers.includes(workers["fails-2"]), restarts);
            assert.ok(!firstWorkers.includes(workers["times-out-2"]), restarts);

            const cap = report.hostLimits?.requestCap;
            assert.ok(cap, "the run's cap counts");
            const busiest = busiestSecond(arrivals);
            const first = Math.min(...arrivals.map((arrival) => arrival.at));
            const spanS = (Math.max(...arrivals.map((arrival) => arrival.at)) - first) / 1000;
            const line = `run ${run}: busiest second ${busiest} arrivals; ${arrivals.length} arrivals over ${spanS.toFixed(1)} s; ${cap.requests} asked, ${cap.granted} given a slot, ${cap.gaveUp} gave up, ${cap.waited} waited; ${restarts}`;
            t.diagnostic(line);
            assert.ok(busiest <= 5, `${line}: ${arrivals.map((arrival) => `${Math.round(arrival.at - first)}${arrival.path}`).join(" ")}`);
            // As many slots given as arrivals, or more: a few go unused (a request its context closed after its slot came).
            // A count, not a per-arrival match.
            assert.ok((cap.granted ?? 0) >= arrivals.length, line);
            // What was counted beyond the slots given is waiters that gave up: they never arrive.
            assert.equal(cap.requests, (cap.granted ?? 0) + (cap.gaveUp ?? 0), line);
            assert.ok((cap.gaveUp ?? 0) > 0, `tests ended while their requests waited: ${line}`);
        }));
    }
});
