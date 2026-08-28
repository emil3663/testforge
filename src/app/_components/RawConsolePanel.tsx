import { ReportPanel } from "@/app/_components/ReportPanel";
import type { RunReport } from "@/lib/report/types";
import type { RunResult } from "@/app/_lib/types";

interface RawConsolePanelProps {
    result: RunResult;
    report: RunReport;
    handleContinueRun: () => void;
    hasCode: boolean;
    isRunning: boolean;
    isContentAwareReady: boolean;
    isPracticeSelectionReady: boolean;
    canGenerateOrRun: boolean;
    canContinueCancelledRun: boolean;
    handleCopyRawOutput: (rawOutput: string) => void;
    rawOutputCopyLabel: string;
    handleExportHtmlReport: (report: RunReport, runId: string) => void;
    htmlReportExportLabel: string;
    handleExportRawOutput: (rawOutput: string) => void;
    rawOutputExportLabel: string;
}

export function RawConsolePanel({
    result,
    report,
    handleContinueRun,
    hasCode,
    isRunning,
    isContentAwareReady,
    isPracticeSelectionReady,
    canGenerateOrRun,
    canContinueCancelledRun,
    handleCopyRawOutput,
    rawOutputCopyLabel,
    handleExportHtmlReport,
    htmlReportExportLabel,
    handleExportRawOutput,
    rawOutputExportLabel,
}: RawConsolePanelProps) {
    return (
                            <ReportPanel
                                eyebrow="Raw Console"
                                title="Execution output"
                                description="Retained for debugging alongside the structured dashboard."
                            >
                                <div className="mb-4 flex flex-wrap gap-2">
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
                                        onClick={() => handleCopyRawOutput(report.rawOutput)}
                                        className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-zinc-400 hover:text-zinc-950"
                                    >
                                        {rawOutputCopyLabel}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleExportHtmlReport(report, result.runId)}
                                        className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-zinc-400 hover:text-zinc-950"
                                    >
                                        {htmlReportExportLabel}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleExportRawOutput(report.rawOutput)}
                                        className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-zinc-400 hover:text-zinc-950"
                                    >
                                        {rawOutputExportLabel}
                                    </button>
                                </div>
                                <pre className="overflow-x-auto rounded-2xl border border-zinc-200 bg-zinc-950 px-4 py-4 font-mono text-xs leading-6 text-zinc-200 whitespace-pre-wrap">
                                    {report.rawOutput}
                                </pre>
                            </ReportPanel>
    );
}
