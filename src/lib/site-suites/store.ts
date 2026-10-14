import { createHash } from "crypto";
import { mkdir, readFile, rename, rm, writeFile } from "fs/promises";
import { isAbsolute, join, relative, resolve } from "path";
import type { RunMode } from "@/lib/comprehensive/run-mode";
import type { BestPracticeArea, ContentProfile, ContentRules, TestAuditMode } from "@/lib/generate/mock/types";
import { dataDir } from "@/lib/storage/data-dir";

/**
 * Phase 42 (TFP-190, Decisions 1 and 4): where a site suite is kept - in
 * TestForge's local data folder, never in the repo - and its shape on disk.
 *
 *   <data>/site-suites/<site>/<suite>/manifest.json
 *   <data>/site-suites/<site>/<suite>/profile.json   (the page data it was written from)
 *   <data>/site-suites/<site>/<suite>/tests/<unit>.ts
 *
 * `<site>` is the origin, made safe as a folder name. `<suite>` is the suite
 * identity: the run type (Standard, or Comprehensive for one area), the
 * selected practices and the audit mode, as the sweep compares runs
 * (TFP-198), so a link-only run never retires an accessibility suite's tests.
 * Each test is its own file, written as TestForge generated it; the manifest
 * records the hash of what was written, so a file that no longer matches has
 * been edited by hand and is never replaced silently.
 */

export interface SiteSuiteIdentity {
    runType: "standard" | "comprehensive";
    /** Comprehensive's area; absent on Standard. */
    area?: string;
    practices: string[];
    auditMode: string;
}

export interface StoredType {
    /** The structural signatures of the type's pages (Phase 40), sorted; "" for a page whose outline couldn't be read. */
    signatures: string[];
    paths: string[];
    /** Each page's own signature, so a failing test's page can be read again and compared (TFP-191). */
    pages: Record<string, string>;
}

/** What the template was asked for, so a changed page type can be written again after a run (TFP-191). */
export interface SiteSuiteInputs {
    baseUrl: string;
    description: string;
    practices: BestPracticeArea[];
    contentRules: ContentRules;
    auditMode: TestAuditMode;
    runMode: RunMode;
}

export interface StoredUnit {
    unit: string;
    key: string;
    describe: string[];
    title: string;
    /** The page type it was written for (its address pattern), or "site" for a test of the whole site. */
    type: string;
    /** sha256 of the file as TestForge wrote it. */
    writtenHash: string;
    /** When TestForge wrote it: the manifest's savedAt for a test this run generated, earlier for a reused one. */
    writtenAt: string;
    /** TFP-194: who wrote it - the template (absent), or a gap writer for one uncovered element. */
    origin?: "gap-writer";
    /** TFP-194: the coverage map key of the element a gap test was written for. */
    covers?: string;
    /** TFP-194: the gap writer ("claude-code", "local-model"), or "candidate" for a pool candidate bound as the gap's test (TFP-203). */
    writer?: string;
    /** TFP-203: the pool candidate it was bound from. */
    candidate?: string;
}

/** TFP-194: a gap a writer was asked for and that didn't end in a saved test - not asked again while its page type holds. */
export interface GapAttempt {
    key: string;
    type: string;
    outcome: "breach" | "failed" | "invalid" | "error";
    at: string;
    /** TFP-203: a pool candidate that was tried for the gap on Standard and failed the gates here. */
    candidate?: string;
}

export interface SiteSuiteManifest {
    version: 1;
    origin: string;
    identity: SiteSuiteIdentity;
    savedAt: string;
    /** The site's page types (address patterns), sorted: what site-wide tests are reused against. */
    siteTypes: string[];
    types: Record<string, StoredType>;
    units: StoredUnit[];
    inputs?: SiteSuiteInputs;
    /** TFP-194: gaps already tried without a saved test. */
    gapAttempts?: GapAttempt[];
}

export function hashOf(text: string) {
    return createHash("sha256").update(text, "utf8").digest("hex");
}

export function siteFolderName(origin: string) {
    return origin.toLowerCase().replace(/^https?:\/\//, (scheme) => scheme.replace("://", "_")).replace(/[^a-z0-9.-]+/g, "_");
}

export function suiteFolderName(identity: SiteSuiteIdentity) {
    const practices = [...identity.practices].sort();
    const readable = identity.runType === "comprehensive" ? `comprehensive-${identity.area ?? "unknown"}` : `standard-${identity.auditMode}`;
    return `${readable}-${hashOf(JSON.stringify([identity.runType, identity.area ?? "", practices, identity.auditMode])).slice(0, 10)}`;
}

export function siteSuiteDir(origin: string, identity: SiteSuiteIdentity) {
    return join(dataDir(), "site-suites", siteFolderName(origin), suiteFolderName(identity));
}

export function unitFileName(key: string) {
    return `${hashOf(key).slice(0, 16)}.ts`;
}

export interface LoadedSiteSuite {
    manifest: SiteSuiteManifest;
    /** Each unit's current file text, by unit id; missing when its file is gone. */
    sources: Map<string, string>;
}

export async function loadSiteSuite(origin: string, identity: SiteSuiteIdentity): Promise<LoadedSiteSuite | null> {
    return loadSiteSuiteAt(siteSuiteDir(origin, identity));
}

/**
 * A run names its site suite by folder (the generation record's `store`).
 * The record comes from the client, so the folder must be inside the data
 * folder's site-suites; anything else is no suite.
 */
export function siteSuiteDirFromStore(store: string): string | null {
    const root = join(dataDir(), "site-suites");
    const dir = resolve(store);
    const inside = relative(root, dir);
    return inside && !inside.startsWith("..") && !isAbsolute(inside) ? dir : null;
}

export async function loadSiteSuiteAt(dir: string): Promise<LoadedSiteSuite | null> {
    const text = await readFile(join(dir, "manifest.json"), "utf8").catch(() => null);
    if (!text) return null;
    let manifest: SiteSuiteManifest;
    try {
        manifest = JSON.parse(text) as SiteSuiteManifest;
    } catch {
        return null;
    }
    if (manifest.version !== 1 || !Array.isArray(manifest.units)) return null;
    const sources = new Map<string, string>();
    for (const unit of manifest.units) {
        const source = await readFile(join(dir, "tests", unit.unit), "utf8").catch(() => null);
        if (source !== null) sources.set(unit.unit, source);
    }
    return { manifest, sources };
}

/**
 * Writes the suite whole: each unit's file, then the manifest (to a
 * temporary file and renamed, as run records are since TFP-198). Files of
 * units the new manifest no longer lists are removed. One TestForge process
 * at a time (the run-evidence-sweep backlog's Decision 3).
 */
export async function loadSiteSuiteProfile(dir: string): Promise<ContentProfile | null> {
    const text = await readFile(join(dir, "profile.json"), "utf8").catch(() => null);
    if (!text) return null;
    try {
        return JSON.parse(text) as ContentProfile;
    } catch {
        return null;
    }
}

export async function saveSiteSuite(manifest: SiteSuiteManifest, files: Map<string, string>, profile: ContentProfile | null = null) {
    const dir = siteSuiteDir(manifest.origin, manifest.identity);
    const testsDir = join(dir, "tests");
    await mkdir(testsDir, { recursive: true });
    for (const unit of manifest.units) {
        const source = files.get(unit.unit);
        if (source !== undefined) await writeFile(join(testsDir, unit.unit), source, "utf8");
    }
    const previous = await loadSiteSuite(manifest.origin, manifest.identity);
    const kept = new Set(manifest.units.map((unit) => unit.unit));
    for (const unit of previous?.manifest.units ?? []) {
        if (!kept.has(unit.unit)) await rm(join(testsDir, unit.unit), { force: true });
    }
    if (profile) {
        await writeFile(join(dir, "profile.json.tmp"), JSON.stringify(profile), "utf8");
        await rename(join(dir, "profile.json.tmp"), join(dir, "profile.json"));
    }
    const target = join(dir, "manifest.json");
    await writeFile(`${target}.tmp`, JSON.stringify(manifest, null, 2), "utf8");
    await rename(`${target}.tmp`, target);
    return dir;
}
