import { escapeForSingleQuotedString } from "@/lib/generate/mock/format";
import { buildLinkLocatorExpression, buildLocatorExpression, getActionableElementDisplayName } from "@/lib/generate/mock/locators";
import { SUITE_TITLES } from "@/lib/generate/mock/suite";
import type { ContentProfile } from "@/lib/generate/mock/types";
import { forbiddenConstruct } from "@/lib/gap-writer/code-check";
import { distinctLabel } from "@/lib/gap-writer/write";
import { bindCandidate, candidateId, patternOf } from "@/lib/candidates/pool";
import type { PromotedEntry } from "@/lib/candidates/promotion";
import { appendToDescribes, withGuardHelper } from "@/lib/site-suites/reuse";
import { parseTestUnits } from "@/lib/site-suites/units";

/**
 * Phase 42 (TFP-204, batch 2 ruling 3; owner decision, 2026-10-14): generation applies
 * the library's promoted entries (src/lib/library/promoted/, written by
 * `npm run library:promote` and committed after review). Without this,
 * promotion changed nothing: an entry was recorded and never run.
 *
 * A promoted entry is applied like any library entry (entries.ts): matched
 * against what inspection found, bound to each place its pattern is, and run
 * inside the verdict in the area the library's control checks run in -
 * Standard, functional. Its pattern is the element's kind, type and name
 * (TFP-195's, read the way the coverage map names an element):
 * - an element on a page: a test on each page it is on;
 * - a link: one test, on the first page it is on (a repeated link is one
 *   item, as the coverage map counts it).
 * The body's blanks take the page's path and the element's locator, the
 * generator's own expression, so the coverage map counts the element
 * covered. Each test sits in the functional describe at the read-only gate,
 * inside the request guard, titled `library promoted.<id>: ...`.
 *
 * An entry the code check (TFP-202) refuses is not applied: reviewed or not,
 * it is model-written code. With nothing promoted, the code is returned as
 * it came, byte for byte.
 */

export function bindPromotedEntries(code: string, profile: ContentProfile | null, entries: PromotedEntry[]): { code: string; bound: Array<{ id: string; page: string; name: string }> } {
    const usable = new Map(entries.filter((entry) => entry.gate === "read-only" && !forbiddenConstruct(entry.body)).map((entry) => [candidateId(entry.pattern), entry]));
    if (usable.size === 0 || !profile) return { code, bound: [] };
    const bound: Array<{ id: string; page: string; name: string }> = [];
    const sources: string[] = [];
    const linksSeen = new Set<string>();
    // TFP-197: names the page repeats get a short suffix, so no two tests share a title (gap-writer/write.ts).
    let namesOnPage: string[] = [];
    const bind = (entry: PromotedEntry, page: string, name: string, locator: string) => {
        const label = distinctLabel(name, page, locator, namesOnPage);
        const body = bindCandidate(entry, page, locator).split("\n").map((line) => (line.trim() ? `      ${line}` : "")).join("\n");
        sources.push(`  test('${escapeForSingleQuotedString(`library promoted.${entry.id}: ${label} on ${page}`)}', { annotation: [{ type: 'gate', description: 'read-only' }, { type: 'page', description: '${escapeForSingleQuotedString(page)}' }, { type: 'library', description: 'promoted.${entry.id}' }] }, async ({ page }) => {
    await tfReadOnlyGuarded(page, async () => {
${body}
    });
  });`);
        bound.push({ id: entry.id, page, name });
    };
    for (const page of profile.pages) {
        namesOnPage = [
            ...(page.actionableElements ?? []).filter((element) => !(element.elementType === "link" && (page.linkDetails?.length ?? 0) > 0)).map((element) => `${getActionableElementDisplayName(element)} [${element.elementType}]`),
            ...(page.linkDetails ?? []).map((link) => `${link.text || link.url} [link]`),
        ];
        for (const element of page.actionableElements ?? []) {
            // Links are matched from the page's link list, where it has one, as the coverage map maps them.
            if (element.elementType === "link" && (page.linkDetails?.length ?? 0) > 0) continue;
            const name = `${getActionableElementDisplayName(element)} [${element.elementType}]`;
            const entry = usable.get(candidateId(patternOf("element", name)));
            if (entry) bind(entry, page.path, name, buildLocatorExpression(element));
        }
        for (const link of page.linkDetails ?? []) {
            const key = JSON.stringify([link.text, link.url]);
            const name = `${link.text || link.url} [link]`;
            const entry = usable.get(candidateId(patternOf("link", name)));
            if (!entry || !link.text || linksSeen.has(key)) continue;
            linksSeen.add(key);
            bind(entry, page.path, name, buildLinkLocatorExpression(link));
        }
    }
    if (sources.length === 0) return { code, bound };
    // In the functional describe when the suite has one; otherwise in one of their own, with that name.
    const chain = JSON.stringify([SUITE_TITLES.functional]);
    if (parseTestUnits(code).some((unit) => JSON.stringify(unit.describe) === chain)) return { code: appendToDescribes(code, new Map([[chain, sources]])), bound };
    const block = `// Phase 42 (TFP-204): the library's promoted entries.\ntest.describe('${escapeForSingleQuotedString(SUITE_TITLES.functional)}', () => {\n${sources.join("\n\n")}\n});\n`;
    return { code: withGuardHelper(`${code.trimEnd()}\n\n${block}`), bound };
}
