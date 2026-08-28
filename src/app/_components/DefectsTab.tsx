import { DefectList } from "@/app/_components/DefectList";
import { HeatmapGrid } from "@/app/_components/HeatmapGrid";
import { ReportPanel } from "@/app/_components/ReportPanel";
import type { RunReport } from "@/lib/report/types";

interface DefectsTabProps {
    report: RunReport;
}

export function DefectsTab({ report }: DefectsTabProps) {
    return (
                                <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                                    <ReportPanel
                                        eyebrow="Defect Report"
                                        title="Issue tracking and hot spots"
                                        description="Generated bug-style records and a heatmap of areas accumulating failures."
                                    >
                                        <HeatmapGrid cells={report.defects.heatmap} />
                                    </ReportPanel>
                                    <ReportPanel
                                        eyebrow="Open Issues"
                                        title="Defect backlog"
                                        description="Failure records formatted as issue-tracking items with severity and reproduction steps."
                                    >
                                        <DefectList defects={report.defects.issues} />
                                    </ReportPanel>
                                </div>
    );
}
