import { mkdir, readdir, readFile, writeFile } from "fs/promises";
import { join, relative } from "path";
import { loadCandidate, loadPool, saveCandidate, type Candidate } from "./pool";

/**
 * Phase 42 (TFP-196, Decision 8's promotion rule, Emil 2026-10-12): a
 * candidate is promoted to the library when it has passed the gates on every
 * run, and either caught a real defect (a benchmark bug, or a failure a
 * person labelled real) or run on 3 sites with the pattern with no
 * unlabelled failure, and Emil has approved it.
 *
 * - Only a candidate that meets the rule is offered; approving one below it
 *   is refused.
 * - A rejection is kept with its reason; the pattern is never proposed again
 *   (the pool keeps the file, so TFP-195 never pools that pattern anew).
 * - Promotion is a library commit through Claude Code: `promoteApproved`
 *   writes each approved candidate, with its evidence, as an entry under
 *   src/lib/library/promoted/, and marks it promoted in the pool. Claude
 *   Code runs it and commits the entries, reviewed like any code. TestForge
 *   never writes into the repo itself.
 */

export const CLEAN_SITES_FOR_PROMOTION = 3;
const FAILED = new Set(["Failed", "Blocked"]);

export interface PromotionVerdict {
    meetsRule: boolean;
    runs: number;
    gatesPassedEveryRun: boolean;
    realDefect: boolean;
    /** Sites it ran on. */
    sites: number;
    unlabelledFailures: number;
    /** Why it does or doesn't meet the rule, in words. */
    reasons: string[];
}

export function promotionVerdict(candidate: Candidate): PromotionVerdict {
    const runs = candidate.evidence;
    const breaches = runs.filter((run) => run.breach).length;
    const gatesPassedEveryRun = runs.length > 0 && breaches === 0;
    const realDefect = runs.some((run) => run.label === "real" || run.bug !== undefined);
    const sites = new Set(runs.map((run) => run.origin)).size;
    const unlabelledFailures = runs.filter((run) => FAILED.has(run.status) && !run.label && run.bug === undefined).length;
    const cleanSites = sites >= CLEAN_SITES_FOR_PROMOTION && unlabelledFailures === 0;
    const reasons = [
        runs.length === 0 ? "it has not run yet" : breaches > 0 ? `it breached the read-only gate on ${breaches} of ${runs.length} runs` : `it passed the gates on all ${runs.length} runs`,
        realDefect ? "it caught a real defect" : "it has caught no real defect",
        `it ran on ${sites} ${sites === 1 ? "site" : "sites"} (${CLEAN_SITES_FOR_PROMOTION} needed without one)${unlabelledFailures > 0 ? `, with ${unlabelledFailures} unlabelled ${unlabelledFailures === 1 ? "failure" : "failures"}` : ""}`,
    ];
    return { meetsRule: gatesPassedEveryRun && (realDefect || cleanSites), runs: runs.length, gatesPassedEveryRun, realDefect, sites, unlabelledFailures, reasons };
}

/** The candidates to offer Emil: in the pool, not decided, and meeting the rule. */
export async function offeredCandidates(): Promise<Array<{ candidate: Candidate; verdict: PromotionVerdict }>> {
    return (await loadPool())
        .filter((candidate) => candidate.status === "candidate")
        .map((candidate) => ({ candidate, verdict: promotionVerdict(candidate) }))
        .filter(({ verdict }) => verdict.meetsRule);
}

export class PromotionError extends Error {}

export async function approveCandidate(id: string, by: string): Promise<Candidate> {
    const candidate = await loadCandidate(id);
    if (!candidate) throw new PromotionError(`no candidate ${id}`);
    if (candidate.status !== "candidate") throw new PromotionError(`candidate ${id} is ${candidate.status}, not open for a decision`);
    const verdict = promotionVerdict(candidate);
    if (!verdict.meetsRule) throw new PromotionError(`candidate ${id} doesn't meet the promotion rule: ${verdict.reasons.join("; ")}`);
    const approved: Candidate = { ...candidate, status: "approved", approved: { by, at: new Date().toISOString() } };
    await saveCandidate(approved);
    return approved;
}

export async function rejectCandidate(id: string, reason: string): Promise<Candidate> {
    const candidate = await loadCandidate(id);
    if (!candidate) throw new PromotionError(`no candidate ${id}`);
    if (candidate.status === "promoted") throw new PromotionError(`candidate ${id} is already a library entry`);
    if (!reason.trim()) throw new PromotionError("a rejection needs its reason");
    const rejected: Candidate = { ...candidate, status: "rejected", reason: reason.trim() };
    await saveCandidate(rejected);
    return rejected;
}

/** A person's label for one run's failure: a real defect (optionally a benchmark bug), or not one. */
export async function labelRun(id: string, run: string, label: "real" | "not a defect", bug?: number): Promise<Candidate> {
    const candidate = await loadCandidate(id);
    if (!candidate) throw new PromotionError(`no candidate ${id}`);
    if (!candidate.evidence.some((evidence) => evidence.run === run)) throw new PromotionError(`candidate ${id} has no run ${run}`);
    const labelled: Candidate = {
        ...candidate,
        evidence: candidate.evidence.map((evidence) => (evidence.run === run ? { ...evidence, label, ...(bug !== undefined ? { bug } : {}) } : evidence)),
    };
    await saveCandidate(labelled);
    return labelled;
}

/** A library entry made from a promoted candidate (src/lib/library/promoted/<id>.json). */
export interface PromotedEntry {
    id: string;
    pattern: Candidate["pattern"];
    body: string;
    gate: "read-only";
    technique: string;
    writer: string;
    sources: Candidate["sources"];
    evidence: Candidate["evidence"];
    approved: { by: string; at: string };
    caught: number[];
}

export const PROMOTED_DIR = join("src", "lib", "library", "promoted");

/** Writes every approved candidate as a library entry under `libraryDir` and marks it promoted; returns the files written. */
export async function promoteApproved(libraryDir: string = join(process.cwd(), PROMOTED_DIR)): Promise<string[]> {
    const written: string[] = [];
    await mkdir(libraryDir, { recursive: true });
    for (const candidate of (await loadPool()).filter((item) => item.status === "approved" && item.approved)) {
        const entry: PromotedEntry = {
            id: candidate.id,
            pattern: candidate.pattern,
            body: candidate.body,
            gate: candidate.gate,
            technique: candidate.technique,
            writer: candidate.writer,
            sources: candidate.sources,
            evidence: candidate.evidence,
            approved: candidate.approved!,
            caught: [...new Set(candidate.evidence.flatMap((run) => (run.bug !== undefined ? [run.bug] : [])))].sort((a, b) => a - b),
        };
        const file = join(libraryDir, `${candidate.id}.json`);
        await writeFile(file, `${JSON.stringify(entry, null, 2)}\n`, "utf8");
        await saveCandidate({ ...candidate, status: "promoted", reason: `library entry ${relative(process.cwd(), file).replace(/\\/g, "/")}` });
        written.push(file);
    }
    return written;
}

/** The library's promoted entries, as committed. */
export async function loadPromotedEntries(libraryDir: string = join(process.cwd(), PROMOTED_DIR)): Promise<PromotedEntry[]> {
    const names = (await readdir(libraryDir).catch(() => [] as string[])).filter((name) => name.endsWith(".json")).sort();
    return Promise.all(names.map(async (name) => JSON.parse(await readFile(join(libraryDir, name), "utf8")) as PromotedEntry));
}
