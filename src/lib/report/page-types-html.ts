import { escapeReportHtml as e } from "./text";
import { coveredPageUrls, describePageTypeHeadline, describePageTypeSelection, skippedPageUrls } from "./page-types-text";
import type { PageTypeCoverageEntry, PageTypeCoverageRecord } from "./types";

/**
 * Phase 40 Decision 7 (TFP-173): the page-type section of an HTML export,
 * Standard and Comprehensive alike, placed last. Types found, covered and
 * skipped, each with its pattern, page count, label and the full URL of the
 * page that represented it; then the copyable list of covered URLs, one per
 * line, ready to paste into the URL field, and a second list for the skipped
 * types.
 */
export function buildPageTypesHtmlSection(record: PageTypeCoverageRecord | undefined): string {
    if (!record) return "";
    const row = (entry: PageTypeCoverageEntry, status: string) => `
                    <tr><td>${e(entry.pattern)}</td><td>${e(entry.label)}</td><td>${entry.pages}</td><td><a href="${e(entry.url)}">${e(entry.url)}</a></td><td>${e(status)}</td></tr>`;
    const covered = coveredPageUrls(record);
    const skipped = skippedPageUrls(record);
    return `
        <section id="page-types" style="background:white;border:1px solid #e4e4e7;border-radius:20px;padding:20px;margin-top:16px">
            <h2 style="font-size:17px;margin:0 0 8px">Page types</h2>
            <p style="font-weight:600">${e(describePageTypeHeadline(record))}</p>
            <p style="font-size:13px;color:#52525b">${e(describePageTypeSelection(record))}</p>
            <table style="width:100%;border-collapse:collapse;font-size:13px">
                <thead><tr><th style="text-align:left">Pattern</th><th style="text-align:left">Label</th><th style="text-align:left">Pages</th><th style="text-align:left">Represented by</th><th style="text-align:left">Status</th></tr></thead>
                <tbody>${record.covered.map((entry) => row(entry, entry.covered.length > 1 ? `covered (${entry.covered.length} pages)` : "covered")).join("")}${record.skipped.map((entry) => row(entry, `skipped: ${entry.reason ?? "not covered"}`)).join("")}</tbody>
            </table>
            <h3 style="font-size:15px;margin:16px 0 4px">Covered pages: paste into the URL field to run them again</h3>
            <pre id="covered-urls" style="white-space:pre-wrap;background:#f4f4f5;color:#18181b;padding:12px;border-radius:12px;font-size:12px">${e(covered.join("\n"))}</pre>
            <h3 style="font-size:15px;margin:16px 0 4px">Skipped types: one page each, to add by hand</h3>
            <pre id="skipped-urls" style="white-space:pre-wrap;background:#f4f4f5;color:#18181b;padding:12px;border-radius:12px;font-size:12px">${skipped.length > 0 ? e(skipped.join("\n")) : "(none)"}</pre>
        </section>`;
}
