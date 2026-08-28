"use client";

import { Fragment, type ReactNode, useEffect, useRef, useState } from "react";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, getSiteUrl } from "@/lib/seo";
import { buildReportHtmlDocument, buildResultHtmlDocument } from "@/lib/report/html";
import {
    fallbackStatusClasses,
    getFallbackExecutionRecords,
} from "@/lib/report/status";
import { formatMilliseconds } from "@/lib/report/text";
import type {
    CoverageMatrixItem,
    DefectRecord,
    ExecutionRecord,
    ExecutionStatus,
    ReportArtifactItem,
    RunReport,
    SeoRecommendation,
} from "@/lib/report/types";

type Step = "idle" | "generating" | "ready" | "running" | "done";
type CrawlLifecycleStatus = "running" | "completed" | "failed" | "cancelled";
type TestAuditMode = "fast" | "deep";
type RunLifecycleStatus = "queued" | "running" | "passed" | "failed" | "cancelled";
type ReportTab =
    | "summary"
    | "execution"
    | "defects"
    | "coverage"
    | "performance"
    | "usability"
    | "seo";

const BEST_PRACTICE_OPTIONS = [
    {
        id: "functional",
        label: "Functional",
        description: "Forms, links, navigation, and core flows",
    },
    {
        id: "responsive/mobile",
        label: "Responsive",
        description: "Phone, tablet, and desktop viewports",
    },
    {
        id: "performance/load",
        label: "Performance",
        description: "Response-time and basic load checks",
    },
    {
        id: "security",
        label: "Security",
        description: "HTTPS and browser-visible safety checks",
    },
    {
        id: "accessibility",
        label: "Accessibility",
        description: "Headings, labels, and basic a11y smoke",
    },
    {
        id: "usability",
        label: "Usability",
        description: "Clarity, navigation, and visible guidance",
    },
    {
        id: "seo/content",
        label: "SEO",
        description: "Title, content structure, and meta signals",
    },
    {
        id: "cookie/session",
        label: "Cookies",
        description: "Session and browser cookie inspection",
    },
    {
        id: "database",
        label: "Database",
        description: "Persistence follow-up for save/update flows",
    },
] as const;

type BestPracticeArea = (typeof BEST_PRACTICE_OPTIONS)[number]["id"];

const DEFAULT_BASE_URL = "http://localhost:3000";
const DEFAULT_DESCRIPTION_EXAMPLE = "E.g. Create an accessibility and performance suite for the login flow.";
const DEFAULT_TEST_AUDIT_MODE: TestAuditMode = "fast";
const BASE_REPORT_TABS: ReportTab[] = [
    "summary",
    "execution",
    "defects",
    "coverage",
    "performance",
    "usability",
];

const TEST_AUDIT_MODE_OPTIONS: Array<{
    id: TestAuditMode;
    label: string;
    description: string;
}> = [
        {
            id: "fast",
            label: "Fast",
            description: "Caps per-page link-click checks and keeps generation focused on the highest-value audits.",
        },
        {
            id: "deep",
            label: "Deep",
            description: "Keeps the broader per-link navigation coverage for slower, more exhaustive suites.",
        },
    ];

const BEST_PRACTICE_KEYWORDS: Record<BestPracticeArea, string[]> = {
    functional: ["functional", "flow", "journey", "form", "forms", "navigation", "link", "links"],
    "responsive/mobile": [
        "responsive",
        "mobile",
        "tablet",
        "desktop",
        "viewport",
        "screen size",
    ],
    "performance/load": [
        "performance",
        "load",
        "load time",
        "speed",
        "response time",
    ],
    security: ["security", "https", "ssl", "csrf", "xss", "auth"],
    accessibility: ["accessibility", "a11y", "wcag", "screen reader", "keyboard"],
    usability: ["usability", "user-friendly", "user friendly", "guidance", "clarity", "navigation"],
    "seo/content": ["seo", "content", "meta", "heading", "headings", "title"],
    "cookie/session": ["cookie", "cookies", "session", "login", "authentication"],
    database: ["database", "persist", "persistence", "save", "saved", "update"],
};


interface RunResult {
    runId: string;
    runStatus: Exclude<RunLifecycleStatus, "queued" | "running">;
    passed: boolean;
    output: string;
    duration: number;
    progress: RunProgressSnapshot;
    report?: RunReport;
}

interface RunProgressSnapshot {
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

interface RunStatusSnapshot {
    runId: string;
    runStatus: RunLifecycleStatus;
    duration: number;
    progress: RunProgressSnapshot;
    cancellationRequested: boolean;
    result?: RunResult;
}

function getContinuationExcludedTitles(result: RunResult | null) {
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


function livePlannedExecutionStatusLabel(
    status: RunProgressSnapshot["plannedExecutions"][number]["status"]
) {
    if (status === "passed") {
        return "Passed";
    }

    if (status === "failed") {
        return "Failed";
    }

    if (status === "flaky") {
        return "Flaky";
    }

    if (status === "blocked") {
        return "Blocked";
    }

    if (status === "interrupted") {
        return "Interrupted";
    }

    if (status === "running") {
        return "Running";
    }

    return "Queued";
}

function livePlannedExecutionStatusClasses(
    status: RunProgressSnapshot["plannedExecutions"][number]["status"]
) {
    if (status === "passed") {
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
    }

    if (status === "failed") {
        return "bg-rose-100 text-rose-800 border-rose-200";
    }

    if (status === "flaky") {
        return "bg-sky-100 text-sky-800 border-sky-200";
    }

    if (status === "blocked") {
        return "bg-amber-100 text-amber-800 border-amber-200";
    }

    if (status === "interrupted") {
        return "bg-orange-100 text-orange-800 border-orange-200";
    }

    if (status === "running") {
        return "bg-indigo-100 text-indigo-800 border-indigo-200";
    }

    return "bg-zinc-100 text-zinc-700 border-zinc-200";
}


interface SavedSuiteResult {
    fileName: string;
    filePath: string;
    suiteTitles: string[];
}

interface ContentProfilePage {
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

interface ContentProfile {
    scannedAt: string;
    baseUrl: string;
    pages: ContentProfilePage[];
    warnings?: string[];
}

interface CrawledPage {
    path: string;
    url: string;
    title: string;
    discoveredFrom: string | null;
}

interface CrawlResult {
    crawledAt: string;
    baseUrl: string;
    pageCount: number;
    pages: CrawledPage[];
    warnings?: string[];
}

interface CrawlProgressSnapshot {
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

interface CrawlStatusSnapshot {
    crawlId: string;
    crawlStatus: CrawlLifecycleStatus;
    duration: number;
    progress: CrawlProgressSnapshot;
    result?: CrawlResult;
    error?: string;
}

interface BusyInspectionTarget {
    path: string;
    url: string;
    title: string;
}

function parseContentLines(value: string) {
    return [...new Set(
        value
            .split(/\r?\n|,/)
            .map((item) => item.trim())
            .filter(Boolean)
    )];
}

function includesKeyword(text: string, keyword: string) {
    if (/^[a-z0-9]+$/i.test(keyword)) {
        return new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text);
    }

    return text.includes(keyword);
}

function inferBestPracticesFromDescription(description: string) {
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

function buildSelectedPracticeDescription(practices: BestPracticeArea[]) {
    if (practices.length === 0) {
        return "";
    }

    const labels = BEST_PRACTICE_OPTIONS
        .filter((option) => practices.includes(option.id))
        .map((option) => option.label.toLowerCase());

    return `Generate a test suite covering ${labels.join(", ")}.`;
}

function normalizeBaseUrl(value: string) {
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

function getLinkPreviewLabel(link: NonNullable<ContentProfilePage["linkDetails"]>[number]) {
    return link.text.trim() || link.rawHref?.trim() || link.url.trim();
}

function getEmbeddedPreviewLabel(embeddedLink: NonNullable<ContentProfilePage["embeddedLinkDetails"]>[number]) {
    return embeddedLink.text.trim() || embeddedLink.rawValue.trim() || embeddedLink.url.trim();
}

function getDefaultInspectionPath(baseUrl: string) {
    try {
        const pathname = new URL(baseUrl).pathname || "/";
        return pathname === "/" ? "/" : pathname.replace(/\/$/, "");
    } catch {
        return "/";
    }
}

function normalizeInspectionPaths(baseUrl: string, manualPaths: string[], selectedPaths: string[]) {
    if (selectedPaths.length > 0) {
        return [...new Set(selectedPaths.map((path) => (path.startsWith("/") ? path : `/${path}`)))];
    }

    if (manualPaths.length > 0) {
        return [...new Set(manualPaths.map((path) => (path.startsWith("/") ? path : `/${path}`)))];
    }

    return [getDefaultInspectionPath(baseUrl)];
}

function buildBusyInspectionTargets(
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

function getPathExtension(path: string) {
    const cleanedPath = path.split(/[?#]/, 1)[0] ?? path;
    const lastSegment = cleanedPath.split("/").filter(Boolean).pop() ?? "";
    const match = /\.([a-z0-9]+)$/i.exec(lastSegment);

    return match ? `.${match[1].toLowerCase()}` : "(no extension)";
}


function ensureSentence(value: string) {
    const trimmed = value.trim();

    if (!trimmed) {
        return "";
    }

    return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function formatExecutionRemark(record: ExecutionRecord) {
    const trimmed = record.remarks.trim();

    if (!trimmed) {
        return record.status === "Passed"
            ? "Passed. The observed result matched the expected result."
            : record.status === "Flaky"
                ? "Passed after retry. The observed result was unstable before it recovered."
                : record.status === "Blocked"
                    ? "Blocked. The test could not be completed."
                    : "Failed. The observed result did not match the expected result.";
    }

    return ensureSentence(trimmed);
}

function summarizeSuite(records: ExecutionRecord[]) {
    return records.reduce(
        (summary, record) => {
            summary[record.status] += 1;
            return summary;
        },
        { Passed: 0, Failed: 0, Blocked: 0, Flaky: 0 } as Record<ExecutionStatus, number>
    );
}

function statusClasses(status: ExecutionStatus) {
    if (status === "Passed") {
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
    }

    if (status === "Failed") {
        return "bg-rose-100 text-rose-800 border-rose-200";
    }

    if (status === "Blocked") {
        return "bg-amber-100 text-amber-800 border-amber-200";
    }

    return "bg-sky-100 text-sky-800 border-sky-200";
}

function FallbackExecutionTable({ progress }: { progress: RunProgressSnapshot }) {
    const records = getFallbackExecutionRecords(progress);

    if (records.length === 0) {
        return null;
    }

    return (
        <div className="mt-4 space-y-3">
            {records.map((record) => (
                <article key={record.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <div className="text-sm font-semibold text-zinc-950">{record.title}</div>
                            {record.linkLabel ? (
                                <div className="mt-1 text-xs text-zinc-500">Target: {record.linkLabel}</div>
                            ) : null}
                        </div>
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${fallbackStatusClasses(record.status)}`}>
                            {record.status}
                        </span>
                    </div>
                    <div className="mt-3 inline-flex rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700">
                        Duration: {record.duration !== null ? formatMilliseconds(record.duration) : "Not captured"}
                    </div>
                    <div className="mt-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm leading-6 text-zinc-600">
                        {record.remarks}
                    </div>
                </article>
            ))}
        </div>
    );
}

function coverageClasses(status: CoverageMatrixItem["status"]) {
    if (status === "covered") {
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
    }

    if (status === "partial") {
        return "bg-amber-100 text-amber-800 border-amber-200";
    }

    return "bg-rose-100 text-rose-800 border-rose-200";
}

function recommendationClasses(priority: SeoRecommendation["priority"]) {
    if (priority === "High") {
        return "border-rose-200 bg-rose-50 text-rose-700";
    }

    if (priority === "Medium") {
        return "border-amber-200 bg-amber-50 text-amber-700";
    }

    return "border-sky-200 bg-sky-50 text-sky-700";
}

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
    const [editedCode, setEditedCode] = useState("");
    const [editing, setEditing] = useState(false);
    const [result, setResult] = useState<RunResult | null>(null);
    const [error, setError] = useState("");
    const [copyLabel, setCopyLabel] = useState("Copy");
    const [rawOutputCopyLabel, setRawOutputCopyLabel] = useState("Copy raw output");
    const [rawOutputExportLabel, setRawOutputExportLabel] = useState("Export raw output");
    const [htmlReportExportLabel, setHtmlReportExportLabel] = useState("Save report as HTML");
    const [saveLabel, setSaveLabel] = useState("Add to Test Explorer");
    const [reportPopupNotice, setReportPopupNotice] = useState("");
    const [savedSuite, setSavedSuite] = useState<SavedSuiteResult | null>(null);
    const [activeTab, setActiveTab] = useState<ReportTab>("summary");
    const [openReportInNewPage, setOpenReportInNewPage] = useState(false);
    const [selectedSeoPageKey, setSelectedSeoPageKey] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<"All" | ExecutionStatus>("All");
    const [selectedFailedRerunTitles, setSelectedFailedRerunTitles] = useState<string[]>([]);
    const [contentPathsInput, setContentPathsInput] = useState("");
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
    const [requiredHeadingsInput, setRequiredHeadingsInput] = useState("");
    const [requiredTextInput, setRequiredTextInput] = useState("");
    const [forbiddenTextInput, setForbiddenTextInput] = useState("");
    const [auditMode, setAuditMode] = useState<TestAuditMode>(DEFAULT_TEST_AUDIT_MODE);
    const [contentProfile, setContentProfile] = useState<ContentProfile | null>(null);
    const [lastGeneratedContentSignature, setLastGeneratedContentSignature] = useState("");
    const [lastGeneratedBaseUrl, setLastGeneratedBaseUrl] = useState(DEFAULT_BASE_URL);
    const [lastGeneratedInspectionPaths, setLastGeneratedInspectionPaths] = useState<string[]>(["/"]);
    const [lastGeneratedInspectionTargets, setLastGeneratedInspectionTargets] = useState<BusyInspectionTarget[]>([]);
    const [lastGeneratedAuditMode, setLastGeneratedAuditMode] = useState<TestAuditMode>(DEFAULT_TEST_AUDIT_MODE);
    const [lastGeneratedPracticeSignature, setLastGeneratedPracticeSignature] = useState("[]");
    const [activeRunId, setActiveRunId] = useState<string | null>(null);
    const [runProgress, setRunProgress] = useState<RunProgressSnapshot | null>(null);
    const [runStatus, setRunStatus] = useState<RunLifecycleStatus | null>(null);
    const [runDurationMs, setRunDurationMs] = useState(0);
    const [isCancellingRun, setIsCancellingRun] = useState(false);
    const [isCreationCollapsed, setIsCreationCollapsed] = useState(false);
    const [isGeneratedCollapsed, setIsGeneratedCollapsed] = useState(false);
    const [isReportCollapsed, setIsReportCollapsed] = useState(false);
    const [isContentRulesCollapsed, setIsContentRulesCollapsed] = useState(true);
    const [isCrawledPagesCollapsed, setIsCrawledPagesCollapsed] = useState(false);
    const [isBusyTargetListExpanded, setIsBusyTargetListExpanded] = useState(false);
    const codeRef = useRef<HTMLTextAreaElement>(null);
    const autoOpenedReportRunIdRef = useRef<string | null>(null);
    const reportWindowRef = useRef<Window | null>(null);
    const plannedExecutionListRef = useRef<HTMLDivElement>(null);
    const plannedExecutionItemRefs = useRef<Record<string, HTMLDivElement | null>>({});

    useEffect(() => {
        if (editing && codeRef.current) {
            codeRef.current.focus();
        }
    }, [editing]);

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

    useEffect(() => {
        if (step !== "running" || !activeRunId) {
            return;
        }

        let ignore = false;
        let timer: number | null = null;

        const pollRunStatus = async () => {
            try {
                const response = await fetch(`/api/run?runId=${encodeURIComponent(activeRunId)}`, {
                    cache: "no-store",
                });
                const data = (await response.json()) as RunStatusSnapshot | { error?: string };

                if (!response.ok) {
                    throw new Error("error" in data ? data.error ?? "Run status check failed" : "Run status check failed");
                }

                if (ignore) {
                    return;
                }

                const snapshot = data as RunStatusSnapshot;
                setRunProgress(snapshot.progress);
                setRunStatus(snapshot.runStatus);
                setRunDurationMs(snapshot.duration);
                setIsCancellingRun(snapshot.cancellationRequested);

                if (snapshot.result) {
                    setResult(snapshot.result);
                    setStep("done");
                    setActiveRunId(null);
                    setIsCancellingRun(false);
                    return;
                }

                timer = window.setTimeout(pollRunStatus, 800);
            } catch (err: unknown) {
                if (ignore) {
                    return;
                }

                setError(err instanceof Error ? err.message : "Run status check failed");
                setStep("ready");
                setActiveRunId(null);
                setRunProgress(null);
                setRunStatus(null);
                setRunDurationMs(0);
                setIsCancellingRun(false);
            }
        };

        void pollRunStatus();

        return () => {
            ignore = true;
            if (timer !== null) {
                window.clearTimeout(timer);
            }
        };
    }, [activeRunId, step]);

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

    async function handleGenerate() {
        const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
        if (!normalizedBaseUrl.ok) {
            setError(normalizedBaseUrl.message);
            return;
        }

        if (effectiveSelectedPractices.length === 0) {
            setError("Select at least one best-practice area before generating tests.");
            return;
        }

        setStep("generating");
        setEditedCode("");
        setResult(null);
        setError("");
        setCrawlError("");
        setSaveLabel("Add to Test Explorer");
        setSavedSuite(null);
        setActiveTab("summary");
        setStatusFilter("All");
        setSelectedFailedRerunTitles([]);
        setContentProfile(null);
        setIsBusyTargetListExpanded(false);
        setIsCreationCollapsed(false);
        setIsGeneratedCollapsed(false);
        setIsReportCollapsed(false);

        const parsedPaths = parseContentLines(contentPathsInput).map((item) =>
            item.startsWith("/") ? item : `/${item}`
        );
        const activeSelectedCrawledPaths = crawlResult?.baseUrl === normalizedBaseUrl.value
            ? selectedCrawledPaths
            : [];
        const effectiveDescription = (isDescriptionPlaceholderActive ? "" : description).trim() || buildSelectedPracticeDescription(effectiveSelectedPractices);
        const contentRules = {
            paths: normalizeInspectionPaths(
                normalizedBaseUrl.value,
                parsedPaths,
                activeSelectedCrawledPaths
            ),
            requiredHeadings: parseContentLines(requiredHeadingsInput),
            requiredText: parseContentLines(requiredTextInput),
            forbiddenText: parseContentLines(forbiddenTextInput),
        };

        try {
            const introspectionResponse = await fetch("/api/introspect", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    baseUrl: normalizedBaseUrl.value,
                    paths: contentRules.paths,
                }),
            });
            const introspectionData = await introspectionResponse.json();
            if (!introspectionResponse.ok) {
                throw new Error(introspectionData.error ?? "Page inspection failed");
            }

            setContentProfile(introspectionData);
            setLastGeneratedContentSignature(JSON.stringify({ contentRules, auditMode }));
            setLastGeneratedBaseUrl(normalizedBaseUrl.value);
            setLastGeneratedInspectionPaths(contentRules.paths);
            setLastGeneratedInspectionTargets(
                buildBusyInspectionTargets(
                    normalizedBaseUrl.value,
                    contentRules.paths,
                    crawlResult?.baseUrl === normalizedBaseUrl.value ? crawlResult.pages : []
                )
            );
            setLastGeneratedAuditMode(auditMode);
            setLastGeneratedPracticeSignature(JSON.stringify([...effectiveSelectedPractices].sort()));
            setIsGeneratedCollapsed(false);

            const res = await fetch("/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    baseUrl: normalizedBaseUrl.value,
                    description: effectiveDescription,
                    selectedPractices: effectiveSelectedPractices,
                    auditMode,
                    contentRules,
                    contentProfile: introspectionData,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Generation failed");
            setEditedCode(data.code);
            if (isBaseUrlPlaceholderActive && normalizedBaseUrl.value === DEFAULT_BASE_URL) {
                setBaseUrl(DEFAULT_BASE_URL);
                setIsBaseUrlPlaceholderActive(true);
            } else {
                setBaseUrl(normalizedBaseUrl.value);
                setIsBaseUrlPlaceholderActive(false);
            }
            setStep("ready");
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Unknown error");
            setStep("idle");
        }
    }

    async function startRun({ excludeTestTitles = [], includeTestTitles = [] }: { excludeTestTitles?: string[]; includeTestTitles?: string[] } = {}) {
        if (effectiveSelectedPractices.length === 0) {
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
                    code: editedCode,
                    selectedPractices: effectiveSelectedPractices,
                    auditMode: lastGeneratedAuditMode,
                    baseUrl: lastGeneratedBaseUrl,
                    excludeTestTitles,
                    includeTestTitles,
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

    async function handleRun() {
        await startRun();
    }

    async function handleContinueRun() {
        const excludedTitles = continuationExcludedTitles;

        if (excludedTitles.length === 0) {
            setError("There are no completed test results available to continue from.");
            return;
        }

        await startRun({ excludeTestTitles: excludedTitles });
    }

    function toggleFailedRerunTitle(title: string) {
        setSelectedFailedRerunTitles((current) =>
            current.includes(title)
                ? current.filter((item) => item !== title)
                : [...current, title]
        );
    }

    async function handleRerunFailedTitles(titles: string[]) {
        const uniqueTitles = [...new Set(titles.filter((title) => title.trim().length > 0))];

        if (uniqueTitles.length === 0) {
            setError("Select at least one failed test before rerunning.");
            return;
        }

        await startRun({ includeTestTitles: uniqueTitles });
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

    async function handleCopy() {
        try {
            await navigator.clipboard.writeText(editedCode);
            setCopyLabel("Copied!");
            setTimeout(() => setCopyLabel("Copy"), 2000);
        } catch {
            setCopyLabel("Copy failed");
            setTimeout(() => setCopyLabel("Copy"), 2000);
        }
    }

    async function handleSaveToExplorer() {
        const effectiveDescription = (isDescriptionPlaceholderActive ? "" : description).trim() || buildSelectedPracticeDescription(effectiveSelectedPractices);

        if (!editedCode.trim() || !effectiveDescription) {
            return;
        }

        setSaveLabel("Saving...");

        try {
            const response = await fetch("/api/save-suite", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: editedCode, description: effectiveDescription }),
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error ?? "Could not save suite to Test Explorer");
            }

            setSavedSuite(data);
            setSaveLabel("Saved");
            setTimeout(() => setSaveLabel("Add to Test Explorer"), 2000);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Unknown error");
            setSaveLabel("Save failed");
            setTimeout(() => setSaveLabel("Add to Test Explorer"), 2000);
        }
    }

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

    const isGenerating = step === "generating";
    const isRunning = step === "running";
    const isCrawling = crawlStatus === "crawling";
    const hasCode = step === "ready" || step === "done";
    const effectiveDescriptionText = isDescriptionPlaceholderActive ? "" : description;
    const inferredPractices = inferBestPracticesFromDescription(effectiveDescriptionText);
    const effectiveSelectedPractices: BestPracticeArea[] = [...new Set([...selectedPractices, ...(selectedPractices.length > 0 ? [] : inferredPractices)])]
        .filter((practice) => !deselectedPractices.includes(practice));
    const normalizedBaseUrlForDisplay = normalizeBaseUrl(baseUrl);
    const parsedDisplayPaths = parseContentLines(contentPathsInput).map((item) =>
        item.startsWith("/") ? item : `/${item}`
    );
    const hasActiveCrawlSelection = Boolean(
        normalizedBaseUrlForDisplay.ok &&
        crawlResult?.baseUrl === normalizedBaseUrlForDisplay.value &&
        selectedCrawledPaths.length > 0
    );
    const effectiveInspectionPaths = normalizeInspectionPaths(
        normalizedBaseUrlForDisplay.ok ? normalizedBaseUrlForDisplay.value : DEFAULT_BASE_URL,
        parsedDisplayPaths,
        hasActiveCrawlSelection ? selectedCrawledPaths : []
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
        (contentProfile !== null &&
            lastGeneratedContentSignature === JSON.stringify({ contentRules, auditMode }) &&
            hasCode);
    const isPracticeSelectionReady = lastGeneratedPracticeSignature === selectedPracticeSignature;
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
    const busyBaseUrl = (isRunning ? lastGeneratedBaseUrl : busyTarget) || DEFAULT_BASE_URL;
    const busyInspectionPaths = isRunning
        ? lastGeneratedInspectionPaths
        : effectiveInspectionPaths;
    const busyLabel = isGenerating
        ? "Inspecting pages and generating tests..."
        : isCancellingRun
            ? "Stopping generated Playwright suite..."
            : "Running generated Playwright suite...";
    const activeRunProgress = isRunning ? runProgress : null;
    const activeRunPlannedExecutions = activeRunProgress?.plannedExecutions ?? [];
    const focusedPlannedExecutionId = activeRunPlannedExecutions.find((execution) => execution.status === "running")?.id ?? null;
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
    const canGenerateOrRun = effectiveSelectedPractices.length > 0;
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
    const busyInspectionTargets = isRunning
        ? lastGeneratedInspectionTargets
        : buildBusyInspectionTargets(
            busyBaseUrl,
            busyInspectionPaths,
            crawlResult?.baseUrl === busyBaseUrl ? crawledPages : []
        );
    const busyInspectionTargetsPreview = busyInspectionTargets.slice(0, 3);
    const remainingBusyInspectionTargets = busyInspectionTargets.slice(3);
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

    useEffect(() => {
        if (!focusedPlannedExecutionId) {
            return;
        }

        const activeRow = plannedExecutionItemRefs.current[focusedPlannedExecutionId];
        if (!activeRow) {
            return;
        }

        activeRow.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    }, [focusedPlannedExecutionId, activeRunProgress?.completedTests]);

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.12),_transparent_32%),linear-gradient(180deg,#f7f8fc_0%,#f4f6fb_52%,#eef3f8_100%)] text-zinc-900">
            {showBusyOverlay && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/35 px-6 backdrop-blur-sm">
                    <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white/95 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
                        <div>
                            <div className="flex items-center gap-3">
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-[0_12px_32px_rgba(79,70,229,0.28)]">
                                    <Spinner />
                                </div>
                                <div>
                                    <div className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">
                                        {isGenerating ? "Generating" : "Running"}
                                    </div>
                                    <div className="mt-1 text-lg font-semibold text-zinc-950">
                                        {busyLabel}
                                    </div>
                                </div>
                            </div>
                            <p className="mt-4 text-sm leading-6 text-zinc-500">
                                {isGenerating
                                    ? "TestForge is inspecting the requested pages and translating the results into concrete Playwright assertions."
                                    : isCancellingRun
                                        ? "TestForge is stopping the running suite and preserving the latest available execution state."
                                        : "TestForge is executing the generated suite and collecting structured reporting data."}
                            </p>
                        </div>
                        {isRunning ? (
                            <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-xs leading-5 text-zinc-600">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="font-semibold text-zinc-800">Overall progress</div>
                                        <div className="mt-1 text-zinc-500">
                                            {runCompletedTests} of {runTotalTests || activeRunProgress?.startedTests || 0} tests finished
                                            {runStatus ? ` · ${toSentenceCase(runStatus)}` : ""}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleStopRun}
                                        disabled={!activeRunId || isCancellingRun}
                                        className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {isCancellingRun ? "Stopping..." : "Stop run"}
                                    </button>
                                </div>

                                <div>
                                    <div className="mb-3 grid grid-cols-2 gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] sm:grid-cols-4">
                                        <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2 text-emerald-700">
                                            <span>Passed</span>
                                            <span className="text-base font-semibold">{activeRunProgress?.passedTests ?? 0}</span>
                                        </div>
                                        <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2 text-rose-700">
                                            <span>Failed</span>
                                            <span className="text-base font-semibold">{activeRunProgress?.failedTests ?? 0}</span>
                                        </div>
                                        <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2 text-amber-600">
                                            <span>Flaky</span>
                                            <span className="text-base font-semibold">{activeRunProgress?.flakyTests ?? 0}</span>
                                        </div>
                                        <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-700">
                                            <span>Blocked</span>
                                            <span className="text-base font-semibold">{activeRunProgress?.blockedTests ?? 0}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                        <span>Suite completion</span>
                                        <span>{runProgressPercent}%</span>
                                    </div>
                                    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-zinc-200">
                                        <div
                                            className="h-full rounded-full bg-indigo-500 transition-[width] duration-300"
                                            style={{ width: `${runProgressPercent}%` }}
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-2 sm:grid-cols-2">
                                    <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2">
                                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Elapsed</div>
                                        <div className="mt-1 text-base font-semibold text-zinc-900">{runElapsedLabel}</div>
                                    </div>
                                    <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2">
                                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Projected remaining</div>
                                        <div className="mt-1 text-base font-semibold text-zinc-900">{runRemainingLabel}</div>
                                    </div>
                                </div>

                                {activeRunPlannedExecutions.length > 0 ? (
                                    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-zinc-200 bg-white px-3 py-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="font-semibold text-zinc-800">Planned tests in this run</div>
                                            <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                                                {activeRunPlannedExecutions.length} total
                                            </div>
                                        </div>
                                        <div className="mt-1 text-[11px] leading-5 text-zinc-500">
                                            These are the exact test titles queued for the current run, shown in execution order.
                                        </div>
                                        <div ref={plannedExecutionListRef} className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                                            {activeRunPlannedExecutions.map((execution, index) => (
                                                <div
                                                    key={execution.id}
                                                    ref={(element) => {
                                                        plannedExecutionItemRefs.current[execution.id] = element;
                                                    }}
                                                    className={`flex items-start justify-between gap-3 rounded-xl border px-3 py-2 transition ${execution.id === focusedPlannedExecutionId
                                                        ? "border-indigo-300 bg-indigo-50 shadow-sm"
                                                        : "border-zinc-200 bg-zinc-50"
                                                        }`}
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <div className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${execution.id === focusedPlannedExecutionId ? "text-indigo-600" : "text-zinc-500"}`}>
                                                            Test {index + 1}
                                                        </div>
                                                        <div className="mt-1 break-words text-sm font-medium text-zinc-900">
                                                            {execution.title}
                                                        </div>
                                                    </div>
                                                    <span
                                                        className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${livePlannedExecutionStatusClasses(execution.status)}`}
                                                    >
                                                        {livePlannedExecutionStatusLabel(execution.status)}
                                                    </span>
                                                    <span className="inline-flex shrink-0 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-700">
                                                        {execution.duration !== null ? formatMilliseconds(execution.duration) : "--"}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        ) : (
                            <div className="mt-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-xs leading-5 text-zinc-600">
                                <div className="font-semibold text-zinc-800">Selected pages under test</div>
                                <div className="mt-3 space-y-2">
                                    {busyInspectionTargetsPreview.map((target) => (
                                        <div
                                            key={target.url}
                                            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 break-all"
                                        >
                                            {target.title ? (
                                                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                                    <span className="font-semibold text-zinc-800">{target.title}</span>
                                                    <span className="text-zinc-500">{target.url}</span>
                                                </div>
                                            ) : (
                                                target.url
                                            )}
                                        </div>
                                    ))}
                                </div>
                                {remainingBusyInspectionTargets.length > 0 && (
                                    <div className="mt-3">
                                        <button
                                            type="button"
                                            onClick={() => setIsBusyTargetListExpanded((value) => !value)}
                                            className="text-xs font-semibold text-indigo-600 transition hover:text-indigo-700"
                                        >
                                            {isBusyTargetListExpanded
                                                ? `Hide ${remainingBusyInspectionTargets.length} more page${remainingBusyInspectionTargets.length === 1 ? "" : "s"}`
                                                : `Show ${remainingBusyInspectionTargets.length} more page${remainingBusyInspectionTargets.length === 1 ? "" : "s"}`}
                                        </button>
                                        {isBusyTargetListExpanded && (
                                            <div className="mt-2 space-y-2">
                                                {remainingBusyInspectionTargets.map((target) => (
                                                    <div
                                                        key={target.url}
                                                        className="rounded-xl border border-zinc-200 bg-white px-3 py-2 break-all"
                                                    >
                                                        {target.title ? (
                                                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                                                <span className="font-semibold text-zinc-800">{target.title}</span>
                                                                <span className="text-zinc-500">{target.url}</span>
                                                            </div>
                                                        ) : (
                                                            target.url
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
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

                        <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-4">
                            <button
                                type="button"
                                onClick={() => setIsContentRulesCollapsed((value) => !value)}
                                aria-expanded={!isContentRulesCollapsed}
                                aria-controls="content-rules-panel"
                                className="flex w-full items-center justify-between gap-3 text-left"
                            >
                                <div>
                                    <div className="text-sm font-medium text-zinc-700">
                                        Content Rules
                                    </div>
                                    <p className="mt-1 text-xs leading-5 text-zinc-500">
                                        Inspect the page before generation and turn these content expectations into explicit assertions.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                                        Content-aware generation
                                    </span>
                                    <Chevron collapsed={isContentRulesCollapsed} />
                                </div>
                            </button>
                            {!isContentRulesCollapsed && (
                                <div id="content-rules-panel">
                                    <div className="mt-3 rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs leading-5 text-zinc-500">
                                        {contentAwareRequested
                                            ? isContentAwareReady
                                                ? "Content-aware inputs are synced with the generated suite."
                                                : "Content-aware inputs changed. Regenerate the suite before running tests."
                                            : "Leave these fields empty if you only want URL and flow-based tests."}
                                    </div>

                                    {contentProfile && (
                                        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <div>
                                                    <div className="text-sm font-semibold text-emerald-950">
                                                        Inspection Summary
                                                    </div>
                                                    <p className="mt-1 text-xs leading-5 text-emerald-800">
                                                        {discoveredLinkCount > 0
                                                            ? auditMode === "deep"
                                                                ? `${discoveredLinkCount} unique link${discoveredLinkCount === 1 ? "" : "s"} discovered and available for generated link tests.`
                                                                : `${discoveredLinkCount} visible link${discoveredLinkCount === 1 ? "" : "s"} discovered and shown for fast testing.`
                                                            : auditMode === "deep"
                                                                ? "No link metadata was discovered in the latest inspection."
                                                                : "No visible links were discovered in the latest inspection for fast testing."}
                                                    </p>
                                                    {auditMode === "deep" && (
                                                        <p className="mt-1 text-xs leading-5 text-emerald-800">
                                                            {discoveredEmbeddedLinkCount > 0
                                                                ? `${discoveredEmbeddedLinkCount} embedded target${discoveredEmbeddedLinkCount === 1 ? "" : "s"} discovered across frames, assets, forms, and runtime-style attributes.`
                                                                : "No embedded targets were discovered in the latest inspection."}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="rounded-full border border-emerald-300 bg-white px-3 py-1 text-xs font-semibold text-emerald-800">
                                                    {contentProfile.pages.length} page{contentProfile.pages.length === 1 ? "" : "s"} inspected
                                                </div>
                                            </div>

                                            {discoveredLinkPages.length > 0 && (
                                                <div className="mt-3 flex flex-wrap gap-2 text-xs text-emerald-900">
                                                    {discoveredLinkPages.map((page) => (
                                                        <span
                                                            key={page.path}
                                                            className="rounded-full border border-emerald-200 bg-white px-3 py-1"
                                                        >
                                                            {page.path}: {page.count} link{page.count === 1 ? "" : "s"}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            {discoveredEmbeddedLinkPages.length > 0 && (
                                                <div className="mt-3 flex flex-wrap gap-2 text-xs text-emerald-900">
                                                    {discoveredEmbeddedLinkPages.map((page) => (
                                                        <span
                                                            key={`${page.path}-embedded`}
                                                            className="rounded-full border border-emerald-200 bg-white px-3 py-1"
                                                        >
                                                            {page.path}: {page.count} embedded target{page.count === 1 ? "" : "s"}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            {displayedDiscoveredLinks.length > 0 && (
                                                <div className="mt-4">
                                                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                                                        {auditMode === "deep" ? "Discovered Links" : "Visible Links For Fast Testing"}
                                                    </div>
                                                    <div className="mt-2 space-y-3">
                                                        {discoveredLinkGroups.map((group) => (
                                                            <div key={group.title} className="rounded-2xl border border-emerald-200 bg-white">
                                                                <div className="border-b border-emerald-100 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                                                                    {group.title}
                                                                </div>
                                                                <div className="px-4 py-2 text-[11px] leading-5 text-zinc-600">
                                                                    Links found: {group.links.map((link) => getLinkPreviewLabel(link)).join(", ")}
                                                                </div>
                                                                <div className="max-h-56 overflow-y-auto divide-y divide-emerald-100">
                                                                    {group.links.map((link, index) => (
                                                                        <div key={`${group.title}-${link.url}-${index}`} className="px-4 py-3 text-xs leading-5 text-emerald-950">
                                                                            <div className="font-medium text-zinc-900">
                                                                                {getLinkPreviewLabel(link)}
                                                                            </div>
                                                                            <div className="mt-1 text-zinc-600">
                                                                                {link.category === "api" ? "API" : "Navigation"}
                                                                                {link.linkType ? ` • ${link.linkType}` : ""}
                                                                                {link.targetBehavior === "new-tab" || link.targetBehavior === "new-window"
                                                                                    ? " • opens new tab"
                                                                                    : " • same tab"}
                                                                                {link.isVisible === false ? " • hidden" : " • visible"}
                                                                                {link.containerLabel ? ` • ${link.containerLabel}` : ""}
                                                                            </div>
                                                                            <div className="mt-1 break-all text-zinc-500">
                                                                                {link.url}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {displayedDiscoveredEmbeddedLinks.length > 0 && (
                                                <div className="mt-4">
                                                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                                                        Embedded Targets
                                                    </div>
                                                    <div className="mt-2 max-h-56 overflow-y-auto rounded-2xl border border-emerald-200 bg-white">
                                                        <div className="divide-y divide-emerald-100">
                                                            {displayedDiscoveredEmbeddedLinks.map((embeddedLink, index) => (
                                                                <div key={`${embeddedLink.url}-${embeddedLink.attributeName}-${index}`} className="px-4 py-3 text-xs leading-5 text-emerald-950">
                                                                    <div className="font-medium text-zinc-900">
                                                                        {getEmbeddedPreviewLabel(embeddedLink)}
                                                                    </div>
                                                                    <div className="mt-1 text-zinc-600">
                                                                        {embeddedLink.kind} • {embeddedLink.tagName}[{embeddedLink.attributeName}] • {embeddedLink.source}
                                                                        {embeddedLink.containerLabel ? ` • ${embeddedLink.containerLabel}` : ""}
                                                                    </div>
                                                                    <div className="mt-1 text-zinc-500">
                                                                        {embeddedLink.sameOrigin ? "Same origin" : "Cross origin or external"}
                                                                        {embeddedLink.isVisible ? " • visible" : " • non-visible"}
                                                                    </div>
                                                                    <div className="mt-1 break-all text-zinc-500">
                                                                        {embeddedLink.url}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                                        <div className="space-y-1.5">
                                            <label htmlFor="content-paths-input" className="block text-sm font-medium text-zinc-700">
                                                Paths to inspect
                                            </label>
                                            <textarea
                                                id="content-paths-input"
                                                aria-label="Paths to inspect"
                                                rows={4}
                                                value={contentPathsInput}
                                                onChange={(event) => setContentPathsInput(event.target.value)}
                                                placeholder="Leave blank to inspect the exact page in Base URL, or add paths like /pricing and /about"
                                                className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label htmlFor="required-headings-input" className="block text-sm font-medium text-zinc-700">
                                                Required headings
                                            </label>
                                            <textarea
                                                id="required-headings-input"
                                                aria-label="Required headings"
                                                rows={4}
                                                value={requiredHeadingsInput}
                                                onChange={(event) => setRequiredHeadingsInput(event.target.value)}
                                                placeholder="Welcome\nPricing\nFrequently Asked Questions"
                                                className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label htmlFor="required-text-input" className="block text-sm font-medium text-zinc-700">
                                                Required text snippets
                                            </label>
                                            <textarea
                                                id="required-text-input"
                                                aria-label="Required text snippets"
                                                rows={4}
                                                value={requiredTextInput}
                                                onChange={(event) => setRequiredTextInput(event.target.value)}
                                                placeholder="Start free trial\nContact sales"
                                                className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label htmlFor="forbidden-text-input" className="block text-sm font-medium text-zinc-700">
                                                Forbidden text snippets
                                            </label>
                                            <textarea
                                                id="forbidden-text-input"
                                                aria-label="Forbidden text snippets"
                                                rows={4}
                                                value={forbiddenTextInput}
                                                onChange={(event) => setForbiddenTextInput(event.target.value)}
                                                placeholder="Lorem ipsum\nComing soon"
                                                className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

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

                <CollapsibleSection
                    title="Generated Suite"
                    subtitle="Review the generated Playwright code and run only the active highlighted best-practice sections."
                    collapsed={isGeneratedCollapsed}
                    onToggle={() => setIsGeneratedCollapsed((value) => !value)}
                    dark
                >
                    <div className="flex items-center justify-between gap-3 border-b border-zinc-800 pb-4">
                        <div>
                            <div className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                                Generated Suite
                            </div>
                            <div className="mt-1 text-sm font-semibold text-zinc-100">
                                generated_test.spec.ts
                            </div>
                            <label className="mt-3 inline-flex items-center gap-3 text-xs text-zinc-400">
                                <input
                                    type="checkbox"
                                    role="switch"
                                    checked={openReportInNewPage}
                                    onChange={(event) => {
                                        setOpenReportInNewPage(event.target.checked);
                                        if (!event.target.checked) {
                                            setReportPopupNotice("");
                                        }
                                    }}
                                    className="peer sr-only"
                                />
                                <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${openReportInNewPage ? "bg-emerald-500" : "bg-zinc-700"}`}>
                                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${openReportInNewPage ? "translate-x-5" : "translate-x-1"}`} />
                                </span>
                                <span>Open completed report in a new page</span>
                            </label>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleRun}
                                disabled={!hasCode || isRunning || !isContentAwareReady || !isPracticeSelectionReady || !canGenerateOrRun}
                                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isRunning ? (
                                    <>
                                        <Spinner />
                                        Running…
                                    </>
                                ) : (
                                    <>
                                        <svg
                                            className="h-4 w-4"
                                            viewBox="0 0 24 24"
                                            fill="currentColor"
                                        >
                                            <path d="M8 5v14l11-7z" />
                                        </svg>
                                        Run suite
                                    </>
                                )}
                            </button>
                            <button
                                onClick={handleSaveToExplorer}
                                disabled={!hasCode || isGenerating || isRunning}
                                className="rounded-xl border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {saveLabel}
                            </button>
                            <button
                                onClick={() => setEditing((value) => !value)}
                                className="rounded-xl border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                            >
                                {editing ? "View" : "Edit"}
                            </button>
                            <button
                                onClick={handleCopy}
                                className="rounded-xl border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                            >
                                {copyLabel}
                            </button>
                        </div>
                    </div>

                    <div className="mt-4 min-h-[420px]">
                        {hasCode ? (
                            editing ? (
                                <textarea
                                    ref={codeRef}
                                    value={editedCode}
                                    onChange={(event) => setEditedCode(event.target.value)}
                                    className="min-h-[420px] w-full resize-none rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4 font-mono text-sm text-emerald-300 focus:outline-none"
                                    spellCheck={false}
                                    rows={editedCode.split("\n").length + 2}
                                />
                            ) : (
                                <pre className="h-full overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4 font-mono text-sm leading-6 text-emerald-300 whitespace-pre">
                                    {editedCode}
                                </pre>
                            )
                        ) : (
                            <div className="flex h-full min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/80 px-6 text-center text-sm text-zinc-500">
                                Generate a suite to review the code before execution.
                            </div>
                        )}
                    </div>

                    {savedSuite && (
                        <div className="mt-4 rounded-2xl border border-emerald-800 bg-emerald-950/40 px-4 py-3 text-xs leading-6 text-emerald-200">
                            <div>
                                Added {savedSuite.fileName} to Playwright discovery.
                            </div>
                            <div className="mt-2 text-emerald-100/90">
                                File: {savedSuite.filePath}
                            </div>
                            <div className="mt-2 space-y-1 text-emerald-100/90">
                                {savedSuite.suiteTitles.length > 0 ? (
                                    savedSuite.suiteTitles.map((suiteTitle) => (
                                        <div key={suiteTitle}>{suiteTitle}</div>
                                    ))
                                ) : (
                                    <div>Generated best-practice suites</div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-zinc-800 pt-4 text-xs text-zinc-500">
                        <span>
                            Review the generated suite, edit if needed, then run it.
                            {` ${lastGeneratedAuditMode === "deep" ? "Deep mode keeps the expanded link audit coverage." : "Fast mode caps the most expensive per-page link navigation checks."}`}
                            {savedSuite ? " VS Code Test Explorer will show one generated file with the saved top-level suites underneath it." : ""}
                            {runBlockedMessage ? ` ${runBlockedMessage}` : ""}
                            {continueRunUnavailableMessage ? ` ${continueRunUnavailableMessage}` : ""}
                        </span>
                        <div className="flex items-center gap-3">
                            <span className="text-zinc-500">
                                {openReportInNewPage ? "The completed report will also open in a separate page." : "The report will stay embedded below after the run completes."}
                            </span>
                            <button
                                onClick={handleRun}
                                disabled={!hasCode || isRunning || !isContentAwareReady || !isPracticeSelectionReady || !canGenerateOrRun}
                                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isRunning ? (
                                    <>
                                        <Spinner />
                                        Running…
                                    </>
                                ) : (
                                    <>
                                        <svg
                                            className="h-4 w-4"
                                            viewBox="0 0 24 24"
                                            fill="currentColor"
                                        >
                                            <path d="M8 5v14l11-7z" />
                                        </svg>
                                        Run suite
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </CollapsibleSection>

                {error && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        <strong>Error:</strong> {error}
                    </div>
                )}

                {reportPopupNotice && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        <strong>Report page notice:</strong> {reportPopupNotice}
                    </div>
                )}

                {result && report ? (
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

                            {activeTab === "summary" && (
                                <div className="space-y-6">
                                    <div className="grid gap-6 xl:grid-cols-2">
                                        <ReportPanel
                                            eyebrow="Release Overview"
                                            title="Stakeholder summary"
                                            description="High-level outcome, browser coverage, and defect trend across the execution order."
                                            className="h-full"
                                        >
                                            <div className="grid gap-4 sm:grid-cols-3">
                                                <MetricCard
                                                    label="Duration"
                                                    value={formatMilliseconds(report.summary.duration)}
                                                    caption="full execution time"
                                                />
                                                <MetricCard
                                                    label="Browsers"
                                                    value={report.summary.browsers.length}
                                                    caption={report.summary.browsers.join(", ")}
                                                />
                                                <MetricCard
                                                    label="Tests Run"
                                                    value={report.summary.executed}
                                                    caption="executed in this cycle"
                                                />
                                            </div>
                                        </ReportPanel>

                                        <ReportPanel
                                            eyebrow="Execution Trend"
                                            title="Defects over execution time"
                                            description="Running defect count across the executed test order. Scroll to inspect the full timeline when many tests ran."
                                            className="h-full"
                                        >
                                            <div className="flex h-full min-h-[248px] flex-col">
                                                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                                                    Defects over execution time
                                                </div>
                                                <div className="mt-3 flex-1 overflow-auto rounded-2xl border border-zinc-200 bg-white p-2">
                                                    <TrendBars points={report.summary.defectTrend} />
                                                </div>
                                            </div>
                                        </ReportPanel>
                                    </div>

                                    <ReportPanel
                                        eyebrow="Release Call"
                                        title="Recommendation"
                                        description="Use this as the go / no-go statement for the current test cycle."
                                    >
                                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                                            <div className="text-lg font-semibold text-zinc-950">
                                                {report.summary.releaseRecommendation}
                                            </div>
                                            <p className="mt-2 text-sm leading-6 text-zinc-500">
                                                Planned {report.summary.planned} tests, executed {report.summary.executed}, with {report.summary.failed} failing and {report.summary.blocked} blocked outcomes.
                                            </p>
                                        </div>
                                    </ReportPanel>
                                </div>
                            )}

                            {activeTab === "execution" && (
                                <ReportPanel
                                    eyebrow="Test Execution Report"
                                    title="Detailed case-by-case results"
                                    description="Filterable execution detail for QA teams to inspect individual failures and remarks."
                                >
                                    <div className="mb-4 flex flex-wrap gap-2">
                                        {(["All", "Passed", "Failed", "Blocked", "Flaky"] as const).map(
                                            (status) => (
                                                <button
                                                    key={status}
                                                    type="button"
                                                    onClick={() => setStatusFilter(status)}
                                                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${statusFilter === status
                                                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                                                        : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:text-zinc-900"
                                                        }`}
                                                >
                                                    {status}
                                                </button>
                                            )
                                        )}
                                    </div>
                                    {rerunnableFailedTitles.length > 0 ? (
                                        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                                            <div className="text-sm text-zinc-600">
                                                {selectedRerunnableFailedTitles.length > 0
                                                    ? `${selectedRerunnableFailedTitles.length} failed test${selectedRerunnableFailedTitles.length === 1 ? "" : "s"} selected for rerun`
                                                    : `${rerunnableFailedTitles.length} failed test${rerunnableFailedTitles.length === 1 ? "" : "s"} available for rerun`}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleRerunFailedTitles(selectedRerunnableFailedTitles)}
                                                disabled={isRunning || !canGenerateOrRun || selectedRerunnableFailedTitles.length === 0}
                                                className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:border-rose-400 hover:text-rose-900 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                Rerun selected failed tests
                                            </button>
                                            {selectedRerunnableFailedTitles.length > 0 ? (
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedFailedRerunTitles([])}
                                                    className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-zinc-400 hover:text-zinc-950"
                                                >
                                                    Clear selection
                                                </button>
                                            ) : null}
                                        </div>
                                    ) : null}
                                    <ExecutionTable
                                        records={filteredExecution}
                                        selectedFailedTitles={selectedRerunnableFailedTitles}
                                        onToggleFailedSelection={toggleFailedRerunTitle}
                                        onRerunFailedTitle={(title) => handleRerunFailedTitles([title])}
                                        rerunActionsDisabled={isRunning || !canGenerateOrRun}
                                    />
                                </ReportPanel>
                            )}

                            {activeTab === "defects" && (
                                <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                                    <ReportPanel
                                        eyebrow="Defect Report"
                                        title="Issue tracking and hot spots"
                                        description="Generated bug-style records and a heatmap of areas accumulating failures."
                                    >
                                        <HeatmapGrid cells={report.defects.heatmap} />
                                    </ReportPanel>
                                    <ReportPanel
                                        eyebrow="Open Issues"
                                        title="Defect backlog"
                                        description="Failure records formatted as issue-tracking items with severity and reproduction steps."
                                    >
                                        <DefectList defects={report.defects.issues} />
                                    </ReportPanel>
                                </div>
                            )}

                            {activeTab === "coverage" && (
                                <div className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
                                    <ReportPanel
                                        eyebrow="Requirements Coverage"
                                        title="Traceability"
                                        description="Coverage percentage, uncovered requirements, and a simple traceability matrix."
                                    >
                                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                                            <div className="text-3xl font-semibold text-zinc-950">
                                                {report.coverage.percentage}%
                                            </div>
                                            <div className="mt-1 text-sm text-zinc-500">
                                                {report.coverage.covered} of {report.coverage.total} requested coverage areas fully covered.
                                            </div>
                                            <div className="mt-4 h-3 overflow-hidden rounded-full bg-zinc-200">
                                                <div
                                                    className="h-full rounded-full bg-indigo-500"
                                                    style={{ width: `${report.coverage.percentage}%` }}
                                                />
                                            </div>
                                        </div>
                                        <div className="mt-4 space-y-2">
                                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                                                Uncovered requirements
                                            </div>
                                            {report.coverage.uncovered.length > 0 ? (
                                                report.coverage.uncovered.map((item) => (
                                                    <div
                                                        key={item}
                                                        className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
                                                    >
                                                        {item}
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                                                    No uncovered requirements in the current run.
                                                </div>
                                            )}
                                        </div>
                                    </ReportPanel>
                                    <ReportPanel
                                        eyebrow="Traceability Matrix"
                                        title="Coverage mapping"
                                        description="Links requested coverage areas to the generated and executed tests."
                                    >
                                        <CoverageTable matrix={report.coverage.matrix} />
                                    </ReportPanel>
                                </div>
                            )}

                            {activeTab === "performance" && (
                                <ReportPanel
                                    eyebrow="Performance Test Report"
                                    title="Timing and scalability view"
                                    description="Page response timing, throughput, and honest notes about what this browser-only runner does not measure."
                                >
                                    <div className="grid gap-4 sm:grid-cols-3">
                                        <MetricCard
                                            label="Total Duration"
                                            value={formatMilliseconds(report.performance.totalDuration)}
                                            caption="full suite runtime"
                                        />
                                        <MetricCard
                                            label="Average Test"
                                            value={formatMilliseconds(report.performance.averageDuration)}
                                            caption="mean execution duration"
                                        />
                                        <MetricCard
                                            label="Throughput"
                                            value={`${report.performance.throughput}/min`}
                                            caption="executed tests per minute"
                                        />
                                    </div>
                                    <div className="mt-6 grid gap-6 xl:grid-cols-2">
                                        <div>
                                            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                                                Slowest tests
                                            </div>
                                            <PerformanceTable rows={report.performance.slowestTests} />
                                        </div>
                                        <div className="space-y-4">
                                            <InfoCard
                                                title="Resource utilization"
                                                body={report.performance.resourceUtilization}
                                            />
                                            <InfoCard
                                                title="Scalability"
                                                body={report.performance.scalability}
                                            />
                                        </div>
                                    </div>
                                </ReportPanel>
                            )}

                            {activeTab === "usability" && (
                                <ReportPanel
                                    eyebrow="Usability Report"
                                    title="User-centric findings"
                                    description="Task success rate, key findings, and notes about user-session evidence collection."
                                >
                                    <div className="grid gap-4 sm:grid-cols-3">
                                        <MetricCard
                                            label="Task Success"
                                            value={`${report.usability.successRate}%`}
                                            caption="successful usability tasks"
                                        />
                                        <MetricCard
                                            label="Completed"
                                            value={report.usability.tasksCompleted}
                                            caption="tasks completed successfully"
                                        />
                                        <MetricCard
                                            label="Observed"
                                            value={report.usability.totalTasks}
                                            caption="usability tasks in scope"
                                        />
                                    </div>
                                    <div className="mt-6 grid gap-6 xl:grid-cols-2">
                                        <div>
                                            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                                                Key findings
                                            </div>
                                            <ul className="space-y-3">
                                                {report.usability.findings.map((finding) => (
                                                    <li
                                                        key={finding.id}
                                                        className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm leading-6 text-zinc-600"
                                                    >
                                                        <div className="font-medium text-zinc-900">{finding.summary}</div>
                                                        {finding.testTitle ? (
                                                            <div className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                                                Failed test: {finding.testTitle} · {finding.browser}
                                                            </div>
                                                        ) : null}
                                                        {finding.defectTitle ? (
                                                            <div className="mt-2 text-sm text-zinc-600">
                                                                Linked bug: <span className="font-medium text-zinc-900">{finding.defectId}</span> · {finding.defectTitle}
                                                            </div>
                                                        ) : null}
                                                        {finding.artifacts.length > 0 ? (
                                                            <div className="mt-3">
                                                                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                                                    Related artifacts
                                                                </div>
                                                                <ArtifactLinkList items={finding.artifacts} className="mt-2" compact />
                                                            </div>
                                                        ) : null}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                        <ReportPanel
                                            eyebrow="Session Evidence"
                                            title="Captured artifacts"
                                            description={report.usability.videoClips}
                                        >
                                            <SessionEvidenceList items={report.usability.sessionEvidence} />
                                        </ReportPanel>
                                    </div>
                                </ReportPanel>
                            )}

                            {activeTab === "seo" && report.seo && (
                                <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                                    <ReportPanel
                                        eyebrow="SEO Audit"
                                        title={selectedSeoPageGroup ? `What happened on ${selectedSeoPageGroup.pageLabel}` : "Rule-backed search readiness"}
                                        description={selectedSeoPageGroup
                                            ? "Use the selected page to review only the findings and strengths captured for that page."
                                            : "Deterministic crawler-facing checks with a simple score based on the executed SEO rules in this run."}
                                    >
                                        <div className="grid gap-4 sm:grid-cols-4">
                                            <MetricCard
                                                label="SEO Score"
                                                value={`${report.seo.score}%`}
                                                caption={report.seo.statusLabel}
                                            />
                                            <MetricCard
                                                label="Passed"
                                                value={report.seo.passedChecks}
                                                caption="rule checks passed"
                                            />
                                            <MetricCard
                                                label="Failed"
                                                value={report.seo.failedChecks}
                                                caption="checks need attention"
                                            />
                                            <MetricCard
                                                label="Not Covered"
                                                value={report.seo.notCoveredChecks}
                                                caption="areas missing explicit proof"
                                            />
                                        </div>
                                        <div className="mt-6">
                                            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                                                {seoPageGroups.length > 1 ? "SEO pages" : "Page-specific findings"}
                                            </div>
                                            {seoPageGroups.length > 1 ? (
                                                <div className="mb-5 flex flex-wrap gap-2">
                                                    {seoPageGroups.map((group) => (
                                                        <button
                                                            key={group.pageKey}
                                                            type="button"
                                                            onClick={() => setSelectedSeoPageKey(group.pageKey)}
                                                            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${selectedSeoPageGroup?.pageKey === group.pageKey
                                                                ? "border-zinc-900 bg-zinc-900 text-white"
                                                                : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"
                                                                }`}
                                                        >
                                                            {group.pageLabel}
                                                        </button>
                                                    ))}
                                                </div>
                                            ) : null}

                                            <div className="space-y-5">
                                                <div>
                                                    <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                                                        Findings
                                                    </div>
                                                    <ul className="space-y-3">
                                                        {(selectedSeoPageGroup?.findings ?? report.seo.findings).map((finding) => (
                                                            <li
                                                                key={finding}
                                                                className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm leading-6 text-zinc-600"
                                                            >
                                                                {finding}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                                <div>
                                                    <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                                                        Strengths
                                                    </div>
                                                    <ul className="space-y-3">
                                                        {(selectedSeoPageGroup?.strengths ?? report.seo.strengths).map((strength) => (
                                                            <li
                                                                key={strength}
                                                                className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700"
                                                            >
                                                                {strength}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>
                                    </ReportPanel>

                                    <div className="space-y-6">
                                        <ReportPanel
                                            eyebrow="Recommendations"
                                            title="Prioritized recommendations"
                                            description={selectedSeoPageGroup
                                                ? `These recommendations are scoped to ${selectedSeoPageGroup.pageLabel} when page-specific evidence is available.`
                                                : "These recommendations are derived from the failed or uncovered rule checks so the next SEO pass stays grounded in real evidence."}
                                        >
                                            <div className="space-y-3">
                                                {selectedSeoRecommendations.map((recommendation) => (
                                                    <div
                                                        key={`${recommendation.priority}-${recommendation.pageKey ?? "global"}-${recommendation.title}`}
                                                        className={`rounded-2xl border px-4 py-3 ${recommendationClasses(recommendation.priority)}`}
                                                    >
                                                        <div className="flex items-center justify-between gap-3 text-sm font-semibold">
                                                            <span>{recommendation.title}</span>
                                                            <span>{recommendation.priority}</span>
                                                        </div>
                                                        {recommendation.pageLabel ? (
                                                            <div className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                                                Page: {recommendation.pageLabel}
                                                            </div>
                                                        ) : null}
                                                        <p className="mt-2 text-sm leading-6">
                                                            {recommendation.rationale}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        </ReportPanel>
                                    </div>
                                </div>
                            )}

                            <ReportPanel
                                eyebrow="Raw Console"
                                title="Execution output"
                                description="Retained for debugging alongside the structured dashboard."
                            >
                                <div className="mb-4 flex flex-wrap gap-2">
                                    {result.runStatus === "cancelled" ? (
                                        <button
                                            type="button"
                                            onClick={handleContinueRun}
                                            disabled={!hasCode || isRunning || !isContentAwareReady || !isPracticeSelectionReady || !canGenerateOrRun || !canContinueCancelledRun}
                                            className="rounded-xl border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 transition hover:border-sky-400 hover:text-sky-900 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            Continue remaining tests
                                        </button>
                                    ) : null}
                                    <button
                                        type="button"
                                        onClick={() => handleCopyRawOutput(report.rawOutput)}
                                        className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-zinc-400 hover:text-zinc-950"
                                    >
                                        {rawOutputCopyLabel}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleExportHtmlReport(report, result.runId)}
                                        className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-zinc-400 hover:text-zinc-950"
                                    >
                                        {htmlReportExportLabel}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleExportRawOutput(report.rawOutput)}
                                        className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-zinc-400 hover:text-zinc-950"
                                    >
                                        {rawOutputExportLabel}
                                    </button>
                                </div>
                                <pre className="overflow-x-auto rounded-2xl border border-zinc-200 bg-zinc-950 px-4 py-4 font-mono text-xs leading-6 text-zinc-200 whitespace-pre-wrap">
                                    {report.rawOutput}
                                </pre>
                            </ReportPanel>
                        </div>
                    </CollapsibleSection>
                ) : result ? (
                    <CollapsibleSection
                        title="Execution Output"
                        subtitle={result.runStatus === "cancelled"
                            ? "The run was stopped before Playwright produced a structured report. TestForge preserved the latest available progress and raw console output."
                            : "Structured report data was not available for this run, so only the raw console output is shown."}
                        collapsed={isReportCollapsed}
                        onToggle={() => setIsReportCollapsed((value) => !value)}
                    >
                        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div className="text-sm font-semibold text-zinc-900">
                                    {result.runStatus === "cancelled"
                                        ? "Run stopped"
                                        : result.passed
                                            ? "All tests passed"
                                            : "Tests failed"} — {formatMilliseconds(result.duration)}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {result.runStatus === "cancelled" ? (
                                        <button
                                            type="button"
                                            onClick={handleContinueRun}
                                            disabled={!hasCode || isRunning || !isContentAwareReady || !isPracticeSelectionReady || !canGenerateOrRun || !canContinueCancelledRun}
                                            className="rounded-xl border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 transition hover:border-sky-400 hover:text-sky-900 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            Continue remaining tests
                                        </button>
                                    ) : null}
                                    <button
                                        type="button"
                                        onClick={() => handleCopyRawOutput(result.output)}
                                        className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-zinc-400 hover:text-zinc-950"
                                    >
                                        {rawOutputCopyLabel}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleExportRawOutput(result.output)}
                                        className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-zinc-400 hover:text-zinc-950"
                                    >
                                        {rawOutputExportLabel}
                                    </button>
                                </div>
                            </div>
                            <div className="mt-4 grid gap-3 sm:grid-cols-4">
                                <MetricCard
                                    label="Completed"
                                    value={result.progress.completedTests}
                                    caption={`of ${result.progress.totalTests || result.progress.startedTests || 0} planned`}
                                />
                                <MetricCard
                                    label="Passed"
                                    value={result.progress.passedTests}
                                    caption="completed successfully"
                                />
                                <MetricCard
                                    label="Failed"
                                    value={result.progress.failedTests}
                                    caption="ended in failure"
                                />
                                <MetricCard
                                    label="Blocked"
                                    value={result.progress.blockedTests}
                                    caption="skipped or interrupted"
                                />
                            </div>
                            <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                                <div className="font-semibold text-zinc-900">Latest observed test</div>
                                <div className="mt-1">
                                    {result.progress.lastCompletedTitle
                                        ?? result.progress.currentTestTitle
                                        ?? "No test progress was captured before the run stopped."}
                                </div>
                            </div>
                            {result.progress.plannedExecutions.length > 0 ? (
                                <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
                                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                        Execution detail
                                    </div>
                                    <div className="mt-2 text-sm text-zinc-500">
                                        TestForge preserved the planned execution list and the latest known state for each test when the run stopped.
                                    </div>
                                    <FallbackExecutionTable progress={result.progress} />
                                </div>
                            ) : null}
                            <pre className="mt-4 overflow-x-auto rounded-2xl bg-zinc-950 px-4 py-4 font-mono text-xs leading-6 text-zinc-200 whitespace-pre-wrap">
                                {result.output}
                            </pre>
                        </div>
                    </CollapsibleSection>
                ) : null}
            </main>
        </div >
    );
}

function CollapsibleSection({
    title,
    subtitle,
    collapsed,
    onToggle,
    children,
    dark = false,
}: {
    title: string;
    subtitle: string;
    collapsed: boolean;
    onToggle: () => void;
    children: ReactNode;
    dark?: boolean;
}) {
    const sectionId = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}-panel`;

    return (
        <section className={`rounded-[28px] border p-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)] ${dark
            ? "border-white/70 bg-zinc-950 text-zinc-100 shadow-[0_24px_80px_rgba(15,23,42,0.16)]"
            : "border-white/70 bg-white/85 text-zinc-900 backdrop-blur"
            }`}>
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={!collapsed}
                aria-controls={sectionId}
                className="flex w-full items-start justify-between gap-4 text-left"
            >
                <div>
                    <div className={`text-sm font-semibold uppercase tracking-[0.22em] ${dark ? "text-zinc-500" : "text-indigo-600"}`}>
                        {title}
                    </div>
                    <p className={`mt-2 max-w-3xl text-sm leading-6 ${dark ? "text-zinc-400" : "text-zinc-500"}`}>
                        {subtitle}
                    </p>
                </div>
                <Chevron collapsed={collapsed} dark={dark} />
            </button>
            {!collapsed && <div id={sectionId} className="mt-6">{children}</div>}
        </section>
    );
}

function Chevron({ collapsed, dark = false }: { collapsed: boolean; dark?: boolean }) {
    return (
        <svg
            className={`h-5 w-5 shrink-0 transition-transform ${collapsed ? "rotate-180" : "rotate-0"} ${dark ? "text-zinc-400" : "text-zinc-500"}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M6 15l6-6 6 6" />
        </svg>
    );
}

function MetricCard({
    label,
    value,
    caption,
}: {
    label: string;
    value: string | number;
    caption: string;
}) {
    return (
        <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                {label}
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">
                {value}
            </div>
            <div className="mt-1 text-xs leading-5 text-zinc-500">{caption}</div>
        </div>
    );
}

function ReportPanel({
    eyebrow,
    title,
    description,
    children,
    className,
}: {
    eyebrow: string;
    title: string;
    description: string;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={`rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm ${className ?? ""}`}>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                {eyebrow}
            </div>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-zinc-950">
                {title}
            </h3>
            <p className="mt-1 text-sm leading-6 text-zinc-500">{description}</p>
            <div className="mt-5">{children}</div>
        </div>
    );
}

function DonutChart({ passed, failed }: { passed: number; failed: number }) {
    const total = Math.max(passed + failed, 1);
    const passedAngle = (passed / total) * 360;

    return (
        <div
            className="relative h-24 w-24 rounded-full"
            style={{
                background: `conic-gradient(#10b981 0deg ${passedAngle}deg, #f43f5e ${passedAngle}deg 360deg)`,
            }}
        >
            <div className="absolute inset-[14px] flex items-center justify-center rounded-full bg-white text-center">
                <div>
                    <div className="text-lg font-semibold text-zinc-950">{total}</div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                        results
                    </div>
                </div>
            </div>
        </div>
    );
}

function LegendRow({
    color,
    label,
    value,
}: {
    color: string;
    label: string;
    value: number;
}) {
    return (
        <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
            <span className="flex-1">{label}</span>
            <span className="font-semibold text-zinc-900">{value}</span>
        </div>
    );
}

function SeverityBar({
    label,
    value,
    maxValue,
    color,
}: {
    label: string;
    value: number;
    maxValue: number;
    color: string;
}) {
    const widthPercent = value === 0 ? 0 : Math.max(8, (value / Math.max(maxValue, 1)) * 100);

    return (
        <div>
            <div className="mb-1 flex items-center justify-between text-xs font-medium">
                <span>{label}</span>
                <span>{value}</span>
            </div>
            <div className="h-2 rounded-full bg-zinc-100">
                <div
                    className={`h-2 rounded-full ${color}`}
                    style={{ width: `${Math.min(widthPercent, 100)}%` }}
                />
            </div>
        </div>
    );
}

function TrendBars({ points }: { points: { label: string; count: number }[] }) {
    const max = Math.max(...points.map((point) => point.count), 1);

    return (
        <div className="flex min-w-max items-end gap-2 rounded-2xl bg-white px-4 py-4">
            {points.map((point) => (
                <div key={point.label} className="flex min-w-[32px] flex-col items-center gap-2">
                    <div className="text-[10px] font-semibold text-zinc-500">{point.count}</div>
                    <div className="flex h-28 items-end">
                        <div
                            className="w-6 rounded-t-xl bg-indigo-500"
                            style={{ height: `${Math.max(6, (point.count / max) * 112)}px` }}
                        />
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-400">
                        {point.label}
                    </div>
                </div>
            ))}
        </div>
    );
}

function getSuiteLabel(suite: string) {
    const trimmed = suite.trim();
    return trimmed || "General test set";
}

function ExecutionTable({
    records,
    selectedFailedTitles,
    onToggleFailedSelection,
    onRerunFailedTitle,
    rerunActionsDisabled,
}: {
    records: ExecutionRecord[];
    selectedFailedTitles: string[];
    onToggleFailedSelection: (title: string) => void;
    onRerunFailedTitle: (title: string) => void;
    rerunActionsDisabled: boolean;
}) {
    const [expandedRows, setExpandedRows] = useState<string[]>([]);

    const suites = records.reduce((groups, record) => {
        const key = getSuiteLabel(record.suite);
        const existing = groups.get(key);

        if (existing) {
            existing.push(record);
        } else {
            groups.set(key, [record]);
        }

        return groups;
    }, new Map<string, ExecutionRecord[]>());

    function toggleRow(rowId: string) {
        setExpandedRows((current) =>
            current.includes(rowId)
                ? current.filter((item) => item !== rowId)
                : [...current, rowId]
        );
    }

    return records.length > 0 ? (
        <div className="space-y-4">
            {Array.from(suites.entries()).map(([suite, suiteRecords], suiteIndex) => {
                const suiteSummary = summarizeSuite(suiteRecords);

                return (
                    <details
                        key={suite}
                        open={suiteIndex === 0}
                        className="group overflow-hidden rounded-2xl border border-zinc-200 bg-white"
                    >
                        <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-4 bg-zinc-50 px-4 py-4 marker:hidden">
                            <div>
                                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                                    Test Set
                                </div>
                                <div className="mt-1 text-base font-semibold text-zinc-950">{suite}</div>
                                <div className="mt-1 text-sm text-zinc-500">
                                    {suiteRecords.length} test{suiteRecords.length === 1 ? "" : "s"} in this set
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                {suiteSummary.Passed > 0 ? (
                                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                        Passed {suiteSummary.Passed}
                                    </span>
                                ) : null}
                                {suiteSummary.Flaky > 0 ? (
                                    <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
                                        Flaky {suiteSummary.Flaky}
                                    </span>
                                ) : null}
                                {suiteSummary.Blocked > 0 ? (
                                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                                        Blocked {suiteSummary.Blocked}
                                    </span>
                                ) : null}
                                {suiteSummary.Failed > 0 ? (
                                    <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                                        Failed {suiteSummary.Failed}
                                    </span>
                                ) : null}
                                <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 transition group-open:bg-zinc-900 group-open:text-white">
                                    Collapsible
                                </span>
                            </div>
                        </summary>
                        <div className="space-y-3 border-t border-zinc-200 px-4 py-4">
                            {suiteRecords.map((record) => {
                                const rowId = `${record.id}-${record.browser}-${record.order}`;
                                const expanded = expandedRows.includes(rowId);
                                const failedSelected = selectedFailedTitles.includes(record.title);

                                return (
                                    <Fragment key={rowId}>
                                        <article className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                                <div>
                                                    <div className="text-sm font-semibold text-zinc-950">{record.title}</div>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    <span
                                                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses(
                                                            record.status
                                                        )}`}
                                                    >
                                                        {record.status}
                                                    </span>
                                                    <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700">
                                                        {record.browser}
                                                    </span>
                                                    <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700">
                                                        {formatMilliseconds(record.duration)}
                                                    </span>
                                                    {record.interactionType ? (
                                                        <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800">
                                                            {record.interactionType}
                                                        </span>
                                                    ) : null}
                                                    <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700">
                                                        {record.area}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="mt-4 rounded-2xl border border-zinc-200 bg-white px-4 py-3">
                                                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                                    Expected Result
                                                </div>
                                                <p className="mt-2 text-sm leading-6 text-zinc-600">
                                                    {record.description}
                                                </p>
                                            </div>

                                            <div className="mt-4 rounded-2xl border border-zinc-200 bg-white px-4 py-3">
                                                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                                    Observed Outcome
                                                </div>
                                                <p className="mt-2 text-sm leading-6 text-zinc-600">
                                                    {formatExecutionRemark(record)}
                                                </p>
                                            </div>

                                            <div className="mt-4 flex flex-wrap gap-2">
                                                {record.status === "Failed" ? (
                                                    <label className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-zinc-400 hover:text-zinc-950">
                                                        <input
                                                            type="checkbox"
                                                            checked={failedSelected}
                                                            onChange={() => onToggleFailedSelection(record.title)}
                                                            aria-label={`Select ${record.title} for rerun`}
                                                            className="h-4 w-4 rounded border-zinc-300 text-rose-600 focus:ring-rose-500"
                                                        />
                                                        Select for rerun
                                                    </label>
                                                ) : null}
                                                {record.status === "Failed" ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => onRerunFailedTitle(record.title)}
                                                        disabled={rerunActionsDisabled}
                                                        className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:border-rose-400 hover:text-rose-900 disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        Rerun this failed test
                                                    </button>
                                                ) : null}
                                                <button
                                                    type="button"
                                                    onClick={() => toggleRow(rowId)}
                                                    className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-zinc-400 hover:text-zinc-950"
                                                >
                                                    {expanded ? "Hide validation steps" : "Show validation steps"}
                                                </button>
                                            </div>

                                            {expanded ? (
                                                <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
                                                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                                        Validation Steps
                                                    </div>
                                                    <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-zinc-600">
                                                        {record.reproductionSteps.map((step) => (
                                                            <li key={step}>{step}</li>
                                                        ))}
                                                    </ol>
                                                </div>
                                            ) : null}
                                        </article>
                                    </Fragment>
                                );
                            })}
                        </div>
                    </details>
                );
            })}
        </div>
    ) : (
        <EmptyState message="No test cases match the current execution filter." />
    );
}

function ArtifactLinkList({
    items,
    className,
    compact = false,
}: {
    items: ReportArtifactItem[];
    className?: string;
    compact?: boolean;
}) {
    return items.length > 0 ? (
        <div className={`space-y-2 ${className ?? ""}`}>
            {items.map((item) => (
                <div
                    key={item.artifactId}
                    className={`rounded-2xl border border-zinc-200 bg-white ${compact ? "px-3 py-2" : "px-4 py-3"}`}
                >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <div className="text-sm font-semibold text-zinc-950">{item.label}</div>
                            <div className="mt-1 text-xs leading-5 text-zinc-500">
                                {item.browser} · {item.testTitle || "No linked test"} · {item.fileName}
                            </div>
                            {item.defectTitle ? (
                                <div className="mt-1 text-xs leading-5 text-zinc-500">
                                    Linked bug: {item.defectId} · {item.defectTitle}
                                </div>
                            ) : null}
                        </div>
                        {item.downloadPath ? (
                            <a
                                href={item.downloadPath}
                                className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-zinc-400 hover:text-zinc-950"
                            >
                                Download
                            </a>
                        ) : null}
                    </div>
                </div>
            ))}
        </div>
    ) : null;
}

function DefectList({ defects }: { defects: DefectRecord[] }) {
    return defects.length > 0 ? (
        <div className="space-y-4">
            {defects.map((defect) => (
                <div
                    key={defect.id}
                    className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
                >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                                {defect.id}
                            </div>
                            <div className="mt-1 text-sm font-semibold text-zinc-950">
                                {defect.title}
                            </div>
                            {defect.testTitle ? (
                                <div className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                    Failed test: {defect.testTitle} · {defect.browser}
                                </div>
                            ) : null}
                            <p className="mt-2 text-sm leading-6 text-zinc-600">{defect.summary}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700">
                                {defect.area}
                            </span>
                            <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700">
                                {defect.browser}
                            </span>
                            <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                                {defect.severity}
                            </span>
                        </div>
                    </div>
                    <div className="mt-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm leading-6 text-zinc-600">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                            Observed failure
                        </div>
                        <div className="mt-2">{defect.description}</div>
                    </div>
                    <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm leading-6 text-zinc-600">
                        {defect.reproductionSteps.map((step) => (
                            <li key={step}>{step}</li>
                        ))}
                    </ol>
                    {defect.artifacts.length > 0 ? (
                        <div className="mt-4 rounded-2xl border border-zinc-200 bg-white px-4 py-3">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                Related artifacts
                            </div>
                            <ArtifactLinkList items={defect.artifacts} className="mt-3" />
                        </div>
                    ) : null}
                </div>
            ))}
        </div>
    ) : (
        <EmptyState message="No open defects were generated from this run." />
    );
}

function HeatmapGrid({ cells }: { cells: { area: string; count: number }[] }) {
    if (cells.length === 0) {
        return <EmptyState message="No defect hot spots detected in this run." />;
    }

    const max = Math.max(...cells.map((cell) => cell.count), 1);

    return (
        <div className="grid gap-3 sm:grid-cols-2">
            {cells.map((cell) => (
                <div
                    key={cell.area}
                    className="rounded-2xl border border-zinc-200 p-4"
                    style={{
                        backgroundColor: `rgba(244, 63, 94, ${0.12 + (cell.count / max) * 0.28})`,
                    }}
                >
                    <div className="text-sm font-semibold text-zinc-950">{cell.area}</div>
                    <div className="mt-1 text-xs text-zinc-600">
                        {cell.count} defect{cell.count === 1 ? "" : "s"}
                    </div>
                </div>
            ))}
        </div>
    );
}

function CoverageTable({ matrix }: { matrix: CoverageMatrixItem[] }) {
    return matrix.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-zinc-200">
            <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
                <thead className="bg-zinc-50 text-xs uppercase tracking-[0.16em] text-zinc-500">
                    <tr>
                        <th className="px-4 py-3 font-medium">Requirement</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Linked Tests</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 bg-white text-zinc-600">
                    {matrix.map((item) => (
                        <tr key={item.requirement}>
                            <td className="px-4 py-3 align-top font-medium text-zinc-900">
                                {item.requirement}
                            </td>
                            <td className="px-4 py-3 align-top">
                                <span
                                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${coverageClasses(
                                        item.status
                                    )}`}
                                >
                                    {item.status}
                                </span>
                            </td>
                            <td className="px-4 py-3 align-top text-xs leading-5 text-zinc-500">
                                {item.tests.length > 0 ? (
                                    <ul className="space-y-2">
                                        {item.tests.map((testName) => (
                                            <li
                                                key={`${item.requirement}-${testName}`}
                                                className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm leading-5 text-zinc-700"
                                            >
                                                {testName}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    "No tests mapped"
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    ) : (
        <EmptyState message="No coverage matrix was produced for this run." />
    );
}

function SessionEvidenceList({ items }: { items: ReportArtifactItem[] }) {
    return items.length > 0 ? (
        <ArtifactLinkList items={items} />
    ) : (
        <EmptyState message="No session evidence artifacts were captured for this run." />
    );
}

function PerformanceTable({
    rows,
}: {
    rows: { title: string; browser: string; area: string; duration: number }[];
}) {
    return rows.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
            {rows.map((row) => (
                <div
                    key={`${row.browser}-${row.title}`}
                    className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3 last:border-b-0"
                >
                    <div>
                        <div className="text-sm font-medium text-zinc-900">{row.title}</div>
                        <div className="text-xs text-zinc-500">
                            {row.area} • {row.browser}
                        </div>
                    </div>
                    <div className="text-sm font-semibold text-zinc-700">
                        {formatMilliseconds(row.duration)}
                    </div>
                </div>
            ))}
        </div>
    ) : (
        <EmptyState message="No performance-specific timings were captured." />
    );
}

function InfoCard({ title, body }: { title: string; body: string }) {
    return (
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="text-sm font-semibold text-zinc-950">{title}</div>
            <p className="mt-2 text-sm leading-6 text-zinc-500">{body}</p>
        </div>
    );
}

function EmptyState({ message }: { message: string }) {
    return (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-6 text-sm text-zinc-500">
            {message}
        </div>
    );
}

function toSentenceCase(value: string) {
    if (value.toLowerCase() === "seo") {
        return "SEO";
    }

    return value
        .split("/")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" / ");
}

function Spinner() {
    return (
        <svg
            className="h-4 w-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
        >
            <path
                d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
                strokeLinecap="round"
            />
        </svg>
    );
}
