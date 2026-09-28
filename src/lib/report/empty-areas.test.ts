/**
 * Phase 34 (TFP-119, Decisions 7 and 8): areas in scope that end up with no
 * test say why, and the generation record is carried into the report.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/report/empty-areas.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";
import type { ExecutionRecord, GenerationRecord, JsonReport } from "./types.ts";

const { computeEmptyAreas, templateNotesFor } = await import("./empty-areas.ts");
const { buildReport } = await import("./report.ts");
const { buildReportHtmlDocument } = await import("./html.ts");
const { mockGenerate } = await import("../generate/mock/index.ts");
const { normalizeContentRules, normalizeTestAuditMode } = await import("../generate/normalize.ts");

// The real template suite for database with no page data: a note, no test.
const SUITE = mockGenerate(
    "http://127.0.0.1:4410",
    "Check the notes page.",
    ["functional", "database", "reliability"] as never,
    null,
    normalizeContentRules(undefined),
    normalizeTestAuditMode("fast")
);

function record(area: string): ExecutionRecord {
    return { id: "x", title: "t", description: "", suite: "s", area, interactionType: null, browser: "chromium", status: "Passed", duration: 1, remarks: "", rawMessage: "", reproductionSteps: [], artifacts: [], order: 0 };
}

test("templateNotesFor: reads the template's own note for an area back out of the suite that ran", () => {
    assert.deepEqual(templateNotesFor("database", SUITE), [
        "Database: no page inspection data, so no form was found to test a persistence round trip against. Run introspection first.",
    ]);
    assert.equal(templateNotesFor("security", SUITE), null, "no security block in this suite");
    assert.equal(templateNotesFor("database", null), null);
});

test("computeEmptyAreas: areas with a test are left out; empty ones say why, template side first", () => {
    const empty = computeEmptyAreas(["functional", "database", "reliability"], [record("Functional")], SUITE, null);
    assert.deepEqual(empty.map((e) => e.area), ["Database", "Reliability"]);
    assert.match(empty[0].reasons[0], /^Database: no page inspection data/);
    assert.match(empty[0].reasons[1], /no local model result was recorded .* TESTFORGE_OLLAMA_MODEL/);
    assert.match(empty[1].reasons.at(-1)!, /reliability is never sent to the local model/);
});

test("computeEmptyAreas: the local-model outcome from generation is named - timeout, rejection, asked-but-empty", () => {
    const base: GenerationRecord = { generatedBy: "fallback", gates: [], gapFill: { gapAreas: ["database"], outcome: "rejected" } };
    const reason = (generation: GenerationRecord) => computeEmptyAreas(["database"], [], SUITE, generation)[0].reasons.at(-1);
    assert.equal(reason({ ...base, fallbackReason: "timeout" }), "the local model did not answer within its time budget");
    assert.match(reason({ ...base, fallbackReason: "invalid_output" })!, /rejected: they do not type-check/);
    assert.match(reason({ ...base, fallbackReason: "something_new" })!, /rejected \(something_new\)/);
    assert.equal(
        reason({ ...base, generatedBy: "template+ollama", gapFill: { gapAreas: ["database"], outcome: "added" } }),
        "the local model was asked for this area but wrote no test for it"
    );
});

test("computeEmptyAreas: an area with no block at all in the suite still says the template wrote nothing", () => {
    const [entry] = computeEmptyAreas(["security"], [], "import { test } from '@playwright/test';", { generatedBy: "template", gates: [] });
    assert.deepEqual(entry.reasons, ["the template generator wrote no test for this area on this target"]);
});

test("buildReport carries the generation record and the empty areas, and the HTML export shows both", () => {
    const json: JsonReport = {
        suites: [
            {
                title: "s.spec.ts",
                specs: [],
                suites: [
                    {
                        title: "Functional Coverage",
                        specs: [{ id: "a", title: "TFFU-001: loads", tests: [{ projectName: "chromium", status: "expected", results: [{ duration: 1, retry: 0, errors: [] }] }] }],
                    },
                ],
            },
        ],
        errors: [],
        stats: { duration: 1, expected: 1, unexpected: 0, flaky: 0, skipped: 0 },
    };
    const generation: GenerationRecord = {
        generatedBy: "fallback",
        model: "testforge-qwen7b:latest",
        fallbackReason: "invalid_output",
        gapFill: { gapAreas: ["database"], outcome: "rejected" },
        gates: [{ gate: "type check", bar: "0 type errors", measured: "1 type errors", verdict: "rejected", evidence: ["5:30 TS2339 Property toBeAccessible does not exist"] }],
    };
    const report = buildReport(json, ["functional", "database"], "", "http://127.0.0.1:4410", null, SUITE, generation, "Check the notes page.");
    assert.deepEqual(report.generation, generation);
    assert.deepEqual(report.emptyAreas!.map((e) => e.area), ["Database"]);
    assert.match(report.emptyAreas![0].reasons.at(-1)!, /do not type-check/);

    const html = buildReportHtmlDocument(report, "run-1");
    assert.match(html, /Areas with no tests/);
    assert.match(html, /How this suite was generated/);
    assert.match(html, /0 type errors<\/td><td>1 type errors<\/td><td>rejected/);
    assert.match(html, /Property toBeAccessible does not exist/);
});

test("TFP-122: the HTML export says the page data was gathered automatically, or why it could not be", () => {
    const json: JsonReport = { suites: [], errors: [], stats: { duration: 0, expected: 0, unexpected: 0, flaky: 0, skipped: 0 } };
    const withInspection = (pageInspection: GenerationRecord["pageInspection"]) =>
        buildReportHtmlDocument(buildReport(json, [], "", "http://x", null, "", { generatedBy: "template", gates: [], pageInspection }, "d"), "r");
    assert.match(withInspection({ status: "inspected", paths: ["/notes"], pages: 1, warnings: [] }), /TestForge inspected \/notes automatically \(1 page\)/);
    assert.match(withInspection({ status: "failed", paths: ["/"], pages: 0, warnings: [], reason: "Could not inspect http://x/: refused" }), /automatic inspection of \/ failed \(Could not inspect http:\/\/x\/: refused\)/);
    assert.doesNotMatch(withInspection(undefined), /No page data was supplied/);
});

test("buildReport without a generation record: no generation section, and older callers still work", () => {
    const json: JsonReport = { suites: [], errors: [], stats: { duration: 0, expected: 0, unexpected: 0, flaky: 0, skipped: 0 } };
    const report = buildReport(json, [], "");
    assert.equal(report.generation, null);
    assert.doesNotMatch(buildReportHtmlDocument(report, "r"), /How this suite was generated/);
});
