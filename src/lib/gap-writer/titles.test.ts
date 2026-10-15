/**
 * TFP-197 (found in its run on the with-bugs Toolshop): two elements the coverage map names alike on one page
 * ("3 [input]" twice) gave two gap tests one title, and Playwright refused the whole file, so the run had no
 * tests. No browser: the titles are read from the composed code.
 *
 * ISTQB technique: equivalence partitioning. Classes: a name unique on its page (title unchanged); a name
 * repeated on its page (each gets a short suffix from its key, stable across calls, different from the other's);
 * the same name on another page (not a repeat); and a promoted entry bound to both repeated elements.
 * Gate: Phase 42 Gate B (TFP-197).
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/gap-writer/titles.test.ts
 */
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import type { CoverageMapEntry } from "../report/types.ts";
import type { ContentProfile } from "../generate/mock/types.ts";

const { targetOf } = await import("./write.ts");
const { composeGapTest, gapTestTitle } = await import("./gap-run.ts");
const { bindPromotedEntries } = await import("../library/promoted.ts");
const { candidateId, patternOf } = await import("../candidates/pool.ts");
const { parseTestUnits } = await import("../site-suites/units.ts");
const { normalizeContentProfile } = await import("../generate/normalize.ts");
const { getActionableElementDisplayName } = await import("../generate/mock/locators.ts");

const entry = (page: string, name: string, id: string): CoverageMapEntry => ({ key: `${page} element page.locator('#${id}')`, page, pages: [page], kind: "element", name, tests: [] });

test("a name repeated on its page gets a short, stable suffix; a unique one, or one on another page, is unchanged (TFP-197)", () => {
    const all = [entry("/#/", "3 [input]", "a"), entry("/#/", "3 [input]", "b"), entry("/#/", "Search [input]", "c"), entry("/#/contact", "3 [input]", "d")];
    const titles = all.map((item) => gapTestTitle(targetOf(item, all)));
    assert.match(titles[0], /^gap test: 3 \[input\] #[0-9a-f]{6} on \/#\/$/);
    assert.match(titles[1], /^gap test: 3 \[input\] #[0-9a-f]{6} on \/#\/$/);
    assert.notEqual(titles[0], titles[1], "the two repeats are told apart");
    assert.equal(titles[2], "gap test: Search [input] on /#/", "a unique name keeps its title");
    assert.equal(titles[3], "gap test: 3 [input] on /#/contact", "the same name on another page isn't a repeat");
    assert.deepEqual(all.map((item) => gapTestTitle(targetOf(item, all))), titles, "the same on every call, so a saved test keeps its key");
    // The prompt still names the element as the page does.
    assert.equal(targetOf(all[0], all).name, "3 [input]");
    // Composed, they are distinct tests.
    const code = `test.describe('Gap tests', () => {\n${all.map((item) => composeGapTest(targetOf(item, all), "await page.goto('/');")).join("\n\n")}\n});`;
    assert.equal(new Set(parseTestUnits(code).map((unit) => unit.title)).size, all.length);
});

test("a promoted entry bound to two elements a page names alike gives two titles (TFP-197)", () => {
    const profile = normalizeContentProfile(JSON.parse(readFileSync(join(process.cwd(), "benchmarks/2026-10-14-tfp193-library/fixture-profile.json"), "utf8"))) as ContentProfile;
    const page = profile.pages.find((item) => item.path === "/store")!;
    const slider = page.actionableElements!.find((element) => element.locator.id === "price-min")!;
    // A second slider the page names exactly as the first, found by another id.
    page.actionableElements!.push({ ...slider, locator: { ...slider.locator, id: "price-min-2" } });
    const name = `${getActionableElementDisplayName(slider)} [input]`;
    const pattern = patternOf("element", name);
    const promoted = { id: candidateId(pattern), pattern, body: "await page.goto('__PAGE__');\nawait expect(__LOCATOR__).toBeAttached();", gate: "read-only" as const, technique: "error guessing", writer: "claude-code", sources: [], evidence: [], approved: { by: "Emil", at: "t" }, caught: [] };
    const { code, bound } = bindPromotedEntries("", profile, [promoted]);
    const onStore = bound.filter((item) => item.page === "/store");
    assert.equal(onStore.length, 2, JSON.stringify(bound));
    const titles = parseTestUnits(code).filter((unit) => unit.title.includes(" on /store")).map((unit) => unit.title);
    assert.equal(new Set(titles).size, 2, titles.join(" | "));
});
