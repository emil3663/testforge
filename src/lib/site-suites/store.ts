import { createHash } from "crypto";
import { mkdir, readFile, rename, rm, writeFile } from "fs/promises";
import { join } from "path";
import { dataDir } from "@/lib/storage/data-dir";

/**
 * Phase 42 (TFP-190, Decisions 1 and 4): where a site suite is kept - in
 * TestForge's local data folder, never in the repo - and its shape on disk.
 *
 *   <data>/site-suites/<site>/<suite>/manifest.json
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
    const dir = siteSuiteDir(origin, identity);
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
export async function saveSiteSuite(manifest: SiteSuiteManifest, files: Map<string, string>) {
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
    const target = join(dir, "manifest.json");
    await writeFile(`${target}.tmp`, JSON.stringify(manifest, null, 2), "utf8");
    await rename(`${target}.tmp`, target);
    return dir;
}
