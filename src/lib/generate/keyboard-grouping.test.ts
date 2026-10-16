/**
 * Phase 41 (TFP-183, Decision 4): tab order and grouping, in a real browser
 * on the comparison fixture's /store/register and /store, through the
 * Comprehensive accessibility suite - the builders the Standard suite calls
 * too.
 *
 * ISTQB technique: decision table. Conditions: the register form's fields
 * (in reading order; with positive tabindex; laid out right to left, so the
 * DOM order goes against the reading order) and the store's category
 * checkboxes (in a fieldset with a legend; loose). One column each:
 *   clean                    -> both pass
 *   a11y-positive-tabindex   -> tab order fails, naming each field and its tabindex
 *   a11y-tab-order-jumps     -> tab order fails, naming the jump back
 *   a11y-ungrouped-choices   -> grouping fails, naming the shared name and the boxes
 * The checks' own techniques are named in the generated tests (tab order:
 * state transition; grouping: decision table).
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/generate/keyboard-grouping.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";
import type { ComprehensiveRunMode } from "../comprehensive/run-mode.ts";
import type { ExecutionRecord } from "../report/types.ts";

const { buildComprehensiveSuite } = await import("./comprehensive.ts");
const { normalizeRunMode } = await import("../comprehensive/run-mode.ts");
const { mockGenerate } = await import("./mock/index.ts");
const { normalizeContentRules, normalizeTestAuditMode } = await import("./normalize.ts");
const { flattenSuites } = await import("../report/execution.ts");
const { findTypeErrors } = await import("./validate.ts");
const { startRecordedFixture } = await import("../../test-support/comparison-fixture.ts");
const { chromiumSkipReason } = await import("../../test-support/chromium.ts");
const { runPlaywrightSpec } = await import("../../test-support/playwright-cli.ts");
const needsChromium = await chromiumSkipReason();

async function runSuite(code: string, label: string): Promise<ExecutionRecord[]> {
    const { report } = await runPlaywrightSpec(code, `keyboard-grouping-unit-${label}`, ["--timeout=30000", "--workers=1", "--grep", "tabbed through|groups its"], { TESTFORGE_INTERACTIVE: "0" });
    return flattenSuites(report.suites);
}

test("the Standard accessibility suite carries both checks for every inspected page, tagged with their WCAG criterion", () => {
    const page = (path: string) => ({ path, url: path, title: "", metaDescription: "", headings: [], buttons: [], links: [], visibleTextSnippets: [], actionableElements: [] });
    const profile = { scannedAt: "", baseUrl: "http://example.test", pages: [page("/"), page("/join")] };
    const code = mockGenerate("http://example.test", "Check the site.", ["accessibility"], profile as never, normalizeContentRules({ paths: ["/", "/join"] }), normalizeTestAuditMode("fast"));
    assert.deepEqual(findTypeErrors(code), []);
    for (const path of ["/", "/join"]) {
        assert.match(code, new RegExp(`test\\('TFAC-\\d+: ${path.replace("/", "\\/")} is tabbed through in reading order', \\{ annotation: \\[\\{ type: 'page', description: '${path.replace("/", "\\/")}' \\}, \\{ type: 'gate', description: 'read-only' \\}, \\{ type: 'category', description: 'WCAG 2\\.4\\.3' \\}`));
        assert.match(code, new RegExp(`test\\('TFAC-\\d+: ${path.replace("/", "\\/")} groups its checkboxes and radio buttons', \\{ annotation: \\[\\{ type: 'page', description: '${path.replace("/", "\\/")}' \\}, \\{ type: 'gate', description: 'read-only' \\}, \\{ type: 'category', description: 'WCAG 1\\.3\\.1' \\}`));
    }
});

test("in a real browser: on the fixture, positive tabindex, a Tab order against the reading order and loose checkboxes each fail, named; the clean pages pass (decision table)", { skip: needsChromium }, async () => {
    const fixture = await startRecordedFixture();
    try {
        const code = buildComprehensiveSuite(fixture.origin, (normalizeRunMode({ kind: "comprehensive", area: "accessibility" }) as ComprehensiveRunMode), { covered: ["/store", "/store/register"], notCovered: [], pageCap: 20 });
        assert.deepEqual(findTypeErrors(code), []);
        const tab = "/store/register is tabbed through in reading order";
        const group = "/store groups its checkboxes and radio buttons";
        const columns: Array<[string, string | null, RegExp | null]> = [
            ["none", null, null],
            ["a11y-positive-tabindex", tab, /positive tabindex on \/store\/register, which overrides the reading order: "First name" \(2\), "Last name" \(3\), "Email" \(1\), "Password" \(4\)/],
            ["a11y-tab-order-jumps", tab, /Tab on \/store\/register goes from "First name" back to "Last name", against the reading order \(Last name, First name, Email, Password\)/],
            ["a11y-ungrouped-choices", group, /2 checkboxes sharing the name "category" \("Hand tools", "Measuring"\) are not in a fieldset with a legend or a named group on \/store/],
        ];
        for (const [defect, broken, message] of columns) {
            await fixture.control(`/__fixture/defect?set=${defect}`);
            const records = await runSuite(code, defect);
            for (const title of [tab, group]) {
                const found = records.filter((record) => record.title.endsWith(title));
                assert.equal(found.length, 1, `${defect}: ${title}: ${records.map((record) => record.title).join(" | ")}`);
                if (title === broken) {
                    assert.equal(found[0].status, "Failed", `${defect}: ${title}`);
                    assert.match(found[0].rawMessage, message as RegExp, `${defect}: ${found[0].rawMessage.split("\n")[0]}`);
                } else {
                    assert.equal(found[0].status, "Passed", `${defect}: ${title}: ${found[0].rawMessage.split("\n")[0]}`);
                }
            }
        }
        // Read-only: focus moved, nothing was submitted.
        assert.deepEqual(fixture.recorded.filter((request) => request.method !== "GET"), []);
    } finally {
        await fixture.close();
    }
});
