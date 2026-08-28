import { CoverageTable } from "@/app/_components/CoverageTable";
import { ReportPanel } from "@/app/_components/ReportPanel";
import type { RunReport } from "@/lib/report/types";

interface CoverageTabProps {
    report: RunReport;
}

export function CoverageTab({ report }: CoverageTabProps) {
    return (
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
    );
}
