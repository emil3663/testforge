/**
 * Phase 42 (TFP-191, Decision 1's stale-test rule; Emil, 2026-10-13): a
 * reused test that fails has its page read again; a changed page has its
 * type's tests regenerated and re-run, and only the re-run counts. Generated
 * through POST /api/generate and run through POST /api/run, on the
 * comparison fixture's /types shop, in a real browser.
 *
 * ISTQB technique: decision table. Conditions: whether the failing test was
 * reused from the site suite (or written by this generation), and whether its
 * page's structure changed since it was saved. One column each:
 *   reused, page changed (Subject becomes a list)    -> type regenerated and re-run; only the re-run is reported, and the report says why
 *   reused, page unchanged (a field turns read-only) -> the failure stands, as it is
 *   written by this generation, page changed         -> not read again: the failure stands
 * Gate: Phase 42 Gate A.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/site-suites/stale.test.ts
 */
import assert from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import type { RunReport, SiteSuiteRecord } from "../report/types.ts";

const scratch = mkdtempSync(join(tmpdir(), "testforge-stale-"));
const savedEnv = { data: process.env.TESTFORGE_DATA_DIR, runs: process.env.TESTFORGE_RUNS_ROOT };
process.env.TESTFORGE_RUNS_ROOT = join(scratch, "runs");

const generateRoute = await import("../../app/api/generate/route.ts");
const runRoute = await import("../../app/api/run/route.ts");
const { runJobs } = await import("../run/jobs.ts");
const { NextRequest } = await import("next/server");
const { startRecordedFixture } = await import("../../test-support/comparison-fixture.ts");
const { chromiumSkipReason } = await import("../../test-support/chromium.ts");
const { parseTestUnits } = await import("./units.ts");
const { describeSiteSuite } = await import("../report/site-suite-text.ts");
const needsChromium = await chromiumSkipReason();

const PATHS = ["types", "types/product/101", "types/product/102", "types/product/103", "types/category/tools", "types/category/garden", "types/account/login", "types/account/contact", "types/legal/privacy", "types/help/terms"];
const PRACTICES = ["functional", "accessibility", "seo"];
const ACCOUNT = "/types/account/:slug";

let fixture: Awaited<ReturnType<typeof startRecordedFixture>>;
let folder = 0;

before(async () => {
    if (!needsChromium) fixture = await startRecordedFixture();
});

after(async () => {
    await fixture?.close();
    for (const [key, value] of [["TESTFORGE_DATA_DIR", savedEnv.data], ["TESTFORGE_RUNS_ROOT", savedEnv.runs]] as const) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
    rmSync(scratch, { recursive: true, force: true });
});

const post = (url: string, body: unknown) => new NextRequest(new URL(url), { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });

async function generate() {
    const response = await generateRoute.POST(post("http://localhost/api/generate", { baseUrl: fixture.origin, description: "Check the shop.", selectedPractices: PRACTICES, contentRules: { paths: PATHS } }));
    assert.equal(response.status, 200);
    return (await response.json()) as { code: string; siteSuite: SiteSuiteRecord };
}

/** Runs the suite's tests of one page, as the app does, and waits for the finished run's report. */
async function runPage(generated: { code: string; siteSuite: SiteSuiteRecord }, path: string): Promise<RunReport> {
    const titles = parseTestUnits(generated.code).filter((unit) => unit.paths.includes(path)).map((unit) => `${unit.id}: ${unit.title}`);
    assert.ok(titles.length > 0, `tests on ${path}`);
    const response = await runRoute.POST(post("http://localhost/api/run", {
        code: generated.code,
        baseUrl: fixture.origin,
        selectedPractices: PRACTICES,
        description: "Check the shop.",
        includeTestTitles: titles,
        generation: { generatedBy: "template", gates: [], siteSuite: generated.siteSuite },
    }));
    assert.equal(response.status, 202);
    const { runId } = (await response.json()) as { runId: string };
    const started = Date.now();
    while (!runJobs.get(runId)?.result) {
        assert.ok(Date.now() - started < 300_000, "the run finished within 5 minutes");
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    const report = runJobs.get(runId)!.result!.report;
    assert.ok(report, runJobs.get(runId)!.result!.output);
    return report;
}

/** A fresh data folder, a suite saved on the clean site, and the suite a second generation reuses. */
async function reusedSuite() {
    process.env.TESTFORGE_DATA_DIR = join(scratch, `data-${folder++}`);
    await fixture.control("/__fixture/defect?set=none");
    await generate();
    const second = await generate();
    assert.equal(second.siteSuite.generated, 0, "the second generation reuses every test");
    return second;
}

test("a reused test fails on a page whose structure changed: its type is regenerated and re-run, and only the re-run counts (TFP-191)", { skip: needsChromium }, async () => {
    const reused = await reusedSuite();
    const subject = parseTestUnits(reused.code).find((unit) => unit.title === "form element check: subject [Email] [input]");
    assert.ok(subject, "the saved suite checks the Subject text field");

    await fixture.control("/__fixture/defect?set=types-contact-subject-list");
    const report = await runPage(reused, "/types/account/contact");

    const recheck = report.generation?.siteSuite?.recheck;
    assert.ok(recheck, "the generation record carries the recheck");
    assert.equal(recheck.unchanged, 0);
    assert.equal(recheck.regenerations.length, 1);
    const [regeneration] = recheck.regenerations;
    assert.equal(regeneration.type, ACCOUNT);
    assert.deepEqual(regeneration.pages.map((page) => page.path), ["/types/account/contact"]);
    assert.match(regeneration.pages[0].before, /\[email,text,textarea\]/);
    assert.match(regeneration.pages[0].after, /\[email,select,textarea\]/);
    assert.ok(regeneration.failed.includes(`${subject.id}: ${subject.title}`), regeneration.failed.join(" | "));
    assert.ok(regeneration.rerun > 0);

    // Only the re-run's results: the stale Subject check is gone, its regenerated check (a list) passes,
    // and every contact test reported is the re-run's. The re-run's other failures are the page's own
    // (the WCAG scan's target size, the tab order of its inline labels), reported as the re-run found them.
    assert.ok(!report.execution.some((record) => record.title.endsWith("subject [Email] [input]")), "the stale Subject check's result is not reported");
    const list = report.execution.find((record) => record.title.includes("[select]"));
    assert.ok(list, report.execution.map((record) => record.title).join(" | "));
    assert.equal(list.status, "Passed", list.rawMessage);
    assert.equal(report.execution.length, regeneration.rerun);
    assert.equal(report.execution.filter((record) => record.status === "Failed").length, regeneration.failedAgain);
    assert.equal(report.execution.filter((record) => record.status === "Passed").length, regeneration.passed);
    assert.match(describeSiteSuite(report.generation!.siteSuite!), new RegExp(`${ACCOUNT.replace(/[/:]/g, "\\$&")} changed since its tests were saved \\(/types/account/contact: .* -> .*\\), so ${regeneration.failed.length} failing reused tests? .* regenerated from a fresh inspection and re-run: ${regeneration.passed} passed, ${regeneration.failedAgain} failed of ${regeneration.rerun}\\. Only the re-run's results are reported\\.`));
});

test("a reused test fails on a page whose structure did not change: the failure stands (TFP-191)", { skip: needsChromium }, async () => {
    const reused = await reusedSuite();
    await fixture.control("/__fixture/defect?set=types-quantity-readonly");
    const report = await runPage(reused, "/types/product/101");

    const failed = report.execution.filter((record) => record.status === "Failed");
    assert.ok(failed.some((record) => record.title.endsWith("form element check: 1 [Item 101] [input]")), failed.map((record) => record.title).join(" | "));
    const recheck = report.generation?.siteSuite?.recheck;
    assert.ok(recheck);
    assert.equal(recheck.failedReused, failed.length);
    assert.equal(recheck.unchanged, failed.length);
    assert.deepEqual(recheck.regenerations, []);
    assert.match(describeSiteSuite(report.generation!.siteSuite!), new RegExp(`${failed.length} failing reused tests? (is|are) on (a page|pages) that has not changed: reported as (it is|they are)\\.`));
});

test("a test this generation wrote fails on a changed page: it isn't read again, and the failure stands (TFP-191)", { skip: needsChromium }, async () => {
    process.env.TESTFORGE_DATA_DIR = join(scratch, `data-${folder++}`);
    await fixture.control("/__fixture/defect?set=none");
    const first = await generate();
    assert.equal(first.siteSuite.firstRun, true);
    await fixture.control("/__fixture/defect?set=types-contact-subject-list");
    const report = await runPage(first, "/types/account/contact");

    assert.ok(report.execution.some((record) => record.status === "Failed" && record.title.endsWith("subject [Email] [input]")));
    assert.deepEqual(report.generation?.siteSuite?.recheck, { failedReused: 0, unchanged: 0, regenerations: [] });
});
