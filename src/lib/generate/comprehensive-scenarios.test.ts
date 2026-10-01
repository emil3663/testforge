/**
 * Phase 35 (TFP-135, Decision 5; Acceptance Criteria 4): the local model's
 * scenarios in a Comprehensive run are shown in their own report section and
 * change nothing else - a deliberately failing model test leaves the verdict
 * exactly as it is without it.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/generate/comprehensive-scenarios.test.ts
 */
import assert from "node:assert";
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { test } from "node:test";
import type { ComprehensiveRunMode } from "../comprehensive/run-mode.ts";
import type { GenerationRecord, JsonReport } from "../report/types.ts";

const { buildComprehensiveSuite, mergeComprehensiveScenarios } = await import("./comprehensive.ts");
const { normalizeRunMode } = await import("../comprehensive/run-mode.ts");
const { buildReport } = await import("../report/report.ts");
const { buildReportHtmlDocument } = await import("../report/html.ts");
const { findTypeErrors } = await import("./validate.ts");

const { chromiumSkipReason } = await import("../../test-support/chromium.ts");
const needsChromium = await chromiumSkipReason();

const MODEL = "testforge-qwen7b:latest";
const FAILING_SCENARIO = [
    "import { test, expect } from '@playwright/test';",
    "test('the home page greets the user by name', async ({ page }) => {",
    "  await page.goto('/');",
    "  await expect(page.locator('h1'), 'the greeting').toHaveText('Welcome back, Ada', { timeout: 2000 });",
    "});",
].join("\n");

async function runWithPlaywright(code: string, env: Record<string, string>): Promise<JsonReport> {
    const dir = join(process.cwd(), ".playwright-runs");
    await mkdir(dir, { recursive: true });
    const name = `scenarios-unit-${process.pid}-${Date.now()}`;
    const specFile = join(dir, `${name}.spec.ts`);
    const jsonFile = join(dir, `${name}.json`);
    await writeFile(specFile, code, "utf8");
    try {
        await new Promise<void>((resolve, reject) => {
            const child = spawn(process.execPath, [join(process.cwd(), "node_modules", "playwright", "cli.js"), "test", `.playwright-runs/${name}.spec.ts`, "--reporter=json", "--project=chromium", "--workers=1"], {
                cwd: process.cwd(),
                env: { ...process.env, ...env, PLAYWRIGHT_JSON_OUTPUT_FILE: jsonFile, FORCE_COLOR: "0" },
                stdio: "ignore",
                windowsHide: true,
            });
            child.on("error", reject);
            child.on("close", () => resolve());
        });
        return JSON.parse(await readFile(jsonFile, "utf8")) as JsonReport;
    } finally {
        await rm(specFile, { force: true });
        await rm(jsonFile, { force: true });
    }
}

async function withSite(run: (origin: string) => Promise<void>) {
    const server = createServer((req, res) => {
        const ok = new URL(req.url ?? "/", "http://x").pathname === "/";
        res.writeHead(ok ? 200 : 404, { "content-type": "text/html" }).end(ok ? `<!doctype html><html lang="en"><head><title>Home</title></head><body><main><h1>Acme Notes</h1></main></body></html>` : "");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
        await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
    } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
    }
}

const verdict = (report: ReturnType<typeof buildReport>) => ({
    summary: { planned: report.summary.planned, executed: report.summary.executed, passed: report.summary.passed, failed: report.summary.failed, notRun: report.summary.notRun, recommendation: report.summary.releaseRecommendation },
    comprehensive: report.comprehensive!.summary,
    pages: report.comprehensive!.pages,
    groups: report.comprehensive!.groups,
    coverage: report.coverage,
});

test("in a real browser: a deliberately failing model test is shown as 'failed: needs review' and leaves the verdict unchanged", { skip: needsChromium }, async () => {
    const mode = normalizeRunMode({ kind: "comprehensive", area: "accessibility" }) as ComprehensiveRunMode;
    await withSite(async (origin) => {
        const suite = buildComprehensiveSuite(origin, mode, { covered: ["/"], notCovered: [], pageCap: 20 });
        const merged = mergeComprehensiveScenarios(suite, FAILING_SCENARIO, MODEL, mode);
        assert.deepEqual(findTypeErrors(merged), []);
        const withModel: GenerationRecord = { generatedBy: "template+ollama", model: MODEL, gates: [] };

        const alone = buildReport(await runWithPlaywright(suite, { TESTFORGE_INTERACTIVE: "1" }), ["accessibility"], "", origin, null, suite, { generatedBy: "template", gates: [] }, "", mode, 1);
        const report = buildReport(await runWithPlaywright(merged, { TESTFORGE_INTERACTIVE: "1" }), ["accessibility"], "", origin, null, merged, withModel, "", mode, 1);

        assert.equal(report.execution.filter((r) => r.generator === "local model").length, 1, "the model's test ran");
        assert.deepEqual(verdict(report), verdict(alone), "every count, group, coverage figure and the recommendation are what they are without the model");
        assert.equal(report.summary.failed, 0);
        assert.equal(report.comprehensive!.model.status, "added");
        assert.deepEqual(report.comprehensive!.model.tests.map((t) => t.outcome), ["failed: needs review"]);
        assert.match(report.comprehensive!.model.tests[0].detail, /the greeting/);
        assert.match(report.comprehensive!.model.note, /count toward no pass or fail, no recommendation and no coverage figure/);
        const html = buildReportHtmlDocument(report, "r");
        assert.match(html, /<strong>failed: needs review<\/strong> - [^<]*the home page greets the user by name/);
    });
});

test("in a real browser: in a passive security run the model's test is listed as not run, with why, even with interactive tests on", { skip: needsChromium }, async () => {
    const mode = normalizeRunMode({ kind: "comprehensive", area: "security" }) as ComprehensiveRunMode;
    await withSite(async (origin) => {
        const merged = mergeComprehensiveScenarios(buildComprehensiveSuite(origin, mode, { covered: ["/"], notCovered: [], pageCap: 20 }), FAILING_SCENARIO, MODEL, mode);
        const report = buildReport(await runWithPlaywright(merged, { TESTFORGE_INTERACTIVE: "1" }), ["security"], "", origin, null, merged, { generatedBy: "template+ollama", model: MODEL, gates: [] }, "", mode, 1);
        assert.deepEqual(report.comprehensive!.model.tests.map((t) => [t.outcome, t.detail]), [["not run", `written by the local model (${MODEL}): a passive security run sends no input and a model-written test may, so it is listed, not run`]]);
        assert.equal(report.summary.notRun, 0, "and it is not counted as not run either");
    });
});

test("without a model, or with its suite rejected, the report says so", () => {
    const mode = normalizeRunMode({ kind: "comprehensive", area: "accessibility" }) as ComprehensiveRunMode;
    const json: JsonReport = { suites: [], errors: [], stats: { duration: 0, expected: 0, unexpected: 0, flaky: 0, skipped: 0 } };
    const none = buildReport(json, ["accessibility"], "", "https://site.test", null, "", null, "", mode, 1).comprehensive!.model;
    assert.deepEqual([none.status, none.note], ["not-configured", "No local model is configured (TESTFORGE_OLLAMA_MODEL), so it was not asked for scenarios. The template's checks stand on their own."]);
    const rejected = buildReport(json, ["accessibility"], "", "https://site.test", null, "", { generatedBy: "fallback", model: MODEL, fallbackReason: "timeout", gates: [] }, "", mode, 1).comprehensive!.model;
    assert.deepEqual([rejected.status, rejected.note], ["rejected", `The local model (${MODEL}) was asked for accessibility scenarios, but its suite was not used: it did not answer within its time budget (see the gate verdicts). The template's checks stand on their own.`]);
});
