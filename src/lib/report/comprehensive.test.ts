/**
 * Phase 35 (TFP-132, Decisions 6 and 7): the Comprehensive suite and report -
 * one area only, a per-page table, failures and findings by category, the
 * model section, and the fixed "not tested" statement with the ASVS table.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/report/comprehensive.test.ts
 */
import assert from "node:assert";
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { test } from "node:test";
import type { ExecutionRecord, JsonReport } from "./types.ts";
import type { ComprehensiveRunMode } from "../comprehensive/run-mode.ts";

const { normalizeRunMode } = await import("../comprehensive/run-mode.ts");
const { selectComprehensivePages } = await import("../comprehensive/pages.ts");
const { ASVS_CHAPTERS } = await import("../comprehensive/asvs.ts");
const { NOT_TESTED_STATEMENTS } = await import("../comprehensive/not-tested.ts");
const { buildComprehensiveSuite } = await import("../generate/comprehensive.ts");
const { buildComprehensiveReport, UNCATEGORISED, MODEL_NOT_CONFIGURED_NOTE } = await import("./comprehensive.ts");
const { buildReport } = await import("./report.ts");
const { buildReportHtmlDocument } = await import("./html.ts");
const { findTypeErrors, findUnawaitedAssertions, findPromisesToPlainMatchers, findDuplicateTests } = await import("../generate/validate.ts");

const { chromiumSkipReason } = await import("../../test-support/chromium.ts");
const needsChromium = await chromiumSkipReason();

const SECURITY = normalizeRunMode({ kind: "comprehensive", area: "security", pageCap: 3 }) as ComprehensiveRunMode;
const ACCESSIBILITY = normalizeRunMode({ kind: "comprehensive", area: "accessibility" }) as ComprehensiveRunMode;

function profile(origin: string, paths: string[]) {
    return {
        scannedAt: "",
        baseUrl: origin,
        pages: paths.map((path) => ({ path, url: `${origin}${path}`, title: "", metaDescription: "", headings: [], buttons: [], links: [], visibleTextSnippets: [] })),
    };
}

test("the suite: one describe per covered page under the area's title, every test tagged with its page, clean under every gate", () => {
    const scope = selectComprehensivePages(profile("https://site.test", ["/", "/it's", "/c", "/d"]) as never, "https://site.test", 3);
    const code = buildComprehensiveSuite("https://site.test", SECURITY, scope);
    assert.deepEqual(findTypeErrors(code), []);
    assert.deepEqual(findUnawaitedAssertions(code).filter((a) => a.returnsPromise), []);
    assert.deepEqual(findPromisesToPlainMatchers(code), []);
    assert.deepEqual(findDuplicateTests(code), []);
    assert.match(code, /test\.describe\('Security Coverage', \(\) => \{/);
    assert.deepEqual([...code.matchAll(/test\.describe\('Page ([^']|\\')*'/g)].length, 3);
    assert.deepEqual([...code.matchAll(/test\('(TFSC-\d{3}):/g)].map((m) => m[1]), Array.from({ length: 13 }, (_, i) => `TFSC-${String(i + 1).padStart(3, "0")}`), "3 pages x 4 passive checks, then the one missing-page probe");
    assert.match(code, /\{ annotation: \[\{ type: 'page', description: '\/it\\'s' \}, \{ type: 'category', description: 'A02:2025 Security Misconfiguration' \}/);
    assert.match(code, /\/\/ Not covered \(beyond the 3-page cap\): \/d/);
    assert.doesNotMatch(code, /fill\(|click\(|submit|onerror/, "the passive level sends no input");
});

function record(overrides: Partial<ExecutionRecord>): ExecutionRecord {
    return { id: "x", title: "t", description: "", suite: "Security Coverage", area: "Security", interactionType: null, browser: "chromium", status: "Passed", duration: 1, remarks: "", rawMessage: "", reproductionSteps: [], artifacts: [], order: 0, ...overrides };
}

test("the report: per-page counts, failures and findings grouped by category naming page and test, ASVS chapters tested only from tags that ran", () => {
    const execution = [
        record({ page: "/", title: "TFSC-001: / loads", status: "Passed", findings: ["no Content-Security-Policy header"], category: "A02:2025 Security Misconfiguration", asvs: ["3.4.3"] }),
        record({ page: "/login", title: "TFSC-002: /login loads", status: "Failed", rawMessage: "Error: /login answered HTTP 500\n\nat x", category: "A02:2025 Security Misconfiguration" }),
        record({ page: "/login", title: "TFSC-003: password in URL", status: "Not run", asvs: ["14.2.1"] }),
        record({ page: "/c", title: "TFSC-004: /c loads", status: "Blocked", rawMessage: "Test timeout of 30000ms exceeded." }),
    ];
    const report = buildComprehensiveReport(execution, SECURITY, profile("https://site.test", ["/", "/login", "/c", "/d"]) as never, "https://site.test", 1);
    assert.equal(report.label, "Comprehensive security (passive)");
    assert.deepEqual(report.pages, [
        { path: "/", tests: 1, passed: 1, failed: 0, notRun: 0, findings: 1 },
        { path: "/login", tests: 2, passed: 0, failed: 1, notRun: 1, findings: 0 },
        { path: "/c", tests: 1, passed: 0, failed: 1, notRun: 0, findings: 0 },
    ]);
    assert.deepEqual(report.pagesNotCovered, ["/d"]);
    assert.deepEqual(report.groups, [
        {
            category: "A02:2025 Security Misconfiguration",
            failures: [{ page: "/login", title: "TFSC-002: /login loads", detail: "Error: /login answered HTTP 500" }],
            findings: [{ page: "/", title: "TFSC-001: / loads", detail: "no Content-Security-Policy header" }],
        },
        { category: UNCATEGORISED, failures: [{ page: "/c", title: "TFSC-004: /c loads", detail: "Blocked: Test timeout of 30000ms exceeded." }], findings: [] },
    ]);
    assert.equal(report.summary.headline, "2 failures on 2 of 3 pages, 1 finding. Read what this run did not test before relying on it.");
    assert.equal(report.workerNote, "One worker: tests ran one at a time, as the suite itself requires on every host.");
    assert.deepEqual(report.model, { status: "not-configured", note: MODEL_NOT_CONFIGURED_NOTE, tests: [] });
    assert.deepEqual(report.notTested.statements, [...NOT_TESTED_STATEMENTS.security]);
    assert.equal(report.notTested.pagesNotCovered, "1 known page was beyond the 3-page cap and not covered: /d.");
    const asvs = report.notTested.asvs!;
    assert.match(asvs.source, /^OWASP ASVS 5\.0\.0 \(May 2025\), github\.com\/OWASP\/ASVS tag v5\.0\.0_release$/);
    assert.deepEqual(asvs.chapters.map((c) => c.id), ASVS_CHAPTERS.map((c) => c.id));
    assert.deepEqual(asvs.chapters.filter((c) => c.testedInRun).map((c) => c.id), ["V3"], "V14's only check did not run, so V14 is not tested");
    assert.deepEqual(asvs.chapters.filter((c) => c.passiveReach === "in reach").map((c) => c.id), ["V3", "V12", "V13", "V14", "V16"]);
});

test("the report: a clean run never reads as a clean bill of health; accessibility has no ASVS table", () => {
    const report = buildComprehensiveReport([record({ page: "/", status: "Passed" })], ACCESSIBILITY, null, "http://localhost:3000", 2);
    assert.equal(report.summary.headline, "No failures on 1 page, 0 findings. That is not a clean bill of health: read what this run did not test.");
    assert.equal(report.workerNote, "2 workers.", "a count other than one is stated as it is");
    assert.equal(report.notTested.asvs, null);
    assert.match(report.notTested.statements[0], /axe-core states it finds 57% of them on average/);
    assert.equal(buildComprehensiveReport([], ACCESSIBILITY, null, "http://localhost:3000", 2).summary.headline, "No check ran.");
});

/** Runs a generated suite through the Playwright CLI the way the executor does, returning its JSON report. */
async function runWithPlaywright(code: string): Promise<JsonReport> {
    const dir = join(process.cwd(), ".playwright-runs");
    await mkdir(dir, { recursive: true });
    const name = `comprehensive-unit-${process.pid}-${Date.now()}`;
    const specFile = join(dir, `${name}.spec.ts`);
    const jsonFile = join(dir, `${name}.json`);
    await writeFile(specFile, code, "utf8");
    try {
        await new Promise<void>((resolve, reject) => {
            const child = spawn(process.execPath, [join(process.cwd(), "node_modules", "playwright", "cli.js"), "test", `.playwright-runs/${name}.spec.ts`, "--reporter=json", "--workers=1", "--project=chromium"], {
                cwd: process.cwd(),
                env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: jsonFile, FORCE_COLOR: "0" },
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

test("in a real browser: a generated Comprehensive run's report shows the area only, each page's result, the page left out, and ends with what it did not test", { skip: needsChromium }, async () => {
    const server = createServer((req, res) => {
        const status = req.url === "/gone" ? 404 : 200;
        res.writeHead(status, { "content-type": "text/html" }).end(`<!doctype html><title>t</title><h1>${req.url}</h1>`);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    try {
        const pageData = profile(origin, ["/", "/about", "/gone", "/beyond-the-cap"]);
        const code = buildComprehensiveSuite(origin, SECURITY, selectComprehensivePages(pageData as never, origin, SECURITY.pageCap));
        const json = await runWithPlaywright(code);
        const report = buildReport(json, ["security"], "", origin, pageData as never, code, null, "", SECURITY, 4);

        assert.deepEqual(report.comprehensive!.pages.map((row) => [row.path, row.passed, row.failed]), [["/", 4, 0], ["/about", 4, 0], ["/gone", 1, 0], ["(missing-page probe)", 1, 0]], "a 404 page's checks are not run, not failed (TFP-136); its version check still reads the headers");
        assert.equal(report.comprehensive!.pages.find((row) => row.path === "/gone")!.notRun, 3);
        assert.deepEqual(report.comprehensive!.groups.flatMap((group) => group.failures), []);
        assert.deepEqual(report.comprehensive!.pagesNotCovered, ["/beyond-the-cap"]);
        assert.equal(report.comprehensive!.workerNote, "4 workers.");

        const html = buildReportHtmlDocument(report, "run-1");
        assert.doesNotMatch(html, /Release readiness|Traceability matrix|tab-btn/, "a single-area report shows only that area");
        const order = ["id=\"summary\"", "id=\"pages\"", "id=\"issues\"", "id=\"model\"", "id=\"not-tested\""].map((marker) => html.indexOf(marker));
        assert.ok(order.every((at, i) => at > 0 && (i === 0 || at > order[i - 1])), `sections in Decision 7's order: ${order}`);
        assert.match(html, /What this run did not test[\s\S]*No input was sent[\s\S]*V16 Security Logging and Error Handling/);
        assert.match(html, /beyond the 3-page cap and not covered: \/beyond-the-cap/);
    } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
    }
});

test("a Standard report has no comprehensive section and keeps the tabbed layout", () => {
    const json: JsonReport = { suites: [], errors: [], stats: { duration: 0, expected: 0, unexpected: 0, flaky: 0, skipped: 0 } };
    const standard = buildReport(json, ["security"], "", "https://site.test");
    assert.equal("comprehensive" in standard, false);
    assert.match(buildReportHtmlDocument(standard, "r"), /Release readiness at a glance/);
});
