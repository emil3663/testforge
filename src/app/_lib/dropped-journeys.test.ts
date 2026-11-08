/**
 * TFP-271: reading the generate response's dropped journeys, and naming them as the review screen does.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/app/_lib/dropped-journeys.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";
import { droppedJourneysHeading, journeyName, readDroppedJourneys } from "./dropped-journeys.ts";

test("only entries with an id and a reason are read; a response without the field gives none", () => {
    const entry = { id: "automatic||/a > /b", reason: "its steps don't match its path" };
    assert.deepStrictEqual(readDroppedJourneys({ droppedJourneys: [entry, { id: 7 }, null, "x"] }), [entry]);
    assert.deepStrictEqual(readDroppedJourneys({ code: "..." }), []);
    assert.deepStrictEqual(readDroppedJourneys({ droppedJourneys: "nope" }), []);
    assert.deepStrictEqual(readDroppedJourneys(null), []);
});

test("a journey is named by its pages, after its label for a named flow; an id of another shape as it is", () => {
    assert.equal(journeyName("automatic||/ > /login > /authenticate"), "/ > /login > /authenticate");
    assert.equal(journeyName("named|sign in|/login > /secure"), "sign in: /login > /secure");
    assert.equal(journeyName("forged"), "forged");
});

test("the heading counts them in plain words", () => {
    assert.equal(droppedJourneysHeading(1), "1 selected journey got no test:");
    assert.equal(droppedJourneysHeading(3), "3 selected journeys got no test:");
});
