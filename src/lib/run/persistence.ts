import type { GenerationRecord } from "@/lib/report/types";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "fs/promises";
import { dirname, join, resolve, sep } from "path";
import type { ContentProfile } from "@/lib/generate/mock/types";
import type { LoginConfig } from "@/lib/run/auth";
import type { RunJob, RunResultPayload } from "@/lib/run/jobs";
import { isComprehensive, type RunMode } from "@/lib/comprehensive/run-mode";

export type RunRetention = "full" | "archived";

export interface PersistedArtifactFile {
    filePath: string;
    fileName: string;
    contentType: string;
}

export interface RunRecord {
    runId: string;
    baseUrl: string;
    description: string;
    selectedPractices: string[];
    auditMode: string;
    createdAt: string;
    finishedAt: string;
    pinned: boolean;
    retention: RunRetention;
    lastAccessedAt: string | null;
    result: RunResultPayload;
    artifactFiles: Record<string, PersistedArtifactFile>;
    // Phase 17 Group 4 (TFP-073): the crawl/introspect snapshot this run
    // used, persisted so two runs can be diffed for newly discovered/missing
    // elements without needing the in-memory job. Null for runs that had
    // none (e.g. persisted before this field existed, or started without
    // generation).
    contentProfile: ContentProfile | null;
    // TFP-091: absent on runs persisted before this field existed, which
    // never ran an interactive test.
    enableInteractive?: boolean;
    // TFP-092: the login config this run used, references only. Absent/null
    // for a run that did not log in. Never carries a credential value or the
    // login's storageState (Decision 5).
    login?: LoginConfig | null;
    // Phase 34 (TFP-119): how the suite was generated - gap-fill outcome and
    // gate verdicts with their evidence (Decision 8). Absent on older runs.
    generation?: GenerationRecord | null;
    // Phase 35 (TFP-132): present only on Comprehensive runs, so a Standard
    // run's record is exactly what it was.
    runMode?: RunMode;
}

// TFP-198 (run-evidence-sweep backlog, Decision 3): run storage assumes one
// TestForge process at a time. Nothing here locks: two processes sharing a
// runs/ directory could interleave a record's read-modify-write (pin, first
// access, archive) and lose one update, and would share run.json.tmp. Each
// record write is atomic (a temporary file, then a rename), so a write that
// is interrupted leaves the previous record, never truncated JSON.

// Overridable so tests never read or write the real runs/ directory a live
// dev server is using. Default is today's exact behavior - unset, this
// resolves identically to before the override existed.
export const RUNS_ROOT = process.env.TESTFORGE_RUNS_ROOT
    ? resolve(process.env.TESTFORGE_RUNS_ROOT)
    : join(process.cwd(), "runs");

const RUN_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Real run IDs are crypto.randomUUID() output. Every path built from a
 * runId (runDir, runJsonPath, runEvidenceDir, ...) uses path.join, which
 * resolves ".." segments - so an unvalidated runId is a path-traversal
 * surface. Call this before a runId reaches any of those.
 */
export function isValidRunId(runId: unknown): runId is string {
    return typeof runId === "string" && RUN_ID_PATTERN.test(runId);
}

export function runDir(runId: string) {
    return join(RUNS_ROOT, runId);
}

export function runJsonPath(runId: string) {
    // TFP-267: every API caller checks first; here too, so a future caller can't skip it.
    if (!isValidRunId(runId)) throw new Error(`Not a run id: ${JSON.stringify(runId)}`);
    // CodeQL's alert #1 doesn't take the UUID check as a barrier; it does this, inline, on the resolved path.
    const path = resolve(runDir(runId), "run.json");
    if (!path.startsWith(RUNS_ROOT + sep)) throw new Error(`Not a run id: ${JSON.stringify(runId)}`);
    return path;
}

export function runSuitePath(runId: string) {
    return join(runDir(runId), "suite.spec.ts");
}

export function runEvidenceDir(runId: string) {
    return join(runDir(runId), "evidence");
}

/** TFP-198: written whole to run.json.tmp, then renamed over run.json, so a failed write never leaves a truncated record. */
async function writeRunRecord(record: RunRecord) {
    const target = runJsonPath(record.runId);
    const temporary = `${target}.tmp`;
    await writeFile(temporary, JSON.stringify(record, null, 2), "utf8");
    await rename(temporary, target);
}

/**
 * Persists a finished job to runs/<runId>/: the suite that was executed,
 * the full result/report as run.json, and evidence moved (not copied) out
 * of Playwright's shared, reusable outputDir so a later run can't overwrite
 * it. Returns the rewritten artifact map so the caller's in-memory job can
 * stay consistent with the moved files for the rest of this process's life.
 */
export async function persistRunJob(
    job: RunJob
): Promise<Record<string, PersistedArtifactFile>> {
    if (!job.result) {
        return {};
    }

    const dir = runDir(job.id);
    await mkdir(dir, { recursive: true });

    const suiteSource = await readFile(job.testFile, "utf8").catch(() => null);
    if (suiteSource !== null) {
        await writeFile(runSuitePath(job.id), suiteSource, "utf8");
    }

    const oldArtifactRoot = resolve(job.artifactDir);
    const evidenceDir = runEvidenceDir(job.id);
    const persistedArtifacts: Record<string, PersistedArtifactFile> = {};

    if (job.artifactFiles.size > 0) {
        await mkdir(evidenceDir, { recursive: true });
    }

    for (const [artifactId, artifact] of job.artifactFiles) {
        const oldPath = resolve(artifact.filePath);
        // TFP-198: the root plus a separator, so .../artifacts-run1 never claims .../artifacts-run10/file.png.
        const isUnderArtifactRoot = oldPath.startsWith(oldArtifactRoot + sep);
        const relativePath = isUnderArtifactRoot
            ? oldPath.slice(oldArtifactRoot.length).replace(/^[\\/]+/, "")
            : artifact.fileName;
        const newPath = join(evidenceDir, relativePath);

        await mkdir(dirname(newPath), { recursive: true });
        const moved = await rename(oldPath, newPath).then(() => true).catch(() => false);

        persistedArtifacts[artifactId] = {
            filePath: moved ? newPath : oldPath,
            fileName: artifact.fileName,
            contentType: artifact.contentType,
        };
    }

    const record: RunRecord = {
        runId: job.id,
        baseUrl: job.baseUrl ?? "",
        description: job.description,
        selectedPractices: job.selectedPractices,
        auditMode: job.auditMode,
        createdAt: new Date(job.createdAt).toISOString(),
        finishedAt: new Date(job.finishedAt ?? Date.now()).toISOString(),
        pinned: false,
        retention: "full",
        lastAccessedAt: null,
        result: job.result,
        artifactFiles: persistedArtifacts,
        contentProfile: job.contentProfile,
        enableInteractive: job.enableInteractive,
        login: job.login,
        generation: job.generation,
        ...(isComprehensive(job.runMode) ? { runMode: job.runMode } : {}),
    };

    await writeRunRecord(record);

    // Best-effort: the shared per-run artifact directory should now be empty
    // (everything moved into evidence/); clearing it avoids an orphaned,
    // untracked directory sitting outside runs/.
    await rm(oldArtifactRoot, { recursive: true, force: true }).catch(() => { });

    return persistedArtifacts;
}

export async function loadRunRecord(runId: string): Promise<RunRecord | null> {
    const text = await readFile(runJsonPath(runId), "utf8").catch(() => null);

    if (!text) {
        return null;
    }

    try {
        return JSON.parse(text) as RunRecord;
    } catch {
        return null;
    }
}

export async function listRunRecords(): Promise<RunRecord[]> {
    const entries = await readdir(RUNS_ROOT, { withFileTypes: true }).catch(() => []);
    const records = await Promise.all(
        entries.filter((entry) => entry.isDirectory() && isValidRunId(entry.name)).map((entry) => loadRunRecord(entry.name))
    );

    return records.filter((record): record is RunRecord => record !== null);
}

/**
 * Sets lastAccessedAt the first time a persisted run's report is read back.
 * A no-op once it's already set - this is a "has this ever been looked at"
 * signal, not a last-viewed timestamp.
 */
export async function markRunAccessed(runId: string): Promise<void> {
    const record = await loadRunRecord(runId);

    if (!record || record.lastAccessedAt !== null) {
        return;
    }

    record.lastAccessedAt = new Date().toISOString();
    await writeRunRecord(record);
}

export async function setRunPinned(runId: string, pinned: boolean): Promise<RunRecord | null> {
    const record = await loadRunRecord(runId);

    if (!record) {
        return null;
    }

    record.pinned = pinned;
    await writeRunRecord(record);
    return record;
}

/**
 * Manual archiving: deletes only evidence/. run.json and suite.spec.ts (and
 * therefore history, coverage numbers, and diffing) keep working afterward.
 */
export async function archiveRun(runId: string): Promise<RunRecord | null> {
    const record = await loadRunRecord(runId);

    if (!record) {
        return null;
    }

    await rm(runEvidenceDir(runId), { recursive: true, force: true }).catch(() => { });
    record.retention = "archived";
    record.artifactFiles = {};
    await writeRunRecord(record);
    return record;
}

function testTitlesWithStatus(record: RunRecord, status: "Failed" | "Passed"): Set<string> {
    const titles = (record.result.report?.execution ?? [])
        .filter((execution) => execution.status === status)
        .map((execution) => execution.title);

    return new Set(titles);
}

/**
 * TFP-198 (Decision 2): which runs can supersede each other - the same
 * baseUrl, the same selected practices (in any order) and the same run type
 * (Standard, or Comprehensive for one area). A link audit never supersedes
 * an accessibility audit of the same site. Records written before runMode
 * existed are Standard, as they were.
 */
export function suiteIdentity(record: Pick<RunRecord, "baseUrl" | "selectedPractices" | "runMode">): string {
    const runType = record.runMode?.kind === "comprehensive" ? `comprehensive:${record.runMode.area}` : "standard";
    return JSON.stringify([record.baseUrl || "", [...(record.selectedPractices ?? [])].sort(), runType]);
}

/**
 * On-demand sweep (Decision 5): a non-pinned run becomes eligible for
 * automatic archiving once a newer run of the same suite exists AND every
 * one of its own failing tests ran and passed in that newest run - i.e. it
 * isn't the only evidence for a defect nobody has shown fixed. Not a
 * scheduler; this runs once per call, triggered by an API call or manual
 * command.
 *
 * TFP-198 (GitHub issue #2; owner decision, 2026-10-13): only positive evidence clears
 * a failure. A failing title that is absent from the newest run, or skipped,
 * Not run, Blocked, Flaky or failing there, keeps the older run - and its
 * evidence - as it is (Decision 1). Before, "not failing in the newest run"
 * counted as fixed, so a later audit that never ran the test deleted the
 * only evidence of an open defect. Runs are compared only within one suite
 * identity (Decision 2).
 */
export async function sweepAutomaticArchiving(): Promise<string[]> {
    const records = await listRunRecords();
    const bySuite = new Map<string, RunRecord[]>();

    for (const record of records) {
        const key = suiteIdentity(record);
        const group = bySuite.get(key);

        if (group) {
            group.push(record);
        } else {
            bySuite.set(key, [record]);
        }
    }

    const archivedIds: string[] = [];

    for (const group of bySuite.values()) {
        if (group.length < 2) {
            continue;
        }

        const sorted = [...group].sort(
            (a, b) => new Date(a.finishedAt).getTime() - new Date(b.finishedAt).getTime()
        );
        const newest = sorted[sorted.length - 1];
        const newestPassingTitles = testTitlesWithStatus(newest, "Passed");

        for (const candidate of sorted.slice(0, -1)) {
            if (candidate.retention === "archived" || candidate.pinned) {
                continue;
            }

            const candidateFailingTitles = testTitlesWithStatus(candidate, "Failed");
            const stillOpen = [...candidateFailingTitles].some((title) => !newestPassingTitles.has(title));

            if (stillOpen) {
                continue;
            }

            await archiveRun(candidate.runId);
            archivedIds.push(candidate.runId);
        }
    }

    return archivedIds;
}
