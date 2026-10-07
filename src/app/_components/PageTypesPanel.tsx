"use client";

import { useState } from "react";
import { ReportPanel } from "@/app/_components/ReportPanel";
import { coveredPageUrls, describePageTypeHeadline, describePageTypeSelection, skippedPageUrls } from "@/lib/report/page-types-text";
import type { PageTypeCoverageEntry, RunReport } from "@/lib/report/types";

// Phase 40 Decision 7 (TFP-173): page types found, covered and skipped, each
// with its pattern, page count, label and the full URL of the page that
// represented it; then the copyable list of covered URLs (one per line, for
// the URL field) and the skipped types' list. Shown last in the report.
export function PageTypesPanel({ report }: { report: RunReport }) {
    const record = report.generation?.pageTypes;
    const [copied, setCopied] = useState<"covered" | "skipped" | null>(null);
    if (!record) return null;
    const covered = coveredPageUrls(record);
    const skipped = skippedPageUrls(record);

    async function copy(which: "covered" | "skipped", urls: string[]) {
        try {
            await navigator.clipboard.writeText(urls.join("\n"));
            setCopied(which);
        } catch {
            setCopied(null);
        }
    }

    const row = (entry: PageTypeCoverageEntry, status: string) => (
        <tr key={`${entry.pattern} ${entry.url}`} className="border-t border-zinc-100 align-top">
            <td className="px-3 py-2 font-mono text-xs text-zinc-900">{entry.pattern}</td>
            <td className="px-3 py-2">{entry.label}</td>
            <td className="px-3 py-2">{entry.pages}</td>
            <td className="px-3 py-2 break-all"><a className="text-sky-700 underline" href={entry.url} target="_blank" rel="noreferrer">{entry.url}</a></td>
            <td className="px-3 py-2 text-zinc-600">{status}</td>
        </tr>
    );

    return (
        <ReportPanel
            eyebrow="Page Types"
            title="Pages covered by type"
            description="The page types the crawl found, which this run covered and which it skipped, and the pages to paste back into the URL field."
        >
            <p className="text-sm font-semibold leading-6 text-zinc-900" data-testid="page-types-headline">{describePageTypeHeadline(record)}</p>
            <p className="mt-1 text-sm leading-6 text-zinc-600">{describePageTypeSelection(record)}</p>
            <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase text-zinc-500">
                        <tr><th className="px-3 py-2">Pattern</th><th className="px-3 py-2">Label</th><th className="px-3 py-2">Pages</th><th className="px-3 py-2">Represented by</th><th className="px-3 py-2">Status</th></tr>
                    </thead>
                    <tbody>
                        {record.covered.map((entry) => row(entry, entry.covered.length > 1 ? `covered (${entry.covered.length} pages)` : "covered"))}
                        {record.skipped.map((entry) => row(entry, `skipped: ${entry.reason ?? "not covered"}`))}
                    </tbody>
                </table>
            </div>
            <div className="mt-4">
                <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-semibold text-zinc-900">Covered pages: paste into the URL field to run them again</h4>
                    <button type="button" onClick={() => void copy("covered", covered)} className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:border-zinc-400">
                        {copied === "covered" ? "Copied" : "Copy list"}
                    </button>
                </div>
                <pre data-testid="covered-urls" className="mt-2 whitespace-pre-wrap break-all rounded-xl bg-zinc-100 p-3 text-xs text-zinc-900">{covered.join("\n")}</pre>
            </div>
            <div className="mt-4">
                <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-semibold text-zinc-900">Skipped types: one page each, to add by hand</h4>
                    <button type="button" disabled={skipped.length === 0} onClick={() => void copy("skipped", skipped)} className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:border-zinc-400 disabled:opacity-50">
                        {copied === "skipped" ? "Copied" : "Copy list"}
                    </button>
                </div>
                <pre data-testid="skipped-urls" className="mt-2 whitespace-pre-wrap break-all rounded-xl bg-zinc-100 p-3 text-xs text-zinc-900">{skipped.length > 0 ? skipped.join("\n") : "(none)"}</pre>
            </div>
        </ReportPanel>
    );
}
