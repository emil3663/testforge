/**
 * Phase 39 (TFP-157, Decisions 10 and 11, Acceptance Criteria 6): the worker limit and request cap by host, and the
 * ownership row that lifts both.
 *
 * ISTQB techniques:
 * - Decision table, offline: the host (local, `.test`, remote) against the ownership confirmation (present or not),
 *   giving the row, the workers and the cap; the machine limit at its boundaries (1, 2, 3 and 12 cores).
 * - Equivalence partitioning, offline: which requests count against the cap (the site's host, a host under its
 *   domain, a third party, a non-HTTP URL), and the domain a host's requests count under.
 * - Boundary value analysis: the slot server never gives two slots less than 1000 / cap ms apart, measured.
 * - Request recording, in a real browser, through the executor: a site bound to this machine's LAN address (a host
 *   Decision 10 doesn't treat as local) records every request it gets. Capped: at most 3 workers, more than one used,
 *   and at most 5 requests in any second at the server, with the waits counted; the timed check is Not run with its
 *   reason. With a stub ownership confirmation (TFP-220 replaces the stub in Phase 43): the machine's limit, no cap,
 *   and the timed check runs.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/run/host-limits.test.ts
 */
import assert from "node:assert";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { networkInterfaces, tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import type { ExecutionRecord } from "../report/types.ts";

const scratch = mkdtempSync(join(tmpdir(), "testforge-host-limits-"));
process.env.TESTFORGE_RUNS_ROOT = join(scratch, "runs");
process.env.TESTFORGE_DATA_DIR = join(scratch, "data");

const { hostLimitsFor, machineWorkerLimit, siteDomainOf, countsAgainstCap } = await import("./host-limits.ts");
const { startRequestCap, withRequestCap, REQUEST_CAP_TOKEN_HEADER } = await import("./request-cap.ts");
const { setOwnershipLookupForTests } = await import("./ownership.ts");
const { TIMED_CHECK_TITLES } = await import("../generate/mock/performance-checks.ts");
const { startRunJob } = await import("./executor.ts");
const { runJobs } = await import("./jobs.ts");
const { chromiumSkipReason } = await import("../../test-support/chromium.ts");
const needsChromium = await chromiumSkipReason();
after(() => rmSync(scratch, { recursive: true, force: true }));

test("the host table: local and confirmed hosts get the machine's limit and no cap; any other host at most 3 workers and 5 requests per second (decision table)", () => {
    const rows: Array<[string, boolean, string, number, number | null]> = [
        ["http://127.0.0.1:4410", false, "local", 6, null],
        ["http://localhost:3000", true, "local", 6, null],
        ["http://shop.test", false, "local", 6, null],
        ["http://app.localhost", false, "local", 6, null],
        ["https://practicesoftwaretesting.com", false, "capped", 3, 5],
        ["https://practicesoftwaretesting.com", true, "confirmed", 6, null],
        ["http://192.168.1.10:8080", false, "capped", 3, 5],
        ["http://192.168.1.10:8080", true, "confirmed", 6, null],
    ];
    for (const [url, ownershipConfirmed, row, workers, cap] of rows) {
        const limits = hostLimitsFor(url, { ownershipConfirmed, cores: 12 });
        assert.deepEqual([limits.row, limits.workers, limits.requestsPerSecond, limits.ownershipConfirmed], [row, workers, cap, ownershipConfirmed], `${url}, confirmation ${ownershipConfirmed}`);
    }
    const capped = hostLimitsFor("https://www.practicesoftwaretesting.com/#/", { ownershipConfirmed: false, cores: 12 });
    assert.equal(capped.siteDomain, "practicesoftwaretesting.com");
    assert.equal(capped.note, "3 worker(s) at most, sharing a cap of 5 requests per second to practicesoftwaretesting.com: this host is not local and has no ownership confirmation (Decision 10).");
    assert.equal(hostLimitsFor("https://example.com", { ownershipConfirmed: true, cores: 12 }).note, "6 worker(s), no request cap: the caps are lifted because the site has a valid ownership confirmation covering this host (Decision 10).");
    assert.equal(hostLimitsFor("http://127.0.0.1:1", { ownershipConfirmed: false, cores: 12 }).note, "6 worker(s), no request cap: a local development host (Decision 10).");
});

test("the machine's limit: half the cores, at least 1; a capped host never more than 3 (boundary values)", () => {
    for (const [cores, machine, capped] of [[1, 1, 1], [2, 1, 1], [3, 1, 1], [4, 2, 2], [7, 3, 3], [12, 6, 3]]) {
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

test("the slot server: at most 5 slots held at once, each held a second after it's handed back; each wait is counted; a wrong token gets none (boundary values)", async () => {
    const cap = await startRequestCap(5);
    try {
        const headers = (token: string) => ({ method: "POST", headers: { [REQUEST_CAP_TOKEN_HEADER]: token } });
        assert.equal((await fetch(`${cap.url}/slot`, headers("wrong"))).status, 404);
        const started = performance.now();
        let firstRelease = Infinity;
        // Eight ask at once; each hands its slot back as soon as it has it.
        const given = await Promise.all(Array.from({ length: 8 }, async () => {
            const response = await fetch(`${cap.url}/slot`, headers(cap.token));
            const at = performance.now() - started;
            const id = await response.text();
            firstRelease = Math.min(firstRelease, performance.now() - started);
            assert.equal((await fetch(`${cap.url}/release/${id}`, headers(cap.token))).status, 204);
            return { status: response.status, at };
        }));
        assert.ok(given.every((slot) => slot.status === 200));
        const times = given.map((slot) => slot.at).sort((left, right) => left - right);
        assert.ok(times[4] < 500, `the first five at once: ${times.map(Math.round).join(", ")} ms`);
        assert.ok(times[5] >= firstRelease + 990, `the sixth only a second after the first was handed back (${Math.round(firstRelease)} ms): ${times.map(Math.round).join(", ")} ms`);
        const stats = cap.stats();
        assert.equal(stats.requests, 8);
        assert.equal(stats.waited, 3, "the three past the cap waited");
    } finally {
        await cap.close();
    }
});

test("the timed checks, by title: each of Performance's load-timed checks, and none of the others", () => {
    const timed = ["TFPL-001: landing page finishes loading within 5 s", "TFPL-002: largest contentful paint stays under 4 s", "TFPL-005: cumulative layout shift during load stays under 0.25", "TFPL-006: total blocking time during load (recorded, not judged)", "server responds and the page is ready quickly"];
    const untimed = ["TFPL-003: page weight stays under 5 MB", "TFPL-004: no same-origin request fails while the page loads", "TFFU-001: loads the target page and shows visible content"];
    for (const title of timed) assert.ok(TIMED_CHECK_TITLES.some((pattern) => pattern.test(title)), title);
    for (const title of untimed) assert.ok(!TIMED_CHECK_TITLES.some((pattern) => pattern.test(title)), title);
});

/** This machine's LAN address: a host Decision 10 treats as remote, served from here. */
const lanAddress = Object.values(networkInterfaces()).flat().find((entry) => entry?.family === "IPv4" && !entry.internal)?.address ?? null;

/** A site on the LAN address that records when each request arrived. Each page pulls in a script and three images. */
async function withRecordingSite(run: (origin: string, arrivals: Array<{ path: string; at: number }>) => Promise<void>) {
    const arrivals: Array<{ path: string; at: number }> = [];
    const page = (title: string) => `<!doctype html><html lang="en"><head><title>${title}</title><script src="/app.js"></script></head><body><h1>${title}</h1><img src="/a.png" alt="a"><img src="/b.png" alt="b"><img src="/c.png" alt="c"></body></html>`;
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
    const server = createServer((req, res) => {
        const path = (req.url ?? "/").split("?")[0];
        arrivals.push({ path, at: performance.now() });
        if (path.endsWith(".png")) res.writeHead(200, { "content-type": "image/png" }).end(png);
        else if (path === "/app.js") res.writeHead(200, { "content-type": "text/javascript" }).end("document.documentElement.dataset.ready = '1';");
        else if (path.startsWith("/api/")) res.writeHead(200, { "content-type": "application/json" }).end('{"ok":true}');
        else res.writeHead(200, { "content-type": "text/html" }).end(page(path));
    });
    await new Promise<void>((resolve) => server.listen(0, lanAddress!, resolve));
    try {
        await run(`http://${lanAddress}:${(server.address() as AddressInfo).port}`, arrivals);
    } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
    }
}

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

/** A run finalized: its result set and its record saved. */
async function finished(id: string, timeoutMs: number) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const job = runJobs.get(id);
        if (job?.result && existsSync(join(process.env.TESTFORGE_RUNS_ROOT!, id))) return job;
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`run ${id} did not finish in ${timeoutMs} ms`);
}

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
