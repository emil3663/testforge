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

test("performance checks: four checks, the generated suite compiles and awaits every web-first assertion", () => {
    assert.equal(ALL.length, 4);
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

test("performance checks: includeNavigation false drops only the navigation budget; path is used by every check", () => {
    const withoutNavigation = buildPerformanceChecks({ includeNavigation: false });
    assert.equal(withoutNavigation.length, 3);
    assert.ok(!withoutNavigation.some((t) => t.includes("finishes loading within")));
    for (const t of buildPerformanceChecks({ path: "/elements" })) assert.match(t, /page\.goto\('\/elements'/);
});
