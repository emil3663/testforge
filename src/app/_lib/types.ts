import type { RunReport } from "@/lib/report/types";
import type { BEST_PRACTICE_OPTIONS } from "@/app/_lib/constants";

export type Step = "idle" | "generating" | "ready" | "running" | "done";

export type CrawlLifecycleStatus = "running" | "completed" | "failed" | "cancelled";

export type TestAuditMode = "fast" | "deep";

export type RunLifecycleStatus = "queued" | "running" | "passed" | "failed" | "cancelled";

export type ReportTab =
    | "summary"
    | "execution"
    | "defects"
    | "coverage"
    | "performance"
    | "usability"
    | "seo";

export type BestPracticeArea = (typeof BEST_PRACTICE_OPTIONS)[number]["id"];

export interface RunResult {
    runId: string;
    runStatus: Exclude<RunLifecycleStatus, "queued" | "running">;
    passed: boolean;
    output: string;
    duration: number;
    progress: RunProgressSnapshot;
    report?: RunReport;
}

export interface RunProgressSnapshot {
    totalTests: number;
    startedTests: number;
    completedTests: number;
    passedTests: number;
    failedTests: number;
    flakyTests: number;
    blockedTests: number;
    currentTestTitle: string | null;
    currentLinkLabel: string | null;
    lastCompletedTitle: string | null;
    activeExecutions: {
        id: string;
        title: string;
        linkLabel: string | null;
    }[];
    plannedExecutions: {
        id: string;
        title: string;
        linkLabel: string | null;
        status: "not-run" | "running" | "passed" | "failed" | "flaky" | "blocked" | "interrupted";
        duration: number | null;
    }[];
}

export interface RunStatusSnapshot {
    runId: string;
    runStatus: RunLifecycleStatus;
    duration: number;
    progress: RunProgressSnapshot;
    cancellationRequested: boolean;
    result?: RunResult;
}

export interface SavedSuiteResult {
    fileName: string;
    filePath: string;
    suiteTitles: string[];
}

export interface ContentProfilePage {
    path: string;
    url: string;
    title: string;
    metaDescription: string;
    headings: string[];
    buttons: string[];
    links: string[];
    actionableElements?: {
        text: string;
        url: string | null;
        category: "navigation" | "api" | "form" | "action";
        elementType: "link" | "button" | "input" | "select" | "textarea" | "form";
        containerLabel: string;
        expectedStatus: number | null;
        locator: {
            role: string | null;
            name: string;
            label: string;
            placeholder: string;
            id: string;
            inputType: string;
        };
    }[];
    linkDetails?: {
        text: string;
        url: string;
        rawHref?: string;
        category: "navigation" | "api";
        linkType?: "internal" | "external" | "anchor" | "mailto" | "download";
        containerLabel: string;
        expectedStatus: number | null;
        isVisible?: boolean;
        targetBehavior?: "same-window" | "new-tab" | "new-window";
    }[];
    embeddedLinkDetails?: {
        text: string;
        url: string;
        rawValue: string;
        tagName: string;
        attributeName: string;
        kind: "iframe" | "frame" | "image" | "script" | "stylesheet" | "media" | "document" | "form" | "button" | "data" | "interactive";
        source: "dom" | "heuristic";
        containerLabel: string;
        sameOrigin: boolean;
        isVisible: boolean;
    }[];
    visibleTextSnippets: string[];
}

export interface ContentProfile {
    scannedAt: string;
    baseUrl: string;
    pages: ContentProfilePage[];
    warnings?: string[];
}

export interface CrawledPage {
    path: string;
    url: string;
    title: string;
    discoveredFrom: string | null;
}

export interface CrawlResult {
    crawledAt: string;
    baseUrl: string;
    pageCount: number;
    pages: CrawledPage[];
    warnings?: string[];
}

export interface CrawlProgressSnapshot {
    maxPages: number;
    visitedUrls: number;
    queuedUrls: number;
    discoveredPages: number;
    warningsCount: number;
    currentUrl: string | null;
    currentPath: string | null;
    currentTitle: string | null;
    lastCompletedPath: string | null;
    lastCompletedTitle: string | null;
}

export interface CrawlStatusSnapshot {
    crawlId: string;
    crawlStatus: CrawlLifecycleStatus;
    duration: number;
    progress: CrawlProgressSnapshot;
    result?: CrawlResult;
    error?: string;
}

export interface BusyInspectionTarget {
    path: string;
    url: string;
    title: string;
}
