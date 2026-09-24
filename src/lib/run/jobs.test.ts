/**
 * Tests for finalizeRunJob's handling of a corrupted Playwright JSON report
 * (TFP-065, Phase 24 reliability audit).
 *
 * The property that matters: finalizeRunJob runs fire-and-forget
 * (`void finalizeRunJob(job)`), so an unhandled rejection inside it is
 * silently swallowed and the job is stuck "running" forever with no
 * recovery. A corrupted report file must not throw past the try/catch -
 * it must resolve into the same terminal state as "no report at all".
 *
 * Requires the bundler-style "@/" alias and extensionless imports that
 * jobs.ts uses at runtime - run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/run/jobs.test.ts
 */
import assert from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";

const scratchRoot = mkdtempSync(join(tmpdir(), "testforge-jobs-test-"));
process.env.TESTFORGE_RUNS_ROOT = join(scratchRoot, "runs");

const { createEmptyProgress, finalizeRunJob } = await import("./jobs.ts");

const jobFilesRoot = join(scratchRoot, "job-files");

before(async () => {
    await mkdir(jobFilesRoot, { recursive: true });
});

after(() => {
    rmSync(scratchRoot, { recursive: true, force: true });
});

function makeJob(overrides: Record<string, unknown> = {}) {
    const id = randomUUID();

    return {
        id,
        status: "running" as const,
        cancellationRequested: false,
        createdAt: Date.now() - 5000,
        finishedAt: null,
        pendingOutput: "",
        outputChunks: ["Playwright run output...\n"],
        progress: createEmptyProgress(),
        activeExecutions: new Map(),
        process: null,
        testFile: join(jobFilesRoot, `missing-suite-${id}.spec.ts`),
        jsonReportFile: join(jobFilesRoot, `report-${id}.json`),
        reporterFile: join(jobFilesRoot, `unused-reporter-${id}.cjs`),
        artifactDir: join(jobFilesRoot, `artifacts-${id}`),
        baseUrl: "https://jobs-test.example",
        description: "jobs unit test job",
        auditMode: "fast",
        selectedPractices: ["functional"],
        redactions: [] as string[],
        artifactFiles: new Map(),
        result: null as { runStatus: string; passed: boolean } | null,
        ...overrides,
    };
}

test("corrupted JSON report: job reaches a terminal status with a result, not 'running' forever", async () => {
    const job = makeJob();
    await writeFile(job.jsonReportFile, "{not valid json, this is a truncated/corrupted playwright report", "utf8");

    await finalizeRunJob(job as never);

    assert.notEqual(job.status, "running", "a corrupted report must not leave the job stuck running");
    assert.equal(job.status, "failed", "no usable report and not cancelled => the existing 'no report' finalize path (failed)");
    assert.ok(job.result, "job.result must be set so polling has a terminal snapshot to read");
    assert.equal(job.result?.runStatus, "failed");
    assert.equal(job.result?.passed, false);
    assert.ok(
        job.outputChunks.some((chunk) => chunk.includes("Playwright JSON report was corrupted")),
        "the parse failure must be visible in the run's raw output, not just swallowed"
    );
});

test("missing JSON report (baseline): same terminal 'failed' path as a corrupted one", async () => {
    const job = makeJob();
    // jsonReportFile deliberately never written - exercises the pre-existing
    // "no report" branch this fix must not regress.

    await finalizeRunJob(job as never);

    assert.equal(job.status, "failed");
    assert.ok(job.result);
    assert.equal(job.result?.runStatus, "failed");
});

test("corrupted JSON report while cancelled: terminal status is 'cancelled', not 'running'", async () => {
    const job = makeJob({ cancellationRequested: true });
    await writeFile(job.jsonReportFile, "]][[not json", "utf8");

    await finalizeRunJob(job as never);

    assert.equal(job.status, "cancelled");
    assert.ok(job.result);
    assert.equal(job.result?.runStatus, "cancelled");
});
