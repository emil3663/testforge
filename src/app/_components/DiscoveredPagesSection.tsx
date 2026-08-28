import { Chevron } from "@/app/_components/Chevron";
import { Spinner } from "@/app/_components/Spinner";
import { toSentenceCase } from "@/app/_lib/format";
import type { CrawlLifecycleStatus, CrawlProgressSnapshot, CrawledPage } from "@/app/_lib/types";

interface DiscoveredPagesSectionProps {
    isCrawledPagesCollapsed: boolean;
    setIsCrawledPagesCollapsed: (updater: (value: boolean) => boolean) => void;
    crawledPages: CrawledPage[];
    selectedCrawledPaths: string[];
    handleCrawlPages: () => void;
    isGenerating: boolean;
    isRunning: boolean;
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
}

export function DiscoveredPagesSection({
    isCrawledPagesCollapsed,
    setIsCrawledPagesCollapsed,
    crawledPages,
    selectedCrawledPaths,
    handleCrawlPages,
    isGenerating,
    isRunning,
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
}: DiscoveredPagesSectionProps) {
    return (
                        <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-4">
                            <button
                                type="button"
                                onClick={() => setIsCrawledPagesCollapsed((value) => !value)}
                                aria-expanded={!isCrawledPagesCollapsed}
                                aria-controls="discovered-site-pages-panel"
                                className="flex w-full items-start justify-between gap-3 text-left"
                            >
                                <div>
                                    <div className="text-sm font-medium text-zinc-700">
                                        Discovered Site Pages
                                    </div>
                                    <p className="mt-1 text-xs leading-5 text-zinc-500">
                                        Crawl the site and choose one page, multiple pages, or all pages for testing.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                                        {crawledPages.length > 0 ? `${selectedCrawledPaths.length}/${crawledPages.length} selected` : "No pages crawled"}
                                    </span>
                                    <Chevron collapsed={isCrawledPagesCollapsed} />
                                </div>
                            </button>

                            {!isCrawledPagesCollapsed && (
                                <div id="discovered-site-pages-panel">
                                    <div className="mt-4 flex flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={handleCrawlPages}
                                            disabled={isGenerating || isRunning || isCrawling}
                                            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {isCrawling ? (
                                                <>
                                                    <Spinner />
                                                    Crawling...
                                                </>
                                            ) : (
                                                "Crawl site"
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleStopCrawl}
                                            disabled={!activeCrawlId || !isCrawling || isCancellingCrawl}
                                            className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {isCancellingCrawl ? "Stopping..." : "Stop crawl"}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={selectAllCrawledPages}
                                            disabled={crawledPages.length === 0 || isCrawling}
                                            className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-700 transition hover:border-zinc-400 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            Select all
                                        </button>
                                        <button
                                            type="button"
                                            onClick={clearCrawledPageSelection}
                                            disabled={selectedCrawledPaths.length === 0 || isCrawling}
                                            className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-700 transition hover:border-zinc-400 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            Clear selection
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => selectVisibleCrawledPages(filteredCrawledPaths)}
                                            disabled={filteredCrawledPaths.length === 0 || isCrawling}
                                            className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-700 transition hover:border-zinc-400 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            Select visible
                                        </button>
                                    </div>

                                    <div className="mt-3 rounded-2xl border border-sky-100 bg-sky-50/80 px-4 py-3 text-xs leading-5 text-sky-900">
                                        {hasActiveCrawlSelection
                                            ? `The crawler selection will be used for inspection and generation across ${selectedCrawledPaths.length} page${selectedCrawledPaths.length === 1 ? "" : "s"}.`
                                            : "If no crawler pages are selected, TestForge falls back to the manual paths in Content Rules or the current base path."}
                                    </div>

                                    {isCrawlResultStale && (
                                        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">
                                            The base URL changed after the last crawl. Crawl again to refresh the page list for this target.
                                        </div>
                                    )}

                                    {crawlError && (
                                        <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">
                                            {crawlError}
                                        </div>
                                    )}

                                    {isCrawling && activeCrawlProgress && (
                                        <div className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 text-xs leading-5 text-zinc-600">
                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                                <div>
                                                    <div className="text-sm font-semibold text-zinc-900">Crawl in progress</div>
                                                    <div className="mt-1 text-zinc-500">
                                                        {crawlVisitedCount} pages processed, {crawlQueuedCount} queued, {crawlDiscoveredCount} discovered
                                                        {crawlRunStatus ? ` · ${toSentenceCase(crawlRunStatus)}` : ""}
                                                    </div>
                                                </div>
                                                <div className="rounded-xl border border-indigo-200 bg-white px-3 py-2 text-right">
                                                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Elapsed</div>
                                                    <div className="mt-1 text-sm font-semibold text-zinc-900">{crawlElapsedLabel}</div>
                                                </div>
                                            </div>

                                            <div className="mt-4">
                                                <div className="flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                                    <span>Known crawl frontier</span>
                                                    <span>{crawlProgressPercent}%</span>
                                                </div>
                                                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-indigo-100">
                                                    <div
                                                        className="h-full rounded-full bg-indigo-500 transition-[width] duration-300"
                                                        style={{ width: `${crawlProgressPercent}%` }}
                                                    />
                                                </div>
                                                <div className="mt-2 text-[11px] leading-5 text-zinc-500">
                                                    The crawl can discover new pages while it runs, so this percentage reflects the current known queue rather than a fixed total.
                                                </div>
                                            </div>

                                            <div className="mt-4 grid gap-2 sm:grid-cols-4">
                                                <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2">
                                                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Processed</div>
                                                    <div className="mt-1 text-lg font-semibold text-zinc-900">{crawlVisitedCount}</div>
                                                </div>
                                                <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2">
                                                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Queued</div>
                                                    <div className="mt-1 text-lg font-semibold text-zinc-900">{crawlQueuedCount}</div>
                                                </div>
                                                <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2">
                                                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Discovered</div>
                                                    <div className="mt-1 text-lg font-semibold text-zinc-900">{crawlDiscoveredCount}</div>
                                                </div>
                                                <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2">
                                                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Warnings</div>
                                                    <div className="mt-1 text-lg font-semibold text-zinc-900">{activeCrawlProgress.warningsCount}</div>
                                                </div>
                                            </div>

                                            <div className="mt-4 rounded-xl border border-zinc-200 bg-white px-3 py-3">
                                                <div className="font-semibold text-zinc-800">Current page</div>
                                                <div className="mt-2 break-all text-sm font-medium text-zinc-900">{activeCrawlLabel}</div>
                                                <div className="mt-1 text-[11px] leading-5 text-zinc-500">
                                                    {activeCrawlProgress.currentTitle && activeCrawlProgress.currentUrl
                                                        ? `${activeCrawlProgress.currentTitle} · ${activeCrawlProgress.currentUrl}`
                                                        : activeCrawlProgress.currentUrl
                                                            ? activeCrawlProgress.currentUrl
                                                            : activeCrawlProgress.lastCompletedPath
                                                                ? activeCrawlProgress.lastCompletedTitle
                                                                    ? `Last completed page: ${activeCrawlProgress.lastCompletedTitle} · ${activeCrawlProgress.lastCompletedPath}`
                                                                    : `Last completed page: ${activeCrawlProgress.lastCompletedPath}`
                                                                : "Waiting for the first successful page load."}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {crawledPages.length > 0 && (
                                        <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-3">
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <label htmlFor="crawl-search-input" className="min-w-[220px] flex-1">
                                                    <span className="sr-only">Search discovered pages</span>
                                                    <input
                                                        id="crawl-search-input"
                                                        aria-label="Search discovered pages"
                                                        type="search"
                                                        value={crawlSearchQuery}
                                                        onChange={(event) => setCrawlSearchQuery(event.target.value)}
                                                        placeholder="Search paths, titles, or discovery source"
                                                        className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                                    />
                                                </label>
                                                <div className="text-xs text-zinc-500">
                                                    Showing {filteredCrawledPages.length} of {crawledPages.length} discovered pages.
                                                </div>
                                            </div>
                                            {crawlExtensionOptions.length > 0 && (
                                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                                    {crawlExtensionOptions.map((extension) => {
                                                        const selected = selectedCrawlExtensions.includes(extension);

                                                        return (
                                                            <button
                                                                key={extension}
                                                                type="button"
                                                                onClick={() => toggleCrawlExtension(extension)}
                                                                className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${selected
                                                                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                                                                    : "border-zinc-300 bg-white text-zinc-600 hover:border-zinc-400 hover:text-zinc-900"
                                                                    }`}
                                                            >
                                                                {extension}
                                                            </button>
                                                        );
                                                    })}
                                                    {selectedCrawlExtensions.length > 0 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedCrawlExtensions([])}
                                                            className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-600 transition hover:border-zinc-400 hover:text-zinc-900"
                                                        >
                                                            Clear filters
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="mt-4 h-[420px] overflow-y-auto rounded-2xl border border-zinc-200 bg-white">
                                        {crawledPages.length > 0 ? (
                                            <div className="divide-y divide-zinc-100">
                                                {filteredCrawledPages.map((page) => {
                                                    const checked = selectedCrawledPaths.includes(page.path);

                                                    return (
                                                        <label
                                                            key={page.path}
                                                            className="flex min-h-[72px] cursor-pointer items-start gap-3 px-4 py-3 text-sm text-zinc-700"
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={checked}
                                                                onChange={() => toggleCrawledPath(page.path)}
                                                                className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                                                            />
                                                            <div className="min-w-0 flex-1">
                                                                <div className="font-medium text-zinc-900">
                                                                    {page.title || page.path}
                                                                </div>
                                                                <div className="mt-1 break-all text-xs text-zinc-500">
                                                                    {page.path}
                                                                </div>
                                                                {page.discoveredFrom && (
                                                                    <div className="mt-1 text-[11px] text-zinc-400">
                                                                        Discovered from {page.discoveredFrom}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </label>
                                                    );
                                                })}
                                                {filteredCrawledPages.length === 0 && (
                                                    <div className="flex min-h-[196px] items-center justify-center px-6 text-center text-xs leading-6 text-zinc-500">
                                                        No discovered pages match the current search or extension filters.
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex h-full items-center justify-center px-6 text-center text-xs leading-6 text-zinc-500">
                                                Run the crawler to discover same-origin pages and choose what should be tested.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
    );
}
