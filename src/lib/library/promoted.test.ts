/**
 * Phase 42 (TFP-204, batch 2 ruling 3): generation applies the library's
 * promoted entries. Unit cases read recorded page data (TFP-193's fixture
 * profile, no browser); one case generates through POST /api/generate and
 * runs through POST /api/run on the comparison fixture's /types pages, in a
 * real browser, with its own promoted folder (TESTFORGE_LIBRARY_PROMOTED_DIR).
 *
 * ISTQB technique: decision table. Conditions: an entry's pattern (an
 * element on several pages; a link repeated across pages; on no page), its
 * body (ordinary; refused by TFP-202's code check), and whether anything is
 * promoted at all. Columns:
 *   element pattern            -> a test on each page with it, bound to the page and the generator's locator,
 *                                 in the functional describe, the element counted covered
 *   repeated link              -> one test, on the first page it is on
 *   no page with the pattern   -> nothing; the code byte for byte as it came
 *   refused by the code check  -> never applied
 *   nothing promoted           -> the code byte for byte as it came (check:template-unchanged covers the template)
 *   through the routes         -> generated on Standard functional and run inside the verdict
 * Gate: Phase 42, before TFP-197.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/library/promoted.test.ts
 */
import assert from "node:assert";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import type { ContentProfile } from "../generate/mock/types.ts";
import type { PromotedEntry } from "../candidates/promotion.ts";
import type { RunReport, SiteSuiteRecord } from "../report/types.ts";

const scratch = mkdtempSync(join(tmpdir(), "testforge-promoted-"));
const savedEnv = Object.fromEntries(["TESTFORGE_DATA_DIR", "TESTFORGE_RUNS_ROOT", "TESTFORGE_LIBRARY_PROMOTED_DIR", "TESTFORGE_OLLAMA_MODEL", "OPENAI_API_KEY"].map((key) => [key, process.env[key]]));
process.env.TESTFORGE_DATA_DIR = join(scratch, "data");
process.env.TESTFORGE_RUNS_ROOT = join(scratch, "runs");
delete process.env.TESTFORGE_OLLAMA_MODEL;
delete process.env.OPENAI_API_KEY;

const { bindPromotedEntries } = await import("./promoted.ts");
const { loadPromotedEntries } = await import("../candidates/promotion.ts");
const { candidateId, patternOf } = await import("../candidates/pool.ts");
const { mockGenerate } = await import("../generate/mock/index.ts");
const { SUITE_TITLES } = await import("../generate/mock/suite.ts");
const { normalizeContentProfile, normalizeContentRules, normalizeTestAuditMode } = await import("../generate/normalize.ts");
const { parseTestUnits } = await import("../site-suites/units.ts");
const { buildCoverageMap } = await import("../report/coverage-map.ts");
const generateRoute = await import("../../app/api/generate/route.ts");
const runRoute = await import("../../app/api/run/route.ts");
const { runJobs } = await import("../run/jobs.ts");
const { NextRequest } = await import("next/server");
const { startRecordedFixture } = await import("../../test-support/comparison-fixture.ts");
const { chromiumSkipReason } = await import("../../test-support/chromium.ts");
const needsChromium = await chromiumSkipReason();

const profile = normalizeContentProfile(JSON.parse(readFileSync(join(process.cwd(), "benchmarks/2026-10-14-tfp193-library/fixture-profile.json"), "utf8"))) as ContentProfile;
const BASE = "http://127.0.0.1:4173";
const template = mockGenerate(BASE, "Check the shop.", ["functional"], profile, normalizeContentRules(undefined), normalizeTestAuditMode("fast"));
const BODY = "await page.goto('__PAGE__');\nawait expect(__LOCATOR__).toBeAttached();";
let fixture: Awaited<ReturnType<typeof startRecordedFixture>>;

before(async () => {
    if (!needsChromium) fixture = await startRecordedFixture();
});

after(async () => {
    await fixture?.close();
    for (const [key, value] of Object.entries(savedEnv)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
    rmSync(scratch, { recursive: true, force: true });
});

function entry(kind: "element" | "link", name: string, body = BODY): PromotedEntry {
    const pattern = patternOf(kind, name);
    return { id: candidateId(pattern), pattern, body, gate: "read-only", technique: "error guessing", writer: "claude-code", sources: [], evidence: [], approved: { by: "Emil", at: "2026-10-14T00:00:00.000Z" }, caught: [] };
}

const libraryUnits = (code: string) => parseTestUnits(code).filter((unit) => unit.title.startsWith("library promoted."));

test("an element's pattern: a test on each page with it, bound, in the functional describe, the element covered (TFP-204)", () => {
    // The element pattern on the most pages, by the coverage map's own names.
    const map = buildCoverageMap(profile, template)!;
    const elements = map.entries.filter((item) => item.kind === "element");
    const byName = new Map<string, string[]>();
    for (const item of elements) byName.set(item.name, [...(byName.get(item.name) ?? []), item.page]);
    const [name, pages] = [...byName].sort((a, b) => b[1].length - a[1].length)[0];
    assert.ok(pages.length >= 1, name);

    const { code, bound } = bindPromotedEntries(template, profile, [entry("element", name)]);
    assert.deepEqual(bound.map((item) => item.page).sort(), [...pages].sort(), "one test on each page with the pattern");
    const units = libraryUnits(code);
    assert.equal(units.length, pages.length);
    for (const unit of units) {
        assert.deepEqual(unit.describe, [SUITE_TITLES.functional]);
        assert.ok(!unit.source.includes("__PAGE__") && !unit.source.includes("__LOCATOR__"), "bound");
        assert.match(unit.source, /\{ type: 'gate', description: 'read-only' \}/);
        assert.match(unit.source, /tfReadOnlyGuarded\(page, async \(\) => \{/);
    }
    assert.equal(code.split("async function tfReadOnlyGuarded").length - 1, 1, "the guard's helper, once");
    // Bound with the generator's own locator, so the coverage map counts each one covered.
    const after = buildCoverageMap(profile, code)!;
    for (const item of elements.filter((e) => e.name === name)) assert.ok(after.entries.find((e) => e.key === item.key)!.tests.some((title) => title.startsWith("library promoted.")), item.key);
    assert.ok(parseTestUnits(code).length === parseTestUnits(template).length + pages.length, "nothing else added or lost");
});

test("a repeated link: one test, on the first page it is on (TFP-204)", () => {
    const map = buildCoverageMap(profile, template)!;
    const link = map.entries.find((item) => item.kind === "link" && (item.pages?.length ?? 0) > 1 && !item.name.startsWith("http"))!;
    assert.ok(link, "the fixture has a link on several pages");
    const { code, bound } = bindPromotedEntries(template, profile, [entry("link", link.name)]);
    assert.deepEqual(bound.map((item) => item.page), [link.page]);
    assert.ok(buildCoverageMap(profile, code)!.entries.find((e) => e.key === link.key)!.tests.some((title) => title.startsWith("library promoted.")));
});

test("nothing promoted, no page with the pattern, or refused by the code check: the code as it came (TFP-204)", async () => {
    assert.equal(bindPromotedEntries(template, profile, []).code, template);
    assert.equal(bindPromotedEntries(template, profile, [entry("element", "No Such Control [button]")]).code, template);
    const name = buildCoverageMap(profile, template)!.entries.find((item) => item.kind === "element")!.name;
    assert.equal(bindPromotedEntries(template, profile, [entry("element", name, "await page.goto('__PAGE__');\nawait fetch('http://evil.example');")]).code, template);
    // The repo's own folder holds only its README: nothing is promoted yet.
    delete process.env.TESTFORGE_LIBRARY_PROMOTED_DIR;
    assert.deepEqual(await loadPromotedEntries(), []);
    // An unreadable file is skipped, not a failed generation.
    const dir = join(scratch, "broken");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "aaaaaaaaaaaa.json"), "{ not json");
    writeFileSync(join(dir, "good.json"), JSON.stringify(entry("element", name)));
    assert.deepEqual((await loadPromotedEntries(dir)).map((item) => item.id), [entry("element", name).id]);
});

test("through the routes: a promoted entry is generated on Standard functional and runs inside the verdict (TFP-204)", { skip: needsChromium }, async () => {
    const post = (url: string, body: unknown) => new NextRequest(new URL(url), { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
    const generate = async (practices: string[]) => {
        const response = await generateRoute.POST(post("http://localhost/api/generate", { baseUrl: fixture.origin, description: "Check the pages.", selectedPractices: practices, contentRules: { paths: ["types/legal/privacy", "types/help/terms"] } }));
        assert.equal(response.status, 200);
        return (await response.json()) as { code: string; siteSuite: SiteSuiteRecord };
    };
    // Nothing promoted first, to find a gap's pattern on this site.
    process.env.TESTFORGE_LIBRARY_PROMOTED_DIR = join(scratch, "promoted-empty");
    const plain = await generate(["functional"]);
    assert.equal(libraryUnits(plain.code).length, 0);
    const { loadSiteSuiteProfile } = await import("../site-suites/store.ts");
    const siteProfile = await loadSiteSuiteProfile(plain.siteSuite.store);
    // TFP-205: the template checks every link now, so none is a gap; a promoted entry binds by its pattern, gap or not.
    const gap = buildCoverageMap(siteProfile, plain.code)!.entries.find((item) => item.kind === "link" && !item.name.startsWith("http"))!;
    assert.ok(gap, "the site has a link");

    const dir = join(scratch, "promoted");
    mkdirSync(dir, { recursive: true });
    const promoted = entry("link", gap.name);
    writeFileSync(join(dir, `${promoted.id}.json`), JSON.stringify(promoted, null, 2));
    process.env.TESTFORGE_LIBRARY_PROMOTED_DIR = dir;
    try {
        const body = await generate(["functional"]);
        const units = libraryUnits(body.code);
        assert.equal(units.length, 1, parseTestUnits(body.code).map((unit) => unit.title).join(" | "));
        assert.ok(buildCoverageMap(siteProfile, body.code)!.entries.find((item) => item.key === gap.key)!.tests.some((title) => title.includes("library promoted.")), "the promoted entry checks the link in context");
        // Only where the library's control checks run: not on a Standard run without functional.
        assert.equal(libraryUnits((await generate(["accessibility"])).code).length, 0);

        const title = units[0].id ? `${units[0].id}: ${units[0].title}` : units[0].title;
        const response = await runRoute.POST(post("http://localhost/api/run", { code: body.code, baseUrl: fixture.origin, selectedPractices: ["functional"], description: "Check the pages.", includeTestTitles: [title] }));
        assert.equal(response.status, 202);
        const { runId } = (await response.json()) as { runId: string };
        const started = Date.now();
        while (!runJobs.get(runId)?.result) {
            assert.ok(Date.now() - started < 180_000, "the run finished within 3 minutes");
            await new Promise((done) => setTimeout(done, 250));
        }
        const summary = (runJobs.get(runId)!.result!.report as RunReport).summary;
        // Inside the verdict: counted in the run's own summary, like any library entry.
        assert.deepEqual({ executed: summary.executed, passed: summary.passed }, { executed: 1, passed: 1 }, runJobs.get(runId)!.outputChunks.join("").slice(-2000));
    } finally {
        process.env.TESTFORGE_LIBRARY_PROMOTED_DIR = join(scratch, "promoted-empty");
    }
});
