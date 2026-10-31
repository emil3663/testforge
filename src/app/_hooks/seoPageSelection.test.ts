/**
 * The SEO tab's page selection (TFP-266's ruling, 2026-10-31): the effect that kept the selection in step went in
 * 5a93ecc, and the derived selection had no test of its own.
 *
 * ISTQB technique: equivalence partitioning of the selection against the report's groups (none chosen; chosen and
 * there; chosen and gone; no groups), plus a state transition across reports. useRun.ts calls this function, and the
 * hook itself needs a DOM this repo's test runner doesn't have.
 *
 * Run via:
 * node --experimental-strip-types --test src/app/_hooks/seoPageSelection.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";
import { selectSeoPageGroup } from "./seoPageSelection.ts";

const home = { pageKey: "/" };
const about = { pageKey: "/about" };
const contact = { pageKey: "/contact" };

test("none chosen: the first group", () => {
    assert.equal(selectSeoPageGroup([home, about], null), home);
});

test("the chosen group, while it's in the report, wherever it sits", () => {
    assert.equal(selectSeoPageGroup([home, about, contact], "/about"), about);
    assert.equal(selectSeoPageGroup([home, about, contact], "/contact"), contact);
    assert.equal(selectSeoPageGroup([home, about, contact], "/"), home);
});

test("a chosen group that has vanished from the report: the first group", () => {
    assert.equal(selectSeoPageGroup([home, contact], "/about"), home);
});

test("no groups: nothing, chosen or not", () => {
    assert.equal(selectSeoPageGroup([], null), null);
    assert.equal(selectSeoPageGroup([], "/about"), null);
});

test("an empty chosen key is a key like any other: it matches only a group that has it", () => {
    assert.equal(selectSeoPageGroup([home, about], ""), home);
    const blank = { pageKey: "" };
    assert.equal(selectSeoPageGroup([home, blank], ""), blank);
});

test("across reports: a chosen page falls back while it's gone, and is selected again when a later report has it", () => {
    const chosen = "/about";
    assert.equal(selectSeoPageGroup([home, about], chosen), about);
    assert.equal(selectSeoPageGroup([home, contact], chosen), home);
    assert.equal(selectSeoPageGroup([contact, about], chosen), about);
});

test("the group handed back keeps its other fields", () => {
    const group = { pageKey: "/about", pageLabel: "About", passed: 3 };
    assert.deepEqual(selectSeoPageGroup([home, group], "/about"), { pageKey: "/about", pageLabel: "About", passed: 3 });
});
