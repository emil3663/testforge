import { buildVersionFooterHtml, escapeReportHtml, formatMilliseconds } from "./text";
import type { RunReport } from "./types";
import { buildPageTypesHtmlSection } from "./page-types-html";
import { buildCoverageMapHtmlSection } from "./coverage-map-html";

// Phase 35 (TFP-132, Decision 7): the saved report of a Comprehensive run
// shows that area only, on one page and in a fixed order: the area summary,
// the per-page table, failures and findings by category, the local model's
// section, and the fixed "what this run did not test" statement last.

const e = escapeReportHtml;

export function buildComprehensiveHtmlDocument(report: RunReport, runId: string): string {
    const c = report.comprehensive!;
    const pageRows = c.pages.map((row) => `
                <tr><td>${e(row.path)}</td><td>${row.tests}</td><td>${row.passed}</td><td>${row.failed}</td><td>${row.findings}</td><td>${row.notRun}</td></tr>`).join("")
        || `<tr><td colspan="6">No page was covered.</td></tr>`;
    const groups = c.groups.map((group) => `
            <div class="group">
                <h3>${e(group.category)}</h3>
                ${group.failures.length > 0 ? `<h4>Failures</h4><ul>${group.failures.map((issue) => `<li><strong>${e(issue.page)}</strong> - ${e(issue.title)}: ${e(issue.detail)}</li>`).join("")}</ul>` : ""}
                ${group.findings.length > 0 ? `<h4>Findings</h4><ul>${group.findings.map((issue) => `<li><strong>${e(issue.page)}</strong> - ${e(issue.title)}: ${e(issue.detail)}</li>`).join("")}</ul>` : ""}
            </div>`).join("") || "<p>No failures or findings.</p>";
    const asvs = c.notTested.asvs;
    const asvsTable = asvs ? `
            <p class="meta">Chapters from ${e(asvs.source)}.</p>
            <table>
                <thead><tr><th>Chapter</th><th>Passive reach</th><th>Tested in this run</th><th>Why</th></tr></thead>
                <tbody>${asvs.chapters.map((chapter) => `<tr><td>${e(chapter.id)} ${e(chapter.name)}</td><td>${e(chapter.passiveReach)}</td><td>${chapter.testedInRun ? "yes" : "no"}</td><td>${e(chapter.why)}</td></tr>`).join("")}</tbody>
            </table>` : "";

    return `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>TestForge ${e(c.label)} ${e(runId)}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; margin: 0; background: #f4f4f5; color: #18181b; line-height: 1.5; }
        main { max-width: 1140px; margin: 0 auto; padding: 24px 16px 48px; }
        section { background: white; border: 1px solid #e4e4e7; border-radius: 20px; padding: 20px; margin-bottom: 16px; }
        h1 { font-size: 22px; margin: 0 0 4px; } h2 { font-size: 17px; margin: 0 0 8px; } h3 { font-size: 15px; margin: 12px 0 4px; } h4 { font-size: 13px; margin: 8px 0 2px; }
        .meta { font-size: 12px; color: #71717a; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th { text-align: left; font-size: 11px; text-transform: uppercase; color: #71717a; border-bottom: 1px solid #e4e4e7; padding: 6px 10px; }
        td { border-top: 1px solid #f4f4f5; padding: 8px 10px; vertical-align: top; }
        .headline { font-weight: 600; }
        pre { white-space: pre-wrap; background: #111827; color: #f3f4f6; padding: 16px; border-radius: 14px; font-size: 12px; }
    </style>
</head>
<body>
    <main>
        <p class="meta">Run <strong>${e(runId)}</strong> · ${e(formatMilliseconds(report.summary.duration))}</p>
        <h1>${e(c.label)}</h1>
        <section id="summary">
            <h2>Summary</h2>
            <p class="headline">${e(c.summary.headline)}</p>
            <p>${c.summary.pages} pages, ${c.summary.tests} checks: ${c.summary.passed} passed, ${c.summary.failed} failed, ${c.summary.findings} findings, ${c.summary.notRun} not run.</p>
            <p class="meta">${e(c.workerNote)} Page cap ${c.pageCap}.</p>
        </section>
        <section id="pages">
            <h2>Pages</h2>
            <table>
                <thead><tr><th>Page</th><th>Checks</th><th>Passed</th><th>Failed</th><th>Findings</th><th>Not run</th></tr></thead>
                <tbody>${pageRows}</tbody>
            </table>
        </section>
        <section id="issues">
            <h2>Failures and findings</h2>
            ${groups}
        </section>
        <section id="model">
            <h2>Local model scenarios</h2>
            <p>${e(c.model.note)}</p>
            ${c.model.tests.length > 0 ? `<ul>${c.model.tests.map((t) => `<li><strong>${e(t.outcome)}</strong> - ${e(t.title)}${t.detail ? `: ${e(t.detail)}` : ""}</li>`).join("")}</ul>` : ""}
        </section>
        ${c.candidates ? `<section id="candidates">
            <h2>Candidate tests</h2>
            <p>${e(c.candidates.note)}</p>
            <ul>${c.candidates.tests.map((t) => `<li><strong>${e(t.outcome)}</strong> - ${e(t.title)}${t.detail ? `: ${e(t.detail)}` : ""}</li>`).join("")}</ul>
        </section>` : ""}
        <section id="not-tested">
            <h2>What this run did not test</h2>
            ${c.notTested.statements.map((statement) => `<p>${e(statement)}</p>`).join("")}
            ${c.notTested.pagesNotCovered ? `<p>${e(c.notTested.pagesNotCovered)}</p>` : ""}
            ${c.manualReview.length > 0 ? `<h3>Needs manual review (${c.manualReview.length})</h3><ul>${c.manualReview.map((item) => `<li><strong>${e(item.page)}</strong> - ${e(item.detail)}</li>`).join("")}</ul>` : ""}
            ${asvsTable}
        </section>
        <details>
            <summary class="meta">Raw console output</summary>
            <pre>${e(report.rawOutput)}</pre>
        </details>
        ${buildPageTypesHtmlSection(report.generation?.pageTypes)}
        ${buildCoverageMapHtmlSection(report.coverageMap)}
    </main>
    ${buildVersionFooterHtml(report.producedBy)}
</body>
</html>`;
}
