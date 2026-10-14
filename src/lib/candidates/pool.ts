import { createHash } from "crypto";
import { mkdir, readdir, readFile, rename, writeFile } from "fs/promises";
import { join } from "path";
import { dataDir } from "@/lib/storage/data-dir";

/**
 * Phase 42 (TFP-195, Decision 8): the candidate pool - gap tests generalised
 * to their component's pattern, on their way to the library. It sits in
 * TestForge's data folder beside the site suites, one file per pattern:
 *
 *   <data>/candidates/<id>.json
 *
 * A candidate's body has two blanks, `__PAGE__` (the page's path) and
 * `__LOCATOR__` (how to find the element), filled in for each site it runs
 * on. Its pattern is the element's kind, its type and its name, read from
 * the coverage map: two candidates for one pattern are one file, merged,
 * never kept side by side. A rejected candidate stays, with its reason, so
 * the same test isn't proposed again.
 */

export interface CandidatePattern {
    kind: "element" | "link";
    /** The element's type as the map names it ("input", "button", "link"). */
    type: string;
    /** Its name, lower-cased, spaces collapsed. */
    name: string;
}

export interface CandidateEvidence {
    origin: string;
    page: string;
    at: string;
    /** The run's verdict for it: "Passed", "Failed", "Not run"... */
    status: string;
    run: string | null;
}

export interface Candidate {
    id: string;
    pattern: CandidatePattern;
    body: string;
    gate: "read-only";
    technique: string;
    writer: string;
    /** Where it was written, then where else a gap test of this pattern was (merged). */
    sources: Array<{ origin: string; page: string; at: string }>;
    /** Every later run it took part in. */
    evidence: CandidateEvidence[];
    status: "candidate" | "rejected" | "promoted";
    /** Why it was rejected (TFP-196), or the library entry it became. */
    reason?: string;
    costUsd: number;
}

/** The pattern of a coverage map entry: "Rentals [link]" -> link, link, "rentals". */
export function patternOf(kind: "element" | "link", name: string): CandidatePattern {
    const type = /\[([^\]]+)\]\s*$/.exec(name)?.[1] ?? kind;
    return { kind, type, name: name.replace(/\s*\[[^\]]+\]\s*$/, "").replace(/\s+/g, " ").trim().toLowerCase() };
}

export function candidateId(pattern: CandidatePattern): string {
    return createHash("sha256").update(JSON.stringify([pattern.kind, pattern.type, pattern.name])).digest("hex").slice(0, 12);
}

const poolDir = () => join(dataDir(), "candidates");

export async function loadPool(): Promise<Candidate[]> {
    const names = await readdir(poolDir()).catch(() => [] as string[]);
    const candidates: Candidate[] = [];
    for (const name of names.filter((file) => file.endsWith(".json")).sort()) {
        const text = await readFile(join(poolDir(), name), "utf8").catch(() => null);
        try {
            if (text) candidates.push(JSON.parse(text) as Candidate);
        } catch {
            // An unreadable file is no candidate.
        }
    }
    return candidates;
}

export async function loadCandidate(id: string): Promise<Candidate | null> {
    if (!/^[0-9a-f]{12}$/.test(id)) return null;
    const text = await readFile(join(poolDir(), `${id}.json`), "utf8").catch(() => null);
    try {
        return text ? (JSON.parse(text) as Candidate) : null;
    } catch {
        return null;
    }
}

export async function saveCandidate(candidate: Candidate): Promise<void> {
    await mkdir(poolDir(), { recursive: true });
    const file = join(poolDir(), `${candidate.id}.json`);
    await writeFile(`${file}.tmp`, JSON.stringify(candidate, null, 2), "utf8");
    await rename(`${file}.tmp`, file);
}

/**
 * Adds a generalised gap test to the pool. A pattern already there is the
 * same candidate: the new site is added to its sources, and its body kept
 * (merged, not kept side by side). A rejected pattern stays rejected.
 */
export async function addToPool(candidate: Omit<Candidate, "id" | "evidence" | "status">): Promise<{ candidate: Candidate; merged: boolean }> {
    const id = candidateId(candidate.pattern);
    const existing = await loadCandidate(id);
    if (existing) {
        const merged = { ...existing, sources: [...existing.sources, ...candidate.sources.filter((source) => !existing.sources.some((known) => known.origin === source.origin && known.page === source.page))] };
        await saveCandidate(merged);
        return { candidate: merged, merged: true };
    }
    const created: Candidate = { ...candidate, id, evidence: [], status: "candidate" };
    await saveCandidate(created);
    return { candidate: created, merged: false };
}

/** The active candidate for a pattern, if the pool has one (rejected and promoted ones aren't run as candidates). */
export function matchingCandidate(pool: Candidate[], pattern: CandidatePattern): Candidate | null {
    const id = candidateId(pattern);
    return pool.find((candidate) => candidate.id === id && candidate.status === "candidate") ?? null;
}

/** Whether the pool has the pattern at all, in any state: then no new candidate is proposed for it. */
export function poolHas(pool: Candidate[], pattern: CandidatePattern): boolean {
    const id = candidateId(pattern);
    return pool.some((candidate) => candidate.id === id);
}

/** The body bound to one site: its page's path and the element's locator in the blanks. */
export function bindCandidate(candidate: Pick<Candidate, "body">, page: string, locator: string): string {
    return candidate.body.split("__PAGE__").join(page).split("__LOCATOR__").join(locator);
}

export async function recordEvidence(id: string, evidence: CandidateEvidence): Promise<void> {
    const candidate = await loadCandidate(id);
    if (!candidate) return;
    await saveCandidate({ ...candidate, evidence: [...candidate.evidence, evidence] });
}
