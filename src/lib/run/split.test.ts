/**
 * Phase 39 (TFP-155, Decisions 8 and 12): a suite split into units, one file each, which Playwright hands out to its
 * workers.
 *
 * ISTQB techniques:
 * - Decision table, offline: what a suite's top level holds (a page's shared group, another describe, a describe left
 *   with no test, a test outside any describe, everything else) against where it goes (a file of its own, the tests'
 *   file, no file, every file's header).
 * - Equivalence of results (Decisions 8 and 12), in a real browser on the comparison fixture: Comprehensive security
 *   and accessibility, run by the executor as units across its workers, give every test the same area, page, status
 *   and findings as the same suite run as one file on one worker; the run used more than one worker and one file.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/run/split.test.ts
 */
import assert from "node:assert";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import type { ExecutionRecord } from "../report/types.ts";

const scratch = mkdtempSync(join(tmpdir(), "testforge-split-"));
process.env.TESTFORGE_RUNS_ROOT = join(scratch, "runs");
process.env.TESTFORGE_DATA_DIR = join(scratch, "data");

const { splitSuite } = await import("./split.ts");
const { parseTestUnits } = await import("../site-suites/units.ts");
const { findTypeErrors } = await import("../generate/validate.ts");
const { mockGenerate } = await import("../generate/mock/index.ts");
const { normalizeContentRules, normalizeTestAuditMode } = await import("../generate/normalize.ts");
const { buildComprehensiveSuite } = await import("../generate/comprehensive.ts");
const { normalizeRunMode } = await import("../comprehensive/run-mode.ts");
const { startRunJob } = await import("./executor.ts");
const { runJobs } = await import("./jobs.ts");
const { flattenSuites } = await import("../report/execution.ts");
const { inspectPages } = await import("../introspect/inspector.ts");
const { startRecordedFixture } = await import("../../test-support/comparison-fixture.ts");
const { chromiumSkipReason } = await import("../../test-support/chromium.ts");
const { runPlaywrightSpec } = await import("../../test-support/playwright-cli.ts");
const needsChromium = await chromiumSkipReason();
after(() => rmSync(scratch, { recursive: true, force: true }));

/** Every test of a suite, as its tests read: id, title, describes and source. */
const testsOf = (codes: string[]) => codes.flatMap((code) => parseTestUnits(code)).map((unit) => JSON.stringify([unit.id, unit.title, unit.describe, unit.source])).sort();

test("what goes where: each page's group and each other describe a file of its own, the top-level tests one file, an empty describe none, the rest every file's header (decision table)", () => {
    const suite = `import { test, expect } from '@playwright/test';

test.use({ baseURL: 'http://site.test' });

// A helper every test may use.
const tfHelper = (text: string) => text.trim();

test.describe('Functional Coverage', () => {
  test('TFFU-001: on its own page', async ({ page }) => {
    await page.goto('/a');
    await expect(page.locator('h1')).toHaveText(tfHelper(' A '));
  });
});

test.describe('SEO and Content Coverage', () => {
  // Every SEO check moved to its page's group: this note stays in the suite.
});

test('TFGN-001: a top-level test', async ({ page }) => {
  await page.goto('/b');
});

// Phase 39 (TFP-212): each page's read-only checks, every area's, on one shared visit.
test.describe('Page /a', () => {
  test.describe('SEO and Content Coverage', () => {
    test('TFSE-001: has a title', async ({ page }) => {
      await page.goto('/a');
      await expect(page).toHaveTitle(/A/);
    });
  });
});

test.describe('Page /b', () => {
  test('TFSE-002: has a heading', async ({ page }) => {
    await page.goto('/b');
    await expect(page.locator('h1')).toBeVisible();
  });
});

test('TFGN-002: another top-level test', async ({ page }) => {
  await page.goto('/c');
});
`;
    const units = splitSuite(suite);
    assert.deepEqual(units.map((unit) => [unit.name, unit.kind]), [
        ["001-functional-coverage.spec.ts", "describe"],
        ["002-tests.spec.ts", "tests"],
        ["003-page-a.spec.ts", "page"],
        ["004-page-b.spec.ts", "page"],
    ]);
    // Every file starts with the suite's top level, in order; each holds its own tests and no other unit's.
    for (const unit of units) {
        assert.ok(unit.code.startsWith("import { test, expect } from '@playwright/test';\n\ntest.use({ baseURL: 'http://site.test' });\n\n// A helper every test may use.\nconst tfHelper"), unit.name);
        assert.deepEqual(findTypeErrors(unit.code), [], unit.name);
    }
    assert.deepEqual(parseTestUnits(units[1].code).map((unit) => unit.id), ["TFGN-001", "TFGN-002"]);
    assert.match(units[2].code, /\/\/ Phase 39 \(TFP-212\): each page's read-only checks/, "a comment goes with what it stands before");
    assert.doesNotMatch(units.map((unit) => unit.code).join("\n"), /this note stays/, "an empty describe makes no file");
    // Every test, unchanged (Decision 12): the same ids, titles, describes and bodies.
    assert.deepEqual(testsOf(units.map((unit) => unit.code)), testsOf([suite]));
    // A suite with one unit stays one file, as it is.
    const one = suite.slice(0, suite.indexOf("test.describe('SEO and Content Coverage'"));
    assert.deepEqual(splitSuite(one), [{ name: "001-suite.spec.ts", kind: "describe", code: one }]);
});

test("generated suites: every test lands in exactly one unit, unchanged, and every unit type-checks (Standard and both Comprehensive areas)", () => {
    const profile = JSON.parse(readFileSync(join(process.cwd(), "benchmarks/2026-09-29/content-profile.json"), "utf8"));
    const origin = "http://127.0.0.1:4410";
    const areas = ["functional", "responsive/mobile", "performance/load", "security", "accessibility", "usability", "seo/content", "cookie/session", "database", "reliability"];
    const pages = (profile.pages ?? []).map((page: { path: string }) => page.path).slice(0, 4);
    const suites = {
        standard: mockGenerate(origin, "Check the site.", areas as never, profile, normalizeContentRules({ paths: pages }), normalizeTestAuditMode("fast")),
        security: buildComprehensiveSuite(origin, normalizeRunMode({ kind: "comprehensive", area: "security" }) as never, { covered: pages, notCovered: [], pageCap: 20 }),
        accessibility: buildComprehensiveSuite(origin, normalizeRunMode({ kind: "comprehensive", area: "accessibility" }) as never, { covered: pages, notCovered: [], pageCap: 20 }),
    };
    for (const [name, code] of Object.entries(suites)) {
        const units = splitSuite(code);
        // Beside the pages: Standard keeps its areas' own-page and site-wide tests, security its run-wide checks, and
        // accessibility nothing (every check shares its page's visit, TFP-214).
        const others = units.length - pages.length;
        assert.ok(name === "standard" ? others > 1 : others === (name === "security" ? 1 : 0), `${name}: ${units.map((unit) => unit.name).join(", ")}`);
        assert.equal(units.filter((unit) => unit.kind === "page").length, pages.length, `${name}: a unit per page`);
        assert.deepEqual(testsOf(units.map((unit) => unit.code)), testsOf([code]), `${name}: the same tests`);
        for (const unit of units) assert.deepEqual(findTypeErrors(unit.code), [], `${name}: ${unit.name}`);
    }
});

// The report's grouping of each test (its area and suite) with its result; the page is in the test's title.
const outcome = (records: ExecutionRecord[]) => records.map((record) => `${record.title} | ${record.area} | ${record.suite} | ${record.status} | ${JSON.stringify([...(record.findings ?? [])].sort())}`).sort();
type Results = { suites?: Array<{ specs?: Array<{ tests?: Array<{ results?: Array<{ parallelIndex?: number }> }> }>; suites?: Results["suites"] }> };
const workersOf = (suites: Results["suites"]): number[] => (suites ?? []).flatMap((suite) => [...(suite.specs ?? []).flatMap((spec) => (spec.tests ?? []).flatMap((item) => (item.results ?? []).map((result) => result.parallelIndex ?? -1))), ...workersOf(suite.suites)]);

test("in a real browser: Comprehensive security and accessibility on the fixture, as units across 4 workers, give every test the same area, page, status and findings as one file on one worker (Acceptance Criteria 4, Decision 12)", { skip: needsChromium }, async () => {
    const fixture = await startRecordedFixture();
    try {
        const paths = ["/", "/login", "/notes", "/forms"];
        for (const area of ["security", "accessibility"] as const) {
            const code = buildComprehensiveSuite(fixture.origin, normalizeRunMode({ kind: "comprehensive", area }) as never, { covered: paths, notCovered: [], pageCap: 20 });
            const units = splitSuite(code);
            assert.equal(units.length, paths.length + (area === "security" ? 1 : 0), `${area}: ${units.map((unit) => unit.name).join(", ")}`);
            const { report: oneFile } = await runPlaywrightSpec(code, `split-${area}-one-file`, ["--workers=1", "--timeout=30000"], { TESTFORGE_INTERACTIVE: "0" });
            const { report: split } = await runPlaywrightSpec(units, `split-${area}-units`, ["--workers=4", "--timeout=30000"], { TESTFORGE_INTERACTIVE: "0" });
            assert.deepEqual(outcome(flattenSuites(split.suites ?? [])), outcome(flattenSuites(oneFile.suites ?? [])), `${area}: every test, the same area, page, status and findings`);
            // One report suite per unit file, and the units spread over more than one worker.
            assert.equal((split.suites ?? []).length, units.length, `${area}: a file per unit`);
            assert.ok(new Set(workersOf(split.suites as Results["suites"]).filter((index) => index >= 0)).size > 1, `${area}: more than one worker`);
        }
    } finally {
        await fixture.close();
    }
});

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

test("in a real browser: the executor runs a Standard suite on the local fixture as units across its workers, with every test's result as one file on one worker gives (Decisions 8 and 12)", { skip: needsChromium }, async () => {
    const fixture = await startRecordedFixture();
    try {
        const paths = ["/", "/login", "/notes"];
        const inspection = await inspectPages(fixture.origin, paths);
        const profile = { scannedAt: new Date().toISOString(), baseUrl: fixture.origin, ...inspection };
        const areas = ["functional", "accessibility", "seo/content", "security", "usability"];
        const code = mockGenerate(fixture.origin, "Check the site.", areas as never, profile as never, normalizeContentRules({ paths }), normalizeTestAuditMode("fast"));
        const units = splitSuite(code);
        const { report: oneFile } = await runPlaywrightSpec(code, "split-standard-one-file", ["--workers=1", "--timeout=30000"], { TESTFORGE_INTERACTIVE: "0" });
        const snapshot = await startRunJob(code, areas, "fast", fixture.origin, [], [], "Check the site.", profile as never);
        const job = await finished(snapshot.runId, 300_000);
        const report = job.result?.report;
        assert.ok(report, job.result?.output);
        assert.deepEqual(outcome(report.execution), outcome(flattenSuites(oneFile.suites ?? [])), "every test, the same area, page, status and findings");
        // The run's record: how many unit files ran tests, and how many workers took them (a local host: 4).
        const said = `Split into ${units.length} unit file(s) (${paths.length} page(s), ${units.length - paths.length} other), run by 4 worker(s).\n`;
        assert.ok(job.outputChunks.includes(said), job.outputChunks.join(""));
        assert.equal(report.runTiming?.files, units.length);
        assert.ok((report.runTiming?.workers ?? 0) > 1, `${report.runTiming?.workers} workers`);
    } finally {
        await fixture.close();
    }
});
