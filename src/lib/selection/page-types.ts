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
 *   `/category/:slug`). The parent is a real segment: top-level pages
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
            if (segment === ":id" || position === 0) return segment;
            const masked = page.segments.map((other, index) => (index === position ? "*" : other));
            return slugAt.has(`${page.prefix}|${page.segments.length}|${masked.join("/")}|${position}`) ? ":slug" : segment;
        });
        const pattern = patternOf(page.prefix, segments);
        types.set(pattern, [...(types.get(pattern) ?? []), page.name]);
    }
    return [...types].map(([pattern, pages]) => ({ pattern, pages }));
}
