/**
 * TFP-114 (Phase 34): asking for performance by name produced no performance
 * test on any target except DemoQA.
 *
 * The shared builder skipped its performance test whenever the description
 * named performance ("performance", "load time", "speed", "response time").
 * That was a stand-in for "the DemoQA builder already wrote one", since that
 * builder writes its own only when the description does. On every other
 * target nothing else writes one. The DemoQA builder now tells the shared
 * builder which areas it covered, so DemoQA still gets exactly one
 * performance test and every other target gets one too.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/generate/mock/performance-suite.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";

const { mockGenerate } = await import("./index.ts");
const { normalizeContentRules, normalizeTestAuditMode } = await import("../normalize.ts");

const TRIGGER_WORDS = ["performance", "load time", "speed", "response time"];
const GENERIC = "http://127.0.0.1:4410";
const DEMOQA = "https://demoqa.com";

// TFP-115: a performance suite is now Decision 2's four checks (navigation,
// LCP, page weight, failed requests), so "one suite" means four TFPL tests.
// Phase 38 TFP-149 added CLS and TBT: six.
const CHECKS = 6;

function performanceTests(baseUrl: string, description: string, practices: string[]): number {
    const code = mockGenerate(
        baseUrl,
        description,
        practices as never,
        null,
        normalizeContentRules(undefined),
        normalizeTestAuditMode(undefined)
    );
    const ids = code.match(/test\('TFPL-\d+/g) ?? [];
    assert.equal(new Set(ids).size, ids.length, "duplicate performance test ids");
    return ids.length;
}

for (const word of TRIGGER_WORDS) {
    test(`TFP-114: "${word}" with performance/load selected produces a performance test on a generic target`, () => {
        assert.equal(performanceTests(GENERIC, `Check the ${word} of the home page.`, ["performance/load"]), CHECKS);
    });

    test(`TFP-114: "${word}" alone (keyword-triggered) produces a performance test on a generic target`, () => {
        assert.equal(performanceTests(GENERIC, `Check the ${word} of the home page.`, []), CHECKS);
    });

    test(`TFP-114: "${word}" on DemoQA still produces exactly one performance suite, not two`, () => {
        assert.equal(performanceTests(DEMOQA, `Check the ${word} of the elements page.`, ["performance/load"]), CHECKS);
    });
}

test("TFP-114: performance selected without a trigger word - one suite on either target", () => {
    assert.equal(performanceTests(GENERIC, "Check the home page.", ["performance/load"]), CHECKS);
    assert.equal(performanceTests(DEMOQA, "Check the elements page.", ["performance/load"]), CHECKS);
});

test("TFP-114: performance is not added when it is neither selected nor triggered", () => {
    assert.equal(performanceTests(GENERIC, "Check the home page works.", []), 0);
    assert.equal(performanceTests(GENERIC, "Check the home page works.", ["functional"]), 0);
});
