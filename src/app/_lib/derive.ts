import { BEST_PRACTICE_OPTIONS, BEST_PRACTICE_KEYWORDS, DEFAULT_BASE_URL } from "@/app/_lib/constants";
import type { NamedFlow } from "@/lib/introspect/types";
import { formatMilliseconds } from "@/lib/report/text";
import type { BestPracticeArea, BusyInspectionTarget, ContentProfile, ContentProfilePage, CrawledPage, RunProgressSnapshot, RunResult, TestAuditMode } from "@/app/_lib/types";

export function getContinuationExcludedTitles(result: RunResult | null) {
    if (!result || result.runStatus !== "cancelled") {
        return [] as string[];
    }

    if (result.report) {
        return [...new Set(result.report.execution.map((record) => record.title).filter((title) => title.trim().length > 0))];
    }

    return [...new Set(
        (result.progress.plannedExecutions ?? [])
            .filter((execution) => ["passed", "failed", "flaky", "blocked"].includes(execution.status))
            .map((execution) => execution.title)
            .filter((title) => title.trim().length > 0)
    )];
}

export function parseContentLines(value: string) {
    return [...new Set(
        value
            .split(/\r?\n|,/)
            .map((item) => item.trim())
            .filter(Boolean)
    )];
}

// TFP-096: one named flow per line, "label: /entry -> /exit" (also accepts
// the arrow characters and =>). Split on newlines only, unlike the other
// content-rule lists, because a label may legitimately contain a comma.
// A line that does not match is returned in invalidLines rather than
// silently dropped, so the UI can say which line was not understood.
const NAMED_FLOW_LINE = /^(.+?)\s*:\s*(\S+)\s*(?:->|=>|→)\s*(\S+)$/;

export function parseNamedFlowLines(value: string) {
    const flows: NamedFlow[] = [];
    const invalidLines: string[] = [];

    for (const line of value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)) {
        const match = NAMED_FLOW_LINE.exec(line);

        if (!match) {
            invalidLines.push(line);
            continue;
        }

        const withSlash = (path: string) => (path.startsWith("/") ? path : `/${path}`);
        flows.push({ label: match[1].trim(), entryPath: withSlash(match[2]), exitPath: withSlash(match[3]) });
    }

    return { flows, invalidLines };
}

export function includesKeyword(text: string, keyword: string) {
    if (/^[a-z0-9]+$/i.test(keyword)) {
        return new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text);
    }

    return text.includes(keyword);
}

export function inferBestPracticesFromDescription(description: string) {
    const normalizedDescription = description.toLowerCase();

    if (!normalizedDescription.trim()) {
        return [] as BestPracticeArea[];
    }

    return BEST_PRACTICE_OPTIONS
        .map((option) => option.id)
        .filter((practice) =>
            BEST_PRACTICE_KEYWORDS[practice].some((keyword) =>
                includesKeyword(normalizedDescription, keyword)
            )
        );
}

export function buildSelectedPracticeDescription(practices: BestPracticeArea[]) {
    if (practices.length === 0) {
        return "";
    }

    const labels = BEST_PRACTICE_OPTIONS
        .filter((option) => practices.includes(option.id))
        .map((option) => option.label.toLowerCase());

    return `Generate a test suite covering ${labels.join(", ")}.`;
}

export function normalizeBaseUrl(value: string) {
    const trimmed = value.trim();

    if (!trimmed) {
        return { ok: true as const, value: DEFAULT_BASE_URL };
    }

    const withProtocol = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(trimmed)
        ? trimmed
        : `http://${trimmed}`;

    try {
        const normalized = new URL(withProtocol);
        normalized.hash = "";
        return {
            ok: true as const,
            value: normalized.toString().replace(/\/$/, ""),
        };
    } catch {
        return {
            ok: false as const,
            message: "Enter a valid base URL like http://localhost:3000",
        };
    }
}

export function getLinkPreviewLabel(link: NonNullable<ContentProfilePage["linkDetails"]>[number]) {
    return link.text.trim() || link.rawHref?.trim() || link.url.trim();
}

export function getEmbeddedPreviewLabel(embeddedLink: NonNullable<ContentProfilePage["embeddedLinkDetails"]>[number]) {
    return embeddedLink.text.trim() || embeddedLink.rawValue.trim() || embeddedLink.url.trim();
}

export function getDefaultInspectionPath(baseUrl: string) {
    try {
        const pathname = new URL(baseUrl).pathname || "/";
        return pathname === "/" ? "/" : pathname.replace(/\/$/, "");
    } catch {
        return "/";
    }
}

export function normalizeInspectionPaths(baseUrl: string, manualPaths: string[], selectedPaths: string[]) {
    if (selectedPaths.length > 0) {
        return [...new Set(selectedPaths.map((path) => (path.startsWith("/") ? path : `/${path}`)))];
    }

    if (manualPaths.length > 0) {
        return [...new Set(manualPaths.map((path) => (path.startsWith("/") ? path : `/${path}`)))];
    }

    return [getDefaultInspectionPath(baseUrl)];
}

export function buildBusyInspectionTargets(
    baseUrl: string,
    paths: string[],
    crawledPages: CrawledPage[]
) {
    const pageTitleByPath = new Map(
        crawledPages.map((page) => [page.path, page.title.trim()])
    );

    return [...new Map(
        paths.map((path) => {
            const normalizedPath = path.startsWith("/") ? path : `/${path}`;
            let url = normalizedPath;

            try {
                url = new URL(normalizedPath, baseUrl).toString();
            } catch {
                url = normalizedPath;
            }

            return [url, {
                path: normalizedPath,
                url,
                title: pageTitleByPath.get(normalizedPath) ?? "",
            } satisfies BusyInspectionTarget];
        })
    ).values()];
}

export function getPathExtension(path: string) {
    const cleanedPath = path.split(/[?#]/, 1)[0] ?? path;
    const lastSegment = cleanedPath.split("/").filter(Boolean).pop() ?? "";
    const match = /\.([a-z0-9]+)$/i.exec(lastSegment);

    return match ? `.${match[1].toLowerCase()}` : "(no extension)";
}

export function deriveContentInsights(contentProfile: ContentProfile | null, auditMode: TestAuditMode) {
    const discoveredLinkDetails = contentProfile?.pages.flatMap((page) => page.linkDetails ?? []) ?? [];
    const uniqueDiscoveredLinks = discoveredLinkDetails.filter(
        (link, index, allLinks) =>
            allLinks.findIndex(
                (candidate) =>
                    candidate.url === link.url &&
                    candidate.rawHref === link.rawHref &&
                    candidate.category === link.category &&
                    candidate.containerLabel === link.containerLabel &&
                    getLinkPreviewLabel(candidate) === getLinkPreviewLabel(link)
            ) === index
    );
    const displayedDiscoveredLinks = auditMode === "deep"
        ? uniqueDiscoveredLinks
        : uniqueDiscoveredLinks.filter((link) => link.isVisible ?? true);
    const discoveredLinkGroups = [
        {
            title: "Opens New Tab",
            links: displayedDiscoveredLinks.filter(
                (link) => link.targetBehavior === "new-tab" || link.targetBehavior === "new-window"
            ),
        },
        {
            title: "Sends API Call",
            links: displayedDiscoveredLinks.filter((link) => link.category === "api"),
        },
        {
            title: "Other Visible Navigation Links",
            links: displayedDiscoveredLinks.filter(
                (link) => link.category !== "api" && link.targetBehavior !== "new-tab" && link.targetBehavior !== "new-window"
            ),
        },
    ].filter((group) => group.links.length > 0);
    const discoveredLinkCount = displayedDiscoveredLinks.length;
    const discoveredLinkPages = (contentProfile?.pages ?? [])
        .map((page) => ({
            path: page.path,
            count: auditMode === "deep"
                ? (page.linkDetails ?? []).length
                : (page.linkDetails ?? []).filter((link) => link.isVisible ?? true).length,
        }))
        .filter((page) => page.count > 0);
    const discoveredEmbeddedLinkDetails = contentProfile?.pages.flatMap((page) => page.embeddedLinkDetails ?? []) ?? [];
    const uniqueDiscoveredEmbeddedLinks = discoveredEmbeddedLinkDetails.filter(
        (embeddedLink, index, allEmbeddedLinks) =>
            allEmbeddedLinks.findIndex(
                (candidate) =>
                    candidate.url === embeddedLink.url &&
                    candidate.rawValue === embeddedLink.rawValue &&
                    candidate.tagName === embeddedLink.tagName &&
                    candidate.attributeName === embeddedLink.attributeName &&
                    candidate.source === embeddedLink.source &&
                    candidate.containerLabel === embeddedLink.containerLabel
            ) === index
    );
    const displayedDiscoveredEmbeddedLinks = auditMode === "deep" ? uniqueDiscoveredEmbeddedLinks : [];
    const discoveredEmbeddedLinkCount = displayedDiscoveredEmbeddedLinks.length;
    const discoveredEmbeddedLinkPages = (contentProfile?.pages ?? [])
        .map((page) => ({
            path: page.path,
            count: auditMode === "deep" ? (page.embeddedLinkDetails ?? []).length : 0,
        }))
        .filter((page) => page.count > 0);

    return {
        discoveredLinkCount,
        discoveredEmbeddedLinkCount,
        discoveredLinkPages,
        discoveredEmbeddedLinkPages,
        displayedDiscoveredLinks,
        discoveredLinkGroups,
        displayedDiscoveredEmbeddedLinks,
    };
}

export function deriveBusyInspectionTargets(
    isRunning: boolean,
    busyBaseUrl: string,
    busyInspectionPaths: string[],
    lastGeneratedInspectionTargets: BusyInspectionTarget[],
    crawlResultBaseUrl: string | undefined,
    crawledPages: CrawledPage[]
) {
    const busyInspectionTargets = isRunning
        ? lastGeneratedInspectionTargets
        : buildBusyInspectionTargets(
            busyBaseUrl,
            busyInspectionPaths,
            crawlResultBaseUrl === busyBaseUrl ? crawledPages : []
        );

    return {
        busyInspectionTargets,
        busyInspectionTargetsPreview: busyInspectionTargets.slice(0, 3),
        remainingBusyInspectionTargets: busyInspectionTargets.slice(3),
    };
}

export function deriveRunProgressDisplay(
    activeRunProgress: RunProgressSnapshot | null,
    runDurationMs: number,
    isCancellingRun: boolean
) {
    const runTotalTests = Math.max(activeRunProgress?.totalTests ?? 0, 0);
    const runCompletedTests = Math.max(activeRunProgress?.completedTests ?? 0, 0);
    const runProgressPercent = runTotalTests > 0
        ? Math.min(100, Math.round((runCompletedTests / runTotalTests) * 100))
        : 0;
    const runElapsedLabel = formatMilliseconds(runDurationMs);
    const estimatedRemainingMs =
        runTotalTests > 0 && runCompletedTests > 0 && runCompletedTests < runTotalTests
            ? Math.max(0, Math.round((runDurationMs / runCompletedTests) * (runTotalTests - runCompletedTests)))
            : null;
    const runRemainingLabel =
        estimatedRemainingMs === null
            ? isCancellingRun
                ? "Stopping..."
                : "Estimating..."
            : formatMilliseconds(estimatedRemainingMs);

    return { runTotalTests, runCompletedTests, runProgressPercent, runElapsedLabel, runRemainingLabel };
}
