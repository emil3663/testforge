import type { RefObject } from "react";
import { CollapsibleSection } from "@/app/_components/CollapsibleSection";
import { Spinner } from "@/app/_components/Spinner";
import type { TestAuditMode } from "@/app/_lib/types";

interface SavedSuiteResult {
    fileName: string;
    filePath: string;
    suiteTitles: string[];
}

interface GeneratedSuiteSectionProps {
    isGeneratedCollapsed: boolean;
    setIsGeneratedCollapsed: (updater: (value: boolean) => boolean) => void;
    openReportInNewPage: boolean;
    setOpenReportInNewPage: (value: boolean) => void;
    setReportPopupNotice: (value: string) => void;
    handleRun: () => void;
    hasCode: boolean;
    isRunning: boolean;
    isContentAwareReady: boolean;
    isPracticeSelectionReady: boolean;
    canGenerateOrRun: boolean;
    handleSaveToExplorer: () => void;
    isGenerating: boolean;
    saveLabel: string;
    editing: boolean;
    setEditing: (updater: (value: boolean) => boolean) => void;
    handleCopy: () => void;
    copyLabel: string;
    codeRef: RefObject<HTMLTextAreaElement | null>;
    editedCode: string;
    setEditedCode: (value: string) => void;
    savedSuite: SavedSuiteResult | null;
    lastGeneratedAuditMode: TestAuditMode;
    runBlockedMessage: string;
    continueRunUnavailableMessage: string;
}

export function GeneratedSuiteSection({
    isGeneratedCollapsed,
    setIsGeneratedCollapsed,
    openReportInNewPage,
    setOpenReportInNewPage,
    setReportPopupNotice,
    handleRun,
    hasCode,
    isRunning,
    isContentAwareReady,
    isPracticeSelectionReady,
    canGenerateOrRun,
    handleSaveToExplorer,
    isGenerating,
    saveLabel,
    editing,
    setEditing,
    handleCopy,
    copyLabel,
    codeRef,
    editedCode,
    setEditedCode,
    savedSuite,
    lastGeneratedAuditMode,
    runBlockedMessage,
    continueRunUnavailableMessage,
}: GeneratedSuiteSectionProps) {
    return (
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
    );
}
