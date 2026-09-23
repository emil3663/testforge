import { CollapsibleSection } from "@/app/_components/CollapsibleSection";
import type { CandidateJourney, SiteGraphEdge } from "@/lib/introspect/types";

interface JourneyReviewSectionProps {
    journeys: CandidateJourney[];
    selectedJourneyIds: string[];
    toggleJourney: (journeyId: string) => void;
    clearJourneySelection: () => void;
    handleGenerateSelected: () => void;
    isBusy: boolean;
    isCollapsed: boolean;
    setIsCollapsed: (updater: (value: boolean) => boolean) => void;
}

const STEP_KIND_LABEL: Record<SiteGraphEdge["kind"], string> = {
    link: "link",
    "form-submit": "form submit",
    action: "action",
};

function describeStep(step: SiteGraphEdge) {
    const name = step.text || step.rawValue || step.tagName;
    return `${name} (${STEP_KIND_LABEL[step.kind]})`;
}

// TFP-090: reviews the ranked candidates TFP-089 produced. Mirrors the
// best-practice-area picker's interaction (a pressed/unpressed toggle per
// item, a count of what's active) and writes the selection into run config
// only when "Generate selected" is used - nothing is selected by default,
// so nothing is generated for a journey nobody looked at.
export function JourneyReviewSection({
    journeys,
    selectedJourneyIds,
    toggleJourney,
    clearJourneySelection,
    handleGenerateSelected,
    isBusy,
    isCollapsed,
    setIsCollapsed,
}: JourneyReviewSectionProps) {
    return (
        <CollapsibleSection
            title="Candidate Journeys"
            subtitle="Review the multi-page flows found ending in a form submit, and pick the ones to generate end-to-end tests for. Nothing is generated for a journey you leave unselected."
            collapsed={isCollapsed}
            onToggle={() => setIsCollapsed((value) => !value)}
        >
            {journeys.length === 0 ? (
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm leading-6 text-zinc-600">
                    No candidate journeys were found. A journey needs a path through the inspected pages that ends
                    in a form submit; inspect more pages (or name a flow) to find more.
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="text-xs text-zinc-500" data-testid="journey-selection-count">
                            {selectedJourneyIds.length === 0
                                ? `No journeys selected (${journeys.length} candidate${journeys.length === 1 ? "" : "s"})`
                                : `${selectedJourneyIds.length} of ${journeys.length} selected`}
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={clearJourneySelection}
                                disabled={selectedJourneyIds.length === 0 || isBusy}
                                className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:border-zinc-300 disabled:opacity-50"
                            >
                                Clear selection
                            </button>
                            <button
                                type="button"
                                onClick={handleGenerateSelected}
                                disabled={selectedJourneyIds.length === 0 || isBusy}
                                className="rounded-full bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-zinc-300"
                            >
                                Generate selected
                            </button>
                        </div>
                    </div>
                    <ul className="grid gap-2">
                        {journeys.map((journey) => {
                            const selected = selectedJourneyIds.includes(journey.id);

                            return (
                                <li key={journey.id}>
                                    <button
                                        type="button"
                                        aria-pressed={selected}
                                        data-journey-id={journey.id}
                                        onClick={() => toggleJourney(journey.id)}
                                        className={`w-full rounded-2xl border px-4 py-3 text-left transition ${selected
                                            ? "border-emerald-500 bg-emerald-50 text-emerald-950 shadow-sm"
                                            : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                                            }`}
                                    >
                                        <span className="flex flex-wrap items-center gap-2">
                                            <span className="text-xs font-semibold text-zinc-500">#{journey.rank}</span>
                                            <span className="text-sm font-semibold">{journey.path.join(" → ")}</span>
                                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${journey.source === "named"
                                                ? "bg-indigo-100 text-indigo-800"
                                                : "bg-zinc-100 text-zinc-600"
                                                }`}>
                                                {journey.source === "named" ? `Named flow: ${journey.label}` : "Automatic"}
                                            </span>
                                        </span>
                                        <span className="mt-1 block text-xs leading-5 text-zinc-500">
                                            {journey.steps.map(describeStep).join("  →  ")}
                                        </span>
                                        {journey.declaredExitPath && !journey.exitInGraph && (
                                            <span className="mt-1 block text-xs leading-5 text-amber-700">
                                                Declared exit {journey.declaredExitPath} — not verified until the journey test submits the form.
                                            </span>
                                        )}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </CollapsibleSection>
    );
}
