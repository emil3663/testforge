/**
 * TFP-257: the product says its version. A saved report answers "which TestForge found this?" by itself, from the stamp
 * its run took, not from whatever reads it later.
 *
 * ISTQB techniques: equivalence partitioning of where the version comes from (a repo; a folder with no package.json or
 * no git), and of the stamp on a report (present, with a commit, without one, absent on an old run), plus, in a real
 * browser through the executor, a fresh run's run.json and its report.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/version.test.ts
 */
import assert from "node:assert";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

const scratch = mkdtempSync(join(tmpdir(), "testforge-version-"));
process.env.TESTFORGE_RUNS_ROOT = join(scratch, "runs");
process.env.TESTFORGE_DATA_DIR = join(scratch, "data");
after(() => rmSync(scratch, { recursive: true, force: true }));

const { currentVersion } = await import("./version.ts");
const { buildVersionFooterHtml } = await import("./report/text.ts");
const { buildResultHtmlDocument } = await import("./report/html.ts");
const { startRunJob } = await import("./run/executor.ts");
const { runJsonPath } = await import("./run/persistence.ts");
const { waitForSavedRun } = await import("../test-support/saved-run.ts");
const { chromiumSkipReason } = await import("../test-support/chromium.ts");
const needsChromium = await chromiumSkipReason();

test("in the repo: package.json's version, and git's commit", () => {
    const { version, commit } = currentVersion();
    assert.equal(version, JSON.parse(readFileSync("package.json", "utf8")).version);
    assert.equal(commit, execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim());
});

test("a copy with no package.json and no git says so, and doesn't throw", () => {
    assert.deepEqual(currentVersion(mkdtempSync(join(scratch, "bare-"))), { version: "unknown", commit: null });
});

test("a package.json with no usable version is unknown, not undefined", () => {
    const dir = mkdtempSync(join(scratch, "no-version-"));
    writeFileSync(join(dir, "package.json"), "{}");
    assert.equal(currentVersion(dir).version, "unknown");
    writeFileSync(join(dir, "package.json"), "not json");
    assert.equal(currentVersion(dir).version, "unknown");
});

test("the footer names the run's own stamp, without a commit where there's none, and says when a run has no stamp", () => {
    assert.match(buildVersionFooterHtml({ version: "0.2.0", commit: "abc1234" }), />TestForge 0\.2\.0 \(abc1234\)</);
    assert.match(buildVersionFooterHtml({ version: "0.2.0", commit: null }), />TestForge 0\.2\.0</);
    assert.match(buildVersionFooterHtml(undefined), /version not recorded/);
});

test("a built server says what it was built from, whatever HEAD is now", (t) => {
    t.after(() => {
        delete process.env.TESTFORGE_BUILD_VERSION;
        delete process.env.TESTFORGE_BUILD_COMMIT;
    });
    process.env.TESTFORGE_BUILD_VERSION = "9.9.9";
    process.env.TESTFORGE_BUILD_COMMIT = "abc1234";
    assert.deepEqual(currentVersion(), { version: "9.9.9", commit: "abc1234" });
    process.env.TESTFORGE_BUILD_COMMIT = "";
    assert.deepEqual(currentVersion(), { version: "9.9.9", commit: null });
});

test("a copy with no .git of its own doesn't take the commit of a repo it sits inside", () => {
    const dir = mkdtempSync(join("src", "lib", ".version-test-"));
    try {
        assert.equal(currentVersion(dir).commit, null);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test("a run that ended with no report still says its version in what it exports", () => {
    const html = buildResultHtmlDocument({ runId: "r", runStatus: "cancelled", output: "stopped", progress: { totalTests: 0, completedTests: 0 }, producedBy: { version: "0.2.0", commit: "abc1234" } } as never);
    assert.match(html, /<\/main>\s*<footer[^>]*>TestForge 0\.2\.0 \(abc1234\)<\/footer>/);
});

test("the footer escapes what it's given: a saved run.json is data", () => {
    assert.doesNotMatch(buildVersionFooterHtml({ version: "<img src=x>", commit: "<b>" }), /<img|<b>/);
});

test("in a real browser: a fresh run's run.json and report carry the stamp", { skip: needsChromium }, async () => {
    const code = `import { test } from '@playwright/test';\ntest('passes', async () => {});\n`;
    const snapshot = await startRunJob(code, ["functional"], "fast", "http://127.0.0.1:9", [], [], "Check the site.");
    await waitForSavedRun(snapshot.runId, 120_000);
    const record = JSON.parse(readFileSync(runJsonPath(snapshot.runId), "utf8"));
    assert.deepEqual(record.producedBy, currentVersion());
    assert.deepEqual(record.result.report.producedBy, currentVersion());
    // The saved report's own last line, built from the record as the browser builds it.
    const { version, commit } = currentVersion();
    assert.ok(buildResultHtmlDocument(record.result).includes(`>TestForge ${version} (${commit})</footer>`));
});
