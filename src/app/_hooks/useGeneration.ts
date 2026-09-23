import { useEffect, useRef, useState } from "react";
import { buildBusyInspectionTargets, buildSelectedPracticeDescription, normalizeBaseUrl, normalizeInspectionPaths, parseContentLines, parseNamedFlowLines } from "@/app/_lib/derive";
import type { BestPracticeArea, BusyInspectionTarget, ContentProfile, CrawlResult, SavedSuiteResult, Step, TestAuditMode } from "@/app/_lib/types";

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
    crawlResult: CrawlResult | null;
    selectedCrawledPaths: string[];
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
            paths: normalizeInspectionPaths(
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
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Generation failed");
            setEditedCode(data.code);
            if (params.isBaseUrlPlaceholderActive && normalizedBaseUrl.value === defaultBaseUrl) {
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
