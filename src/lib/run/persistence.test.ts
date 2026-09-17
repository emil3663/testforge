/**
 * Tests for src/lib/run/persistence.ts (Phase 17 Group 1).
 *
 * The property that matters: a finished run's report, suite, and evidence
 * must be readable using nothing but runs/<runId>/ on disk - no reference
 * to the in-memory job that produced it. That's the literal definition of
 * "survives a server restart", so every persistence test proves it the
 * same way: persist, then read back through a fresh runId lookup only.
 *
 * TESTFORGE_RUNS_ROOT points RUNS_ROOT at a fresh mkdtemp directory per
 * run and removes it afterward - this suite must never touch the real
 * runs/ directory a live dev server is using.
 *
 * Run: node --experimental-strip-types --test src/lib/run/persistence.test.ts
 */
import assert from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";

const scratchRoot = mkdtempSync(join(tmpdir(), "testforge-persistence-test-"));
process.env.TESTFORGE_RUNS_ROOT = join(scratchRoot, "runs");

const {
    archiveRun,
    listRunRecords,
    loadRunRecord,
    markRunAccessed,
    persistRunJob,
    runEvidenceDir,
    runSuitePath,
    setRunPinned,
    sweepAutomaticArchiving,
} = await import("./persistence.ts");

const jobFilesRoot = join(scratchRoot, "job-files");

before(async () => {
    await mkdir(jobFilesRoot, { recursive: true });
});

after(() => {
    rmSync(scratchRoot, { recursive: true, force: true });
});

function mustExist<T>(value: T | null | undefined, message: string): asserts value is T {
    assert.ok(value, message);
}

function executionRecord(title: string, status: "Passed" | "Failed") {
    return {
        id: randomUUID(),
        title,
        description: "",
        suite: "s",
        area: "Functional",
        interactionType: null,
        browser: "chromium",
        status,
        duration: 10,
        remarks: "",
        rawMessage: "",
        reproductionSteps: [],
        artifacts: [],
        order: 0,
    };
}

function fakeResult(runId: string, failingTitles: string[], passingTitles: string[] = []) {
    const execution = [
        ...failingTitles.map((title) => executionRecord(title, "Failed")),
        ...passingTitles.map((title) => executionRecord(title, "Passed")),
    ];

    return {
        runId,
        runStatus: failingTitles.length > 0 ? "failed" : "passed",
        passed: failingTitles.length === 0,
        output: "",
        duration: 1000,
        progress: {
            totalTests: execution.length,
            startedTests: execution.length,
            completedTests: execution.length,
            passedTests: passingTitles.length,
            failedTests: failingTitles.length,
            flakyTests: 0,
            blockedTests: 0,
            currentTestTitle: null,
            currentLinkLabel: null,
            lastCompletedTitle: null,
            activeExecutions: [],
            plannedExecutions: [],
        },
        report: {
            summary: {
                planned: execution.length, executed: execution.length, passed: passingTitles.length,
                failed: failingTitles.length, blocked: 0, flaky: 0, duration: 1000,
                releaseRecommendation: "", defectDistribution: { Critical: 0, Major: 0, Minor: 0 },
                passFailRatio: { passed: passingTitles.length, failed: failingTitles.length },
                browsers: ["chromium"], defectTrend: [],
            },
            execution,
            defects: { issues: [], heatmap: [] },
            coverage: { percentage: 0, covered: 0, total: execution.length, uncovered: [], matrix: [] },
            performance: { totalDuration: 0, averageDuration: 0, throughput: 0, slowestTests: [], pageResponseTimes: [], resourceUtilization: "", scalability: "" },
            usability: { successRate: 0, findings: [], videoClips: "", sessionEvidence: [], tasksCompleted: 0, totalTasks: 0 },
            seo: { requested: false, score: 0, statusLabel: "", passedChecks: 0, failedChecks: 0, notCoveredChecks: 0, totalChecks: 0, checks: [], pageGroups: [], findings: [], strengths: [], recommendations: [] },
            rawOutput: "",
        },
    };
}

async function makeJob(overrides: Record<string, unknown> = {}) {
    const id = randomUUID();
    const testFile = join(jobFilesRoot, `suite-${id}.spec.ts`);
    const suiteSource = `import { test, expect } from '@playwright/test';\ntest('probe ${id}', async () => { expect(true).toBe(true); });\n`;
    await writeFile(testFile, suiteSource, "utf8");

    const baseUrl = (overrides.baseUrl as string) ?? `https://persistence-test.example/${randomUUID()}`;

    return {
        id,
        testFile,
        jsonReportFile: join(jobFilesRoot, "unused-report.json"),
        reporterFile: join(jobFilesRoot, "unused-reporter.cjs"),
        artifactDir: join(jobFilesRoot, `artifacts-${id}`),
        baseUrl,
        description: "persistence unit test job",
        auditMode: "fast",
        selectedPractices: ["functional"],
        createdAt: Date.now(),
        finishedAt: Date.now() + 1000,
        artifactFiles: new Map(),
        result: fakeResult(id, []),
        suiteSource,
        ...overrides,
    };
}

test("round-trip: read back with no reference to the originating job models a restart", async () => {
    const job = await makeJob();

    const returnedArtifacts = await persistRunJob(job as never);
    assert.deepEqual(returnedArtifacts, {}, "no artifacts were declared on this job");

    // Deliberately drop `job` from scope here on: loadRunRecord must work
    // from runId alone, exactly as a fresh process (no in-memory job map)
    // would after a restart.
    const runId = job.id;
    const record = await loadRunRecord(runId);

    mustExist(record, "run.json must be readable from disk alone");
    assert.equal(record.runId, runId);
    assert.equal(record.baseUrl, job.baseUrl);
    assert.equal(record.description, "persistence unit test job");
    assert.equal(record.pinned, false);
    assert.equal(record.retention, "full");
    assert.equal(record.lastAccessedAt, null);
    mustExist(record.result.report, "the fake result must carry a report");
    assert.equal(record.result.report.execution.length, 0);

    const persistedSuite = await readFile(runSuitePath(runId), "utf8");
    assert.equal(persistedSuite, job.suiteSource, "suite.spec.ts must be byte-for-byte identical to the executed code");
});

test("lastAccessedAt: null after persisting, set on first access, unchanged on a second", async () => {
    const job = await makeJob();
    await persistRunJob(job as never);

    const fresh = await loadRunRecord(job.id);
    mustExist(fresh, "record must exist right after persisting");
    assert.equal(fresh.lastAccessedAt, null, "must be null immediately after persisting");

    await markRunAccessed(job.id);
    const afterFirst = await loadRunRecord(job.id);
    mustExist(afterFirst, "record must exist after markRunAccessed");
    assert.notEqual(afterFirst.lastAccessedAt, null, "must be set after the first access");
    const firstTimestamp = afterFirst.lastAccessedAt;

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 5));
    await markRunAccessed(job.id);
    const afterSecond = await loadRunRecord(job.id);
    mustExist(afterSecond, "record must exist after a second markRunAccessed");
    assert.equal(afterSecond.lastAccessedAt, firstTimestamp, "a second access must not bump the timestamp");
});

test("evidence move: files land under evidence/, relative structure preserved, original path is gone", async () => {
    const job = await makeJob();
    await mkdir(job.artifactDir, { recursive: true });
    const nestedDir = join(job.artifactDir, "test-1-chromium");
    await mkdir(nestedDir, { recursive: true });
    const traceFile = join(nestedDir, "trace.zip");
    await writeFile(traceFile, "fake-trace-bytes", "utf8");
    job.artifactFiles.set("artifact-1", { filePath: traceFile, fileName: "trace.zip", contentType: "application/zip" });

    const returnedArtifacts = await persistRunJob(job as never);

    const movedPath = returnedArtifacts["artifact-1"].filePath;
    assert.ok(movedPath.startsWith(runEvidenceDir(job.id)), "moved artifact must live under runs/<runId>/evidence/");
    assert.equal(await readFile(movedPath, "utf8"), "fake-trace-bytes", "content must survive the move unchanged");

    const originalStillThere = await readFile(traceFile, "utf8").then(() => true, () => false);
    assert.equal(originalStillThere, false, "evidence must be MOVED, not copied - the original path must be gone");
});

test("evidence move failure: falls back to the original path instead of losing the record", async () => {
    const job = await makeJob();
    // Point the artifact at a file that was never created, so rename() must
    // fail with ENOENT - the code's documented fallback path.
    const missingPath = join(job.artifactDir, "never-created", "trace.zip");
    job.artifactFiles.set("artifact-1", { filePath: missingPath, fileName: "trace.zip", contentType: "application/zip" });

    const returnedArtifacts = await persistRunJob(job as never);

    assert.equal(
        returnedArtifacts["artifact-1"].filePath,
        resolve(missingPath),
        "on a failed rename, the record must keep the artifact's original (resolved) path rather than dropping it"
    );

    const record = await loadRunRecord(job.id);
    assert.ok(record, "the run record must still be written even when an artifact failed to move");
});

test("pin overrides sweep: a pinned, superseded, no-longer-failing run is never auto-archived", async () => {
    const baseUrl = `https://pin-test.example/${randomUUID()}`;
    const older = await makeJob({ baseUrl, finishedAt: Date.now(), result: fakeResult(randomUUID(), ["flaky login button"]) });
    await persistRunJob(older as never);
    await setRunPinned(older.id, true);

    const newer = await makeJob({ baseUrl, finishedAt: Date.now() + 1000, result: fakeResult(randomUUID(), [], ["flaky login button"]) });
    await persistRunJob(newer as never);

    const archived = await sweepAutomaticArchiving();
    assert.ok(!archived.includes(older.id), "a pinned run must never be swept, even when superseded and its failure is fixed");

    const stillFull = await loadRunRecord(older.id);
    mustExist(stillFull, "the pinned run's record must still exist");
    assert.equal(stillFull.retention, "full", "pinned run's retention must remain full after the sweep");
});

test("archive: keeps run.json and suite.spec.ts, deletes only evidence/, sets retention to archived", async () => {
    const job = await makeJob();
    await mkdir(job.artifactDir, { recursive: true });
    const traceFile = join(job.artifactDir, "trace.zip");
    await writeFile(traceFile, "fake-trace-bytes", "utf8");
    job.artifactFiles.set("artifact-1", { filePath: traceFile, fileName: "trace.zip", contentType: "application/zip" });
    await persistRunJob(job as never);

    const archivedRecord = await archiveRun(job.id);
    mustExist(archivedRecord, "archiveRun must return the updated record");
    assert.equal(archivedRecord.retention, "archived");
    assert.deepEqual(archivedRecord.artifactFiles, {}, "artifactFiles must be cleared on archive");

    const suiteAfterArchive = await readFile(runSuitePath(job.id), "utf8");
    assert.equal(suiteAfterArchive, job.suiteSource, "suite.spec.ts must survive archiving");

    const recordAfterArchive = await loadRunRecord(job.id);
    mustExist(recordAfterArchive, "run.json must survive archiving");
    mustExist(recordAfterArchive.result.report, "the fake result must carry a report");
    assert.equal(recordAfterArchive.result.report.execution.length, 0, "run.json's report must survive archiving untouched");

    const evidenceDirGone = await readFile(join(runEvidenceDir(job.id), "trace.zip"), "utf8").then(() => true, () => false);
    assert.equal(evidenceDirGone, false, "evidence/ must actually be deleted from disk");
});

test("still-open-defect exemption: a run is swept once its failure is fixed elsewhere, not before", async () => {
    const baseUrl = `https://still-open-test.example/${randomUUID()}`;
    const stillBroken = await makeJob({ baseUrl, finishedAt: Date.now(), result: fakeResult(randomUUID(), ["checkout button unresponsive"]) });
    await persistRunJob(stillBroken as never);

    const newestStillFailing = await makeJob({ baseUrl, finishedAt: Date.now() + 1000, result: fakeResult(randomUUID(), ["checkout button unresponsive"]) });
    await persistRunJob(newestStillFailing as never);

    const sweepWhileStillOpen = await sweepAutomaticArchiving();
    assert.ok(!sweepWhileStillOpen.includes(stillBroken.id), "a run must not be archived while it is the live evidence for a still-failing test");

    // Now the newest run for this baseUrl shows that test passing - the fix landed.
    const newestNowFixed = await makeJob({ baseUrl, finishedAt: Date.now() + 2000, result: fakeResult(randomUUID(), [], ["checkout button unresponsive"]) });
    await persistRunJob(newestNowFixed as never);

    const sweepAfterFix = await sweepAutomaticArchiving();
    assert.ok(sweepAfterFix.includes(stillBroken.id), "once the fix lands in a newer run, the older run must become sweep-eligible");
    assert.ok(sweepAfterFix.includes(newestStillFailing.id), "the intermediate run (also now fixed, also superseded) must be swept too");
});

test("listRunRecords includes persisted runs", async () => {
    const job = await makeJob();
    await persistRunJob(job as never);

    const records = await listRunRecords();
    assert.ok(records.some((record) => record.runId === job.id));
});
