import { copyFile, mkdir, writeFile } from "fs/promises";
import { basename, join } from "path";
import type { CliConfig } from "@/cli/config";
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
import { normalizeGenerationRecord } from "@/lib/run/generation-record";
import { runJobs, type RunJob, type RunResultPayload } from "@/lib/run/jobs";
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

/** Decision 5's verdict for a finished run. A run that executed nothing is never a pass. */
export function verdictOf(result: RunResultPayload, reportOnly: boolean): { exitCode: ExitCode; summary: string } {
    const report = result.report;
    if (!report || result.runStatus === "cancelled" || result.runStatus === "empty") {
        return { exitCode: EXIT.couldNotRun, summary: `The run couldn't run (${result.runStatus}): ${result.output.split("\n")[0] || "no report"}` };
    }
    const { planned, executed, passed, failed, flaky, blocked, notRun } = report.summary;
    const counts = `${planned} planned: ${passed} passed, ${flaky} flaky, ${failed} failed, ${blocked} blocked, ${notRun} not run`;
    if (executed === 0) return { exitCode: EXIT.couldNotRun, summary: `No test executed (${counts}).` };
    // Blocked tests didn't execute, unexplained: like failures, they fail the build, so a broken site can't pass.
    if (failed + blocked > 0) return { exitCode: reportOnly ? EXIT.passed : EXIT.failed, summary: `${counts}.${reportOnly ? " --report-only: reported, not failing the build." : ""}` };
    return { exitCode: EXIT.passed, summary: `${counts}.` };
}

const safeName = (text: string) => text.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "test";

/** Decision 7's outputs. Every text file goes through the run's redactor again; evidence was scrubbed by the run. */
export async function writeOutputs(config: CliConfig, job: RunJob, code: string, profile: unknown, log: Log) {
    const result = job.result as RunResultPayload;
    const secrets = config.login ? [process.env[config.login.usernameEnv], process.env[config.login.passwordEnv]].filter((value): value is string => Boolean(value)) : [];
    const redactor = buildRedactor(secrets);
    const write = (name: string, text: string) => writeFile(join(config.out, name), redactor.redact(text), "utf8");

    await mkdir(config.out, { recursive: true });
    await write("report.json", JSON.stringify({ ...result, producedBy: result.report?.producedBy ?? result.producedBy ?? currentVersion() }, null, 2));
    await write("report.html", buildResultHtmlDocument(result));
    await write("suite.spec.ts", code);
    if (result.report) await write("junit.xml", buildJUnit(result.report));
    // The inspection the suite was generated from: the same page data gives the same suite, from the UI or here.
    await write("page-data.json", JSON.stringify(profile, null, 2));

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

/** The whole run, against servers already started. Throws CouldNotRun, or returns the verdict. */
async function runPipeline(config: CliConfig, log: Log): Promise<ExitCode> {
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
    await writeOutputs(config, job, code, profile, log);
    const verdict = verdictOf(job.result as RunResultPayload, config.reportOnly);
    log(verdict.summary);
    return verdict.exitCode;
}

/** Starts the servers, runs, and stops every server it started, whatever happened. */
export async function runTarget(config: CliConfig, log: Log = (line) => console.log(line)): Promise<ExitCode> {
    let servers: StartedServer[] = [];
    try {
        servers = await startServers(config.servers, config.serverTimeoutMs, log);
        return await runPipeline(config, log);
    } catch (error) {
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
