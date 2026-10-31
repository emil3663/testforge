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
    isValidRunId,
    runJsonPath,
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
            notTested: [],
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
        contentProfile: null,
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

test("TFP-267: runJsonPath refuses what isn't a run id, so a caller that skips the check can't leave the runs folder", async () => {
    for (const runId of ["../../etc/passwd", "..\\..\\secret", "", "not-a-uuid"]) {
        assert.throws(() => runJsonPath(runId), /Not a run id/, runId);
        await assert.rejects(loadRunRecord(runId), /Not a run id/, runId);
    }
    assert.match(runJsonPath(randomUUID()), /run\.json$/);
});

test("isValidRunId: accepts real randomUUID() output, in either case", () => {
    assert.equal(isValidRunId(randomUUID()), true);
    assert.equal(isValidRunId(randomUUID().toUpperCase()), true);
});

test("isValidRunId: rejects path-traversal-shaped and otherwise malformed input (TFP-066)", () => {
    const rejected = [
        "../../etc/evil",
        "..\\..\\evil",
        "/etc/passwd",
        "C:\\Windows\\System32",
        "valid-looking-but-not-a-uuid",
        `${randomUUID()}/../../evil`,
        `${randomUUID()}\u0000.txt`,
        "",
        "   ",
    ];

    for (const candidate of rejected) {
        assert.equal(isValidRunId(candidate), false, `expected rejection for ${JSON.stringify(candidate)}`);
    }

    // Non-string input can reach this from an untyped query param / JSON body.
    assert.equal(isValidRunId(null), false);
    assert.equal(isValidRunId(undefined), false);
    assert.equal(isValidRunId(12345), false);
    assert.equal(isValidRunId(["../../evil"]), false);
});

// --- TFP-198: GitHub issue #2 ------------------------------------------------

// The issue's drop-in test, unchanged. It fails on e5b1add's sweep: the link run never ran the
// accessibility test, and "not failing in the newest run" counted as fixed.
test("sweep: a newer run that never ran the failing test must not make the older run sweep-eligible", async () => {
    const baseUrl = `https://untested-defect.example/${randomUUID()}`;

    // An accessibility audit finds a real defect. Nobody fixes it.
    const accessibilityRun = await makeJob({
        baseUrl,
        selectedPractices: ["accessibility"],
        finishedAt: Date.now(),
        result: fakeResult(randomUUID(), ["tool list missing aria-checked"]),
    });
    await persistRunJob(accessibilityRun as never);

    // A later LINK audit of the same site. Different suite, different
    // practices - it never ran the accessibility test at all.
    const linkRun = await makeJob({
        baseUrl,
        selectedPractices: ["links"],
        finishedAt: Date.now() + 1000,
        result: fakeResult(randomUUID(), [], ["external links resolve"]),
    });
    await persistRunJob(linkRun as never);

    const archived = await sweepAutomaticArchiving();
    assert.ok(
        !archived.includes(accessibilityRun.id),
        "absence of a test is not evidence the defect is fixed - the only evidence for an untested, unfixed defect must not be swept"
    );
});

/** A result whose execution has one record per [title, status]. */
function resultWith(entries: Array<[string, "Passed" | "Failed" | "Not run" | "Blocked" | "Flaky"]>) {
    const result = fakeResult(randomUUID(), entries.filter(([, status]) => status === "Failed").map(([title]) => title));
    result.report.execution = entries.map(([title, status]) => ({ ...executionRecord(title, "Passed"), status })) as never;
    return result;
}

/**
 * TFP-198 (Decisions 1 and 2), ISTQB: decision table. Conditions: what the newest run of the
 * same suite says about the older run's failing test (passed; failed; absent; Not run; Blocked;
 * Flaky), and whether the two runs are the same suite (practices in another order; different
 * practices; Standard against Comprehensive). Only "passed, same suite" clears the older run.
 */
test("sweep (decision table): only a passing re-test of the same title, in the same suite, clears an older failing run", async () => {
    const SAME = ["functional", "accessibility"];
    const columns: Array<{ name: string; newer: ReturnType<typeof resultWith>; practices?: string[]; runMode?: unknown; archived: boolean }> = [
        { name: "same title passed", newer: resultWith([["save button works", "Passed"]]), archived: true },
        { name: "same title passed, practices in another order", newer: resultWith([["save button works", "Passed"]]), practices: ["accessibility", "functional"], archived: true },
        { name: "same title failed", newer: resultWith([["save button works", "Failed"]]), archived: false },
        { name: "title absent", newer: resultWith([["a different test", "Passed"]]), archived: false },
        { name: "title Not run", newer: resultWith([["save button works", "Not run"]]), archived: false },
        { name: "title Blocked", newer: resultWith([["save button works", "Blocked"]]), archived: false },
        { name: "title Flaky", newer: resultWith([["save button works", "Flaky"]]), archived: false },
        { name: "different practices", newer: resultWith([["save button works", "Passed"]]), practices: ["functional"], archived: false },
        { name: "Comprehensive against Standard", newer: resultWith([["save button works", "Passed"]]), runMode: { kind: "comprehensive", area: "accessibility", level: null, pageCap: 20 }, archived: false },
    ];
    for (const column of columns) {
        const baseUrl = `https://sweep-table.example/${randomUUID()}`;
        const older = await makeJob({ baseUrl, selectedPractices: SAME, finishedAt: Date.now(), result: fakeResult(randomUUID(), ["save button works"]) });
        await persistRunJob(older as never);
        const newer = await makeJob({ baseUrl, selectedPractices: column.practices ?? SAME, finishedAt: Date.now() + 1000, result: column.newer, ...(column.runMode ? { runMode: column.runMode } : {}) });
        await persistRunJob(newer as never);

        const archived = await sweepAutomaticArchiving();
        assert.equal(archived.includes(older.id), column.archived, `${column.name}: archived ${archived.includes(older.id)}`);
        const record = await loadRunRecord(older.id);
        mustExist(record, `${column.name}: the older run's record is still there`);
        assert.equal(record.retention, column.archived ? "archived" : "full", column.name);
    }
});

test("record writes are atomic: a write that fails leaves the previous run.json whole, not truncated", async () => {
    const job = await makeJob();
    await persistRunJob(job as never);
    const before = await readFile(join(process.env.TESTFORGE_RUNS_ROOT!, job.id, "run.json"), "utf8");

    // Something already sits where the temporary file goes, so the write fails before it can replace run.json.
    await mkdir(join(process.env.TESTFORGE_RUNS_ROOT!, job.id, "run.json.tmp"));
    await assert.rejects(setRunPinned(job.id, true));

    const after = await readFile(join(process.env.TESTFORGE_RUNS_ROOT!, job.id, "run.json"), "utf8");
    assert.equal(after, before, "run.json is exactly what it was");
    const record = await loadRunRecord(job.id);
    mustExist(record, "the run still loads");
    assert.equal(record.pinned, false);
    assert.ok((await listRunRecords()).some((listed) => listed.runId === job.id), "the run doesn't vanish from the list");
});

test("persistRunJob: an artifact in a sibling directory whose name starts with the artifact root's isn't treated as under it", async () => {
    const job = await makeJob();
    // artifacts-<id> is the job's root; artifacts-<id>0 is another directory whose name merely starts with it.
    const siblingDir = `${job.artifactDir}0`;
    await mkdir(siblingDir, { recursive: true });
    const stray = join(siblingDir, "shot.png");
    await writeFile(stray, "png", "utf8");
    job.artifactFiles = new Map([["a1", { filePath: stray, fileName: "shot.png", contentType: "image/png" }]]);

    const persisted = await persistRunJob(job as never);
    assert.equal(resolve(persisted.a1.filePath), resolve(join(runEvidenceDir(job.id), "shot.png")), "kept by its file name, not as '0/shot.png'");
});
