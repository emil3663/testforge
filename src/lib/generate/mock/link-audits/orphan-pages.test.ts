/**
 * TFP-161: the orphan check judges only pages that were loaded (decided by
 * Emil, 2026-10-06: inspection records what was requested and what failed,
 * and the start page is the first path requested). On the-internet (TFP-150
 * re-run, T24) inspection lost "/", which links to every example, and every
 * other page failed as an orphan.
 *
 * A page that answers with a server error (5xx) counts as not loaded, like a
 * timeout (Emil, 2026-10-06); the fixture's dropped connections reach the
 * browser as 502s through the recording proxy.
 *
 * ISTQB technique: decision table. Conditions: was the start page loaded;
 * did another requested page fail to load; does a loaded page have an
 * inbound link from another loaded page. Columns:
 *   start not loaded                         -> Not run, naming the start page
 *   start loaded, another failed, page unlinked -> passes, with a finding naming the failed page
 *   all loaded, page unlinked                -> fails, naming the page
 *   all loaded, every page linked            -> passes, no finding
 *   older profile (no record)                -> today's check, unchanged
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/generate/mock/link-audits/orphan-pages.test.ts
 */
import assert from "node:assert";
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import type { ExecutionRecord, JsonReport } from "../../../report/types.ts";

const { buildTestMyLinksAuditTests } = await import("./index.ts");
const { inspectPages } = await import("../../../introspect/inspector.ts");
const { flattenSuites } = await import("../../../report/execution.ts");
const { findTypeErrors } = await import("../../validate.ts");
const { startRecordedFixture } = await import("../../../../test-support/comparison-fixture.ts");
const { chromiumSkipReason } = await import("../../../../test-support/chromium.ts");
const needsChromium = await chromiumSkipReason();

const ORPHAN = "orphan page approximation";

async function runSuite(code: string, label: string): Promise<ExecutionRecord[]> {
    const dir = join(process.cwd(), ".playwright-runs");
    await mkdir(dir, { recursive: true });
    const name = `orphan-pages-unit-${label}-${process.pid}-${Date.now()}`;
    const specFile = join(dir, `${name}.spec.ts`);
    const jsonFile = join(dir, `${name}.json`);
    await writeFile(specFile, code, "utf8");
    try {
        await new Promise<void>((resolve, reject) => {
            const child = spawn(process.execPath, [join(process.cwd(), "node_modules", "playwright", "cli.js"), "test", `.playwright-runs/${name}.spec.ts`, "--reporter=json", "--project=chromium"], {
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

test("in a real browser: on the fixture, the orphan check follows the decision table (start lost, another lost, unlinked, all linked)", { skip: needsChromium }, async () => {
    const fixture = await startRecordedFixture();
    try {
        const orphanCheck = async (defect: string, paths: string[]) => {
            await fixture.control(`/__fixture/defect?set=${defect}`);
            const inspection = await inspectPages(fixture.origin, paths);
            const profile = { scannedAt: new Date().toISOString(), baseUrl: fixture.origin, ...inspection };
            // Generated for the first page that loaded, as the run would.
            const check = buildTestMyLinksAuditTests(profile as never, inspection.pages[0].path, { auditMode: "fast", areas: ["functional"] }).filter((code: string) => code.includes(ORPHAN));
            assert.equal(check.length, 1, `${defect} ${paths}: one orphan check`);
            const code = `import { test, expect } from '@playwright/test';\ntest.describe('Functional', () => {\n${check[0]}\n});\n`;
            assert.deepEqual(findTypeErrors(code), []);
            const [record] = await runSuite(code, defect);
            return { inspection, record };
        };

        // Start page not loaded: Not run, naming it.
        // /anchors and /names are not in the nav and do not link to each other: like the-internet's examples, only the home page reaches them.
        const hubDown = await orphanCheck("hub-down", ["/", "/anchors", "/names"]);
        assert.deepEqual(hubDown.inspection.failedPages.map((page: { path: string }) => page.path), ["/"]);
        assert.equal(hubDown.record.status, "Not run", JSON.stringify(hubDown.record));
        // Through the recording proxy a dropped connection is a 502: a server error, so not loaded (TFP-161).
        assert.match(hubDown.record.skipReason ?? "", /^the start page \/ could not be loaded when the site was inspected \(HTTP 502\), so which pages it links to is unknown$/);

        // Another page not loaded, and /anchors has no link from the loaded pages: a finding naming the lost page.
        const otherDown = await orphanCheck("none", ["/", "/anchors", "/unreachable"]);
        assert.deepEqual(otherDown.inspection.failedPages.map((page: { path: string }) => page.path), ["/unreachable"]);
        assert.equal(otherDown.record.status, "Passed", JSON.stringify(otherDown.record));
        assert.deepEqual(otherDown.record.findings, ["/anchors has no link from another loaded page; /unreachable could not be loaded, so a link from there was not seen"]);

        // Every page loaded, /anchors genuinely unlinked: it fails, named.
        const unlinked = await orphanCheck("none", ["/", "/notes", "/anchors"]);
        assert.equal(unlinked.record.status, "Failed", JSON.stringify(unlinked.record));
        assert.match(unlinked.record.rawMessage, /\/anchors is not linked from any other inspected page/);

        // Every page loaded and linked from the home page's nav: passes, no finding.
        const linked = await orphanCheck("none", ["/", "/login", "/notes"]);
        assert.equal(linked.record.status, "Passed", JSON.stringify(linked.record));
        assert.deepEqual(linked.record.findings ?? [], []);
    } finally {
        await fixture.close();
    }
});

test("a profile without requestedPaths (saved before TFP-161) gets today's check, unchanged", () => {
    const page = (path: string, links: string[]) => ({ path, url: `http://x.test${path}`, title: "", metaDescription: "", headings: [], buttons: [], links: [], visibleTextSnippets: [], linkDetails: links.map((to) => ({ text: to, url: `http://x.test${to}`, rawHref: to, category: "navigation", linkType: "internal", containerLabel: "", expectedStatus: null, isVisible: true, target: "", targetBehavior: "same-window", titleAttribute: "", downloadName: "", requiresAuth: false, isSecure: false })) });
    const profile = { scannedAt: "", baseUrl: "http://x.test", pages: [page("/", ["/a"]), page("/a", ["/"])] };
    const [check] = buildTestMyLinksAuditTests(profile as never, "/", { auditMode: "fast", areas: ["functional"] }).filter((code: string) => code.includes(ORPHAN));
    assert.match(check, /for \(const page of pages\.slice\(1\)\) \{\n\s+expect\(inboundMap\.get\(page\.url\.replace\(\/#\.\*\$\/, ''\)\) \?\? 0\)\.toBeGreaterThan\(0\);/);
    assert.doesNotMatch(check, /startPath|notLoaded|test\.skip/);
});
