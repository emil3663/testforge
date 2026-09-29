import type { BestPracticeArea } from "./mock/types";
import { findTypeErrors, findUnawaitedAssertions } from "./validate";

// Phase 36 (TFP-126, Decision 6): the per-suite code-quality measures the
// local-model benchmark records. The two gates are the ones the route itself
// applies; the rest are cheap, deterministic checks on the code text.
//
// "Category signal" is Decision 6's trait per area, checked as the presence of
// the code that trait needs - a proxy for Phase 33's by-reading check, not a
// replacement for reading suites:
//   performance   measures time (Date.now, performance timing entries)
//   seo           checks the title AND the meta description
//   database      saves (fills a field) AND reloads
//   security      sends a payload (script-shaped input, a dialog listener)
//                 or checks transport (the page's protocol)
//   reliability   intercepts requests with route()
//   accessibility checks names or roles (role/label queries, accessible-name
//                 or aria assertions)
//   functional    interacts with the page (click, fill, check, select, press).
//                 Decision 6 names no trait for functional; this one is
//                 TestForge's own and is stated in the benchmark report.

const SIGNALS: Partial<Record<BestPracticeArea, (code: string) => boolean>> = {
    "performance/load": (code) => /Date\.now\(\)|performance\.(now|timing|getEntries)|getEntriesByType\(|loadEventEnd|responseStart|domContentLoadedEventEnd/.test(code),
    "seo/content": (code) => /toHaveTitle\(|\.title\(\)/.test(code) && /meta\[name=\\?["']?description/.test(code),
    database: (code) => /\.fill\(/.test(code) && /\.reload\(/.test(code),
    security: (code) =>
        /<script|onerror\s*=|<img[^>]*src\s*=\s*x|javascript:|\balert\(|\.on\(\s*['"]dialog['"]/.test(code) ||
        /\.protocol\b|startsWith\(\s*['"]https?:/.test(code),
    reliability: (code) => /\b(page|context)\.route\(/.test(code),
    accessibility: (code) => /getByRole\(|getByLabel\(|toHaveAccessibleName\(|toHaveRole\(|ariaSnapshot\(|toMatchAriaSnapshot\(|toHaveAttribute\(\s*['"](aria-[\w-]+|role|alt)['"]/.test(code),
    functional: (code) => /\.(click|fill|check|selectOption|press|type)\(/.test(code),
};

/** Leftovers from the local rules' worked examples (Phase 32's leak lesson). */
const LEAKED_EXAMPLE_DATA = /example\.invalid|EXAMPLE-ONLY/;

/** Titles of test(...) calls, not test.describe / test.skip / test.use. */
export function testTitles(code: string): string[] {
    return [...code.matchAll(/(?<![.\w])test\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g)].map((m) => m[2]);
}

export function hasCategorySignal(area: BestPracticeArea, code: string): boolean | null {
    const signal = SIGNALS[area];
    return signal ? signal(code) : null;
}

export interface SuiteQuality {
    typeErrors: number;
    unawaitedAssertions: number;
    /** Both of the route's gates passed. */
    gatesPassed: boolean;
    tests: number;
    /** null: no signal is defined for the area. */
    categorySignal: boolean | null;
    leakedExampleData: boolean;
    duplicateTitles: string[];
}

export function scoreSuite(area: BestPracticeArea, code: string): SuiteQuality {
    let typeErrors: number;
    try {
        typeErrors = findTypeErrors(code).length;
    } catch {
        typeErrors = Number.NaN;
    }
    let unawaitedAssertions: number;
    try {
        unawaitedAssertions = findUnawaitedAssertions(code).filter((a) => a.returnsPromise).length;
    } catch {
        unawaitedAssertions = Number.NaN;
    }
    const titles = testTitles(code);
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const title of titles) (seen.has(title) ? duplicates : seen).add(title);
    return {
        typeErrors,
        unawaitedAssertions,
        gatesPassed: typeErrors === 0 && unawaitedAssertions === 0,
        tests: titles.length,
        categorySignal: hasCategorySignal(area, code),
        leakedExampleData: LEAKED_EXAMPLE_DATA.test(code),
        duplicateTitles: [...duplicates],
    };
}
