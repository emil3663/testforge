import { MetricCard } from "@/app/_components/MetricCard";
import { ReportPanel } from "@/app/_components/ReportPanel";
import { recommendationClasses } from "@/app/_lib/format";
import type { RunReport, SeoPageGroup, SeoRecommendation } from "@/lib/report/types";

interface SeoTabProps {
    report: RunReport;
    seoPageGroups: SeoPageGroup[];
    selectedSeoPageGroup: SeoPageGroup | null;
    setSelectedSeoPageKey: (key: string) => void;
    selectedSeoRecommendations: SeoRecommendation[];
}

export function SeoTab({
    report,
    seoPageGroups,
    selectedSeoPageGroup,
    setSelectedSeoPageKey,
    selectedSeoRecommendations,
}: SeoTabProps) {
    return (
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
    );
}
