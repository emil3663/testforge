/**
 * Phase 34 (TFP-119): the generation record /api/run accepts from the client.
 * It is untrusted input, so only the known shape survives, capped.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/run/generation-record.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";

const { normalizeGenerationRecord } = await import("./generation-record.ts");

const GATE = { gate: "type check", bar: "0 type errors", measured: "1 type errors", verdict: "rejected", evidence: ["3:1 TS2339 toBeAccessible"] };

test("normalizeGenerationRecord: a real /api/generate record is kept as is", () => {
    const record = { generatedBy: "fallback", model: "testforge-qwen7b:latest", fallbackReason: "invalid_output", gapFill: { gapAreas: ["database"], outcome: "rejected" }, gates: [GATE] };
    assert.deepEqual(normalizeGenerationRecord(record), record);
});

test("normalizeGenerationRecord: nothing usable means null", () => {
    for (const input of [undefined, null, "x", 3, {}, { generatedBy: "" }, { gates: [GATE] }]) {
        assert.equal(normalizeGenerationRecord(input), null, JSON.stringify(input));
    }
});

test("normalizeGenerationRecord: unknown fields and malformed gates are dropped", () => {
    const record = normalizeGenerationRecord({
        generatedBy: "template",
        extra: "dropped",
        gates: [GATE, { gate: "x" }, { ...GATE, verdict: "maybe" }, "junk"],
    });
    assert.deepEqual(Object.keys(record!).sort(), ["gates", "generatedBy"]);
    assert.equal(record!.gates.length, 1);
});

test("normalizeGenerationRecord: long strings and long lists are capped", () => {
    const record = normalizeGenerationRecord({
        generatedBy: "x".repeat(1000),
        gates: Array.from({ length: 50 }, () => ({ ...GATE, evidence: Array.from({ length: 50 }, () => "e".repeat(5000)) })),
    });
    assert.equal(record!.generatedBy.length, 200);
    assert.equal(record!.gates.length, 10);
    assert.equal(record!.gates[0].evidence.length, 6);
    assert.equal(record!.gates[0].evidence[0].length, 400);
});

// --- Phase 34 TFP-122: automatic page inspection ------------------------------

const { describePageInspection } = await import("../report/page-inspection-text.ts");
const { describeSiteSuite } = await import("../report/site-suite-text.ts");

test("normalizeGenerationRecord: an automatic inspection record is kept, and capped", () => {
    const inspected = { status: "inspected", paths: ["/", "/notes"], pages: 2, warnings: [] };
    assert.deepEqual(normalizeGenerationRecord({ generatedBy: "template", gates: [], pageInspection: inspected })?.pageInspection, inspected);

    const failed = { status: "failed", paths: ["/"], pages: 0, warnings: ["Could not inspect http://x/: net::ERR_CONNECTION_REFUSED"], reason: "Could not inspect http://x/: net::ERR_CONNECTION_REFUSED" };
    assert.deepEqual(normalizeGenerationRecord({ generatedBy: "template", gates: [], pageInspection: failed })?.pageInspection, failed);

    const hostile = normalizeGenerationRecord({ generatedBy: "template", gates: [], pageInspection: { status: "inspected", paths: Array(150).fill("/p"), pages: 1e9, warnings: Array(50).fill("x".repeat(5000)), extra: 1 } })!.pageInspection!;
    // Phase 40 (TFP-172): a run inspects its selected pages, up to 100; it was the first 5.
    assert.equal(hostile.paths.length, 100);
    assert.equal(hostile.pages, 1000);
    assert.equal(hostile.warnings.length, 5);
    assert.ok(hostile.warnings.every((w) => w.length <= 400));
    assert.ok(!("extra" in hostile));

    assert.equal(normalizeGenerationRecord({ generatedBy: "template", gates: [], pageInspection: { status: "maybe" } })?.pageInspection, undefined);
});

test("describePageInspection: one sentence saying where the page data came from, or why there is none", () => {
    assert.equal(
        describePageInspection({ status: "inspected", paths: ["/", "/notes"], pages: 2, warnings: [] }),
        "No page data was supplied, so TestForge inspected /, /notes automatically (2 pages) and generated from it."
    );
    assert.equal(
        describePageInspection({ status: "inspected", paths: ["/", "/gone"], pages: 1, warnings: ["Could not inspect http://x/gone: 404"] }),
        "No page data was supplied, so TestForge inspected /, /gone automatically (1 page) and generated from it. Not inspected: Could not inspect http://x/gone: 404."
    );
    assert.equal(
        describePageInspection({ status: "failed", paths: ["/"], pages: 0, warnings: [], reason: "Could not inspect http://x/: net::ERR_CONNECTION_REFUSED at http://x/" }),
        "No page data was supplied and automatic inspection of / failed (Could not inspect http://x/: net::ERR_CONNECTION_REFUSED at http://x/), so the suite was generated without page data."
    );
});

/** Phase 42 (TFP-190). ISTQB technique: equivalence partitioning - a first run, a run that reused everything, a run with changes and a flagged edit. */
test("describeSiteSuite: what the run reused, generated, regenerated and retired, and the edits to check", () => {
    const base = { store: "C:/data/site-suites/x/standard", firstRun: false, reused: 0, generated: 0, regenerated: 0, retired: 0, edited: 0, changedTypes: [], newTypes: [], goneTypes: [], editedOnChangedPages: [] };
    assert.equal(describeSiteSuite({ ...base, firstRun: true, generated: 12 }), "Site suite: first run for this site and suite type, so all 12 tests were generated and saved in C:/data/site-suites/x/standard.");
    assert.equal(describeSiteSuite({ ...base, reused: 12 }), "Site suite: 12 tests reused, 0 generated, 0 regenerated, 0 retired (saved in C:/data/site-suites/x/standard).");
    assert.equal(
        describeSiteSuite({ ...base, reused: 8, regenerated: 3, retired: 2, edited: 1, changedTypes: ["/account/:slug"], goneTypes: ["/legal/privacy"], editedOnChangedPages: ["names the fields (/account/:slug changed)"] }),
        "Site suite: 8 tests reused, 0 generated, 3 regenerated (page types changed: /account/:slug), 2 retired (page types gone: /legal/privacy), 1 edited by hand and kept (saved in C:/data/site-suites/x/standard). Edited by hand, on a page that changed - check these: names the fields (/account/:slug changed)."
    );
});

/** Phase 42 (TFP-190). ISTQB technique: equivalence partitioning - a real record, and a stored one that isn't (boundary: no store). */
test("normalizeGenerationRecord: a site suite record is kept as is; a malformed one is cleaned or dropped", () => {
    const siteSuite = { store: "C:/data/site-suites/x/standard", firstRun: false, reused: 8, generated: 1, regenerated: 3, retired: 2, edited: 1, changedTypes: ["/a/:id"], newTypes: ["/b"], goneTypes: ["/c"], editedOnChangedPages: ["t (/a/:id changed)"] };
    assert.deepEqual(normalizeGenerationRecord({ generatedBy: "template", gates: [], siteSuite })?.siteSuite, siteSuite);
    assert.deepEqual(
        normalizeGenerationRecord({ generatedBy: "template", gates: [], siteSuite: { store: "s", reused: -1, generated: 2.5, retired: "3", changedTypes: ["/a", 4, ""], extra: 1 } })?.siteSuite,
        { store: "s", firstRun: false, reused: 0, generated: 0, regenerated: 0, retired: 0, edited: 0, changedTypes: ["/a"], newTypes: [], goneTypes: [], editedOnChangedPages: [] }
    );
    assert.equal(normalizeGenerationRecord({ generatedBy: "template", gates: [], siteSuite: { reused: 3 } })?.siteSuite, undefined);
});
