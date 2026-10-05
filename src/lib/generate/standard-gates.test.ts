/**
 * Phase 38 TFP-146, Acceptance Criteria 1: a Standard run on the comparison
 * fixture, recorded at the server. With TESTFORGE_INTERACTIVE unset it sends
 * nothing but GET requests, and every interactive and active test is Not run
 * with its reason; with TESTFORGE_INTERACTIVE=1 the interactive tests run and
 * the active ones are still Not run, naming the ownership confirmation.
 *
 * ISTQB technique: decision table testing. Conditions: the test's gate
 * (read-only, interactive, active) and TESTFORGE_INTERACTIVE (unset, 1);
 * action: run, or Not run with the gate's reason. Both columns of the
 * interactive condition are run here.
 *
 * The suite is the template's for every area, with every journey selected,
 * plus a local-model block (its gate is on the describe, not the test), all
 * generated from real introspection of the fixture through the recording
 * proxy. Each run takes about a minute.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/generate/standard-gates.test.ts
 */
import assert from "node:assert";
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import type { JsonReport } from "../report/types.ts";
import type { BestPracticeArea } from "./mock/types.ts";

const { mockGenerate } = await import("./mock/index.ts");
const { normalizeContentRules, normalizeTestAuditMode } = await import("./normalize.ts");
const { mergeLocalSuite } = await import("./gap-fill.ts");
const { inspectPages } = await import("../introspect/inspector.ts");
const { flattenSuites } = await import("../report/execution.ts");
const { buildSummary } = await import("../report/summary.ts");
const { ACTIVE_GATE_REASON } = await import("../run/test-gates.ts");
const { startRecordedFixture } = await import("../../test-support/comparison-fixture.ts");
const { chromiumSkipReason } = await import("../../test-support/chromium.ts");
const needsChromium = await chromiumSkipReason();

const AREAS: BestPracticeArea[] = ["functional", "responsive/mobile", "performance/load", "security", "accessibility", "usability", "seo/content", "cookie/session", "database", "reliability"];
const MODEL_BLOCK = "test.describe('Functional', () => {\n  test('the notes page loads', async ({ page }) => { await page.goto('/notes'); await expect(page.locator('h1')).toBeVisible(); });\n});";
const INTERACTIVE_REASON = /only runs when TESTFORGE_INTERACTIVE=1 is set for the run/;

/** Introspects the fixture, generates the Standard suite, and runs it with the given TESTFORGE_INTERACTIVE. */
async function standardRun(interactive: "unset" | "1") {
    const fixture = await startRecordedFixture();
    try {
        const inspection = await inspectPages(fixture.origin, ["/", "/login", "/notes"]);
        const profile = { scannedAt: new Date().toISOString(), baseUrl: fixture.origin, ...inspection };
        const rules = normalizeContentRules({ selectedJourneyIds: inspection.journeys.map((journey) => journey.id) });
        const template = mockGenerate(fixture.origin, "Check the site.", AREAS, profile as never, rules, normalizeTestAuditMode("fast"));
        const code = mergeLocalSuite(template, MODEL_BLOCK, "testforge-qwen7b:latest", ["functional"]);
        fixture.recorded.length = 0;

        const dir = join(process.cwd(), ".playwright-runs");
        await mkdir(dir, { recursive: true });
        const name = `standard-gates-unit-${process.pid}-${Date.now()}`;
        const specFile = join(dir, `${name}.spec.ts`);
        const jsonFile = join(dir, `${name}.json`);
        await writeFile(specFile, code, "utf8");
        const env: NodeJS.ProcessEnv = { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: jsonFile, FORCE_COLOR: "0" };
        delete env.TESTFORGE_INTERACTIVE;
        if (interactive === "1") env.TESTFORGE_INTERACTIVE = "1";
        try {
            await new Promise<void>((resolve, reject) => {
                const child = spawn(process.execPath, [join(process.cwd(), "node_modules", "playwright", "cli.js"), "test", `.playwright-runs/${name}.spec.ts`, "--reporter=json", "--project=chromium"], {
                    cwd: process.cwd(),
                    env,
                    stdio: "ignore",
                    windowsHide: true,
                });
                child.on("error", reject);
                child.on("close", () => resolve());
            });
            const records = flattenSuites((JSON.parse(await readFile(jsonFile, "utf8")) as JsonReport).suites ?? []);
            return { records, summary: buildSummary(records, [], 0, interactive === "1"), requests: [...fixture.recorded] };
        } finally {
            await rm(specFile, { force: true });
            await rm(jsonFile, { force: true });
        }
    } finally {
        await fixture.close();
    }
}

test("in a real browser, interactive unset: the Standard run sends only GETs; interactive and active tests are Not run with their reasons, counted per gate", { skip: needsChromium }, async () => {
    const { records, summary, requests } = await standardRun("unset");
    const show = (list: typeof records) => JSON.stringify(list.map((record) => [record.title, record.status, record.gate, record.skipReason]));

    assert.ok(requests.length > 0);
    assert.deepEqual(requests.filter((request) => request.method !== "GET" || request.bodyBytes > 0), [], "nothing but GET requests, none with a body");
    assert.deepEqual(records.filter((record) => !record.gate).map((record) => record.title), [], "every test declares a gate");

    const interactive = records.filter((record) => record.gate === "interactive");
    const active = records.filter((record) => record.gate === "active");
    // 10 journeys, the database round trip and the local model's test.
    assert.equal(interactive.length, 12, show(interactive));
    assert.ok(interactive.every((record) => record.status === "Not run" && INTERACTIVE_REASON.test(record.skipReason ?? "")), show(interactive));
    assert.ok(interactive.some((record) => record.generator === "local model"), "the describe-level gate reaches the model's test");
    assert.equal(active.length, 1, show(active));
    assert.deepEqual(active.map((record) => [record.status, record.skipReason]), [["Not run", ACTIVE_GATE_REASON]]);

    // Read-only tests that skipped for their own reason (no cookie to check) are not counted: that gate never closes.
    assert.ok(records.some((record) => record.gate === "read-only" && record.status === "Not run"), "the fixture has read-only tests that skip themselves");
    assert.deepEqual(summary.notRunByGate, { "read-only": 0, interactive: 12, active: 1 });
});

test("in a real browser, TESTFORGE_INTERACTIVE=1: interactive tests run and submit forms; the active test is still Not run, naming the ownership confirmation", { skip: needsChromium }, async () => {
    const { records, summary, requests } = await standardRun("1");
    const show = (list: typeof records) => JSON.stringify(list.map((record) => [record.title, record.status, record.gate, record.skipReason]));

    const interactive = records.filter((record) => record.gate === "interactive");
    assert.equal(interactive.length, 12, show(interactive));
    assert.deepEqual(interactive.filter((record) => INTERACTIVE_REASON.test(record.skipReason ?? "")).map((record) => record.title), [], "no interactive test is held back by its gate");
    assert.ok(interactive.filter((record) => record.status === "Passed").length > 0, show(interactive));
    assert.ok(requests.some((request) => request.method === "POST"), "the interactive tests submitted forms");

    const active = records.filter((record) => record.gate === "active");
    assert.deepEqual(active.map((record) => [record.status, record.skipReason]), [["Not run", ACTIVE_GATE_REASON]], show(active));
    assert.match(ACTIVE_GATE_REASON, /ownership confirmation/);
    assert.deepEqual(summary.notRunByGate, { "read-only": 0, interactive: 0, active: 1 });
});
