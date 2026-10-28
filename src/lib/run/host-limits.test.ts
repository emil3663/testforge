/**
 * Phase 39 (TFP-157, Decisions 10 and 11, Acceptance Criteria 6): the worker limit and request cap by host, and the
 * ownership row that lifts both.
 *
 * ISTQB techniques:
 * - Decision table, offline: the host (local, `.test`, remote) against the ownership confirmation (present or not),
 *   giving the row, the workers and the cap; the machine limit at its boundaries (1, 2, 3, 4, 5, 6, 7, 8 and 12
 *   cores: at least 1, half the cores, at most 3 from 6 cores up).
 * - Equivalence partitioning, offline: which requests count against the cap (the site's host, a host under its
 *   domain, a third party, a non-HTTP URL), and the domain a host's requests count under.
 * - Boundary value analysis: the slot server holds at most 5 slots at once, each until a second after it's handed back,
 *   measured.
 * - State transition (Gate D ruling 1): a slot's connection is the slot. A waiter that gives up before its turn takes
 *   none, and a holder whose process ends hands its slots back; in both, the next live request gets a slot a second
 *   later, not after the 60 s lease. In a real browser, a test that fails while its page's requests wait for slots,
 *   which makes Playwright restart the worker, doesn't leave the next test starved (on 54c38eb, that run hit its 140 s
 *   budget).
 * - Request recording, in a real browser, through the executor: a site bound to this machine's LAN address (a host
 *   Decision 10 doesn't treat as local) records every request it gets. Capped: at most 3 workers, more than one used,
 *   and at most 5 requests in any second at the server, with the waits counted; the timed check is Not run with its
 *   reason. With a stub ownership confirmation (TFP-220 replaces the stub in Phase 43): the machine's limit, no cap,
 *   and the timed check runs.
 * - TFP-265, the cap proven at the server, 3 runs of the executor on the recording site: tests that pass, fail or time
 *   out while their requests still wait for slots; no second has more than 5 arrivals, at least as many slots were
 *   given as arrived, and the requests counted beyond those given gave up waiting. A test that
 *   passes while its requests wait stays Passed. The slot server's counts of slots given and waiters that gave up,
 *   offline.
 * - TFP-264's cap-starved failures, offline and in a real browser on the same recording site: cap-starved.test.ts.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/run/host-limits.test.ts
 */
import assert from "node:assert";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import type { ExecutionRecord } from "../report/types.ts";

const scratch = mkdtempSync(join(tmpdir(), "testforge-host-limits-"));
process.env.TESTFORGE_RUNS_ROOT = join(scratch, "runs");
process.env.TESTFORGE_DATA_DIR = join(scratch, "data");

const { hostLimitsFor, machineWorkerLimit, siteDomainOf, countsAgainstCap } = await import("./host-limits.ts");
const { startRequestCap, withRequestCap, REQUEST_CAP_TOKEN_HEADER, REQUEST_CAP_QUEUED_HEADER } = await import("./request-cap.ts");
const { setOwnershipLookupForTests } = await import("./ownership.ts");
const { TIMED_CHECK_TITLES } = await import("../generate/mock/performance-checks.ts");
const { startRunJob } = await import("./executor.ts");
const { waitForSavedRun } = await import("../../test-support/saved-run.ts");
const { chromiumSkipReason } = await import("../../test-support/chromium.ts");
const needsChromium = await chromiumSkipReason();
after(() => rmSync(scratch, { recursive: true, force: true }));

test("the host table: local and confirmed hosts get the machine's limit and no cap; any other host at most 3 workers and 5 requests per second (decision table)", () => {
    const rows: Array<[string, boolean, string, number, number | null]> = [
        ["http://127.0.0.1:4410", false, "local", 3, null],
        ["http://localhost:3000", true, "local", 3, null],
        ["http://shop.test", false, "local", 3, null],
        ["http://app.localhost", false, "local", 3, null],
        ["https://practicesoftwaretesting.com", false, "capped", 3, 5],
        ["https://practicesoftwaretesting.com", true, "confirmed", 3, null],
        ["http://192.168.1.10:8080", false, "capped", 3, 5],
        ["http://192.168.1.10:8080", true, "confirmed", 3, null],
    ];
    for (const [url, ownershipConfirmed, row, workers, cap] of rows) {
        const limits = hostLimitsFor(url, { ownershipConfirmed, cores: 12 });
        assert.deepEqual([limits.row, limits.workers, limits.requestsPerSecond, limits.ownershipConfirmed], [row, workers, cap, ownershipConfirmed], `${url}, confirmation ${ownershipConfirmed}`);
    }
    const capped = hostLimitsFor("https://www.practicesoftwaretesting.com/#/", { ownershipConfirmed: false, cores: 12 });
    assert.equal(capped.siteDomain, "practicesoftwaretesting.com");
    assert.equal(capped.note, "3 worker(s) at most, sharing a cap of 5 requests per second to practicesoftwaretesting.com: this host is not local and has no ownership confirmation (Decision 10).");
    assert.equal(hostLimitsFor("https://example.com", { ownershipConfirmed: true, cores: 12 }).note, "3 worker(s), no request cap: the caps are lifted because the site has a valid ownership confirmation covering this host (Decision 10).");
    assert.equal(hostLimitsFor("http://127.0.0.1:1", { ownershipConfirmed: false, cores: 12 }).note, "3 worker(s), no request cap: a local development host (Decision 10).");
});

test("the machine's limit: half the cores, at least 1, at most 3; a capped host never more than 3 (boundary values)", () => {
    for (const [cores, machine, capped] of [[1, 1, 1], [2, 1, 1], [3, 1, 1], [4, 2, 2], [5, 2, 2], [6, 3, 3], [7, 3, 3], [8, 3, 3], [12, 3, 3]]) {
        assert.equal(machineWorkerLimit(cores), machine, `${cores} cores`);
        assert.equal(hostLimitsFor("https://example.com", { ownershipConfirmed: false, cores }).workers, capped, `${cores} cores, capped`);
    }
});

test("what counts against the cap: the site's host and every host under its domain, never a third party or a non-HTTP URL (equivalence partitions)", () => {
    for (const [host, domain] of [["www.example.com", "example.com"], ["api.practicesoftwaretesting.com", "practicesoftwaretesting.com"], ["example.com", "example.com"], ["shop.example.co.uk", "example.co.uk"], ["the-internet.herokuapp.com", "herokuapp.com"], ["192.168.1.10", "192.168.1.10"], ["[::1]", "::1"]]) {
        assert.equal(siteDomainOf(host), domain, host);
    }
    const domain = "practicesoftwaretesting.com";
    for (const url of ["https://practicesoftwaretesting.com/", "https://api.practicesoftwaretesting.com/products?page=1", "http://www.practicesoftwaretesting.com/img/a.png"]) {
        assert.equal(countsAgainstCap(url, domain), true, url);
    }
    for (const url of ["https://cdn.jsdelivr.net/x.js", "https://notpracticesoftwaretesting.com/", "data:image/png;base64,AAAA", "blob:https://practicesoftwaretesting.com/1", "not a url"]) {
        assert.equal(countsAgainstCap(url, domain), false, url);
    }
});

test("a capped run's units import the cap's module in place of @playwright/test, with nothing else changed", () => {
    const unit = "import { test, expect } from '@playwright/test';\nimport type { Page } from \"@playwright/test\";\ntest('a', async ({ page }) => { await page.goto('/'); });\n";
    const root = join("x", "run-1");
    assert.equal(withRequestCap(unit, root, root), "import { test, expect } from './testforge-request-cap';\nimport type { Page } from \"./testforge-request-cap\";\ntest('a', async ({ page }) => { await page.goto('/'); });\n");
    assert.match(withRequestCap(unit, join(root, "serial"), root), /from '\.\.\/testforge-request-cap'/);
});

/** A slot as the cap's module takes one: the fetch's open answer, handed back by closing its connection. */
async function takeSlot(cap: { url: string; token: string }, signal?: AbortSignal) {
    const connection = new AbortController();
    signal?.addEventListener("abort", () => connection.abort(), { once: true });
    const response = await fetch(`${cap.url}/slot`, { method: "POST", headers: { [REQUEST_CAP_TOKEN_HEADER]: cap.token }, signal: connection.signal });
    return { status: response.status, queued: response.headers.get(REQUEST_CAP_QUEUED_HEADER), release: () => connection.abort() };
}

test("the slot server says whether a slot came from the queue: the first 5 at once, the 6th after waiting (TFP-264)", async () => {
    const cap = await startRequestCap(5);
    try {
        const first = await Promise.all(Array.from({ length: 5 }, () => takeSlot(cap)));
        assert.deepEqual(first.map((slot) => slot.queued), ["0", "0", "0", "0", "0"]);
        const sixth = takeSlot(cap);
        first[0].release();
        assert.equal((await sixth).queued, "1");
        for (const slot of [...first, await sixth]) slot.release();
    } finally {
        await cap.close();
    }
});

test("the slot server: at most 5 slots held at once, each held a second after it's handed back; each wait is counted; a wrong token gets none (boundary values)", async () => {
    const cap = await startRequestCap(5);
    try {
        assert.equal((await fetch(`${cap.url}/slot`, { method: "POST", headers: { [REQUEST_CAP_TOKEN_HEADER]: "wrong" } })).status, 404);
        const started = performance.now();
        let firstRelease = Infinity;
        // Eight ask at once; each hands its slot back as soon as it has it.
        const given = await Promise.all(Array.from({ length: 8 }, async () => {
            const slot = await takeSlot(cap);
            const at = performance.now() - started;
            firstRelease = Math.min(firstRelease, performance.now() - started);
            slot.release();
            return { status: slot.status, at };
        }));
        assert.ok(given.every((slot) => slot.status === 200));
        const times = given.map((slot) => slot.at).sort((left, right) => left - right);
        assert.ok(times[4] < 500, `the first five at once: ${times.map(Math.round).join(", ")} ms`);
        assert.ok(times[5] >= firstRelease + 990, `the sixth only a second after the first was handed back (${Math.round(firstRelease)} ms): ${times.map(Math.round).join(", ")} ms`);
        const stats = cap.stats();
        assert.equal(stats.requests, 8);
        assert.equal(stats.waited, 3, "the three past the cap waited");
        assert.deepEqual([stats.granted, stats.gaveUp], [8, 0], "every one given a slot (TFP-265)");
    } finally {
        await cap.close();
    }
});

test("the slot server: waiters that give up before their turn take no slot; the next live request gets one a second after the slots are handed back, not after a 60 s lease (Gate D ruling 1, state transition)", async () => {
    // Measured on 54c38eb (2026-10-26): five abandoned waiters made the next request wait 61,007 ms.
    const cap = await startRequestCap(5);
    try {
        const held = await Promise.all(Array.from({ length: 5 }, () => takeSlot(cap)));
        const giveUp = Array.from({ length: 5 }, () => new AbortController());
        const abandoned = giveUp.map((controller) => takeSlot(cap, controller.signal).catch(() => "gave up"));
        await new Promise((resolve) => setTimeout(resolve, 300));
        for (const controller of giveUp) controller.abort();
        assert.deepEqual(await Promise.all(abandoned), Array(5).fill("gave up"));
        const handedBack = performance.now();
        for (const slot of held) slot.release();
        const next = await takeSlot(cap);
        const waited = performance.now() - handedBack;
        assert.equal(next.status, 200);
        assert.ok(waited >= 950 && waited < 3000, `the next request waited ${Math.round(waited)} ms`);
        next.release();
        // TFP-265: 11 asked, 6 were given a slot, the 5 that gave up were counted but took none.
        const stats = cap.stats();
        assert.deepEqual([stats.requests, stats.granted, stats.gaveUp], [11, 6, 5]);
    } finally {
        await cap.close();
    }
});

test("the slot server: a worker whose process ends while it holds slots (Playwright restarting it after a failed test) hands them back, a second later (Gate D ruling 1, state transition)", async () => {
    const cap = await startRequestCap(5);
    // A separate process takes all five slots and keeps them, as a worker does mid-request; then it is killed.
    const holder = spawn(process.execPath, ["-e", `
        const take = () => fetch(${JSON.stringify(`${cap.url}/slot`)}, { method: "POST", headers: { ${JSON.stringify(REQUEST_CAP_TOKEN_HEADER)}: ${JSON.stringify(cap.token)} } });
        Promise.all([take(), take(), take(), take(), take()]).then(() => { console.log("held"); setInterval(() => {}, 1000); });
    `], { stdio: ["ignore", "pipe", "inherit"], windowsHide: true });
    try {
        await new Promise<void>((resolve, reject) => {
            holder.stdout.on("data", (chunk: Buffer) => { if (chunk.toString().includes("held")) resolve(); });
            holder.on("exit", (code) => reject(new Error(`the holder exited (${code}) before holding its slots`)));
        });
        const killed = performance.now();
        holder.kill("SIGKILL");
        const next = await takeSlot(cap);
        const waited = performance.now() - killed;
        assert.equal(next.status, 200);
        assert.ok(waited >= 950 && waited < 3000, `the next request waited ${Math.round(waited)} ms after the holder was killed`);
        next.release();
    } finally {
        holder.kill("SIGKILL");
        await cap.close();
    }
});

test("the timed checks, by title: each of Performance's load-timed checks, and none of the others", () => {
    const timed = ["TFPL-001: landing page finishes loading within 5 s", "TFPL-002: largest contentful paint stays under 4 s", "TFPL-005: cumulative layout shift during load stays under 0.25", "TFPL-006: total blocking time during load (recorded, not judged)", "server responds and the page is ready quickly"];
    const untimed = ["TFPL-003: page weight stays under 5 MB", "TFPL-004: no same-origin request fails while the page loads", "TFFU-001: loads the target page and shows visible content"];
    for (const title of timed) assert.ok(TIMED_CHECK_TITLES.some((pattern) => pattern.test(title)), title);
    for (const title of untimed) assert.ok(!TIMED_CHECK_TITLES.some((pattern) => pattern.test(title)), title);
});

const { lanAddress, withRecordingSite } = await import("../../test-support/recording-site.ts");


/** Six areas, one unit file each, so the run's workers share them: a page load each, an API request, a context of its own, and a timed and an untimed check. */
function suiteFor(origin: string) {
    const area = (name: string, path: string) => `test.describe('${name}', () => {
  test('${name}: ${path} shows its heading', async ({ page }) => {
    await page.goto('${origin}${path}');
    await expect(page.locator('h1')).toHaveText('${path}');
  });
  test('${name}: the API answers', async ({ request }) => {
    expect((await request.get('${origin}/api${path}')).ok()).toBe(true);
  });
});`;
    return `import { test, expect } from '@playwright/test';

${["One", "Two", "Three", "Four", "Five"].map((name, index) => area(name, `/p${index + 1}`)).join("\n\n")}

test.describe('Performance Coverage', () => {
  test('TFPL-001: landing page finishes loading within 5 s', async ({ page }) => {
    await page.goto('${origin}/');
    await expect(page.locator('h1')).toHaveText('/');
  });
  test('TFPL-003: page weight stays under 5 MB', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('${origin}/weight');
    await expect(page.locator('h1')).toHaveText('/weight');
    await context.close();
  });
});
`;
}

/** A run finalized: its result set and its record saved (run.json written, no .tmp left: waitForSavedRun). */
const finished = (id: string, timeoutMs: number) => waitForSavedRun(id, timeoutMs);

/** The most requests that arrived within any one second. */
const busiestSecond = (arrivals: Array<{ at: number }>) => {
    const times = arrivals.map((arrival) => arrival.at).sort((left, right) => left - right);
    let most = 0;
    for (let start = 0, end = 0; end < times.length; end++) {
        while (times[end] - times[start] >= 1000) start++;
        most = Math.max(most, end - start + 1);
    }
    return most;
};

const lanSkip = needsChromium || (lanAddress ? false : "this machine has no LAN IPv4 address to serve a remote-looking host from");

test("in a real browser: a capped host's run uses at most 3 workers sharing 5 requests per second, measured at the server, with its waits counted and the timed check Not run (Acceptance Criteria 6)", { skip: lanSkip }, async () => {
    await withRecordingSite(async (origin, arrivals) => {
        const snapshot = await startRunJob(suiteFor(origin), ["functional", "performance"], "fast", origin, [], [], "Check the site.");
        const job = await finished(snapshot.runId, 300_000);
        const report = job.result?.report;
        assert.ok(report, job.result?.output);
        const statuses = Object.fromEntries(report.execution.map((record: ExecutionRecord) => [record.title, record.status]));
        const timed = report.execution.find((record: ExecutionRecord) => /finishes loading within/.test(record.title));
        assert.equal(timed?.status, "Not run", JSON.stringify(statuses));
        assert.match(timed?.skipReason ?? "", /^not judged under the request cap: this host is capped at 5 requests per second/);
        assert.ok(report.execution.filter((record: ExecutionRecord) => record !== timed).every((record: ExecutionRecord) => record.status === "Passed"), JSON.stringify(statuses));

        const limits = report.hostLimits;
        assert.ok(limits, "the run record's host limits");
        assert.deepEqual([limits.row, limits.workers, limits.requestsPerSecond, limits.ownershipConfirmed, limits.siteDomain], ["capped", Math.min(3, machineWorkerLimit()), 5, false, lanAddress]);
        assert.ok((report.runTiming?.workers ?? 0) > 1 && (report.runTiming?.workers ?? 0) <= 3, `${report.runTiming?.workers} workers`);
        const busiest = busiestSecond(arrivals);
        const first = Math.min(...arrivals.map((arrival) => arrival.at));
        assert.ok(busiest <= 5, `${busiest} requests within one second at the server; slots ${limits.requestCap?.requests}, arrivals ${arrivals.length}: ${arrivals.map((arrival) => `${Math.round(arrival.at - first)}${arrival.path}`).join(" ")}`);
        // Every request the site got took a slot (the page loads and their resources, the API requests, the context
        // the test opened itself), and the run says how many waited. A few slots go to requests that never leave the
        // browser: a test that passes closes its context while its page's images still wait for theirs.
        assert.ok((limits.requestCap?.requests ?? 0) >= arrivals.length, `${limits.requestCap?.requests} slots, ${arrivals.length} arrived`);
        for (const path of ["/p1", "/api/p1", "/app.js", "/a.png", "/weight"]) assert.ok(arrivals.some((arrival) => arrival.path === path), path);
        assert.ok((limits.requestCap?.waited ?? 0) > 0, "some waited");
        const output = job.outputChunks.join("");
        assert.ok(output.includes(`Host limits: ${limits.note}\n`), output);
        assert.match(output, new RegExp(`Request cap: ${limits.requestCap?.requests} request\\(s\\) to the site took a slot; ${limits.requestCap?.waited} of them waited`));
    });
});

test("in a real browser: a test that fails while its page's requests wait for slots doesn't leave the next test waiting out a lease, as Playwright restarts the worker (Gate D ruling 1)", { skip: lanSkip }, async () => {
    // Gate D (2026-10-22): a freed slot went to a waiter whose worker had gone, and stayed held for the 60 s lease, so
    // capped Standard on the hosted Toolshop starved (466 of 484 tests timed out). Here each area's first test loads a
    // page of 30 slow images and fails at once, while most of them still wait for a slot; Playwright then restarts the
    // worker. The second test must still get its slots in time.
    await withRecordingSite(async (origin) => {
        const area = (name: string, index: number) => `test.describe('${name}', () => {
  test('${name}: fails on purpose while its images wait', async ({ page }) => {
    await page.goto('${origin}/heavy', { waitUntil: 'commit' });
    expect(1, 'fails on purpose').toBe(2);
  });
  test('${name}: the next page still loads', async ({ page }) => {
    await page.goto('${origin}/p${index}');
    await expect(page.locator('h1')).toHaveText('/p${index}');
  });
});`;
        const code = `import { test, expect } from '@playwright/test';\n\n${["One", "Two", "Three", "Four"].map((name, index) => area(name, index + 1)).join("\n\n")}\n`;
        const started = Date.now();
        const snapshot = await startRunJob(code, ["functional"], "fast", origin, [], [], "Check the site.");
        const job = await finished(snapshot.runId, 300_000);
        const report = job.result?.report;
        assert.ok(report, job.result?.output);
        const records = report.execution as ExecutionRecord[];
        const summary = records.map((record) => `${record.title}: ${record.status} ${(record.rawMessage ?? "").slice(0, 80)}`).join(" | ");
        assert.equal(records.length, 8, summary);
        // TFP-264 (ruling 4 amended, item 2 as amended): its page may wait for slots before it fails, but its failing
        // step (an instant check) doesn't, so it stays Failed.
        for (const record of records.filter((entry) => /fails on purpose/.test(entry.title))) {
            assert.equal(record.status, "Failed", summary);
            assert.match(record.rawMessage ?? "", /fails on purpose/, summary);
        }
        // Each next test passing inside its 30 s test timeout means none waited out a 60 s lease. On 54c38eb they timed
        // out and the run was stopped at its 140 s budget. Not a wall-clock bound: in a full unit run, under load, the
        // same run took 87 s with every result right (2026-10-26).
        assert.ok(records.filter((entry) => /next page still loads/.test(entry.title)).every((entry) => entry.status === "Passed"), summary);
        const output = job.outputChunks.join("");
        assert.ok(!output.includes("Run timed out"), `the run was stopped at its budget after ${Math.round((Date.now() - started) / 1000)} s: ${summary}`);
    });
});

/**
 * TFP-265: tests that end while their requests still wait for slots: one passes and closes its context with a page of
 * 200 images queued; one fails at once, and one times out, while theirs wait (Playwright replaces a worker after a
 * failure; not asserted here). Ordinary page loads and API requests run beside them.
 */
function waitingSuiteFor(origin: string) {
    return `import { test, expect } from '@playwright/test';

test.describe('Ends', () => {
  test('Ends: passes while its images wait', async ({ page }) => {
    await page.goto('${origin}/many', { waitUntil: 'commit' });
    await expect(page.locator('h1')).toHaveText('many');
  });
  test('Ends: the next page loads', async ({ page }) => {
    await page.goto('${origin}/p1');
    await expect(page.locator('h1')).toHaveText('/p1');
  });
});

test.describe('Fails', () => {
  test('Fails: on purpose while its images wait', async ({ page }) => {
    await page.goto('${origin}/heavy', { waitUntil: 'commit' });
    expect(1, 'fails on purpose').toBe(2);
  });
  test('Fails: the API answers', async ({ request }) => {
    expect((await request.get('${origin}/api/p2')).ok()).toBe(true);
  });
});

test.describe('Times out', () => {
  test('Times out: while its images wait', async ({ page }) => {
    test.setTimeout(5000);
    await page.goto('${origin}/many');
  });
  test('Times out: the next page loads', async ({ page }) => {
    await page.goto('${origin}/p3');
    await expect(page.locator('h1')).toHaveText('/p3');
  });
});
`;
}

test("in a real browser: on a capped host, no second has more than 5 arrivals at the site across 3 runs, with tests passing, failing and timing out while their requests wait; at least as many slots given as arrivals, and what was counted beyond the slots given gave up waiting (TFP-265)", { skip: lanSkip }, async (t) => {
    for (const run of [1, 2, 3]) {
        await withRecordingSite(async (origin, arrivals) => {
            const snapshot = await startRunJob(waitingSuiteFor(origin), ["functional"], "fast", origin, [], [], "Check the site.");
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

            const cap = report.hostLimits?.requestCap;
            assert.ok(cap, "the run's cap counts");
            const busiest = busiestSecond(arrivals);
            const first = Math.min(...arrivals.map((arrival) => arrival.at));
            const spanS = (Math.max(...arrivals.map((arrival) => arrival.at)) - first) / 1000;
            const line = `run ${run}: busiest second ${busiest} arrivals; ${arrivals.length} arrivals over ${spanS.toFixed(1)} s; ${cap.requests} asked, ${cap.granted} given a slot, ${cap.gaveUp} gave up, ${cap.waited} waited`;
            t.diagnostic(line);
            assert.ok(busiest <= 5, `${line}: ${arrivals.map((arrival) => `${Math.round(arrival.at - first)}${arrival.path}`).join(" ")}`);
            // As many slots given as arrivals, or more: a few go unused (a request its context closed after its slot came).
            // A count, not a per-arrival match.
            assert.ok((cap.granted ?? 0) >= arrivals.length, line);
            // What was counted beyond the slots given is waiters that gave up: they never arrive.
            assert.equal(cap.requests, (cap.granted ?? 0) + (cap.gaveUp ?? 0), line);
            assert.ok((cap.gaveUp ?? 0) > 0, `tests ended while their requests waited: ${line}`);
        });
    }
});

test("in a real browser: with the ownership confirmation (a stub until Phase 43), the same host's run uses the machine's limit and no cap, and the timed check runs (Acceptance Criteria 6)", { skip: lanSkip }, async () => {
    setOwnershipLookupForTests((baseUrl) => Boolean(baseUrl?.startsWith(`http://${lanAddress}:`)));
    try {
        await withRecordingSite(async (origin, arrivals) => {
            const snapshot = await startRunJob(suiteFor(origin), ["functional", "performance"], "fast", origin, [], [], "Check the site.");
            const job = await finished(snapshot.runId, 300_000);
            const report = job.result?.report;
            assert.ok(report, job.result?.output);
            const statuses = Object.fromEntries(report.execution.map((record: ExecutionRecord) => [record.title, record.status]));
            assert.ok(report.execution.every((record: ExecutionRecord) => record.status === "Passed"), JSON.stringify(statuses));
            const limits = report.hostLimits;
            assert.ok(limits, "the run record's host limits");
            assert.deepEqual([limits.row, limits.workers, limits.requestsPerSecond, limits.ownershipConfirmed, limits.requestCap], ["confirmed", machineWorkerLimit(), null, true, null]);
            assert.ok(arrivals.length > 0);
            assert.ok(job.outputChunks.join("").includes("the caps are lifted because the site has a valid ownership confirmation covering this host"));
        });
    } finally {
        setOwnershipLookupForTests(null);
    }
});
