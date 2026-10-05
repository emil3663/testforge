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
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { randomUUID } from "node:crypto";

const scratchRoot = mkdtempSync(join(tmpdir(), "testforge-jobs-test-"));
process.env.TESTFORGE_RUNS_ROOT = join(scratchRoot, "runs");

const { createEmptyProgress, finalizeRunJob } = await import("./jobs.ts");
// Every module is loaded here, before the first test() is registered: on
// Node 22 a top-level await between tests lets the file's after() hook run
// early, removing scratchRoot before the tests registered after it.
const { mockGenerate } = await import("../generate/mock/index.ts");
const { normalizeContentRules, normalizeTestAuditMode } = await import("../generate/normalize.ts");

// Created at load; nothing asynchronous needs to happen before the tests.
const jobFilesRoot = join(scratchRoot, "job-files");
mkdirSync(jobFilesRoot, { recursive: true });

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

// --- Phase 35 TFP-132: a Comprehensive run is reported and saved as one ----

const { normalizeRunMode } = await import("../comprehensive/run-mode.ts");
const { loadRunRecord } = await import("./persistence.ts");

function passingReport(page: string) {
    return JSON.stringify({
        suites: [{ title: "s.spec.ts", specs: [], suites: [{ title: "Security Coverage", specs: [], suites: [{ title: `Page ${page}`, suites: [], specs: [{ id: "a", title: `TFSC-001: ${page} loads`, tests: [{ projectName: "chromium", status: "expected", annotations: [{ type: "page", description: page }], results: [{ duration: 5, retry: 0, errors: [] }] }] }] }] }] }],
        errors: [],
        stats: { duration: 5, expected: 1, unexpected: 0, flaky: 0, skipped: 0 },
    });
}

test("a Comprehensive run's report carries its area section, and its saved record names the run mode", async () => {
    const runMode = normalizeRunMode({ kind: "comprehensive", area: "security" });
    const job = makeJob({ runMode, workerCount: 1, selectedPractices: ["security"], contentProfile: null });
    await writeFile(job.testFile, "import { test } from '@playwright/test';\ntest('x', async () => {});\n", "utf8");
    await writeFile(job.jsonReportFile, passingReport("/"), "utf8");
    await finalizeRunJob(job as never);
    const result = (job as unknown as { result: { runStatus: string; report: { comprehensive?: { label: string; pages: unknown[]; workerNote: string } } } }).result;
    assert.equal(result.runStatus, "passed");
    assert.equal(result.report.comprehensive?.label, "Comprehensive security (passive)");
    assert.deepEqual(result.report.comprehensive?.pages, [{ path: "/", tests: 1, passed: 1, failed: 0, notRun: 0, findings: 0 }]);
    assert.match(result.report.comprehensive!.workerNote, /^One worker/);
    assert.deepEqual((await loadRunRecord(job.id))?.runMode, runMode);
});

test("a Standard run's report and saved record carry nothing new", async () => {
    const job = makeJob({ contentProfile: null });
    await writeFile(job.testFile, "import { test } from '@playwright/test';\ntest('x', async () => {});\n", "utf8");
    await writeFile(job.jsonReportFile, passingReport("/"), "utf8");
    await finalizeRunJob(job as never);
    const report = (job as unknown as { result: { report: Record<string, unknown> } }).result.report;
    assert.equal("comprehensive" in report, false);
    assert.equal("runMode" in ((await loadRunRecord(job.id)) as object), false);
});

// Phase 38 TFP-146: the per-gate Not run count follows the run's own
// interactive setting. Decision table: interactive off or on, against an
// interactive test held by its gate and an active test.
function gatedReport() {
    const skipped = (id: string, gate: string, reason: string) => ({ id, title: `${id}: t`, tests: [{ projectName: "chromium", status: "skipped", annotations: [{ type: "gate", description: gate }, { type: "skip", description: reason }], results: [{ duration: 0, retry: 0, errors: [] }] }] });
    return JSON.stringify({
        suites: [{ title: "s.spec.ts", specs: [], suites: [{ title: "Functional Coverage", suites: [], specs: [skipped("TFFU-001", "interactive", "interactive journey test: it only runs when TESTFORGE_INTERACTIVE=1 is set for the run"), skipped("TFFU-002", "active", "attack-shaped input: needs the ownership confirmation, not built yet")] }] }],
        errors: [],
        stats: { duration: 5, expected: 0, unexpected: 0, flaky: 0, skipped: 2 },
    });
}

test("the per-gate Not run count uses the run's interactive setting (TFP-146)", async () => {
    for (const [enableInteractive, expected] of [[false, { "read-only": 0, interactive: 1, active: 1 }], [true, { "read-only": 0, interactive: 0, active: 1 }]] as const) {
        const job = makeJob({ contentProfile: null, enableInteractive });
        await writeFile(job.testFile, "import { test } from '@playwright/test';\ntest('x', async () => {});\n", "utf8");
        await writeFile(job.jsonReportFile, gatedReport(), "utf8");
        await finalizeRunJob(job as never);
        const report = (job as unknown as { result: { report: { summary: { notRunByGate?: unknown } } } }).result.report;
        assert.deepEqual(report.summary.notRunByGate, expected, `enableInteractive ${enableInteractive}`);
    }
});

// Phase 35 TFP-135 (Decision 5): a failing local-model test changes no verdict.
test("a Comprehensive run whose only failure is a local-model test is saved as passed, the failure shown as needing review", async () => {
    const runMode = normalizeRunMode({ kind: "comprehensive", area: "accessibility" });
    const job = makeJob({ runMode, workerCount: 1, selectedPractices: ["accessibility"], contentProfile: null, generation: { generatedBy: "template+ollama", model: "testforge-qwen7b:latest", gates: [] } });
    const report = JSON.parse(passingReport("/"));
    report.suites.push({
        title: "Local model (testforge-qwen7b:latest)",
        specs: [{ id: "m", title: "the home page greets the user by name", tests: [{ projectName: "chromium", status: "unexpected", results: [{ duration: 5, retry: 0, errors: [{ message: "Error: the greeting: expected 'Welcome back, Ada'" }] }] }] }],
        suites: [],
    });
    report.stats.unexpected = 1;
    await writeFile(job.testFile, "import { test } from '@playwright/test';\ntest('x', async () => {});\n", "utf8");
    await writeFile(job.jsonReportFile, JSON.stringify(report), "utf8");
    await finalizeRunJob(job as never);
    const result = (job as unknown as { result: { runStatus: string; report: { summary: { failed: number }; comprehensive: { model: { tests: { outcome: string }[] } } } } }).result;
    assert.equal(result.runStatus, "passed");
    assert.equal(result.report.summary.failed, 0);
    assert.deepEqual(result.report.comprehensive.model.tests.map((t) => t.outcome), ["failed: needs review"]);
});
