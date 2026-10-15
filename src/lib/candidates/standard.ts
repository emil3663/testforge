import type { ContentProfile } from "@/lib/generate/mock/types";
import { buildCoverageMap, untouched } from "@/lib/report/coverage-map";
import type { CandidateBindingRecord } from "@/lib/report/types";
import { appendToDescribes, fingerprintOf } from "@/lib/site-suites/reuse";
import { hashOf, loadSiteSuiteAt, saveSiteSuite, siteSuiteDirFromStore, unitFileName, type GapAttempt, type StoredUnit } from "@/lib/site-suites/store";
import { parseTestUnits } from "@/lib/site-suites/units";
import { forbiddenConstruct } from "@/lib/gap-writer/code-check";
import { composeGapTest, runGapTest, type GapRunOutcome } from "@/lib/gap-writer/gap-run";
import { doneGaps, GAP_DESCRIBE, targetOf } from "@/lib/gap-writer/write";
import type { GapTarget } from "@/lib/gap-writer/writers";
import { bindCandidate, loadPool, matchingCandidate, patternOf } from "./pool";

/**
 * Phase 42 (TFP-203, batch 2 ruling 2; Emil, 2026-10-14): on Standard, a
 * pool candidate that matches a gap becomes that gap's test, as Decision 8
 * intends ("used instead of writing another"). As TFP-195 built it, such a
 * gap got no test on Standard at all: the writer skipped it because a
 * candidate matched, and Standard never runs candidates.
 *
 * For each element or link no test checks in context (TFP-201's gap list),
 * not already covered or tried, whose pattern an active candidate matches:
 * the candidate is bound to this site's page and locator and goes through
 * the same gates as a written gap test (gap-run.ts: the code check, the
 * type check, a run at the read-only gate inside the request guard).
 * - It passes: it joins the site suite under "Gap tests" as that gap's
 *   test, inside the verdict, and is reused while its page type holds, like
 *   a written one. No writer is asked for the gap. Its runs add to the
 *   candidate's evidence, as Comprehensive runs do (Emil, 2026-10-15: the
 *   promotion rule counts distinct sites, so this is cross-site evidence).
 * - It fails: it is not bound, and the gap is recorded as tried, so it isn't
 *   run again while its page type holds.
 *
 * Nothing leaves the machine, so this doesn't wait for the site's gap-writer
 * opt-in (as TFP-195's matching doesn't). Comprehensive is unchanged: there
 * candidates run in their own section, outside the verdict (apply.ts).
 */
export async function bindCandidatesToGaps(options: {
    baseUrl: string;
    store: string;
    code: string;
    profile: ContentProfile | null;
    run?: (baseUrl: string, target: GapTarget, body: string) => Promise<GapRunOutcome>;
}): Promise<{ code: string; record: CandidateBindingRecord | null }> {
    const run = options.run ?? runGapTest;
    const dir = siteSuiteDirFromStore(options.store);
    const saved = dir ? await loadSiteSuiteAt(dir) : null;
    const map = buildCoverageMap(options.profile, options.code);
    const pool = await loadPool();
    if (!dir || !saved || !map || pool.length === 0) return { code: options.code, record: null };

    const done = doneGaps(saved.manifest);
    const fingerprint = fingerprintOf(options.profile);
    const typeOf = (path: string) => fingerprint.typeOfPath.get(path) ?? "site";
    const record: CandidateBindingRecord = { bound: 0, notBound: 0, tests: [] };
    const newUnits: StoredUnit[] = [];
    const attempts: GapAttempt[] = [];
    const files = new Map<string, string>();
    const sources: string[] = [];

    for (const entry of untouched(map).filter((item) => (item.kind === "element" || item.kind === "link") && !done.has(item.key))) {
        const target = targetOf(entry);
        const candidate = matchingCandidate(pool, patternOf(target.kind, target.name));
        if (!candidate || !target.locator) continue;
        const reached = forbiddenConstruct(candidate.body);
        const body = bindCandidate(candidate, target.page, target.locator);
        const outcome: GapRunOutcome = reached ? { verdict: "invalid", message: `the candidate uses ${reached}` } : await run(options.baseUrl, target, body);
        const title = `gap test: ${target.name} on ${target.page}`;
        if (outcome.verdict === "passed") {
            // Named as the candidate's, so each run of it here adds to its evidence (evidence.ts), as on Comprehensive.
            const source = composeGapTest(target, body, candidate.id);
            const unit = parseTestUnits(`test.describe('${GAP_DESCRIBE}', () => {\n${source}\n});`)[0];
            const file = unitFileName(unit.key);
            files.set(file, source);
            sources.push(source);
            newUnits.push({ unit: file, key: unit.key, describe: [GAP_DESCRIBE], title: unit.title, type: typeOf(target.page), writtenHash: hashOf(source), writtenAt: new Date().toISOString(), origin: "gap-writer", covers: target.key, writer: "candidate", candidate: candidate.id });
            record.bound++;
            record.tests.push({ title, covers: target.key, candidate: candidate.id, outcome: "bound" });
            continue;
        }
        record.notBound++;
        attempts.push({ key: target.key, type: typeOf(target.page), outcome: outcome.verdict, at: new Date().toISOString(), candidate: candidate.id });
        record.tests.push({ title, covers: target.key, candidate: candidate.id, outcome: `not bound: ${outcome.verdict === "breach" ? "read-only gate breach" : outcome.message.split("\n")[0].slice(0, 200)}` });
    }

    if (newUnits.length === 0 && attempts.length === 0) return { code: options.code, record: null };
    await saveSiteSuite({ ...saved.manifest, units: [...saved.manifest.units, ...newUnits], gapAttempts: [...(saved.manifest.gapAttempts ?? []), ...attempts] }, files);
    const code = sources.length > 0 ? appendToDescribes(options.code, new Map([[JSON.stringify([GAP_DESCRIBE]), sources]])) : options.code;
    return { code, record };
}
