import { CollapsibleSection } from "@/app/_components/CollapsibleSection";
import { COMPREHENSIVE_AREAS, DEFAULT_PAGE_CAP, MAX_PAGE_CAP } from "@/lib/comprehensive/run-mode";
import type { ComprehensiveArea } from "@/lib/comprehensive/run-mode";

export type RunTypeChoice = "standard" | "comprehensive";

interface RunTypeSectionProps {
    runType: RunTypeChoice;
    setRunType: (value: RunTypeChoice) => void;
    comprehensiveArea: ComprehensiveArea;
    setComprehensiveArea: (value: ComprehensiveArea) => void;
    pageCapInput: string;
    setPageCapInput: (value: string) => void;
    pageCapProblem: string;
    isCollapsed: boolean;
    setIsCollapsed: (updater: (value: boolean) => boolean) => void;
}

const AREA_LABELS: Record<ComprehensiveArea, { label: string; help: string }> = {
    security: {
        label: "Security (passive)",
        help: "Read-only: loads every page and reads what comes back, plus one request to a page that cannot exist. Sends no input.",
    },
    accessibility: {
        label: "Accessibility",
        help: "Every page, checked against WCAG. Automated checks find about half of accessibility issues; the report says what needs a person.",
    },
};

// Phase 35 (TFP-132, Decision 1): Standard is today's breadth run, unchanged.
// Comprehensive goes deep on one chosen area, on every known page up to a cap.
export function RunTypeSection({
    runType,
    setRunType,
    comprehensiveArea,
    setComprehensiveArea,
    pageCapInput,
    setPageCapInput,
    pageCapProblem,
    isCollapsed,
    setIsCollapsed,
}: RunTypeSectionProps) {
    return (
        <CollapsibleSection
            title="Run Type"
            subtitle="Standard runs the same best-practice checks on every site. Comprehensive goes deep on one area, on every page TestForge knows, up to a cap."
            collapsed={isCollapsed}
            onToggle={() => setIsCollapsed((value) => !value)}
        >
            <div className="space-y-5">
                <fieldset className="space-y-2">
                    <legend className="text-sm font-medium text-zinc-700">Run type</legend>
                    {(["standard", "comprehensive"] as const).map((choice) => (
                        <label key={choice} className="flex items-start gap-2 text-sm text-zinc-700">
                            <input
                                type="radio"
                                name="run-type"
                                value={choice}
                                checked={runType === choice}
                                onChange={() => setRunType(choice)}
                                className="mt-1"
                            />
                            <span>
                                <span className="font-medium">{choice === "standard" ? "Standard" : "Comprehensive"}</span>
                                <span className="block text-xs text-zinc-500">
                                    {choice === "standard"
                                        ? "Breadth: the selected best-practice areas, a few tests each."
                                        : "Depth: one area, every known page, reported on its own."}
                                </span>
                            </span>
                        </label>
                    ))}
                </fieldset>

                {runType === "comprehensive" && (
                    <div className="grid gap-4 md:grid-cols-2">
                        <fieldset className="space-y-2">
                            <legend className="text-sm font-medium text-zinc-700">Area</legend>
                            {COMPREHENSIVE_AREAS.map((area) => (
                                <label key={area} className="flex items-start gap-2 text-sm text-zinc-700">
                                    <input
                                        type="radio"
                                        name="comprehensive-area"
                                        value={area}
                                        checked={comprehensiveArea === area}
                                        onChange={() => setComprehensiveArea(area)}
                                        className="mt-1"
                                    />
                                    <span>
                                        <span className="font-medium">{AREA_LABELS[area].label}</span>
                                        <span className="block text-xs text-zinc-500">{AREA_LABELS[area].help}</span>
                                    </span>
                                </label>
                            ))}
                        </fieldset>
                        <div className="space-y-1.5">
                            <label htmlFor="comprehensive-page-cap-input" className="block text-sm font-medium text-zinc-700">
                                Page cap
                            </label>
                            <input
                                id="comprehensive-page-cap-input"
                                type="number"
                                min={1}
                                max={MAX_PAGE_CAP}
                                value={pageCapInput}
                                onChange={(event) => setPageCapInput(event.target.value)}
                                placeholder={String(DEFAULT_PAGE_CAP)}
                                className="w-32 rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                            />
                            <p className="text-xs text-zinc-500">
                                Pages come from the crawl and page inspection. Any beyond the cap are named in the report as not covered.
                                On any host that isn&apos;t a local development host, tests run one at a time.
                            </p>
                            {pageCapProblem ? <p className="text-xs text-rose-600">{pageCapProblem}</p> : null}
                        </div>
                    </div>
                )}
            </div>
        </CollapsibleSection>
    );
}
