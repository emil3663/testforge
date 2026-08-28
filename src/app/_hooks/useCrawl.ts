import { useEffect, useState } from "react";
import { getPathExtension, normalizeBaseUrl } from "@/app/_lib/derive";
import { formatMilliseconds } from "@/lib/report/text";
import type { CrawlLifecycleStatus, CrawlProgressSnapshot, CrawlResult, CrawlStatusSnapshot } from "@/app/_lib/types";

export function useCrawl(baseUrl: string) {
    const [crawlResult, setCrawlResult] = useState<CrawlResult | null>(null);
    const [selectedCrawledPaths, setSelectedCrawledPaths] = useState<string[]>([]);
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

        const pollCrawlStatus = async () => {
            try {
                const response = await fetch(`/api/crawl?crawlId=${encodeURIComponent(activeCrawlId)}`, {
                    cache: "no-store",
                });
                const data = (await response.json()) as CrawlStatusSnapshot | { error?: string };

                if (!response.ok) {
                    throw new Error("error" in data ? data.error ?? "Site crawl failed" : "Site crawl failed");
                }

                if (ignore) {
                    return;
                }

                const snapshot = data as CrawlStatusSnapshot;
                setCrawlProgress(snapshot.progress);
                setCrawlDurationMs(snapshot.duration);
                setCrawlRunStatus(snapshot.crawlStatus);

                if (snapshot.result) {
                    setCrawlResult(snapshot.result);
                    setSelectedCrawledPaths(snapshot.result.pages.map((page) => page.path));
                    setCrawlSearchQuery("");
                    setSelectedCrawlExtensions([]);
                    setIsCrawledPagesCollapsed(false);
                    setActiveCrawlId(null);
                    setIsCancellingCrawl(false);
                    setCrawlStatus("idle");
                    return;
                }

                if (snapshot.crawlStatus === "failed") {
                    setCrawlError(snapshot.error ?? "Site crawl failed");
                    setActiveCrawlId(null);
                    setIsCancellingCrawl(false);
                    setCrawlStatus("idle");
                    return;
                }

                timer = window.setTimeout(pollCrawlStatus, 500);
            } catch (err: unknown) {
                if (ignore) {
                    return;
                }

                setCrawlError(err instanceof Error ? err.message : "Site crawl failed");
                setActiveCrawlId(null);
                setIsCancellingCrawl(false);
                setCrawlStatus("idle");
            }
        };

        void pollCrawlStatus();

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
        clearCrawledPageSelection,
        toggleCrawlExtension,
        selectVisibleCrawledPages,
    };
}
