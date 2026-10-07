"use client";

import { useState } from "react";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, getSiteUrl } from "@/lib/seo";
import { CreationSection } from "@/app/_components/CreationSection";
import { GeneratedSuiteSection } from "@/app/_components/GeneratedSuiteSection";
import { HelpPanel } from "@/app/_components/HelpPanel";
import { JourneyReviewSection } from "@/app/_components/JourneyReviewSection";
import { LoginConfigSection } from "@/app/_components/LoginConfigSection";
import { ReportSection } from "@/app/_components/ReportSection";
import { RunProgressOverlay } from "@/app/_components/RunProgressOverlay";
import { RunTypeSection, type RunTypeChoice } from "@/app/_components/RunTypeSection";
import { DEFAULT_PAGE_CAP, MAX_PAGE_CAP, STANDARD_RUN, type ComprehensiveArea, type RunMode } from "@/lib/comprehensive/run-mode";
import { useCrawl } from "@/app/_hooks/useCrawl";
import { useGeneration } from "@/app/_hooks/useGeneration";
import { useRun } from "@/app/_hooks/useRun";
import { DEFAULT_BASE_URL, DEFAULT_DESCRIPTION_EXAMPLE, DEFAULT_TEST_AUDIT_MODE } from "@/app/_lib/constants";
import {
    buildLoginBlock,
    buildSelectedPracticeDescription,
    deriveBusyInspectionTargets,
    deriveContentInsights,
    deriveRunProgressDisplay,
    EMPTY_LOGIN_INPUTS,
    inferBestPracticesFromDescription,
    normalizeBaseUrl,
    normalizeInspectionPaths,
    parseContentLines,
    parseNamedFlowLines,
} from "@/app/_lib/derive";
import type { LoginInputs } from "@/app/_lib/derive";
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
    const [namedFlowsInput, setNamedFlowsInput] = useState("");
    const [auditMode, setAuditMode] = useState(DEFAULT_TEST_AUDIT_MODE);
    const [isCreationCollapsed, setIsCreationCollapsed] = useState(false);
    const [isContentRulesCollapsed, setIsContentRulesCollapsed] = useState(true);
    const [isHelpPanelOpen, setIsHelpPanelOpen] = useState(false);
    const [selectedJourneyIds, setSelectedJourneyIds] = useState<string[]>([]);
    const [isJourneysCollapsed, setIsJourneysCollapsed] = useState(false);
    // TFP-091: per-run opt-in for skipped-by-default interactive tests.
    const [enableInteractive, setEnableInteractive] = useState(false);
    // TFP-097: the run's login, entered as references (never a credential).
    const [loginInputs, setLoginInputs] = useState<LoginInputs>({ ...EMPTY_LOGIN_INPUTS });
    const [isLoginCollapsed, setIsLoginCollapsed] = useState(true);
    // Phase 35 (TFP-132): Standard (unchanged) or Comprehensive for one area.
    const [runType, setRunType] = useState<RunTypeChoice>("standard");
    const [comprehensiveArea, setComprehensiveArea] = useState<ComprehensiveArea>("security");
    const [pageCapInput, setPageCapInput] = useState(String(DEFAULT_PAGE_CAP));
    const [isRunTypeCollapsed, setIsRunTypeCollapsed] = useState(true);

    const pageCap = Number(pageCapInput);
    const pageCapProblem = runType === "comprehensive" && (!Number.isInteger(pageCap) || pageCap < 1 || pageCap > MAX_PAGE_CAP)
        ? `The page cap must be a whole number from 1 to ${MAX_PAGE_CAP}.`
        : "";
    const runMode: RunMode = runType === "comprehensive"
        ? { kind: "comprehensive", area: comprehensiveArea, level: comprehensiveArea === "security" ? "passive" : null, pageCap: pageCapProblem ? DEFAULT_PAGE_CAP : pageCap }
        : STANDARD_RUN;
    // Phase 40 (TFP-172): after a crawl, the pages selected by type for this run type.
    const crawl = useCrawl(baseUrl, runMode);
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

    function toggleJourney(journeyId: string) {
        setSelectedJourneyIds((current) =>
            current.includes(journeyId) ? current.filter((id) => id !== journeyId) : [...current, journeyId]
        );
    }

    function buildGenerateParams() {
        return {
            baseUrl,
            effectiveSelectedPractices: practicesInScope,
            runMode,
            isDescriptionPlaceholderActive,
            description,
            auditMode,
            contentPathsInput,
            requiredHeadingsInput,
            requiredTextInput,
            forbiddenTextInput,
            namedFlowsInput,
            selectedJourneyIds: effectiveSelectedJourneyIds,
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
        };
    }

    function handleGenerate() {
        void generation.handleGenerate(buildGenerateParams());
    }

    // TFP-090: writes the reviewed selection into run config by regenerating
    // from the scan on screen (no re-inspection, so the ids still match).
    function handleGenerateSelectedJourneys() {
        void generation.handleGenerate(buildGenerateParams(), generation.contentProfile);
    }

    const candidateJourneys = generation.contentProfile?.journeys ?? [];
    const candidateJourneyIds = new Set(candidateJourneys.map((journey) => journey.id));
    // A selection only counts for journeys the current scan still offers.
    const effectiveSelectedJourneyIds = selectedJourneyIds.filter((id) => candidateJourneyIds.has(id));
    const isGenerating = step === "generating";
    const isRunning = step === "running";
    const hasCode = step === "ready" || step === "done";
    const effectiveDescriptionText = isDescriptionPlaceholderActive ? "" : description;
    const inferredPractices = inferBestPracticesFromDescription(effectiveDescriptionText);
    const effectiveSelectedPractices: BestPracticeArea[] = [...new Set([...selectedPractices, ...(selectedPractices.length > 0 ? [] : inferredPractices)])]
        .filter((practice) => !deselectedPractices.includes(practice));
    // A Comprehensive run covers its one area; a Standard run the selected ones.
    const practicesInScope: BestPracticeArea[] = runMode.kind === "comprehensive" ? [runMode.area] : effectiveSelectedPractices;
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
    const { flows: namedFlows, invalidLines: invalidNamedFlowLines } = parseNamedFlowLines(namedFlowsInput);
    const contentAwareRequested =
        namedFlows.length > 0 ||
        contentRules.requiredHeadings.length > 0 ||
        contentRules.requiredText.length > 0 ||
        contentRules.forbiddenText.length > 0 ||
        contentRules.paths.some((path) => path !== "/");
    const selectedPracticeSignature = JSON.stringify([...practicesInScope].sort());
    const isRunModeReady = JSON.stringify(generation.lastGeneratedRunMode) === JSON.stringify(runMode);
    const isContentAwareReady =
        !contentAwareRequested ||
        (generation.contentProfile !== null &&
            generation.lastGeneratedContentSignature === JSON.stringify({ contentRules, namedFlows, auditMode }) &&
            hasCode);
    const isPracticeSelectionReady = generation.lastGeneratedPracticeSignature === selectedPracticeSignature;
    const isJourneySelectionReady =
        generation.lastGeneratedJourneySignature === JSON.stringify([...effectiveSelectedJourneyIds].sort());
    const { login: loginBlock, problem: loginProblem } = buildLoginBlock(loginInputs);
    const runBlockedMessage = loginProblem
        ? `Fix the login settings before running: ${loginProblem}`
        : pageCapProblem
        ? pageCapProblem
        : !isRunModeReady
        ? "Generate the suite again after changing the run type before running it."
        : !isContentAwareReady
        ? "Generate the suite again after completing the content-aware inputs before running it."
        : !isPracticeSelectionReady
            ? "Generate the suite again after changing the selected best-practice areas before running it."
            : !isJourneySelectionReady
                ? "Generate the suite again after changing the selected journeys before running it."
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
    const canGenerateOrRun = practicesInScope.length > 0 && !pageCapProblem;
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
        selectedPractices: practicesInScope,
        auditMode: generation.lastGeneratedAuditMode,
        baseUrl: generation.lastGeneratedBaseUrl,
        description: (isDescriptionPlaceholderActive ? "" : description).trim() || buildSelectedPracticeDescription(practicesInScope),
        contentProfile: generation.contentProfile,
        enableInteractive,
        login: loginBlock,
        generation: generation.lastGeneration,
        runMode: generation.lastGeneratedRunMode,
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
                    namedFlowsInput={namedFlowsInput}
                    setNamedFlowsInput={setNamedFlowsInput}
                    invalidNamedFlowLines={invalidNamedFlowLines}
                />

                {generation.contentProfile && (
                    <JourneyReviewSection
                        journeys={candidateJourneys}
                        selectedJourneyIds={effectiveSelectedJourneyIds}
                        toggleJourney={toggleJourney}
                        clearJourneySelection={() => setSelectedJourneyIds([])}
                        handleGenerateSelected={handleGenerateSelectedJourneys}
                        isBusy={isGenerating || isRunning}
                        isCollapsed={isJourneysCollapsed}
                        setIsCollapsed={setIsJourneysCollapsed}
                    />
                )}

                <RunTypeSection
                    runType={runType}
                    setRunType={setRunType}
                    comprehensiveArea={comprehensiveArea}
                    setComprehensiveArea={setComprehensiveArea}
                    pageCapInput={pageCapInput}
                    setPageCapInput={setPageCapInput}
                    pageCapProblem={pageCapProblem}
                    isCollapsed={isRunTypeCollapsed}
                    setIsCollapsed={setIsRunTypeCollapsed}
                />

                <LoginConfigSection
                    loginInputs={loginInputs}
                    setLoginInputs={setLoginInputs}
                    loginProblem={loginProblem}
                    isCollapsed={isLoginCollapsed}
                    setIsCollapsed={setIsLoginCollapsed}
                />

                <GeneratedSuiteSection
                    {...generation}
                    handleSaveToExplorer={boundHandleSaveToExplorer}
                    openReportInNewPage={run.openReportInNewPage}
                    setOpenReportInNewPage={run.setOpenReportInNewPage}
                    setReportPopupNotice={run.setReportPopupNotice}
                    handleRun={boundHandleRun}
                    enableInteractive={enableInteractive}
                    setEnableInteractive={setEnableInteractive}
                    hasCode={hasCode}
                    isRunning={isRunning}
                    isContentAwareReady={isContentAwareReady}
                    isPracticeSelectionReady={isPracticeSelectionReady && isJourneySelectionReady && isRunModeReady && !loginProblem}
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
                        isPracticeSelectionReady={isPracticeSelectionReady && isJourneySelectionReady && isRunModeReady && !loginProblem}
                    />
                )}
            </main>
        </div>
    );
}
