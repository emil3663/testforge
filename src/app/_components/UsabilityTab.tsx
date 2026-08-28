import { ArtifactLinkList } from "@/app/_components/ArtifactLinkList";
import { MetricCard } from "@/app/_components/MetricCard";
import { ReportPanel } from "@/app/_components/ReportPanel";
import { SessionEvidenceList } from "@/app/_components/SessionEvidenceList";
import type { RunReport } from "@/lib/report/types";

interface UsabilityTabProps {
    report: RunReport;
}

export function UsabilityTab({ report }: UsabilityTabProps) {
    return (
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
                                                        key={finding.id}
                                                        className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm leading-6 text-zinc-600"
                                                    >
                                                        <div className="font-medium text-zinc-900">{finding.summary}</div>
                                                        {finding.testTitle ? (
                                                            <div className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                                                Failed test: {finding.testTitle} · {finding.browser}
                                                            </div>
                                                        ) : null}
                                                        {finding.defectTitle ? (
                                                            <div className="mt-2 text-sm text-zinc-600">
                                                                Linked bug: <span className="font-medium text-zinc-900">{finding.defectId}</span> · {finding.defectTitle}
                                                            </div>
                                                        ) : null}
                                                        {finding.artifacts.length > 0 ? (
                                                            <div className="mt-3">
                                                                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                                                    Related artifacts
                                                                </div>
                                                                <ArtifactLinkList items={finding.artifacts} className="mt-2" compact />
                                                            </div>
                                                        ) : null}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                        <ReportPanel
                                            eyebrow="Session Evidence"
                                            title="Captured artifacts"
                                            description={report.usability.videoClips}
                                        >
                                            <SessionEvidenceList items={report.usability.sessionEvidence} />
                                        </ReportPanel>
                                    </div>
                                </ReportPanel>
    );
}
