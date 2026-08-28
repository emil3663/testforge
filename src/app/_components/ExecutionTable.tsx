import { Fragment, useState } from "react";
import { EmptyState } from "@/app/_components/EmptyState";
import { formatExecutionRemark, getSuiteLabel, statusClasses, summarizeSuite } from "@/app/_lib/format";
import { formatMilliseconds } from "@/lib/report/text";
import type { ExecutionRecord } from "@/lib/report/types";

export function ExecutionTable({
    records,
    selectedFailedTitles,
    onToggleFailedSelection,
    onRerunFailedTitle,
    rerunActionsDisabled,
}: {
    records: ExecutionRecord[];
    selectedFailedTitles: string[];
    onToggleFailedSelection: (title: string) => void;
    onRerunFailedTitle: (title: string) => void;
    rerunActionsDisabled: boolean;
}) {
    const [expandedRows, setExpandedRows] = useState<string[]>([]);

    const suites = records.reduce((groups, record) => {
        const key = getSuiteLabel(record.suite);
        const existing = groups.get(key);

        if (existing) {
            existing.push(record);
        } else {
            groups.set(key, [record]);
        }

        return groups;
    }, new Map<string, ExecutionRecord[]>());

    function toggleRow(rowId: string) {
        setExpandedRows((current) =>
            current.includes(rowId)
                ? current.filter((item) => item !== rowId)
                : [...current, rowId]
        );
    }

    return records.length > 0 ? (
        <div className="space-y-4">
            {Array.from(suites.entries()).map(([suite, suiteRecords], suiteIndex) => {
                const suiteSummary = summarizeSuite(suiteRecords);

                return (
                    <details
                        key={suite}
                        open={suiteIndex === 0}
                        className="group overflow-hidden rounded-2xl border border-zinc-200 bg-white"
                    >
                        <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-4 bg-zinc-50 px-4 py-4 marker:hidden">
                            <div>
                                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                                    Test Set
                                </div>
                                <div className="mt-1 text-base font-semibold text-zinc-950">{suite}</div>
                                <div className="mt-1 text-sm text-zinc-500">
                                    {suiteRecords.length} test{suiteRecords.length === 1 ? "" : "s"} in this set
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                {suiteSummary.Passed > 0 ? (
                                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                        Passed {suiteSummary.Passed}
                                    </span>
                                ) : null}
                                {suiteSummary.Flaky > 0 ? (
                                    <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
                                        Flaky {suiteSummary.Flaky}
                                    </span>
                                ) : null}
                                {suiteSummary.Blocked > 0 ? (
                                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                                        Blocked {suiteSummary.Blocked}
                                    </span>
                                ) : null}
                                {suiteSummary.Failed > 0 ? (
                                    <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                                        Failed {suiteSummary.Failed}
                                    </span>
                                ) : null}
                                <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 transition group-open:bg-zinc-900 group-open:text-white">
                                    Collapsible
                                </span>
                            </div>
                        </summary>
                        <div className="space-y-3 border-t border-zinc-200 px-4 py-4">
                            {suiteRecords.map((record) => {
                                const rowId = `${record.id}-${record.browser}-${record.order}`;
                                const expanded = expandedRows.includes(rowId);
                                const failedSelected = selectedFailedTitles.includes(record.title);

                                return (
                                    <Fragment key={rowId}>
                                        <article className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                                <div>
                                                    <div className="text-sm font-semibold text-zinc-950">{record.title}</div>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    <span
                                                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses(
                                                            record.status
                                                        )}`}
                                                    >
                                                        {record.status}
                                                    </span>
                                                    <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700">
                                                        {record.browser}
                                                    </span>
                                                    <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700">
                                                        {formatMilliseconds(record.duration)}
                                                    </span>
                                                    {record.interactionType ? (
                                                        <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800">
                                                            {record.interactionType}
                                                        </span>
                                                    ) : null}
                                                    <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700">
                                                        {record.area}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="mt-4 rounded-2xl border border-zinc-200 bg-white px-4 py-3">
                                                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                                    Expected Result
                                                </div>
                                                <p className="mt-2 text-sm leading-6 text-zinc-600">
                                                    {record.description}
                                                </p>
                                            </div>

                                            <div className="mt-4 rounded-2xl border border-zinc-200 bg-white px-4 py-3">
                                                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                                    Observed Outcome
                                                </div>
                                                <p className="mt-2 text-sm leading-6 text-zinc-600">
                                                    {formatExecutionRemark(record)}
                                                </p>
                                            </div>

                                            <div className="mt-4 flex flex-wrap gap-2">
                                                {record.status === "Failed" ? (
                                                    <label className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-zinc-400 hover:text-zinc-950">
                                                        <input
                                                            type="checkbox"
                                                            checked={failedSelected}
                                                            onChange={() => onToggleFailedSelection(record.title)}
                                                            aria-label={`Select ${record.title} for rerun`}
                                                            className="h-4 w-4 rounded border-zinc-300 text-rose-600 focus:ring-rose-500"
                                                        />
                                                        Select for rerun
                                                    </label>
                                                ) : null}
                                                {record.status === "Failed" ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => onRerunFailedTitle(record.title)}
                                                        disabled={rerunActionsDisabled}
                                                        className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:border-rose-400 hover:text-rose-900 disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        Rerun this failed test
                                                    </button>
                                                ) : null}
                                                <button
                                                    type="button"
                                                    onClick={() => toggleRow(rowId)}
                                                    className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-zinc-400 hover:text-zinc-950"
                                                >
                                                    {expanded ? "Hide validation steps" : "Show validation steps"}
                                                </button>
                                            </div>

                                            {expanded ? (
                                                <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
                                                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                                        Validation Steps
                                                    </div>
                                                    <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-zinc-600">
                                                        {record.reproductionSteps.map((step) => (
                                                            <li key={step}>{step}</li>
                                                        ))}
                                                    </ol>
                                                </div>
                                            ) : null}
                                        </article>
                                    </Fragment>
                                );
                            })}
                        </div>
                    </details>
                );
            })}
        </div>
    ) : (
        <EmptyState message="No test cases match the current execution filter." />
    );
}

