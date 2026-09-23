import { CollapsibleSection } from "@/app/_components/CollapsibleSection";
import { ContentRulesSection } from "@/app/_components/ContentRulesSection";
import { DiscoveredPagesSection } from "@/app/_components/DiscoveredPagesSection";
import { Spinner } from "@/app/_components/Spinner";
import { BEST_PRACTICE_OPTIONS, DEFAULT_BASE_URL, DEFAULT_DESCRIPTION_EXAMPLE, TEST_AUDIT_MODE_OPTIONS } from "@/app/_lib/constants";
import type { BestPracticeArea, ContentProfile, CrawlLifecycleStatus, CrawlProgressSnapshot, CrawledPage, TestAuditMode } from "@/app/_lib/types";

interface DiscoveredLinkGroup {
    title: string;
    links: NonNullable<ContentProfile["pages"][number]["linkDetails"]>;
}

interface CreationSectionProps {
    isCreationCollapsed: boolean;
    setIsCreationCollapsed: (updater: (value: boolean) => boolean) => void;
    baseUrl: string;
    setBaseUrl: (value: string) => void;
    isBaseUrlPlaceholderActive: boolean;
    setIsBaseUrlPlaceholderActive: (value: boolean) => void;
    description: string;
    setDescription: (value: string) => void;
    isDescriptionPlaceholderActive: boolean;
    setIsDescriptionPlaceholderActive: (value: boolean) => void;
    auditMode: TestAuditMode;
    setAuditMode: (mode: TestAuditMode) => void;
    effectiveSelectedPractices: BestPracticeArea[];
    inferredPractices: BestPracticeArea[];
    deselectedPractices: BestPracticeArea[];
    togglePractice: (practice: BestPracticeArea, inferredPractices: BestPracticeArea[], effectiveSelectedPractices: BestPracticeArea[]) => void;
    canGenerateOrRun: boolean;
    isGenerating: boolean;
    isRunning: boolean;
    handleGenerate: () => void;
    // discovered pages
    isCrawledPagesCollapsed: boolean;
    setIsCrawledPagesCollapsed: (updater: (value: boolean) => boolean) => void;
    crawledPages: CrawledPage[];
    selectedCrawledPaths: string[];
    handleCrawlPages: () => void;
    isCrawling: boolean;
    handleStopCrawl: () => void;
    activeCrawlId: string | null;
    isCancellingCrawl: boolean;
    selectAllCrawledPages: () => void;
    clearCrawledPageSelection: () => void;
    selectVisibleCrawledPages: (paths: string[]) => void;
    filteredCrawledPaths: string[];
    hasActiveCrawlSelection: boolean;
    isCrawlResultStale: boolean;
    crawlError: string;
    activeCrawlProgress: CrawlProgressSnapshot | null;
    crawlVisitedCount: number;
    crawlQueuedCount: number;
    crawlDiscoveredCount: number;
    crawlRunStatus: CrawlLifecycleStatus | null;
    crawlElapsedLabel: string;
    crawlProgressPercent: number;
    activeCrawlLabel: string;
    crawlSearchQuery: string;
    setCrawlSearchQuery: (value: string) => void;
    filteredCrawledPages: CrawledPage[];
    crawlExtensionOptions: string[];
    selectedCrawlExtensions: string[];
    toggleCrawlExtension: (extension: string) => void;
    setSelectedCrawlExtensions: (extensions: string[]) => void;
    toggleCrawledPath: (path: string) => void;
    // content rules
    isContentRulesCollapsed: boolean;
    setIsContentRulesCollapsed: (updater: (value: boolean) => boolean) => void;
    contentAwareRequested: boolean;
    isContentAwareReady: boolean;
    contentProfile: ContentProfile | null;
    discoveredLinkCount: number;
    discoveredEmbeddedLinkCount: number;
    discoveredLinkPages: { path: string; count: number }[];
    discoveredEmbeddedLinkPages: { path: string; count: number }[];
    displayedDiscoveredLinks: NonNullable<ContentProfile["pages"][number]["linkDetails"]>;
    discoveredLinkGroups: DiscoveredLinkGroup[];
    displayedDiscoveredEmbeddedLinks: NonNullable<ContentProfile["pages"][number]["embeddedLinkDetails"]>;
    contentPathsInput: string;
    setContentPathsInput: (value: string) => void;
    requiredHeadingsInput: string;
    setRequiredHeadingsInput: (value: string) => void;
    requiredTextInput: string;
    setRequiredTextInput: (value: string) => void;
    forbiddenTextInput: string;
    setForbiddenTextInput: (value: string) => void;
    namedFlowsInput: string;
    setNamedFlowsInput: (value: string) => void;
    invalidNamedFlowLines: string[];
}

export function CreationSection({
    isCreationCollapsed,
    setIsCreationCollapsed,
    baseUrl,
    setBaseUrl,
    isBaseUrlPlaceholderActive,
    setIsBaseUrlPlaceholderActive,
    description,
    setDescription,
    isDescriptionPlaceholderActive,
    setIsDescriptionPlaceholderActive,
    auditMode,
    setAuditMode,
    effectiveSelectedPractices,
    inferredPractices,
    deselectedPractices,
    togglePractice,
    canGenerateOrRun,
    isGenerating,
    isRunning,
    handleGenerate,
    isCrawledPagesCollapsed,
    setIsCrawledPagesCollapsed,
    crawledPages,
    selectedCrawledPaths,
    handleCrawlPages,
    isCrawling,
    handleStopCrawl,
    activeCrawlId,
    isCancellingCrawl,
    selectAllCrawledPages,
    clearCrawledPageSelection,
    selectVisibleCrawledPages,
    filteredCrawledPaths,
    hasActiveCrawlSelection,
    isCrawlResultStale,
    crawlError,
    activeCrawlProgress,
    crawlVisitedCount,
    crawlQueuedCount,
    crawlDiscoveredCount,
    crawlRunStatus,
    crawlElapsedLabel,
    crawlProgressPercent,
    activeCrawlLabel,
    crawlSearchQuery,
    setCrawlSearchQuery,
    filteredCrawledPages,
    crawlExtensionOptions,
    selectedCrawlExtensions,
    toggleCrawlExtension,
    setSelectedCrawlExtensions,
    toggleCrawledPath,
    isContentRulesCollapsed,
    setIsContentRulesCollapsed,
    contentAwareRequested,
    isContentAwareReady,
    contentProfile,
    discoveredLinkCount,
    discoveredEmbeddedLinkCount,
    discoveredLinkPages,
    discoveredEmbeddedLinkPages,
    displayedDiscoveredLinks,
    discoveredLinkGroups,
    displayedDiscoveredEmbeddedLinks,
    contentPathsInput,
    setContentPathsInput,
    requiredHeadingsInput,
    setRequiredHeadingsInput,
    requiredTextInput,
    setRequiredTextInput,
    forbiddenTextInput,
    setForbiddenTextInput,
    namedFlowsInput,
    setNamedFlowsInput,
    invalidNamedFlowLines,
}: CreationSectionProps) {
    return (
                <CollapsibleSection
                    title="Test Suite Creation"
                    subtitle="Define the target, describe the scenario, and choose which best-practice areas should generate tests."
                    collapsed={isCreationCollapsed}
                    onToggle={() => setIsCreationCollapsed((value) => !value)}
                >
                    <div className="space-y-5">
                        <div className="grid items-start gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                            <div className="space-y-5">
                                <div className="space-y-1.5">
                                    <label htmlFor="base-url-input" className="block text-sm font-medium text-zinc-700">
                                        Base URL
                                    </label>
                                    <input
                                        id="base-url-input"
                                        aria-label="Base URL"
                                        type="text"
                                        value={baseUrl}
                                        onFocus={() => {
                                            if (isBaseUrlPlaceholderActive) {
                                                setBaseUrl("");
                                                setIsBaseUrlPlaceholderActive(false);
                                            }
                                        }}
                                        onBlur={() => {
                                            if (!baseUrl.trim()) {
                                                setBaseUrl(DEFAULT_BASE_URL);
                                                setIsBaseUrlPlaceholderActive(true);
                                            }
                                        }}
                                        onChange={(event) => {
                                            setBaseUrl(event.target.value);
                                            if (isBaseUrlPlaceholderActive) {
                                                setIsBaseUrlPlaceholderActive(false);
                                            }
                                        }}
                                        inputMode="url"
                                        autoCapitalize="none"
                                        autoCorrect="off"
                                        spellCheck={false}
                                        className={`w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm ${isBaseUrlPlaceholderActive ? "text-zinc-400" : "text-zinc-900"} focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200`}
                                    />
                                    <p className="text-xs text-zinc-500">
                                        Accepts local addresses like localhost:3000 and full URLs.
                                    </p>
                                </div>

                                <div className="space-y-1.5">
                                    <label htmlFor="test-description-input" className="block text-sm font-medium text-zinc-700">
                                        What do you want to test?
                                    </label>
                                    <textarea
                                        id="test-description-input"
                                        aria-label="What do you want to test?"
                                        rows={5}
                                        value={description}
                                        onFocus={() => {
                                            if (isDescriptionPlaceholderActive) {
                                                setDescription("");
                                                setIsDescriptionPlaceholderActive(false);
                                            }
                                        }}
                                        onBlur={() => {
                                            if (!description.trim()) {
                                                setDescription(DEFAULT_DESCRIPTION_EXAMPLE);
                                                setIsDescriptionPlaceholderActive(true);
                                            }
                                        }}
                                        onChange={(event) => {
                                            setDescription(event.target.value);
                                            if (isDescriptionPlaceholderActive) {
                                                setIsDescriptionPlaceholderActive(false);
                                            }
                                        }}
                                        className={`w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm ${isDescriptionPlaceholderActive ? "text-zinc-400" : "text-zinc-900"} focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none`}
                                    />
                                    <p className="text-xs text-zinc-500">
                                        Matching keywords will highlight the applicable best-practice areas on the right. You can also leave this blank and generate from the selected best-practice areas alone.
                                    </p>
                                </div>

                                <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <div className="text-sm font-medium text-zinc-700">
                                                Generation Mode
                                            </div>
                                            <p className="mt-1 text-xs leading-5 text-zinc-500">
                                                Fast mode reduces expensive link navigation checks. Deep mode keeps the broader audit coverage.
                                            </p>
                                        </div>
                                        <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                                            {auditMode === "fast" ? "Default" : "Expanded"}
                                        </span>
                                    </div>
                                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                        {TEST_AUDIT_MODE_OPTIONS.map((mode) => {
                                            const selected = auditMode === mode.id;

                                            return (
                                                <button
                                                    key={mode.id}
                                                    type="button"
                                                    aria-pressed={selected}
                                                    onClick={() => setAuditMode(mode.id)}
                                                    className={`rounded-2xl border px-4 py-3 text-left transition ${selected
                                                        ? "border-indigo-500 bg-indigo-50 text-indigo-950 shadow-[0_8px_24px_rgba(79,70,229,0.12)] ring-2 ring-indigo-200"
                                                        : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-white"
                                                        }`}
                                                >
                                                    <span className="block text-sm font-semibold">{mode.label}</span>
                                                    <span className="mt-1 block text-xs leading-5 text-zinc-500">{mode.description}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3 rounded-[24px] border border-zinc-200 bg-zinc-50 p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="block text-sm font-medium text-zinc-700">
                                        Best-Practice Coverage
                                    </div>
                                    <span className="text-xs text-zinc-500">
                                        {effectiveSelectedPractices.length === 0
                                            ? "No active sections"
                                            : `${effectiveSelectedPractices.length} active`}
                                    </span>
                                </div>
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {BEST_PRACTICE_OPTIONS.map((practice) => {
                                        const selected = effectiveSelectedPractices.includes(practice.id);
                                        const inferred = inferredPractices.includes(practice.id);
                                        const deselected = deselectedPractices.includes(practice.id);

                                        return (
                                            <button
                                                key={practice.id}
                                                type="button"
                                                aria-pressed={selected}
                                                onClick={() =>
                                                    togglePractice(
                                                        practice.id,
                                                        inferredPractices,
                                                        effectiveSelectedPractices
                                                    )
                                                }
                                                className={`rounded-2xl border px-4 py-3 text-left transition ${selected
                                                    ? inferred
                                                        ? "border-indigo-500 bg-indigo-50 text-indigo-950 shadow-[0_8px_24px_rgba(79,70,229,0.12)] ring-2 ring-indigo-200"
                                                        : "border-emerald-500 bg-emerald-50 text-emerald-950 shadow-sm"
                                                    : deselected && inferred
                                                        ? "border-zinc-300 bg-white text-zinc-500 opacity-70"
                                                        : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-white"
                                                    }`}
                                            >
                                                <span className="block text-sm font-semibold">
                                                    {practice.label}
                                                </span>
                                                <span className="mt-1 block text-xs leading-5 text-zinc-500">
                                                    {practice.description}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                                {!canGenerateOrRun && (
                                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">
                                        At least one best-practice area must remain active to generate or run tests.
                                    </div>
                                )}
                            </div>
                        </div>

                        <DiscoveredPagesSection
                            isCrawledPagesCollapsed={isCrawledPagesCollapsed}
                            setIsCrawledPagesCollapsed={setIsCrawledPagesCollapsed}
                            crawledPages={crawledPages}
                            selectedCrawledPaths={selectedCrawledPaths}
                            handleCrawlPages={handleCrawlPages}
                            isGenerating={isGenerating}
                            isRunning={isRunning}
                            isCrawling={isCrawling}
                            handleStopCrawl={handleStopCrawl}
                            activeCrawlId={activeCrawlId}
                            isCancellingCrawl={isCancellingCrawl}
                            selectAllCrawledPages={selectAllCrawledPages}
                            clearCrawledPageSelection={clearCrawledPageSelection}
                            selectVisibleCrawledPages={selectVisibleCrawledPages}
                            filteredCrawledPaths={filteredCrawledPaths}
                            hasActiveCrawlSelection={hasActiveCrawlSelection}
                            isCrawlResultStale={isCrawlResultStale}
                            crawlError={crawlError}
                            activeCrawlProgress={activeCrawlProgress}
                            crawlVisitedCount={crawlVisitedCount}
                            crawlQueuedCount={crawlQueuedCount}
                            crawlDiscoveredCount={crawlDiscoveredCount}
                            crawlRunStatus={crawlRunStatus}
                            crawlElapsedLabel={crawlElapsedLabel}
                            crawlProgressPercent={crawlProgressPercent}
                            activeCrawlLabel={activeCrawlLabel}
                            crawlSearchQuery={crawlSearchQuery}
                            setCrawlSearchQuery={setCrawlSearchQuery}
                            filteredCrawledPages={filteredCrawledPages}
                            crawlExtensionOptions={crawlExtensionOptions}
                            selectedCrawlExtensions={selectedCrawlExtensions}
                            toggleCrawlExtension={toggleCrawlExtension}
                            setSelectedCrawlExtensions={setSelectedCrawlExtensions}
                            toggleCrawledPath={toggleCrawledPath}
                        />

                        <ContentRulesSection
                            isContentRulesCollapsed={isContentRulesCollapsed}
                            setIsContentRulesCollapsed={setIsContentRulesCollapsed}
                            contentAwareRequested={contentAwareRequested}
                            isContentAwareReady={isContentAwareReady}
                            contentProfile={contentProfile}
                            discoveredLinkCount={discoveredLinkCount}
                            auditMode={auditMode}
                            discoveredEmbeddedLinkCount={discoveredEmbeddedLinkCount}
                            discoveredLinkPages={discoveredLinkPages}
                            discoveredEmbeddedLinkPages={discoveredEmbeddedLinkPages}
                            displayedDiscoveredLinks={displayedDiscoveredLinks}
                            discoveredLinkGroups={discoveredLinkGroups}
                            displayedDiscoveredEmbeddedLinks={displayedDiscoveredEmbeddedLinks}
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

                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating || isRunning || !canGenerateOrRun}
                            className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isGenerating ? (
                                <>
                                    <Spinner />
                                    Generating…
                                </>
                            ) : (
                                <>
                                    <svg
                                        className="h-4 w-4"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <path d="M12 2L2 7l10 5 10-5-10-5z" />
                                        <path d="M2 17l10 5 10-5" />
                                        <path d="M2 12l10 5 10-5" />
                                    </svg>
                                    Generate test suite
                                </>
                            )}
                        </button>
                    </div>
                </CollapsibleSection>
    );
}
