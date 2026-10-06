/**
 * TFP-115 (Phase 34, Decision 2): the template's performance checks.
 * Their runtime behaviour (pass on a healthy page, fail with a named culprit)
 * is proven live on the comparison fixture - see TEST_PLAN.md GEN-40.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/generate/mock/performance-checks.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";

const { buildPerformanceChecks, LCP_BUDGET_MS, NAVIGATION_BUDGET_MS, PAGE_WEIGHT_BUDGET_BYTES } = await import("./performance-checks.ts");
const { findTypeErrors, findUnawaitedAssertions } = await import("../validate.ts");

function asSuite(tests: string[]) {
    return `import { test, expect } from '@playwright/test';\ntest.use({ baseURL: 'http://127.0.0.1:4410' });\ntest.describe('Performance Coverage', () => {\n${tests.join("\n\n")}\n});\n`;
}

const ALL = buildPerformanceChecks();
const [navigation, lcp, weight, failed] = ALL;

test("performance checks: the budgets are Decision 2's loose ones", () => {
    assert.equal(NAVIGATION_BUDGET_MS, 5000);
    assert.equal(LCP_BUDGET_MS, 4000, "the Core Web Vitals 'poor' boundary, not the 2.5 s 'good' one");
    assert.equal(PAGE_WEIGHT_BUDGET_BYTES, 5 * 1024 * 1024);
});

test("performance checks: six checks (TFP-149 added CLS and TBT), the generated suite compiles and awaits every web-first assertion", () => {
    assert.equal(ALL.length, 6);
    const code = asSuite(ALL);
    assert.deepEqual(findTypeErrors(code), []);
    assert.deepEqual(findUnawaitedAssertions(code).filter((a) => a.returnsPromise), []);
});

test("performance checks: navigation waits for the load event before reading its timing", () => {
    // The old test loaded with 'domcontentloaded' and read duration at once:
    // 0 ms on any page whose load finishes after DOMContentLoaded.
    assert.doesNotMatch(navigation, /domcontentloaded/);
    assert.match(navigation, /waitUntil: 'load'/);
    assert.match(navigation, /loadEventEnd > 0/);
    assert.match(navigation, /budget 5000 ms: the page took too long to load/);
});

test("performance checks: each failure message states the measurement, the budget, and the culprit", () => {
    // Two decimals: live, 4044 ms read as "LCP 4.0 s, budget 4.0 s" - a failure that looked like a pass.
    assert.ok(lcp.includes("(lcp.time / 1000).toFixed(2)"), "LCP must be shown to two decimals");
    assert.match(lcp, /'LCP ' \+ .*budget 4\.0 s: Core Web Vitals "poor"\. Largest element: ' \+ lcp\.element/);
    assert.match(weight, /budget 5 MB: clearly bloated\. Largest: ' \+ largest/);
    assert.match(failed, /same-origin requests failed while \/ loaded: ' \+ failures\.join/);
});

test("performance checks: page weight uses browser-reported sizes, not Resource Timing (0 bytes cross-origin)", () => {
    assert.match(weight, /request\.sizes\(\)/);
    assert.doesNotMatch(weight, /getEntriesByType\('resource'\)/);
});

test("performance checks: a request the page cancelled itself is not a failure", () => {
    assert.match(failed, /ERR_ABORTED/);
});

test("performance checks: no LCP at all is recorded as a finding, not a failure", () => {
    assert.match(lcp, /annotations\.push\(\{ type: 'finding'/);
});

/** Runs a generated check with a stub page whose evaluate() returns `measured`, and Playwright's own expect. */
async function runWithMeasurement(code: string, measured: unknown) {
    const ts = await import("typescript");
    const { expect } = await import("@playwright/test");
    const js = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    let body: ((fixtures: { page: unknown }) => Promise<void>) | null = null;
    const annotations: Array<{ type: string; description?: string }> = [];
    const fakeTest = Object.assign((_title: string, fn: typeof body) => { body = fn; }, { info: () => ({ annotations }) });
    new Function("test", "expect", js)(fakeTest, expect);
    const page = { goto: async () => null, evaluate: async () => measured };
    const findings = () => annotations.filter((a) => a.type === "finding").length;
    try {
        await body!({ page });
        return { outcome: "passed", findings: findings() };
    } catch {
        return { outcome: "failed", findings: findings() };
    }
}

test("performance checks: LCP and CLS at and either side of each band's lines (boundary value analysis; 'poor' is over the line, as web.dev says)", async () => {
    const lcpAt = (time: number) => runWithMeasurement(lcp, { time, element: "img" });
    assert.deepEqual(await lcpAt(2500), { outcome: "passed", findings: 0 }, "2.5 s is good");
    assert.deepEqual(await lcpAt(2501), { outcome: "passed", findings: 1 }, "just over 2.5 s needs improvement");
    // Before this case, exactly 4.0 s gave both a finding and a failure.
    assert.deepEqual(await lcpAt(4000), { outcome: "passed", findings: 1 }, "4.0 s still needs improvement, not poor");
    assert.deepEqual(await lcpAt(4001), { outcome: "failed", findings: 0 }, "just over 4.0 s is poor");

    const cls = ALL[4];
    const clsAt = (value: number) => runWithMeasurement(cls, { value, sources: "main" });
    assert.deepEqual(await clsAt(0.1), { outcome: "passed", findings: 0 });
    assert.deepEqual(await clsAt(0.101), { outcome: "passed", findings: 1 });
    assert.deepEqual(await clsAt(0.25), { outcome: "passed", findings: 1 });
    assert.deepEqual(await clsAt(0.251), { outcome: "failed", findings: 0 });
});

test("performance checks: includeNavigation false drops only the navigation budget; path is used by every check", () => {
    const withoutNavigation = buildPerformanceChecks({ includeNavigation: false });
    assert.equal(withoutNavigation.length, 5);
    assert.ok(!withoutNavigation.some((t) => t.includes("finishes loading within")));
    for (const t of buildPerformanceChecks({ path: "/elements" })) assert.match(t, /page\.goto\('\/elements'/);
});
