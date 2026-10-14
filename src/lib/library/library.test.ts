/**
 * Phase 42 (TFP-193, Decision 2): the library - Phase 41's checks as
 * pattern entries. No browser: the patterns read recorded page data
 * (benchmarks/2026-10-14-tfp193-library/fixture-profile.json, the comparison
 * fixture inspected once).
 *
 * ISTQB technique: decision table for applying an entry - whether a page has
 * the entry's pattern (a sort list; a list; a checkbox or range field; a
 * number field; none) against whether the generator binds the check to that
 * page - plus equivalence partitioning over bindings (page, site, a site
 * entry needing two pages). And each entry's record: technique, gate, and
 * the benchmark bugs it caught, checked against the answer key and Phase
 * 41's Gate B. Gate: Phase 42 batch 2.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/library/library.test.ts
 */
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import type { ContentProfile, ContentProfilePage } from "../generate/mock/types.ts";

const { LIBRARY, boundPaths, entryApplies, libraryEntry } = await import("./entries.ts");
const { mockGenerate } = await import("../generate/mock/index.ts");
const { normalizeContentProfile, normalizeContentRules, normalizeTestAuditMode } = await import("../generate/normalize.ts");
const { parseTestUnits } = await import("../site-suites/units.ts");

const raw = JSON.parse(readFileSync(join(process.cwd(), "benchmarks/2026-10-14-tfp193-library/fixture-profile.json"), "utf8"));
const profile = normalizeContentProfile(raw) as ContentProfile;
const page = (path: string) => profile.pages.find((candidate) => candidate.path === path) as ContentProfilePage;

test("every entry records its pattern, technique, gate, where it runs and the bugs it caught", () => {
    const answerKey = readFileSync(join(process.cwd(), "benchmarks/2026-10-06-toolshop-known-bugs/answer-key.md"), "utf8");
    assert.equal(new Set(LIBRARY.map((entry) => entry.id)).size, LIBRARY.length, "ids are unique");
    for (const entry of LIBRARY) {
        for (const field of ["title", "ticket", "pattern", "technique", "builder"] as const) assert.ok(entry[field].trim(), `${entry.id}: ${field}`);
        assert.equal(entry.gate, "read-only", entry.id);
        assert.ok(entry.runsIn.length > 0, entry.id);
        for (const bug of entry.caught.bugs) assert.match(answerKey, new RegExp(`^\\| ${bug} \\|`, "m"), `${entry.id}: bug ${bug} is in the answer key`);
    }
    // Phase 41's Gate B (TFP-188's keep-rule table): every bug a Phase 41 check found, and no other.
    const caught = new Set(LIBRARY.flatMap((entry) => entry.caught.bugs));
    assert.deepEqual([...caught].sort((a, b) => a - b), [2, 4, 19, 26, 27, 29, 31, 33, 34, 40, 42, 45, 53, 58, 59, 60, 62, 63, 66, 67, 75, 80, 82, 94]);
    assert.deepEqual(libraryEntry("layout.images").caught.bugs, [], "the image check has no target of its own (Gate B)");
});

test("an entry applies where inspection found its pattern, and only there (decision table)", () => {
    // The fixture: /store has a sort list and checkboxes; its item page a number field; /wrapped lists that sort nothing; / has no list and no field.
    const table: Array<[string, string, boolean]> = [
        ["controls.sort", "/store", true],
        ["controls.sort", "/wrapped", false],
        ["controls.option-lists", "/wrapped", true],
        ["controls.option-lists", "/", false],
        ["controls.filters", "/store", true],
        ["controls.filters", "/", false],
        ["controls.steppers", "/store/item/01J8Z3K4QWHAMMER", true],
        ["controls.steppers", "/", false],
        ["spelling", "/words", true],
    ];
    for (const [id, path, expected] of table) assert.equal(entryApplies(id, page(path)), expected, `${id} on ${path}`);
    // A page known only by its path (Comprehensive's) matches an entry for any page, and nothing narrower.
    assert.equal(entryApplies("probes.guessable-ids", undefined), true);
    assert.equal(entryApplies("controls.sort", undefined), false);
});

test("the generator writes a check on exactly the pages its entry binds to (page, site, two-page site)", () => {
    const code = mockGenerate(raw.baseUrl, "Check the site.", ["functional", "usability", "seo/content", "accessibility"], profile, normalizeContentRules({ paths: profile.pages.map((p) => p.path) }), normalizeTestAuditMode("fast"));
    const titles = parseTestUnits(code).map((unit) => unit.title);
    for (const entry of LIBRARY.filter((candidate) => candidate.runsIn.some((place) => place.startsWith("Standard")))) {
        const written = entry.binding === "page"
            ? titles.filter((title) => profile.pages.some((p) => title === entry.title.replace("<page>", p.path))).length
            : titles.filter((title) => title === entry.title.replace("<page>", profile.pages[0].path)).length;
        const bound = entry.binding === "page" ? boundPaths(entry.id, profile).length : boundPaths(entry.id, profile).length >= (entry.minPages ?? 1) ? 1 : 0;
        assert.equal(written, bound, `${entry.id}: written ${written}, bound ${bound}`);
    }
    // A site entry that needs two pages binds to none on one.
    const one = { ...profile, pages: [page("/store")] } as ContentProfile;
    assert.deepEqual(boundPaths("layout.across-pages", one), []);
    assert.deepEqual(boundPaths("layout.consistency", one), ["/store"]);
});
