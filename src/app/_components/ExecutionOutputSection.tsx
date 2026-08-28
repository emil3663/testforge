import { CollapsibleSection } from "@/app/_components/CollapsibleSection";
import { FallbackExecutionTable } from "@/app/_components/FallbackExecutionTable";
import { MetricCard } from "@/app/_components/MetricCard";
import { formatMilliseconds } from "@/lib/report/text";
import type { RunResult } from "@/app/_lib/types";

interface ExecutionOutputSectionProps {
    result: RunResult;
    isReportCollapsed: boolean;
    setIsReportCollapsed: (updater: (value: boolean) => boolean) => void;
    handleContinueRun: () => void;
    hasCode: boolean;
    isRunning: boolean;
    isContentAwareReady: boolean;
    isPracticeSelectionReady: boolean;
    canGenerateOrRun: boolean;
    canContinueCancelledRun: boolean;
    handleCopyRawOutput: (rawOutput: string) => void;
    rawOutputCopyLabel: string;
    handleExportRawOutput: (rawOutput: string) => void;
    rawOutputExportLabel: string;
}

export function ExecutionOutputSection({
    result,
    isReportCollapsed,
    setIsReportCollapsed,
    handleContinueRun,
    hasCode,
    isRunning,
    isContentAwareReady,
    isPracticeSelectionReady,
    canGenerateOrRun,
    canContinueCancelledRun,
    handleCopyRawOutput,
    rawOutputCopyLabel,
    handleExportRawOutput,
    rawOutputExportLabel,
}: ExecutionOutputSectionProps) {
    return (
                    <CollapsibleSection
                        title="Execution Output"
                        subtitle={result.runStatus === "cancelled"
                            ? "The run was stopped before Playwright produced a structured report. TestForge preserved the latest available progress and raw console output."
                            : "Structured report data was not available for this run, so only the raw console output is shown."}
                        collapsed={isReportCollapsed}
                        onToggle={() => setIsReportCollapsed((value) => !value)}
                    >
                        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div className="text-sm font-semibold text-zinc-900">
                                    {result.runStatus === "cancelled"
                                        ? "Run stopped"
                                        : result.passed
                                            ? "All tests passed"
                                            : "Tests failed"} — {formatMilliseconds(result.duration)}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {result.runStatus === "cancelled" ? (
                                        <button
                                            type="button"
                                            onClick={handleContinueRun}
                                            disabled={!hasCode || isRunning || !isContentAwareReady || !isPracticeSelectionReady || !canGenerateOrRun || !canContinueCancelledRun}
                                            className="rounded-xl border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 transition hover:border-sky-400 hover:text-sky-900 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            Continue remaining tests
                                        </button>
                                    ) : null}
                                    <button
                                        type="button"
                                        onClick={() => handleCopyRawOutput(result.output)}
                                        className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-zinc-400 hover:text-zinc-950"
                                    >
                                        {rawOutputCopyLabel}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleExportRawOutput(result.output)}
                                        className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-zinc-400 hover:text-zinc-950"
                                    >
                                        {rawOutputExportLabel}
                                    </button>
                                </div>
                            </div>
                            <div className="mt-4 grid gap-3 sm:grid-cols-4">
                                <MetricCard
                                    label="Completed"
                                    value={result.progress.completedTests}
                                    caption={`of ${result.progress.totalTests || result.progress.startedTests || 0} planned`}
                                />
                                <MetricCard
                                    label="Passed"
                                    value={result.progress.passedTests}
                                    caption="completed successfully"
                                />
                                <MetricCard
                                    label="Failed"
                                    value={result.progress.failedTests}
                                    caption="ended in failure"
                                />
                                <MetricCard
                                    label="Blocked"
                                    value={result.progress.blockedTests}
                                    caption="skipped or interrupted"
                                />
                            </div>
                            <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                                <div className="font-semibold text-zinc-900">Latest observed test</div>
                                <div className="mt-1">
                                    {result.progress.lastCompletedTitle
                                        ?? result.progress.currentTestTitle
                                        ?? "No test progress was captured before the run stopped."}
                                </div>
                            </div>
                            {result.progress.plannedExecutions.length > 0 ? (
                                <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
                                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                        Execution detail
                                    </div>
                                    <div className="mt-2 text-sm text-zinc-500">
                                        TestForge preserved the planned execution list and the latest known state for each test when the run stopped.
                                    </div>
                                    <FallbackExecutionTable progress={result.progress} />
                                </div>
                            ) : null}
                            <pre className="mt-4 overflow-x-auto rounded-2xl bg-zinc-950 px-4 py-4 font-mono text-xs leading-6 text-zinc-200 whitespace-pre-wrap">
                                {result.output}
                            </pre>
                        </div>
                    </CollapsibleSection>
    );
}
