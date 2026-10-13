import { buildJourneyTitle } from "@/lib/generate/mock/journey-tests";
import { buildLinkLocatorExpression, buildLocatorExpression, getActionableElementDisplayName } from "@/lib/generate/mock/locators";
import { escapeForSingleQuotedString } from "@/lib/generate/mock/format";
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
 * - a link, likewise, or by a site-wide link check that requests its URL;
 * - a flow (a candidate journey) by the journey test written for it.
 * A whole-page check (the WCAG scan, a heading check) touches the page, not
 * each element on it, so it doesn't make an element covered.
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
            add({ key: `${page.path} element ${needles.at(-1)}`, page: page.path, kind: "element", name: `${getActionableElementDisplayName(element)} [${element.elementType}]`, tests: touched });
        }
        for (const link of page.linkDetails ?? []) {
            const locator = buildLinkLocatorExpression(link);
            const byRequest = touching(siteWide, `"url":${JSON.stringify(link.url)}`);
            add({ key: `${page.path} link ${locator}`, page: page.path, kind: "link", name: `${link.text || link.url} [link]`, tests: [...new Set([...touching(tests, locator), ...byRequest])].slice(0, MAX_TESTS_PER_ENTRY) });
        }
    }
    for (const journey of profile?.journeys ?? []) {
        const title = buildJourneyTitle(journey);
        add({ key: `flow ${journey.id}`, page: journey.path[0] ?? "/", kind: "flow", name: title, tests: units.filter((unit) => stripTestIdPrefix(unit.title) === title).map(fullTitle) });
    }

    const types: CoverageMapType[] = groupPagesByAddress(pages.map((page) => page.path)).map((type) => {
        const inType = entries.filter((entry) => type.pages.includes(entry.page));
        return {
            pattern: type.pattern,
            pages: type.pages.length,
            total: inType.length,
            covered: inType.filter((entry) => entry.tests.length > 0).length,
            uncovered: inType.filter((entry) => entry.tests.length === 0).map((entry) => `${entry.page}: ${entry.name}`),
        };
    });
    return { entries, types, total: entries.length, covered: entries.filter((entry) => entry.tests.length > 0).length };
}

/** The index: the tests that touch one element (by its key), to run just those when it changes. */
export function testsTouching(map: CoverageMap, key: string): string[] {
    return map.entries.find((entry) => entry.key === key)?.tests ?? [];
}

/** The index, the other way: what one test touches. */
export function touchedBy(map: CoverageMap, testTitle: string): CoverageMapEntry[] {
    return map.entries.filter((entry) => entry.tests.includes(testTitle));
}

/** What no test touches: the gap list. */
export function untouched(map: CoverageMap): CoverageMapEntry[] {
    return map.entries.filter((entry) => entry.tests.length === 0);
}
