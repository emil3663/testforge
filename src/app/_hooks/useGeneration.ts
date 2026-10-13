import { useEffect, useRef, useState } from "react";
import { buildBusyInspectionTargets, buildSelectedPracticeDescription, normalizeBaseUrl, normalizeInspectionPaths, parseContentLines, parseNamedFlowLines } from "@/app/_lib/derive";
import type { BestPracticeArea, BusyInspectionTarget, ContentProfile, CrawlResult, SavedSuiteResult, Step, TestAuditMode } from "@/app/_lib/types";
import { STANDARD_RUN, type RunMode } from "@/lib/comprehensive/run-mode";
import { buildPageTypeCoverage } from "@/lib/selection/coverage";

interface HandleGenerateParams {
    baseUrl: string;
    effectiveSelectedPractices: BestPracticeArea[];
    isDescriptionPlaceholderActive: boolean;
    description: string;
    auditMode: TestAuditMode;
    contentPathsInput: string;
    requiredHeadingsInput: string;
    requiredTextInput: string;
    forbiddenTextInput: string;
    // TFP-096: one "label: /entry -> /exit" flow per line.
    namedFlowsInput: string;
    // TFP-090: journey ids the user selected on the review screen. Pruned
    // against the profile actually used before being sent, so a stale id
    // from an earlier scan never reaches run config.
    selectedJourneyIds: string[];
    // Phase 35 (TFP-132): Standard, or Comprehensive for one area.
    runMode: RunMode;
    crawlResult: CrawlResult | null;
    selectedCrawledPaths: string[];
    /** Phase 40 (TFP-173): whether the crawl selection is still the one chosen by page type. */
    isTypeSelection: boolean;
    /** Phase 40 (TFP-174): the pages listed in the URL field, run exactly as listed; null for one URL. */
    urlListPages: string[] | null;
    setCrawlError: (message: string) => void;
    isBaseUrlPlaceholderActive: boolean;
    setBaseUrl: (value: string) => void;
    setIsBaseUrlPlaceholderActive: (value: boolean) => void;
    setStep: (step: Step) => void;
    setError: (message: string) => void;
    setIsCreationCollapsed: (value: boolean) => void;
    setResult: (value: null) => void;
    setActiveTab: (tab: "summary") => void;
    setStatusFilter: (status: "All") => void;
    setSelectedFailedRerunTitles: (titles: string[]) => void;
    setIsBusyTargetListExpanded: (value: boolean) => void;
    setIsReportCollapsed: (value: boolean) => void;
}

export function useGeneration(defaultBaseUrl: string, defaultTestAuditMode: TestAuditMode) {
    const [editedCode, setEditedCode] = useState("");
    // Phase 34 (TFP-119): how the suite was generated (gap-fill outcome, gate
    // verdicts), passed on to /api/run so the run records it. Null when the
    // generate response carried none (template-only).
    const [lastGeneration, setLastGeneration] = useState<Record<string, unknown> | null>(null);
    // Phase 35 (TFP-132): the run mode the suite on screen was generated for;
    // a run always uses this one, and changing the choice asks for a regenerate.
    const [lastGeneratedRunMode, setLastGeneratedRunMode] = useState<RunMode>(STANDARD_RUN);
    const [editing, setEditing] = useState(false);
    const [copyLabel, setCopyLabel] = useState("Copy");
    const [saveLabel, setSaveLabel] = useState("Add to Test Explorer");
    const [savedSuite, setSavedSuite] = useState<SavedSuiteResult | null>(null);
    const [contentProfile, setContentProfile] = useState<ContentProfile | null>(null);
    const [lastGeneratedContentSignature, setLastGeneratedContentSignature] = useState("");
    const [lastGeneratedBaseUrl, setLastGeneratedBaseUrl] = useState(defaultBaseUrl);
    const [lastGeneratedInspectionPaths, setLastGeneratedInspectionPaths] = useState<string[]>(["/"]);
    const [lastGeneratedInspectionTargets, setLastGeneratedInspectionTargets] = useState<BusyInspectionTarget[]>([]);
    const [lastGeneratedAuditMode, setLastGeneratedAuditMode] = useState<TestAuditMode>(defaultTestAuditMode);
    const [lastGeneratedPracticeSignature, setLastGeneratedPracticeSignature] = useState("[]");
    const [lastGeneratedJourneySignature, setLastGeneratedJourneySignature] = useState("[]");
    const [isGeneratedCollapsed, setIsGeneratedCollapsed] = useState(false);
    const codeRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (editing && codeRef.current) {
            codeRef.current.focus();
        }
    }, [editing]);

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

    async function handleSaveToExplorer(effectiveDescription: string) {
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
            return null;
        } catch (err: unknown) {
            setSaveLabel("Save failed");
            setTimeout(() => setSaveLabel("Add to Test Explorer"), 2000);
            return err instanceof Error ? err.message : "Unknown error";
        }
    }

    // reuseProfile: "Generate selected" (TFP-090) regenerates from the scan
    // already on screen instead of re-inspecting the site, so the journeys
    // the user reviewed are exactly the ones the selection ids refer to.
    async function handleGenerate(params: HandleGenerateParams, reuseProfile: ContentProfile | null = null) {
        const normalizedBaseUrl = normalizeBaseUrl(params.baseUrl);
        if (!normalizedBaseUrl.ok) {
            params.setError(normalizedBaseUrl.message);
            return;
        }

        if (params.effectiveSelectedPractices.length === 0) {
            params.setError("Select at least one best-practice area before generating tests.");
            return;
        }

        params.setStep("generating");
        setEditedCode("");
        params.setResult(null);
        params.setError("");
        params.setCrawlError("");
        params.setIsCreationCollapsed(false);
        setSaveLabel("Add to Test Explorer");
        setSavedSuite(null);
        params.setActiveTab("summary");
        params.setStatusFilter("All");
        params.setSelectedFailedRerunTitles([]);
        if (!reuseProfile) {
            setContentProfile(null);
        }
        params.setIsBusyTargetListExpanded(false);
        setIsGeneratedCollapsed(false);
        params.setIsReportCollapsed(false);

        const parsedPaths = parseContentLines(params.contentPathsInput).map((item) =>
            item.startsWith("/") ? item : `/${item}`
        );
        const activeSelectedCrawledPaths = params.crawlResult?.baseUrl === normalizedBaseUrl.value
            ? params.selectedCrawledPaths
            : [];
        const effectiveDescription = (params.isDescriptionPlaceholderActive ? "" : params.description).trim() || buildSelectedPracticeDescription(params.effectiveSelectedPractices);
        const contentRules = {
            // Phase 40 Decision 8 (TFP-174): a list in the URL field runs exactly those pages.
            paths: params.urlListPages ?? normalizeInspectionPaths(
                normalizedBaseUrl.value,
                parsedPaths,
                activeSelectedCrawledPaths
            ),
            requiredHeadings: parseContentLines(params.requiredHeadingsInput),
            requiredText: parseContentLines(params.requiredTextInput),
            forbiddenText: parseContentLines(params.forbiddenTextInput),
        };

        const { flows: namedFlows } = parseNamedFlowLines(params.namedFlowsInput);

        try {
            let introspectionData: ContentProfile;
            if (reuseProfile) {
                introspectionData = reuseProfile;
            } else {
                const introspectionResponse = await fetch("/api/introspect", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        baseUrl: normalizedBaseUrl.value,
                        paths: contentRules.paths,
                        namedFlows,
                    }),
                });
                introspectionData = await introspectionResponse.json();
                if (!introspectionResponse.ok) {
                    throw new Error((introspectionData as unknown as { error?: string }).error ?? "Page inspection failed");
                }
            }

            const candidateIds = new Set((introspectionData.journeys ?? []).map((journey) => journey.id));
            const selectedJourneyIds = params.selectedJourneyIds.filter((id) => candidateIds.has(id));

            setContentProfile(introspectionData);
            setLastGeneratedJourneySignature(JSON.stringify([...selectedJourneyIds].sort()));
            setLastGeneratedContentSignature(JSON.stringify({ contentRules, namedFlows, auditMode: params.auditMode }));
            setLastGeneratedBaseUrl(normalizedBaseUrl.value);
            setLastGeneratedInspectionPaths(contentRules.paths);
            setLastGeneratedInspectionTargets(
                buildBusyInspectionTargets(
                    normalizedBaseUrl.value,
                    contentRules.paths,
                    params.crawlResult?.baseUrl === normalizedBaseUrl.value ? params.crawlResult.pages : []
                )
            );
            setLastGeneratedAuditMode(params.auditMode);
            setLastGeneratedPracticeSignature(JSON.stringify([...params.effectiveSelectedPractices].sort()));
            setIsGeneratedCollapsed(false);

            const res = await fetch("/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    baseUrl: normalizedBaseUrl.value,
                    description: effectiveDescription,
                    selectedPractices: params.effectiveSelectedPractices,
                    auditMode: params.auditMode,
                    contentRules: { ...contentRules, selectedJourneyIds },
                    contentProfile: introspectionData,
                    ...(params.runMode.kind === "comprehensive" ? { runMode: params.runMode } : {}),
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Generation failed");
            setEditedCode(data.code);
            setLastGeneratedRunMode(params.runMode);
            // Phase 40 (TFP-173): when the pages came from a crawl, the page types found, covered and skipped.
            const rankedTypes = params.crawlResult?.baseUrl === normalizedBaseUrl.value ? params.crawlResult.rankedTypes : undefined;
            const pageTypes = params.urlListPages
                ? buildPageTypeCoverage({
                    baseUrl: normalizedBaseUrl.value,
                    pages: rankedTypes ? params.crawlResult?.pages ?? [] : [],
                    rankedTypes: rankedTypes ?? [],
                    runMode: params.runMode,
                    selectedPaths: contentRules.paths,
                    selectedBy: "list",
                })
                : rankedTypes && rankedTypes.length > 0 && activeSelectedCrawledPaths.length > 0
                ? buildPageTypeCoverage({
                    baseUrl: normalizedBaseUrl.value,
                    pages: params.crawlResult?.pages ?? [],
                    rankedTypes,
                    runMode: params.runMode,
                    selectedPaths: contentRules.paths,
                    selectedBy: params.isTypeSelection ? "type" : "user",
                })
                : undefined;
            // A template-only generation answers without `generatedBy` (no model or key configured); the
            // page types and the site suite's record (Phase 42, TFP-190) still need a record to travel
            // in, and "template" is what wrote that suite.
            const siteSuite = data.siteSuite && typeof data.siteSuite === "object" ? data.siteSuite : undefined;
            const generatedBy = typeof data.generatedBy === "string" ? data.generatedBy : pageTypes || siteSuite ? "template" : null;
            setLastGeneration(generatedBy ? { generatedBy, model: data.model, fallbackReason: data.fallbackReason, gapFill: data.gapFill, gates: data.gates ?? [], ...(pageTypes ? { pageTypes } : {}), ...(siteSuite ? { siteSuite } : {}) } : null);
            if (params.urlListPages) {
                // The list stays in the field as typed, so the same pages can be run again.
            } else if (params.isBaseUrlPlaceholderActive && normalizedBaseUrl.value === defaultBaseUrl) {
                params.setBaseUrl(defaultBaseUrl);
                params.setIsBaseUrlPlaceholderActive(true);
            } else {
                params.setBaseUrl(normalizedBaseUrl.value);
                params.setIsBaseUrlPlaceholderActive(false);
            }
            params.setStep("ready");
        } catch (err: unknown) {
            params.setError(err instanceof Error ? err.message : "Unknown error");
            params.setStep("idle");
        }
    }

    return {
        editedCode,
        lastGeneration,
        lastGeneratedRunMode,
        setEditedCode,
        editing,
        setEditing,
        copyLabel,
        saveLabel,
        setSaveLabel,
        savedSuite,
        setSavedSuite,
        contentProfile,
        setContentProfile,
        lastGeneratedContentSignature,
        setLastGeneratedContentSignature,
        lastGeneratedBaseUrl,
        setLastGeneratedBaseUrl,
        lastGeneratedInspectionPaths,
        setLastGeneratedInspectionPaths,
        lastGeneratedInspectionTargets,
        setLastGeneratedInspectionTargets,
        lastGeneratedAuditMode,
        setLastGeneratedAuditMode,
        lastGeneratedPracticeSignature,
        setLastGeneratedPracticeSignature,
        lastGeneratedJourneySignature,
        isGeneratedCollapsed,
        setIsGeneratedCollapsed,
        codeRef,
        handleCopy,
        handleSaveToExplorer,
        handleGenerate,
    };
}
