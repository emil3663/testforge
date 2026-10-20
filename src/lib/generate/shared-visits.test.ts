/**
 * Phase 39 (TFP-212 and TFP-213; Decisions 2, 4, 5 and 7): a page's read-only checks, every area's, on one shared
 * visit.
 *
 * ISTQB techniques:
 * - Decision table, offline: what a test does (only reads its page; interacts; sets something up first; sits at the
 *   interactive gate; is in a fresh-page area; is in a describe with a hook; asks for another fixture; doesn't start
 *   with its visit) against where it runs (shared visit, or its own page as before).
 * - Equivalence of results (Decision 7), in a real browser on the comparison fixture: the same Standard suite run
 *   shared and one-page-per-test gives every test the same status and findings, on the clean fixture and with a
 *   defect only a load shows (a header, a session cookie, a redirect through a session id) and a defect that fails
 *   one check among a page's others.
 * - State transition (Decision 4's rules), in a real browser on a small local site: a visit goes from loaded to
 *   shared, to left (a check navigated away), to changed (a check toggled or typed), to failed (a fresh worker), and
 *   each transition decides whether the next check loads the page again or is re-run on a fresh one.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/generate/shared-visits.test.ts
 */
import assert from "node:assert";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import type { ExecutionRecord, JsonReport, JsonSuite } from "../report/types.ts";
import type { ContentProfile } from "./mock/types.ts";
import type { RawTiming } from "../run/timing.ts";

const { shareReadOnlyVisits, SHARED_VISIT_HELPER } = await import("./shared-visits.ts");
const { PAGE_VISIT_HELPER } = await import("./page-visits.ts");
const { mockGenerate, mockGenerateDetailed } = await import("./mock/index.ts");
const { normalizeContentRules, normalizeTestAuditMode } = await import("./normalize.ts");
const { inspectPages } = await import("../introspect/inspector.ts");
const { flattenSuites } = await import("../report/execution.ts");
const { findTypeErrors } = await import("./validate.ts");
const { parseTestUnits } = await import("../site-suites/units.ts");
const { buildTimingReporterSource, summarizeTiming, TIMING_FILE_ENV_VAR } = await import("../run/timing.ts");
const { startRecordedFixture } = await import("../../test-support/comparison-fixture.ts");
const { chromiumSkipReason } = await import("../../test-support/chromium.ts");
const { runPlaywrightSpec } = await import("../../test-support/playwright-cli.ts");
const needsChromium = await chromiumSkipReason();

const scratch = mkdtempSync(join(tmpdir(), "testforge-shared-visits-"));
const reporter = join(scratch, "timing-reporter.cjs");
writeFileSync(reporter, buildTimingReporterSource(), "utf8");
after(() => rmSync(scratch, { recursive: true, force: true }));

type Run = { records: ExecutionRecord[]; report: JsonReport; timing: RawTiming };
let runs = 0;
async function run(code: string, label: string, args: string[] = []): Promise<Run> {
    const timingFile = join(scratch, `timing-${++runs}.json`);
    const { report } = await runPlaywrightSpec(code, `shared-${label}`, [`--reporter=json,${reporter.replace(/\\/g, "/")}`, "--workers=1", "--timeout=30000", ...args], { [TIMING_FILE_ENV_VAR]: timingFile, TESTFORGE_INTERACTIVE: "0" });
    return { records: flattenSuites(report.suites ?? []), report, timing: JSON.parse(readFileSync(timingFile, "utf8")) as RawTiming };
}

/** Every annotation a test carries, from every attempt, by title. */
function annotations(report: JsonReport) {
    const found = new Map<string, Array<{ type: string; description?: string }>>();
    const walk = (suites: JsonSuite[]) => {
        for (const suite of suites) {
            walk(suite.suites ?? []);
            for (const spec of suite.specs ?? []) {
                for (const item of spec.tests ?? []) {
                    // Each attempt's own annotations where Playwright keeps them per result; the test's otherwise.
                    const perAttempt = (item.results ?? []).flatMap((result) => (result as { annotations?: Array<{ type: string; description?: string }> }).annotations ?? []);
                    const all = perAttempt.length > 0 ? perAttempt : item.annotations ?? [];
                    found.set(spec.title, [...(found.get(spec.title) ?? []), ...all]);
                }
            }
        }
    };
    walk(report.suites ?? []);
    return found;
}

const outcome = (records: ExecutionRecord[]) => new Map(records.map((record) => [record.title, `${record.status} ${JSON.stringify([...(record.findings ?? [])].sort())}`]));

test("which tests share a visit: only reads on one page, outside the fresh-page list; everything else stays as it was (decision table)", () => {
    const suite = `import { test, expect } from '@playwright/test';

test.use({ baseURL: 'http://site.test' });

${PAGE_VISIT_HELPER}

test.describe('Functional Coverage', () => {
  function tfHelper(text: string) { return text.trim(); }

  test('TFFU-001: reads its page', { annotation: [{ type: 'page', description: '/a' }, { type: 'gate', description: 'read-only' }] }, async ({ page }) => {
    await tfGoto(page, '/a');
    await expect(page.locator('h1')).toHaveText(tfHelper(' A '));
  });

  test('TFFU-002: clicks', async ({ page }) => {
    await tfGoto(page, '/a');
    await page.getByRole('button').click();
  });

  test('TFFU-003: listens before loading', async ({ page }) => {
    page.on('console', () => {});
    await tfGoto(page, '/a');
  });

  test('TFFU-004: interactive', { annotation: { type: 'gate', description: 'interactive' } }, async ({ page }) => {
    await tfGoto(page, '/a');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('TFFU-005: another fixture', async ({ page, browser }) => {
    await tfGoto(page, '/a');
    expect(browser.version()).toBeTruthy();
  });

  test('TFFU-006: scrolls', async ({ page }) => {
    await tfGoto(page, '/b');
    await page.evaluate(() => window.scrollTo(0, 500));
  });
});

test.describe('Security Coverage', () => {
  test('TFSC-001: reads the response on /b', async ({ page, context }) => {
    const response = await tfGoto(page, '/b');
    expect(response!.headers()['x-powered-by']).toBeUndefined();
    expect(await context.cookies()).toEqual([]);
  });
});

test.describe('Performance Coverage', () => {
  test('TFPL-001: a fresh-page area', async ({ page }) => {
    await tfGoto(page, '/a');
    await expect(page.locator('h1')).toBeVisible();
  });
});

test.describe('SEO and Content Coverage', () => {
  test.beforeEach(async () => {});

  test('TFSE-001: in a describe with a hook', async ({ page }) => {
    await tfGoto(page, '/a');
    await expect(page.locator('title')).toBeAttached();
  });
});
`;
    const shared = shareReadOnlyVisits(suite);
    assert.deepEqual(findTypeErrors(shared), []);
    const units = parseTestUnits(shared);
    const where = (title: string) => units.find((unit) => unit.title === title)!;
    // The two that only read move into their page's group, inside their area; the rest stay as they were.
    assert.deepEqual(where("reads its page").describe, ["Page /a", "Functional Coverage"]);
    assert.deepEqual(where("reads the response on /b").describe, ["Page /b", "Security Coverage"]);
    for (const title of ["clicks", "listens before loading", "interactive", "another fixture", "scrolls"]) assert.deepEqual(where(title).describe, ["Functional Coverage"], title);
    assert.deepEqual(where("a fresh-page area").describe, ["Performance Coverage"]);
    assert.deepEqual(where("in a describe with a hook").describe, ["SEO and Content Coverage"]);
    // Every test is still found, with its id and its page.
    assert.deepEqual(units.map((unit) => unit.id).sort(), parseTestUnits(suite).map((unit) => unit.id).sort());
    assert.deepEqual(where("reads its page").paths, ["/a"]);
    // The shared ones take the visit, its context and its response; the helper they used moved to the top.
    assert.match(where("reads its page").source, /async \(\{ tfShared \}\) => \{\n\s+const \{ page \} = await tfShared\.visit\('\/a'\);/);
    assert.match(where("reads the response on /b").source, /const \{ page, context, response \} = await tfShared\.visit\('\/b'\);/);
    assert.ok(shared.indexOf("function tfHelper") < shared.indexOf("test.describe('Functional Coverage'"));
    assert.equal(shared.split("function tfHelper").length, 2, "the helper once");
    // Once only.
    assert.equal(shareReadOnlyVisits(shared), shared);
    // A suite with nothing that can share is left as it is.
    const nothing = suite.replace(/await tfGoto\(page, '\/a'\);\n\s+await expect\(page.locator\('h1'\)\).toHaveText\(tfHelper\(' A '\)\);/, "await tfGoto(page, '/a');\n    await page.reload();").replace("const response = await tfGoto(page, '/b');", "const response = await tfGoto(page, '/b');\n    await page.goBack();");
    assert.equal(shareReadOnlyVisits(nothing), nothing);
});

test("in a real browser: the fixture's Standard suite gives every test the same result shared and one-page-per-test, and loads each page once but after a failure (Decision 7)", { skip: needsChromium }, async () => {
    const fixture = await startRecordedFixture();
    try {
        const paths = ["/", "/login", "/notes"];
        const inspection = await inspectPages(fixture.origin, paths);
        const profile = { scannedAt: new Date().toISOString(), baseUrl: fixture.origin, ...inspection } as ContentProfile;
        const areas = ["functional", "responsive/mobile", "performance/load", "security", "accessibility", "usability", "seo/content", "cookie/session", "database", "reliability"];
        const generate = (sharedVisits: boolean) => mockGenerateDetailed(fixture.origin, "Check the site.", areas as never, profile, normalizeContentRules({ paths }), normalizeTestAuditMode("fast"), { sharedVisits }).code;
        const sharedCode = generate(true);
        const freshCode = generate(false);
        assert.equal(sharedCode, mockGenerate(fixture.origin, "Check the site.", areas as never, profile, normalizeContentRules({ paths }), normalizeTestAuditMode("fast")), "shared by default");
        assert.deepEqual(findTypeErrors(sharedCode), []);
        assert.deepEqual(parseTestUnits(sharedCode).map((unit) => unit.id).sort(), parseTestUnits(freshCode).map((unit) => unit.id).sort(), "the same tests");

        await fixture.control("/__fixture/defect?set=none");
        const fresh = await run(freshCode, "fixture-fresh");
        const shared = await run(sharedCode, "fixture-shared");
        assert.deepEqual(outcome(shared.records), outcome(fresh.records), "every test: the same status and findings");

        // Each page is loaded once for its shared checks, and again only after a failure (a fresh worker).
        const notes = annotations(shared.report);
        const sharedTests = parseTestUnits(sharedCode).filter((unit) => unit.source.includes("tfShared.visit"));
        assert.ok(sharedTests.length > 50, `${sharedTests.length} shared tests`);
        for (const path of paths) {
            const onPage = sharedTests.filter((unit) => unit.paths.includes(path));
            const loads = onPage.filter((unit) => (notes.get(`${unit.id}: ${unit.title}`) ?? []).some((note) => note.type === "visit" && note.description === `loaded ${path}`)).length;
            const failedBeforeLast = onPage.slice(0, -1).filter((unit) => shared.records.find((record) => record.title === `${unit.id}: ${unit.title}`)?.status === "Failed").length;
            assert.equal(loads, 1 + failedBeforeLast, `${path}: ${loads} loads for ${onPage.length} shared checks, ${failedBeforeLast} of them failing before the last`);
        }
        const before = summarizeTiming(fresh.timing, { baseUrl: fixture.origin });
        const afterSharing = summarizeTiming(shared.timing, { baseUrl: fixture.origin });
        assert.ok(afterSharing.pageLoads.count < before.pageLoads.count / 2, `page loads: ${before.pageLoads.count} one-page-per-test, ${afterSharing.pageLoads.count} shared (the run record counts the shared visits' loads)`);

        // What only the load shows reaches the passive security checks on the shared visit; a page's failing check
        // doesn't stop its others. Each defect, both ways, Security and SEO only.
        const narrow = (sharedVisits: boolean) => mockGenerateDetailed(fixture.origin, "Check the site.", ["security", "seo/content"] as never, profile, normalizeContentRules({ paths }), normalizeTestAuditMode("fast"), { sharedVisits }).code;
        for (const [defect, shows] of [
            ["security-version-header", /x-powered-by: Express\/4\.18\.2 on \/ names a software version/],
            ["security-weak-session-cookie", /session cookie "sid" set on \/ has no HttpOnly attribute/],
            ["security-token-in-redirect", /loading \/ went through http:\/\/127\.0\.0\.1:\d+\/\?sessionid=acme-4f9c2a1e7b, which carries sessionid in the URL/],
            ["seo-missing-meta", /meta description/i],
        ] as const) {
            await fixture.control(`/__fixture/defect?set=${defect}`);
            const freshRun = await run(narrow(false), `${defect}-fresh`);
            const sharedRun = await run(narrow(true), `${defect}-shared`);
            assert.deepEqual(outcome(sharedRun.records), outcome(freshRun.records), `${defect}: the same status and findings`);
            const said = sharedRun.records.filter((record) => shows.test(`${record.rawMessage} ${(record.findings ?? []).join(" ")}`));
            assert.ok(said.length > 0, `${defect}: a shared check names it`);
            if (defect === "seo-missing-meta") {
                const onHome = sharedRun.records.filter((record) => /SEO/.test(record.area) && (record.page === "/" || / on \/$| for \/$/.test(record.title)));
                assert.ok(onHome.some((record) => record.status === "Failed") && onHome.some((record) => record.status === "Passed"), "/'s other SEO checks still ran and passed after one failed");
            }
        }
    } finally {
        await fixture.close();
    }
});

let site: Server;
let origin = "";
before(async () => {
    site = createServer((request, response) => {
        const html = (title: string, body: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title></head><body><main><h1>${title}</h1>${body}</main></body></html>`;
        if (request.url === "/a") return response.writeHead(200, { "content-type": "text/html" }).end(html("A", `<a id="to-b" href="/b">B</a><label>Search <input id="q"></label><label><input type="checkbox" id="c"> Remember</label>`));
        if (request.url === "/b") return response.writeHead(200, { "content-type": "text/html" }).end(html("B", ""));
        if (request.url === "/c") return response.writeHead(200, { "content-type": "text/html" }).end(html("C", `<label>Name <input id="n"></label>`));
        response.writeHead(404).end();
    });
    await new Promise<void>((resolve) => site.listen(0, "127.0.0.1", () => resolve()));
    origin = `http://127.0.0.1:${(site.address() as AddressInfo).port}`;
});
after(async () => {
    await new Promise((resolve) => site?.close(resolve));
});

test("in a real browser: Decision 4's rules - loaded again after leaving and after a failure, typed text cleared, a failure after a change re-run fresh with both results, one on an untouched page not re-run (state transition)", { skip: needsChromium }, async () => {
    const check = (name: string, path: string, body: string) => `  test('${name}', async ({ tfShared }) => {\n    const { page } = await tfShared.visit('${path}');\n${body}\n  });`;
    const code = `import { test, expect } from '@playwright/test';

test.use({ baseURL: '${origin}' });

${PAGE_VISIT_HELPER}

${SHARED_VISIT_HELPER}

test.describe('Page /a', () => {
  const test = tfSharedTest;
  test.describe.configure({ retries: 1 });
${[
        check("1 loads", "/a", "    await expect(page.locator('h1')).toHaveText('A');"),
        check("2 shares", "/a", "    await expect(page.locator('h1')).toHaveText('A');"),
        check("3 leaves the page", "/a", "    await page.locator('#to-b').click();\n    await expect(page).toHaveURL(/\\/b$/);"),
        check("4 after leaving: loads again", "/a", "    await expect(page.locator('h1')).toHaveText('A');"),
        check("5 types, and passes", "/a", "    const field = page.locator('#q');\n    tfShared.typed(field);\n    await field.fill('hello');"),
        check("6 finds the typed text cleared", "/a", "    await expect(page.locator('#q')).toHaveValue('');"),
        check("7 ticks a box and leaves it", "/a", "    tfShared.changed();\n    await page.locator('#c').check();"),
        check("8 needs the box clear: fails, re-run fresh", "/a", "    await expect(page.locator('#c')).not.toBeChecked({ timeout: 500 });"),
    ].join("\n\n")}
});

test.describe('Page /c', () => {
  const test = tfSharedTest;
  test.describe.configure({ retries: 1 });
${[
        check("9 fails on an untouched page", "/c", "    expect(1, 'nine always fails').toBe(2);"),
        check("10 after the failure: loads", "/c", "    await expect(page.locator('h1')).toHaveText('C');"),
        check("11 types, and fails", "/c", "    const field = page.locator('#n');\n    tfShared.typed(field);\n    await field.fill('typed');\n    expect(1, 'eleven always fails').toBe(2);"),
        check("12 finds the typed text gone", "/c", "    await expect(page.locator('#n')).toHaveValue('');"),
    ].join("\n\n")}
});
`;
    assert.deepEqual(findTypeErrors(code), []);
    const { records, report } = await run(code, "rules");
    const notes = annotations(report);
    const visits = (title: string) => (notes.get(title) ?? []).filter((note) => note.type === "visit").map((note) => note.description);
    const status = (title: string) => records.find((record) => record.title === title)?.status;

    assert.deepEqual(visits("1 loads"), ["loaded /a"]);
    assert.deepEqual(visits("2 shares"), ["shared /a"]);
    assert.deepEqual(visits("3 leaves the page"), ["shared /a"]);
    assert.deepEqual(visits("4 after leaving: loads again"), ["loaded /a"], "a check that left the page: the next loads it again");
    assert.deepEqual(visits("6 finds the typed text cleared"), ["shared /a"]);
    assert.equal(status("6 finds the typed text cleared"), "Passed", "typed text cleared when the test that typed passed");
    // 8 failed on the visit 7 changed: re-run on a fresh page, passed; the fresh result is reported, the first kept.
    assert.deepEqual(visits("8 needs the box clear: fails, re-run fresh"), ["shared /a", "loaded /a"]);
    assert.equal(status("8 needs the box clear: fails, re-run fresh"), "Passed");
    const eight = records.find((record) => record.title === "8 needs the box clear: fails, re-run fresh")!;
    assert.match(eight.remarks, /Re-run on a fresh page \(Phase 39 Decision 4\): it failed after a check that changed the shared page, then re-run on a fresh page\. The first attempt: .*toBeChecked/);
    // 9 failed on a page no check had changed: not re-run, its own failure stands.
    const nine = records.find((record) => record.title === "9 fails on an untouched page")!;
    assert.equal(nine.status, "Failed");
    assert.match(nine.rawMessage, /nine always fails/);
    assert.ok((notes.get("9 fails on an untouched page") ?? []).some((note) => note.type === "shared-visit" && /not re-run/.test(note.description ?? "")));
    assert.deepEqual(visits("10 after the failure: loads"), ["loaded /c"], "after a failure, a fresh worker: the page loaded again");
    assert.equal(status("11 types, and fails"), "Failed");
    assert.deepEqual(visits("12 finds the typed text gone"), ["loaded /c"]);
    assert.equal(status("12 finds the typed text gone"), "Passed", "typed text gone when the test that typed failed");
    for (const title of ["1 loads", "2 shares", "3 leaves the page", "4 after leaving: loads again", "5 types, and passes", "7 ticks a box and leaves it", "10 after the failure: loads"]) assert.equal(status(title), "Passed", title);
});
