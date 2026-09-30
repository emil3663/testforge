import { useEffect, useRef } from "react";
import { Spinner } from "@/app/_components/Spinner";
import { livePlannedExecutionStatusClasses, livePlannedExecutionStatusLabel, toSentenceCase } from "@/app/_lib/format";
import { formatMilliseconds } from "@/lib/report/text";
import type { BusyInspectionTarget, RunLifecycleStatus, RunProgressSnapshot } from "@/app/_lib/types";

interface RunProgressOverlayProps {
    isRunning: boolean;
    isGenerating: boolean;
    isCancellingRun: boolean;
    busyLabel: string;
    activeRunProgress: RunProgressSnapshot | null;
    runStatus: RunLifecycleStatus | null;
    runCompletedTests: number;
    runTotalTests: number;
    runProgressPercent: number;
    runElapsedLabel: string;
    runRemainingLabel: string;
    handleStopRun: () => void;
    activeRunId: string | null;
    busyInspectionTargetsPreview: BusyInspectionTarget[];
    remainingBusyInspectionTargets: BusyInspectionTarget[];
    isBusyTargetListExpanded: boolean;
    setIsBusyTargetListExpanded: (updater: (value: boolean) => boolean) => void;
}

export function RunProgressOverlay({
    isRunning,
    isGenerating,
    isCancellingRun,
    busyLabel,
    activeRunProgress,
    runStatus,
    runCompletedTests,
    runTotalTests,
    runProgressPercent,
    runElapsedLabel,
    runRemainingLabel,
    handleStopRun,
    activeRunId,
    busyInspectionTargetsPreview,
    remainingBusyInspectionTargets,
    isBusyTargetListExpanded,
    setIsBusyTargetListExpanded,
}: RunProgressOverlayProps) {
    const activeRunPlannedExecutions = activeRunProgress?.plannedExecutions ?? [];
    const focusedPlannedExecutionId = activeRunPlannedExecutions.find((execution) => execution.status === "running")?.id ?? null;
    const plannedExecutionListRef = useRef<HTMLDivElement>(null);
    const plannedExecutionItemRefs = useRef<Record<string, HTMLDivElement | null>>({});

    useEffect(() => {
        if (!focusedPlannedExecutionId) {
            return;
        }

        const activeRow = plannedExecutionItemRefs.current[focusedPlannedExecutionId];
        if (!activeRow) {
            return;
        }

        activeRow.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    }, [focusedPlannedExecutionId, activeRunProgress?.completedTests]);

    return (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/35 px-6 backdrop-blur-sm">
                    <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white/95 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
                        <div>
                            <div className="flex items-center gap-3">
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-[0_12px_32px_rgba(79,70,229,0.28)]">
                                    <Spinner />
                                </div>
                                <div>
                                    <div className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">
                                        {isGenerating ? "Generating" : "Running"}
                                    </div>
                                    <div className="mt-1 text-lg font-semibold text-zinc-950">
                                        {busyLabel}
                                    </div>
                                </div>
                            </div>
                            <p className="mt-4 text-sm leading-6 text-zinc-500">
                                {isGenerating
                                    ? "TestForge is inspecting the requested pages and translating the results into concrete Playwright assertions."
                                    : isCancellingRun
                                        ? "TestForge is stopping the running suite and preserving the latest available execution state."
                                        : "TestForge is executing the generated suite and collecting structured reporting data."}
                            </p>
                        </div>
                        {isRunning ? (
                            <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-xs leading-5 text-zinc-600">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="font-semibold text-zinc-800">Overall progress</div>
                                        <div className="mt-1 text-zinc-500">
                                            {runCompletedTests} of {runTotalTests || activeRunProgress?.startedTests || 0} tests finished
                                            {runStatus ? ` · ${runStatus === "empty" ? "Nothing to run" : toSentenceCase(runStatus)}` : ""}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleStopRun}
                                        disabled={!activeRunId || isCancellingRun}
                                        className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {isCancellingRun ? "Stopping..." : "Stop run"}
                                    </button>
                                </div>

                                <div>
                                    <div className="mb-3 grid grid-cols-2 gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] sm:grid-cols-4">
                                        <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2 text-emerald-700">
                                            <span>Passed</span>
                                            <span className="text-base font-semibold">{activeRunProgress?.passedTests ?? 0}</span>
                                        </div>
                                        <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2 text-rose-700">
                                            <span>Failed</span>
                                            <span className="text-base font-semibold">{activeRunProgress?.failedTests ?? 0}</span>
                                        </div>
                                        <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2 text-amber-600">
                                            <span>Flaky</span>
                                            <span className="text-base font-semibold">{activeRunProgress?.flakyTests ?? 0}</span>
                                        </div>
                                        <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-700">
                                            <span>Blocked</span>
                                            <span className="text-base font-semibold">{activeRunProgress?.blockedTests ?? 0}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                        <span>Suite completion</span>
                                        <span>{runProgressPercent}%</span>
                                    </div>
                                    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-zinc-200">
                                        <div
                                            className="h-full rounded-full bg-indigo-500 transition-[width] duration-300"
                                            style={{ width: `${runProgressPercent}%` }}
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-2 sm:grid-cols-2">
                                    <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2">
                                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Elapsed</div>
                                        <div className="mt-1 text-base font-semibold text-zinc-900">{runElapsedLabel}</div>
                                    </div>
                                    <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2">
                                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Projected remaining</div>
                                        <div className="mt-1 text-base font-semibold text-zinc-900">{runRemainingLabel}</div>
                                    </div>
                                </div>

                                {activeRunPlannedExecutions.length > 0 ? (
                                    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-zinc-200 bg-white px-3 py-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="font-semibold text-zinc-800">Planned tests in this run</div>
                                            <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                                                {activeRunPlannedExecutions.length} total
                                            </div>
                                        </div>
                                        <div className="mt-1 text-[11px] leading-5 text-zinc-500">
                                            These are the exact test titles queued for the current run, shown in execution order.
                                        </div>
                                        <div ref={plannedExecutionListRef} className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                                            {activeRunPlannedExecutions.map((execution, index) => (
                                                <div
                                                    key={execution.id}
                                                    ref={(element) => {
                                                        plannedExecutionItemRefs.current[execution.id] = element;
                                                    }}
                                                    className={`flex items-start justify-between gap-3 rounded-xl border px-3 py-2 transition ${execution.id === focusedPlannedExecutionId
                                                        ? "border-indigo-300 bg-indigo-50 shadow-sm"
                                                        : "border-zinc-200 bg-zinc-50"
                                                        }`}
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <div className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${execution.id === focusedPlannedExecutionId ? "text-indigo-600" : "text-zinc-500"}`}>
                                                            Test {index + 1}
                                                        </div>
                                                        <div className="mt-1 break-words text-sm font-medium text-zinc-900">
                                                            {execution.title}
                                                        </div>
                                                    </div>
                                                    <span
                                                        className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${livePlannedExecutionStatusClasses(execution.status)}`}
                                                    >
                                                        {livePlannedExecutionStatusLabel(execution.status)}
                                                    </span>
                                                    <span className="inline-flex shrink-0 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-700">
                                                        {execution.duration !== null ? formatMilliseconds(execution.duration) : "--"}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        ) : (
                            <div className="mt-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-xs leading-5 text-zinc-600">
                                <div className="font-semibold text-zinc-800">Selected pages under test</div>
                                <div className="mt-3 space-y-2">
                                    {busyInspectionTargetsPreview.map((target) => (
                                        <div
                                            key={target.url}
                                            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 break-all"
                                        >
                                            {target.title ? (
                                                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                                    <span className="font-semibold text-zinc-800">{target.title}</span>
                                                    <span className="text-zinc-500">{target.url}</span>
                                                </div>
                                            ) : (
                                                target.url
                                            )}
                                        </div>
                                    ))}
                                </div>
                                {remainingBusyInspectionTargets.length > 0 && (
                                    <div className="mt-3">
                                        <button
                                            type="button"
                                            onClick={() => setIsBusyTargetListExpanded((value) => !value)}
                                            className="text-xs font-semibold text-indigo-600 transition hover:text-indigo-700"
                                        >
                                            {isBusyTargetListExpanded
                                                ? `Hide ${remainingBusyInspectionTargets.length} more page${remainingBusyInspectionTargets.length === 1 ? "" : "s"}`
                                                : `Show ${remainingBusyInspectionTargets.length} more page${remainingBusyInspectionTargets.length === 1 ? "" : "s"}`}
                                        </button>
                                        {isBusyTargetListExpanded && (
                                            <div className="mt-2 space-y-2">
                                                {remainingBusyInspectionTargets.map((target) => (
                                                    <div
                                                        key={target.url}
                                                        className="rounded-xl border border-zinc-200 bg-white px-3 py-2 break-all"
                                                    >
                                                        {target.title ? (
                                                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                                                <span className="font-semibold text-zinc-800">{target.title}</span>
                                                                <span className="text-zinc-500">{target.url}</span>
                                                            </div>
                                                        ) : (
                                                            target.url
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
    );
}
