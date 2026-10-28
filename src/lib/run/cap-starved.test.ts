/**
 * TFP-264 (ruling 4 amended, item 2 as amended, 2026-10-28): which capped failures the request cap starved, from the
 * test's own waiting spans and the step that failed (src/lib/run/cap-starved.ts).
 *
 * ISTQB techniques:
 * - Decision table, offline: waiting through the failing step, only before it, partly in it, none; a step that fails
 *   at once; no failing step; the 2 s shared check and the 5 s default.
 * - Boundary value analysis: the assertion wait less the 100 ms step-timing slack, just above and just below.
 * - The marker on a JSON report and timing file: it marks only an unexpected test with waits and timing, once.
 * - Decision table, in a real browser through the executor, on a site bound to this machine's LAN address (a host
 *   Decision 10 caps): a test the cap holds up through its failing step is Not run, and the same test uncapped passes;
 *   a real defect with some waiting, one after an early wait, and one after an earlier test's queued images stay
 *   Failed; a real shared check (2 s) starved through its failing check is Not run. The capped budget is 60 minutes.
 *   An action is starved only when it timed out: a strict-mode failure while its page's requests are queued stays
 *   Failed (a third clarification, 2026-10-28).
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/run/cap-starved.test.ts
 */
import assert from "node:assert";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { after, test } from "node:test";
import type { ExecutionRecord } from "../report/types.ts";

const scratch = mkdtempSync(join(tmpdir(), "testforge-cap-starved-"));
process.env.TESTFORGE_RUNS_ROOT = join(scratch, "runs");
process.env.TESTFORGE_DATA_DIR = join(scratch, "data");
after(() => rmSync(scratch, { recursive: true, force: true }));

const { starvedReason, waitingWithin, failingStep, markCapStarved, STEP_TIMING_SLACK_MS } = await import("./cap-starved.ts");
const { REQUEST_CAP_STARVED_ANNOTATION, REQUEST_CAP_WAITS_ANNOTATION } = await import("../report/execution.ts");
const { setOwnershipLookupForTests } = await import("./ownership.ts");
const { startRunJob } = await import("./executor.ts");
const { waitForSavedRun } = await import("../../test-support/saved-run.ts");
const { chromiumSkipReason } = await import("../../test-support/chromium.ts");
const { lanAddress, withRecordingSite } = await import("../../test-support/recording-site.ts");
const { shareReadOnlyVisits } = await import("../generate/shared-visits.ts");
const { PAGE_VISIT_HELPER } = await import("../generate/page-visits.ts");
const needsChromium = await chromiumSkipReason();
const lanSkip = needsChromium || (lanAddress ? false : "this machine has no LAN IPv4 address to serve a remote-looking host from");
/** A run finalized: its result set and its record saved (run.json written, no .tmp left: waitForSavedRun). */
const finished = (id: string, timeoutMs: number) => waitForSavedRun(id, timeoutMs);

const T = 1_800_000_000_000;
const step = (kind: "goto" | "expect" | "other", startedAt: number, duration: number, failed: boolean, timedOut = false) => ({ kind, target: "", startedAt, duration, failed, timedOut });

test("waitingWithin: only the waiting inside the window counts", () => {
    assert.equal(waitingWithin([[T, T + 1000], [T + 3000, T + 6000]], T + 500, T + 4000), 500 + 1000);
    assert.equal(waitingWithin([], T, T + 5000), 0);
    assert.equal(waitingWithin([[T, T + 1000]], T + 1000, T + 2000), 0);
});

test("failingStep: the last step to end, when it failed and isn't a settle wait; none otherwise", () => {
    const settle = (startedAt: number, failed: boolean) => ({ kind: "settle" as const, target: "", startedAt, duration: 5000, failed });
    assert.equal(failingStep([step("goto", T, 1000, false), step("expect", T + 1000, 5000, false)]), null, "nothing failed");
    assert.deepEqual(failingStep([step("goto", T, 30_000, true), step("expect", T + 100, 5000, true)]), step("goto", T, 30_000, true), "the last to end");
    assert.deepEqual(failingStep([step("goto", T, 1000, true), step("expect", T + 1000, 5000, true)]), step("expect", T + 1000, 5000, true), "the last to end");
    // A caught failure: the settle wait reached its cap, and the test went on.
    assert.equal(failingStep([step("goto", T, 1000, false), settle(T + 1000, true)]), null, "a caught settle wait last, then a plain throw");
    assert.equal(failingStep([step("goto", T, 1000, false), settle(T + 1000, true), step("expect", T + 6000, 10, false)]), null, "a caught settle wait, then a passing check");
    assert.equal(failingStep([step("expect", T, 2000, true), step("goto", T + 2000, 500, false)]), null, "a failure the test went on from");
});

test("starvedReason: only waiting during the step that failed counts against its assertion wait (decision table)", () => {
    const load = step("goto", T, 12_000, false);
    const check = step("expect", T + 12_000, 5_020, true);
    const cases: Array<[string, { assertionWaitMs: number; spans: Array<[number, number]> }, ReturnType<typeof step>[], boolean]> = [
        ["waited through the failing check", { assertionWaitMs: 5000, spans: [[T + 11_000, T + 18_000]] }, [load, check], true],
        ["waited only while loading, before the check", { assertionWaitMs: 5000, spans: [[T, T + 12_000]] }, [load, check], false],
        ["waited 2 s of the 5 s check", { assertionWaitMs: 5000, spans: [[T + 12_000, T + 14_000]] }, [load, check], false],
        ["never waited", { assertionWaitMs: 5000, spans: [] }, [load, check], false],
        ["an instant failure after a long wait", { assertionWaitMs: 5000, spans: [[T, T + 12_000]] }, [load, step("expect", T + 12_000, 1, true)], false],
        ["no failing step (a plain timeout in the test's own code)", { assertionWaitMs: 5000, spans: [[T, T + 30_000]] }, [load], false],
        // Amended again (2026-10-28): a step that isn't an assertion is starved only if a request was still waiting as it
        // failed (within the 100 ms slack), however long it waited before.
        ["a navigation that timed out waiting", { assertionWaitMs: 5000, spans: [[T + 200, T + 30_000]] }, [step("goto", T, 30_000, true, true)], true],
        ["a click that timed out, its page queued only at its start", { assertionWaitMs: 5000, spans: [[T, T + 6_000]] }, [step("other", T, 30_000, true, true)], false],
        ["a click that timed out, a request still waiting 50 ms before", { assertionWaitMs: 5000, spans: [[T + 29_000, T + 29_950]] }, [step("other", T, 30_000, true, true)], true],
        ["a click that timed out, the last wait over 150 ms before", { assertionWaitMs: 5000, spans: [[T + 29_000, T + 29_850]] }, [step("other", T, 30_000, true, true)], false],
        // A third clarification (2026-10-28): only a step that timed out. One that fails at once (a strict-mode
        // violation, a detached element, an invalid selector) fails on what the page is, even with a request queued.
        ["a click that failed at once on a page still loading", { assertionWaitMs: 5000, spans: [[T, T + 9_000]] }, [step("goto", T, 500, false), step("other", T + 500, 20, true)], false],
        ["a click that failed late, not by timing out, a request still waiting", { assertionWaitMs: 5000, spans: [[T + 200, T + 30_000]] }, [step("other", T, 29_000, true)], false],
        ["a load that failed at once (refused), a request still waiting", { assertionWaitMs: 5000, spans: [[T, T + 9_000]] }, [step("goto", T, 30, true)], false],
        ["a shared check, waited through its 2 s", { assertionWaitMs: 2000, spans: [[T + 12_000, T + 15_000]] }, [load, step("expect", T + 12_000, 1_950, true)], true],
        ["a shared check, waited 1.5 s of its 2 s", { assertionWaitMs: 2000, spans: [[T + 12_500, T + 15_000]] }, [load, step("expect", T + 12_000, 2_000, true)], false],
    ];
    for (const [name, waits, steps, starved] of cases) assert.equal(starvedReason(waits, steps) !== null, starved, name);
    assert.match(starvedReason(cases[0][1], cases[0][2]) ?? "", /^starved by the request cap: during the step that failed, its requests waited 5\.0 s for slots, as long as its 5 s assertion wait/);
});

test("starvedReason: the assertion wait less the step-timing slack, just above and just below (boundary values)", () => {
    const at = (covered: number) => starvedReason({ assertionWaitMs: 2000, spans: [[T, T + covered]] }, [step("expect", T, 2000, true)]);
    assert.equal(STEP_TIMING_SLACK_MS, 100);
    assert.notEqual(at(2000 - STEP_TIMING_SLACK_MS), null);
    assert.equal(at(2000 - STEP_TIMING_SLACK_MS - 1), null);
});

test("markCapStarved: marks an unexpected test whose failing step waited, once; leaves passes, unrecorded tests and tests without timing", async () => {
    const waits = (spans: Array<[number, number]>) => ({ type: REQUEST_CAP_WAITS_ANNOTATION, description: JSON.stringify({ assertionWaitMs: 5000, spans }) });
    const spec = (id: string, status: string, annotations: Array<{ type: string; description?: string }>) => ({ id, title: id, tests: [{ status, annotations }] });
    const report = { suites: [{ title: "a.spec.ts", specs: [spec("starved", "unexpected", [waits([[T, T + 31_000]])]), spec("passed", "expected", [waits([[T, T + 31_000]])])], suites: [{ title: "inner", specs: [spec("early", "unexpected", [waits([[T, T + 12_000]])]), spec("untimed", "unexpected", [waits([[T, T + 31_000]])]), spec("plain", "unexpected", [])] }] }] };
    const timing = { version: 1, tests: [
        { id: "starved", retry: 0, steps: [step("goto", T, 30_000, true, true)] },
        { id: "passed", retry: 0, steps: [step("goto", T, 30_000, false)] },
        { id: "early", retry: 0, steps: [step("goto", T, 12_000, false), step("expect", T + 12_000, 5_000, true)] },
        { id: "plain", retry: 0, steps: [step("expect", T, 5_000, true)] },
    ] };
    const reportFile = join(scratch, "report.json"), timingFile = join(scratch, "timing.json");
    writeFileSync(reportFile, JSON.stringify(report));
    writeFileSync(timingFile, JSON.stringify(timing));
    assert.equal(await markCapStarved(reportFile, timingFile), 1);
    assert.equal(await markCapStarved(reportFile, timingFile), 0, "marked once");
    const written = JSON.parse(readFileSync(reportFile, "utf8"));
    const starvedOf = (suite: { specs: Array<{ id: string; tests: Array<{ annotations: Array<{ type: string }> }> }> }) => suite.specs.filter((entry) => entry.tests[0].annotations.some((annotation) => annotation.type === REQUEST_CAP_STARVED_ANNOTATION)).map((entry) => entry.id);
    assert.deepEqual([...starvedOf(written.suites[0]), ...starvedOf(written.suites[0].suites[0])], ["starved"]);
});

/** TFP-264: one test that loads a page of 200 images, and one that checks a heading the page doesn't have. */
const starvedSuite = (origin: string) => `import { test, expect } from '@playwright/test';

test.describe('Starved', () => {
  test('Starved: a page of 200 images loads', async ({ page }) => {
    await page.goto('${origin}/many');
    await expect(page.locator('h1')).toHaveText('many');
  });
});
`;
const defectSuite = (origin: string) => `import { test, expect } from '@playwright/test';

test.describe('Defect', () => {
  test('Defect: the heading says what it should', async ({ page }) => {
    await page.goto('${origin}/some');
    await expect(page.locator('h1')).toHaveText('not this heading');
  });
});
`;
/** TFP-264: the first test leaves 200 images waiting in a context it keeps open (as a page group's shared visit does); the next fails on purpose 6 s later. */
const carrySuite = (origin: string) => `import { test, expect } from '@playwright/test';

let kept;
test.describe('Carry', () => {
  test('Carry: leaves its images loading', async ({ browser }) => {
    kept = await browser.newContext();
    const page = await kept.newPage();
    await page.goto('${origin}/many', { waitUntil: 'commit' });
  });
  test('Carry: the next test fails on its own', async () => {
    await new Promise((resolve) => setTimeout(resolve, 6000));
    expect(1, 'fails on purpose').toBe(2);
  });
});
`;

test("in a real browser: on a capped host, a test the cap holds up past its assertion wait is Not run, 'starved by the request cap', with its wait; the run counts it and has 60 minutes (TFP-264)", { skip: lanSkip }, async () => {
    await withRecordingSite(async (origin) => {
        const snapshot = await startRunJob(starvedSuite(origin), ["functional"], "fast", origin, [], [], "Check the site.");
        const job = await finished(snapshot.runId, 300_000);
        const report = job.result?.report;
        assert.ok(report, job.result?.output);
        const [record] = report.execution as ExecutionRecord[];
        const said = `${record?.status} ${record?.skipReason} ${record?.requestCapWaitMs} ms: ${(record?.rawMessage ?? "").slice(0, 120)}`;
        assert.equal(record.status, "Not run", said);
        assert.match(record.skipReason ?? "", /^starved by the request cap: when the step that failed gave up, its requests were still waiting for slots \(\d+\.\d s of waiting during it\)/, said);
        assert.ok((record.requestCapWaitMs ?? 0) > 5000, said);
        // It ran out of time waiting: what the cap starved is still in its message, for whoever reads the evidence.
        assert.match(record.rawMessage ?? "", /timeout|exceeded/i, said);
        assert.equal(report.summary.failed, 0, said);
        assert.equal(report.hostLimits?.requestCap?.starved, 1);
        const output = job.outputChunks.join("");
        assert.ok(output.includes("Run budget: up to 3600s"), output);
        assert.ok(output.includes(`Request cap: 1 test(s) failed while the cap held up their requests in the step that failed, so they are reported Not run ("starved by the request cap"), not Failed.`), output);
    });
});

test("in a real browser: the same test uncapped (the ownership confirmation's stub) passes, with no wait recorded (TFP-264)", { skip: lanSkip }, async () => {
    setOwnershipLookupForTests((baseUrl) => Boolean(baseUrl?.startsWith(`http://${lanAddress}:`)));
    try {
        await withRecordingSite(async (origin) => {
            const snapshot = await startRunJob(starvedSuite(origin), ["functional"], "fast", origin, [], [], "Check the site.");
            const job = await finished(snapshot.runId, 300_000);
            const report = job.result?.report;
            assert.ok(report, job.result?.output);
            const [record] = report.execution as ExecutionRecord[];
            assert.equal(record.status, "Passed", `${record.status}: ${(record.rawMessage ?? "").slice(0, 120)}`);
            assert.equal(record.requestCapWaitMs, undefined);
            assert.equal(report.hostLimits?.requestCap, null);
            assert.ok(!job.outputChunks.join("").includes("starved by the request cap"));
        });
    } finally {
        setOwnershipLookupForTests(null);
    }
});

test("in a real browser: on a capped host, a real defect with little waiting stays Failed (TFP-264)", { skip: lanSkip }, async () => {
    await withRecordingSite(async (origin) => {
        const snapshot = await startRunJob(defectSuite(origin), ["functional"], "fast", origin, [], [], "Check the site.");
        const job = await finished(snapshot.runId, 300_000);
        const report = job.result?.report;
        assert.ok(report, job.result?.output);
        const [record] = report.execution as ExecutionRecord[];
        const said = `${record?.status} ${record?.skipReason} ${record?.requestCapWaitMs} ms: ${(record?.rawMessage ?? "").slice(0, 120)}`;
        assert.equal(record.status, "Failed", said);
        assert.equal(record.skipReason, undefined, said);
        assert.match(record.rawMessage ?? "", /not this heading/, said);
        assert.ok(record.requestCapWaitMs !== undefined && record.requestCapWaitMs > 0 && record.requestCapWaitMs < 5000, said);
        assert.equal(report.hostLimits?.requestCap?.starved, 0);
        assert.ok(job.outputChunks.join("").includes("Request cap: 0 test(s) failed while the cap held up"));
    });
});

test("in a real browser: on a capped host, requests an earlier test left waiting don't count as the next test's wait (TFP-264)", { skip: lanSkip }, async () => {
    // A page group's shared visit outlives each check. Counted per worker, the first test's 200 queued images would
    // be 6 s of the second's wait, and its own failure would read as starved.
    await withRecordingSite(async (origin) => {
        const snapshot = await startRunJob(carrySuite(origin), ["functional"], "fast", origin, [], [], "Check the site.");
        const job = await finished(snapshot.runId, 300_000);
        const report = job.result?.report;
        assert.ok(report, job.result?.output);
        const records = report.execution as ExecutionRecord[];
        const said = records.map((record) => `${record.title}: ${record.status} ${record.skipReason ?? ""} ${record.requestCapWaitMs} ms`).join(" | ");
        const next = records.find((record) => /fails on its own/.test(record.title));
        assert.equal(next?.status, "Failed", said);
        assert.equal(next?.requestCapWaitMs, 0, said);
        assert.match(next?.rawMessage ?? "", /fails on purpose/, said);
    });
});

test("in a real browser: on a capped host, a test that waits for slots early, then fails a later check whose requests didn't wait, stays Failed (TFP-264, ruling 4 amended)", { skip: lanSkip }, async () => {
    // Its page of 60 images waits about 12 s for slots while it loads; the check that fails afterwards waits for none.
    await withRecordingSite(async (origin) => {
        const code = `import { test, expect } from '@playwright/test';

test.describe('Early', () => {
  test('Early: waits to load, then the heading is wrong', async ({ page }) => {
    await page.goto('${origin}/sixty');
    await expect(page.locator('h1')).toHaveText('not this heading');
  });
});
`;
        const snapshot = await startRunJob(code, ["functional"], "fast", origin, [], [], "Check the site.");
        const job = await finished(snapshot.runId, 300_000);
        const report = job.result?.report;
        assert.ok(report, job.result?.output);
        const [record] = report.execution as ExecutionRecord[];
        const said = `${record?.status} ${record?.skipReason} ${record?.requestCapWaitMs} ms: ${(record?.rawMessage ?? "").slice(0, 120)}`;
        assert.equal(record.status, "Failed", said);
        assert.match(record.rawMessage ?? "", /not this heading/, said);
        // As first worded (any waiting in the test), this would have been starved.
        assert.ok((record.requestCapWaitMs ?? 0) > 5000, said);
        assert.equal(report.hostLimits?.requestCap?.starved, 0);
    });
});

test("in a real browser: on a capped host, a shared check (2 s assertion wait) whose requests wait through its failing check is Not run, starved (TFP-264, ruling 4 amended)", { skip: lanSkip }, async () => {
    await withRecordingSite(async (origin) => {
        const code = shareReadOnlyVisits(`import { test, expect } from '@playwright/test';

test.use({ baseURL: '${origin}' });

${PAGE_VISIT_HELPER}

test.describe('Functional Coverage', () => {
  test('TFFU-001: shared: the page says it is ready', async ({ page }) => {
    await tfGoto(page, '/late');
    await expect(page.locator('h2')).toHaveText('ready');
  });
});
`);
        assert.match(code, /const test = tfSharedTest;\n {2}const expect = tfSharedExpect;/, "a shared check");
        const snapshot = await startRunJob(code, ["functional"], "fast", origin, [], [], "Check the site.");
        const job = await finished(snapshot.runId, 300_000);
        const report = job.result?.report;
        assert.ok(report, job.result?.output);
        const [record] = report.execution as ExecutionRecord[];
        const said = `${record?.status} ${record?.skipReason} ${record?.requestCapWaitMs} ms: ${(record?.rawMessage ?? "").slice(0, 160)}`;
        assert.equal(record.status, "Not run", said);
        assert.match(record.skipReason ?? "", /^starved by the request cap: during the step that failed, its requests waited \d+\.\d s for slots, as long as its 2 s assertion wait/, said);
        assert.equal(report.hostLimits?.requestCap?.starved, 1);
    });
});

test("in a real browser: on a capped host, a click that times out on a page whose requests were queued only at its start stays Failed (TFP-264, amended again)", { skip: lanSkip }, async () => {
    // The page's 30 slow images wait for slots for the click's first seconds and are all in long before the 30 s test
    // timeout; the button is missing. Under the assertion rule for actions, those seconds of waiting would starve it.
    await withRecordingSite(async (origin) => {
        const code = `import { test, expect } from '@playwright/test';

test.describe('Click', () => {
  test('Click: a button that is not there', async ({ page }) => {
    await page.goto('${origin}/heavy', { waitUntil: 'commit' });
    await page.click('#missing');
  });
});
`;
        const snapshot = await startRunJob(code, ["functional"], "fast", origin, [], [], "Check the site.");
        const job = await finished(snapshot.runId, 300_000);
        const report = job.result?.report;
        assert.ok(report, job.result?.output);
        const [record] = report.execution as ExecutionRecord[];
        const said = `${record?.status} ${record?.skipReason} ${record?.requestCapWaitMs} ms: ${(record?.rawMessage ?? "").slice(0, 160)}`;
        assert.equal(record.status, "Failed", said);
        assert.match(record.rawMessage ?? "", /timeout|exceeded/i, said);
        assert.ok((record.requestCapWaitMs ?? 0) > 5000, `its page did wait for slots, at first: ${said}`);
        assert.equal(report.hostLimits?.requestCap?.starved, 0);
    });
});

test("in a real browser: on a capped host, a load that fails at once on a refused connection, its slot free, stays Failed (TFP-264)", { skip: lanSkip }, async () => {
    // A site that is down is the site's failure. Its slot was free at once, so no request waited: not starved.
    await withRecordingSite(async (origin) => {
        const closed = await new Promise<number>((resolve) => {
            const probe = createServer();
            probe.listen(0, lanAddress!, () => {
                const { port } = probe.address() as AddressInfo;
                probe.close(() => resolve(port));
            });
        });
        const code = `import { test, expect } from '@playwright/test';

test.describe('Down', () => {
  test('Down: the page answers', async ({ page }) => {
    await page.goto('http://${lanAddress}:${closed}/');
  });
});
`;
        const snapshot = await startRunJob(code, ["functional"], "fast", origin, [], [], "Check the site.");
        const job = await finished(snapshot.runId, 300_000);
        const report = job.result?.report;
        assert.ok(report, job.result?.output);
        const [record] = report.execution as ExecutionRecord[];
        const said = `${record?.status} ${record?.skipReason} ${record?.requestCapWaitMs} ms: ${(record?.rawMessage ?? "").slice(0, 160)}`;
        assert.equal(record.status, "Failed", said);
        assert.match(record.rawMessage ?? "", /ERR_CONNECTION_REFUSED|ECONNREFUSED/i, said);
        assert.equal(record.requestCapWaitMs, 0, said);
        assert.equal(report.hostLimits?.requestCap?.starved, 0);
    });
});

test("in a real browser: on a capped host, a strict-mode failure while the page's requests are still queued stays Failed (TFP-264, a third clarification)", { skip: lanSkip }, async () => {
    // The page's 200 images are still waiting for slots (about 40 s of them at 5 a second) when the click fails at once:
    // its locator matches them all. It failed on what the page is, not on the wait.
    await withRecordingSite(async (origin) => {
        const code = `import { test, expect } from '@playwright/test';

test.describe('Strict', () => {
  test('Strict: click the image', async ({ page }) => {
    await page.goto('${origin}/many', { waitUntil: 'domcontentloaded' });
    await page.locator('img').click();
  });
});
`;
        const snapshot = await startRunJob(code, ["functional"], "fast", origin, [], [], "Check the site.");
        const job = await finished(snapshot.runId, 300_000);
        const report = job.result?.report;
        assert.ok(report, job.result?.output);
        const [record] = report.execution as ExecutionRecord[];
        const said = `${record?.status} ${record?.skipReason} ${record?.requestCapWaitMs} ms: ${(record?.rawMessage ?? "").slice(0, 160)}`;
        assert.equal(record.status, "Failed", said);
        assert.match(record.rawMessage ?? "", /strict mode violation/, said);
        assert.ok((record.requestCapWaitMs ?? 0) > 0, `its requests were queued as it failed: ${said}`);
        assert.equal(report.hostLimits?.requestCap?.starved, 0);
    });
});
