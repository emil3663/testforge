import { ExecutionTable } from "@/app/_components/ExecutionTable";
import { ReportPanel } from "@/app/_components/ReportPanel";
import type { ExecutionRecord, ExecutionStatus } from "@/lib/report/types";

interface ExecutionTabProps {
    statusFilter: "All" | ExecutionStatus;
    setStatusFilter: (status: "All" | ExecutionStatus) => void;
    rerunnableFailedTitles: string[];
    selectedRerunnableFailedTitles: string[];
    handleRerunFailedTitles: (titles: string[]) => void;
    isRunning: boolean;
    canGenerateOrRun: boolean;
    setSelectedFailedRerunTitles: (titles: string[]) => void;
    filteredExecution: ExecutionRecord[];
    toggleFailedRerunTitle: (title: string) => void;
}

export function ExecutionTab({
    statusFilter,
    setStatusFilter,
    rerunnableFailedTitles,
    selectedRerunnableFailedTitles,
    handleRerunFailedTitles,
    isRunning,
    canGenerateOrRun,
    setSelectedFailedRerunTitles,
    filteredExecution,
    toggleFailedRerunTitle,
}: ExecutionTabProps) {
    return (
                                <ReportPanel
                                    eyebrow="Test Execution Report"
                                    title="Detailed case-by-case results"
                                    description="Filterable execution detail for QA teams to inspect individual failures and remarks."
                                >
                                    <div className="mb-4 flex flex-wrap gap-2">
                                        {(["All", "Passed", "Failed", "Blocked", "Not run", "Flaky"] as const).map(
                                            (status) => (
                                                <button
                                                    key={status}
                                                    type="button"
                                                    onClick={() => setStatusFilter(status)}
                                                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${statusFilter === status
                                                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                                                        : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:text-zinc-900"
                                                        }`}
                                                >
                                                    {status}
                                                </button>
                                            )
                                        )}
                                    </div>
                                    {rerunnableFailedTitles.length > 0 ? (
                                        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                                            <div className="text-sm text-zinc-600">
                                                {selectedRerunnableFailedTitles.length > 0
                                                    ? `${selectedRerunnableFailedTitles.length} failed test${selectedRerunnableFailedTitles.length === 1 ? "" : "s"} selected for rerun`
                                                    : `${rerunnableFailedTitles.length} failed test${rerunnableFailedTitles.length === 1 ? "" : "s"} available for rerun`}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleRerunFailedTitles(selectedRerunnableFailedTitles)}
                                                disabled={isRunning || !canGenerateOrRun || selectedRerunnableFailedTitles.length === 0}
                                                className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:border-rose-400 hover:text-rose-900 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                Rerun selected failed tests
                                            </button>
                                            {selectedRerunnableFailedTitles.length > 0 ? (
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedFailedRerunTitles([])}
                                                    className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-zinc-400 hover:text-zinc-950"
                                                >
                                                    Clear selection
                                                </button>
                                            ) : null}
                                        </div>
                                    ) : null}
                                    <ExecutionTable
                                        records={filteredExecution}
                                        selectedFailedTitles={selectedRerunnableFailedTitles}
                                        onToggleFailedSelection={toggleFailedRerunTitle}
                                        onRerunFailedTitle={(title) => handleRerunFailedTitles([title])}
                                        rerunActionsDisabled={isRunning || !canGenerateOrRun}
                                    />
                                </ReportPanel>
    );
}
