import type { ContentProfile } from "@/lib/generate/mock/types";
import { signatureOf } from "@/lib/selection/page-outline";
import { groupPagesByAddress } from "@/lib/selection/page-types";
import type { SiteSuiteRecord } from "@/lib/report/types";
import { hashOf, loadSiteSuite, saveSiteSuite, unitFileName, type SiteSuiteIdentity, type SiteSuiteInputs, type SiteSuiteManifest, type StoredType, type StoredUnit } from "./store";
import { READ_ONLY_GUARD_HELPER } from "@/lib/generate/read-only-guard";
import { escapeForSingleQuotedString } from "@/lib/generate/mock/format";
import ts from "typescript";
import { parseTestUnits, withId, type TestUnit } from "./units";

/**
 * Phase 42 (TFP-190, Decision 1): a site's suite is saved with the
 * fingerprint of every page type it was written for, and reused on later
 * runs.
 *
 * - A page type is an address pattern (Phase 40, `/product/:id`); its
 *   fingerprint is the structural signature of each of its inspected pages
 *   (Phase 40's outline: landmarks, forms and their field types, cards).
 * - A test belongs to the one page type whose pages it visits, or to the
 *   whole site ("site") when it visits none, several types, or a page that
 *   wasn't inspected. Site-wide tests are reused while the site has the same
 *   set of page types (owner decision, 2026-10-13).
 * - On a run: a test of an unchanged type is reused as saved; a test of a
 *   changed type is regenerated; a test of a new type is generated; a saved
 *   test the generator no longer writes is retired - its type is gone, or
 *   what it tested is (a link taken off a page whose structure is the same).
 *   A saved test whose file no longer
 *   matches what TestForge wrote was edited by hand: it is kept as it is,
 *   never regenerated, and flagged when its page changed or is gone.
 *
 * The template generator is deterministic, so a reused test usually reads
 * the same as a regenerated one would; what reuse keeps is the saved test -
 * a hand edit, and later (TFP-194) a test written once for a gap.
 */

export interface SiteFingerprint {
    /** Each page type (address pattern) and its pages' signatures. */
    types: Record<string, StoredType>;
    /** The types, sorted. */
    siteTypes: string[];
    /** Which type each inspected path is in. */
    typeOfPath: Map<string, string>;
}

export function fingerprintOf(profile: ContentProfile | null): SiteFingerprint {
    const pages = profile?.pages ?? [];
    const types: Record<string, StoredType> = {};
    const typeOfPath = new Map<string, string>();
    for (const type of groupPagesByAddress(pages.map((page) => page.path))) {
        const bySignature: Record<string, string> = {};
        for (const path of type.pages) {
            const outline = pages.find((page) => page.path === path)?.outline;
            bySignature[path] = outline ? signatureOf(outline) : "";
        }
        types[type.pattern] = { signatures: Object.values(bySignature).sort(), paths: [...type.pages], pages: bySignature };
        for (const path of type.pages) typeOfPath.set(path, type.pattern);
    }
    return { types, siteTypes: Object.keys(types).sort(), typeOfPath };
}

/** The page type a test belongs to, or "site". */
export function typeOfUnit(unit: TestUnit, fingerprint: SiteFingerprint): string {
    const types = new Set(unit.paths.map((path) => fingerprint.typeOfPath.get(path) ?? "site"));
    return types.size === 1 ? [...types][0] : "site";
}

function sameType(before: StoredType | undefined, now: StoredType | undefined) {
    if (!before || !now) return false;
    // A page whose outline couldn't be read has no fingerprint: its tests are never taken as unchanged.
    if (before.signatures.includes("") || now.signatures.includes("")) return false;
    return JSON.stringify(before.signatures) === JSON.stringify(now.signatures);
}

export interface SiteSuiteResult {
    code: string;
    record: SiteSuiteRecord;
}

/**
 * Applies the site's saved suite to a freshly generated one and saves the
 * result. `fresh` is the suite the generator wrote for this run; the result
 * keeps its scaffolding (imports, helpers, describes) and replaces, keeps or
 * drops its tests as Decision 1 says. `inputs` and the page data are saved
 * with it, so a page type can be written again after a run (TFP-191).
 */
export async function applySiteSuite(fresh: string, profile: ContentProfile | null, origin: string, identity: SiteSuiteIdentity, inputs?: SiteSuiteInputs): Promise<SiteSuiteResult> {
    const savedAt = new Date().toISOString();
    const fingerprint = fingerprintOf(profile);
    const units = parseTestUnits(fresh);
    const saved = await loadSiteSuite(origin, identity);
    const savedByKey = new Map((saved?.manifest.units ?? []).map((unit) => [unit.key, unit]));
    const sameSite = saved ? JSON.stringify(saved.manifest.siteTypes) === JSON.stringify(fingerprint.siteTypes) : false;
    const unchanged = (type: string) => (type === "site" ? sameSite : sameType(saved?.manifest.types[type], fingerprint.types[type]));
    const edited = (unit: StoredUnit) => {
        const source = saved?.sources.get(unit.unit);
        return source !== undefined && hashOf(source) !== unit.writtenHash;
    };

    const counts = { reused: 0, generated: 0, regenerated: 0, retired: 0, edited: 0 };
    const editedOnChangedPages: string[] = [];
    const replacements: Array<{ start: number; end: number; text: string }> = [];
    const kept: StoredUnit[] = [];
    const files = new Map<string, string>();
    const matched = new Set<string>();

    for (const unit of units) {
        const type = typeOfUnit(unit, fingerprint);
        const stored = savedByKey.get(unit.key);
        if (stored) matched.add(stored.key);
        if (stored && edited(stored)) {
            // Kept as the person left it, whatever the page did.
            const source = saved!.sources.get(stored.unit)!;
            replacements.push({ start: unit.start, end: unit.end, text: withId(source, unit.id) });
            kept.push(stored);
            counts.edited++;
            if (!unchanged(stored.type)) editedOnChangedPages.push(`${stored.title} (${stored.type === "site" ? "the site's page types changed" : `${stored.type} changed`})`);
            continue;
        }
        const written = withId(unit.source, unit.id);
        if (stored && stored.type === type && unchanged(type) && saved!.sources.has(stored.unit)) {
            replacements.push({ start: unit.start, end: unit.end, text: withId(saved!.sources.get(stored.unit)!, unit.id) });
            kept.push(stored);
            counts.reused++;
            continue;
        }
        // Regenerated: its type was saved before and has changed. Generated: a new type, or a new test on an unchanged one.
        const existedBefore = type === "site" ? Boolean(saved?.manifest.units.some((u) => u.type === "site")) : Boolean(saved?.manifest.types[type]);
        if (existedBefore && !unchanged(type)) counts.regenerated++;
        else counts.generated++;
        const file = unitFileName(unit.key);
        files.set(file, written);
        kept.push({ unit: file, key: unit.key, describe: unit.describe, title: unit.title, type, writtenHash: hashOf(written), writtenAt: savedAt });
    }

    // Saved tests the generator didn't write this time: hand-edited ones stay (appended to their
    // describe); the rest are retired. Not kept for an unchanged type: the signature is coarse, and
    // a test the generator stopped writing tests something that is gone (a link taken off a page).
    // TFP-194: a gap test was never the generator's: it stays while its page type is unchanged.
    const appended = new Map<string, string[]>();
    for (const stored of saved?.manifest.units ?? []) {
        if (matched.has(stored.key)) continue;
        const source = saved!.sources.get(stored.unit);
        const isEdited = edited(stored);
        const gapTest = stored.origin === "gap-writer" && unchanged(stored.type);
        if (source === undefined || (!isEdited && !gapTest)) {
            counts.retired++;
            continue;
        }
        const describe = JSON.stringify(stored.describe);
        appended.set(describe, [...(appended.get(describe) ?? []), source]);
        kept.push(stored);
        if (!isEdited) {
            counts.reused++;
            continue;
        }
        counts.edited++;
        if (!unchanged(stored.type)) editedOnChangedPages.push(`${stored.title} (${fingerprint.types[stored.type] || stored.type === "site" ? `${stored.type === "site" ? "the site's page types" : stored.type} changed` : `${stored.type} is gone`})`);
    }

    let code = fresh;
    for (const { start, end, text } of [...replacements].sort((a, b) => b.start - a.start)) {
        code = code.slice(0, start) + text + code.slice(end);
    }
    code = appendToDescribes(code, appended);

    const manifest: SiteSuiteManifest = {
        version: 1,
        origin,
        identity: { ...identity, practices: [...identity.practices].sort() },
        savedAt,
        siteTypes: fingerprint.siteTypes,
        types: fingerprint.types,
        units: kept,
        ...(inputs ? { inputs } : {}),
        // TFP-194: a gap tried without a saved test isn't asked for again while its page type holds.
        ...(saved?.manifest.gapAttempts?.length ? { gapAttempts: saved.manifest.gapAttempts.filter((attempt) => unchanged(attempt.type)) } : {}),
    };
    const store = await saveSiteSuite(manifest, files, profile);
    const changedTypes = fingerprint.siteTypes.filter((type) => saved?.manifest.types[type] && !sameType(saved.manifest.types[type], fingerprint.types[type]));
    const newTypes = saved ? fingerprint.siteTypes.filter((type) => !saved.manifest.types[type]) : [];
    const goneTypes = saved ? Object.keys(saved.manifest.types).filter((type) => !fingerprint.types[type]) : [];
    return {
        code,
        record: { store, firstRun: !saved, ...counts, changedTypes, newTypes, goneTypes, editedOnChangedPages },
    };
}

/**
 * Adds saved tests to the end of the describe with their chain. A chain the suite no longer has is
 * written again around them, so their keys stay the same on the next run (TFP-194: the gap tests'
 * own describe). Tests that use the request guard get its helper when the suite has none.
 */
export function appendToDescribes(code: string, appended: Map<string, string[]>): string {
    if (appended.size === 0) return code;
    let result = code;
    for (const [describe, sources] of appended) {
        const chain = JSON.parse(describe) as string[];
        const last = parseTestUnits(result).filter((unit) => JSON.stringify(unit.describe) === describe).pop();
        const block = sources.join("\n\n");
        if (last) {
            result = `${result.slice(0, last.end)}\n\n${block}${result.slice(last.end)}`;
            continue;
        }
        const opened = chain.map((title) => `test.describe('${escapeForSingleQuotedString(title)}', () => {`).join("\n");
        const closed = chain.map(() => "});").join("\n");
        result = `${result.trimEnd()}\n\n// Kept from the site suite (${chain.join(" > ") || "top level"}):\n${opened ? `${opened}\n` : ""}${block}${closed ? `\n${closed}` : ""}\n`;
    }
    return withGuardHelper(result);
}

/**
 * Whether some call to the guard can't reach a declaration of it. The template writes each suite's helpers inside
 * that suite's describe (mock/index.ts), so the functional suite's copy (the control checks') can't be reached from
 * another describe: a gap test or bound candidate in "Gap tests" failed with "tfReadOnlyGuarded is not defined" on
 * a Standard run (found by TFP-203's evidence test). So: a top-level declaration covers every call; otherwise each
 * top-level statement (a describe, a test) that calls it must declare its own.
 */
function guardOutOfReach(code: string): boolean {
    const source = ts.createSourceFile("suite.spec.ts", code, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
    const declares = (node: ts.Node) => ts.isFunctionDeclaration(node) && node.name?.text === "tfReadOnlyGuarded";
    if (source.statements.some(declares)) return false;
    const has = (node: ts.Node, found: (inner: ts.Node) => boolean): boolean => found(node) || (ts.forEachChild(node, (child) => has(child, found) || undefined) ?? false);
    const calls = (node: ts.Node) => ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "tfReadOnlyGuarded";
    return source.statements.some((statement) => has(statement, calls) && !has(statement, declares));
}

/** The request guard's helper, before the first test, when a test calls it out of reach of any copy (shared with TFP-204). */
export function withGuardHelper(code: string): string {
    if (!code.includes("tfReadOnlyGuarded(") || !guardOutOfReach(code)) return code;
    const firstTest = code.search(/^(test\.describe\(|test\(|\/\/ Kept from the site suite|\/\/ Phase 42 \(TFP-204\))/m);
    return firstTest > 0 ? `${code.slice(0, firstTest)}${READ_ONLY_GUARD_HELPER}\n\n${code.slice(firstTest)}` : `${code}\n${READ_ONLY_GUARD_HELPER}\n`;
}
