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
