/**
 * TFP-222: each app run in a folder of its own. TFP-208 found that a Playwright run whose config's testDir is the
 * shared .playwright-runs walks all of it as it starts, and a folder another run removes mid-walk fails it
 * ("ENOENT: no such file or directory, scandir '...'"): the run executes nothing. The app's runs used that config.
 *
 * ISTQB technique: state transition, under a concurrent change. Two app runs (startRunJob, the executor itself) start
 * at once while a third run's folder in .playwright-runs is made and removed over and over, as a finishing run removes
 * its own. Each must execute all its tests; and each run's folder is gone once it is finalized, its saved record and
 * artifacts where persistence puts them. On the code before (both runs walking .playwright-runs) the churn reaches
 * their walks.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/run/run-folders.test.ts
 */
import assert from "node:assert";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { setting } from "@/lib/settings";

const scratch = mkdtempSync(join(tmpdir(), "mr-onion-run-folders-"));
process.env.MRONION_RUNS_ROOT = join(scratch, "runs");
process.env.MRONION_DATA_DIR = join(scratch, "data");

const { startRunJob } = await import("./executor.ts");
const { runJobs } = await import("./jobs.ts");
const { removeOrphanedArtifactFolders } = await import("./persistence.ts");
const { chromiumSkipReason } = await import("../../test-support/chromium.ts");
const needsChromium = await chromiumSkipReason();

const site = createServer((_request, response) => response.writeHead(200, { "content-type": "text/html" }).end("<!doctype html><html lang=\"en\"><head><title>Run folders</title></head><body><h1>Run folders</h1></body></html>"));
await new Promise<void>((resolve) => site.listen(0, "127.0.0.1", () => resolve()));
const origin = `http://127.0.0.1:${(site.address() as AddressInfo).port}`;
after(async () => {
    await new Promise((resolve) => site.close(resolve));
    rmSync(scratch, { recursive: true, force: true });
});

const suite = `import { test, expect } from '@playwright/test';

test.use({ baseURL: '${origin}' });

test.describe('Run folders', () => {
${[1, 2, 3].map((n) => `  test('check ${n}', async ({ page }) => {\n    await page.goto('/');\n    await expect(page.locator('h1')).toHaveText('Run folders');\n  });`).join("\n\n")}
});
`;

/** A third run's folder, made and removed over and over: deep enough that a walk is inside it when it goes. */
function churn(root: string) {
    const third = join(root, `run-tfp222-third-${process.pid}`);
    let stop = false;
    const done = (async () => {
        while (!stop) {
            for (let a = 0; a < 12; a++) for (let b = 0; b < 12; b++) {
                const dir = join(third, `a${a}`, `b${b}`);
                mkdirSync(dir, { recursive: true });
                writeFileSync(join(dir, "trace.zip"), "x");
            }
            rmSync(third, { recursive: true, force: true });
            await new Promise((resolve) => setImmediate(resolve));
        }
        rmSync(third, { recursive: true, force: true });
    })();
    return async () => { stop = true; await done; };
}

/** A run finalized: its result set, its record saved, and then (TFP-222) its own folder removed. */
async function finished(id: string, root: string, timeoutMs: number) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const job = runJobs.get(id);
        // Before TFP-222 there was no run folder: the saved record is enough.
        if (job?.result && existsSync(join(setting("RUNS_ROOT")!, id)) && !existsSync(join(root, `run-${id}`))) return job;
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    const job = runJobs.get(id);
    throw new Error(`run ${id} not finalized in ${timeoutMs} ms: result ${job?.result?.runStatus ?? "none"}, folder ${existsSync(join(root, `run-${id}`)) ? "still there" : "gone"}; ${job?.outputChunks.join("").slice(-1500)}`);
}

test("in a real browser: two app runs started at once, while another run's folder is made and removed, each execute all their tests in a folder of their own, removed when they finish (state transition)", { skip: needsChromium }, async () => {
    const root = join(process.cwd(), ".playwright-runs");
    mkdirSync(root, { recursive: true });
    const stopChurn = churn(root);
    let ids: string[] = [];
    try {
        const [first, second] = await Promise.all([startRunJob(suite, ["functional"], "fast", origin), startRunJob(suite, ["functional"], "fast", origin)]);
        ids = [first.runId, second.runId];
        // Each run's own folder, holding its spec and its config (asserted after what the runs executed).
        // TFP-155: the suite as generated (suite-<id>.ts) beside the unit file Playwright runs (one, for this suite).
        const layout = ids.map((id) => [existsSync(join(root, `run-${id}`, `suite-${id}.ts`)) && existsSync(join(root, `run-${id}`, "001-suite.spec.ts")), existsSync(join(root, `run-${id}`, "playwright.config.ts"))]);
        // Finalized: each record saved where persistence keeps runs, then its folder removed.
        const jobs = await Promise.all(ids.map((id) => finished(id, root, 180_000)));
        await stopChurn();
        for (const job of jobs) {
            const output = job.outputChunks.join("");
            assert.equal(job.result?.progress.totalTests, 3, `${job.id}: ${job.result?.runStatus}; ${(job.result?.output ?? output).slice(0, 1500)}`);
            assert.equal(job.result?.progress.passedTests, 3, `${job.id}: ${output.slice(-1500)}`);
            assert.doesNotMatch(output, /ENOENT|scandir/);
        }
        assert.deepEqual(layout, [[true, true], [true, true]], "each run's spec and config in run-<id>");
    } finally {
        await stopChurn();
        for (const id of ids) rmSync(join(root, `artifacts-${id}`), { recursive: true, force: true });
    }
});

const HOUR = 60 * 60 * 1000;

/** An artifacts-<id> folder holding one file, last changed `ageMs` ago. */
function artifactFolder(root: string, id: string, ageMs: number) {
    const dir = join(root, `artifacts-${id}`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "trace.zip"), "x");
    const at = new Date(Date.now() - ageMs);
    utimesSync(dir, at, at);
    return dir;
}

/** A saved run's run.json, its evidence at `filePath`; `text` replaces the record. */
function savedRun(id: string, filePath: string, text?: string) {
    const dir = join(setting("RUNS_ROOT")!, id);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "run.json"), text ?? JSON.stringify({ runId: id, artifactFiles: { a: { filePath, fileName: "trace.zip", contentType: "application/zip" } } }));
}

const sweepRoot = join(scratch, "playwright-runs");

test("TFP-242 removed: an aged artifacts folder of a run that was never saved", async () => {
    const dir = artifactFolder(sweepRoot, randomUUID(), 2 * HOUR);
    await removeOrphanedArtifactFolders(sweepRoot, []);
    assert.equal(existsSync(dir), false);
});

test("TFP-242 removed: an aged folder left behind by a saved run whose evidence moved out", async () => {
    const id = randomUUID();
    const dir = artifactFolder(sweepRoot, id, 2 * HOUR);
    savedRun(id, join(setting("RUNS_ROOT")!, id, "evidence", "trace.zip"));
    await removeOrphanedArtifactFolders(sweepRoot, []);
    assert.equal(existsSync(dir), false);
});

test("TFP-242 removed: a saved run pointing at a folder whose name only starts with this one doesn't keep it", async () => {
    const id = randomUUID();
    const dir = artifactFolder(sweepRoot, id, 2 * HOUR);
    savedRun(id, join(`${dir}0`, "trace.zip"));
    await removeOrphanedArtifactFolders(sweepRoot, []);
    assert.equal(existsSync(dir), false);
});

test("TFP-242 kept: an active run's folder, however old", async () => {
    const id = randomUUID();
    const dir = artifactFolder(sweepRoot, id, 5 * HOUR);
    await removeOrphanedArtifactFolders(sweepRoot, [id]);
    assert.equal(existsSync(dir), true);
});

test("TFP-242 kept: a young folder; the hour is the boundary", async () => {
    const young = artifactFolder(sweepRoot, randomUUID(), HOUR - 60_000);
    const aged = artifactFolder(sweepRoot, randomUUID(), HOUR + 60_000);
    await removeOrphanedArtifactFolders(sweepRoot, []);
    assert.equal(existsSync(young), true);
    assert.equal(existsSync(aged), false);
});

test("TFP-242 kept: a folder a saved run still points to, its evidence not moved", async () => {
    const id = randomUUID();
    const dir = artifactFolder(sweepRoot, id, 2 * HOUR);
    savedRun(id, join(dir, "trace.zip"));
    await removeOrphanedArtifactFolders(sweepRoot, []);
    assert.equal(existsSync(join(dir, "trace.zip")), true);
});

test("TFP-242 kept: a saved run whose record can't be read might point here", async () => {
    const id = randomUUID();
    const dir = artifactFolder(sweepRoot, id, 2 * HOUR);
    savedRun(id, "", "{ not json");
    await removeOrphanedArtifactFolders(sweepRoot, []);
    assert.equal(existsSync(dir), true);
});

test("TFP-242 kept: anything that isn't artifacts-<a run id>", async () => {
    const notARun = artifactFolder(sweepRoot, "not-a-run-id", 2 * HOUR);
    const other = join(sweepRoot, `run-${randomUUID()}`);
    const samePrefixLength = join(sweepRoot, `artefacts-${randomUUID()}`);
    const at = new Date(Date.now() - 2 * HOUR);
    for (const dir of [other, samePrefixLength]) {
        mkdirSync(dir, { recursive: true });
        utimesSync(dir, at, at);
    }
    const file = join(sweepRoot, `artifacts-${randomUUID()}`);
    writeFileSync(file, "x");
    utimesSync(file, at, at);
    await removeOrphanedArtifactFolders(sweepRoot, []);
    assert.deepEqual([existsSync(notARun), existsSync(other), existsSync(samePrefixLength), existsSync(file)], [true, true, true, true]);
});

test("TFP-242 removed: a saved run pointing at another drive doesn't keep it", async () => {
    const id = randomUUID();
    const dir = artifactFolder(sweepRoot, id, 2 * HOUR);
    savedRun(id, "Z:\\elsewhere\\trace.zip");
    await removeOrphanedArtifactFolders(sweepRoot, []);
    assert.equal(existsSync(dir), false);
});

test("TFP-242 kept: a saved run's path that differs only in the drive letter's case", async () => {
    const id = randomUUID();
    const dir = artifactFolder(sweepRoot, id, 2 * HOUR);
    const flipped = dir.replace(/^[a-z]:/i, (drive) => (drive === drive.toUpperCase() ? drive.toLowerCase() : drive.toUpperCase()));
    savedRun(id, join(flipped, "trace.zip"));
    await removeOrphanedArtifactFolders(sweepRoot, []);
    assert.equal(existsSync(dir), true);
});

test("TFP-242 kept: a saved record's malformed entry keeps the folder and doesn't stop the sweep", async () => {
    const id = randomUUID();
    const dir = artifactFolder(sweepRoot, id, 2 * HOUR);
    savedRun(id, "", JSON.stringify({ runId: id, artifactFiles: { a: {} } }));
    await removeOrphanedArtifactFolders(sweepRoot, []);
    assert.equal(existsSync(dir), true);
});

test("TFP-242 kept: a real saved run, while a test points RUNS_ROOT at a scratch folder but shares .playwright-runs", async () => {
    const id = randomUUID();
    const dir = artifactFolder(sweepRoot, id, 2 * HOUR);
    const real = join(process.cwd(), "runs", id);
    mkdirSync(real, { recursive: true });
    try {
        await removeOrphanedArtifactFolders(sweepRoot, []);
        assert.equal(existsSync(dir), true);
    } finally {
        rmSync(real, { recursive: true, force: true });
    }
});

test("TFP-242 in a real browser: starting a run sweeps an orphaned artifacts folder", { skip: needsChromium }, async () => {
    const root = join(process.cwd(), ".playwright-runs");
    const dir = artifactFolder(root, randomUUID(), 2 * HOUR);
    let id = "";
    try {
        id = (await startRunJob(suite, ["functional"], "fast", origin)).runId;
        assert.equal(existsSync(dir), false);
        await finished(id, root, 180_000);
    } finally {
        rmSync(dir, { recursive: true, force: true });
        if (id) rmSync(join(root, `artifacts-${id}`), { recursive: true, force: true });
    }
});
