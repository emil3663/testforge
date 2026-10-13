import { spawn } from "child_process";
import { readFile, rm, writeFile } from "fs/promises";
import { join, relative } from "path";
import { inspectPages } from "@/lib/introspect/inspector";
import type { JsonReport } from "@/lib/report/types";
import type { RunJob } from "@/lib/run/jobs";
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
export async function recheckSiteSuiteAfterRun(job: RunJob, settings: { env: NodeJS.ProcessEnv; workerCount: number; browserProjects: string[]; timeoutMs: number }) {
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
        const testFile = job.testFile.replace(/\.spec\.ts$/, "-regenerated.spec.ts");
        const jsonFile = job.jsonReportFile.replace(/\.json$/, "-regenerated.json");
        await writeFile(testFile, code, "utf8");
        try {
            const selection = buildRunSelection(code, [], titles);
            await new Promise<void>((resolve) => {
                const child = spawn(process.execPath, [
                    join(process.cwd(), "node_modules", "playwright", "cli.js"),
                    "test",
                    relative(process.cwd(), testFile).replace(/\\/g, "/"),
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
            await rm(testFile, { force: true });
            await rm(jsonFile, { force: true });
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
