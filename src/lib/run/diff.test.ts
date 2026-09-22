/**
 * Tests for Phase 17 Group 4 (diffing two runs - TFP-073),
 * docs/decisions/phase-17-run-persistence-decision-record.md.
 *
 * The property that matters, from the decision record's own acceptance
 * criteria: given two runIds for the same baseUrl, the diff returns
 * specific test names and specific coverage deltas, not a percentage-only
 * summary - proven here against a deliberately constructed difference (a
 * regenerated suite with one fewer test, the record's own example), not a
 * synthetic all-zero case.
 *
 * TESTFORGE_RUNS_ROOT points RUNS_ROOT at a fresh mkdtemp directory, same
 * isolation pattern as persistence.test.ts.
 *
 * Requires the "@/" alias resolution diff.ts uses at runtime - run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/run/diff.test.ts
 */
import assert from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";

const scratchRoot = mkdtempSync(join(tmpdir(), "testforge-diff-test-"));
process.env.TESTFORGE_RUNS_ROOT = join(scratchRoot, "runs");

const { persistRunJob } = await import("@/lib/run/persistence");
const { diffRuns } = await import("./diff");

const jobFilesRoot = join(scratchRoot, "job-files");

before(async () => {
    await mkdir(jobFilesRoot, { recursive: true });
});

after(() => {
    rmSync(scratchRoot, { recursive: true, force: true });
});

function executionRecord(title: string, status: "Passed" | "Failed", browser = "chromium") {
    return {
        id: randomUUID(), title, description: "", suite: "s", area: "Functional",
        interactionType: null, browser, status, duration: 10, remarks: "", rawMessage: "",
        reproductionSteps: [], artifacts: [], order: 0,
    };
}

function coverageItem(requirement: string, percentage: number) {
    return { requirement, status: percentage === 100 ? "covered" : percentage === 0 ? "uncovered" : "partial", tests: [], percentage };
}

function elementDetail(text: string, elementType = "button") {
    return {
        text, url: null, category: "form", elementType, containerLabel: "",
        expectedStatus: null, isVisible: true, ariaPressed: null, ariaSelected: null,
        ariaChecked: null, ariaExpanded: null, groupId: null,
        locator: { role: "button", name: text, label: "", placeholder: "", id: "", inputType: "" },
    };
}

async function makeAndPersistJob(overrides: Record<string, unknown>) {
    const id = randomUUID();
    const testFile = join(jobFilesRoot, `suite-${id}.spec.ts`);
    await writeFile(testFile, `test('probe ${id}', async () => {});\n`, "utf8");

    const job = {
        id,
        testFile,
        jsonReportFile: join(jobFilesRoot, "unused-report.json"),
        reporterFile: join(jobFilesRoot, "unused-reporter.cjs"),
        artifactDir: join(jobFilesRoot, `artifacts-${id}`),
        baseUrl: "https://diff-test.example",
        description: "diff unit test job",
        auditMode: "fast",
        selectedPractices: ["functional"],
        createdAt: Date.now(),
        finishedAt: Date.now() + 1000,
        artifactFiles: new Map(),
        contentProfile: null,
        result: {
            runId: id, runStatus: "passed", passed: true, output: "", duration: 1000,
            progress: {
                totalTests: 0, startedTests: 0, completedTests: 0, passedTests: 0, failedTests: 0,
                flakyTests: 0, blockedTests: 0, currentTestTitle: null, currentLinkLabel: null,
                lastCompletedTitle: null, activeExecutions: [], plannedExecutions: [],
            },
            report: {
                summary: { planned: 0, executed: 0, passed: 0, failed: 0, blocked: 0, flaky: 0, duration: 1000, releaseRecommendation: "", defectDistribution: { Critical: 0, Major: 0, Minor: 0 }, passFailRatio: { passed: 0, failed: 0 }, browsers: ["chromium"], defectTrend: [] },
                execution: [],
                defects: { issues: [], heatmap: [] },
                coverage: { percentage: 100, covered: 1, total: 1, uncovered: [], matrix: [] },
                notTested: [],
                performance: { totalDuration: 0, averageDuration: 0, throughput: 0, slowestTests: [], pageResponseTimes: [], resourceUtilization: "", scalability: "" },
                usability: { successRate: 0, findings: [], videoClips: "", sessionEvidence: [], tasksCompleted: 0, totalTasks: 0 },
                seo: { requested: false, score: 0, statusLabel: "", passedChecks: 0, failedChecks: 0, notCoveredChecks: 0, totalChecks: 0, checks: [], pageGroups: [], findings: [], strengths: [], recommendations: [] },
                rawOutput: "",
            },
        },
        ...overrides,
    };

    await persistRunJob(job as never);
    return job;
}

test("Group 4: two runs with a deliberately dropped test - specific test names, not just a percentage", async () => {
    const baseUrl = "https://diff-test.example";
    const idA = randomUUID();
    const idB = randomUUID();
    const testFileA = join(jobFilesRoot, `suite-a-${idA}.spec.ts`);
    const testFileB = join(jobFilesRoot, `suite-b-${idB}.spec.ts`);
    await writeFile(testFileA, "// a\n", "utf8");
    await writeFile(testFileB, "// b\n", "utf8");

    function buildResult(runId: string, execution: ReturnType<typeof executionRecord>[], matrix: ReturnType<typeof coverageItem>[]) {
        const passed = execution.filter((e) => e.status === "Passed").length;
        return {
            runId, runStatus: "passed", passed: true, output: "", duration: 1000,
            progress: { totalTests: execution.length, startedTests: execution.length, completedTests: execution.length, passedTests: passed, failedTests: execution.length - passed, flakyTests: 0, blockedTests: 0, currentTestTitle: null, currentLinkLabel: null, lastCompletedTitle: null, activeExecutions: [], plannedExecutions: [] },
            report: {
                summary: { planned: execution.length, executed: execution.length, passed, failed: execution.length - passed, blocked: 0, flaky: 0, duration: 1000, releaseRecommendation: "", defectDistribution: { Critical: 0, Major: 0, Minor: 0 }, passFailRatio: { passed, failed: execution.length - passed }, browsers: ["chromium"], defectTrend: [] },
                execution,
                defects: { issues: [], heatmap: [] },
                coverage: { percentage: 100, covered: matrix.length, total: matrix.length, uncovered: [], matrix },
                notTested: [],
                performance: { totalDuration: 0, averageDuration: 0, throughput: 0, slowestTests: [], pageResponseTimes: [], resourceUtilization: "", scalability: "" },
                usability: { successRate: 0, findings: [], videoClips: "", sessionEvidence: [], tasksCompleted: 0, totalTasks: 0 },
                seo: { requested: false, score: 0, statusLabel: "", passedChecks: 0, failedChecks: 0, notCoveredChecks: 0, totalChecks: 0, checks: [], pageGroups: [], findings: [], strengths: [], recommendations: [] },
                rawOutput: "",
            },
        };
    }

    // Run A: 3 tests, all passing, 100% functional coverage, discovers Save + Undo.
    const runA = {
        id: idA, testFile: testFileA, jsonReportFile: join(jobFilesRoot, "unused-a.json"), reporterFile: join(jobFilesRoot, "unused-a.cjs"),
        artifactDir: join(jobFilesRoot, `artifacts-a-${idA}`), baseUrl, description: "run A", auditMode: "fast", selectedPractices: ["functional"],
        createdAt: Date.now(), finishedAt: Date.now() + 1000, artifactFiles: new Map(),
        contentProfile: {
            scannedAt: new Date().toISOString(), baseUrl,
            pages: [{ path: "/", url: baseUrl, title: "", metaDescription: "", headings: [], buttons: [], links: [], actionableElements: [elementDetail("Save"), elementDetail("Undo")], linkDetails: [], visibleTextSnippets: [] }],
        },
        result: buildResult(idA, [
            executionRecord("test A", "Passed"),
            executionRecord("test B", "Passed"),
            executionRecord("test C", "Passed"),
        ], [coverageItem("Functional", 100)]),
    };

    // Run B: regenerated suite with one fewer test ("test C" dropped, per
    // the decision record's own example), "test B" now fails, and
    // introspection now finds Save + Redo instead of Save + Undo.
    const runB = {
        id: idB, testFile: testFileB, jsonReportFile: join(jobFilesRoot, "unused-b.json"), reporterFile: join(jobFilesRoot, "unused-b.cjs"),
        artifactDir: join(jobFilesRoot, `artifacts-b-${idB}`), baseUrl, description: "run B", auditMode: "fast", selectedPractices: ["functional"],
        createdAt: Date.now() + 2000, finishedAt: Date.now() + 3000, artifactFiles: new Map(),
        contentProfile: {
            scannedAt: new Date().toISOString(), baseUrl,
            pages: [{ path: "/", url: baseUrl, title: "", metaDescription: "", headings: [], buttons: [], links: [], actionableElements: [elementDetail("Save"), elementDetail("Redo")], linkDetails: [], visibleTextSnippets: [] }],
        },
        result: buildResult(idB, [
            executionRecord("test A", "Passed"),
            executionRecord("test B", "Failed"),
        ], [coverageItem("Functional", 50)]),
    };

    await persistRunJob(runA as never);
    await persistRunJob(runB as never);

    const outcome = await diffRuns(idA, idB);
    assert.ok(outcome.ok, "diffing two same-baseUrl runs must succeed");
    if (!outcome.ok) {
        return;
    }
    const { diff } = outcome;

    // Specific test names, not a percentage-only summary.
    assert.deepEqual(
        diff.testsPassedInAOnly.map((t) => t.title).sort(),
        ["test B", "test C"],
        "test B (now failing) and test C (dropped entirely) must both be named as passed-in-A-only"
    );
    assert.deepEqual(diff.testsPassedInBOnly, [], "nothing newly passes in B that didn't already pass in A");

    const testBChange = diff.testsPassedInAOnly.find((t) => t.title === "test B");
    assert.equal(testBChange?.from, "Passed");
    assert.equal(testBChange?.to, "Failed");
    const testCChange = diff.testsPassedInAOnly.find((t) => t.title === "test C");
    assert.equal(testCChange?.to, "not run", "a test entirely absent from run B's suite must be reported as not run, not as failed");

    // Specific coverage deltas per area.
    const functionalDelta = diff.coverageDeltas.find((d) => d.area === "Functional");
    assert.ok(functionalDelta);
    assert.equal(functionalDelta!.percentageA, 100);
    assert.equal(functionalDelta!.percentageB, 50);
    assert.equal(functionalDelta!.delta, -50);

    // Newly discovered / newly missing elements between the two runs' own introspection snapshots.
    assert.deepEqual(diff.elementsNewlyDiscovered.map((e) => e.elementName), ["Redo"]);
    assert.deepEqual(diff.elementsNewlyMissing.map((e) => e.elementName), ["Undo"]);
});

test("Group 4: runs with different baseUrl values cannot be diffed", async () => {
    const jobX = await makeAndPersistJob({ baseUrl: "https://diff-test-x.example" });
    const jobY = await makeAndPersistJob({ baseUrl: "https://diff-test-y.example" });

    const outcome = await diffRuns(jobX.id, jobY.id);
    assert.equal(outcome.ok, false);
    if (!outcome.ok) {
        assert.equal(outcome.error, "different-base-url");
    }
});

test("Group 4: a missing runId is reported by which side was missing", async () => {
    const jobA = await makeAndPersistJob({});
    const missingId = randomUUID();

    const outcomeB = await diffRuns(jobA.id, missingId);
    assert.equal(outcomeB.ok, false);
    if (!outcomeB.ok) {
        assert.equal(outcomeB.error, "not-found-b");
    }

    const outcomeA = await diffRuns(missingId, jobA.id);
    assert.equal(outcomeA.ok, false);
    if (!outcomeA.ok) {
        assert.equal(outcomeA.error, "not-found-a");
    }
});
