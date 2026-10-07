import { CollapsibleSection } from "@/app/_components/CollapsibleSection";
import { ComprehensiveReportView } from "@/app/_components/ComprehensiveReportView";
import { PageTypesPanel } from "@/app/_components/PageTypesPanel";
import { CoverageTab } from "@/app/_components/CoverageTab";
import { DefectsTab } from "@/app/_components/DefectsTab";
import { DonutChart } from "@/app/_components/DonutChart";
import { ExecutionOutputSection } from "@/app/_components/ExecutionOutputSection";
import { ExecutionTab } from "@/app/_components/ExecutionTab";
import { LegendRow } from "@/app/_components/LegendRow";
import { MetricCard } from "@/app/_components/MetricCard";
import { PerformanceTab } from "@/app/_components/PerformanceTab";
import { RawConsolePanel } from "@/app/_components/RawConsolePanel";
import { SeoTab } from "@/app/_components/SeoTab";
import { SeverityBar } from "@/app/_components/SeverityBar";
import { SummaryTab } from "@/app/_components/SummaryTab";
import { UsabilityTab } from "@/app/_components/UsabilityTab";
import { toSentenceCase } from "@/app/_lib/format";
import type { ExecutionRecord, ExecutionStatus, RunReport, SeoPageGroup, SeoRecommendation } from "@/lib/report/types";
import type { ReportTab, RunResult } from "@/app/_lib/types";
import { formatNotRunByGate, noTestRan } from "@/lib/report/summary";

interface ReportSectionProps {
    result: RunResult;
    report: RunReport | undefined;
    isReportCollapsed: boolean;
    setIsReportCollapsed: (updater: (value: boolean) => boolean) => void;
    defectSeverityMax: number;
    reportTabs: ReportTab[];
    activeTab: ReportTab;
    setActiveTab: (tab: ReportTab) => void;
    statusFilter: "All" | ExecutionStatus;
    setStatusFilter: (status: "All" | ExecutionStatus) => void;
    rerunnableFailedTitles: string[];
    selectedRerunnableFailedTitles: string[];
    handleRerunFailedTitles: (titles: string[]) => void;
    isRunning: boolean;
    canGenerateOrRun: boolean;
    setSelectedFailedRerunTitles: (titles: string[]) => void;
    toggleFailedRerunTitle: (title: string) => void;
    filteredExecution: ExecutionRecord[];
    seoPageGroups: SeoPageGroup[];
    selectedSeoPageGroup: SeoPageGroup | null;
    setSelectedSeoPageKey: (key: string) => void;
    selectedSeoRecommendations: SeoRecommendation[];
    handleContinueRun: () => void;
    hasCode: boolean;
    isContentAwareReady: boolean;
    isPracticeSelectionReady: boolean;
    canContinueCancelledRun: boolean;
    handleCopyRawOutput: (rawOutput: string) => void;
    handleExportHtmlReport: (report: RunReport, runId: string) => void;
    handleExportRawOutput: (rawOutput: string) => void;
    rawOutputCopyLabel: string;
    htmlReportExportLabel: string;
    rawOutputExportLabel: string;
}

export function ReportSection({
    result,
    report,
    isReportCollapsed,
    setIsReportCollapsed,
    defectSeverityMax,
    reportTabs,
    activeTab,
    setActiveTab,
    statusFilter,
    setStatusFilter,
    rerunnableFailedTitles,
    selectedRerunnableFailedTitles,
    handleRerunFailedTitles,
    isRunning,
    canGenerateOrRun,
    setSelectedFailedRerunTitles,
    toggleFailedRerunTitle,
    filteredExecution,
    seoPageGroups,
    selectedSeoPageGroup,
    setSelectedSeoPageKey,
    selectedSeoRecommendations,
    handleContinueRun,
    hasCode,
    isContentAwareReady,
    isPracticeSelectionReady,
    canContinueCancelledRun,
    handleCopyRawOutput,
    handleExportHtmlReport,
    handleExportRawOutput,
    rawOutputCopyLabel,
    htmlReportExportLabel,
    rawOutputExportLabel,
}: ReportSectionProps) {
    return (
                result && report?.comprehensive ? (
                    // Phase 35 (TFP-132): a Comprehensive run's report shows its area only.
                    <CollapsibleSection
                        title="Test Reports"
                        subtitle={`${report.comprehensive.label}: this area only.`}
                        collapsed={isReportCollapsed}
                        onToggle={() => setIsReportCollapsed((value) => !value)}
                    >
                        <div className="space-y-6">
                            <ComprehensiveReportView report={report.comprehensive} />
                            <RawConsolePanel
                                result={result}
                                report={report}
                                handleContinueRun={handleContinueRun}
                                hasCode={hasCode}
                                isRunning={isRunning}
                                isContentAwareReady={isContentAwareReady}
                                isPracticeSelectionReady={isPracticeSelectionReady}
                                canGenerateOrRun={canGenerateOrRun}
                                canContinueCancelledRun={canContinueCancelledRun}
                                handleCopyRawOutput={handleCopyRawOutput}
                                rawOutputCopyLabel={rawOutputCopyLabel}
                                handleExportHtmlReport={handleExportHtmlReport}
                                htmlReportExportLabel={htmlReportExportLabel}
                                handleExportRawOutput={handleExportRawOutput}
                                rawOutputExportLabel={rawOutputExportLabel}
                            />
                            <PageTypesPanel report={report} />
                        </div>
                    </CollapsibleSection>
                ) : result && report ? (
                    <CollapsibleSection
                        title="Test Reports"
                        subtitle="Review the structured Allure-inspired report from the latest execution."
                        collapsed={isReportCollapsed}
                        onToggle={() => setIsReportCollapsed((value) => !value)}
                    >
                        <div className="space-y-6">
                            <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
                                <div className="rounded-[28px] border border-indigo-100 bg-[linear-gradient(135deg,rgba(79,70,229,0.08),rgba(14,165,233,0.08),rgba(255,255,255,0.8))] p-6">
                                    <div className="flex flex-wrap items-start justify-between gap-4">
                                        <div>
                                            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-600">
                                                Test Summary Report
                                            </div>
                                            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">
                                                Release readiness at a glance
                                            </h2>
                                            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
                                                An Allure-inspired executive summary of the current test cycle,
                                                including recommendation, defect distribution, and execution trends.
                                            </p>
                                        </div>
                                        <span
                                            className={`rounded-full border px-3 py-1 text-xs font-semibold ${result.runStatus === "cancelled"
                                                ? "border-amber-200 bg-amber-50 text-amber-800"
                                                : noTestRan(report.summary)
                                                    ? "border-zinc-200 bg-zinc-50 text-zinc-700"
                                                : result.passed
                                                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                                    : "border-rose-200 bg-rose-50 text-rose-800"
                                                }`}
                                        >
                                            {result.runStatus === "cancelled"
                                                ? "Run stopped before completion"
                                                : report.summary.releaseRecommendation}
                                        </span>
                                    </div>
                                    {report.summary.notRunNote ? (
                                        <p className="mt-2 text-sm text-zinc-600">{report.summary.notRunNote}</p>
                                    ) : null}
                                    {formatNotRunByGate(report.summary) ? (
                                        <p className="mt-1 text-sm text-zinc-600">{formatNotRunByGate(report.summary)}</p>
                                    ) : null}

                                    <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                                        <MetricCard
                                            label="Planned"
                                            value={report.summary.planned}
                                            caption="test cases in scope"
                                        />
                                        <MetricCard
                                            label="Executed"
                                            value={report.summary.executed}
                                            caption="tests actually run"
                                        />
                                        <MetricCard
                                            label="Passed"
                                            value={report.summary.passed + report.summary.flaky}
                                            caption="including flaky recoveries"
                                        />
                                        <MetricCard
                                            label="Failed"
                                            value={report.summary.failed}
                                            caption="critical release blockers"
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                                    <div className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
                                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                                            Pass/Fail Ratio
                                        </div>
                                        <div className="mt-4 flex items-center gap-4">
                                            <DonutChart
                                                passed={report.summary.passFailRatio.passed}
                                                failed={report.summary.passFailRatio.failed}
                                            />
                                            <div className="space-y-2 text-sm text-zinc-600">
                                                <LegendRow color="bg-emerald-500" label="Passed / Flaky" value={report.summary.passFailRatio.passed} />
                                                <LegendRow color="bg-rose-500" label="Failed / Blocked" value={report.summary.passFailRatio.failed} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
                                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                                            Defect Severity
                                        </div>
                                        <div className="mt-4 space-y-3 text-sm text-zinc-600">
                                            <SeverityBar
                                                label="Critical"
                                                value={report.summary.defectDistribution.Critical}
                                                maxValue={defectSeverityMax}
                                                color="bg-rose-600"
                                            />
                                            <SeverityBar
                                                label="Major"
                                                value={report.summary.defectDistribution.Major}
                                                maxValue={defectSeverityMax}
                                                color="bg-amber-500"
                                            />
                                            <SeverityBar
                                                label="Minor"
                                                value={report.summary.defectDistribution.Minor}
                                                maxValue={defectSeverityMax}
                                                color="bg-sky-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-2">
                                {reportTabs.map((tab) => (
                                    <button
                                        key={tab}
                                        type="button"
                                        onClick={() => setActiveTab(tab)}
                                        className={`rounded-xl px-3 py-2 text-sm font-medium transition ${activeTab === tab
                                            ? "bg-white text-zinc-950 shadow-sm"
                                            : "text-zinc-500 hover:text-zinc-900"
                                            }`}
                                    >
                                        {toSentenceCase(tab)}
                                    </button>
                                ))}
                            </div>

                            {activeTab === "summary" && report && (
                                <SummaryTab report={report} />
                            )}

                            {activeTab === "execution" && (
                                <ExecutionTab
                                    statusFilter={statusFilter}
                                    setStatusFilter={setStatusFilter}
                                    rerunnableFailedTitles={rerunnableFailedTitles}
                                    selectedRerunnableFailedTitles={selectedRerunnableFailedTitles}
                                    handleRerunFailedTitles={handleRerunFailedTitles}
                                    isRunning={isRunning}
                                    canGenerateOrRun={canGenerateOrRun}
                                    setSelectedFailedRerunTitles={setSelectedFailedRerunTitles}
                                    filteredExecution={filteredExecution}
                                    toggleFailedRerunTitle={toggleFailedRerunTitle}
                                />
                            )}

                            {activeTab === "defects" && report && (
                                <DefectsTab report={report} />
                            )}

                            {activeTab === "coverage" && report && (
                                <CoverageTab report={report} />
                            )}

                            {activeTab === "performance" && report && (
                                <PerformanceTab report={report} />
                            )}

                            {activeTab === "usability" && report && (
                                <UsabilityTab report={report} />
                            )}

                            {activeTab === "seo" && report && report.seo && (
                                <SeoTab
                                    report={report}
                                    seoPageGroups={seoPageGroups}
                                    selectedSeoPageGroup={selectedSeoPageGroup}
                                    setSelectedSeoPageKey={setSelectedSeoPageKey}
                                    selectedSeoRecommendations={selectedSeoRecommendations}
                                />
                            )}

                            {report && (
                                <RawConsolePanel
                                    result={result}
                                    report={report}
                                    handleContinueRun={handleContinueRun}
                                    hasCode={hasCode}
                                    isRunning={isRunning}
                                    isContentAwareReady={isContentAwareReady}
                                    isPracticeSelectionReady={isPracticeSelectionReady}
                                    canGenerateOrRun={canGenerateOrRun}
                                    canContinueCancelledRun={canContinueCancelledRun}
                                    handleCopyRawOutput={handleCopyRawOutput}
                                    rawOutputCopyLabel={rawOutputCopyLabel}
                                    handleExportHtmlReport={handleExportHtmlReport}
                                    htmlReportExportLabel={htmlReportExportLabel}
                                    handleExportRawOutput={handleExportRawOutput}
                                    rawOutputExportLabel={rawOutputExportLabel}
                                />
                            )}
                            {report && <PageTypesPanel report={report} />}
                        </div>
                    </CollapsibleSection>
                ) : result ? (
                    <ExecutionOutputSection
                        result={result}
                        isReportCollapsed={isReportCollapsed}
                        setIsReportCollapsed={setIsReportCollapsed}
                        handleContinueRun={handleContinueRun}
                        hasCode={hasCode}
                        isRunning={isRunning}
                        isContentAwareReady={isContentAwareReady}
                        isPracticeSelectionReady={isPracticeSelectionReady}
                        canGenerateOrRun={canGenerateOrRun}
                        canContinueCancelledRun={canContinueCancelledRun}
                        handleCopyRawOutput={handleCopyRawOutput}
                        rawOutputCopyLabel={rawOutputCopyLabel}
                        handleExportRawOutput={handleExportRawOutput}
                        rawOutputExportLabel={rawOutputExportLabel}
                    />
                ) : null
    );
}
