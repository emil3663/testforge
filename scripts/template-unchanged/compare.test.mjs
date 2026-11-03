/**
 * Phase 35 (TFP-137, Acceptance Criterion 6): the template-unchanged check's
 * comparison, its export checks, and its fixed input list.
 *
 * Run via:
 * node --test scripts/template-unchanged/compare.test.mjs
 */
import assert from "node:assert";
import { test } from "node:test";
import { CheckError, compareOutputs, formatResult, MOCK_GENERATE_ARITY, requireArity, requireExports } from "./compare.mjs";
import { AREAS, buildAllInputs, buildInputs } from "./inputs.mjs";

test("identical outputs pass", () => {
    const outputs = { a: "line 1\nline 2", b: "x" };
    const result = compareOutputs(outputs, { ...outputs });
    assert.deepEqual(result, { inputs: 2, identical: 2, different: [] });
    assert.equal(formatResult(result, "aaa", "bbb"), "template-unchanged: aaa -> bbb: 2 inputs, 2 identical, 0 different");
});

test("a single changed character in one input is reported with that input's key and its first differing line", () => {
    const base = { "page-data | x | fast | Check. | seo/content": "one\ntwo\nthree", other: "same" };
    const head = { "page-data | x | fast | Check. | seo/content": "one\ntwO\nthree", other: "same" };
    const result = compareOutputs(base, head);
    assert.deepEqual(result, { inputs: 2, identical: 1, different: [{ key: "page-data | x | fast | Check. | seo/content", line: 2, base: "two", head: "twO" }] });
    assert.match(formatResult(result, "a", "b"), /1 identical, 1 different\n {2}page-data \| x \| fast \| Check\. \| seo\/content\n {4}line 2\n {4}base: two\n {4}head: twO/);
});

test("an extra line at the end is a difference too", () => {
    assert.deepEqual(compareOutputs({ k: "a" }, { k: "a\n" }).different, [{ key: "k", line: 2, base: "(no line)", head: "" }]);
});

test("the two sides must have run the same inputs", () => {
    assert.throws(() => compareOutputs({ a: "1" }, { b: "1" }), CheckError);
    assert.throws(() => compareOutputs({ a: "1" }, { a: "1", b: "2" }), CheckError);
});

test("a missing export stops with its name; a changed mockGenerate signature stops too", () => {
    assert.throws(() => requireExports("src/lib/generate/normalize.ts", { normalizeContentRules() {} }, ["normalizeContentRules", "normalizeTestAuditMode"]), {
        name: "Error",
        message: "src/lib/generate/normalize.ts does not export normalizeTestAuditMode",
    });
    assert.doesNotThrow(() => requireExports("m", { mockGenerate() {} }, ["mockGenerate"]));
    assert.throws(() => requireArity("mockGenerate", (a, b, c) => [a, b, c], MOCK_GENERATE_ARITY), /mockGenerate takes 3 parameters, not the 6/);
});

test("the input list is the 166 (144 without page data, 22 with it), then TFP-258's 6; each key unique", () => {
    const all = buildAllInputs();
    assert.equal(all.length, 172);
    // buildInputs is still the 166 alone, as the tests and benchmark scripts that loop over it expect.
    assert.deepEqual(buildInputs(), all.slice(0, 166));
    assert.equal(new Set(all.map((input) => input.key)).size, 172);
    // TFP-258's come after the 166, which keep their order and keys.
    assert.deepEqual(all.slice(166).map((input) => input.key), [
        "page-data | http://127.0.0.1:4410 | fast | Check the site. | functional | journeys selected",
        "page-data | http://127.0.0.1:4410 | fast | Check the site. | functional | a hash-route link",
        "page-data | http://127.0.0.1:4410 | deep | Check the site. | functional | journeys selected",
        "page-data | http://127.0.0.1:4410 | deep | Check the site. | functional | a hash-route link",
        "comprehensive | page-data | http://127.0.0.1:4410 | security",
        "comprehensive | page-data | http://127.0.0.1:4410 | accessibility",
    ]);
    const inputs = all.slice(0, 166);
    assert.ok(inputs.every((input) => !input.variant && !input.comprehensive));
    assert.equal(inputs.filter((input) => !input.pageData).length, 144);
    assert.equal(inputs.filter((input) => input.pageData).length, 22);
    assert.equal(AREAS.length, 10);
    const perTargetAndMode = inputs.filter((input) => !input.pageData && input.baseUrl === "https://demoqa.com" && input.mode === "deep");
    assert.equal(perTargetAndMode.length, 24);
    assert.equal(perTargetAndMode.filter((input) => input.description === "Check the home page.").length, 11);
    assert.deepEqual(
        perTargetAndMode.filter((input) => input.description === "Check the load time of the home page.").map((input) => input.practices),
        [["performance/load"], [], ["functional"]]
    );
    assert.ok(inputs.filter((input) => input.pageData).every((input) => input.baseUrl === "http://127.0.0.1:4410" && input.description === "Check the site."));
});
