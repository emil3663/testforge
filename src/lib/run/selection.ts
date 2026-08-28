export function estimateTestCount(code: string) {
    const matches = code.match(/\btest\s*\(/g);
    return Math.max(1, matches?.length ?? 0);
}

function extractDeclaredTestTitles(code: string) {
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
