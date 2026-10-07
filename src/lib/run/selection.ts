/**
 * TFP-189: the tests a suite declares - `test(` and `test.only(` calls, not a
 * property access. `/\btest\s*\(/` also matched `.test(`, as in TFP-167's tfGoto
 * helper (`/#!?\//.test(url)`), so every generated suite was estimated one
 * test too high and a run never reached its planned count.
 */
const DECLARED_TEST = /(?<![.\w$])test(?:\.only)?\s*\(/g;

export function countDeclaredTests(code: string) {
    return code.match(DECLARED_TEST)?.length ?? 0;
}

export function estimateTestCount(code: string) {
    return Math.max(1, countDeclaredTests(code));
}

export function extractDeclaredTestTitles(code: string) {
    const titles: string[] = [];
    const testTitlePattern = /\btest(?:\.only|\.skip|\.fixme)?\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g;

    for (const match of code.matchAll(testTitlePattern)) {
        const rawTitle = match[2] ?? "";
        titles.push(rawTitle.replace(/\\([\\'"`])/g, "$1"));
    }

    return titles;
}

function escapeRegexLiteral(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildRunSelection(code: string, excludedTestTitles: string[], includedTestTitles: string[] = []) {
    const declaredTitles = extractDeclaredTestTitles(code);
    const uniqueExcludedTitles = [...new Set(excludedTestTitles.filter((title) => title.trim().length > 0))];
    const uniqueIncludedTitles = [...new Set(includedTestTitles.filter((title) => title.trim().length > 0))];

    const candidateTitles = uniqueIncludedTitles.length > 0
        ? declaredTitles.filter((title) => uniqueIncludedTitles.includes(title))
        : declaredTitles;

    if (uniqueExcludedTitles.length === 0 && uniqueIncludedTitles.length === 0) {
        return {
            runnableTestCount: declaredTitles.length > 0 ? declaredTitles.length : estimateTestCount(code),
            grepPattern: null,
            grepInvertPattern: null,
        };
    }

    const excludedTitleSet = new Set(uniqueExcludedTitles);
    const runnableTitles = candidateTitles.filter((title) => !excludedTitleSet.has(title));
    const fallbackCount = uniqueIncludedTitles.length > 0
        ? uniqueIncludedTitles.filter((title) => !excludedTitleSet.has(title)).length
        : estimateTestCount(code);
    const runnableTestCount = declaredTitles.length > 0 ? runnableTitles.length : fallbackCount;

    return {
        runnableTestCount,
        grepPattern: uniqueIncludedTitles.length > 0 ? uniqueIncludedTitles.map(escapeRegexLiteral).join("|") : null,
        grepInvertPattern: uniqueExcludedTitles.map(escapeRegexLiteral).join("|"),
    };
}
