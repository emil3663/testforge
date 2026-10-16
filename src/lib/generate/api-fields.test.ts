/**
 * Phase 41 (TFP-185, Decision 5): API responses that expose undisplayed
 * internal fields, in a real browser on the comparison fixture's /store,
 * through the Comprehensive security suite.
 *
 * ISTQB technique: decision table. Conditions: what /api/store/products
 * items carry beyond ordinary fields (a yes/no in_stock flag only; a stock
 * count too) and whether /store shows it. One column each:
 *   clean                                -> no finding: in_stock is a flag, never judged
 *   security-api-internal-fields         -> a finding naming the request, "stock", sample values and /store
 *   security-api-internal-fields-shown   -> no finding: "Stock: 12" is on the page
 * The check's own technique is error guessing, named in the generated test.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/generate/api-fields.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";
import type { ComprehensiveRunMode } from "../comprehensive/run-mode.ts";
import type { ExecutionRecord } from "../report/types.ts";

const { buildComprehensiveSuite } = await import("./comprehensive.ts");
const { normalizeRunMode } = await import("../comprehensive/run-mode.ts");
const { flattenSuites } = await import("../report/execution.ts");
const { findTypeErrors } = await import("./validate.ts");
const { startRecordedFixture } = await import("../../test-support/comparison-fixture.ts");
const { chromiumSkipReason } = await import("../../test-support/chromium.ts");
const { runPlaywrightSpec } = await import("../../test-support/playwright-cli.ts");
const needsChromium = await chromiumSkipReason();

async function runSuite(code: string, label: string): Promise<ExecutionRecord[]> {
    const { report } = await runPlaywrightSpec(code, `api-fields-unit-${label}`, ["--timeout=30000", "--workers=1", "--grep", "internal fields"], { TESTFORGE_INTERACTIVE: "0" });
    return flattenSuites(report.suites);
}

test("the check is per page, tagged A01:2025 and ASVS 15.3.1, read-only", () => {
    const code = buildComprehensiveSuite("http://example.test", (normalizeRunMode({ kind: "comprehensive", area: "security" }) as ComprehensiveRunMode), { covered: ["/", "/store"], notCovered: [], pageCap: 20 });
    assert.deepEqual(findTypeErrors(code), []);
    assert.equal(code.match(/fetches no internal fields it never shows/g)?.length, 2);
    assert.match(code, /test\('TFSC-\d+: \/store fetches no internal fields it never shows \(recorded as a finding\)', \{ annotation: \[\{ type: 'page', description: '\/store' \}, \{ type: 'gate', description: 'read-only' \}, \{ type: 'category', description: 'A01:2025 Broken Access Control' \}, \{ type: 'asvs', description: '15\.3\.1' \}\] \}/);
});

test("in a real browser: a stock count the store never shows is a finding; a yes/no flag, and a count the page shows, are not (decision table)", { skip: needsChromium }, async () => {
    const fixture = await startRecordedFixture();
    try {
        const code = buildComprehensiveSuite(fixture.origin, (normalizeRunMode({ kind: "comprehensive", area: "security" }) as ComprehensiveRunMode), { covered: ["/store"], notCovered: [], pageCap: 20 });
        const findings = async (defect: string) => {
            await fixture.control(`/__fixture/defect?set=${defect}`);
            const [record] = (await runSuite(code, defect)).filter((r) => r.title.endsWith("/store fetches no internal fields it never shows (recorded as a finding)"));
            assert.equal(record?.status, "Passed", `${defect}: a finding, never a failure`);
            return record.findings ?? [];
        };
        assert.deepEqual(await findings("none"), [], "in_stock, a yes/no flag, is not judged");
        assert.deepEqual(await findings("security-api-internal-fields"), [`GET ${fixture.origin}/api/store/products returns "stock" (12, 19, 26, ...) on its items, which /store never shows; the name suggests an internal detail (ASVS 15.3.1: return only the fields the page needs)`]);
        assert.deepEqual(await findings("security-api-internal-fields-shown"), [], "shown beside its name: \"Stock: 12\"");
        assert.deepEqual(fixture.recorded.filter((request) => request.method !== "GET"), [], "read-only");
    } finally {
        await fixture.close();
    }
});
