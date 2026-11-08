import { copyFile, mkdir, readFile, stat } from "fs/promises";
import { dirname } from "path";
import { ConfigError, type CliConfig } from "@/cli/config";
import { isComprehensive } from "@/lib/comprehensive/run-mode";
import { diffRuns, type RunDiff } from "@/lib/run/diff";
import { isValidRunId, listRunRecords, loadRunRecord, runJsonPath, suiteIdentity, type RunRecord } from "@/lib/run/persistence";

/**
 * Phase 47 (TFP-246, Decision 5): the earlier run a CI run is compared with, so only failures it didn't have fail
 * the build. Decision 6: it is found among the runs in the data folder the pipeline restored, and compared there with
 * diffRuns, as the UI's run diff is. A run.json from elsewhere (an earlier job's --out) is copied in first.
 */

export interface Baseline {
    runId: string;
    finishedAt: string;
    /** How it was found, for the log. */
    from: string;
}

const isFile = (path: string) => stat(path).then((info) => info.isFile(), () => false);

const finishedAtOf = (record: RunRecord) => (typeof record.finishedAt === "string" ? Date.parse(record.finishedAt) : NaN);

/**
 * The same tests: the suite identity runs supersede each other by (site, areas, run type; TFP-198), and what else
 * changes which tests a run has - the audit mode (it names the site suite too), the interactive tests, and the login.
 * Pages given with --pages aren't recorded on a run, so they can't be matched.
 */
function sameTestsAs(record: RunRecord, config: CliConfig) {
    const practices = isComprehensive(config.runMode) ? [config.runMode.area] : config.practices;
    const login = (value: { loginUrl: string; usernameEnv: string } | null | undefined) => (value ? `${value.loginUrl} ${value.usernameEnv}` : "");
    return suiteIdentity(record) === suiteIdentity({ baseUrl: config.url, selectedPractices: practices, runMode: config.runMode })
        && record.auditMode === config.auditMode
        && Boolean(record.enableInteractive) === config.interactive
        && login(record.login) === login(config.login);
}

/**
 * Ruling 2 (Emil, 2026-11-08): a run whose verdict failed is never a later run's baseline, so a regression can't become
 * known by being saved: not one that failed on a new failure (even --report-only's exit 0), nor one that couldn't run,
 * nor one run without --baseline that failed. The exception is a first run - `--baseline latest` with none yet - whose
 * failures are what the next run's are compared with (Decision 5). A run with no verdict (the UI's) is taken.
 */
const acceptedAsBaseline = (record: RunRecord) => {
    const verdict = record.verdict;
    if (!verdict) return true;
    if (verdict.exitCode === 2 || (verdict.newFailures !== null && verdict.newFailures > 0)) return false;
    return verdict.exitCode === 0 || verdict.firstRun === true;
};

async function latestBaseline(config: CliConfig): Promise<Baseline | null> {
    const ran = (record: RunRecord) => Boolean(record.result?.report) && record.result.runStatus !== "cancelled" && record.result.runStatus !== "empty";
    const runs = (await listRunRecords()).filter((record) => ran(record) && acceptedAsBaseline(record) && sameTestsAs(record, config) && !Number.isNaN(finishedAtOf(record)));
    const latest = runs.sort((a, b) => finishedAtOf(b) - finishedAtOf(a))[0];
    return latest ? { runId: latest.runId, finishedAt: latest.finishedAt, from: "the newest like run in the data folder that didn't fail on a new failure" } : null;
}

async function fileBaseline(file: string, config: CliConfig): Promise<Baseline> {
    const text = await readFile(file, "utf8").catch((error: unknown) => {
        throw new ConfigError("baseline", `could not read ${file} (${error instanceof Error ? error.message : String(error)})`);
    });
    let record: RunRecord;
    try {
        record = JSON.parse(text) as RunRecord;
    } catch {
        throw new ConfigError("baseline", `${file} is not valid JSON`);
    }
    if (!record || typeof record !== "object" || !isValidRunId(record.runId) || !record.result) {
        throw new ConfigError("baseline", `${file} is not a run's run.json (no runId and result)`);
    }
    if (record.baseUrl !== config.url) throw new ConfigError("baseline", `${file} is a run of ${record.baseUrl}, not ${config.url}`);
    if (!record.result.report) throw new ConfigError("baseline", `${file} is a run with no report (${record.result.runStatus}): there is nothing to compare with`);
    if (Number.isNaN(finishedAtOf(record))) throw new ConfigError("baseline", `${file} has no finishedAt time`);

    // A run already in the data folder is compared as stored (--out's run.json is its redacted copy); a file that
    // only shares its id - another site, or another time - is refused, never swapped in.
    const stored = runJsonPath(record.runId);
    if (await isFile(stored)) {
        const kept = await loadRunRecord(record.runId);
        const same = kept !== null && kept.baseUrl === record.baseUrl && kept.createdAt === record.createdAt && kept.finishedAt === record.finishedAt;
        if (!same) throw new ConfigError("baseline", `${file} has the id of run ${record.runId} in the data folder, but isn't that run`);
    } else {
        await mkdir(dirname(stored), { recursive: true });
        await copyFile(file, stored);
    }
    return { runId: record.runId, finishedAt: record.finishedAt, from: file };
}

/**
 * Found before the run, so a baseline that can't be used is exit 3 before anything runs, and "latest" can't be the
 * run itself. `null`: no baseline, a first run - any failing test fails the build.
 */
export async function findBaseline(config: CliConfig): Promise<Baseline | null> {
    if (config.baseline === null) return null;
    return config.baseline === "latest" ? latestBaseline(config) : fileBaseline(config.baseline, config);
}

/** The run against its baseline, titles redacted first (ruling 5). A diff that can't be made is an error the caller reports as "couldn't run". */
export async function compareWithBaseline(baseline: Baseline, runId: string, redact: (text: string) => string): Promise<RunDiff> {
    const result = await diffRuns(baseline.runId, runId, { redact });
    if (!result.ok) throw new Error(`the run couldn't be compared with its baseline ${baseline.runId} (${result.error})`);
    return result.diff;
}

const names = (changes: RunDiff["failures"]["new"]) => changes.map((change) => `  - ${change.title} [${change.browser}] (${change.from} -> ${change.to})`);

/** The comparison's lines for the log: counts, then every new, fixed and known test by name. The caller redacts them. */
export function describeComparison(baseline: Baseline, diff: RunDiff): string[] {
    const { known, fixed } = diff.failures;
    const added = diff.failures.new;
    return [
        `Against baseline ${baseline.runId} (${baseline.finishedAt}): ${added.length} new failure(s), ${known.length} known, ${fixed.length} fixed.`,
        ...(added.length > 0 ? ["New failures:", ...names(added)] : []),
        ...(fixed.length > 0 ? ["Fixed:", ...names(fixed)] : []),
        ...(known.length > 0 ? ["Known failures (failing in the baseline too):", ...names(known)] : []),
    ];
}
