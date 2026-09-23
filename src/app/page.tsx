"use client";

import { useState } from "react";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, getSiteUrl } from "@/lib/seo";
import { CreationSection } from "@/app/_components/CreationSection";
import { GeneratedSuiteSection } from "@/app/_components/GeneratedSuiteSection";
import { HelpPanel } from "@/app/_components/HelpPanel";
import { ReportSection } from "@/app/_components/ReportSection";
import { RunProgressOverlay } from "@/app/_components/RunProgressOverlay";
import { useCrawl } from "@/app/_hooks/useCrawl";
import { useGeneration } from "@/app/_hooks/useGeneration";
import { useRun } from "@/app/_hooks/useRun";
import { DEFAULT_BASE_URL, DEFAULT_DESCRIPTION_EXAMPLE, DEFAULT_TEST_AUDIT_MODE } from "@/app/_lib/constants";
import {
    buildSelectedPracticeDescription,
    deriveBusyInspectionTargets,
    deriveContentInsights,
    deriveRunProgressDisplay,
    inferBestPracticesFromDescription,
    normalizeBaseUrl,
    normalizeInspectionPaths,
    parseContentLines,
} from "@/app/_lib/derive";
import type { BestPracticeArea, Step } from "@/app/_lib/types";

const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web",
    url: getSiteUrl(),
    featureList: [
        "Plain-English Playwright test generation",
        "Crawl-aware page selection",
        "Content-aware assertions",
        "Structured regression reporting",
    ],
};

export default function Home() {
    const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
    const [isBaseUrlPlaceholderActive, setIsBaseUrlPlaceholderActive] = useState(true);
    const [description, setDescription] = useState(DEFAULT_DESCRIPTION_EXAMPLE);
    const [isDescriptionPlaceholderActive, setIsDescriptionPlaceholderActive] = useState(true);
    const [selectedPractices, setSelectedPractices] = useState<BestPracticeArea[]>([]);
    const [deselectedPractices, setDeselectedPractices] = useState<BestPracticeArea[]>([]);
    const [step, setStep] = useState<Step>("idle");
    const [error, setError] = useState("");
    const [contentPathsInput, setContentPathsInput] = useState("");
    const [requiredHeadingsInput, setRequiredHeadingsInput] = useState("");
    const [requiredTextInput, setRequiredTextInput] = useState("");
    const [forbiddenTextInput, setForbiddenTextInput] = useState("");
    const [auditMode, setAuditMode] = useState(DEFAULT_TEST_AUDIT_MODE);
    const [isCreationCollapsed, setIsCreationCollapsed] = useState(false);
    const [isContentRulesCollapsed, setIsContentRulesCollapsed] = useState(true);
    const [isHelpPanelOpen, setIsHelpPanelOpen] = useState(false);

    const crawl = useCrawl(baseUrl);
    const generation = useGeneration(DEFAULT_BASE_URL, DEFAULT_TEST_AUDIT_MODE);
    const run = useRun(step, setStep, setError, setIsCreationCollapsed, generation.setIsGeneratedCollapsed);

    function togglePractice(
        practice: BestPracticeArea,
        inferredPractices: BestPracticeArea[],
        effectiveSelectedPractices: BestPracticeArea[]
    ) {
        const isInferred = inferredPractices.includes(practice);
        const isSelected = effectiveSelectedPractices.includes(practice);

        if (isSelected) {
            setSelectedPractices((current) => current.filter((item) => item !== practice));
            setDeselectedPractices((current) =>
                current.includes(practice) ? current : [...current, practice]
            );
            return;
        }

        setDeselectedPractices((current) => current.filter((item) => item !== practice));

        if (!isInferred) {
            setSelectedPractices((current) =>
                current.includes(practice) ? current : [...current, practice]
            );
        }
    }

    function handleGenerate() {
        void generation.handleGenerate({
            baseUrl,
            effectiveSelectedPractices,
            isDescriptionPlaceholderActive,
            description,
            auditMode,
            contentPathsInput,
            requiredHeadingsInput,
            requiredTextInput,
            forbiddenTextInput,
            crawlResult: crawl.crawlResult,
            selectedCrawledPaths: crawl.selectedCrawledPaths,
            setCrawlError: crawl.setCrawlError,
            isBaseUrlPlaceholderActive,
            setBaseUrl,
            setIsBaseUrlPlaceholderActive,
            setStep,
            setError,
            setIsCreationCollapsed,
            setResult: run.setResult,
            setActiveTab: run.setActiveTab,
            setStatusFilter: run.setStatusFilter,
            setSelectedFailedRerunTitles: run.setSelectedFailedRerunTitles,
            setIsBusyTargetListExpanded: run.setIsBusyTargetListExpanded,
            setIsReportCollapsed: run.setIsReportCollapsed,
        });
    }

    const isGenerating = step === "generating";
    const isRunning = step === "running";
    const hasCode = step === "ready" || step === "done";
    const effectiveDescriptionText = isDescriptionPlaceholderActive ? "" : description;
    const inferredPractices = inferBestPracticesFromDescription(effectiveDescriptionText);
    const effectiveSelectedPractices: BestPracticeArea[] = [...new Set([...selectedPractices, ...(selectedPractices.length > 0 ? [] : inferredPractices)])]
        .filter((practice) => !deselectedPractices.includes(practice));
    const normalizedBaseUrlForDisplay = normalizeBaseUrl(baseUrl);
    const parsedDisplayPaths = parseContentLines(contentPathsInput).map((item) =>
        item.startsWith("/") ? item : `/${item}`
    );
    const effectiveInspectionPaths = normalizeInspectionPaths(
        normalizedBaseUrlForDisplay.ok ? normalizedBaseUrlForDisplay.value : DEFAULT_BASE_URL,
        parsedDisplayPaths,
        crawl.hasActiveCrawlSelection ? crawl.selectedCrawledPaths : []
    );
    const contentRules = {
        paths: effectiveInspectionPaths,
        requiredHeadings: parseContentLines(requiredHeadingsInput),
        requiredText: parseContentLines(requiredTextInput),
        forbiddenText: parseContentLines(forbiddenTextInput),
    };
    const contentAwareRequested =
        contentRules.requiredHeadings.length > 0 ||
        contentRules.requiredText.length > 0 ||
        contentRules.forbiddenText.length > 0 ||
        contentRules.paths.some((path) => path !== "/");
    const selectedPracticeSignature = JSON.stringify([...effectiveSelectedPractices].sort());
    const isContentAwareReady =
        !contentAwareRequested ||
        (generation.contentProfile !== null &&
            generation.lastGeneratedContentSignature === JSON.stringify({ contentRules, auditMode }) &&
            hasCode);
    const isPracticeSelectionReady = generation.lastGeneratedPracticeSignature === selectedPracticeSignature;
    const runBlockedMessage = !isContentAwareReady
        ? "Generate the suite again after completing the content-aware inputs before running it."
        : !isPracticeSelectionReady
            ? "Generate the suite again after changing the selected best-practice areas before running it."
            : "";
    const showBusyOverlay = isGenerating || isRunning;
    const normalizedBusyTarget = normalizeBaseUrl(baseUrl);
    const busyTarget = normalizedBusyTarget.ok
        ? normalizedBusyTarget.value
        : baseUrl.trim() || DEFAULT_BASE_URL;
    const busyBaseUrl = (isRunning ? generation.lastGeneratedBaseUrl : busyTarget) || DEFAULT_BASE_URL;
    const busyInspectionPaths = isRunning
        ? generation.lastGeneratedInspectionPaths
        : effectiveInspectionPaths;
    const busyLabel = isGenerating
        ? "Inspecting pages and generating tests..."
        : run.isCancellingRun
            ? "Stopping generated Playwright suite..."
            : "Running generated Playwright suite...";
    const activeRunProgress = isRunning ? run.runProgress : null;
    const canGenerateOrRun = effectiveSelectedPractices.length > 0;
    const contentInsights = deriveContentInsights(generation.contentProfile, auditMode);
    const { busyInspectionTargetsPreview, remainingBusyInspectionTargets } = deriveBusyInspectionTargets(
        isRunning,
        busyBaseUrl,
        busyInspectionPaths,
        generation.lastGeneratedInspectionTargets,
        crawl.crawlResult?.baseUrl,
        crawl.crawledPages
    );
    const { runTotalTests, runCompletedTests, runProgressPercent, runElapsedLabel, runRemainingLabel } = deriveRunProgressDisplay(
        activeRunProgress,
        run.runDurationMs,
        run.isCancellingRun
    );

    const runParams = {
        code: generation.editedCode,
        selectedPractices: effectiveSelectedPractices,
        auditMode: generation.lastGeneratedAuditMode,
        baseUrl: generation.lastGeneratedBaseUrl,
        description: (isDescriptionPlaceholderActive ? "" : description).trim() || buildSelectedPracticeDescription(effectiveSelectedPractices),
        contentProfile: generation.contentProfile,
    };
    const boundHandleRun = () => run.handleRun(runParams);
    const boundHandleContinueRun = () => run.handleContinueRun(runParams);
    const boundHandleRerunFailedTitles = (titles: string[]) => run.handleRerunFailedTitles(titles, runParams);
    const boundHandleSaveToExplorer = async () => {
        const effectiveDescription = (isDescriptionPlaceholderActive ? "" : description).trim() || buildSelectedPracticeDescription(effectiveSelectedPractices);
        const err = await generation.handleSaveToExplorer(effectiveDescription);
        if (err) {
            setError(err);
        }
    };

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.12),_transparent_32%),linear-gradient(180deg,#f7f8fc_0%,#f4f6fb_52%,#eef3f8_100%)] text-zinc-900">
            {showBusyOverlay && (
                <RunProgressOverlay
                    isRunning={isRunning}
                    isGenerating={isGenerating}
                    isCancellingRun={run.isCancellingRun}
                    busyLabel={busyLabel}
                    activeRunProgress={activeRunProgress}
                    runStatus={run.runStatus}
                    runCompletedTests={runCompletedTests}
                    runTotalTests={runTotalTests}
                    runProgressPercent={runProgressPercent}
                    runElapsedLabel={runElapsedLabel}
                    runRemainingLabel={runRemainingLabel}
                    handleStopRun={run.handleStopRun}
                    activeRunId={run.activeRunId}
                    busyInspectionTargetsPreview={busyInspectionTargetsPreview}
                    remainingBusyInspectionTargets={remainingBusyInspectionTargets}
                    isBusyTargetListExpanded={run.isBusyTargetListExpanded}
                    setIsBusyTargetListExpanded={run.setIsBusyTargetListExpanded}
                />
            )}
            <HelpPanel isOpen={isHelpPanelOpen} onClose={() => setIsHelpPanelOpen(false)} />
            <header className="border-b border-white/70 bg-white/80 backdrop-blur">
                <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-600 shadow-[0_10px_30px_rgba(79,70,229,0.25)]">
                        <svg
                            className="h-5 w-5 text-white"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />
                        </svg>
                    </div>
                    <div>
                        <div className="text-lg font-semibold tracking-tight">TestForge</div>
                        <div className="text-xs text-zinc-500">
                            AI-native test creation with structured quality reporting
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsHelpPanelOpen(true)}
                        aria-label="Help"
                        className="ml-auto flex h-9 w-9 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-sm font-semibold text-indigo-600 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50"
                    >
                        ?
                    </button>
                </div>
            </header>

            <main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10">
                <script
                    type="application/ld+json"
                    suppressHydrationWarning
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
                />
                <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
                    <div className="max-w-3xl">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-600">
                            AI-native QA workflow
                        </p>
                        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
                            Generate Playwright test suites from plain-English quality goals.
                        </h1>
                        <p className="mt-4 text-sm leading-7 text-zinc-600 sm:text-base">
                            {SITE_TAGLINE}. Describe the target, inspect discovered pages and links, review the generated suite, and run it with structured reports before shipping.
                        </p>
                    </div>
                </section>

                <CreationSection
                    {...crawl}
                    isCreationCollapsed={isCreationCollapsed}
                    setIsCreationCollapsed={setIsCreationCollapsed}
                    baseUrl={baseUrl}
                    setBaseUrl={setBaseUrl}
                    isBaseUrlPlaceholderActive={isBaseUrlPlaceholderActive}
                    setIsBaseUrlPlaceholderActive={setIsBaseUrlPlaceholderActive}
                    description={description}
                    setDescription={setDescription}
                    isDescriptionPlaceholderActive={isDescriptionPlaceholderActive}
                    setIsDescriptionPlaceholderActive={setIsDescriptionPlaceholderActive}
                    auditMode={auditMode}
                    setAuditMode={setAuditMode}
                    effectiveSelectedPractices={effectiveSelectedPractices}
                    inferredPractices={inferredPractices}
                    deselectedPractices={deselectedPractices}
                    togglePractice={togglePractice}
                    canGenerateOrRun={canGenerateOrRun}
                    isGenerating={isGenerating}
                    isRunning={isRunning}
                    handleGenerate={handleGenerate}
                    isContentRulesCollapsed={isContentRulesCollapsed}
                    setIsContentRulesCollapsed={setIsContentRulesCollapsed}
                    contentAwareRequested={contentAwareRequested}
                    isContentAwareReady={isContentAwareReady}
                    contentProfile={generation.contentProfile}
                    {...contentInsights}
                    contentPathsInput={contentPathsInput}
                    setContentPathsInput={setContentPathsInput}
                    requiredHeadingsInput={requiredHeadingsInput}
                    setRequiredHeadingsInput={setRequiredHeadingsInput}
                    requiredTextInput={requiredTextInput}
                    setRequiredTextInput={setRequiredTextInput}
                    forbiddenTextInput={forbiddenTextInput}
                    setForbiddenTextInput={setForbiddenTextInput}
                />

                <GeneratedSuiteSection
                    {...generation}
                    handleSaveToExplorer={boundHandleSaveToExplorer}
                    openReportInNewPage={run.openReportInNewPage}
                    setOpenReportInNewPage={run.setOpenReportInNewPage}
                    setReportPopupNotice={run.setReportPopupNotice}
                    handleRun={boundHandleRun}
                    hasCode={hasCode}
                    isRunning={isRunning}
                    isContentAwareReady={isContentAwareReady}
                    isPracticeSelectionReady={isPracticeSelectionReady}
                    canGenerateOrRun={canGenerateOrRun}
                    isGenerating={isGenerating}
                    runBlockedMessage={runBlockedMessage}
                    continueRunUnavailableMessage={run.continueRunUnavailableMessage}
                />

                {error && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        <strong>Error:</strong> {error}
                    </div>
                )}

                {run.reportPopupNotice && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        <strong>Report page notice:</strong> {run.reportPopupNotice}
                    </div>
                )}

                {run.result && (
                    <ReportSection
                        {...run}
                        result={run.result}
                        handleRerunFailedTitles={boundHandleRerunFailedTitles}
                        handleContinueRun={boundHandleContinueRun}
                        isRunning={isRunning}
                        canGenerateOrRun={canGenerateOrRun}
                        hasCode={hasCode}
                        isContentAwareReady={isContentAwareReady}
                        isPracticeSelectionReady={isPracticeSelectionReady}
                    />
                )}
            </main>
        </div>
    );
}
