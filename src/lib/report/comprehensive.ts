import { ASVS_CHAPTERS, ASVS_SOURCE } from "@/lib/comprehensive/asvs";
import { NOT_TESTED_STATEMENTS, notCoveredPagesStatement } from "@/lib/comprehensive/not-tested";
import { selectComprehensivePages } from "@/lib/comprehensive/pages";
import { comprehensiveLabel, type ComprehensiveRunMode } from "@/lib/comprehensive/run-mode";
import type { ContentProfile } from "@/lib/generate/mock/types";
import type { ComprehensiveGroup, ComprehensiveIssue, ComprehensivePageRow, ComprehensiveReport, ExecutionRecord } from "./types";

// Phase 35 (TFP-132, Decision 7): a single-area run's report shows only that
// area - a summary, a per-page table, failures and findings grouped by OWASP
// category (security) or WCAG criterion (accessibility) naming the page and
// the test, then the local model's section (Decision 5) and the fixed "not
// tested" statement (Decision 6).

export const UNCATEGORISED = "Not categorised";

export const MODEL_NOT_ASKED_NOTE =
    "The local model was not asked for scenarios in this run. The template's checks stand on their own.";

const FAILED_STATUSES = new Set(["Failed", "Blocked"]);

function firstLine(message: string): string {
    return message.split("\n").map((line) => line.trim()).find(Boolean) ?? "";
}

function plural(count: number, word: string) {
    return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function chapterOf(requirementId: string): string | null {
    const match = /^V?(\d+)(\.|$)/i.exec(requirementId.trim());
    return match ? `V${match[1]}` : null;
}

export function buildComprehensiveReport(
    execution: ExecutionRecord[],
    mode: ComprehensiveRunMode,
    contentProfile: ContentProfile | null,
    baseUrl: string,
    workerCount: number | null
): ComprehensiveReport {
    const scope = selectComprehensivePages(contentProfile, baseUrl, mode.pageCap);

    // The covered pages, then any other page a test reported under - the
    // security run's missing-page probe (TFP-133) - so every check counts.
    const extraPages = [...new Set(execution.map((record) => record.page).filter((page): page is string => Boolean(page) && !scope.covered.includes(page!)))];
    const pages: ComprehensivePageRow[] = [...scope.covered, ...extraPages].map((path) => {
        const records = execution.filter((record) => record.page === path);
        return {
            path,
            tests: records.length,
            passed: records.filter((record) => record.status === "Passed" || record.status === "Flaky").length,
            failed: records.filter((record) => FAILED_STATUSES.has(record.status)).length,
            notRun: records.filter((record) => record.status === "Not run").length,
            findings: records.reduce((sum, record) => sum + (record.findings?.length ?? 0), 0),
        };
    });

    const groups = new Map<string, ComprehensiveGroup>();
    const groupFor = (category: string) => {
        if (!groups.has(category)) groups.set(category, { category, failures: [], findings: [] });
        return groups.get(category)!;
    };
    const manualReview: ComprehensiveIssue[] = [];
    for (const record of execution) {
        const page = record.page ?? "(no page)";
        const category = record.category ?? UNCATEGORISED;
        // TFP-134: a test that recorded its items one by one (an axe scan)
        // files each under its own category; its plain findings repeat them.
        const issues = record.issues ?? [];
        for (const issue of issues) {
            const item: ComprehensiveIssue = { page, title: record.title, detail: issue.detail };
            if (issue.kind === "manual-review") manualReview.push(item);
            else if (issue.kind === "finding") groupFor(issue.category).findings.push(item);
            else if (FAILED_STATUSES.has(record.status)) groupFor(issue.category).failures.push(item);
        }
        if (FAILED_STATUSES.has(record.status) && !issues.some((issue) => issue.kind === "failure")) {
            const issue: ComprehensiveIssue = { page, title: record.title, detail: `${record.status === "Blocked" ? "Blocked: " : ""}${firstLine(record.rawMessage)}` };
            groupFor(category).failures.push(issue);
        }
        if (issues.length === 0) {
            for (const finding of record.findings ?? []) {
                groupFor(category).findings.push({ page, title: record.title, detail: finding });
            }
        }
    }

    const tests = pages.reduce((sum, row) => sum + row.tests, 0);
    const failed = pages.reduce((sum, row) => sum + row.failed, 0);
    const findings = pages.reduce((sum, row) => sum + row.findings, 0);
    const pagesWithFailures = pages.filter((row) => row.failed > 0).length;
    const ran = pages.reduce((sum, row) => sum + row.tests - row.notRun, 0);
    const headline = ran === 0
        ? "No check ran."
        : failed > 0
            ? `${plural(failed, "failure")} on ${pagesWithFailures} of ${plural(pages.length, "page")}, ${plural(findings, "finding")}. Read what this run did not test before relying on it.`
            : `No failures on ${plural(pages.length, "page")}, ${plural(findings, "finding")}. That is not a clean bill of health: read what this run did not test.`;

    const workerNote = workerCount === null
        ? "Worker count not recorded."
        : workerCount === 1
            ? "One worker: tests ran one at a time, as the suite itself requires on every host."
            : `${plural(workerCount, "worker")}.`;

    const testedChapters = new Set(
        execution
            .filter((record) => record.status !== "Not run")
            .flatMap((record) => record.asvs ?? [])
            .map(chapterOf)
            .filter((chapter): chapter is string => chapter !== null)
    );

    return {
        area: mode.area,
        level: mode.level,
        label: comprehensiveLabel(mode),
        pageCap: scope.pageCap,
        pagesCovered: scope.covered,
        pagesNotCovered: scope.notCovered,
        workerCount,
        workerNote,
        summary: {
            pages: pages.length,
            tests,
            passed: pages.reduce((sum, row) => sum + row.passed, 0),
            failed,
            notRun: pages.reduce((sum, row) => sum + row.notRun, 0),
            findings,
            headline,
        },
        pages,
        groups: [...groups.values()],
        manualReview,
        model: { status: "not-asked", note: MODEL_NOT_ASKED_NOTE },
        notTested: {
            statements: [...NOT_TESTED_STATEMENTS[mode.area]],
            pagesNotCovered: notCoveredPagesStatement(scope.notCovered, scope.pageCap),
            asvs: mode.area === "security"
                ? {
                    source: `${ASVS_SOURCE.standard} ${ASVS_SOURCE.version} (${ASVS_SOURCE.published}), ${ASVS_SOURCE.repository} tag ${ASVS_SOURCE.tag}`,
                    chapters: ASVS_CHAPTERS.map((chapter) => ({ ...chapter, testedInRun: testedChapters.has(chapter.id) })),
                }
                : null,
        },
    };
}
