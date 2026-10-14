/**
 * Phase 42 (TFP-194, Decisions 5 and 6): gap tests, once per gap, opt-in per
 * site. Through POST /api/generate on the comparison fixture's /types shop,
 * pages inspected in a real browser, each written test run by TestForge
 * behind the read-only gate and the request guard. Claude Code is a
 * stand-in (src/test-support/fake-claude.mjs) reached by the real call path
 * (TESTFORGE_CLAUDE_COMMAND): nothing in this file reaches Claude Code.
 *
 * ISTQB technique: decision table. Conditions: the site's opt-in (off; on)
 * and what the writer's test does (finds its target; fails, then is fixed
 * on revision; sends a POST). One column each:
 *   off                       -> the writer is never called, nothing is written, the report says nothing of gap tests
 *   on, finds its target      -> one test per uncovered element, each run and saved; covered ones never asked for
 *   on, the same site again   -> nothing asked, the saved gap tests reused
 *   on, fixed on revision     -> saved after two attempts, the second in the same session
 *   on, POSTs                 -> rejected as a gate breach, never saved, and not asked for again
 * Plus the per-site setting through its route, and the local model without
 * one configured. Gate: Phase 42 batch 2.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/gap-writer/gap-writer.test.ts
 */
import assert from "node:assert";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import type { SiteSuiteRecord } from "../report/types.ts";
import type { SiteSuiteManifest } from "../site-suites/store.ts";

const scratch = mkdtempSync(join(tmpdir(), "testforge-gap-writer-"));
const savedEnv = Object.fromEntries(["TESTFORGE_DATA_DIR", "TESTFORGE_CLAUDE_COMMAND", "TESTFORGE_GAP_LIMIT", "FAKE_CLAUDE_LOG", "FAKE_CLAUDE_MODE", "TESTFORGE_OLLAMA_MODEL", "OPENAI_API_KEY"].map((key) => [key, process.env[key]]));
process.env.TESTFORGE_CLAUDE_COMMAND = JSON.stringify([process.execPath, join(process.cwd(), "src/test-support/fake-claude.mjs")]);
delete process.env.TESTFORGE_OLLAMA_MODEL;
delete process.env.OPENAI_API_KEY;

const generateRoute = await import("../../app/api/generate/route.ts");
const settingsRoute = await import("../../app/api/site-settings/route.ts");
const { NextRequest } = await import("next/server");
const { startRecordedFixture } = await import("../../test-support/comparison-fixture.ts");
const { chromiumSkipReason } = await import("../../test-support/chromium.ts");
const { loadSiteSuiteProfile } = await import("../site-suites/store.ts");
const { parseTestUnits } = await import("../site-suites/units.ts");
const { buildCoverageMap, untouched } = await import("../report/coverage-map.ts");
const { describeSiteSuite } = await import("../report/site-suite-text.ts");
const needsChromium = await chromiumSkipReason();

// Two small pages: their nav links past the first three are checked only by URL, so they are the gaps.
const PATHS = ["types/legal/privacy", "types/help/terms"];
let fixture: Awaited<ReturnType<typeof startRecordedFixture>>;
let run = 0;

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

const post = (url: string, body: unknown) => new NextRequest(new URL(url), { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });

/** A fresh data folder and Claude Code log for one column. */
function fresh(mode: string) {
    const id = run++;
    process.env.TESTFORGE_DATA_DIR = join(scratch, `data-${id}`);
    process.env.FAKE_CLAUDE_LOG = join(scratch, `claude-${id}.log`);
    process.env.FAKE_CLAUDE_MODE = mode;
}

const calls = () => (existsSync(process.env.FAKE_CLAUDE_LOG!) ? readFileSync(process.env.FAKE_CLAUDE_LOG!, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line) as { args: string[]; prompt: string; session: string }) : []);

async function optIn(gapWriter: string) {
    const response = await settingsRoute.POST(post("http://localhost/api/site-settings", { baseUrl: fixture.origin, gapWriter }));
    assert.equal(response.status, 200);
}

async function generate() {
    const response = await generateRoute.POST(post("http://localhost/api/generate", { baseUrl: fixture.origin, description: "Check the pages.", selectedPractices: ["functional"], contentRules: { paths: PATHS } }));
    assert.equal(response.status, 200);
    return (await response.json()) as { code: string; siteSuite: SiteSuiteRecord };
}

const manifestOf = async (store: string) => JSON.parse(await readFile(join(store, "manifest.json"), "utf8")) as SiteSuiteManifest;

test("the site setting: off by default, set and read through its route, anything else refused", async () => {
    fresh("good");
    const origin = "http://127.0.0.1:9";
    const read = async () => (await (await settingsRoute.GET(new NextRequest(new URL(`http://localhost/api/site-settings?baseUrl=${encodeURIComponent(origin)}/x`)))).json()).gapWriter;
    assert.equal(await read(), "off");
    assert.equal((await settingsRoute.POST(post("http://localhost/api/site-settings", { baseUrl: origin, gapWriter: "openai" }))).status, 400);
    assert.equal((await settingsRoute.POST(post("http://localhost/api/site-settings", { gapWriter: "claude-code" }))).status, 400, "a site must be named");
    assert.equal((await settingsRoute.POST(post("http://localhost/api/site-settings", { baseUrl: `${origin}/y`, gapWriter: "claude-code" }))).status, 200);
    assert.equal(await read(), "claude-code", "by origin, whatever the path");
});

test("opt-in off: Claude Code is never called and no gap test is written (TFP-194)", { skip: needsChromium }, async () => {
    fresh("good");
    const body = await generate();
    assert.deepEqual(calls(), []);
    assert.equal(body.siteSuite.gapTests, undefined);
    assert.ok(!body.code.includes("gap test:"));
});

test("opt-in on: a test for each uncovered element only, each run and saved; the same site again asks for nothing (TFP-194)", { skip: needsChromium }, async () => {
    fresh("good");
    process.env.TESTFORGE_GAP_LIMIT = "50";
    await optIn("claude-code");
    const first = await generate();
    const gaps = first.siteSuite.gapTests;
    assert.ok(gaps, "the record says what the writer did");
    assert.ok(gaps.asked > 0 && gaps.asked === gaps.gaps, `${gaps.asked} asked of ${gaps.gaps}`);
    assert.equal(gaps.saved, gaps.asked, JSON.stringify(gaps.tests.filter((t) => !t.outcome.startsWith("saved"))));
    // One call to write each test, one per revision (a run can fail under load and be revised), and one to
    // generalise each saved test into a candidate (TFP-195); the cost is what the calls reported.
    const revisions = gaps.tests.reduce((sum, written) => sum + written.attempts - 1, 0);
    assert.equal(calls().filter((call) => call.prompt.startsWith("Write the body")).length, gaps.asked);
    assert.equal(calls().filter((call) => call.prompt.startsWith("Generalise")).length, gaps.saved);
    assert.equal(calls().length, gaps.asked + revisions + gaps.saved);
    assert.equal(gaps.costUsd.toFixed(4), (0.0125 * calls().length).toFixed(4));
    // Every saved test was generalised; a candidate whose bound-back run fails under load is not kept, which is the rule.
    assert.equal(gaps.candidates!.matched, 0);
    assert.equal(gaps.candidates!.added + gaps.candidates!.notKept, gaps.saved);
    assert.ok(gaps.candidates!.added > 0);

    // Only uncovered elements: every target was on the in-context gap list of the suite before the gap tests.
    const profile = await loadSiteSuiteProfile(first.siteSuite.store);
    const before = first.code.slice(0, first.code.indexOf("// Kept from the site suite (Gap tests)"));
    const gapKeys = new Set(untouched(buildCoverageMap(profile, before)!).map((entry) => entry.key));
    for (const written of gaps.tests) assert.ok(gapKeys.has(written.covers), `${written.covers} was uncovered`);
    const covered = buildCoverageMap(profile, before)!.entries.filter((entry) => entry.tests.length > 0);
    assert.ok(covered.length > 0);
    for (const call of calls().filter((c) => c.prompt.startsWith("Write the body"))) for (const entry of covered.filter((e) => e.kind === "link")) assert.ok(!call.prompt.includes(`  ${entry.name}\n`), `${entry.name} is covered and was not asked for`);

    const manifest = await manifestOf(first.siteSuite.store);
    assert.equal(manifest.units.filter((unit) => unit.origin === "gap-writer").length, gaps.saved);
    assert.equal(parseTestUnits(first.code).filter((unit) => unit.describe[0] === "Gap tests").length, gaps.saved);
    assert.match(describeSiteSuite(first.siteSuite), new RegExp(`Gap tests: Claude Code was asked for ${gaps.asked} gaps, at a cost of \\$${gaps.costUsd.toFixed(2)}: ${gaps.saved} saved to the site suite`));

    // The same site again: nothing asked, the gap tests reused as saved.
    const callsBefore = calls().length;
    const again = await generate();
    assert.equal(calls().length, callsBefore, "no new call");
    assert.equal(again.siteSuite.gapTests?.asked, 0);
    assert.equal(again.siteSuite.generated, 0);
    assert.equal(parseTestUnits(again.code).filter((unit) => unit.describe[0] === "Gap tests").length, gaps.saved);
    assert.match(describeSiteSuite(again.siteSuite), /Gap tests: Claude Code was asked for nothing; no gap is left that hasn't been written for or tried\./);
    delete process.env.TESTFORGE_GAP_LIMIT;
});

test("a test that fails is revised in the same session and saved once it passes (TFP-194)", { skip: needsChromium }, async () => {
    fresh("revise");
    process.env.TESTFORGE_GAP_LIMIT = "1";
    await optIn("claude-code");
    const body = await generate();
    delete process.env.TESTFORGE_GAP_LIMIT;
    const [written] = body.siteSuite.gapTests!.tests;
    assert.deepEqual({ outcome: written.outcome.replace(/; candidate \w+ added$/, ""), attempts: written.attempts }, { outcome: "saved", attempts: 2 });
    const [firstCall, secondCall] = calls();
    assert.ok(!firstCall.args.includes("--resume"));
    assert.deepEqual(secondCall.args.slice(-2), ["--resume", firstCall.session], "the revision resumes the first call's session");
    // TFP-202: what the run said goes back as untrusted data.
    assert.match(secondCall.prompt, /^The test failed\.\nWhat TestForge's run of it said is between the two RUN-OUTPUT lines/);
});

test("a test that breaches the read-only gate is rejected, never saved, and not asked for again (TFP-194)", { skip: needsChromium }, async () => {
    fresh("breach");
    process.env.TESTFORGE_GAP_LIMIT = "1";
    await optIn("claude-code");
    const body = await generate();
    const gaps = body.siteSuite.gapTests!;
    assert.deepEqual({ asked: gaps.asked, saved: gaps.saved, rejected: gaps.rejected }, { asked: 1, saved: 0, rejected: 1 });
    assert.equal(gaps.tests[0].outcome, "rejected: read-only gate breach");
    assert.equal(calls().length, 1, "a breach isn't sent back for revision");
    const manifest = await manifestOf(body.siteSuite.store);
    assert.equal(manifest.units.filter((unit) => unit.origin === "gap-writer").length, 0);
    assert.deepEqual(manifest.gapAttempts?.map((attempt) => [attempt.key, attempt.outcome]), [[gaps.tests[0].covers, "breach"]]);
    assert.ok(!body.code.includes("gap test:"));
    // The next generation asks for the next gap, never the rejected one again.
    const again = await generate();
    delete process.env.TESTFORGE_GAP_LIMIT;
    assert.equal(calls().length, 2);
    assert.notEqual(again.siteSuite.gapTests!.tests[0].covers, gaps.tests[0].covers);
});

test("the local model chosen with none configured: nothing written, and the report says why (TFP-194)", { skip: needsChromium }, async () => {
    fresh("good");
    await optIn("local-model");
    const body = await generate();
    assert.deepEqual(calls(), []);
    assert.equal(body.siteSuite.gapTests?.note, "the site chose the local model, and no TESTFORGE_OLLAMA_MODEL is set");
    assert.match(describeSiteSuite(body.siteSuite), /Gap tests: none written, as the site chose the local model, and no TESTFORGE_OLLAMA_MODEL is set\./);
});
