/**
 * TFP-159: links in a closed menu or behind a collapsed navbar's toggle are
 * checked as what they are (approach decided by Emil, 2026-10-06).
 *
 * - Link health and link type are independent of the menu: the link's own
 *   address and its presence in the page, not its visibility.
 * - The keyboard check opens the menu by keyboard first, and the responsive
 *   check clicks the toggle; a link still hidden fails, naming the menu.
 * - A healthy link users can't reach carries a finding saying so.
 *
 * ISTQB technique: decision table. Conditions: where the link is (visible;
 * in a closed menu; behind a collapsed navbar's toggle; hidden with no
 * control) and whether its menu opens and shows it. One column each:
 *   visible                       -> unchanged checks pass
 *   closed menu, opens            -> health passes, no finding; keyboard reaches it
 *   closed menu, opens, stays hidden (Archived) -> health passes with the finding; keyboard fails, naming the menu
 *   closed menu, toggle broken    -> health passes with the finding; keyboard fails, naming the menu
 *   behind a toggle at 390 px     -> the responsive check opens it and passes
 *   hidden, no control            -> health passes with the finding "no control was found"
 *   (TFP-162) closed menu, deep mode -> the destination check takes the link by its own address
 *   (TFP-162) a hidden button      -> found by role and name, hidden included, and checked as present
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/generate/mock/link-audits/hidden-links.test.ts
 */
import assert from "node:assert";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import type { ExecutionRecord } from "../../../report/types.ts";
import type { LinkDetail } from "../types.ts";

const { mockGenerate } = await import("../index.ts");
const { normalizeContentRules, normalizeTestAuditMode } = await import("../../normalize.ts");
const { inspectPages } = await import("../../../introspect/inspector.ts");
const { flattenSuites } = await import("../../../report/execution.ts");
const { findTypeErrors } = await import("../../validate.ts");
const { buildBrowserInteractionLinkTests } = await import("./interaction-tests.ts");
const { startRecordedFixture } = await import("../../../../test-support/comparison-fixture.ts");
const { chromiumSkipReason } = await import("../../../../test-support/chromium.ts");
const { runPlaywrightSpec } = await import("../../../../test-support/playwright-cli.ts");
const needsChromium = await chromiumSkipReason();

async function runSuite(code: string, label: string): Promise<ExecutionRecord[]> {
    const { report } = await runPlaywrightSpec(code, `hidden-links-unit-${label}`, ["--timeout=30000"], { TESTFORGE_INTERACTIVE: "0" });
    return flattenSuites(report.suites);
}

const one = (records: ExecutionRecord[], title: RegExp) => {
    const found = records.filter((record) => title.test(record.title));
    assert.equal(found.length, 1, `${title}: ${found.length} matches in ${records.map((record) => record.title).join(" | ")}`);
    return found[0];
};
const summary = (record: ExecutionRecord) => JSON.stringify({ status: record.status, findings: record.findings, message: process.env.TF_DEBUG ? record.rawMessage : record.rawMessage.split("\n")[0] });

test("in a real browser: on the fixture's menus, link health ignores the menu, the keyboard check opens it, and the responsive check opens the collapsed nav (decision table)", { skip: needsChromium }, async () => {
    const fixture = await startRecordedFixture();
    try {
        const generate = async () => {
            const inspection = await inspectPages(fixture.origin, ["/"]);
            const profile = { scannedAt: new Date().toISOString(), baseUrl: fixture.origin, ...inspection };
            const hidden = (inspection.pages[0].linkDetails ?? []).filter((link: LinkDetail) => !link.isVisible).map((link: LinkDetail) => link.text);
            assert.deepEqual(hidden, ["Hand Tools", "Archived"], "introspection sees the two menu links as hidden");
            // Deep mode: every link gets its own health test and the keyboard check (fast mode keeps 3).
            const code = mockGenerate(fixture.origin, "Check the site.", ["functional", "accessibility", "responsive/mobile"], profile as never, normalizeContentRules(undefined), normalizeTestAuditMode("deep"));
            assert.deepEqual(findTypeErrors(code), []);
            return code;
        };

        await fixture.control("/__fixture/defect?set=menus");
        const code = await generate();
        // TFP-162: the hidden button is looked up by role and name with hidden elements included (getByRole alone never finds it).
        assert.match(code, /getByRole\('button', \{ name: 'Clear filters', exact: true, includeHidden: true \}\)/);
        const records = await runSuite(code, "menus");

        // Visible: unchanged, and passing.
        assert.equal(one(records, /navigation link health: Shop/).status, "Passed", summary(one(records, /navigation link health: Shop/)));
        // In a closed menu that opens: health passes with no finding.
        const handTools = one(records, /navigation link health: Hand Tools/);
        assert.equal(handTools.status, "Passed", summary(handTools));
        assert.deepEqual(handTools.findings ?? [], [], summary(handTools));
        // In a menu that opens, but still hidden: health passes, with the finding naming the menu.
        const archived = one(records, /navigation link health: Archived/);
        assert.equal(archived.status, "Passed", summary(archived));
        assert.deepEqual(archived.findings, ["Archived is healthy by its address, but users can't reach it: the 'Categories' menu opened, but it stays hidden"]);
        // Link type: classified by address and presence, hidden or not.
        const types = one(records, /link types: internal, external/);
        assert.equal(types.status, "Passed", summary(types));
        // Keyboard: Hand Tools comes first and is reached by opening Categories with Enter; Archived then fails, naming the menu.
        const keyboard = one(records, /keyboard navigation: links can receive focus/);
        assert.equal(keyboard.status, "Failed", summary(keyboard));
        assert.match(keyboard.rawMessage, /Archived can't be reached by keyboard: the 'Categories' menu opened, but it stays hidden/);
        // Responsive: at 390 px, Shop and Categories are behind the collapsed nav's toggle, which the check opens.
        const responsive = one(records, /keeps the core journey visible across common viewport sizes/);
        assert.equal(responsive.status, "Passed", summary(responsive));
        // TFP-162: deep mode's destination check takes a link in a closed menu by its own address, as link type does.
        const destination = one(records, /navigation destination: links navigate to their required destination/);
        assert.equal(destination.status, "Passed", summary(destination));
        // TFP-162: the hidden "Clear filters" button is found as itself (by role and name, hidden included) and checked as present.
        const hiddenButtonChecks = records.filter((record) => /Clear filters/.test(record.title));
        assert.ok(hiddenButtonChecks.length >= 2, hiddenButtonChecks.map(summary).join("\n"));
        for (const record of hiddenButtonChecks) assert.equal(record.status, "Passed", summary(record));

        await fixture.control("/__fixture/defect?set=menus-toggle-broken");
        const broken = await runSuite(await generate(), "menus-broken");
        // Toggle broken: health still passes, with the finding; the keyboard check fails on the first link in it.
        const brokenHandTools = one(broken, /navigation link health: Hand Tools/);
        assert.equal(brokenHandTools.status, "Passed", summary(brokenHandTools));
        assert.deepEqual(brokenHandTools.findings, ["Hand Tools is healthy by its address, but users can't reach it: the 'Categories' menu didn't open"]);
        const brokenKeyboard = one(broken, /keyboard navigation: links can receive focus/);
        assert.equal(brokenKeyboard.status, "Failed", summary(brokenKeyboard));
        assert.match(brokenKeyboard.rawMessage, /Hand Tools can't be reached by keyboard: the 'Categories' menu didn't open/);
    } finally {
        await fixture.close();
    }
});

test("in a real browser: a hidden link with no control that reveals it passes health, with the finding that none was found (decision table)", { skip: needsChromium }, async () => {
    const page = "<!doctype html><html lang='en'><head><title>t</title></head><body><h1>Page</h1><p style='display:none'><a href='/'>Drafts</a></p></body></html>";
    const server = createServer((_req, res) => res.writeHead(200, { "content-type": "text/html" }).end(page));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
        const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
        const link: LinkDetail = { text: "Drafts", url: `${origin}/`, rawHref: "/", category: "navigation", linkType: "internal", containerLabel: "", expectedStatus: null, isVisible: false, target: "", targetBehavior: "same-window", titleAttribute: "", downloadName: "", requiresAuth: false, isSecure: false };
        const code = `import { test, expect } from '@playwright/test';\ntest.use({ baseURL: '${origin}' });\ntest.describe('Functional', () => {\n${buildBrowserInteractionLinkTests([link], "/", true, 4000).join("\n")}\n});\n`;
        assert.deepEqual(findTypeErrors(code), []);
        const record = one(await runSuite(code, "no-control"), /navigation link health: Drafts/);
        assert.equal(record.status, "Passed", summary(record));
        assert.deepEqual(record.findings, ["Drafts is healthy by its address, but users can't reach it: no control was found that reveals it"]);
    } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
    }
});
