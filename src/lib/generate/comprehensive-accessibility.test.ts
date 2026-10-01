/**
 * Phase 35 (TFP-134, Decision 4): Comprehensive accessibility - the axe-core
 * WCAG 2.2 A/AA scan on every page, split by impact, with undecided items
 * listed for manual review, plus TFP-121's field-name check on every page.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/generate/comprehensive-accessibility.test.ts
 */
import assert from "node:assert";
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { test } from "node:test";
import type { ComprehensiveRunMode } from "../comprehensive/run-mode.ts";
import type { JsonReport } from "../report/types.ts";

const { buildComprehensiveSuite } = await import("./comprehensive.ts");
const { WCAG_TAGS, FORM_FIELD_NAMES_CRITERION } = await import("./comprehensive-accessibility.ts");
const { normalizeRunMode } = await import("../comprehensive/run-mode.ts");
const { NOT_TESTED_STATEMENTS } = await import("../comprehensive/not-tested.ts");
const { buildReport } = await import("../report/report.ts");
const { findTypeErrors, findUnawaitedAssertions, findPromisesToPlainMatchers, findDuplicateTests } = await import("./validate.ts");

const { chromiumSkipReason } = await import("../../test-support/chromium.ts");
const needsChromium = await chromiumSkipReason();

const ACCESSIBILITY = normalizeRunMode({ kind: "comprehensive", area: "accessibility" }) as ComprehensiveRunMode;
const suiteFor = (origin: string, pages: string[]) => buildComprehensiveSuite(origin, ACCESSIBILITY, { covered: pages, notCovered: [], pageCap: 20 });

test("the suite: axe scan and field-name check per page, the six WCAG A/AA tags, clean under every gate, one worker", () => {
    const code = suiteFor("https://site.test", ["/", "/login"]);
    assert.deepEqual(findTypeErrors(code), []);
    assert.deepEqual(findUnawaitedAssertions(code).filter((a) => a.returnsPromise), []);
    assert.deepEqual(findPromisesToPlainMatchers(code), []);
    assert.deepEqual(findDuplicateTests(code), []);
    assert.match(code, /^import AxeBuilder from '@axe-core\/playwright';$/m);
    assert.deepEqual(WCAG_TAGS, ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"]);
    assert.equal(code.match(/\.withTags\(\['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22a','wcag22aa'\]\)/g)?.length, 2);
    assert.equal(code.match(/every form field has an accessible name: /g)?.length, 2);
    assert.match(code, /\{ type: 'category', description: 'WCAG 4\.1\.2' \}/);
    assert.match(code, /^test\.describe\.configure\(\{ mode: 'default' \}\);$/m);
});

async function runWithPlaywright(code: string): Promise<JsonReport> {
    const dir = join(process.cwd(), ".playwright-runs");
    await mkdir(dir, { recursive: true });
    const name = `accessibility-unit-${process.pid}-${Date.now()}`;
    const specFile = join(dir, `${name}.spec.ts`);
    const jsonFile = join(dir, `${name}.json`);
    await writeFile(specFile, code, "utf8");
    try {
        await new Promise<void>((resolve, reject) => {
            const child = spawn(process.execPath, [join(process.cwd(), "node_modules", "playwright", "cli.js"), "test", `.playwright-runs/${name}.spec.ts`, "--reporter=json", "--project=chromium", "--workers=1"], {
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

const PAGE = (title: string, body: string, head = "") => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title>${head}</head><body><main><h1>${title}</h1>${body}</main></body></html>`;
const SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='%23336'/%3E%3C/svg%3E";
const PAGES: Record<string, string> = {
    "/": PAGE("Clean", `<p>Fine text.</p><label for="q">Search</label> <input id="q" name="q">`),
    "/alt": PAGE("Alt", `<p><img src="${SVG}" width="40" height="40"></p>`),
    "/contrast": PAGE("Contrast", `<p style="color:#c8c8c8">Light grey on white.</p>`),
    "/unlabelled": PAGE("Unlabelled", `<p><input id="email" name="email" type="email"></p>`),
    "/zoom": PAGE("Zoom", `<p>Text.</p>`, `<meta name="viewport" content="width=device-width, user-scalable=no">`),
    "/undecided": PAGE("Undecided", `<p style="color:#777;background:linear-gradient(90deg,#000,#fff)">Text over a gradient.</p>`),
};

test("in a real browser: violations split by impact under their WCAG criterion, undecided items listed for review, TFP-121 runs on every page", { skip: needsChromium }, async () => {
    const server = createServer((req, res) => {
        const body = PAGES[new URL(req.url ?? "/", "http://x").pathname];
        res.writeHead(body ? 200 : 404, { "content-type": "text/html" }).end(body ?? "");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    try {
        const paths = Object.keys(PAGES);
        const code = suiteFor(origin, paths);
        const report = buildReport(await runWithPlaywright(code), ["accessibility"], "", origin, null, code, null, "", ACCESSIBILITY, 1);
        const c = report.comprehensive!;
        const row = (path: string) => c.pages.find((r) => r.path === path)!;

        assert.deepEqual([row("/").passed, row("/").failed, row("/").findings], [2, 0, 0], "a clean page passes both checks");
        const failures = c.groups.flatMap((group) => group.failures.map((f) => ({ category: group.category, page: f.page, detail: f.detail })));
        const failureFor = (page: string, rule: string) => failures.find((f) => f.page === page && f.detail.startsWith(rule));
        assert.equal(failureFor("/alt", "image-alt (critical)")?.category, "WCAG 1.1.1");
        assert.equal(failureFor("/contrast", "color-contrast (serious)")?.category, "WCAG 1.4.3");
        assert.equal(failureFor("/unlabelled", "label (critical)")?.category, "WCAG 4.1.2");
        assert.match(failureFor("/unlabelled", "label (critical)")!.detail, /#email/, "names the element");
        const fieldNames = failures.find((f) => f.page === "/unlabelled" && f.category === FORM_FIELD_NAMES_CRITERION && !f.detail.startsWith("label"));
        assert.ok(fieldNames, "TFP-121's check fails on the same page");

        const findings = c.groups.flatMap((group) => group.findings.map((f) => ({ category: group.category, page: f.page, detail: f.detail })));
        assert.deepEqual(findings.filter((f) => f.page === "/zoom").map((f) => [f.category, f.detail.split(":")[0]]), [["WCAG 1.4.4", "meta-viewport (moderate)"]], "a moderate violation is a finding");
        assert.deepEqual([row("/zoom").passed, row("/zoom").failed, row("/zoom").findings], [2, 0, 1]);

        const review = c.manualReview.filter((item) => item.page === "/undecided");
        assert.ok(review.some((item) => item.detail.startsWith("color-contrast:")), JSON.stringify(c.manualReview));
        assert.deepEqual([row("/undecided").failed], [0], "an undecided item is neither a failure nor a pass of that rule");

        assert.deepEqual(c.notTested.statements, [...NOT_TESTED_STATEMENTS.accessibility]);
        assert.equal(c.notTested.asvs, null);
    } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
    }
});
