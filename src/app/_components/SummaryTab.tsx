import { MetricCard } from "@/app/_components/MetricCard";
import { ReportPanel } from "@/app/_components/ReportPanel";
import { TrendBars } from "@/app/_components/TrendBars";
import { formatMilliseconds } from "@/lib/report/text";
import type { RunReport } from "@/lib/report/types";

interface SummaryTabProps {
    report: RunReport;
}

export function SummaryTab({ report }: SummaryTabProps) {
    return (
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
    );
}
