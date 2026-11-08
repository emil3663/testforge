import { copyFile, mkdir, writeFile } from "fs/promises";
import { basename, join } from "path";
import { compareWithBaseline, describeComparison, findBaseline, type Baseline } from "@/cli/baseline";
import { ConfigError, type CliConfig } from "@/cli/config";
import { buildJUnit } from "@/cli/junit";
import { ServerStartError, startServers, stopServers, type StartedServer } from "@/cli/servers";
import { buildSelectedPracticeDescription, normalizeInspectionPaths, typeSelectedPaths } from "@/app/_lib/derive";
import type { CrawlResult } from "@/app/_lib/types";
import { isComprehensive } from "@/lib/comprehensive/run-mode";
import { normalizeContentProfile } from "@/lib/generate/normalize";
import { crawlSite, createEmptyCrawlProgress } from "@/lib/pipeline/crawl";
import { generateSuite } from "@/lib/pipeline/generate";
import { generationRecordFrom } from "@/lib/pipeline/generation-record";
import { inspectSite } from "@/lib/pipeline/inspect";
import { buildResultHtmlDocument } from "@/lib/report/html";
import { RunLoginError } from "@/lib/run/auth";
import { startRunJob } from "@/lib/run/executor";
import type { RunDiff, RunDiffFailures } from "@/lib/run/diff";
import { normalizeGenerationRecord } from "@/lib/run/generation-record";
import { runJobs, type RunJob, type RunResultPayload } from "@/lib/run/jobs";
import { isValidRunId, loadRunRecord, recordRunVerdict } from "@/lib/run/persistence";
import { buildRedactor } from "@/lib/run/redact";
import { buildPageTypeCoverage } from "@/lib/selection/coverage";
import { currentVersion } from "@/lib/version";

/**
 * Phase 47 (TFP-245): `testforge run` - the UI's crawl, inspection, generation and run, in that order, through the
 * same modules, with no server of its own. It ends with an exit code a pipeline acts on (Decision 5) and the
 * outputs Decision 7 lists in `--out`.
 */

export const EXIT = { passed: 0, failed: 1, couldNotRun: 2, invalidConfig: 3 } as const;
export type ExitCode = (typeof EXIT)[keyof typeof EXIT];

export class CouldNotRun extends Error {}

type Log = (line: string) => void;

/** The JSON round trip the UI's request goes through, so the pipeline sees what the route would. */
const asRequest = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Which pages, chosen as the UI chooses them: the crawl's selection by page type, or the pages given. */
async function choosePages(config: CliConfig, log: Log) {
    if (config.pages.length > 0) {
        log(`Pages given: ${config.pages.join(", ")}`);
        return { paths: normalizeInspectionPaths(config.url, config.pages, []), crawl: null };
    }
    log(`Crawling ${config.url} ...`);
    const outcome = await crawlSite(config.url, { progress: createEmptyCrawlProgress(), isCancelled: () => false });
    // TFP-272: a browser that can't start ends the crawl as failed; here it is reported, and the run couldn't run.
    if (outcome.status === "failed") throw new CouldNotRun(`The crawl failed: ${outcome.error}`);
    const crawl = outcome.result as CrawlResult;
    if (crawl.pages.length === 0) {
        const why = crawl.warnings?.[0] ? ` (${crawl.warnings[0].split("\n")[0]})` : "";
        throw new CouldNotRun(`The crawl found no page at ${config.url}${why}.`);
    }
    const paths = normalizeInspectionPaths(config.url, [], typeSelectedPaths(crawl, config.runMode));
    log(`Crawled ${crawl.pageCount} page(s); testing ${paths.length}: ${paths.join(", ")}`);
    return { paths, crawl };
}

async function waitForRun(runId: string, log: Log): Promise<RunJob> {
    let lastNote = 0;
    for (;;) {
        const job = runJobs.get(runId);
        if (!job) throw new CouldNotRun(`The run ${runId} disappeared before it finished.`);
        if (job.result) {
            await job.saving?.catch(() => undefined);
            return job;
        }
        if (Date.now() - lastNote > 15_000) {
            lastNote = Date.now();
            log(`Running: ${job.progress.completedTests} of ${job.progress.totalTests} test(s) done, ${job.progress.failedTests} failed.`);
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
    }
}

/**
 * Decision 5's verdict for a finished run. A run that executed nothing is never a pass. With a baseline's
 * comparison (TFP-246), only new failures fail the build; known ones are reported.
 */
export function verdictOf(result: RunResultPayload, reportOnly: boolean, failures: RunDiffFailures | null = null): { exitCode: ExitCode; summary: string } {
    const report = result.report;
    if (!report || result.runStatus === "cancelled" || result.runStatus === "empty") {
        return { exitCode: EXIT.couldNotRun, summary: `The run couldn't run (${result.runStatus}): ${result.output.split("\n")[0] || "no report"}` };
    }
    const { planned, executed, passed, failed, flaky, blocked, notRun } = report.summary;
    const counts = `${planned} planned: ${passed} passed, ${flaky} flaky, ${failed} failed, ${blocked} blocked, ${notRun} not run`;
    if (executed === 0) return { exitCode: EXIT.couldNotRun, summary: `No test executed (${counts}).` };
    const reportOnlyNote = reportOnly ? " --report-only: reported, not failing the build." : "";
    if (failures) {
        const against = `${counts}; against the baseline, ${failures.new.length} new failure(s), ${failures.known.length} known, ${failures.fixed.length} fixed.`;
        if (failures.new.length > 0) return { exitCode: reportOnly ? EXIT.passed : EXIT.failed, summary: `${against}${reportOnlyNote}` };
        return { exitCode: EXIT.passed, summary: against };
    }
    // Blocked tests didn't execute, unexplained: like failures, they fail the build, so a broken site can't pass.
    if (failed + blocked > 0) return { exitCode: reportOnly ? EXIT.passed : EXIT.failed, summary: `${counts}.${reportOnlyNote}` };
    return { exitCode: EXIT.passed, summary: `${counts}.` };
}

/** Login values, from the environment variables the login names, as the run's own redactor finds them. */
function redactorFor(config: CliConfig) {
    const secrets = config.login ? [process.env[config.login.usernameEnv], process.env[config.login.passwordEnv]].filter((value): value is string => Boolean(value)) : [];
    return buildRedactor(secrets);
}

const safeName = (text: string) => text.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "test";

/**
 * Decision 7's outputs. Every text file goes through the run's redactor again; evidence was scrubbed by the run.
 * TFP-246: the saved run's run.json too, so a later job can take it as its --baseline, and baseline.json with the
 * comparison when there was one.
 */
export async function writeOutputs(config: CliConfig, job: RunJob, code: string, profile: unknown, log: Log, comparison: { baseline: Baseline; diff: RunDiff } | null = null) {
    const result = job.result as RunResultPayload;
    const redactor = redactorFor(config);
    const write = (name: string, text: string) => writeFile(join(config.out, name), redactor.redact(text), "utf8");

    await mkdir(config.out, { recursive: true });
    await write("report.json", JSON.stringify({ ...result, producedBy: result.report?.producedBy ?? result.producedBy ?? currentVersion() }, null, 2));
    await write("report.html", buildResultHtmlDocument(result));
    await write("suite.spec.ts", code);
    if (result.report) await write("junit.xml", buildJUnit(result.report));
    // The inspection the suite was generated from: the same page data gives the same suite, from the UI or here.
    await write("page-data.json", JSON.stringify(profile, null, 2));
    const record = isValidRunId(job.id) ? await loadRunRecord(job.id) : null;
    if (record) await write("run.json", JSON.stringify(record, null, 2));
    if (comparison) await write("baseline.json", JSON.stringify({ baseline: comparison.baseline, ...comparison.diff }, null, 2));

    // Evidence for failing (and blocked) tests only.
    const failing = (result.report?.execution ?? []).filter((record) => record.status === "Failed" || record.status === "Blocked");
    let copied = 0;
    for (const record of failing) {
        const folder = join(config.out, "evidence", `${String(record.order).padStart(3, "0")}-${safeName(record.title)}`);
        for (const artifact of record.artifacts) {
            const file = job.artifactFiles.get(artifact.artifactId);
            if (!file) continue;
            await mkdir(folder, { recursive: true });
            if (await copyFile(file.filePath, join(folder, basename(file.fileName))).then(() => true, () => false)) copied += 1;
        }
    }
    log(`Reports written to ${config.out}${copied > 0 ? ` (${copied} evidence file(s) for failing tests)` : ""}.`);
}

/** The practices a run covers: Standard's, or the one Comprehensive area (the UI's `practicesInScope`). */
const practicesOf = (config: CliConfig) => (isComprehensive(config.runMode) ? [config.runMode.area] : config.practices);
const descriptionOf = (config: CliConfig) => config.description || buildSelectedPracticeDescription(practicesOf(config));

/**
 * The generate request, field for field as the UI's (useGeneration) with no headings, text rules, named flows or
 * journeys chosen, after the same JSON round trip. Exported so a test can hold it to the UI's.
 */
export function buildGenerateRequest(config: CliConfig, paths: string[], profile: unknown): Record<string, unknown> {
    const contentRules = { paths, requiredHeadings: [], requiredText: [], forbiddenText: [] };
    return asRequest({
        baseUrl: config.url,
        description: descriptionOf(config),
        selectedPractices: practicesOf(config),
        auditMode: config.auditMode,
        contentRules: { ...contentRules, selectedJourneyIds: [] },
        contentProfile: profile,
        ...(isComprehensive(config.runMode) ? { runMode: config.runMode } : {}),
    });
}

/**
 * A finished run: compared with its baseline (TFP-246), its outputs written, its verdict. Throws CouldNotRun when the
 * comparison can't be made - after the outputs are written.
 */
export async function finishRun(config: CliConfig, job: RunJob, code: string, profile: unknown, log: Log, baseline: Baseline | null): Promise<ExitCode> {
    let comparison: { baseline: Baseline; diff: RunDiff } | null = null;
    let notCompared: string | null = null;
    // Test titles can quote a page, and a page a login value: the comparison and its log are redacted as the files are.
    const redactor = redactorFor(config);
    if (baseline && job.result?.report) {
        try {
            comparison = { baseline, diff: await compareWithBaseline(baseline, job.id, (text) => redactor.redact(text)) };
            describeComparison(baseline, comparison.diff).forEach((line) => log(redactor.redact(line)));
        } catch (error) {
            notCompared = error instanceof Error ? error.message : String(error);
        }
    }
    const verdict = notCompared ? null : verdictOf(job.result as RunResultPayload, config.reportOnly, comparison?.diff.failures ?? null);
    // Ruling 2: the verdict goes into the saved run, and so into --out's run.json, before the outputs are written.
    if (isValidRunId(job.id)) {
        await recordRunVerdict(job.id, {
            exitCode: verdict?.exitCode ?? EXIT.couldNotRun,
            baselineRunId: baseline?.runId ?? null,
            newFailures: comparison ? comparison.diff.failures.new.length : null,
            firstRun: config.baseline !== null && baseline === null,
        }).catch((error: unknown) => log(`The verdict couldn't be saved with the run (${error instanceof Error ? error.message : String(error)}); without it, a later --baseline latest can take this run as its baseline.`));
    }
    // The reports are written whatever the comparison did: a run that couldn't be compared still has them.
    await writeOutputs(config, job, code, profile, log, comparison);
    if (!verdict) throw new CouldNotRun(notCompared ?? "the run couldn't be compared with its baseline");
    log(verdict.summary);
    return verdict.exitCode;
}

/** The whole run, against servers already started. Throws CouldNotRun, or returns the verdict. */
async function runPipeline(config: CliConfig, log: Log, baseline: Baseline | null): Promise<ExitCode> {
    const { paths, crawl } = await choosePages(config, log);
    const practices = practicesOf(config);
    const description = descriptionOf(config);

    log(`Inspecting ${paths.length} page(s) ...`);
    const profile = asRequest(await inspectSite(config.url, paths, []));
    if (profile.pages.length === 0) {
        throw new CouldNotRun(`No page could be inspected at ${config.url}${profile.warnings[0] ? ` (${String(profile.warnings[0]).split("\n")[0]})` : ""}.`);
    }

    const generated = await generateSuite(buildGenerateRequest(config, paths, profile), { models: false });
    if (!generated.ok) throw new CouldNotRun(`Generation refused the request: ${generated.error}`);
    const code = String(generated.body.code);

    // Phase 40 (TFP-173): the page types found, covered and skipped, as the UI records them.
    const selection = config.pages.length > 0
        ? { pages: [], rankedTypes: [], selectedBy: "list" as const }
        : crawl?.rankedTypes && crawl.rankedTypes.length > 0 ? { pages: crawl.pages, rankedTypes: crawl.rankedTypes, selectedBy: "type" as const } : null;
    const pageTypes = selection ? buildPageTypeCoverage({ baseUrl: config.url, ...selection, runMode: config.runMode, selectedPaths: paths }) : undefined;
    const generation = normalizeGenerationRecord(asRequest(generationRecordFrom(generated.body, pageTypes)), config.url);

    log(`Running ${practices.join(", ")} (${config.runMode.kind}${config.interactive ? ", interactive on" : ""}) ...`);
    let started;
    try {
        started = await startRunJob(code, practices, config.auditMode, config.url, [], [], description, normalizeContentProfile(profile), config.interactive, config.login, generation, config.runMode);
    } catch (error) {
        if (error instanceof RunLoginError) throw new CouldNotRun(error.message);
        throw error;
    }
    const job = await waitForRun(started.runId, log);
    return finishRun(config, job, code, profile, log, baseline);
}

/** Starts the servers, runs, and stops every server it started, whatever happened. */
export async function runTarget(config: CliConfig, log: Log = (line) => console.log(line)): Promise<ExitCode> {
    let servers: StartedServer[] = [];
    try {
        // TFP-246: before anything starts, so a baseline that can't be used is exit 3 and "latest" isn't this run.
        const baseline = await findBaseline(config);
        log(baseline ? `Baseline: run ${baseline.runId} (${baseline.finishedAt}), from ${baseline.from}.` : config.baseline ? "Baseline: no earlier run of this site and these tests in the data folder; a first run, so any failing test fails the build." : "No baseline: any failing test fails the build.");
        servers = await startServers(config.servers, config.serverTimeoutMs, log);
        return await runPipeline(config, log, baseline);
    } catch (error) {
        if (error instanceof ConfigError) {
            log(`testforge: invalid configuration: ${error.message}`);
            return EXIT.invalidConfig;
        }
        if (error instanceof CouldNotRun || error instanceof ServerStartError) {
            log(`TestForge couldn't run: ${error.message}`);
            return EXIT.couldNotRun;
        }
        log(`TestForge couldn't run: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
        return EXIT.couldNotRun;
    } finally {
        if (servers.length > 0) {
            log("Stopping the server(s) it started ...");
            await stopServers(servers);
        }
    }
}
