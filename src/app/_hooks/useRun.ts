import { useEffect, useRef, useState } from "react";
import { buildReportHtmlDocument, buildResultHtmlDocument } from "@/lib/report/html";
import type { ExecutionStatus, RunReport } from "@/lib/report/types";
import { BASE_REPORT_TABS } from "@/app/_lib/constants";
import { getContinuationExcludedTitles } from "@/app/_lib/derive";
import { pollRunUntilDone } from "@/app/_hooks/pollRun";
import type { ContentProfile, ReportTab, RunLifecycleStatus, RunProgressSnapshot, RunResult, RunStatusSnapshot, Step, TestAuditMode } from "@/app/_lib/types";

interface StartRunParams {
    code: string;
    selectedPractices: string[];
    auditMode: TestAuditMode;
    baseUrl: string;
    description?: string;
    excludeTestTitles?: string[];
    includeTestTitles?: string[];
    contentProfile?: ContentProfile | null;
}

export function useRun(
    step: Step,
    setStep: (step: Step) => void,
    setError: (message: string) => void,
    setIsCreationCollapsed: (value: boolean) => void,
    setIsGeneratedCollapsed: (value: boolean) => void
) {
    const [result, setResult] = useState<RunResult | null>(null);
    const [rawOutputCopyLabel, setRawOutputCopyLabel] = useState("Copy raw output");
    const [rawOutputExportLabel, setRawOutputExportLabel] = useState("Export raw output");
    const [htmlReportExportLabel, setHtmlReportExportLabel] = useState("Save report as HTML");
    const [reportPopupNotice, setReportPopupNotice] = useState("");
    const [activeTab, setActiveTab] = useState<ReportTab>("summary");
    const [openReportInNewPage, setOpenReportInNewPage] = useState(false);
    const [selectedSeoPageKey, setSelectedSeoPageKey] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<"All" | ExecutionStatus>("All");
    const [selectedFailedRerunTitles, setSelectedFailedRerunTitles] = useState<string[]>([]);
    const [activeRunId, setActiveRunId] = useState<string | null>(null);
    const [runProgress, setRunProgress] = useState<RunProgressSnapshot | null>(null);
    const [runStatus, setRunStatus] = useState<RunLifecycleStatus | null>(null);
    const [runDurationMs, setRunDurationMs] = useState(0);
    const [isCancellingRun, setIsCancellingRun] = useState(false);
    const [isReportCollapsed, setIsReportCollapsed] = useState(false);
    const [isBusyTargetListExpanded, setIsBusyTargetListExpanded] = useState(false);
    const autoOpenedReportRunIdRef = useRef<string | null>(null);
    const reportWindowRef = useRef<Window | null>(null);

    useEffect(() => {
        if (step !== "running" || !activeRunId) {
            return;
        }

        let ignore = false;
        let timer: number | null = null;

        const sleep = (ms: number) =>
            new Promise<void>((resolve) => {
                timer = window.setTimeout(() => {
                    timer = null;
                    resolve();
                }, ms);
            });

        void pollRunUntilDone(activeRunId, {
            // Passing the bare `fetch` reference detaches it from `window`,
            // and native browser fetch throws "Illegal invocation" when
            // called without that `this` binding - wrap it instead.
            fetchImpl: (input, init) => fetch(input, init),
            sleep,
            isCancelled: () => ignore,
            onSnapshot: (snapshot) => {
                setRunProgress(snapshot.progress);
                setRunStatus(snapshot.runStatus);
                setRunDurationMs(snapshot.duration);
                setIsCancellingRun(snapshot.cancellationRequested);
            },
            onResult: (result) => {
                setResult(result);
                setStep("done");
                setActiveRunId(null);
                setIsCancellingRun(false);
            },
            onTerminalWithoutResult: () => {
                setError("Run reached a terminal status without a result. Check the server logs.");
                setStep("ready");
                setActiveRunId(null);
                setRunProgress(null);
                setRunStatus(null);
                setRunDurationMs(0);
                setIsCancellingRun(false);
            },
            onFailure: (message) => {
                setError(message);
                setStep("ready");
                setActiveRunId(null);
                setRunProgress(null);
                setRunStatus(null);
                setRunDurationMs(0);
                setIsCancellingRun(false);
            },
        });

        return () => {
            ignore = true;
            if (timer !== null) {
                window.clearTimeout(timer);
            }
        };
    }, [activeRunId, step, setError, setStep]);

    useEffect(() => {
        const pageGroups = result?.report?.seo?.pageGroups ?? [];
        if (pageGroups.length === 0) {
            if (selectedSeoPageKey !== null) {
                setSelectedSeoPageKey(null);
            }
            return;
        }

        if (!selectedSeoPageKey || !pageGroups.some((group) => group.pageKey === selectedSeoPageKey)) {
            setSelectedSeoPageKey(pageGroups[0].pageKey);
        }
    }, [result, selectedSeoPageKey]);

    useEffect(() => {
        if (!openReportInNewPage || !result) {
            return;
        }

        const hasCompletedPlannedTests =
            result.progress.totalTests === 0 ||
            result.progress.completedTests >= result.progress.totalTests;

        if (result.runStatus === "cancelled" || !hasCompletedPlannedTests) {
            return;
        }

        if (autoOpenedReportRunIdRef.current === result.runId) {
            return;
        }

        autoOpenedReportRunIdRef.current = result.runId;
        const blob = new Blob([buildResultHtmlDocument(result)], { type: "text/html;charset=utf-8" });
        const objectUrl = URL.createObjectURL(blob);
        const openedWindow = reportWindowRef.current && !reportWindowRef.current.closed
            ? reportWindowRef.current
            : window.open("about:blank", "_blank");

        if (!openedWindow) {
            setReportPopupNotice("Your browser blocked the report page. The latest results will stay embedded below.");
            URL.revokeObjectURL(objectUrl);
            return;
        }

        setReportPopupNotice("");
        openedWindow.location.href = objectUrl;
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    }, [openReportInNewPage, result]);

    async function startRun({ code, selectedPractices, auditMode, baseUrl, description = "", excludeTestTitles = [], includeTestTitles = [], contentProfile = null }: StartRunParams) {
        if (selectedPractices.length === 0) {
            setError("Select at least one best-practice area before running tests.");
            return;
        }

        if (!openReportInNewPage) {
            reportWindowRef.current = null;
        }
        setReportPopupNotice("");

        setStep("running");
        setResult(null);
        setError("");
        setActiveTab("summary");
        setStatusFilter("All");
        setSelectedFailedRerunTitles([]);
        setIsBusyTargetListExpanded(false);
        setActiveRunId(null);
        setRunProgress(null);
        setRunStatus("running");
        setRunDurationMs(0);
        setIsCancellingRun(false);
        setIsCreationCollapsed(true);
        setIsGeneratedCollapsed(true);
        setIsReportCollapsed(false);

        try {
            const res = await fetch("/api/run", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    code,
                    selectedPractices,
                    auditMode,
                    baseUrl,
                    description,
                    excludeTestTitles,
                    includeTestTitles,
                    contentProfile,
                }),
            });
            const data = (await res.json()) as RunStatusSnapshot | { error?: string };
            if (!res.ok) {
                throw new Error("error" in data ? data.error ?? "Run failed" : "Run failed");
            }
            const snapshot = data as RunStatusSnapshot;
            setActiveRunId(snapshot.runId);
            setRunProgress(snapshot.progress);
            setRunStatus(snapshot.runStatus);
            setRunDurationMs(snapshot.duration);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Unknown error");
            setStep("ready");
            if (reportWindowRef.current && !reportWindowRef.current.closed) {
                reportWindowRef.current.close();
            }
            reportWindowRef.current = null;
            setReportPopupNotice("");
        }
    }

    async function handleRun(params: Omit<StartRunParams, "excludeTestTitles" | "includeTestTitles">) {
        await startRun(params);
    }

    async function handleContinueRun(params: Omit<StartRunParams, "excludeTestTitles" | "includeTestTitles">) {
        const excludedTitles = continuationExcludedTitles;

        if (excludedTitles.length === 0) {
            setError("There are no completed test results available to continue from.");
            return;
        }

        await startRun({ ...params, excludeTestTitles: excludedTitles });
    }

    function toggleFailedRerunTitle(title: string) {
        setSelectedFailedRerunTitles((current) =>
            current.includes(title)
                ? current.filter((item) => item !== title)
                : [...current, title]
        );
    }

    async function handleRerunFailedTitles(titles: string[], params: Omit<StartRunParams, "excludeTestTitles" | "includeTestTitles">) {
        const uniqueTitles = [...new Set(titles.filter((title) => title.trim().length > 0))];

        if (uniqueTitles.length === 0) {
            setError("Select at least one failed test before rerunning.");
            return;
        }

        await startRun({ ...params, includeTestTitles: uniqueTitles });
    }

    async function handleStopRun() {
        if (!activeRunId || isCancellingRun) {
            return;
        }

        setIsCancellingRun(true);

        try {
            const response = await fetch("/api/run", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ runId: activeRunId }),
            });
            const data = (await response.json()) as RunStatusSnapshot | { error?: string };

            if (!response.ok) {
                throw new Error("error" in data ? data.error ?? "Unable to stop run" : "Unable to stop run");
            }

            const snapshot = data as RunStatusSnapshot;
            setRunProgress(snapshot.progress);
            setRunStatus(snapshot.runStatus);
            setRunDurationMs(snapshot.duration);
            setIsCancellingRun(snapshot.cancellationRequested);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Unable to stop run");
            setIsCancellingRun(false);
        }
    }

    async function handleCopyRawOutput(rawOutput: string) {
        if (!rawOutput.trim()) {
            return;
        }

        try {
            await navigator.clipboard.writeText(rawOutput);
            setRawOutputCopyLabel("Raw output copied");
            setTimeout(() => setRawOutputCopyLabel("Copy raw output"), 2000);
        } catch {
            setRawOutputCopyLabel("Copy failed");
            setTimeout(() => setRawOutputCopyLabel("Copy raw output"), 2000);
        }
    }

    function handleExportRawOutput(rawOutput: string) {
        if (!rawOutput.trim()) {
            return;
        }

        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const fileName = `testforge-raw-output-${timestamp}.txt`;
            const blob = new Blob([rawOutput], { type: "text/plain;charset=utf-8" });
            const objectUrl = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = objectUrl;
            anchor.download = fileName;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            URL.revokeObjectURL(objectUrl);
            setRawOutputExportLabel("Raw output exported");
            setTimeout(() => setRawOutputExportLabel("Export raw output"), 2000);
        } catch {
            setRawOutputExportLabel("Export failed");
            setTimeout(() => setRawOutputExportLabel("Export raw output"), 2000);
        }
    }

    async function handleExportHtmlReport(report: RunReport, runId: string) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const fileName = `testforge-report-${runId}-${timestamp}.html`;
            const blob = new Blob([buildReportHtmlDocument(report, runId)], { type: "text/html;charset=utf-8" });
            const objectUrl = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = objectUrl;
            anchor.download = fileName;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            URL.revokeObjectURL(objectUrl);
            setHtmlReportExportLabel("HTML report saved");
            setTimeout(() => setHtmlReportExportLabel("Save report as HTML"), 2000);
        } catch {
            setHtmlReportExportLabel("Save failed");
            setTimeout(() => setHtmlReportExportLabel("Save report as HTML"), 2000);
        }
    }

    const report = result?.report;
    const defectSeverityMax = report
        ? Math.max(
            report.summary.defectDistribution.Critical,
            report.summary.defectDistribution.Major,
            report.summary.defectDistribution.Minor,
            1,
        )
        : 1;
    const continuationExcludedTitles = getContinuationExcludedTitles(result);
    const hasPendingRunWork = Boolean(
        result && result.progress.completedTests < result.progress.totalTests
    );
    const hasSingleBrowserRun = result?.report
        ? result.report.summary.browsers.length === 1
        : true;
    const canContinueCancelledRun = Boolean(
        result?.runStatus === "cancelled" &&
        hasSingleBrowserRun &&
        continuationExcludedTitles.length > 0 &&
        hasPendingRunWork
    );
    const continueRunUnavailableMessage = result?.runStatus === "cancelled" && hasPendingRunWork && !canContinueCancelledRun
        ? !hasSingleBrowserRun
            ? "Continue remaining tests is only available for single-browser runs right now."
            : "Continue remaining tests needs at least one completed test from the stopped run."
        : "";
    const seoPageGroups = report?.seo?.pageGroups ?? [];
    const selectedSeoPageGroup = seoPageGroups.find((group) => group.pageKey === selectedSeoPageKey) ?? seoPageGroups[0] ?? null;
    const selectedSeoRecommendations = selectedSeoPageGroup
        ? report?.seo?.recommendations.filter(
            (recommendation) => !recommendation.pageKey || recommendation.pageKey === selectedSeoPageGroup.pageKey
        ) ?? []
        : report?.seo?.recommendations ?? [];
    const rerunnableFailedTitles = [...new Set(
        report?.execution
            .filter((record) => record.status === "Failed")
            .map((record) => record.title)
            .filter((title) => title.trim().length > 0) ?? []
    )];
    const selectedRerunnableFailedTitles = selectedFailedRerunTitles.filter((title) => rerunnableFailedTitles.includes(title));
    const reportTabs = report?.seo?.totalChecks
        ? [...BASE_REPORT_TABS, "seo" as const]
        : BASE_REPORT_TABS;
    const filteredExecution = report
        ? report.execution.filter((record) =>
            statusFilter === "All" ? true : record.status === statusFilter
        )
        : [];

    return {
        result,
        setResult,
        rawOutputCopyLabel,
        rawOutputExportLabel,
        htmlReportExportLabel,
        reportPopupNotice,
        setReportPopupNotice,
        activeTab,
        setActiveTab,
        openReportInNewPage,
        setOpenReportInNewPage,
        selectedSeoPageKey,
        setSelectedSeoPageKey,
        statusFilter,
        setStatusFilter,
        selectedFailedRerunTitles,
        setSelectedFailedRerunTitles,
        activeRunId,
        runProgress,
        runStatus,
        runDurationMs,
        isCancellingRun,
        isReportCollapsed,
        setIsReportCollapsed,
        isBusyTargetListExpanded,
        setIsBusyTargetListExpanded,
        reportWindowRef,
        report,
        defectSeverityMax,
        continuationExcludedTitles,
        hasPendingRunWork,
        hasSingleBrowserRun,
        canContinueCancelledRun,
        continueRunUnavailableMessage,
        seoPageGroups,
        selectedSeoPageGroup,
        selectedSeoRecommendations,
        rerunnableFailedTitles,
        selectedRerunnableFailedTitles,
        reportTabs,
        filteredExecution,
        handleRun,
        handleContinueRun,
        toggleFailedRerunTitle,
        handleRerunFailedTitles,
        handleStopRun,
        handleCopyRawOutput,
        handleExportRawOutput,
        handleExportHtmlReport,
    };
}
