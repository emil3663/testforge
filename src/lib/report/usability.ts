import { toTitleCase, simplifyExecutionTarget, classifyFailureReason, normalizeExecutionTitle } from "./text";
import { mapRecordArtifact, buildRecordRunKey } from "./artifacts";
import type { DefectRecord, ExecutionRecord, UsabilityFindingRecord } from "./types";

export function summarizeFinding(record: ExecutionRecord) {
    return `${toTitleCase(record.area)} issue: ${simplifyExecutionTarget(record.title)} needs attention because ${classifyFailureReason(record.rawMessage)}.`;
}

export function buildUsabilityReport(records: ExecutionRecord[], defects: DefectRecord[]) {
    const usabilityRecords = records.filter((record) => record.area === "Usability");
    const scopedRecords = usabilityRecords.length > 0 ? usabilityRecords : records;
    const defectByRunKey: Map<string, DefectRecord> = new Map(
        defects.map((defect) => [`${defect.testId}::${defect.browser}`, defect] as const)
    );
    const passedTasks = scopedRecords.filter(
        (record) => record.status === "Passed" || record.status === "Flaky"
    ).length;
    const findings = scopedRecords
        .filter((record) => record.status === "Failed")
        .map((record, index) => {
            const linkedDefect = defectByRunKey.get(buildRecordRunKey(record));
            return {
                id: `FINDING-${String(index + 1).padStart(3, "0")}`,
                summary: summarizeFinding(record),
                testId: record.id,
                testTitle: normalizeExecutionTitle(record.title),
                browser: record.browser,
                defectId: linkedDefect?.id,
                defectTitle: linkedDefect?.title,
                artifacts: record.artifacts.map((artifact) => mapRecordArtifact(record, artifact, linkedDefect)),
            } satisfies UsabilityFindingRecord;
        });
    const sessionEvidence = scopedRecords
        .flatMap((record) => {
            const linkedDefect = defectByRunKey.get(buildRecordRunKey(record));
            return record.artifacts.map((artifact) => mapRecordArtifact(record, artifact, linkedDefect));
        }
        )
        .filter((item, index, allItems) =>
            allItems.findIndex((candidate) => candidate.artifactId === item.artifactId) === index
        );

    return {
        successRate: scopedRecords.length === 0
            ? 100
            : Math.round((passedTasks / scopedRecords.length) * 100),
        findings: findings.length > 0
            ? findings
            : [{
                id: "FINDING-000",
                summary: "No major usability blockers surfaced in the current automated pass.",
                testId: "",
                testTitle: "",
                browser: "",
                defectId: undefined,
                defectTitle: undefined,
                artifacts: [],
            } satisfies UsabilityFindingRecord],
        videoClips: sessionEvidence.length > 0
            ? "Failed-run artifacts were captured for this run. Use the evidence list to inspect trace, video, or screenshot files."
            : "No failed-run artifacts were captured in this run. Trace, video, and screenshot evidence only appear when Playwright retains failure artifacts.",
        sessionEvidence,
        tasksCompleted: passedTasks,
        totalTasks: scopedRecords.length,
    };
}
