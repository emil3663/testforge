/**
 * Phase 40 Decision 1 (TFP-170): a site's crawled pages, grouped into types
 * by their address pattern. Testing one page of each type is ISTQB
 * equivalence partitioning applied to pages.
 *
 * - A segment that is an identifier becomes `:id`: digits, a UUID, a ULID or
 *   other long letter-and-digit token, or a long hex string
 *   (`/product/01M48AGCWN26TFYQ1FQ6S7FNJF` -> `/product/:id`).
 * - Segments that vary between otherwise identical addresses under a shared
 *   parent become `:slug` (`/category/hand-tools`, `/category/power-tools` ->
 *   `/category/:slug`). A segment directly before an `:id` names a
 *   collection and is never a slug (Gate A, 2026-10-07): `/en/product/1` and
 *   `/en/category/2` stay `/en/product/:id` and `/en/category/:id`. The parent is a real segment: top-level pages
 *   (`/contact`, `/privacy`) stay literal, since Decision 2 merges those by
 *   their outline, not their address. A segment with no sibling that varies
 *   stays literal.
 * - Hash-routed pages are grouped by TFP-165's page names, the route's
 *   segments after `#/` (or `#!/`) treated as path segments:
 *   `/#/product/1` -> `/#/product/:id`.
 * - Query strings don't create types.
 *
 * Decision 2's outline (TFP-171) refines these types; this is the address
 * half only.
 */

import { formSignatureOf, signatureOf, type PageOutline } from "./page-outline";

export interface PageType {
    /** The address pattern: `/product/:id`, `/#/category/:slug`, `/contact`. */
    pattern: string;
    /** The type's pages, as the crawl names them, in crawl order. */
    pages: string[];
}

interface ParsedName {
    name: string;
    /** What comes before the route's segments: "" for a path, "/#" or "/app#!" for a hash route. */
    prefix: string;
    segments: string[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** An identifier rather than a word: digits, a UUID, a long letter-and-digit token (ULIDs, hashes), or long hex. */
export function isIdSegment(segment: string) {
    if (/^\d+$/.test(segment) || UUID.test(segment)) return true;
    if (/^[0-9a-z]{16,}$/i.test(segment) && /\d/.test(segment) && /[a-z]/i.test(segment)) return true;
    return /^[0-9a-f]{8,}$/i.test(segment) && /\d/.test(segment);
}

function parse(name: string): ParsedName {
    const hashAt = name.search(/#!?\//);
    const [base, route] = hashAt >= 0 ? [name.slice(0, hashAt), name.slice(hashAt)] : [name, ""];
    const stripQuery = (value: string) => value.replace(/\?.*$/, "");
    if (route) {
        const marker = route.startsWith("#!") ? "#!" : "#";
        const basePath = stripQuery(base).replace(/\/$/, "");
        return { name, prefix: `${basePath === "" ? "/" : basePath}${marker}`, segments: stripQuery(route.slice(marker.length)).split("/").filter(Boolean) };
    }
    return { name, prefix: "", segments: stripQuery(base).split("/").filter(Boolean) };
}

function patternOf(prefix: string, segments: string[]) {
    if (prefix) {
        // "/#" + "/product/:id", with the start route "/#/" for no segments.
        return `${prefix}/${segments.join("/")}`;
    }
    return `/${segments.join("/")}`;
}

/** Decision 1: the crawl's page names, grouped by address pattern, in crawl order of first appearance. */
export function groupPagesByAddress(pageNames: string[]): PageType[] {
    const parsed = [...new Set(pageNames)].map(parse);
    const withIds = parsed.map((page) => ({ ...page, segments: page.segments.map((segment) => (isIdSegment(segment) ? ":id" : segment)) }));

    // A position is a slug when pages that agree everywhere else (same prefix, same depth)
    // differ there, and it has a parent segment.
    const slugAt = new Set<string>();
    const maxDepth = Math.max(0, ...withIds.map((page) => page.segments.length));
    for (let position = 1; position < maxDepth; position += 1) {
        const values = new Map<string, Set<string>>();
        for (const page of withIds) {
            if (page.segments.length <= position) continue;
            // Gate A revision (Emil, 2026-10-07): a segment directly before an :id names a collection, not a slug.
            if (page.segments[position + 1] === ":id") continue;
            const masked = page.segments.map((segment, index) => (index === position ? "*" : segment));
            const key = `${page.prefix}|${page.segments.length}|${masked.join("/")}`;
            const seen = values.get(key) ?? new Set<string>();
            seen.add(page.segments[position]);
            values.set(key, seen);
        }
        for (const [key, seen] of values) {
            if (seen.size > 1) slugAt.add(`${key}|${position}`);
        }
    }

    const types = new Map<string, string[]>();
    for (const page of withIds) {
        const segments = page.segments.map((segment, position) => {
            if (segment === ":id" || position === 0 || page.segments[position + 1] === ":id") return segment;
            const masked = page.segments.map((other, index) => (index === position ? "*" : other));
            return slugAt.has(`${page.prefix}|${page.segments.length}|${masked.join("/")}|${position}`) ? ":slug" : segment;
        });
        const pattern = patternOf(page.prefix, segments);
        types.set(pattern, [...(types.get(pattern) ?? []), page.name]);
    }
    return [...types].map(([pattern, pages]) => ({ pattern, pages }));
}

/**
 * Phase 40 Decision 2, as revised at Gate A (Emil, 2026-10-07; TFP-176):
 * the address type comes first, and the outline refines it in two narrow
 * ways. The first measurement (TFP-171) merged any types with equal
 * signatures, which put 90 of the-internet's 100 pages into one type with
 * home, and split on cards, which follows data (products with and without
 * related items), not templates.
 * - Split an address type only when its pages' form signatures differ (the
 *   Toolshop's /auth/:slug into login, register and forgot-password).
 *   Landmarks and cards don't split.
 * - Merge address types only when they are siblings in one section - the
 *   same prefix, the same first segment and the same depth, at least 2
 *   (`/p/:id` and `/p/:slug`; `/shop/men/shirts` and `/shop/women/shoes`) -
 *   and every page of both has one equal full signature.
 * - Never merge top-level pages (depth 1, home included).
 * A page with no outline has an unknown form signature: it stays apart
 * within its address type and never merges. Types keep crawl order.
 */
export interface OutlinedPageType {
    /** The type's address patterns, joined with " + " when a merge brought several together. */
    pattern: string;
    patterns: string[];
    pages: string[];
    /** The pages' shared full signature; "" when they differ or are unknown (the type never merges then). */
    signature: string;
    /** The pages' shared form signature; "" when unknown. */
    formSignature: string;
}

/** A pattern's section, for merging: its prefix and first segment at its depth; null for a top-level page. */
function sectionOf(pattern: string) {
    const hashAt = pattern.search(/#!?\//);
    const prefix = hashAt >= 0 ? pattern.slice(0, hashAt + (pattern[hashAt + 1] === "!" ? 2 : 1)) : "";
    const segments = (hashAt >= 0 ? pattern.slice(prefix.length) : pattern).split("/").filter(Boolean);
    return segments.length < 2 ? null : `${prefix}|${segments[0]}|${segments.length}`;
}

export function groupPagesIntoTypes(pages: Array<{ path: string; outline?: PageOutline }>): OutlinedPageType[] {
    const outlineOf = new Map(pages.map((page) => [page.path, page.outline]));
    const buckets: OutlinedPageType[] = [];
    for (const addressType of groupPagesByAddress(pages.map((page) => page.path))) {
        const byForms = new Map<string, string[]>();
        for (const name of addressType.pages) {
            const outline = outlineOf.get(name);
            const key = outline ? formSignatureOf(outline) : "";
            byForms.set(key, [...(byForms.get(key) ?? []), name]);
        }
        for (const [formSignature, names] of byForms) {
            const signatures = new Set(names.map((name) => {
                const outline = outlineOf.get(name);
                return outline ? signatureOf(outline) : "";
            }));
            const signature = signatures.size === 1 && !signatures.has("") ? [...signatures][0] : "";
            buckets.push({ pattern: addressType.pattern, patterns: [addressType.pattern], pages: names, signature, formSignature });
        }
    }

    const merged: OutlinedPageType[] = [];
    for (const bucket of buckets) {
        const section = sectionOf(bucket.pattern);
        const same = section && bucket.signature
            ? merged.find((type) => type.signature === bucket.signature && type.patterns.every((pattern) => sectionOf(pattern) === section && pattern !== bucket.pattern))
            : undefined;
        if (!same) {
            merged.push({ ...bucket, patterns: [...bucket.patterns], pages: [...bucket.pages] });
            continue;
        }
        same.patterns.push(bucket.pattern);
        same.pages.push(...bucket.pages);
        same.pattern = same.patterns.join(" + ");
    }
    return merged;
}

export type PageTypeLabel = "home" | "sign-in" | "form" | "search" | "detail" | "listing" | "content" | "other";

/**
 * Phase 40 Decision 3: a label for each type, for the report only. It is
 * worked out after grouping and never changes a type's pages; the ranking
 * (TFP-172) decides coverage. From the outline of the type's first page:
 * home (it holds the start page), sign-in (a password field), detail (an
 * `:id` pattern, even with an add-to-cart form), listing (repeated cards, even
 * with a sort form), form (a form other than a search form), search (only
 * `type="search"` fields), content (no forms, no cards), other.
 */
export function labelPageType(type: OutlinedPageType, outline: PageOutline | undefined, startPath: string): PageTypeLabel {
    if (type.pages.includes(startPath)) return "home";
    if (!outline) return "other";
    // A search form declares itself: only type="search" fields. A lone text box can't be told from one.
    const searchOnly = (fields: string[]) => fields.length > 0 && fields.every((field) => field === "search");
    if (outline.forms.some((fields) => fields.includes("password"))) return "sign-in";
    // A single item addressed by id, even with an add-to-cart form.
    if (type.patterns.some((pattern) => pattern.includes(":id"))) return "detail";
    // Repeated cards make a listing, even with a sort or filter form beside them.
    if (outline.cards) return "listing";
    if (outline.forms.some((fields) => fields.length > 0 && !searchOnly(fields))) return "form";
    if (outline.forms.some(searchOnly)) return "search";
    if (outline.forms.length === 0) return "content";
    return "other";
}
