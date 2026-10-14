import { escapeForSingleQuotedString } from "@/lib/generate/mock/format";
import type { ContentProfile } from "@/lib/generate/mock/types";
import { buildCoverageMap, untouched } from "@/lib/report/coverage-map";
import { targetOf } from "@/lib/gap-writer/write";
import { appendToDescribes } from "@/lib/site-suites/reuse";
import { loadSiteSuiteAt, siteSuiteDirFromStore } from "@/lib/site-suites/store";
import { CANDIDATE_DESCRIBE } from "./constants";
import { bindCandidate, loadPool, matchingCandidate, patternOf } from "./pool";

/**
 * Phase 42 (TFP-195, Decision 8): on a Comprehensive run, each element or
 * link no test checks in context whose pattern a pool candidate matches
 * gets that candidate, bound to this site's page and locator, in its own
 * describe ("Candidate tests"). Its results count toward nothing (the
 * report's own section, outside the verdict), and each run adds to its
 * evidence (src/lib/run/jobs.ts). Standard never runs candidates (Emil,
 * 2026-10-12): the caller only asks on a Comprehensive run.
 *
 * Nothing here leaves the machine, so it doesn't wait for the site's
 * gap-writer opt-in.
 */

const CANDIDATE_TITLE = /^candidate ([0-9a-f]{12}): /;

/** The candidate a test title names, or null. */
export function candidateIdOf(title: string): string | null {
    return CANDIDATE_TITLE.exec(title.replace(/^TF[A-Z]+-\d+: /, ""))?.[1] ?? null;
}

/** `store`: the run's site suite; an element its own gap tests cover gets no candidate. */
export async function applyCandidates(code: string, profile: ContentProfile | null, store?: string): Promise<{ code: string; bound: Array<{ id: string; covers: string }> }> {
    const map = buildCoverageMap(profile, code);
    if (!map) return { code, bound: [] };
    const pool = await loadPool();
    if (pool.length === 0) return { code, bound: [] };
    const dir = store ? siteSuiteDirFromStore(store) : null;
    const saved = dir ? await loadSiteSuiteAt(dir) : null;
    const ownGapTests = new Set((saved?.manifest.units ?? []).filter((unit) => unit.origin === "gap-writer" && unit.covers).map((unit) => unit.covers!));
    const bound: Array<{ id: string; covers: string }> = [];
    const sources: string[] = [];
    for (const entry of untouched(map).filter((item) => (item.kind === "element" || item.kind === "link") && !ownGapTests.has(item.key))) {
        const target = targetOf(entry);
        const candidate = matchingCandidate(pool, patternOf(target.kind, target.name));
        if (!candidate || !target.locator) continue;
        const body = bindCandidate(candidate, target.page, target.locator);
        const indented = body.split("\n").map((line) => (line.trim() ? `      ${line}` : "")).join("\n");
        sources.push(`  test('${escapeForSingleQuotedString(`candidate ${candidate.id}: ${target.name} on ${target.page}`)}', { annotation: [{ type: 'gate', description: 'read-only' }, { type: 'page', description: '${escapeForSingleQuotedString(target.page)}' }, { type: 'candidate', description: '${candidate.id}' }] }, async ({ page }) => {
    await tfReadOnlyGuarded(page, async () => {
${indented}
    });
  });`);
        bound.push({ id: candidate.id, covers: entry.key });
    }
    if (sources.length === 0) return { code, bound };
    return { code: appendToDescribes(code, new Map([[JSON.stringify([CANDIDATE_DESCRIBE]), sources]])), bound };
}
