/**
 * Phase 38 TFP-149, Acceptance Criteria 3: LCP and CLS are graded with Core
 * Web Vitals' three bands (web.dev, checked 2026-10-05), TBT is recorded with
 * no pass or fail, and every performance finding and failure says it was
 * measured once, in a lab.
 *
 * Runs the generated performance suite on the comparison fixture for the
 * clean site and its four TFP-149 defects: an LCP of about 3 s (finding) and
 * 5 s (failure), and a CLS of about 0.15 (finding) and 0.3 (failure).
 *
 * ISTQB technique: boundary value analysis - one value inside each band on
 * either side of the "good" and "poor" lines, for LCP and for CLS.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/generate/mock/performance-bands.test.ts
 */
import assert from "node:assert";
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import type { ExecutionRecord, JsonReport } from "../../report/types.ts";

const { buildPerformanceChecks, LAB_NOTE } = await import("./performance-checks.ts");
const { flattenSuites } = await import("../../report/execution.ts");
const { startRecordedFixture } = await import("../../../test-support/comparison-fixture.ts");
const { chromiumSkipReason } = await import("../../../test-support/chromium.ts");
const needsChromium = await chromiumSkipReason();

async function runPerformance(baseURL: string): Promise<ExecutionRecord[]> {
    const dir = join(process.cwd(), ".playwright-runs");
    await mkdir(dir, { recursive: true });
    const name = `performance-bands-unit-${process.pid}-${Date.now()}`;
    const specFile = join(dir, `${name}.spec.ts`);
    const jsonFile = join(dir, `${name}.json`);
    const tests = buildPerformanceChecks().map((code, index) => code.replace("test('", `test('TFPL-${String(index + 1).padStart(3, "0")}: `));
    await writeFile(specFile, `import { test, expect } from '@playwright/test';\ntest.use({ baseURL: '${baseURL}' });\ntest.describe('Performance Coverage', () => {\n${tests.join("\n\n")}\n});\n`, "utf8");
    try {
        await new Promise<void>((resolve, reject) => {
            // One worker: timings are what is under test, so nothing else loads the machine meanwhile.
            const child = spawn(process.execPath, [join(process.cwd(), "node_modules", "playwright", "cli.js"), "test", `.playwright-runs/${name}.spec.ts`, "--reporter=json", "--project=chromium", "--workers=1"], {
                cwd: process.cwd(),
                env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: jsonFile, FORCE_COLOR: "0" },
                stdio: "ignore",
                windowsHide: true,
            });
            child.on("error", reject);
            child.on("close", () => resolve());
        });
        return flattenSuites((JSON.parse(await readFile(jsonFile, "utf8")) as JsonReport).suites ?? []);
    } finally {
        await rm(specFile, { force: true });
        await rm(jsonFile, { force: true });
    }
}

const check = (records: ExecutionRecord[], title: string) => {
    const found = records.find((record) => record.title.includes(title));
    assert.ok(found, `no "${title}" in ${records.map((record) => record.title).join(", ")}`);
    return found!;
};
const LCP = "largest contentful paint";
const CLS = "cumulative layout shift";
const TBT = "total blocking time";
const value = (pattern: RegExp, text: string) => Number((pattern.exec(text) ?? [])[1]);

test("in a real browser: LCP and CLS fall in Core Web Vitals' bands - a finding for needs improvement, a failure for poor; TBT is recorded, not judged; every finding and failure says it is a lab measurement", { skip: needsChromium }, async () => {
    const fixture = await startRecordedFixture();
    try {
        const run = async (defect: string) => {
            await fixture.control(`/__fixture/defect?set=${defect}`);
            return runPerformance(fixture.origin);
        };
        const evidence: Record<string, unknown> = {};

        const clean = await run("none");
        evidence.clean = clean.map((record) => [record.title, record.status, record.findings, record.measurements]);
        for (const title of [LCP, CLS]) {
            assert.equal(check(clean, title).status, "Passed", JSON.stringify(evidence));
            assert.deepEqual(check(clean, title).findings, [], `${title} on the clean site: ${JSON.stringify(evidence)}`);
        }
        const tbt = check(clean, TBT);
        assert.equal(tbt.status, "Passed", "TBT is never judged");
        assert.deepEqual(tbt.findings, []);
        assert.match(tbt.measurements?.[0] ?? "", /^TBT \d+ ms on \/ \(\d+ long task\(s\) after the first contentful paint, up to 1\.5 s after load\): recorded, not judged/);
        assert.ok(tbt.remarks.includes("Measured: TBT "), tbt.remarks);

        // LCP about 3 s: needs improvement, a finding.
        const lcp3 = check(await run("performance-lcp-3s"), LCP);
        evidence.lcp3 = [lcp3.status, lcp3.findings];
        assert.equal(lcp3.status, "Passed", JSON.stringify(evidence));
        assert.equal(lcp3.findings?.length, 1, JSON.stringify(evidence));
        const lcp3s = value(/^LCP (\d+\.\d+) s/, lcp3.findings![0]);
        assert.ok(lcp3s > 2.5 && lcp3s <= 4, `LCP ${lcp3s} s: ${JSON.stringify(evidence)}`);
        assert.match(lcp3.findings![0], /Core Web Vitals "needs improvement" \(over 2\.5 s, up to 4\.0 s\)\. Largest element: img/);

        // LCP about 5 s: poor, a failure.
        const lcp5 = check(await run("performance-lcp-5s"), LCP);
        evidence.lcp5 = [lcp5.status, lcp5.rawMessage.split("\n")[0]];
        assert.equal(lcp5.status, "Failed", JSON.stringify(evidence));
        assert.ok(value(/LCP (\d+\.\d+) s, budget 4\.0 s/, lcp5.rawMessage) > 4, lcp5.rawMessage);

        // CLS about 0.15: needs improvement, a finding.
        const cls15 = check(await run("performance-shift-0.15"), CLS);
        evidence.cls15 = [cls15.status, cls15.findings];
        assert.equal(cls15.status, "Passed", JSON.stringify(evidence));
        assert.equal(cls15.findings?.length, 1, JSON.stringify(evidence));
        const cls15value = value(/^CLS (\d+\.\d+) on \//, cls15.findings![0]);
        assert.ok(cls15value > 0.1 && cls15value <= 0.25, `CLS ${cls15value}: ${JSON.stringify(evidence)}`);
        assert.match(cls15.findings![0], /Core Web Vitals "needs improvement" \(over 0\.1, up to 0\.25\)/);

        // CLS about 0.3: poor, a failure.
        const cls30 = check(await run("performance-shift-0.3"), CLS);
        evidence.cls30 = [cls30.status, cls30.rawMessage.split("\n")[0]];
        assert.equal(cls30.status, "Failed", JSON.stringify(evidence));
        assert.ok(value(/CLS (\d+\.\d+) on \/, budget 0\.25/, cls30.rawMessage) > 0.25, cls30.rawMessage);

        // The lab wording, on every finding and failure seen here.
        for (const text of [lcp3.findings![0], lcp5.rawMessage, cls15.findings![0], cls30.rawMessage, tbt.measurements![0]]) {
            assert.ok(text.includes(LAB_NOTE), `no lab wording in: ${text}`);
        }
        console.log(JSON.stringify(evidence));
    } finally {
        await fixture.close();
    }
});

test("in a real browser: TBT counts a long task after the first contentful paint (a 300 ms busy loop gives about 250 ms), still with no pass or fail", { skip: needsChromium }, async () => {
    const { createServer } = await import("node:http");
    // Paints text, then blocks the main thread for 300 ms: one long task, 250 ms of it over 50 ms.
    const page = "<!doctype html><html lang='en'><head><title>busy</title></head><body><h1>Busy page</h1><script>requestAnimationFrame(() => setTimeout(() => { const end = performance.now() + 300; while (performance.now() < end) {} }, 100));</script></body></html>";
    const server = createServer((_req, res) => res.writeHead(200, { "content-type": "text/html" }).end(page));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
        const records = await runPerformance(`http://127.0.0.1:${(server.address() as import("node:net").AddressInfo).port}`);
        const tbt = check(records, TBT);
        assert.equal(tbt.status, "Passed");
        const ms = value(/^TBT (\d+) ms/, tbt.measurements?.[0] ?? "");
        assert.ok(ms >= 200 && ms <= 400, `TBT ${ms} ms: ${tbt.measurements}`);
        assert.match(tbt.measurements![0], /\(1 long task\(s\) after the first contentful paint/);
    } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
    }
});
