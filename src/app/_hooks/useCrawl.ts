import { useEffect, useState } from "react";
import { getPathExtension, normalizeBaseUrl, typeSelectedPaths } from "@/app/_lib/derive";
import type { RunMode } from "@/lib/comprehensive/run-mode";
import { formatMilliseconds } from "@/lib/report/text";
import type { CrawlLifecycleStatus, CrawlProgressSnapshot, CrawlResult, CrawlStatusSnapshot } from "@/app/_lib/types";

// Bounded retry/backoff for a transient poll failure (network blip, dev-server
// restart) before it surfaces as a user-visible error - see TFP-068.
const POLL_RETRY_DELAYS_MS = [500, 1000, 2000];

// A terminal crawlStatus is treated as a stop condition alongside `result`
// being set, so a crawl that reaches a terminal status without a result
// can't leave this hook polling forever - see TFP-068.
const TERMINAL_CRAWL_STATUSES = new Set<CrawlLifecycleStatus>(["completed", "failed", "cancelled"]);

export interface CrawlPollDeps {
    fetchImpl: typeof fetch;
    sleep: (ms: number) => Promise<void>;
    isCancelled: () => boolean;
    onSnapshot: (snapshot: CrawlStatusSnapshot) => void;
    onResult: (result: CrawlResult) => void;
    onTerminalWithoutResult: (message: string) => void;
    onFailure: (message: string) => void;
}

// Framework-agnostic poll loop, unit-tested directly in useCrawl.test.ts
// against a mocked fetch/sleep - the hook below wires it to the real
// fetch/setTimeout. Stops on: a result payload, a terminal crawlStatus with
// no result (safety net), or POLL_RETRY_DELAYS_MS.length consecutive
// failures. A single transient failure retries with backoff instead of
// abandoning the crawl.
export async function pollCrawlUntilDone(crawlId: string, deps: CrawlPollDeps): Promise<void> {
    let consecutiveFailures = 0;

    for (; ;) {
        if (deps.isCancelled()) {
            return;
        }

        try {
            const response = await deps.fetchImpl(`/api/crawl?crawlId=${encodeURIComponent(crawlId)}`, {
                cache: "no-store",
            });
            const data = (await response.json()) as CrawlStatusSnapshot | { error?: string };

            if (!response.ok) {
                throw new Error("error" in data ? data.error ?? "Site crawl failed" : "Site crawl failed");
            }

            if (deps.isCancelled()) {
                return;
            }

            consecutiveFailures = 0;

            const snapshot = data as CrawlStatusSnapshot;
            deps.onSnapshot(snapshot);

            if (snapshot.result) {
                deps.onResult(snapshot.result);
                return;
            }

            if (TERMINAL_CRAWL_STATUSES.has(snapshot.crawlStatus)) {
                deps.onTerminalWithoutResult(snapshot.error ?? "Site crawl failed");
                return;
            }

            await deps.sleep(500);
        } catch (err: unknown) {
            if (deps.isCancelled()) {
                return;
            }

            if (consecutiveFailures < POLL_RETRY_DELAYS_MS.length) {
                const delay = POLL_RETRY_DELAYS_MS[consecutiveFailures];
                consecutiveFailures += 1;
                await deps.sleep(delay);
                continue;
            }

            deps.onFailure(err instanceof Error ? err.message : "Site crawl failed");
            return;
        }
    }
}

export function useCrawl(baseUrl: string, runMode: RunMode) {
    const [crawlResult, setCrawlResult] = useState<CrawlResult | null>(null);
    // Phase 40 (TFP-172): null until the user changes the selection by hand,
    // so it follows the run type: Standard's pages by type, or
    // Comprehensive's for its page cap. A hand-made selection is kept as is.
    const [manualCrawledPaths, setManualCrawledPaths] = useState<string[] | null>(null);
    const selectedCrawledPaths = manualCrawledPaths ?? (crawlResult ? typeSelectedPaths(crawlResult, runMode) : []);
    const setSelectedCrawledPaths = (update: string[] | ((current: string[]) => string[])) =>
        setManualCrawledPaths(typeof update === "function" ? update(selectedCrawledPaths) : update);
    const [crawlSearchQuery, setCrawlSearchQuery] = useState("");
    const [selectedCrawlExtensions, setSelectedCrawlExtensions] = useState<string[]>([]);
    const [crawlStatus, setCrawlStatus] = useState<"idle" | "crawling">("idle");
    const [activeCrawlId, setActiveCrawlId] = useState<string | null>(null);
    const [crawlProgress, setCrawlProgress] = useState<CrawlProgressSnapshot | null>(null);
    const [crawlDurationMs, setCrawlDurationMs] = useState(0);
    const [crawlRunStatus, setCrawlRunStatus] = useState<CrawlLifecycleStatus | null>(null);
    const [isCancellingCrawl, setIsCancellingCrawl] = useState(false);
    const [crawlError, setCrawlError] = useState("");
    const [isCrawledPagesCollapsed, setIsCrawledPagesCollapsed] = useState(false);

    useEffect(() => {
        if (crawlStatus !== "crawling" || !activeCrawlId) {
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

        void pollCrawlUntilDone(activeCrawlId, {
            // Passing the bare `fetch` reference detaches it from `window`,
            // and native browser fetch throws "Illegal invocation" when
            // called without that `this` binding - wrap it instead.
            fetchImpl: (input, init) => fetch(input, init),
            sleep,
            isCancelled: () => ignore,
            onSnapshot: (snapshot) => {
                setCrawlProgress(snapshot.progress);
                setCrawlDurationMs(snapshot.duration);
                setCrawlRunStatus(snapshot.crawlStatus);
            },
            onResult: (result) => {
                setCrawlResult(result);
                setManualCrawledPaths(null);
                setCrawlSearchQuery("");
                setSelectedCrawlExtensions([]);
                setIsCrawledPagesCollapsed(false);
                setActiveCrawlId(null);
                setIsCancellingCrawl(false);
                setCrawlStatus("idle");
            },
            onTerminalWithoutResult: (message) => {
                setCrawlError(message);
                setActiveCrawlId(null);
                setIsCancellingCrawl(false);
                setCrawlStatus("idle");
            },
            onFailure: (message) => {
                setCrawlError(message);
                setActiveCrawlId(null);
                setIsCancellingCrawl(false);
                setCrawlStatus("idle");
            },
        });

        return () => {
            ignore = true;
            if (timer !== null) {
                window.clearTimeout(timer);
            }
        };
    }, [activeCrawlId, crawlStatus]);

    async function handleCrawlPages() {
        const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
        if (!normalizedBaseUrl.ok) {
            setCrawlError(normalizedBaseUrl.message);
            return;
        }

        setCrawlStatus("crawling");
        setCrawlError("");
        setActiveCrawlId(null);
        setCrawlProgress(null);
        setCrawlDurationMs(0);
        setCrawlRunStatus("running");
        setIsCancellingCrawl(false);

        try {
            const response = await fetch("/api/crawl", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ baseUrl: normalizedBaseUrl.value }),
            });
            const data = (await response.json()) as CrawlStatusSnapshot | { error?: string };

            if (!response.ok) {
                throw new Error("error" in data ? data.error ?? "Site crawl failed" : "Site crawl failed");
            }

            const snapshot = data as CrawlStatusSnapshot;
            setActiveCrawlId(snapshot.crawlId);
            setCrawlProgress(snapshot.progress);
            setCrawlDurationMs(snapshot.duration);
            setCrawlRunStatus(snapshot.crawlStatus);
        } catch (err: unknown) {
            setCrawlError(err instanceof Error ? err.message : "Unknown error");
            setCrawlStatus("idle");
            setCrawlRunStatus("failed");
            setIsCancellingCrawl(false);
        }
    }

    async function handleStopCrawl() {
        if (!activeCrawlId || isCancellingCrawl) {
            return;
        }

        setIsCancellingCrawl(true);

        try {
            const response = await fetch("/api/crawl", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ crawlId: activeCrawlId }),
            });
            const data = (await response.json()) as CrawlStatusSnapshot | { error?: string };

            if (!response.ok) {
                throw new Error("error" in data ? data.error ?? "Unable to stop crawl" : "Unable to stop crawl");
            }

            const snapshot = data as CrawlStatusSnapshot;
            setCrawlProgress(snapshot.progress);
            setCrawlDurationMs(snapshot.duration);
            setCrawlRunStatus(snapshot.crawlStatus);
        } catch (err: unknown) {
            setCrawlError(err instanceof Error ? err.message : "Unable to stop crawl");
            setIsCancellingCrawl(false);
        }
    }

    function toggleCrawledPath(path: string) {
        setSelectedCrawledPaths((current) =>
            current.includes(path)
                ? current.filter((item) => item !== path)
                : [...current, path]
        );
    }

    function selectAllCrawledPages() {
        setSelectedCrawledPaths(crawlResult?.pages.map((page) => page.path) ?? []);
    }

    /** Phase 40 (TFP-172): back to the pages selected by type for the run type. */
    function selectCrawledPagesByType() {
        setManualCrawledPaths(null);
    }

    function clearCrawledPageSelection() {
        setSelectedCrawledPaths([]);
    }

    function toggleCrawlExtension(extension: string) {
        setSelectedCrawlExtensions((current) =>
            current.includes(extension)
                ? current.filter((item) => item !== extension)
                : [...current, extension]
        );
    }

    function selectVisibleCrawledPages(paths: string[]) {
        setSelectedCrawledPaths((current) => [...new Set([...current, ...paths])]);
    }

    const isCrawling = crawlStatus === "crawling";
    const normalizedBaseUrlForDisplay = normalizeBaseUrl(baseUrl);
    const crawledPages = crawlResult?.pages ?? [];
    const activeCrawlProgress = isCrawling ? crawlProgress : null;
    const crawlVisitedCount = activeCrawlProgress?.visitedUrls ?? 0;
    const crawlQueuedCount = activeCrawlProgress?.queuedUrls ?? 0;
    const crawlDiscoveredCount = activeCrawlProgress?.discoveredPages ?? 0;
    const crawlKnownWork = Math.min(
        activeCrawlProgress?.maxPages ?? 0,
        crawlVisitedCount + crawlQueuedCount + (activeCrawlProgress?.currentUrl ? 1 : 0)
    );
    const crawlProgressPercent = activeCrawlProgress
        ? crawlKnownWork > 0
            ? Math.min(99, Math.max(5, Math.round((crawlVisitedCount / crawlKnownWork) * 100)))
            : 5
        : 0;
    const crawlElapsedLabel = formatMilliseconds(crawlDurationMs);
    const activeCrawlLabel = activeCrawlProgress?.currentTitle
        ?? activeCrawlProgress?.currentPath
        ?? activeCrawlProgress?.currentUrl
        ?? activeCrawlProgress?.lastCompletedTitle
        ?? activeCrawlProgress?.lastCompletedPath
        ?? "Preparing the first page...";
    const hasActiveCrawlSelection = Boolean(
        normalizedBaseUrlForDisplay.ok &&
        crawlResult?.baseUrl === normalizedBaseUrlForDisplay.value &&
        selectedCrawledPaths.length > 0
    );
    const isCrawlResultStale = Boolean(
        crawlResult && normalizedBaseUrlForDisplay.ok && crawlResult.baseUrl !== normalizedBaseUrlForDisplay.value
    );
    const crawlExtensionOptions = [...new Set(crawledPages.map((page) => getPathExtension(page.path)))].sort(
        (left, right) => {
            if (left === "(no extension)") {
                return 1;
            }

            if (right === "(no extension)") {
                return -1;
            }

            return left.localeCompare(right);
        }
    );
    const normalizedCrawlSearchQuery = crawlSearchQuery.trim().toLowerCase();
    const filteredCrawledPages = crawledPages.filter((page) => {
        const pageExtension = getPathExtension(page.path);
        const matchesExtension =
            selectedCrawlExtensions.length === 0 || selectedCrawlExtensions.includes(pageExtension);
        const matchesSearch =
            normalizedCrawlSearchQuery.length === 0 ||
            page.path.toLowerCase().includes(normalizedCrawlSearchQuery) ||
            page.url.toLowerCase().includes(normalizedCrawlSearchQuery) ||
            page.title.toLowerCase().includes(normalizedCrawlSearchQuery) ||
            (page.discoveredFrom?.toLowerCase().includes(normalizedCrawlSearchQuery) ?? false);

        return matchesExtension && matchesSearch;
    });
    const filteredCrawledPaths = filteredCrawledPages.map((page) => page.path);

    return {
        crawlResult,
        selectedCrawledPaths,
        crawlSearchQuery,
        setCrawlSearchQuery,
        selectedCrawlExtensions,
        setSelectedCrawlExtensions,
        crawlStatus,
        isCrawling,
        activeCrawlId,
        crawlDurationMs,
        crawlRunStatus,
        isCancellingCrawl,
        crawlError,
        setCrawlError,
        isCrawledPagesCollapsed,
        setIsCrawledPagesCollapsed,
        crawledPages,
        activeCrawlProgress,
        crawlVisitedCount,
        crawlQueuedCount,
        crawlDiscoveredCount,
        crawlProgressPercent,
        crawlElapsedLabel,
        activeCrawlLabel,
        hasActiveCrawlSelection,
        isCrawlResultStale,
        crawlExtensionOptions,
        filteredCrawledPages,
        filteredCrawledPaths,
        handleCrawlPages,
        handleStopCrawl,
        toggleCrawledPath,
        selectAllCrawledPages,
        selectCrawledPagesByType,
        isTypeSelection: manualCrawledPaths === null && Boolean(crawlResult?.rankedTypes?.length),
        clearCrawledPageSelection,
        toggleCrawlExtension,
        selectVisibleCrawledPages,
    };
}
