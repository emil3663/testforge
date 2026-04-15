"use client";

import { Fragment, type ReactNode, useEffect, useRef, useState } from "react";

type Step = "idle" | "generating" | "ready" | "running" | "done";
type ReportTab =
    | "summary"
    | "execution"
    | "defects"
    | "coverage"
    | "performance"
    | "usability";
type ExecutionStatus = "Passed" | "Failed" | "Blocked" | "Flaky";

const BEST_PRACTICE_OPTIONS = [
    {
        id: "functional",
        label: "Functional",
        description: "Forms, links, navigation, and core flows",
    },
    {
        id: "cross-browser",
        label: "Cross-Browser",
        description: "Chromium, Firefox, and WebKit coverage",
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
const REPORT_TABS: ReportTab[] = [
    "summary",
    "execution",
    "defects",
    "coverage",
    "performance",
    "usability",
];

const BEST_PRACTICE_KEYWORDS: Record<BestPracticeArea, string[]> = {
    functional: ["functional", "flow", "journey", "form", "forms", "navigation", "link", "links"],
    "cross-browser": [
        "cross-browser",
        "browser",
        "chrome",
        "chromium",
        "firefox",
        "safari",
        "edge",
        "webkit",
    ],
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

interface ExecutionRecord {
    id: string;
    title: string;
    description: string;
    suite: string;
    area: string;
    interactionType: "Navigation" | "API" | "Form" | "Action" | null;
    browser: string;
    status: ExecutionStatus;
    duration: number;
    remarks: string;
    reproductionSteps: string[];
    order: number;
}

interface DefectRecord {
    id: string;
    summary: string;
    reproductionSteps: string[];
    severity: "Critical" | "Major" | "Minor";
    priority: "Critical" | "Major" | "Minor";
    status: "Open" | "Fixed" | "Closed";
    area: string;
    browser: string;
}

interface CoverageMatrixItem {
    requirement: string;
    status: "covered" | "partial" | "uncovered";
    tests: string[];
}

interface RunReport {
    summary: {
        planned: number;
        executed: number;
        passed: number;
        failed: number;
        blocked: number;
        flaky: number;
        duration: number;
        releaseRecommendation: string;
        defectDistribution: {
            Critical: number;
            Major: number;
            Minor: number;
        };
        passFailRatio: {
            passed: number;
            failed: number;
        };
        browsers: string[];
        defectTrend: { label: string; count: number }[];
    };
    execution: ExecutionRecord[];
    defects: {
        issues: DefectRecord[];
        heatmap: { area: string; count: number }[];
    };
    coverage: {
        percentage: number;
        covered: number;
        total: number;
        uncovered: string[];
        matrix: CoverageMatrixItem[];
    };
    performance: {
        totalDuration: number;
        averageDuration: number;
        throughput: number;
        slowestTests: {
            title: string;
            browser: string;
            area: string;
            duration: number;
        }[];
        pageResponseTimes: {
            title: string;
            duration: number;
            browser: string;
        }[];
        resourceUtilization: string;
        scalability: string;
    };
    usability: {
        successRate: number;
        findings: string[];
        videoClips: string;
        tasksCompleted: number;
        totalTasks: number;
    };
    rawOutput: string;
}

interface RunResult {
    passed: boolean;
    output: string;
    duration: number;
    report?: RunReport;
}

interface SavedSuiteResult {
    fileName: string;
    filePath: string;
    suiteTitles: string[];
}

interface ContentRules {
    paths: string[];
    requiredHeadings: string[];
    requiredText: string[];
    forbiddenText: string[];
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

const DEFAULT_CONTENT_RULES: ContentRules = {
    paths: ["/"],
    requiredHeadings: [],
    requiredText: [],
    forbiddenText: [],
};

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

function toMultilineValue(values: string[]) {
    return values.join("\n");
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

function formatMilliseconds(value: number) {
    if (value >= 60000) {
        return `${(value / 60000).toFixed(1)}m`;
    }

    if (value >= 1000) {
        return `${(value / 1000).toFixed(1)}s`;
    }

    return `${value}ms`;
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

function coverageClasses(status: CoverageMatrixItem["status"]) {
    if (status === "covered") {
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
    }

    if (status === "partial") {
        return "bg-amber-100 text-amber-800 border-amber-200";
    }

    return "bg-rose-100 text-rose-800 border-rose-200";
}

export default function Home() {
    const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
    const [description, setDescription] = useState("");
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
    const [saveLabel, setSaveLabel] = useState("Add to Test Explorer");
    const [savedSuite, setSavedSuite] = useState<SavedSuiteResult | null>(null);
    const [activeTab, setActiveTab] = useState<ReportTab>("summary");
    const [statusFilter, setStatusFilter] = useState<"All" | ExecutionStatus>("All");
    const [contentPathsInput, setContentPathsInput] = useState("");
    const [crawlResult, setCrawlResult] = useState<CrawlResult | null>(null);
    const [selectedCrawledPaths, setSelectedCrawledPaths] = useState<string[]>([]);
    const [crawlStatus, setCrawlStatus] = useState<"idle" | "crawling">("idle");
    const [crawlError, setCrawlError] = useState("");
    const [requiredHeadingsInput, setRequiredHeadingsInput] = useState("");
    const [requiredTextInput, setRequiredTextInput] = useState("");
    const [forbiddenTextInput, setForbiddenTextInput] = useState("");
    const [contentProfile, setContentProfile] = useState<ContentProfile | null>(null);
    const [lastGeneratedContentSignature, setLastGeneratedContentSignature] = useState("");
    const [isCreationCollapsed, setIsCreationCollapsed] = useState(false);
    const [isGeneratedCollapsed, setIsGeneratedCollapsed] = useState(false);
    const [isReportCollapsed, setIsReportCollapsed] = useState(false);
    const [isContentRulesCollapsed, setIsContentRulesCollapsed] = useState(true);
    const [isCrawledPagesCollapsed, setIsCrawledPagesCollapsed] = useState(false);
    const codeRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (editing && codeRef.current) {
            codeRef.current.focus();
        }
    }, [editing]);

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
        if (!description.trim()) return;

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
        setContentProfile(null);
        setIsCreationCollapsed(false);
        setIsGeneratedCollapsed(false);
        setIsReportCollapsed(false);

        const parsedPaths = parseContentLines(contentPathsInput).map((item) =>
            item.startsWith("/") ? item : `/${item}`
        );
        const activeSelectedCrawledPaths = crawlResult?.baseUrl === normalizedBaseUrl.value
            ? selectedCrawledPaths
            : [];
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
            setLastGeneratedContentSignature(JSON.stringify(contentRules));
            setIsGeneratedCollapsed(false);

            const res = await fetch("/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    baseUrl: normalizedBaseUrl.value,
                    description,
                    selectedPractices: effectiveSelectedPractices,
                    contentRules,
                    contentProfile: introspectionData,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Generation failed");
            setEditedCode(data.code);
            setBaseUrl(normalizedBaseUrl.value);
            setStep("ready");
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Unknown error");
            setStep("idle");
        }
    }

    async function handleRun() {
        if (effectiveSelectedPractices.length === 0) {
            setError("Select at least one best-practice area before running tests.");
            return;
        }

        setStep("running");
        setResult(null);
        setError("");
        setActiveTab("summary");
        setStatusFilter("All");
        setIsCreationCollapsed(true);
        setIsGeneratedCollapsed(true);
        setIsReportCollapsed(false);

        try {
            const res = await fetch("/api/run", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: editedCode, selectedPractices: effectiveSelectedPractices }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Run failed");
            setResult(data);
            setStep("done");
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Unknown error");
            setStep("ready");
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
        if (!editedCode.trim() || !description.trim()) {
            return;
        }

        setSaveLabel("Saving...");

        try {
            const response = await fetch("/api/save-suite", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: editedCode, description }),
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

        try {
            const response = await fetch("/api/crawl", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ baseUrl: normalizedBaseUrl.value }),
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error ?? "Site crawl failed");
            }

            setCrawlResult(data);
            setSelectedCrawledPaths(data.pages.map((page: CrawledPage) => page.path));
            setIsCrawledPagesCollapsed(false);
        } catch (err: unknown) {
            setCrawlError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            setCrawlStatus("idle");
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

    const isGenerating = step === "generating";
    const isRunning = step === "running";
    const isCrawling = crawlStatus === "crawling";
    const hasCode = step === "ready" || step === "done";
    const inferredPractices = inferBestPracticesFromDescription(description);
    const effectiveSelectedPractices: BestPracticeArea[] = [...new Set([...selectedPractices, ...inferredPractices])]
        .filter((practice) => !deselectedPractices.includes(practice));
    const isCrossBrowserSelected = effectiveSelectedPractices.includes("cross-browser");
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
    const isContentAwareReady =
        !contentAwareRequested ||
        (contentProfile !== null &&
            lastGeneratedContentSignature === JSON.stringify(contentRules) &&
            hasCode);
    const runBlockedMessage = !isContentAwareReady
        ? "Generate the suite again after completing the content-aware inputs before running it."
        : "";
    const showBusyOverlay = isGenerating || isRunning;
    const busyTarget = normalizeBaseUrl(baseUrl).ok
        ? normalizeBaseUrl(baseUrl).value
        : baseUrl.trim() || DEFAULT_BASE_URL;
    const busyLabel = isGenerating
        ? "Inspecting pages and generating tests..."
        : "Running generated Playwright suite...";
    const report = result?.report;
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
    const discoveredLinkCount = uniqueDiscoveredLinks.length;
    const discoveredLinkPages = (contentProfile?.pages ?? [])
        .map((page) => ({
            path: page.path,
            count: (page.linkDetails ?? []).length,
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
    const discoveredEmbeddedLinkCount = uniqueDiscoveredEmbeddedLinks.length;
    const discoveredEmbeddedLinkPages = (contentProfile?.pages ?? [])
        .map((page) => ({
            path: page.path,
            count: (page.embeddedLinkDetails ?? []).length,
        }))
        .filter((page) => page.count > 0);
    const crawledPages = crawlResult?.pages ?? [];
    const isCrawlResultStale = Boolean(
        crawlResult && normalizedBaseUrlForDisplay.ok && crawlResult.baseUrl !== normalizedBaseUrlForDisplay.value
    );

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.12),_transparent_32%),linear-gradient(180deg,#f7f8fc_0%,#f4f6fb_52%,#eef3f8_100%)] text-zinc-900">
            {showBusyOverlay && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/35 px-6 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-[28px] border border-white/70 bg-white/95 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
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
                                : "TestForge is executing the generated suite and collecting structured reporting data."}
                        </p>
                        <div className="mt-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-600">
                            Target site: {busyTarget}
                        </div>
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
                <CollapsibleSection
                    title="Test Suite Creation"
                    subtitle="Define the target, describe the scenario, and choose which best-practice areas should generate tests."
                    collapsed={isCreationCollapsed}
                    onToggle={() => setIsCreationCollapsed((value) => !value)}
                >
                    <div className="space-y-5">
                        <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                            <div className="flex h-full flex-col gap-5">
                                <div className="space-y-1.5">
                                    <label className="block text-sm font-medium text-zinc-700">
                                        Base URL
                                    </label>
                                    <input
                                        type="text"
                                        value={baseUrl}
                                        onChange={(event) => setBaseUrl(event.target.value)}
                                        inputMode="url"
                                        autoCapitalize="none"
                                        autoCorrect="off"
                                        spellCheck={false}
                                        placeholder="http://localhost:3000"
                                        className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                    />
                                    <p className="text-xs text-zinc-500">
                                        Accepts local addresses like localhost:3000 and full URLs.
                                    </p>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="block text-sm font-medium text-zinc-700">
                                        What do you want to test?
                                    </label>
                                    <textarea
                                        rows={5}
                                        value={description}
                                        onChange={(event) => setDescription(event.target.value)}
                                        placeholder="E.g. Create a cross-browser accessibility and performance suite for the login flow."
                                        className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none"
                                    />
                                    <p className="text-xs text-zinc-500">
                                        Matching keywords will highlight the applicable best-practice areas on the right. Only active highlighted areas are generated and run.
                                    </p>
                                </div>

                                <div className="flex-1 rounded-[24px] border border-zinc-200 bg-zinc-50 p-4">
                                    <button
                                        type="button"
                                        onClick={() => setIsCrawledPagesCollapsed((value) => !value)}
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
                                        <>
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
                                            </div>

                                            <div className="mt-3 rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs leading-5 text-zinc-500">
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

                                            <div className="mt-4 min-h-[196px] overflow-y-auto rounded-2xl border border-zinc-200 bg-white">
                                                {crawledPages.length > 0 ? (
                                                    <div className="divide-y divide-zinc-100">
                                                        {crawledPages.map((page) => {
                                                            const checked = selectedCrawledPaths.includes(page.path);

                                                            return (
                                                                <label
                                                                    key={page.path}
                                                                    className="flex cursor-pointer items-start gap-3 px-4 py-3 text-sm text-zinc-700"
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
                                                    </div>
                                                ) : (
                                                    <div className="flex min-h-[196px] items-center justify-center px-6 text-center text-xs leading-6 text-zinc-500">
                                                        Run the crawler to discover same-origin pages and choose what should be tested.
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-3 rounded-[24px] border border-zinc-200 bg-zinc-50 p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <label className="block text-sm font-medium text-zinc-700">
                                        Best-Practice Coverage
                                    </label>
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
                                onClick={() => setIsContentRulesCollapsed((value) => !value)}
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
                                <>
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
                                                            ? `${discoveredLinkCount} unique link${discoveredLinkCount === 1 ? "" : "s"} discovered and available for generated link tests.`
                                                            : "No link metadata was discovered in the latest inspection."}
                                                    </p>
                                                    <p className="mt-1 text-xs leading-5 text-emerald-800">
                                                        {discoveredEmbeddedLinkCount > 0
                                                            ? `${discoveredEmbeddedLinkCount} embedded target${discoveredEmbeddedLinkCount === 1 ? "" : "s"} discovered across frames, assets, forms, and runtime-style attributes.`
                                                            : "No embedded targets were discovered in the latest inspection."}
                                                    </p>
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

                                            {uniqueDiscoveredLinks.length > 0 && (
                                                <div className="mt-4">
                                                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                                                        Discovered Links
                                                    </div>
                                                    <div className="mt-2 max-h-56 overflow-y-auto rounded-2xl border border-emerald-200 bg-white">
                                                        <div className="divide-y divide-emerald-100">
                                                            {uniqueDiscoveredLinks.map((link, index) => (
                                                                <div key={`${link.url}-${index}`} className="px-4 py-3 text-xs leading-5 text-emerald-950">
                                                                    <div className="font-medium text-zinc-900">
                                                                        {getLinkPreviewLabel(link)}
                                                                    </div>
                                                                    <div className="mt-1 text-zinc-600">
                                                                        {link.category === "api" ? "API" : "Navigation"}
                                                                        {link.linkType ? ` • ${link.linkType}` : ""}
                                                                        {link.containerLabel ? ` • ${link.containerLabel}` : ""}
                                                                    </div>
                                                                    <div className="mt-1 break-all text-zinc-500">
                                                                        {link.url}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {uniqueDiscoveredEmbeddedLinks.length > 0 && (
                                                <div className="mt-4">
                                                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                                                        Embedded Targets
                                                    </div>
                                                    <div className="mt-2 max-h-56 overflow-y-auto rounded-2xl border border-emerald-200 bg-white">
                                                        <div className="divide-y divide-emerald-100">
                                                            {uniqueDiscoveredEmbeddedLinks.map((embeddedLink, index) => (
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
                                            <label className="block text-sm font-medium text-zinc-700">
                                                Paths to inspect
                                            </label>
                                            <textarea
                                                rows={4}
                                                value={contentPathsInput}
                                                onChange={(event) => setContentPathsInput(event.target.value)}
                                                placeholder="Leave blank to inspect the exact page in Base URL, or add paths like /pricing and /about"
                                                className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="block text-sm font-medium text-zinc-700">
                                                Required headings
                                            </label>
                                            <textarea
                                                rows={4}
                                                value={requiredHeadingsInput}
                                                onChange={(event) => setRequiredHeadingsInput(event.target.value)}
                                                placeholder="Welcome\nPricing\nFrequently Asked Questions"
                                                className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="block text-sm font-medium text-zinc-700">
                                                Required text snippets
                                            </label>
                                            <textarea
                                                rows={4}
                                                value={requiredTextInput}
                                                onChange={(event) => setRequiredTextInput(event.target.value)}
                                                placeholder="Start free trial\nContact sales"
                                                className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="block text-sm font-medium text-zinc-700">
                                                Forbidden text snippets
                                            </label>
                                            <textarea
                                                rows={4}
                                                value={forbiddenTextInput}
                                                onChange={(event) => setForbiddenTextInput(event.target.value)}
                                                placeholder="Lorem ipsum\nComing soon"
                                                className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none"
                                            />
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <button
                            onClick={handleGenerate}
                            disabled={!description.trim() || isGenerating || isRunning || !canGenerateOrRun}
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
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleRun}
                                disabled={!hasCode || isRunning || !isContentAwareReady || !canGenerateOrRun}
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
                            {isCrossBrowserSelected
                                ? " Cross-browser mode will run Chromium, Firefox, and WebKit."
                                : ""}
                            {savedSuite ? " VS Code Test Explorer will show one generated file with the saved top-level suites underneath it." : ""}
                            {runBlockedMessage ? ` ${runBlockedMessage}` : ""}
                        </span>
                        <button
                            onClick={handleRun}
                            disabled={!hasCode || isRunning || !isContentAwareReady || !canGenerateOrRun}
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
                </CollapsibleSection>

                {error && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        <strong>Error:</strong> {error}
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
                                            className={`rounded-full border px-3 py-1 text-xs font-semibold ${result.passed
                                                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                                : "border-rose-200 bg-rose-50 text-rose-800"
                                                }`}
                                        >
                                            {report.summary.releaseRecommendation}
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
                                                color="bg-rose-600"
                                            />
                                            <SeverityBar
                                                label="Major"
                                                value={report.summary.defectDistribution.Major}
                                                color="bg-amber-500"
                                            />
                                            <SeverityBar
                                                label="Minor"
                                                value={report.summary.defectDistribution.Minor}
                                                color="bg-sky-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-2">
                                {REPORT_TABS.map((tab) => (
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
                                    <ExecutionTable records={filteredExecution} />
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
                                                        key={finding}
                                                        className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm leading-6 text-zinc-600"
                                                    >
                                                        {finding}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                        <InfoCard
                                            title="Session evidence"
                                            body={report.usability.videoClips}
                                        />
                                    </div>
                                </ReportPanel>
                            )}

                            <ReportPanel
                                eyebrow="Raw Console"
                                title="Execution output"
                                description="Retained for debugging alongside the structured dashboard."
                            >
                                <div className="mb-4 flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleCopyRawOutput(report.rawOutput)}
                                        className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-zinc-400 hover:text-zinc-950"
                                    >
                                        {rawOutputCopyLabel}
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
                        subtitle="Structured report data was not available for this run, so only the raw console output is shown."
                        collapsed={isReportCollapsed}
                        onToggle={() => setIsReportCollapsed((value) => !value)}
                    >
                        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div className="text-sm font-semibold text-zinc-900">
                                    {result.passed ? "All tests passed" : "Tests failed"} — {formatMilliseconds(result.duration)}
                                </div>
                                <div className="flex flex-wrap gap-2">
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
                            <pre className="mt-4 overflow-x-auto rounded-2xl bg-zinc-950 px-4 py-4 font-mono text-xs leading-6 text-zinc-200 whitespace-pre-wrap">
                                {result.output}
                            </pre>
                        </div>
                    </CollapsibleSection>
                ) : null}
            </main>
        </div>
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
    return (
        <section className={`rounded-[28px] border p-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)] ${dark
            ? "border-white/70 bg-zinc-950 text-zinc-100 shadow-[0_24px_80px_rgba(15,23,42,0.16)]"
            : "border-white/70 bg-white/85 text-zinc-900 backdrop-blur"
            }`}>
            <button
                type="button"
                onClick={onToggle}
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
            {!collapsed && <div className="mt-6">{children}</div>}
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
    color,
}: {
    label: string;
    value: number;
    color: string;
}) {
    return (
        <div>
            <div className="mb-1 flex items-center justify-between text-xs font-medium">
                <span>{label}</span>
                <span>{value}</span>
            </div>
            <div className="h-2 rounded-full bg-zinc-100">
                <div
                    className={`h-2 rounded-full ${color}`}
                    style={{ width: `${Math.max(8, value * 18)}px` }}
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

function ExecutionTable({ records }: { records: ExecutionRecord[] }) {
    const [expandedRows, setExpandedRows] = useState<string[]>([]);

    function toggleRow(rowId: string) {
        setExpandedRows((current) =>
            current.includes(rowId)
                ? current.filter((item) => item !== rowId)
                : [...current, rowId]
        );
    }

    return records.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-zinc-200">
            <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
                <thead className="bg-zinc-50 text-xs uppercase tracking-[0.16em] text-zinc-500">
                    <tr>
                        <th className="px-4 py-3 font-medium">Test Case</th>
                        <th className="px-4 py-3 font-medium">Area</th>
                        <th className="px-4 py-3 font-medium">Interaction Type</th>
                        <th className="px-4 py-3 font-medium">Browser</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Duration</th>
                        <th className="px-4 py-3 font-medium">Remarks</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 bg-white text-zinc-600">
                    {records.map((record) => {
                        const rowId = `${record.id}-${record.browser}-${record.order}`;
                        const expanded = expandedRows.includes(rowId);

                        return (
                            <Fragment key={rowId}>
                                <tr>
                                    <td className="px-4 py-3 align-top">
                                        <button
                                            type="button"
                                            onClick={() => toggleRow(rowId)}
                                            className="flex w-full items-start justify-between gap-3 text-left"
                                        >
                                            <div>
                                                <div className="font-medium text-zinc-900">{record.title}</div>
                                                <div className="mt-1 text-xs leading-5 text-zinc-500">
                                                    {record.description}
                                                </div>
                                            </div>
                                            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                                {expanded ? "Hide steps" : "Show steps"}
                                            </span>
                                        </button>
                                    </td>
                                    <td className="px-4 py-3 align-top">{record.area}</td>
                                    <td className="px-4 py-3 align-top">
                                        {record.interactionType ? (
                                            <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800">
                                                {record.interactionType}
                                            </span>
                                        ) : (
                                            <span className="text-zinc-400">-</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 align-top">{record.browser}</td>
                                    <td className="px-4 py-3 align-top">
                                        <span
                                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses(
                                                record.status
                                            )}`}
                                        >
                                            {record.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 align-top">{formatMilliseconds(record.duration)}</td>
                                    <td className="px-4 py-3 align-top text-xs leading-5 text-zinc-500">
                                        {record.remarks}
                                    </td>
                                </tr>
                                {expanded && (
                                    <tr className="bg-zinc-50/80">
                                        <td colSpan={7} className="px-4 py-4">
                                            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                                                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                                    Validation Steps
                                                </div>
                                                <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-zinc-600">
                                                    {record.reproductionSteps.map((step) => (
                                                        <li key={step}>{step}</li>
                                                    ))}
                                                </ol>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </Fragment>
                        );
                    })}
                </tbody>
            </table>
        </div>
    ) : (
        <EmptyState message="No test cases match the current execution filter." />
    );
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
                                {defect.summary}
                            </div>
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
                    <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm leading-6 text-zinc-600">
                        {defect.reproductionSteps.map((step) => (
                            <li key={step}>{step}</li>
                        ))}
                    </ol>
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
                                {item.tests.length > 0 ? item.tests.join(" • ") : "No tests mapped"}
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
