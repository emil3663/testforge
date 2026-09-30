/**
 * Phase 36 Gate A follow-up: no two tests in one generated file share an ID.
 * Suites of the same area are numbered continuously; before, each suite began
 * at 001, so the landing-page and per-page SEO suites both had a TFSE-001.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/generate/mock/test-ids.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";

const { mockGenerate, BEST_PRACTICE_OPTIONS } = await import("./index.ts");
const { normalizeContentRules, normalizeTestAuditMode } = await import("../normalize.ts");

const page = (path: string) => ({ path, url: `http://x.test${path}`, title: "T", metaDescription: "", headings: [], buttons: [], links: [], actionableElements: [], visibleTextSnippets: [] });
const PROFILE = { pages: [page("/"), page("/about")] };

function testIds(code: string) {
    return [...code.matchAll(/test\(['"](TF[A-Z]{2}-\d{3}): /g)].map((m) => m[1]);
}

test("every test in a generated file has its own ID, numbered on across same-area suites", () => {
    for (const mode of ["fast", "deep"]) {
        const code = mockGenerate("http://x.test", "Check the home page works.", [...BEST_PRACTICE_OPTIONS], PROFILE as never, normalizeContentRules(undefined), normalizeTestAuditMode(mode));
        const ids = testIds(code);
        assert.ok(ids.length > 0, mode);
        assert.deepEqual(ids.filter((id, i) => ids.indexOf(id) !== i), [], `${mode}: duplicate IDs`);

        const seo = ids.filter((id) => id.startsWith("TFSE-"));
        assert.ok(code.split("test.describe(").length - 1 > new Set(ids.map((id) => id.slice(0, 4))).size, `${mode}: precondition: some area has more than one suite`);
        assert.deepEqual(seo, seo.map((_, i) => `TFSE-${String(i + 1).padStart(3, "0")}`), `${mode}: SEO IDs run 001, 002, ... across both SEO suites`);
    }
});
