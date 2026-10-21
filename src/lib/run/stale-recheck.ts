import { spawn } from "child_process";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { inspectPages } from "@/lib/introspect/inspector";
import type { JsonReport } from "@/lib/report/types";
import type { RunJob } from "@/lib/run/jobs";
import { createRunFolder, PLAYWRIGHT_RUNS_DIR, removeRunFolder } from "@/lib/run/run-folders";
import { buildRunSelection } from "@/lib/run/selection";
import { recheckStaleTests, type RerunTests } from "@/lib/site-suites/stale";

/**
 * Phase 42 (TFP-191): after a run's Playwright process closes, and before
 * the run is finalized, its failing reused tests are checked for a stale page
 * (src/lib/site-suites/stale.ts). A stale type's regenerated tests run here,
 * with the run's own settings (environment, login state, workers, browsers),
 * and the run's suite file and JSON report are replaced by the merged ones,
 * so everything after - the report, the stored run - sees only the re-run's
 * results. The generation record carries what was found.
 */
/** `prepare`: the run's last word on a spec file before it runs (TFP-157: on a capped host, the request cap's import). */
export async function recheckSiteSuiteAfterRun(job: RunJob, settings: { env: NodeJS.ProcessEnv; workerCount: number; browserProjects: string[]; timeoutMs: number; prepare?: (code: string, dir: string) => string }) {
    const siteSuite = job.generation?.siteSuite;
    if (!siteSuite || !job.baseUrl || job.cancellationRequested) return;
    const reportText = await readFile(job.jsonReportFile, "utf8").catch(() => "");
    const suiteCode = await readFile(job.testFile, "utf8").catch(() => null);
    if (!reportText || suiteCode === null) return;
    let report: JsonReport;
    try {
        report = JSON.parse(reportText) as JsonReport;
    } catch {
        return;
    }

    const rerun: RerunTests = async (code, titles) => {
        // TFP-222: in a folder of its own, whose config's testDir is that folder (TFP-208's race).
        const { dir, config } = await createRunFolder(PLAYWRIGHT_RUNS_DIR, `recheck-${job.id}-${Date.now()}`);
        const testFile = join(dir, `test-${job.id}-regenerated.spec.ts`);
        const jsonFile = join(dir, `report-${job.id}-regenerated.json`);
        await writeFile(testFile, settings.prepare ? settings.prepare(code, dir) : code, "utf8");
        try {
            const selection = buildRunSelection(code, [], titles);
            await new Promise<void>((resolve) => {
                const child = spawn(process.execPath, [
                    join(process.cwd(), "node_modules", "playwright", "cli.js"),
                    "test",
                    "--config",
                    config,
                    "--reporter=json",
                    "--timeout=30000",
                    // Inside the run's artifact folder, so its evidence is scrubbed and kept with the run's.
                    `--output=${join(job.artifactDir, "regenerated").replace(/\\/g, "/")}`,
                    `--workers=${settings.workerCount}`,
                    ...(selection.grepPattern ? [`--grep=${selection.grepPattern}`] : []),
                    ...settings.browserProjects.flatMap((project) => [`--project=${project}`]),
                ], { cwd: process.cwd(), env: { ...settings.env, PLAYWRIGHT_JSON_OUTPUT_FILE: jsonFile }, windowsHide: true, stdio: "ignore" });
                const timer = setTimeout(() => child.kill("SIGTERM"), settings.timeoutMs);
                child.on("error", () => resolve());
                child.on("close", () => {
                    clearTimeout(timer);
                    resolve();
                });
            });
            const text = await readFile(jsonFile, "utf8").catch(() => "");
            return text ? (JSON.parse(text) as JsonReport) : null;
        } catch {
            return null;
        } finally {
            await removeRunFolder(dir);
        }
    };

    const result = await recheckStaleTests({ baseUrl: job.baseUrl, store: siteSuite.store, suiteCode, report, inspect: (baseUrl, paths) => inspectPages(baseUrl, paths), rerun });
    if (!result) return;
    siteSuite.recheck = result.recheck;
    if (result.recheck.regenerations.length === 0) return;
    await writeFile(job.testFile, result.code, "utf8");
    await writeFile(job.jsonReportFile, JSON.stringify(result.report), "utf8");
    for (const regeneration of result.recheck.regenerations) {
        job.outputChunks.push(`Site suite: ${regeneration.type} changed since its tests were saved; its tests were regenerated from a fresh inspection and re-run (${regeneration.passed} passed, ${regeneration.failedAgain} failed of ${regeneration.rerun}).\n`);
    }
}
