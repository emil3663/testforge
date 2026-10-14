/**
 * Phase 42 (TFP-195, Decision 8): the candidate pool, on two comparison
 * fixture sites sharing a component (two copies of the fixture, two
 * origins). Generated through POST /api/generate and run through POST
 * /api/run, in a real browser; Claude Code is TFP-194's stand-in, so nothing
 * here reaches it.
 *
 * ISTQB technique: decision table. Conditions: the site (where the gap test
 * was written; another with the component), the run type (Standard;
 * Comprehensive) and the candidate's state (candidate; rejected). Columns:
 *   first site, gap test saved          -> the test generalised, bound back and run, and pooled with its source
 *   second site, Comprehensive          -> the candidate bound to it and run in its own section, outside the verdict; its evidence gains the run
 *   second site, Standard               -> TFP-203: bound into the site suite as the gap's test once it passes the
 *                                          gates there, inside the verdict; no gap test written; the gap counted covered
 *   another site, Standard, failing     -> TFP-203: a candidate that breaches or fails the code check there is not bound
 *   second site, opt-in on              -> no new gap test for the candidate's pattern
 *   one pattern from a second site      -> merged into the one candidate, not kept beside it
 *   rejected                            -> kept with its reason, never bound, never proposed again
 * Gate: Phase 42 batch 2; TFP-203 before TFP-197.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/candidates/candidates.test.ts
 */
import assert from "node:assert";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import type { RunReport, SiteSuiteRecord } from "../report/types.ts";
import type { SiteSuiteManifest } from "../site-suites/store.ts";

const scratch = mkdtempSync(join(tmpdir(), "testforge-candidates-"));
const savedEnv = Object.fromEntries(["TESTFORGE_DATA_DIR", "TESTFORGE_RUNS_ROOT", "TESTFORGE_CLAUDE_COMMAND", "TESTFORGE_GAP_LIMIT", "FAKE_CLAUDE_LOG", "FAKE_CLAUDE_MODE", "TESTFORGE_OLLAMA_MODEL", "OPENAI_API_KEY"].map((key) => [key, process.env[key]]));
process.env.TESTFORGE_DATA_DIR = join(scratch, "data");
process.env.TESTFORGE_RUNS_ROOT = join(scratch, "runs");
process.env.TESTFORGE_CLAUDE_COMMAND = JSON.stringify([process.execPath, join(process.cwd(), "src/test-support/fake-claude.mjs")]);
process.env.FAKE_CLAUDE_LOG = join(scratch, "claude.log");
process.env.FAKE_CLAUDE_MODE = "good";
delete process.env.TESTFORGE_OLLAMA_MODEL;
delete process.env.OPENAI_API_KEY;

const generateRoute = await import("../../app/api/generate/route.ts");
const runRoute = await import("../../app/api/run/route.ts");
const settingsRoute = await import("../../app/api/site-settings/route.ts");
const { runJobs } = await import("../run/jobs.ts");
const { NextRequest } = await import("next/server");
const { startRecordedFixture } = await import("../../test-support/comparison-fixture.ts");
const { chromiumSkipReason } = await import("../../test-support/chromium.ts");
const { addToPool, loadCandidate, loadPool, matchingCandidate, patternOf, poolHas, saveCandidate } = await import("./pool.ts");
const { parseTestUnits } = await import("../site-suites/units.ts");
const { loadSiteSuiteProfile } = await import("../site-suites/store.ts");
const { buildCoverageMap, untouched } = await import("../report/coverage-map.ts");
const { describeSiteSuite } = await import("../report/site-suite-text.ts");
const needsChromium = await chromiumSkipReason();

const PATHS = ["types/legal/privacy", "types/help/terms"];
const COMPREHENSIVE = { kind: "comprehensive", area: "accessibility" };
let siteA: Awaited<ReturnType<typeof startRecordedFixture>>;
let siteB: Awaited<ReturnType<typeof startRecordedFixture>>;
let candidateId = "";

before(async () => {
    if (needsChromium) return;
    siteA = await startRecordedFixture();
    siteB = await startRecordedFixture();
});

after(async () => {
    await siteA?.close();
    await siteB?.close();
    for (const [key, value] of Object.entries(savedEnv)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
    rmSync(scratch, { recursive: true, force: true });
});

const post = (url: string, body: unknown) => new NextRequest(new URL(url), { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
const calls = () => (existsSync(process.env.FAKE_CLAUDE_LOG!) ? readFileSync(process.env.FAKE_CLAUDE_LOG!, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line) as { prompt: string }) : []);

async function optIn(origin: string, gapWriter: string) {
    assert.equal((await settingsRoute.POST(post("http://localhost/api/site-settings", { baseUrl: origin, gapWriter }))).status, 200);
}

async function generate(origin: string, runMode?: unknown) {
    const response = await generateRoute.POST(post("http://localhost/api/generate", { baseUrl: origin, description: "Check the pages.", selectedPractices: ["functional"], contentRules: { paths: PATHS }, ...(runMode ? { runMode } : {}) }));
    assert.equal(response.status, 200);
    return (await response.json()) as { code: string; siteSuite: SiteSuiteRecord };
}

test("first site: a saved gap test is generalised, checked bound back, and pooled with its source (TFP-195)", { skip: needsChromium }, async () => {
    await optIn(siteA.origin, "claude-code");
    process.env.TESTFORGE_GAP_LIMIT = "1";
    const body = await generate(siteA.origin);
    delete process.env.TESTFORGE_GAP_LIMIT;
    const gaps = body.siteSuite.gapTests!;
    assert.deepEqual([gaps.saved, gaps.candidates], [1, { matched: 0, added: 1, notKept: 0 }]);
    assert.match(gaps.tests[0].outcome, /^saved; candidate [0-9a-f]{12} added$/);
    assert.ok(calls().some((call) => call.prompt.startsWith("Generalise")), "the writer was asked for the candidate");

    const pool = await loadPool();
    assert.equal(pool.length, 1);
    const [candidate] = pool;
    candidateId = candidate.id;
    assert.equal(candidate.status, "candidate");
    assert.match(candidate.body, /__PAGE__/);
    assert.match(candidate.body, /__LOCATOR__/);
    assert.deepEqual(candidate.sources.map((source) => source.origin), [siteA.origin]);
    assert.equal(candidate.gate, "read-only");
    assert.deepEqual(candidate.evidence, []);
});

test("second site, Comprehensive: the candidate runs in its own section, outside the verdict, and gains the run as evidence (TFP-195)", { skip: needsChromium }, async () => {
    assert.ok(candidateId, "the first column ran");
    const before = calls().length;
    const body = await generate(siteB.origin, COMPREHENSIVE);
    assert.equal(calls().length, before, "the second site wrote nothing: its opt-in is off");
    const units = parseTestUnits(body.code);
    const bound = units.filter((unit) => unit.describe[0] === "Candidate tests");
    assert.equal(bound.length, 1, units.map((unit) => unit.title).join(" | "));
    assert.match(bound[0].title, new RegExp(`^candidate ${candidateId}: `));
    assert.ok(!bound[0].source.includes("__PAGE__") && !bound[0].source.includes("__LOCATOR__"), "bound to the second site");

    // Run it beside one template check, as the app would.
    const template = units.find((unit) => unit.describe[0] !== "Candidate tests")!;
    const titles = [bound[0], template].map((unit) => (unit.id ? `${unit.id}: ${unit.title}` : unit.title));
    const response = await runRoute.POST(post("http://localhost/api/run", { code: body.code, baseUrl: siteB.origin, selectedPractices: ["functional"], description: "Check the pages.", includeTestTitles: titles, runMode: COMPREHENSIVE, generation: { generatedBy: "template", gates: [], siteSuite: body.siteSuite } }));
    assert.equal(response.status, 202);
    const { runId } = (await response.json()) as { runId: string };
    const started = Date.now();
    while (!runJobs.get(runId)?.result) {
        assert.ok(Date.now() - started < 300_000, "the run finished within 5 minutes");
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    const report = runJobs.get(runId)!.result!.report as RunReport;
    const section = report.comprehensive?.candidates;
    assert.ok(section, "the Comprehensive report has the candidates' section");
    assert.deepEqual(section.tests.map((t) => t.outcome), ["passed"], JSON.stringify(section.tests));
    // Outside the verdict: the Comprehensive summary counts the template check alone.
    assert.equal(report.comprehensive!.summary.tests, 1);
    assert.ok(!report.comprehensive!.pages.some((page) => page.tests > 1));

    const candidate = await loadCandidate(candidateId);
    assert.deepEqual(candidate!.evidence.map((evidence) => [evidence.origin, evidence.status, evidence.run]), [[siteB.origin, "Passed", runId]]);
});

test("second site, Standard: the matching candidate becomes the gap's test after the gates; no gap test is written (TFP-203)", { skip: needsChromium }, async () => {
    const before = calls().length;
    const body = await generate(siteB.origin);
    assert.equal(calls().length, before, "no writer asked: the site's opt-in is off, and the gap has its test");
    const bound = body.siteSuite.candidateTests!;
    assert.deepEqual({ bound: bound.bound, notBound: bound.notBound, candidates: bound.tests.map((t) => [t.candidate, t.outcome]) }, { bound: 1, notBound: 0, candidates: [[candidateId, "bound"]] });
    // In the site suite as the gap's test, inside the verdict: "Gap tests", not the Comprehensive "Candidate tests".
    const units = parseTestUnits(body.code);
    assert.ok(!units.some((unit) => unit.describe[0] === "Candidate tests"));
    const gapUnits = units.filter((unit) => unit.describe[0] === "Gap tests");
    assert.equal(gapUnits.length, 1);
    assert.ok(!gapUnits[0].source.includes("__PAGE__") && !gapUnits[0].source.includes("__LOCATOR__"), "bound to the second site");
    const manifest = JSON.parse(readFileSync(join(body.siteSuite.store, "manifest.json"), "utf8")) as SiteSuiteManifest;
    assert.deepEqual(manifest.units.filter((unit) => unit.origin === "gap-writer").map((unit) => [unit.covers, unit.writer, unit.candidate]), [[bound.tests[0].covers, "candidate", candidateId]]);
    // The coverage map counts the gap covered.
    const map = buildCoverageMap(await loadSiteSuiteProfile(body.siteSuite.store), body.code)!;
    assert.ok(map.entries.find((entry) => entry.key === bound.tests[0].covers)!.tests.length > 0);
    assert.ok(!untouched(map).some((entry) => entry.key === bound.tests[0].covers));
    assert.match(describeSiteSuite(body.siteSuite), /Pool candidates: 1 bound as its gap's test \(gap test: /);
    // The next Standard run reuses it, binding nothing again.
    const again = await generate(siteB.origin);
    assert.equal(again.siteSuite.candidateTests, undefined);
    assert.equal(parseTestUnits(again.code).filter((unit) => unit.describe[0] === "Gap tests").length, 1);
});

test("another site, Standard: a candidate that fails the gates there is not bound (TFP-203)", { skip: needsChromium }, async () => {
    const candidate = (await loadCandidate(candidateId))!;
    const bodies = {
        // Breaches the read-only gate: a form sent by POST.
        breach: "await page.goto('__PAGE__');\nawait expect(__LOCATOR__.first()).toBeAttached();\nawait page.evaluate(() => { const form = document.createElement('form'); form.method = 'post'; form.action = '/notes'; document.body.append(form); form.submit(); });",
        // Refused by TFP-202's code check before anything runs.
        invalid: "await page.goto('__PAGE__');\nawait fetch('http://127.0.0.1:9/');",
    };
    for (const [kind, failing] of Object.entries(bodies)) {
        process.env.TESTFORGE_DATA_DIR = join(scratch, `failing-${kind}`);
        try {
            await saveCandidate({ ...candidate, body: failing, evidence: [] });
            const body = await generate(siteB.origin);
            const record = body.siteSuite.candidateTests!;
            assert.deepEqual([record.bound, record.notBound], [0, 1], `${kind}: ${JSON.stringify(record.tests)}`);
            assert.match(record.tests[0].outcome, kind === "breach" ? /^not bound: read-only gate breach$/ : /^not bound: the candidate uses fetch$/);
            assert.ok(!parseTestUnits(body.code).some((unit) => unit.describe[0] === "Gap tests"), `${kind}: nothing bound`);
            const manifest = JSON.parse(readFileSync(join(body.siteSuite.store, "manifest.json"), "utf8")) as SiteSuiteManifest;
            assert.deepEqual(manifest.gapAttempts?.map((attempt) => [attempt.key, attempt.outcome, attempt.candidate]), [[record.tests[0].covers, kind, candidateId]]);
            // Tried once: not run again while its page type holds.
            assert.equal((await generate(siteB.origin)).siteSuite.candidateTests, undefined);
        } finally {
            process.env.TESTFORGE_DATA_DIR = join(scratch, "data");
        }
    }
});

test("second site, opted in: no new gap test for the candidate's pattern (TFP-195; TFP-203: the gap already has the candidate as its test)", { skip: needsChromium }, async () => {
    await optIn(siteB.origin, "claude-code");
    process.env.TESTFORGE_GAP_LIMIT = "1";
    const body = await generate(siteB.origin);
    delete process.env.TESTFORGE_GAP_LIMIT;
    const candidate = (await loadCandidate(candidateId))!;
    // TFP-203: the Standard run before bound the candidate as the gap's test, so it isn't on the gap list at all.
    assert.equal(body.siteSuite.gapTests!.candidates!.matched, 0);
    const written = body.siteSuite.gapTests!.tests.map((t) => t.title.toLowerCase());
    assert.ok(written.length > 0, "the writer was asked for another gap");
    assert.ok(!written.some((title) => title.startsWith(`gap test: ${candidate.pattern.name} [`)), `the candidate's gap wasn't written for: ${written.join(" | ")}`);
});

test("one pattern from two sites is one candidate; a rejected one is kept, never bound, never proposed again (TFP-195)", async () => {
    process.env.TESTFORGE_DATA_DIR = join(scratch, "pool-only");
    const pattern = patternOf("link", "Privacy Policy [link]");
    const base = { pattern, body: "await page.goto('__PAGE__');\nawait expect(__LOCATOR__).toBeVisible();", gate: "read-only" as const, technique: "error guessing", writer: "claude-code", costUsd: 0.01 };
    const first = await addToPool({ ...base, sources: [{ origin: "http://a.test", page: "/", at: "t1" }] });
    const second = await addToPool({ ...base, body: "something else", sources: [{ origin: "http://b.test", page: "/legal", at: "t2" }] });
    assert.equal(first.merged, false);
    assert.equal(second.merged, true);
    assert.equal((await loadPool()).length, 1, "merged, not kept side by side");
    assert.deepEqual(second.candidate.sources.map((source) => source.origin), ["http://a.test", "http://b.test"]);
    assert.equal(second.candidate.body, base.body, "the first body is kept");

    await saveCandidate({ ...second.candidate, status: "rejected", reason: "checks a third-party link" });
    const pool = await loadPool();
    assert.equal(pool[0].reason, "checks a third-party link");
    assert.equal(matchingCandidate(pool, pattern), null, "never bound");
    assert.equal(poolHas(pool, pattern), true, "so never proposed again");
    process.env.TESTFORGE_DATA_DIR = join(scratch, "data");
});
