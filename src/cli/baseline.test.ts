/**
 * Phase 47 (TFP-246, Decision 5): `mr-onion run --baseline`. The baseline is found in the data folder before the run
 * ("latest": the newest run of the same site and tests), or copied in from an earlier job's run.json; one that can't
 * be used is exit 3 before anything starts; with one, only new failures fail the build.
 *
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/cli/baseline.test.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

const scratch = mkdtempSync(join(tmpdir(), "mr-onion-baseline-test-"));
process.env.MRONION_RUNS_ROOT = join(scratch, "runs");

const { buildConfig, ConfigError } = await import("./config.ts");
const { findBaseline } = await import("./baseline.ts");
const { EXIT, runTarget, verdictOf } = await import("./run.ts");
const { runJsonPath } = await import("../lib/run/persistence.ts");

after(() => rmSync(scratch, { recursive: true, force: true }));

const URL_ = "http://localhost:4200";
const config = (flags: Record<string, unknown> = {}) => buildConfig({}, { url: URL_, practices: ["functional", "seo/content"], ...flags }, scratch);

function record(overrides: { baseUrl?: string; practices?: string[]; finishedAt: string | undefined; runStatus?: string; runMode?: unknown; report?: boolean; auditMode?: string; enableInteractive?: boolean; login?: unknown; verdict?: unknown }) {
    const runId = randomUUID();
    return {
        runId,
        baseUrl: overrides.baseUrl ?? URL_,
        description: "",
        selectedPractices: overrides.practices ?? ["seo/content", "functional"],
        auditMode: overrides.auditMode ?? "fast",
        createdAt: overrides.finishedAt,
        finishedAt: overrides.finishedAt,
        pinned: false,
        retention: "full",
        lastAccessedAt: null,
        artifactFiles: {},
        contentProfile: null,
        ...(overrides.runMode ? { runMode: overrides.runMode } : {}),
        ...(overrides.enableInteractive !== undefined ? { enableInteractive: overrides.enableInteractive } : {}),
        ...(overrides.login !== undefined ? { login: overrides.login } : {}),
        ...(overrides.verdict !== undefined ? { verdict: overrides.verdict } : {}),
        result: { runId, runStatus: overrides.runStatus ?? "failed", passed: false, output: "", report: overrides.report === false ? null : { summary: {}, execution: [] } },
    };
}

async function store(run: ReturnType<typeof record>) {
    await mkdir(join(scratch, "runs", run.runId), { recursive: true });
    await writeFile(runJsonPath(run.runId), JSON.stringify(run), "utf8");
    return run;
}

test("--baseline latest: the newest finished run of the same site and tests in the data folder", async () => {
    assert.equal(await findBaseline(config({ baseline: "latest" })), null, "no run yet: a first run, no baseline");

    await store(record({ finishedAt: "2026-11-08T10:00:00.000Z" }));
    const newest = await store(record({ finishedAt: "2026-11-08T11:00:00.000Z" }));
    await store(record({ finishedAt: "2026-11-08T12:00:00.000Z", baseUrl: "http://localhost:3000" }));
    await store(record({ finishedAt: "2026-11-08T12:00:00.000Z", practices: ["functional"] }));
    await store(record({ finishedAt: "2026-11-08T12:00:00.000Z", runStatus: "cancelled" }));
    await store(record({ finishedAt: "2026-11-08T12:00:00.000Z", report: false, runStatus: "error" }));
    await store(record({ finishedAt: "2026-11-08T12:00:00.000Z", runMode: { kind: "comprehensive", area: "security", pageCap: 20 } }));
    // Other tests of the same site and areas: another audit mode, the interactive tests, a login; and no finish time.
    await store(record({ finishedAt: "2026-11-08T12:00:00.000Z", auditMode: "deep" }));
    await store(record({ finishedAt: "2026-11-08T12:00:00.000Z", enableInteractive: true }));
    await store(record({ finishedAt: "2026-11-08T12:00:00.000Z", login: { loginUrl: "/login", usernameEnv: "U", passwordEnv: "P" } }));
    await store(record({ finishedAt: undefined }));
    // Ordered by time, not by text: this one sorts after 11:00Z as text, but is 10:30Z.
    const offset = await store(record({ finishedAt: "2026-11-08T11:30:00.000+01:00" }));

    const found = await findBaseline(config({ baseline: "latest" }));
    assert.equal(found?.runId, newest.runId, `not ${offset.runId} (10:30Z), nor another audit mode, the interactive tests, a login or no finish time`);
    assert.equal(await findBaseline(config()), null, "without --baseline, none");
});

test("--baseline <run.json>: an earlier job's run.json is copied into the data folder and compared there", async () => {
    const earlier = record({ finishedAt: "2026-11-07T09:00:00.000Z" });
    const file = join(scratch, "previous-out-run.json");
    await writeFile(file, JSON.stringify(earlier), "utf8");

    const found = await findBaseline(config({ baseline: file }));
    assert.equal(found?.runId, earlier.runId);
    assert.deepEqual(JSON.parse(await readFile(runJsonPath(earlier.runId), "utf8")), earlier);
});

test("a baseline that can't be used is a ConfigError naming baseline", async () => {
    const write = async (name: string, value: unknown) => {
        const file = join(scratch, name);
        await writeFile(file, typeof value === "string" ? value : JSON.stringify(value), "utf8");
        return file;
    };
    const cases = [
        [join(scratch, "no-such-run.json"), /could not read/],
        [await write("not-json.json", "{"), /not valid JSON/],
        [await write("not-a-run.json", { report: {} }), /not a run's run\.json/],
        [await write("other-site.json", record({ finishedAt: "2026-11-07T09:00:00.000Z", baseUrl: "http://localhost:3000" })), /is a run of http:\/\/localhost:3000, not http:\/\/localhost:4200/],
        [await write("no-report.json", record({ finishedAt: "2026-11-07T09:00:00.000Z", report: false, runStatus: "error" })), /no report \(error\)/],
        [await write("no-finish.json", record({ finishedAt: undefined })), /no finishedAt/],
    ] as const;
    for (const [file, message] of cases) {
        await assert.rejects(findBaseline(config({ baseline: file })), (error: unknown) => error instanceof ConfigError && error.field === "baseline" && message.test(error.message), String(file));
    }
});

test("an unusable baseline is exit 3 before anything starts", async () => {
    const lines: string[] = [];
    const code = await runTarget(config({ baseline: join(scratch, "missing.json"), servers: [{ command: "node -e \"setInterval(() => {}, 1000)\"", port: 1 }], serverTimeout: 1 }), (line) => lines.push(line));
    assert.equal(code, EXIT.invalidConfig);
    assert.match(lines.join("\n"), /invalid configuration: baseline: could not read/);
    assert.ok(!lines.some((line) => /Starting|Crawling/.test(line)), lines.join("\n"));
});

test("with a baseline, only new failures fail the build", () => {
    const result = (executed: number) => ({ runStatus: "failed", output: "", report: { summary: { planned: 3, executed, passed: 1, failed: 2, flaky: 0, blocked: 0, notRun: 0 } } }) as never;
    const change = (title: string) => ({ title, browser: "chromium", from: "Failed" as const, to: "Failed" as const });
    const known = { known: [change("a"), change("b")], new: [], fixed: [change("c")] };
    const added = { ...known, new: [change("d")] };

    assert.equal(verdictOf(result(3), false, known).exitCode, EXIT.passed);
    assert.match(verdictOf(result(3), false, known).summary, /0 new failure\(s\), 2 known, 1 fixed/);
    assert.equal(verdictOf(result(3), false, added).exitCode, EXIT.failed);
    assert.equal(verdictOf(result(3), true, added).exitCode, EXIT.passed, "--report-only still reports, not fails");
    assert.equal(verdictOf(result(0), false, known).exitCode, EXIT.couldNotRun, "a run that executed nothing is never a pass");
    assert.equal(verdictOf(result(3), false).exitCode, EXIT.failed, "without a baseline, any failure fails (TFP-245)");
});

test("Decision 7: run.json and baseline.json in --out are redacted like every other file", async (t) => {
    const { writeOutputs } = await import("./run.ts");
    const { createEmptyProgress } = await import("../lib/run/jobs.ts");
    const out = join(scratch, "out-redacted");
    process.env.TFP246_TEST_USER = "ada-the-tester";
    process.env.TFP246_TEST_PASS = "s3cret-Pa55";
    t.after(() => {
        delete process.env.TFP246_TEST_USER;
        delete process.env.TFP246_TEST_PASS;
    });
    const login = { loginUrl: "/login", usernameEnv: "TFP246_TEST_USER", passwordEnv: "TFP246_TEST_PASS", usernameSelector: "#email", passwordSelector: "#password", submitSelector: "button[type=submit]", postLoginPath: "/account" };
    // A saved run whose record and comparison could each carry a login value, in an output line and a test's title.
    const run = await store({ ...record({ finishedAt: "2026-11-08T13:00:00.000Z" }), description: "signed in as ada-the-tester" });
    const job = { id: run.runId, result: { runId: run.runId, runStatus: "failed", passed: false, output: "s3cret-Pa55", duration: 1, progress: createEmptyProgress() }, artifactFiles: new Map() } as never;
    const change = { title: "account of ada-the-tester shows s3cret-Pa55", browser: "chromium", from: "Passed" as const, to: "Failed" as const };
    const comparison = { baseline: { runId: randomUUID(), finishedAt: "2026-11-08T12:00:00.000Z", from: "latest" }, diff: { failures: { known: [], new: [change], fixed: [] } } as never };
    await writeOutputs(config({ out, login }), job, "", {}, () => { }, comparison);

    for (const file of ["run.json", "baseline.json"]) {
        const text = await readFile(join(out, file), "utf8");
        assert.ok(!text.includes("s3cret-Pa55") && !text.includes("ada-the-tester"), `${file} still holds a login value`);
        assert.ok(text.includes("[redacted]"), `${file} shows where it was redacted`);
    }
    assert.equal(JSON.parse(await readFile(join(out, "run.json"), "utf8")).runId, run.runId, "run.json is the saved run's, for the next job's --baseline");
});

test("a run.json whose id is already in the data folder: its copy is that run; another run with the id is refused", async () => {
    const kept = await store(record({ finishedAt: "2026-11-06T09:00:00.000Z" }));
    // --out's run.json: the same run, redacted and indented, so not the same text.
    const copy = join(scratch, "redacted-copy.json");
    await writeFile(copy, JSON.stringify({ ...kept, description: "[redacted]" }, null, 2), "utf8");
    assert.equal((await findBaseline(config({ baseline: copy })))?.runId, kept.runId);
    assert.deepEqual(JSON.parse(await readFile(runJsonPath(kept.runId), "utf8")), kept, "the stored run is left as it was");

    const impostor = join(scratch, "same-id-other-run.json");
    await writeFile(impostor, JSON.stringify({ ...kept, finishedAt: "2026-11-06T10:00:00.000Z" }), "utf8");
    await assert.rejects(findBaseline(config({ baseline: impostor })), (error: unknown) => error instanceof ConfigError && /isn't that run/.test(error.message));
});

test("a run that can't be compared still writes its reports, then couldn't run; the comparison's log is redacted", async (t) => {
    const { finishRun, CouldNotRun } = await import("./run.ts");
    const { createEmptyProgress } = await import("../lib/run/jobs.ts");
    process.env.TFP246_TEST_USER = "ada-the-tester";
    process.env.TFP246_TEST_PASS = "s3cret-Pa55";
    t.after(() => {
        delete process.env.TFP246_TEST_USER;
        delete process.env.TFP246_TEST_PASS;
    });
    const login = { loginUrl: "/login", usernameEnv: "TFP246_TEST_USER", passwordEnv: "TFP246_TEST_PASS", usernameSelector: "#email", passwordSelector: "#password", submitSelector: "button[type=submit]", postLoginPath: "/account" };
    // A whole report, as the HTML export reads one.
    const report = (status: string) => {
        const passed = status === "Passed" ? 1 : 0;
        return {
            summary: { planned: 1, executed: 1, passed, failed: 1 - passed, blocked: 0, flaky: 0, notRun: 0, duration: 1, releaseRecommendation: "", defectDistribution: { Critical: 0, Major: 0, Minor: 0 }, passFailRatio: { passed, failed: 1 - passed }, browsers: ["chromium"], defectTrend: [] },
            execution: [{ id: "e1", title: "account of ada-the-tester", description: "", suite: "s", area: "Functional", interactionType: null, browser: "chromium", status, duration: 1, remarks: "", rawMessage: "", reproductionSteps: [], artifacts: [], order: 1 }],
            defects: { issues: [], heatmap: [] },
            coverage: { percentage: 100, covered: 0, total: 0, uncovered: [], matrix: [] },
            notTested: [],
            performance: { totalDuration: 0, averageDuration: 0, throughput: 0, slowestTests: [], pageResponseTimes: [], resourceUtilization: "", scalability: "" },
            usability: { successRate: 0, findings: [], videoClips: "", sessionEvidence: [], tasksCompleted: 0, totalTasks: 0 },
            seo: { requested: false, score: 0, statusLabel: "", passedChecks: 0, failedChecks: 0, notCoveredChecks: 0, totalChecks: 0, checks: [], pageGroups: [], findings: [], strengths: [], recommendations: [] },
            rawOutput: "",
        };
    };
    const baselineRun = await store({ ...record({ finishedAt: "2026-11-08T08:00:00.000Z" }), result: { runId: "x", runStatus: "passed", passed: true, output: "", report: report("Passed") } } as never);
    const baseline = { runId: baselineRun.runId, finishedAt: "2026-11-08T08:00:00.000Z", from: "test" };
    const jobWith = (id: string) => ({ id, result: { runId: id, runStatus: "failed", passed: false, output: "", duration: 1, progress: createEmptyProgress(), report: report("Failed") }, artifactFiles: new Map() }) as never;

    // This run was never saved, so it can't be compared.
    const unsaved = join(scratch, "out-unsaved");
    await assert.rejects(finishRun(config({ out: unsaved, login }), jobWith(randomUUID()), "", {}, () => { }, baseline), (error: unknown) => error instanceof CouldNotRun && /couldn't be compared with its baseline .* \(not-found-b\)/.test((error as Error).message));
    for (const file of ["report.json", "report.html", "junit.xml", "suite.spec.ts", "page-data.json"]) await readFile(join(unsaved, file), "utf8");

    // A saved one is: its new failure names a login value, which the log doesn't show.
    const saved = await store({ ...record({ finishedAt: "2026-11-08T09:00:00.000Z" }), result: { runId: "y", runStatus: "failed", passed: false, output: "", report: report("Failed") } } as never);
    const lines: string[] = [];
    const code = await finishRun(config({ out: join(scratch, "out-saved"), login }), jobWith(saved.runId), "", {}, (line) => lines.push(line), baseline);
    assert.equal(code, EXIT.failed);
    assert.ok(lines.some((line) => /account of \[redacted\] \[chromium\] \(Passed -> Failed\)/.test(line)), lines.join("\n"));
    assert.ok(!lines.join("\n").includes("ada-the-tester"), "a login value reached the log");
});

test("the comparison's log names every new, fixed and known test", async () => {
    const { describeComparison } = await import("./baseline.ts");
    const change = (title: string, from: "Failed" | "Passed", to: "Failed" | "Passed") => ({ title, browser: "chromium", from, to });
    const lines = describeComparison({ runId: "b", finishedAt: "2026-11-08T09:00:00.000Z", from: "test" }, { failures: { new: [change("n", "Passed", "Failed")], fixed: [change("f", "Failed", "Passed")], known: [change("k", "Failed", "Failed")] } } as never);
    assert.deepEqual(lines, [
        "Against baseline b (2026-11-08T09:00:00.000Z): 1 new failure(s), 1 known, 1 fixed.",
        "New failures:", "  - n [chromium] (Passed -> Failed)",
        "Fixed:", "  - f [chromium] (Failed -> Passed)",
        "Known failures (failing in the baseline too):", "  - k [chromium] (Failed -> Failed)",
    ]);
});

// Ruling 2 (Emil, 2026-11-08): a regression can't become known by being saved.
test("--baseline latest skips a run that failed on a new failure, or couldn't run; a first run is a baseline", async () => {
    const site = "http://localhost:4300";
    const at = (hour: number) => `2026-11-09T${String(hour).padStart(2, "0")}:00:00.000Z`;
    const first = await store(record({ baseUrl: site, finishedAt: at(1), verdict: { exitCode: 1, baselineRunId: null, newFailures: null, firstRun: true } }));
    const latestFor = () => findBaseline(buildConfig({}, { url: site, practices: ["functional", "seo/content"], baseline: "latest" }, scratch));
    assert.equal((await latestFor())?.runId, first.runId, "a first run that failed on its own failures is the baseline");

    await store(record({ baseUrl: site, finishedAt: at(2), verdict: { exitCode: 1, baselineRunId: first.runId, newFailures: 2, firstRun: false } }));
    await store(record({ baseUrl: site, finishedAt: at(3), verdict: { exitCode: 0, baselineRunId: first.runId, newFailures: 3, firstRun: false } }));
    await store(record({ baseUrl: site, finishedAt: at(4), verdict: { exitCode: 2, baselineRunId: first.runId, newFailures: null, firstRun: false } }));
    // Nor a first run that couldn't run (nothing executed, say).
    await store(record({ baseUrl: site, finishedAt: at(4), verdict: { exitCode: 2, baselineRunId: null, newFailures: null, firstRun: true } }));
    // A run without --baseline that failed: any failure failed it, so it isn't known to be acceptable.
    await store(record({ baseUrl: site, finishedAt: at(4), verdict: { exitCode: 1, baselineRunId: null, newFailures: null, firstRun: false } }));
    assert.equal((await latestFor())?.runId, first.runId, "not one with new failures (even --report-only's exit 0), one that couldn't run, nor a failed run without --baseline");

    const passed = await store(record({ baseUrl: site, finishedAt: at(0), verdict: { exitCode: 0, baselineRunId: first.runId, newFailures: 0, firstRun: false } }));
    const later = await store(record({ baseUrl: site, finishedAt: at(5), verdict: { exitCode: 0, baselineRunId: first.runId, newFailures: 0, firstRun: false } }));
    assert.equal((await latestFor())?.runId, later.runId, `a run that passed against its baseline is the next one's (not the older ${passed.runId})`);
    const ui = await store(record({ baseUrl: site, finishedAt: at(6) }));
    assert.equal((await latestFor())?.runId, ui.runId, "a run with no verdict (the UI's) is too");
});

test("the verdict is saved with the run, and is in --out's run.json", async () => {
    const { finishRun } = await import("./run.ts");
    const { createEmptyProgress } = await import("../lib/run/jobs.ts");
    const full = (status: "Passed" | "Failed") => {
        const passed = status === "Passed" ? 1 : 0;
        return {
            summary: { planned: 1, executed: 1, passed, failed: 1 - passed, blocked: 0, flaky: 0, notRun: 0, duration: 1, releaseRecommendation: "", defectDistribution: { Critical: 0, Major: 0, Minor: 0 }, passFailRatio: { passed, failed: 1 - passed }, browsers: ["chromium"], defectTrend: [] },
            execution: [{ id: "e1", title: "t", description: "", suite: "s", area: "Functional", interactionType: null, browser: "chromium", status, duration: 1, remarks: "", rawMessage: "", reproductionSteps: [], artifacts: [], order: 1 }],
            defects: { issues: [], heatmap: [] }, coverage: { percentage: 100, covered: 0, total: 0, uncovered: [], matrix: [] }, notTested: [],
            performance: { totalDuration: 0, averageDuration: 0, throughput: 0, slowestTests: [], pageResponseTimes: [], resourceUtilization: "", scalability: "" },
            usability: { successRate: 0, findings: [], videoClips: "", sessionEvidence: [], tasksCompleted: 0, totalTasks: 0 },
            seo: { requested: false, score: 0, statusLabel: "", passedChecks: 0, failedChecks: 0, notCoveredChecks: 0, totalChecks: 0, checks: [], pageGroups: [], findings: [], strengths: [], recommendations: [] },
            rawOutput: "",
        };
    };
    const baselineRun = await store({ ...record({ finishedAt: "2026-11-09T07:00:00.000Z" }), result: { runId: "a", runStatus: "passed", passed: true, output: "", report: full("Passed") } } as never);
    const saved = await store({ ...record({ finishedAt: "2026-11-09T08:00:00.000Z" }), result: { runId: "b", runStatus: "failed", passed: false, output: "", report: full("Failed") } } as never);
    const job = { id: saved.runId, result: { runId: saved.runId, runStatus: "failed", passed: false, output: "", duration: 1, progress: createEmptyProgress(), report: full("Failed") }, artifactFiles: new Map() } as never;
    const out = join(scratch, "out-verdict");
    const code = await finishRun(config({ out }), job, "", {}, () => { }, { runId: baselineRun.runId, finishedAt: "2026-11-09T07:00:00.000Z", from: "test" });

    assert.equal(code, EXIT.failed);
    const expected = { exitCode: 1, baselineRunId: baselineRun.runId, newFailures: 1, firstRun: false };
    assert.deepEqual(JSON.parse(await readFile(runJsonPath(saved.runId), "utf8")).verdict, expected, "in the data folder");
    assert.deepEqual(JSON.parse(await readFile(join(out, "run.json"), "utf8")).verdict, expected, "in --out");

    // A saved run whose baseline isn't in the data folder couldn't be compared: exit 2 is its verdict, so it is no baseline.
    const orphan = await store({ ...record({ finishedAt: "2026-11-09T08:30:00.000Z" }), result: { runId: "c", runStatus: "failed", passed: false, output: "", report: full("Failed") } } as never);
    const orphanJob = { id: orphan.runId, result: { runId: orphan.runId, runStatus: "failed", passed: false, output: "", duration: 1, progress: createEmptyProgress(), report: full("Failed") }, artifactFiles: new Map() } as never;
    await assert.rejects(finishRun(config({ out: join(scratch, "out-orphan") }), orphanJob, "", {}, () => { }, { runId: randomUUID(), finishedAt: "2026-11-09T07:00:00.000Z", from: "test" }));
    const orphanVerdict = JSON.parse(await readFile(runJsonPath(orphan.runId), "utf8")).verdict;
    assert.deepEqual([orphanVerdict.exitCode, orphanVerdict.newFailures], [2, null]);

    // A verdict that can't be saved is said, and the reports are still written.
    const stuck = await store({ ...record({ finishedAt: "2026-11-09T08:40:00.000Z" }), result: { runId: "d", runStatus: "failed", passed: false, output: "", report: full("Failed") } } as never);
    await mkdir(`${runJsonPath(stuck.runId)}.tmp`, { recursive: true });
    const stuckJob = { id: stuck.runId, result: { runId: stuck.runId, runStatus: "failed", passed: false, output: "", duration: 1, progress: createEmptyProgress(), report: full("Failed") }, artifactFiles: new Map() } as never;
    const lines: string[] = [];
    const stuckOut = join(scratch, "out-stuck");
    assert.equal(await finishRun(config({ out: stuckOut }), stuckJob, "", {}, (line) => lines.push(line), null), EXIT.failed);
    assert.ok(lines.some((line) => /The verdict couldn't be saved with the run/.test(line)), lines.join("\n"));
    for (const file of ["report.json", "junit.xml", "run.json"]) await readFile(join(stuckOut, file), "utf8");

    // A first run - --baseline latest with none yet - says so in its verdict; a run without --baseline doesn't.
    const fresh = await store({ ...record({ finishedAt: "2026-11-09T08:50:00.000Z" }), result: { runId: "e", runStatus: "failed", passed: false, output: "", report: full("Failed") } } as never);
    const freshJob = { id: fresh.runId, result: { runId: fresh.runId, runStatus: "failed", passed: false, output: "", duration: 1, progress: createEmptyProgress(), report: full("Failed") }, artifactFiles: new Map() } as never;
    await finishRun(config({ out: join(scratch, "out-fresh"), baseline: "latest" }), freshJob, "", {}, () => { }, null);
    assert.equal(JSON.parse(await readFile(runJsonPath(fresh.runId), "utf8")).verdict.firstRun, true);
});

// Ruling 5 (Emil, 2026-11-08): --out's run.json is redacted; this run's titles are redacted the same way to match it.
test("a baseline whose titles were redacted matches this run's titles, redacted the same way", async (t) => {
    const { finishRun } = await import("./run.ts");
    const { createEmptyProgress } = await import("../lib/run/jobs.ts");
    process.env.TFP246_TEST_USER = "ada-the-tester";
    process.env.TFP246_TEST_PASS = "s3cret-Pa55";
    t.after(() => {
        delete process.env.TFP246_TEST_USER;
        delete process.env.TFP246_TEST_PASS;
    });
    const login = { loginUrl: "/login", usernameEnv: "TFP246_TEST_USER", passwordEnv: "TFP246_TEST_PASS", usernameSelector: "#email", passwordSelector: "#password", submitSelector: "button[type=submit]", postLoginPath: "/account" };
    const full = (title: string) => ({
        summary: { planned: 1, executed: 1, passed: 0, failed: 1, blocked: 0, flaky: 0, notRun: 0, duration: 1, releaseRecommendation: "", defectDistribution: { Critical: 0, Major: 0, Minor: 0 }, passFailRatio: { passed: 0, failed: 1 }, browsers: ["chromium"], defectTrend: [] },
        execution: [{ id: "e1", title, description: "", suite: "s", area: "Functional", interactionType: null, browser: "chromium", status: "Failed", duration: 1, remarks: "", rawMessage: "", reproductionSteps: [], artifacts: [], order: 1 }],
        defects: { issues: [], heatmap: [] }, coverage: { percentage: 100, covered: 0, total: 0, uncovered: [], matrix: [] }, notTested: [],
        performance: { totalDuration: 0, averageDuration: 0, throughput: 0, slowestTests: [], pageResponseTimes: [], resourceUtilization: "", scalability: "" },
        usability: { successRate: 0, findings: [], videoClips: "", sessionEvidence: [], tasksCompleted: 0, totalTasks: 0 },
        seo: { requested: false, score: 0, statusLabel: "", passedChecks: 0, failedChecks: 0, notCoveredChecks: 0, totalChecks: 0, checks: [], pageGroups: [], findings: [], strengths: [], recommendations: [] },
        rawOutput: "",
    });
    const site = "http://localhost:4400";
    const at = "2026-11-09T09:00:00.000Z";
    const redactedBaseline = await store({ ...record({ baseUrl: site, finishedAt: at }), result: { runId: "a", runStatus: "failed", passed: false, output: "", report: full("welcome, [redacted]") } } as never);
    const now = await store({ ...record({ baseUrl: site, finishedAt: "2026-11-09T10:00:00.000Z" }), result: { runId: "b", runStatus: "failed", passed: false, output: "", report: full("welcome, ada-the-tester") } } as never);
    const job = { id: now.runId, result: { runId: now.runId, runStatus: "failed", passed: false, output: "", duration: 1, progress: createEmptyProgress(), report: full("welcome, ada-the-tester") }, artifactFiles: new Map() } as never;
    const lines: string[] = [];
    const code = await finishRun(buildConfig({}, { url: site, practices: ["functional", "seo/content"], out: join(scratch, "out-redacted-match"), login }, scratch), job, "", {}, (line) => lines.push(line), { runId: redactedBaseline.runId, finishedAt: at, from: "test" });
    assert.equal(code, EXIT.passed, lines.join("\n"));
    assert.ok(lines.some((line) => /0 new failure\(s\), 1 known/.test(line)), lines.join("\n"));
});
