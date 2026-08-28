import { InfoCard } from "@/app/_components/InfoCard";
import { MetricCard } from "@/app/_components/MetricCard";
import { PerformanceTable } from "@/app/_components/PerformanceTable";
import { ReportPanel } from "@/app/_components/ReportPanel";
import { formatMilliseconds } from "@/lib/report/text";
import type { RunReport } from "@/lib/report/types";

interface PerformanceTabProps {
    report: RunReport;
}

export function PerformanceTab({ report }: PerformanceTabProps) {
    return (
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
    );
}
