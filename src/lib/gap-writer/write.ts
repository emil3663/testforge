import { createHash } from "crypto";
import { join } from "path";
import { writeFile } from "fs/promises";
import type { ContentProfile, LinkDetail } from "@/lib/generate/mock/types";
import { buildLinkLocatorExpression } from "@/lib/generate/mock/locators";
import { buildCoverageMap, untouched } from "@/lib/report/coverage-map";
import type { CoverageMapEntry, GapWritingRecord } from "@/lib/report/types";
import { appendToDescribes, fingerprintOf } from "@/lib/site-suites/reuse";
import { hashOf, loadSiteSuiteAt, saveSiteSuite, siteSuiteDirFromStore, unitFileName, type GapAttempt, type SiteSuiteManifest, type StoredUnit } from "@/lib/site-suites/store";
import { parseTestUnits } from "@/lib/site-suites/units";
import { addToPool, bindCandidate, loadPool, matchingCandidate, patternOf, poolHas } from "@/lib/candidates/pool";
import { composeGapTest, gapTestTitle, runGapTest, type GapRunOutcome } from "./gap-run";
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
 * candidate; on Standard it becomes the gap's test, TFP-203,
 * src/lib/candidates/standard.ts). After a test is saved, the writer
 * generalises it, TestForge binds that back to the same element and runs
 * it, and a candidate that passes joins the pool.
 */

export const GAP_DESCRIBE = "Gap tests";
export const DEFAULT_GAP_LIMIT = 5;
export const MAX_GAP_ATTEMPTS = 3;

/**
 * The element's locator as the coverage map recorded it in its key, or the link's by its text. TFP-203: the link's is
 * the generator's own expression, which is what the coverage map looks for; a double-quoted one never matched it, so a
 * gap test of a link never counted it covered.
 */
export function targetOf(entry: CoverageMapEntry, all: CoverageMapEntry[] = []): GapTarget {
    const element = / element (.+)$/.exec(entry.key)?.[1] ?? null;
    const link = entry.kind === "link" ? (JSON.parse(entry.key.slice("link ".length)) as [string, string]) : null;
    const locator = element ?? (link && link[0] ? buildLinkLocatorExpression({ text: link[0], url: link[1] } as LinkDetail) : null);
    const label = distinctLabel(entry.name, entry.page, entry.key, all.filter((other) => other.page === entry.page).map((other) => other.name));
    return { key: entry.key, page: entry.page, name: entry.name, kind: entry.kind === "link" ? "link" : "element", locator, ...(label !== entry.name ? { label } : {}) };
}

/**
 * TFP-197 (found in its run on the with-bugs copy): a page can have two elements the coverage map names alike
 * (form fields named "3 [input]" and "3 [input]"), and two tests with one title make Playwright refuse the whole
 * file - the run had no tests at all. A name another element on the page shares gets a short, stable suffix from
 * its key (`3 [input] #1a2b3c`); every other name is left as it is, so their titles don't change.
 */
export function distinctLabel(name: string, page: string, key: string, namesOnPage: string[]): string {
    if (namesOnPage.filter((other) => other === name).length < 2) return name;
    return `${name} #${createHash("sha256").update(`${page}
${key}`).digest("hex").slice(0, 6)}`;
}

/** The gaps a site suite already has a test for (written, or a bound candidate's, TFP-203), or has tried. */
export function doneGaps(manifest: SiteSuiteManifest): Set<string> {
    return new Set([
        ...manifest.units.filter((unit) => unit.origin === "gap-writer" && unit.covers).map((unit) => unit.covers!),
        ...(manifest.gapAttempts ?? []).map((attempt) => attempt.key),
    ]);
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
    const done = doneGaps(saved.manifest);
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
        const target = targetOf(entry, map.entries);
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
        const title = gapTestTitle(target);
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
