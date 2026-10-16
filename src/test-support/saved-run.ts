import assert from "node:assert";
import { existsSync } from "node:fs";

/**
 * TFP-208: waits until a run started through /api/run has finished and been saved, and returns its job.
 *
 * A job's result is set before its run.json is written (run.json.tmp, then renamed over it). A test that
 * returned at the result left that write running into its file's cleanup, which removes the runs folder:
 * "ENOENT: no such file or directory, rename '...run.json.tmp' -> '...run.json'", an unhandled rejection that
 * failed hardening.test.ts once in TFP-208's first full unit run. Every test that waits on a run waits here.
 *
 * The run modules are imported when called, not with this file, because the tests point TESTFORGE_RUNS_ROOT at
 * their scratch folder before they import them.
 */
export async function waitForSavedRun(runId: string, limitMs: number) {
    const { runJobs } = await import("../lib/run/jobs.ts");
    const { runJsonPath } = await import("../lib/run/persistence.ts");
    const saved = () => existsSync(runJsonPath(runId)) && !existsSync(`${runJsonPath(runId)}.tmp`);
    const started = Date.now();
    while (!runJobs.get(runId)?.result || !saved()) {
        assert.ok(Date.now() - started < limitMs, `the run finished and was saved within ${limitMs / 60_000} minutes`);
        await new Promise((done) => setTimeout(done, 250));
    }
    return runJobs.get(runId)!;
}
