import { flattenSuites } from "@/lib/report/execution";
import type { JsonReport, JsonSuite, SiteSuiteRecheck } from "@/lib/report/types";
import { normalizeContentProfile } from "@/lib/generate/normalize";
import type { ContentProfile } from "@/lib/generate/mock/types";
import { applySiteSuite, fingerprintOf, typeOfUnit } from "./reuse";
import { hashOf, loadSiteSuiteAt, loadSiteSuiteProfile, siteSuiteDirFromStore } from "./store";
import { templateSuite } from "./template";
import { parseTestUnits, type TestUnit } from "./units";

/**
 * Phase 42 (TFP-191, Decision 1's stale-test rule; Emil, 2026-10-13): after a
 * run, each failing test that was reused from the site suite, and not edited
 * by hand, has its page read again - with the same inspection that saved the
 * page's signature, so the two compare like for like.
 *
 * - The page's signature is the saved one: the failure stands, as it is.
 * - It differs: the page type is stale. Its pages are inspected afresh, its
 *   tests written again from that inspection (the site suite is saved with
 *   them), and re-run. Only the re-run's results are reported; the report
 *   names the regeneration and the signature change.
 *
 * Site-wide tests (a test of no single page type) are not re-read: their
 * failures stand. Nor are hand-edited tests: they are never regenerated.
 */

export type InspectPages = (baseUrl: string, paths: string[]) => Promise<unknown>;
/** Runs the given tests of a suite and returns Playwright's JSON report, or null when it gave none. */
export type RerunTests = (code: string, titles: string[]) => Promise<JsonReport | null>;

export interface StaleRecheckResult {
    /** The suite as it now stands: the stale types' tests written again. */
    code: string;
    /** The run's report with the stale types' results replaced by the re-run's. */
    report: JsonReport;
    recheck: SiteSuiteRecheck;
}

const fullTitle = (unit: TestUnit) => (unit.id ? `${unit.id}: ${unit.title}` : unit.title);
const ID = /^(TF[A-Z]+-\d+): /;

/** Every spec of a report, with the function that keeps or renames it. */
function mapSpecs(suites: JsonSuite[], keep: (title: string) => string | null): JsonSuite[] {
    return suites.map((suite) => ({
        ...suite,
        specs: (suite.specs ?? []).flatMap((spec) => {
            const title = keep(spec.title);
            return title === null ? [] : [{ ...spec, title }];
        }),
        ...(suite.suites ? { suites: mapSpecs(suite.suites, keep) } : {}),
    }));
}

export async function recheckStaleTests(options: {
    baseUrl: string;
    store: string;
    suiteCode: string;
    report: JsonReport;
    inspect: InspectPages;
    rerun: RerunTests;
}): Promise<StaleRecheckResult | null> {
    const dir = siteSuiteDirFromStore(options.store);
    if (!dir) return null;
    const saved = await loadSiteSuiteAt(dir);
    const inputs = saved?.manifest.inputs;
    if (!saved || !inputs) return null;
    const { manifest } = saved;

    const units = parseTestUnits(options.suiteCode);
    const unitById = new Map(units.filter((unit) => unit.id).map((unit) => [unit.id, unit]));
    const storedByKey = new Map(manifest.units.map((unit) => [unit.key, unit]));
    const edited = (key: string) => {
        const stored = storedByKey.get(key);
        const source = stored ? saved.sources.get(stored.unit) : undefined;
        return source !== undefined && hashOf(source) !== stored!.writtenHash;
    };

    // The failing tests that were reused (written before this generation) and not edited, of one page type.
    const failed = flattenSuites(options.report.suites ?? []).filter((record) => record.status === "Failed");
    const candidates: Array<{ unit: TestUnit; type: string }> = [];
    for (const record of failed) {
        const unit = unitById.get(ID.exec(record.title)?.[1] ?? "");
        const stored = unit ? storedByKey.get(unit.key) : undefined;
        if (!unit || !stored || stored.writtenAt === manifest.savedAt || edited(unit.key) || stored.type === "site") continue;
        candidates.push({ unit, type: stored.type });
    }
    const recheck: SiteSuiteRecheck = { failedReused: candidates.length, unchanged: 0, regenerations: [] };
    if (candidates.length === 0) return { code: options.suiteCode, report: options.report, recheck };

    // Read the candidates' types again: every page of each, once.
    const candidateTypes = [...new Set(candidates.map((candidate) => candidate.type))];
    const typePaths = candidateTypes.flatMap((type) => manifest.types[type]?.paths ?? []);
    const fresh = normalizeContentProfile(await options.inspect(inputs.baseUrl, typePaths).catch(() => null));
    const now = fingerprintOf(fresh);
    const signatureNow = (path: string) => {
        const type = now.typeOfPath.get(path);
        return type ? now.types[type].pages[path] : undefined;
    };

    const stale = new Map<string, Array<{ path: string; before: string; after: string }>>();
    const failedOf = new Map<string, string[]>();
    for (const { unit, type } of candidates) {
        const changes = unit.paths
            .filter((path) => manifest.types[type]?.pages[path] !== undefined)
            .map((path) => ({ path, before: manifest.types[type].pages[path], after: signatureNow(path) ?? "" }))
            .filter((change) => change.after !== "" && change.after !== change.before);
        if (changes.length === 0) {
            // Unchanged (or not readable now): the failure stands.
            recheck.unchanged++;
            continue;
        }
        const known = stale.get(type) ?? [];
        for (const change of changes) if (!known.some((item) => item.path === change.path)) known.push(change);
        stale.set(type, known);
        failedOf.set(type, [...(failedOf.get(type) ?? []), fullTitle(unit)]);
    }
    if (stale.size === 0) return { code: options.suiteCode, report: options.report, recheck };

    // Write the stale types again from the fresh inspection, the rest of the page data as saved.
    const savedProfile = await loadSiteSuiteProfile(dir);
    const freshByPath = new Map((fresh?.pages ?? []).map((page) => [page.path, page]));
    const profile: ContentProfile | null = savedProfile
        ? { ...savedProfile, pages: savedProfile.pages.map((page) => freshByPath.get(page.path) ?? page) }
        : fresh;
    const applied = await applySiteSuite(templateSuite(inputs, profile), profile, manifest.origin, manifest.identity, inputs);
    const newUnits = parseTestUnits(applied.code);
    const fingerprint = fingerprintOf(profile);
    const staleTypes = new Set(stale.keys());
    // Re-run what this run ran of the stale types (a run of selected tests stays one), and their new tests.
    const ranTitles = new Set(flattenSuites(options.report.suites ?? []).map((record) => record.title));
    const ranKeys = new Set(units.filter((unit) => ranTitles.has(fullTitle(unit))).map((unit) => unit.key));
    const oldKeys = new Set(units.map((unit) => unit.key));
    const rerunUnits = newUnits.filter((unit) => staleTypes.has(typeOfUnit(unit, fingerprint)) && !edited(unit.key) && (ranKeys.has(unit.key) || !oldKeys.has(unit.key)));
    const rerunReport = rerunUnits.length > 0 ? await options.rerun(applied.code, rerunUnits.map(fullTitle)) : null;
    if (rerunUnits.length > 0 && !rerunReport) return null;

    // The run's results, less the stale types' (those were written again), renamed to the suite's new ids.
    const oldByTitle = new Map(units.map((unit) => [fullTitle(unit), unit]));
    const newIdByKey = new Map(newUnits.map((unit) => [unit.key, unit.id]));
    const replaced = new Set(units.filter((unit) => staleTypes.has(storedByKey.get(unit.key)?.type ?? "") && !edited(unit.key)).map(fullTitle));
    const kept = mapSpecs(options.report.suites ?? [], (title) => {
        if (replaced.has(title)) return null;
        const unit = oldByTitle.get(title);
        const id = unit ? newIdByKey.get(unit.key) : undefined;
        return unit && id ? `${id}: ${unit.title}` : title;
    });
    const report: JsonReport = {
        ...options.report,
        suites: [...kept, ...(rerunReport?.suites ?? [])],
        errors: [...(options.report.errors ?? []), ...(rerunReport?.errors ?? [])],
    };

    const rerunRecords = flattenSuites(rerunReport?.suites ?? []);
    for (const [type, pages] of stale) {
        const titles = new Set(rerunUnits.filter((unit) => typeOfUnit(unit, fingerprint) === type).map(fullTitle));
        const results = rerunRecords.filter((record) => titles.has(record.title));
        recheck.regenerations.push({
            type,
            pages,
            failed: failedOf.get(type) ?? [],
            rerun: results.length,
            passed: results.filter((record) => record.status === "Passed").length,
            failedAgain: results.filter((record) => record.status === "Failed").length,
        });
    }
    return { code: applied.code, report, recheck };
}
