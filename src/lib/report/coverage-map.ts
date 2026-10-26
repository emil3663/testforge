import { buildJourneyTitle } from "@/lib/generate/mock/journey-tests";
import { buildLinkLocatorExpression, buildLocatorExpression, getActionableElementDisplayName } from "@/lib/generate/mock/locators";
import { escapeForSingleQuotedString } from "@/lib/generate/mock/format";
import { cardGroupLocator, cardGroups, linkKey } from "@/lib/generate/mock/link-audits/inventory-tests";
import { buildHiddenLinkLocatorExpression } from "@/lib/generate/mock/link-audits/reveal";
import type { ActionableElementDetail, ContentProfile } from "@/lib/generate/mock/types";
import { groupPagesByAddress } from "@/lib/selection/page-types";
import { parseTestUnits, type TestUnit } from "@/lib/site-suites/units";
import { stripTestIdPrefix } from "./discovered-coverage";
import type { CoverageMap, CoverageMapEntry, CoverageMapType } from "./types";

/**
 * Phase 42 (TFP-192, Decision 3): the coverage map. For every run, each
 * element and flow the inspection found, and the tests that touch it; what
 * no test touches is the gap list. Indexed both ways, so it answers "which
 * tests touch this element" (to pick the tests for what changed) and "what
 * does this test touch".
 *
 * Read from the suite's code, not from test titles, so a test touches what
 * it actually uses:
 * - an element (a field, button, list, form) is touched by a test that
 *   visits its page and uses its locator - the expression the generator
 *   writes for it, so a hand-edited test that keeps the locator still counts;
 * - a link, likewise (TFP-205: or by the hidden-link locator, for a link
 *   inspection found in a closed menu; TFP-208: or, for a link in a
 *   listing's repeated cards, by its card group's locator);
 * - a flow (a candidate journey) by the journey test written for it.
 * A whole-page check (the WCAG scan, a heading check) touches the page, not
 * each element on it, so it doesn't make an element covered.
 *
 * TFP-201 (Gate A ruling 1, 2026-10-14): coverage in two tiers.
 * - **In context:** found and checked on its page, as above. This tier is
 *   the gap list, the index, and TFP-194's targets.
 * - **Reachability:** a link whose URL a site-wide check requests (link
 *   health, HTTPS) without finding it on any page.
 * A link with the same text and target on several pages (the header's, the
 * footer's) is one item, covered in context when it is checked on any one
 * of them. The inspection records no page region, so "the same link" is
 * the same text and target wherever it appears.
 */

const MAX_TESTS_PER_ENTRY = 50;

/**
 * What a test that uses the element has in its code. A form without an id is
 * found as the form check finds it (actionable-elements/form-check.ts): by its
 * recorded action, method and occurrence, or by its place among the page's
 * forms when there is no record. Everything else by its locator expression.
 */
function needlesFor(element: ActionableElementDetail, forms: ActionableElementDetail[]): string[] {
    const needles = [buildLocatorExpression(element)];
    if (element.elementType === "form" && !element.locator.id) {
        needles.push(element.form
            ? `{ action: '${escapeForSingleQuotedString(element.form.action)}', method: '${escapeForSingleQuotedString(element.form.method)}', occurrence: ${element.form.occurrence} }`
            : `page.locator('form').nth(${forms.indexOf(element)})`);
    }
    return needles;
}
const fullTitle = (unit: TestUnit) => (unit.id ? `${unit.id}: ${unit.title}` : unit.title);

export function buildCoverageMap(profile: ContentProfile | null, suiteCode: string | null): CoverageMap | null {
    const pages = profile?.pages ?? [];
    if (pages.length === 0 || suiteCode === null) return null;
    const units = parseTestUnits(suiteCode);
    const onPage = (path: string) => units.filter((unit) => unit.paths.includes(path));
    const siteWide = units.filter((unit) => unit.paths.length === 0);
    const touching = (candidates: TestUnit[], needle: string) => candidates.filter((unit) => unit.source.includes(needle)).map(fullTitle).slice(0, MAX_TESTS_PER_ENTRY);

    const entries: CoverageMapEntry[] = [];
    const links = new Map<string, CoverageMapEntry>();
    let linksOnPages = 0;
    const seen = new Set<string>();
    const add = (entry: CoverageMapEntry) => {
        if (seen.has(entry.key)) return;
        seen.add(entry.key);
        entries.push(entry);
    };

    for (const page of pages) {
        const tests = onPage(page.path);
        const forms = (page.actionableElements ?? []).filter((element) => element.elementType === "form");
        for (const element of page.actionableElements ?? []) {
            // Links are mapped from the page's link list, where it has one (as the generator writes their tests).
            if (element.elementType === "link" && (page.linkDetails?.length ?? 0) > 0) continue;
            const needles = needlesFor(element, forms);
            const touched = [...new Set(needles.flatMap((needle) => touching(tests, needle)))].slice(0, MAX_TESTS_PER_ENTRY);
            add({ key: `${page.path} element ${needles.at(-1)}`, page: page.path, pages: [page.path], kind: "element", name: `${getActionableElementDisplayName(element)} [${element.elementType}]`, tests: touched });
        }
        const groups = cardGroups(page.linkDetails ?? []);
        for (const link of page.linkDetails ?? []) {
            linksOnPages++;
            const key = `link ${JSON.stringify([link.text, link.url])}`;
            // TFP-205: a link inspection found hidden (a closed menu) is found by the generator's hidden-link locator.
            // TFP-208: a card's link, by its card group's locator, which finds every card on the page by position.
            const group = groups.find((candidate) => candidate.keys.has(linkKey(link)));
            const needles = [buildLinkLocatorExpression(link), buildHiddenLinkLocatorExpression(link), ...(group ? [cardGroupLocator(group)] : [])];
            const inContext = [...new Set(needles.flatMap((needle) => touching(tests, needle)))].slice(0, MAX_TESTS_PER_ENTRY);
            const known = links.get(key);
            if (known) {
                if (!known.pages!.includes(page.path)) known.pages!.push(page.path);
                known.tests = [...new Set([...known.tests, ...inContext])].slice(0, MAX_TESTS_PER_ENTRY);
                continue;
            }
            const entry: CoverageMapEntry = { key, page: page.path, pages: [page.path], kind: "link", name: `${link.text || link.url} [link]`, tests: inContext, reachedBy: touching(siteWide, `"url":${JSON.stringify(link.url)}`) };
            links.set(key, entry);
            add(entry);
        }
    }
    for (const journey of profile?.journeys ?? []) {
        const title = buildJourneyTitle(journey);
        add({ key: `flow ${journey.id}`, page: journey.path[0] ?? "/", pages: [journey.path[0] ?? "/"], kind: "flow", name: title, tests: units.filter((unit) => stripTestIdPrefix(unit.title) === title).map(fullTitle) });
    }

    const reachedOnly = (entry: CoverageMapEntry) => entry.tests.length === 0 && (entry.reachedBy?.length ?? 0) > 0;
    // A repeated link is counted in each page type it appears on, and once in the totals.
    const types: CoverageMapType[] = groupPagesByAddress(pages.map((page) => page.path)).map((type) => {
        const inType = entries.filter((entry) => (entry.pages ?? [entry.page]).some((path) => type.pages.includes(path)));
        return {
            pattern: type.pattern,
            pages: type.pages.length,
            total: inType.length,
            covered: inType.filter((entry) => entry.tests.length > 0).length,
            reachedOnly: inType.filter(reachedOnly).length,
            uncovered: inType.filter((entry) => entry.tests.length === 0).map(gapName),
        };
    });
    return {
        entries,
        types,
        total: entries.length,
        covered: entries.filter((entry) => entry.tests.length > 0).length,
        reachedOnly: entries.filter(reachedOnly).length,
        links: { onPages: linksOnPages, distinct: links.size },
    };
}

/** "page: name" for the gap list; a repeated link names how many pages it is on, and one reached by its URL says so. */
function gapName(entry: CoverageMapEntry): string {
    const pages = entry.pages ?? [entry.page];
    const where = pages.length > 1 ? `${entry.page} and ${pages.length - 1} more ${pages.length === 2 ? "page" : "pages"}` : entry.page;
    return `${where}: ${entry.name}${(entry.reachedBy?.length ?? 0) > 0 ? " (its URL is requested, but it isn't checked on a page)" : ""}`;
}

/** The index: the tests that touch one element (by its key), to run just those when it changes. */
export function testsTouching(map: CoverageMap, key: string): string[] {
    return map.entries.find((entry) => entry.key === key)?.tests ?? [];
}

/** The index, the other way: what one test touches. */
export function touchedBy(map: CoverageMap, testTitle: string): CoverageMapEntry[] {
    return map.entries.filter((entry) => entry.tests.includes(testTitle));
}

/** What no test checks in context: the gap list (a link only reached by its URL is on it). */
export function untouched(map: CoverageMap): CoverageMapEntry[] {
    return map.entries.filter((entry) => entry.tests.length === 0);
}
