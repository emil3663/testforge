/**
 * Tests for GET /api/runs/diff (Phase 17 Group 4, TFP-073) - runId
 * validation at the route boundary, same pattern TFP-066 established for
 * GET/DELETE /api/run and PATCH /api/runs, plus a real happy-path diff
 * through the actual route handler.
 *
 * Requires the bundler-style "@/" alias and "next/server" resolution this
 * route uses at runtime - run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/app/api/runs/diff/route.test.ts
 */
import assert from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";

const scratchRoot = mkdtempSync(join(tmpdir(), "testforge-diff-route-test-"));
process.env.TESTFORGE_RUNS_ROOT = join(scratchRoot, "runs");

const { GET } = await import("./route.ts");
const { NextRequest } = await import("next/server");
const { persistRunJob } = await import("@/lib/run/persistence");

const jobFilesRoot = join(scratchRoot, "job-files");

before(async () => {
    await mkdir(jobFilesRoot, { recursive: true });
});

after(() => {
    rmSync(scratchRoot, { recursive: true, force: true });
});

async function makeAndPersistJob(baseUrl: string) {
    const id = randomUUID();
    const testFile = join(jobFilesRoot, `suite-${id}.spec.ts`);
    await writeFile(testFile, `test('probe ${id}', async () => {});\n`, "utf8");

    const job = {
        id, testFile, jsonReportFile: join(jobFilesRoot, "unused-report.json"), reporterFile: join(jobFilesRoot, "unused-reporter.cjs"),
        artifactDir: join(jobFilesRoot, `artifacts-${id}`), baseUrl, description: "route test job", auditMode: "fast",
        selectedPractices: ["functional"], createdAt: Date.now(), finishedAt: Date.now() + 1000, artifactFiles: new Map(),
        contentProfile: null,
        result: {
            runId: id, runStatus: "passed", passed: true, output: "", duration: 1000,
            progress: { totalTests: 0, startedTests: 0, completedTests: 0, passedTests: 0, failedTests: 0, flakyTests: 0, blockedTests: 0, currentTestTitle: null, currentLinkLabel: null, lastCompletedTitle: null, activeExecutions: [], plannedExecutions: [] },
            report: {
                summary: { planned: 0, executed: 0, passed: 0, failed: 0, blocked: 0, flaky: 0, duration: 1000, releaseRecommendation: "", defectDistribution: { Critical: 0, Major: 0, Minor: 0 }, passFailRatio: { passed: 0, failed: 0 }, browsers: ["chromium"], defectTrend: [] },
                execution: [], defects: { issues: [], heatmap: [] },
                coverage: { percentage: 100, covered: 0, total: 0, uncovered: [], matrix: [] },
                notTested: [],
                performance: { totalDuration: 0, averageDuration: 0, throughput: 0, slowestTests: [], pageResponseTimes: [], resourceUtilization: "", scalability: "" },
                usability: { successRate: 0, findings: [], videoClips: "", sessionEvidence: [], tasksCompleted: 0, totalTasks: 0 },
                seo: { requested: false, score: 0, statusLabel: "", passedChecks: 0, failedChecks: 0, notCoveredChecks: 0, totalChecks: 0, checks: [], pageGroups: [], findings: [], strengths: [], recommendations: [] },
                rawOutput: "",
            },
        },
    };

    await persistRunJob(job as never);
    return id;
}

test("GET /api/runs/diff: traversal-shaped runId in either slot is rejected with 400", async () => {
    const req = new NextRequest(new URL(`http://localhost/api/runs/diff?a=${encodeURIComponent("../../evil")}&b=${randomUUID()}`));
    const res = await GET(req);
    const body = await res.json();

    assert.equal(res.status, 400);
    assert.equal(body.error, "a and b must be valid UUIDs");
});

test("GET /api/runs/diff: missing query params rejected with 400", async () => {
    const req = new NextRequest(new URL(`http://localhost/api/runs/diff?a=${randomUUID()}`));
    const res = await GET(req);
    const body = await res.json();

    assert.equal(res.status, 400);
    assert.equal(body.error, "Both a and b runId query params are required");
});

test("GET /api/runs/diff: real happy path returns a structured diff through the actual route handler", async () => {
    const baseUrl = "https://diff-route-test.example";
    const idA = await makeAndPersistJob(baseUrl);
    const idB = await makeAndPersistJob(baseUrl);

    const req = new NextRequest(new URL(`http://localhost/api/runs/diff?a=${idA}&b=${idB}`));
    const res = await GET(req);
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.runIdA, idA);
    assert.equal(body.runIdB, idB);
    assert.equal(body.baseUrl, baseUrl);
    assert.ok(Array.isArray(body.testsPassedInAOnly));
    assert.ok(Array.isArray(body.coverageDeltas));
});
