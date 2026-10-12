/**
 * Phase 38 TFP-146 (Decisions 1, 3 and 6): every generated test declares one
 * of three gates in a `gate` annotation, its skip matches its gate, and the
 * report reads the gate and counts the tests each gate kept from running.
 *
 * ISTQB technique: equivalence partitioning. Each generation path is one
 * partition (the template on the 166 fixed inputs, journeys, Comprehensive
 * security and accessibility, the local model's gap-fill and Comprehensive
 * blocks, OpenAI), and each gate is one partition of the skip rule.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/run/test-gates.test.ts
 */
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import type { ComprehensiveRunMode } from "../comprehensive/run-mode.ts";
import type { JsonSuite } from "../report/types.ts";
import type { BestPracticeArea } from "../generate/mock/types.ts";

const { ACTIVE_GATE_SKIP, withDefaultGate } = await import("./test-gates.ts");
const { mockGenerate } = await import("../generate/mock/index.ts");
const { normalizeContentRules, normalizeTestAuditMode } = await import("../generate/normalize.ts");
const { buildComprehensiveSuite, mergeComprehensiveScenarios } = await import("../generate/comprehensive.ts");
const { gateOpenAiSuite, mergeLocalSuite, openAiGate } = await import("../generate/gap-fill.ts");
const { normalizeRunMode } = await import("../comprehensive/run-mode.ts");
const { findTypeErrors } = await import("../generate/validate.ts");
const { flattenSuites } = await import("../report/execution.ts");
const { buildSummary, formatNotRunByGate } = await import("../report/summary.ts");
const { buildInputs, CONTENT_PROFILE_PATH } = await import("../../../scripts/template-unchanged/inputs.mjs");

const profile = JSON.parse(readFileSync(join(process.cwd(), CONTENT_PROFILE_PATH), "utf8"));
const GATE = /\{ type: 'gate', description: '(read-only|interactive|active)' \}/g;
const INTERACTIVE_SKIP = "test.skip(process.env.TESTFORGE_INTERACTIVE !== '1', ";

/** Each test(...) in a suite, from its call to the next test's (or the end). */
function testsIn(code: string) {
    return code.split(/\n(?=[ \t]*test\(')/).slice(1).map((block) => block.split(/\n(?=\s*test\.describe\(|\}\);\s*$)/)[0]);
}

function gatesOf(line: string) {
    return [...line.matchAll(GATE)].map((match) => match[1]);
}

/** Every test call carries exactly one gate, and its skip is the one its gate needs. */
function assertGated(code: string, label: string) {
    const tests = testsIn(code);
    assert.ok(tests.length > 0, `${label}: no tests`);
    const counts: Record<string, number> = {};
    for (const source of tests) {
        const head = source.split("\n")[0];
        const gates = gatesOf(head);
        assert.equal(gates.length, 1, `${label}: ${head}`);
        counts[gates[0]] = (counts[gates[0]] ?? 0) + 1;
        const body = source.split("\n").slice(1, 3).join("\n");
        if (gates[0] === "interactive") assert.ok(body.includes(INTERACTIVE_SKIP), `${label}: an interactive test without the interactive skip: ${head}`);
        if (gates[0] === "active") assert.ok(body.includes(ACTIVE_GATE_SKIP), `${label}: an active test without the active skip: ${head}`);
        if (gates[0] === "read-only") assert.ok(!source.includes(INTERACTIVE_SKIP) && !source.includes(ACTIVE_GATE_SKIP), `${label}: a read-only test with a gate skip: ${head}`);
    }
    return counts;
}

test("withDefaultGate: a test with no details gets read-only; a declared one, and an escaped quote in the title, are kept", () => {
    assert.equal(withDefaultGate("  test('a', async ({ page }) => {"), "  test('a', { annotation: { type: 'gate', description: 'read-only' } }, async ({ page }) => {");
    assert.equal(withDefaultGate("  test('it\\'s, async', async ({ page }) => {"), "  test('it\\'s, async', { annotation: { type: 'gate', description: 'read-only' } }, async ({ page }) => {");
    const declared = "  test('a', { annotation: { type: 'gate', description: 'interactive' } }, async ({ page }) => {";
    assert.equal(withDefaultGate(declared), declared);
    assert.equal(withDefaultGate("  test.describe('a', () => {"), "  test.describe('a', () => {");
});

test("the template: on the 166 fixed inputs every test declares exactly one gate, and its skip matches it", () => {
    const totals: Record<string, number> = {};
    let inputsWithTests = 0;
    for (const input of buildInputs()) {
        const code = mockGenerate(input.baseUrl, input.description, input.practices as BestPracticeArea[], input.pageData ? profile : null, normalizeContentRules(undefined), normalizeTestAuditMode(input.mode));
        if (!/\n\s*test\('/.test(code)) continue;
        inputsWithTests++;
        for (const [gate, count] of Object.entries(assertGated(code, input.key))) totals[gate] = (totals[gate] ?? 0) + count;
    }
    // The 12 inputs left are database or reliability without page data: no tests.
    assert.equal(inputsWithTests, 154);
    // Read-only everywhere but the database round trip (interactive) and the
    // script payload (active), each on the two page-data inputs that have them.
    // TFP-147: 860 before; the security suite's 2 own checks became the 4
    // shared passive checks per inspected page plus the probe: +3 on each of
    // the 12 security inputs without page data (/ only), +11 on each of the 2
    // with it (3 pages), 860 + 36 + 22 = 918. TFP-148: the axe scan on every
    // inspected page of the 46 inputs with accessibility: +1 on each of the 42
    // without page data, +3 on each of the 4 with it, 918 + 42 + 12 = 972.
    // TFP-149: CLS and TBT on each of the 56 inputs with performance, 972 + 112 = 1084.
    // TFP-182: the link-destination check on each of the 4 inputs with page data and the functional area, 1084 + 4 = 1088.
    // TFP-183: tab order and grouping, 2 per inspected page on the 46 inputs with accessibility (42 x 1 page, 4 x 3), 1088 + 108 = 1196.
    // TFP-186: three layout checks per inspected page on the 32 inputs with usability, and the across-pages check on the 4 with page data (28 x 3 + 4 x 10), 1196 + 124 = 1320.
    assert.deepEqual(totals, { "read-only": 1320, interactive: 2, active: 2 });
});

test("the template with every journey selected: journeys are interactive, with the interactive skip", () => {
    const rules = normalizeContentRules({ selectedJourneyIds: profile.journeys.map((journey: { id: string }) => journey.id) });
    const code = mockGenerate("http://127.0.0.1:4410", "Check the site.", ["functional", "security", "database"], profile, rules, normalizeTestAuditMode("fast"));
    const counts = assertGated(code, "journeys");
    assert.equal(counts.interactive, 10 + 1, "10 journeys and the database round trip");
    assert.equal(counts.active, 1, "the script payload");
    assert.deepEqual(findTypeErrors(code), []);
});

test("Comprehensive: every passive security check and accessibility check is read-only, beside its page annotation", () => {
    for (const area of ["security", "accessibility"]) {
        const mode = normalizeRunMode({ kind: "comprehensive", area }) as ComprehensiveRunMode;
        const code = buildComprehensiveSuite("https://site.test", mode, { covered: ["/", "/login"], notCovered: [], pageCap: 20 });
        const tests = testsIn(code);
        assert.ok(tests.length > 0);
        for (const source of tests) {
            const head = source.split("\n")[0];
            assert.deepEqual(gatesOf(head), ["read-only"], `${area}: ${head}`);
            assert.match(head, /\[\{ type: 'page', description: '[^']*' \}, \{ type: 'gate', description: 'read-only' \}/);
        }
        assert.deepEqual(findTypeErrors(code), []);
    }
});

const MODEL_SUITE = "import { test, expect } from '@playwright/test';\ntest.describe('Database', () => {\n  test('x', async ({ page }) => { await page.goto('/'); await expect(page.locator('body')).toBeVisible(); });\n});";

test("model-written blocks: the describe declares the gate once - interactive for gap-fill, OpenAI and Comprehensive accessibility, active for Comprehensive security and for OpenAI when security is in scope", () => {
    const describeGates = (code: string) => [...code.matchAll(/test\.describe\('[^']*', (\{ annotation: [^\n]*\}), \(\) => \{/g)].flatMap((match) => gatesOf(match[1]));
    const template = "import { test, expect } from '@playwright/test';\n";
    const gapFill = mergeLocalSuite(template, MODEL_SUITE, "m", ["database"]);
    assert.deepEqual(describeGates(gapFill), ["interactive"]);
    assert.match(gapFill, /'interactive' \} \}, \(\) => \{\n    test\.skip\(process\.env\.TESTFORGE_INTERACTIVE !== '1', /);

    const openAi = gateOpenAiSuite(MODEL_SUITE, "gpt-x");
    assert.deepEqual(describeGates(openAi), ["interactive"]);
    const openAiSecurity = gateOpenAiSuite(MODEL_SUITE, "gpt-x", openAiGate(["functional", "security"]));
    assert.deepEqual(describeGates(openAiSecurity), ["active"]);
    assert.ok(openAiSecurity.includes(`() => {
    ${ACTIVE_GATE_SKIP}`), openAiSecurity);
    assert.doesNotMatch(openAiSecurity, /TESTFORGE_INTERACTIVE/);
    assert.deepEqual(findTypeErrors(openAiSecurity), []);
    assert.equal(openAiGate(["functional", "accessibility"]), "interactive");
    assert.match(openAi, /^import \{ test, expect \} from '@playwright\/test';\n\n/);
    assert.deepEqual(findTypeErrors(openAi), []);

    for (const [area, gate, skip] of [["accessibility", "interactive", INTERACTIVE_SKIP], ["security", "active", ACTIVE_GATE_SKIP]]) {
        const mode = normalizeRunMode({ kind: "comprehensive", area }) as ComprehensiveRunMode;
        const merged = mergeComprehensiveScenarios(buildComprehensiveSuite("https://site.test", mode, { covered: ["/"], notCovered: [], pageCap: 20 }), MODEL_SUITE, "m", mode);
        const block = merged.slice(merged.indexOf("test.describe('Local model (m)'"));
        assert.deepEqual(describeGates(block), [gate], area);
        assert.ok(block.split("\n")[1].includes(skip), `${area}: ${block.split("\n")[1]}`);
        assert.deepEqual(findTypeErrors(merged), [], area);
    }
});

test("gateOpenAiSuite: a multi-line import stays at the top, outside the describe", () => {
    const code = "import {\n  test,\n  expect,\n} from '@playwright/test';\nimport type { Page } from '@playwright/test';\n\nasync function open(page: Page) { await page.goto('/'); }\ntest('y', async ({ page }) => { await open(page); await expect(page).toHaveURL(/\\//); });";
    const gated = gateOpenAiSuite(code, "gpt-x");
    assert.ok(gated.startsWith("import {\n  test,\n  expect,\n} from '@playwright/test';\nimport type { Page } from '@playwright/test';\n\n"), gated);
    assert.match(gated, /\n {4}async function open/);
    assert.deepEqual(findTypeErrors(gated), []);
});

function suite(annotations: Array<{ type: string; description?: string }>, status: "expected" | "skipped" = "skipped", title = "t"): JsonSuite {
    return { title: "Functional Coverage", specs: [{ id: title, title, tests: [{ projectName: "chromium", status, annotations, results: [{ duration: 1, retry: 0, errors: [] }] }] }] };
}

test("the report: each record carries its declared gate, and the summary counts only tests whose gate was closed for the run", () => {
    const records = flattenSuites([
        suite([{ type: "gate", description: "interactive" }, { type: "skip", description: "interactive journey test: ..." }], "skipped", "a"),
        suite([{ type: "gate", description: "interactive" }, { type: "skip", description: "database round trip: ..." }], "skipped", "b"),
        suite([{ type: "gate", description: "active" }, { type: "skip", description: "attack-shaped input: needs the ownership confirmation, not built yet" }], "skipped", "c"),
        suite([{ type: "gate", description: "read-only" }, { type: "skip", description: "no session cookie on the landing page" }], "skipped", "d"),
        suite([{ type: "gate", description: "read-only" }], "expected", "e"),
        suite([{ type: "gate", description: "nonsense" }], "expected", "f"),
    ]);
    assert.deepEqual(records.map((record) => [record.title, record.status, record.gate]), [
        ["a", "Not run", "interactive"], ["b", "Not run", "interactive"], ["c", "Not run", "active"], ["d", "Not run", "read-only"], ["e", "Passed", "read-only"], ["f", "Passed", undefined],
    ]);
    // Decision table: interactive off closes interactive and active; on, only
    // active. Read-only never closes, so test d (a cookie check that skipped
    // for its own reason) is never counted.
    const off = buildSummary(records, [], 0);
    assert.deepEqual(off.notRunByGate, { "read-only": 0, interactive: 2, active: 1 });
    assert.equal(formatNotRunByGate(off), "Not run because their gate was closed: interactive 2, active 1");
    const on = buildSummary(records, [], 0, true);
    assert.deepEqual(on.notRunByGate, { "read-only": 0, interactive: 0, active: 1 });
    assert.equal(formatNotRunByGate(on), "Not run because their gate was closed: active 1");
    const none = buildSummary(records.filter((record) => record.gate !== "active"), [], 0, true);
    assert.equal(formatNotRunByGate(none), "", "no line when no gate kept a test from running");
});

test("the report: a run whose tests declare no gate (before TFP-146) shows no per-gate counts", () => {
    const summary = buildSummary(flattenSuites([suite([{ type: "skip", description: "why" }])]), [], 0);
    assert.equal(summary.notRunByGate, undefined);
    assert.equal(formatNotRunByGate(summary), "");
});
