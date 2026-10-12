/**
 * Phase 41 (TFP-184, Decision 5): the known-path probe and the guessable-id
 * finding, in a real browser on the comparison fixture, through the
 * Comprehensive security suite, behind the recording proxy.
 *
 * ISTQB technique: decision table. Conditions: whether a known path leaks,
 * and where (nowhere; on the site's own API, a second origin its home page
 * calls); whether unknown paths answer 200 with a page (a catch-all); and
 * whether the store's ids are integers. One column each:
 *   clean                    -> the probe passes, on the site's origin only; no id finding
 *   security-log-on-api      -> the probe fails naming the API origin's /logs/laravel.log; both origins probed
 *   security-catch-all       -> the probe passes: a page answering 200 is not a leak
 *   security-sequential-ids  -> /store carries the finding naming /store/item/:id and its ids
 * The checks' own technique is error guessing, named in the generated tests.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/generate/security-probes.test.ts
 */
import assert from "node:assert";
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import type { JsonReport } from "../report/types.ts";

const { buildComprehensiveSuite } = await import("./comprehensive.ts");
const { KNOWN_PATHS } = await import("./security-probes.ts");
const { normalizeRunMode } = await import("../comprehensive/run-mode.ts");
const { flattenSuites } = await import("../report/execution.ts");
const { findTypeErrors } = await import("./validate.ts");
const { startRecordedFixture } = await import("../../test-support/comparison-fixture.ts");
const { chromiumSkipReason } = await import("../../test-support/chromium.ts");
const needsChromium = await chromiumSkipReason();

async function runSuite(code: string, label: string) {
    const dir = join(process.cwd(), ".playwright-runs");
    await mkdir(dir, { recursive: true });
    const name = `security-probes-unit-${label}-${process.pid}-${Date.now()}`;
    const specFile = join(dir, `${name}.spec.ts`);
    const jsonFile = join(dir, `${name}.json`);
    await writeFile(specFile, code, "utf8");
    try {
        await new Promise<void>((resolve, reject) => {
            const child = spawn(process.execPath, [join(process.cwd(), "node_modules", "playwright", "cli.js"), "test", `.playwright-runs/${name}.spec.ts`, "--reporter=json", "--project=chromium", "--timeout=60000", "--workers=1", "--grep", "known paths|guessable"], {
                cwd: process.cwd(),
                env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: jsonFile, FORCE_COLOR: "0", TESTFORGE_INTERACTIVE: "0" },
                stdio: "ignore",
                windowsHide: true,
            });
            child.on("error", reject);
            child.on("close", () => resolve());
        });
        const json = JSON.parse(await readFile(jsonFile, "utf8")) as JsonReport;
        return flattenSuites(json.suites ?? []).map((record) => ({ ...record, probe: JSON.stringify(json).match(/known paths: [^"]*/)?.[0] ?? "" }));
    } finally {
        await rm(specFile, { force: true });
        await rm(jsonFile, { force: true });
    }
}

test("the probe's list: 19 paths - version control, .env, backups and dumps, and three log files in three folders - named with its count in the test's title", () => {
    assert.equal(KNOWN_PATHS.length, 19);
    assert.ok(KNOWN_PATHS.includes("/logs/laravel.log") && KNOWN_PATHS.includes("/storage/logs/laravel.log") && KNOWN_PATHS.includes("/.git/HEAD") && KNOWN_PATHS.includes("/.env"));
    const code = buildComprehensiveSuite("http://example.test", normalizeRunMode({ kind: "comprehensive", area: "security" }), { covered: ["/", "/store"], notCovered: [], pageCap: 20 });
    assert.deepEqual(findTypeErrors(code), []);
    assert.match(code, /test\('TFSC-\d+: 19 known paths that leak \(\/\.env, \/\.git\/HEAD, .*\/storage\/logs\/laravel\.log\) are not reachable on the site or its own API', \{ annotation: \[\{ type: 'page', description: '\(known-path probe\)' \}, \{ type: 'gate', description: 'read-only' \}, \{ type: 'category', description: 'A01:2025 Broken Access Control' \}, \{ type: 'asvs', description: '13\.4\.1' \}, \{ type: 'asvs', description: '13\.4\.7' \}\] \}/);
    assert.equal(code.match(/known paths that leak/g)?.length, 1, "once per run");
    assert.equal(code.match(/uses no guessable sequential ids/g)?.length, 2, "once per page");
});

test("in a real browser: the probe finds a log on the site's own API and not a catch-all page; integer ids are a finding (decision table)", { skip: needsChromium }, async () => {
    const fixture = await startRecordedFixture();
    try {
        const code = buildComprehensiveSuite(fixture.origin, normalizeRunMode({ kind: "comprehensive", area: "security" }), { covered: ["/", "/store"], notCovered: [], pageCap: 20 });
        const run = async (defect: string) => {
            await fixture.control(`/__fixture/defect?set=${defect}`);
            fixture.recorded.length = 0;
            const records = await runSuite(code, defect);
            const probe = records.find((record) => record.title.includes("known paths that leak"))!;
            const ids = (page: string) => records.find((record) => record.title.endsWith(`${page} uses no guessable sequential ids in its addresses (recorded as a finding)`))!;
            return { probe, ids, sent: fixture.recorded.filter((request) => KNOWN_PATHS.includes(request.path as never)) };
        };
        const site = fixture.origin;

        const clean = await run("none");
        assert.equal(clean.probe.status, "Passed", clean.probe.rawMessage);
        assert.equal(clean.probe.probe, `known paths: 19 paths on ${site}, one GET each`);
        assert.equal(clean.sent.length, 19, "one GET per path on the site's origin");
        assert.ok(clean.sent.every((request) => request.method === "GET"));
        assert.deepEqual([clean.ids("/").findings, clean.ids("/store").findings], [[], []]);

        const api = await run("security-log-on-api");
        assert.equal(api.probe.status, "Failed");
        const leak = /files anyone can read: (http:\/\/127\.0\.0\.1:(\d+))\/logs\/laravel\.log answers 200 with its contents \("\[2026-10-12 09:14:02\] local\.INFO: Fetching products/.exec(api.probe.rawMessage);
        assert.ok(leak, api.probe.rawMessage.split("\n")[0]);
        assert.notEqual(leak[1], site, "the leak is on the API's origin, not the site's");
        assert.equal(api.probe.probe, `known paths: 19 paths on ${site}, ${leak[1]}, one GET each`);
        assert.equal(api.sent.length, 19, "the site's origin still gets one GET per path");

        const catchAll = await run("security-catch-all");
        assert.equal(catchAll.probe.status, "Passed", catchAll.probe.rawMessage);

        const sequential = await run("security-sequential-ids");
        assert.deepEqual(sequential.ids("/store").findings, [`${site}/store/item/:id on /store uses sequential integer ids (1, 2, 3, 4, 5, ...): the next record's address can be guessed; whether it reaches someone else's record needs an authorization test (OWASP WSTG-ATHZ-04)`]);
        assert.equal(sequential.ids("/store").status, "Passed", "a finding, not a failure");
    } finally {
        await fixture.close();
    }
});
