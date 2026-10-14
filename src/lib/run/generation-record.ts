import type { GenerationGateVerdict, GenerationRecord, PageInspectionRecord, PageTypeCoverageEntry, PageTypeCoverageRecord, GapWritingRecord, SiteSuiteRecheck, SiteSuiteRecord } from "@/lib/report/types";
import { MAX_PAGE_CAP } from "@/lib/comprehensive/run-mode";

// Phase 34 (TFP-119): /api/run accepts the generation record the client got
// from /api/generate and persists it with the run. It comes from the request
// body, so it is untrusted: only the known shape is kept, and every string and
// list is capped so a run record can't be bloated through it.

const MAX_TEXT = 200;
const MAX_EVIDENCE_LINE = 400;
const MAX_EVIDENCE_LINES = 6;
const MAX_GATES = 10;
const MAX_AREAS = 12;

function text(value: unknown, max = MAX_TEXT): string | undefined {
    return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined;
}

function gate(value: unknown): GenerationGateVerdict | null {
    if (!value || typeof value !== "object") return null;
    const v = value as Record<string, unknown>;
    const name = text(v.gate);
    const bar = text(v.bar);
    const measured = text(v.measured);
    if (!name || !bar || !measured || (v.verdict !== "kept" && v.verdict !== "rejected")) return null;
    const evidence = Array.isArray(v.evidence)
        ? v.evidence.map((line) => text(line, MAX_EVIDENCE_LINE)).filter((line): line is string => Boolean(line)).slice(0, MAX_EVIDENCE_LINES)
        : [];
    return { gate: name, bar, measured, verdict: v.verdict, evidence };
}

/**
 * `baseUrl` is the run's site: the page-type record's URLs must be on its
 * origin (TFP-174). Without one, the record is dropped.
 */
export function normalizeGenerationRecord(input: unknown, baseUrl?: string): GenerationRecord | null {
    if (!input || typeof input !== "object") return null;
    const v = input as Record<string, unknown>;
    const generatedBy = text(v.generatedBy);
    if (!generatedBy) return null;
    const record: GenerationRecord = {
        generatedBy,
        gates: Array.isArray(v.gates) ? v.gates.map(gate).filter((g): g is GenerationGateVerdict => g !== null).slice(0, MAX_GATES) : [],
    };
    const model = text(v.model);
    if (model) record.model = model;
    const fallbackReason = text(v.fallbackReason);
    if (fallbackReason) record.fallbackReason = fallbackReason;
    if (v.gapFill && typeof v.gapFill === "object") {
        const g = v.gapFill as Record<string, unknown>;
        const outcome = text(g.outcome);
        if (outcome) {
            record.gapFill = {
                gapAreas: Array.isArray(g.gapAreas) ? g.gapAreas.map((a) => text(a)).filter((a): a is string => Boolean(a)).slice(0, MAX_AREAS) : [],
                outcome,
            };
        }
    }
    const pageInspection = normalizePageInspection(v.pageInspection);
    if (pageInspection) record.pageInspection = pageInspection;
    const pageTypes = normalizePageTypes(v.pageTypes, baseUrl);
    if (pageTypes) record.pageTypes = pageTypes;
    const siteSuite = normalizeSiteSuite(v.siteSuite);
    if (siteSuite) record.siteSuite = siteSuite;
    return record;
}

/** Phase 42 (TFP-190): the site-suite counts /api/generate reported, kept only in their known shape. */
function normalizeSiteSuite(value: unknown): SiteSuiteRecord | null {
    if (!value || typeof value !== "object") return null;
    const v = value as Record<string, unknown>;
    const store = text(v.store, 400);
    const count = (key: string) => (typeof v[key] === "number" && Number.isInteger(v[key]) && (v[key] as number) >= 0 ? Math.min(v[key] as number, 100000) : 0);
    const list = (key: string) => (Array.isArray(v[key]) ? (v[key] as unknown[]).map((item) => text(item)).filter((item): item is string => Boolean(item)).slice(0, 50) : []);
    if (!store) return null;
    return {
        store,
        firstRun: v.firstRun === true,
        reused: count("reused"),
        generated: count("generated"),
        regenerated: count("regenerated"),
        retired: count("retired"),
        edited: count("edited"),
        changedTypes: list("changedTypes"),
        newTypes: list("newTypes"),
        goneTypes: list("goneTypes"),
        editedOnChangedPages: list("editedOnChangedPages"),
        ...(normalizeRecheck(v.recheck) ? { recheck: normalizeRecheck(v.recheck)! } : {}),
        ...(normalizeGapWriting(v.gapTests) ? { gapTests: normalizeGapWriting(v.gapTests)! } : {}),
    };
}

function normalizeGapWriting(value: unknown): GapWritingRecord | null {
    if (!value || typeof value !== "object") return null;
    const v = value as Record<string, unknown>;
    const writer = text(v.writer, 40);
    if (!writer) return null;
    const count = (from: Record<string, unknown>, key: string) => (typeof from[key] === "number" && Number.isInteger(from[key]) && (from[key] as number) >= 0 ? Math.min(from[key] as number, 100000) : 0);
    const money = (from: Record<string, unknown>) => (typeof from.costUsd === "number" && Number.isFinite(from.costUsd) && from.costUsd >= 0 ? Math.min(from.costUsd, 100000) : 0);
    const tests = (Array.isArray(v.tests) ? v.tests : []).slice(0, 50).flatMap((item: unknown) => {
        if (!item || typeof item !== "object") return [];
        const t = item as Record<string, unknown>;
        const title = text(t.title);
        return title ? [{ title, covers: text(t.covers, 400) ?? "", attempts: count(t, "attempts"), costUsd: money(t), outcome: text(t.outcome, 400) ?? "" }] : [];
    });
    const note = text(v.note, 400);
    return { writer, gaps: count(v, "gaps"), asked: count(v, "asked"), saved: count(v, "saved"), rejected: count(v, "rejected"), failed: count(v, "failed"), costUsd: money(v), tests, ...(note ? { note } : {}) };
}

function normalizeRecheck(value: unknown): SiteSuiteRecheck | null {
    if (!value || typeof value !== "object") return null;
    const v = value as Record<string, unknown>;
    const count = (from: Record<string, unknown>, key: string) => (typeof from[key] === "number" && Number.isInteger(from[key]) && (from[key] as number) >= 0 ? Math.min(from[key] as number, 100000) : 0);
    const regenerations = (Array.isArray(v.regenerations) ? v.regenerations : []).slice(0, 50).flatMap((item: unknown) => {
        if (!item || typeof item !== "object") return [];
        const r = item as Record<string, unknown>;
        const type = text(r.type);
        if (!type) return [];
        const pages = (Array.isArray(r.pages) ? r.pages : []).slice(0, 50).flatMap((page: unknown) => {
            const p = (page && typeof page === "object" ? page : {}) as Record<string, unknown>;
            const path = text(p.path);
            return path ? [{ path, before: text(p.before, 400) ?? "", after: text(p.after, 400) ?? "" }] : [];
        });
        const failed = (Array.isArray(r.failed) ? r.failed : []).map((title: unknown) => text(title)).filter((title): title is string => Boolean(title)).slice(0, 50);
        return [{ type, pages, failed, rerun: count(r, "rerun"), passed: count(r, "passed"), failedAgain: count(r, "failedAgain") }];
    });
    return { failedReused: count(v, "failedReused"), unchanged: count(v, "unchanged"), regenerations };
}

// Phase 40 (TFP-172): a run inspects its selected pages, up to MAX_PAGE_CAP; it was the first 5.
const MAX_PATHS = MAX_PAGE_CAP;
const MAX_WARNINGS = 5;

/** TFP-122: whether generation gathered page data itself, and why not if it failed. */
function normalizePageInspection(value: unknown): PageInspectionRecord | null {
    if (!value || typeof value !== "object") return null;
    const v = value as Record<string, unknown>;
    if (v.status !== "inspected" && v.status !== "failed") return null;
    const list = (items: unknown, max: number, length = MAX_TEXT) =>
        Array.isArray(items) ? items.map((item) => text(item, length)).filter((item): item is string => Boolean(item)).slice(0, max) : [];
    const record: PageInspectionRecord = {
        status: v.status,
        paths: list(v.paths, MAX_PATHS),
        pages: typeof v.pages === "number" && Number.isInteger(v.pages) && v.pages >= 0 ? Math.min(v.pages, 1000) : 0,
        warnings: list(v.warnings, MAX_WARNINGS, MAX_EVIDENCE_LINE),
    };
    const reason = text(v.reason, MAX_EVIDENCE_LINE);
    if (reason) record.reason = reason;
    return record;
}

// Phase 40 (TFP-173): a crawl of up to 100 pages gives at most 100 types; a
// URL is kept whole up to a browser's practical length.
const MAX_TYPES = 100;
const MAX_URL = 2000;

/**
 * TFP-173's review: the export puts these URLs in links and the re-run list,
 * so only http(s) URLs on the run's origin are kept - never `javascript:`
 * or another site's page.
 */
function siteUrl(value: unknown, origin: string): string | undefined {
    const candidate = text(value, MAX_URL);
    if (!candidate) return undefined;
    try {
        const url = new URL(candidate);
        return (url.protocol === "http:" || url.protocol === "https:") && url.origin === origin ? candidate : undefined;
    } catch {
        return undefined;
    }
}

function siteUrls(items: unknown, origin: string): string[] {
    return Array.isArray(items) ? items.map((item) => siteUrl(item, origin)).filter((item): item is string => Boolean(item)).slice(0, MAX_PAGE_CAP) : [];
}

function pageTypeEntry(value: unknown, skipped: boolean, origin: string): PageTypeCoverageEntry | null {
    if (!value || typeof value !== "object") return null;
    const v = value as Record<string, unknown>;
    const pattern = text(v.pattern, MAX_EVIDENCE_LINE);
    const label = text(v.label);
    const url = siteUrl(v.url, origin);
    if (!pattern || !label || !url || typeof v.pages !== "number" || !Number.isInteger(v.pages) || v.pages < 1) return null;
    const covered = siteUrls(v.covered, origin);
    if (!skipped && covered.length === 0) return null;
    const entry: PageTypeCoverageEntry = { pattern, label, pages: Math.min(v.pages, 1000), url, covered: skipped ? [] : covered };
    const reason = text(v.reason, MAX_EVIDENCE_LINE);
    if (reason) entry.reason = reason;
    return entry;
}

/** TFP-173: page types found, covered and skipped, and whether the user chose the pages by hand or listed them (TFP-174). */
function normalizePageTypes(value: unknown, baseUrl: string | undefined): PageTypeCoverageRecord | null {
    if (!value || typeof value !== "object" || !baseUrl) return null;
    let origin: string;
    try {
        origin = new URL(baseUrl).origin;
    } catch {
        return null;
    }
    const v = value as Record<string, unknown>;
    if (v.selectedBy !== "type" && v.selectedBy !== "user" && v.selectedBy !== "list") return null;
    if (v.runType !== "standard" && v.runType !== "comprehensive") return null;
    const whole = (n: unknown, max: number) => (typeof n === "number" && Number.isInteger(n) && n >= 0 ? Math.min(n, max) : 0);
    const entries = (items: unknown, skipped: boolean) =>
        Array.isArray(items) ? items.map((item) => pageTypeEntry(item, skipped, origin)).filter((item): item is PageTypeCoverageEntry => item !== null).slice(0, MAX_TYPES) : [];
    const urls = (items: unknown) => siteUrls(items, origin);
    const record: PageTypeCoverageRecord = {
        selectedBy: v.selectedBy,
        runType: v.runType,
        cap: whole(v.cap, MAX_PAGE_CAP),
        found: whole(v.found, MAX_TYPES),
        covered: entries(v.covered, false),
        skipped: entries(v.skipped, true),
    };
    if (v.selectedBy === "user" && v.override && typeof v.override === "object") {
        const o = v.override as Record<string, unknown>;
        record.override = { added: urls(o.added), removed: urls(o.removed) };
    }
    return record;
}
