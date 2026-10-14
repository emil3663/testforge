import { join } from "path";
import { writeFile } from "fs/promises";
import type { ContentProfile } from "@/lib/generate/mock/types";
import { buildCoverageMap, untouched } from "@/lib/report/coverage-map";
import type { CoverageMapEntry, GapWritingRecord } from "@/lib/report/types";
import { appendToDescribes, fingerprintOf } from "@/lib/site-suites/reuse";
import { hashOf, loadSiteSuiteAt, saveSiteSuite, siteSuiteDirFromStore, unitFileName, type GapAttempt, type StoredUnit } from "@/lib/site-suites/store";
import { parseTestUnits } from "@/lib/site-suites/units";
import { addToPool, bindCandidate, loadPool, matchingCandidate, patternOf, poolHas } from "@/lib/candidates/pool";
import { composeGapTest, runGapTest, type GapRunOutcome } from "./gap-run";
import { revisionPrompt, type GapTarget, type GapWriter } from "./writers";

/**
 * Phase 42 (TFP-194, Decisions 5 and 6): gap tests, once per gap. For each
 * element or link no test checks in context (TFP-201's gap list), up to
 * `limit` per generation, the site's writer writes a test body; TestForge
 * runs it behind the gates (gap-run.ts), and a failure goes back to the
 * writer for a revision, up to `maxAttempts`. A breach of the read-only
 * gate rejects the test at once.
 *
 * A test that passes joins the site suite, in its own describe ("Gap
 * tests"), and is reused on later runs while its page type holds (TFP-190).
 * A gap that ended without a test is recorded, and not asked for again
 * while its page type holds. A re-run of an unchanged site therefore asks
 * the writer for nothing.
 *
 * TFP-195 (Decision 8): the pool is checked first - a gap whose pattern a
 * candidate already matches gets no new test (Comprehensive runs the
 * candidate; Standard never does). After a test is saved, the writer
 * generalises it, TestForge binds that back to the same element and runs
 * it, and a candidate that passes joins the pool.
 */

export const GAP_DESCRIBE = "Gap tests";
export const DEFAULT_GAP_LIMIT = 5;
export const MAX_GAP_ATTEMPTS = 3;

/** The element's locator as the coverage map recorded it in its key, or the link's by its text. */
export function targetOf(entry: CoverageMapEntry): GapTarget {
    const element = / element (.+)$/.exec(entry.key)?.[1] ?? null;
    const link = entry.kind === "link" ? (JSON.parse(entry.key.slice("link ".length)) as [string, string]) : null;
    const locator = element ?? (link && link[0] ? `page.getByRole('link', { name: ${JSON.stringify(link[0])}, exact: true })` : null);
    return { key: entry.key, page: entry.page, name: entry.name, kind: entry.kind === "link" ? "link" : "element", locator };
}

export function gapLimit(): number {
    const configured = Number(process.env.TESTFORGE_GAP_LIMIT);
    return Number.isInteger(configured) && configured >= 0 ? configured : DEFAULT_GAP_LIMIT;
}

export async function writeGapTests(options: {
    baseUrl: string;
    store: string;
    code: string;
    profile: ContentProfile | null;
    writer: GapWriter;
    limit?: number;
    run?: (baseUrl: string, target: GapTarget, body: string) => Promise<GapRunOutcome>;
}): Promise<{ code: string; record: GapWritingRecord }> {
    const run = options.run ?? runGapTest;
    const limit = options.limit ?? gapLimit();
    const record: GapWritingRecord = { writer: options.writer.name, gaps: 0, asked: 0, saved: 0, rejected: 0, failed: 0, costUsd: 0, tests: [], candidates: { matched: 0, added: 0, notKept: 0 } };
    const dir = siteSuiteDirFromStore(options.store);
    const saved = dir ? await loadSiteSuiteAt(dir) : null;
    const map = buildCoverageMap(options.profile, options.code);
    if (!dir || !saved || !map) return { code: options.code, record };

    // Gaps already written for, or already tried, are not asked for again.
    const done = new Set([
        ...saved.manifest.units.filter((unit) => unit.origin === "gap-writer" && unit.covers).map((unit) => unit.covers!),
        ...(saved.manifest.gapAttempts ?? []).map((attempt) => attempt.key),
    ]);
    const pool = await loadPool();
    const open = untouched(map).filter((entry) => (entry.kind === "element" || entry.kind === "link") && !done.has(entry.key));
    // A gap a pool candidate already matches gets no new test.
    const gaps = open.filter((entry) => !matchingCandidate(pool, patternOf(entry.kind === "link" ? "link" : "element", entry.name)));
    record.candidates!.matched = open.length - gaps.length;
    record.gaps = gaps.length;
    const fingerprint = fingerprintOf(options.profile);
    const typeOf = (path: string) => fingerprint.typeOfPath.get(path) ?? "site";
    const newUnits: StoredUnit[] = [];
    const attempts: GapAttempt[] = [];
    const files = new Map<string, string>();
    const sources: string[] = [];

    for (const entry of gaps.slice(0, limit)) {
        const target = targetOf(entry);
        record.asked++;
        let cost = 0;
        let outcome: GapRunOutcome | null = null;
        let body = "";
        let tries = 0;
        let error: string | null = null;
        try {
            while (tries < MAX_GAP_ATTEMPTS) {
                tries++;
                const reply = tries === 1
                    ? await options.writer.write(target, options.baseUrl)
                    : await options.writer.revise(revisionPrompt(outcome!.verdict === "invalid", "message" in outcome! ? outcome!.message : ""));
                cost += reply.costUsd ?? 0;
                body = reply.body;
                outcome = await run(options.baseUrl, target, body);
                if (outcome.verdict === "passed" || outcome.verdict === "breach") break;
            }
        } catch (caught) {
            error = caught instanceof Error ? caught.message : String(caught);
        }
        record.costUsd += cost;
        const title = `gap test: ${target.name} on ${target.page}`;
        if (outcome?.verdict === "passed" && !error) {
            const source = composeGapTest(target, body);
            const unit = parseTestUnits(`test.describe('${GAP_DESCRIBE}', () => {\n${source}\n});`)[0];
            const file = unitFileName(unit.key);
            files.set(file, source);
            sources.push(source);
            newUnits.push({ unit: file, key: unit.key, describe: [GAP_DESCRIBE], title: unit.title, type: typeOf(target.page), writtenHash: hashOf(source), writtenAt: new Date().toISOString(), origin: "gap-writer", covers: target.key, writer: options.writer.name });
            record.saved++;
            // TFP-195: the second output - the same test, generalised, checked, then pooled.
            const pattern = patternOf(target.kind, target.name);
            let candidateNote = "";
            if (!poolHas(pool, pattern) && target.locator) {
                try {
                    const general = await options.writer.generalise();
                    cost += general.costUsd ?? 0;
                    record.costUsd += general.costUsd ?? 0;
                    const back = general.body.includes("__LOCATOR__") ? await run(options.baseUrl, target, bindCandidate({ body: general.body }, target.page, target.locator)) : null;
                    if (back?.verdict === "passed") {
                        const added = await addToPool({ pattern, body: general.body, gate: "read-only", technique: `error guessing (written by ${options.writer.name} for one uncovered ${target.kind}, generalised to its pattern)`, writer: options.writer.name, sources: [{ origin: new URL(options.baseUrl).origin, page: target.page, at: new Date().toISOString() }], costUsd: general.costUsd ?? 0 });
                        pool.push(added.candidate);
                        record.candidates!.added++;
                        candidateNote = `; candidate ${added.candidate.id} ${added.merged ? "merged" : "added"}`;
                    } else {
                        record.candidates!.notKept++;
                        candidateNote = back ? `; its candidate didn't pass bound back to this ${target.kind}` : "; its candidate had no __LOCATOR__ blank";
                    }
                } catch (caught) {
                    record.candidates!.notKept++;
                    candidateNote = `; no candidate: ${caught instanceof Error ? caught.message : String(caught)}`;
                }
            }
            record.tests.push({ title, covers: target.key, attempts: tries, costUsd: cost, outcome: `saved${candidateNote}` });
            continue;
        }
        const verdict: GapAttempt["outcome"] = error ? "error" : outcome?.verdict === "breach" ? "breach" : outcome?.verdict === "invalid" ? "invalid" : "failed";
        if (verdict === "breach") record.rejected++;
        else record.failed++;
        attempts.push({ key: target.key, type: typeOf(target.page), outcome: verdict, at: new Date().toISOString() });
        record.tests.push({ title, covers: target.key, attempts: tries, costUsd: cost, outcome: verdict === "breach" ? "rejected: read-only gate breach" : verdict === "error" ? `not written: ${error}` : `not kept after ${tries} attempts: ${outcome && "message" in outcome ? outcome.message.split("\n")[0].slice(0, 200) : "no result"}` });
        // A writer that can't be reached (not installed, not signed in) won't be reached for the next gap either.
        if (error) break;
    }

    if (newUnits.length === 0 && attempts.length === 0) return { code: options.code, record };
    await saveSiteSuite({ ...saved.manifest, units: [...saved.manifest.units, ...newUnits], gapAttempts: [...(saved.manifest.gapAttempts ?? []), ...attempts] }, files);
    await writeFile(join(dir, "gap-writing.json"), JSON.stringify(record, null, 2), "utf8");
    const code = sources.length > 0 ? appendToDescribes(options.code, new Map([[JSON.stringify([GAP_DESCRIBE]), sources]])) : options.code;
    return { code, record };
}
