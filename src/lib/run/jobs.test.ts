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

// --- Phase 36 TFP-125: a suite with nothing to run is not a failed run ------

const { mockGenerate } = await import("../generate/mock/index.ts");
const { normalizeContentRules, normalizeTestAuditMode } = await import("../generate/normalize.ts");

const NO_TESTS_REPORT = JSON.stringify({ suites: [], errors: [{ message: "Error: No tests found.\nMake sure that arguments are regular expressions matching test files." }], stats: { duration: 1, expected: 0, unexpected: 0, flaky: 0, skipped: 0 } });

// A sign-in page only: database is inspected and found not applicable, so the
// template writes no test at all, just the note saying why.
const SIGN_IN_ONLY = {
    pages: [{
        path: "/login", url: "https://jobs-test.example/login", title: "Login", metaDescription: "", headings: [], buttons: [], links: [], visibleTextSnippets: [],
        actionableElements: [
            { text: "", url: null, category: "form", elementType: "form", containerLabel: "", expectedStatus: null, isVisible: true, ariaPressed: null, ariaSelected: null, ariaChecked: null, ariaExpanded: null, groupId: null, locator: { role: null, name: "", label: "", placeholder: "", id: "", inputType: "" } },
            { text: "", url: null, category: "form", elementType: "input", containerLabel: "", expectedStatus: null, isVisible: true, ariaPressed: null, ariaSelected: null, ariaChecked: null, ariaExpanded: null, groupId: null, locator: { role: null, name: "password", label: "Password", placeholder: "", id: "password", inputType: "password" } },
        ],
    }],
};

async function finalizeWithSuite(suite: string, report: string, overrides: Record<string, unknown> = {}) {
    const job = makeJob({ selectedPractices: ["database"], contentProfile: SIGN_IN_ONLY, ...overrides });
    await writeFile(job.testFile, suite, "utf8");
    await writeFile(job.jsonReportFile, report, "utf8");
    await finalizeRunJob(job as never);
    return job as typeof job & { result: { runStatus: string; passed: boolean; output: string; report?: { summary: { releaseRecommendation: string }; emptyAreas?: Array<{ area: string; reasons: string[] }> } } };
}

test("a suite that declares no test has nothing to run: status 'empty', its report kept, the area's reason in the output", async () => {
    const suite = mockGenerate("https://jobs-test.example", "Check that data entered is saved.", ["database"], SIGN_IN_ONLY as never, normalizeContentRules(undefined), normalizeTestAuditMode(undefined));
    assert.equal((suite.match(/\btest\s*\(/g) ?? []).length, 0, "precondition: the template wrote no test");
    const job = await finalizeWithSuite(suite, NO_TESTS_REPORT);
    assert.equal(job.status, "empty");
    assert.equal(job.result.runStatus, "empty");
    assert.equal(job.result.passed, false);
    assert.match(job.result.output, /^Nothing to run: the generated suite has no tests\.\nDatabase: no form that saves visible text was found/);
    assert.equal(job.result.report?.summary.releaseRecommendation, "Nothing to run: the suite has no tests");
    assert.deepEqual(job.result.report?.emptyAreas?.map((a) => a.area), ["Database"]);
});

test("a suite that declares tests yet ran none is still a failed run", async () => {
    const suite = "import { test } from '@playwright/test';\ntest('a', async () => {});\n";
    const job = await finalizeWithSuite(suite, NO_TESTS_REPORT);
    assert.equal(job.status, "failed");
    assert.equal(job.result.report, undefined);
});

test("an empty suite with any other error is still a failed run", async () => {
    const suite = "import { test } from '@playwright/test';\n// no tests\n";
    const report = JSON.stringify({ suites: [], errors: [{ message: "SyntaxError: Unexpected token" }], stats: { duration: 1, expected: 0, unexpected: 0, flaky: 0, skipped: 0 } });
    const job = await finalizeWithSuite(suite, report);
    assert.equal(job.status, "failed");
});
