import { toTitleCase, simplifyExecutionTarget, classifyFailureReason, normalizeExecutionTitle } from "./text";
import { mapRecordArtifact } from "./artifacts";
import type { DefectRecord, DefectSeverity, ExecutionRecord } from "./types";

export function buildIssueTitle(record: ExecutionRecord) {
    const areaLabel = toTitleCase(record.area);
    const target = simplifyExecutionTarget(record.title);

    if (record.area === "SEO") {
        return `${areaLabel}: ${toTitleCase(target)} check failed`;
    }

    if (record.area === "Usability") {
        return `${areaLabel}: ${toTitleCase(target)} needs attention`;
    }

    return `${areaLabel}: ${toTitleCase(target)} failed`;
}

export function buildIssueDescription(record: ExecutionRecord) {
    return `${toTitleCase(record.area)} validation for ${simplifyExecutionTarget(record.title)} failed because ${classifyFailureReason(record.rawMessage)}.`;
}

export function severityFromMessage(message: string): DefectSeverity {
    const normalized = message.toLowerCase();

    if (
        /(browsertype\.launch|security|https|ssl|certificate|500|spawn|crash|fatal)/.test(
            normalized
        )
    ) {
        return "Critical";
    }

    if (/(timeout|locator|expect\(|not found|tobevisible|tohaveurl)/.test(normalized)) {
        return "Major";
    }

    return "Minor";
}

export function buildDefects(records: ExecutionRecord[]) {
    return records
        .filter((record) => record.status === "Failed")
        .map((record, index) => {
            const severity = severityFromMessage(record.rawMessage);
            const id = `BUG-${String(index + 1).padStart(3, "0")}`;
            const title = buildIssueTitle(record);
            return {
                id,
                testId: record.id,
                testTitle: normalizeExecutionTitle(record.title),
                title,
                summary: buildIssueDescription(record),
                description: record.rawMessage,
                reproductionSteps: record.reproductionSteps,
                severity,
                priority: severity,
                status: "Open" as const,
                area: record.area,
                browser: record.browser,
                artifacts: record.artifacts.map((artifact) =>
                    mapRecordArtifact(record, artifact, { id, title })
                ),
            } satisfies DefectRecord;
        });
}

export function buildDefectTrend(records: ExecutionRecord[]) {
    let runningFailures = 0;

    return records.map((record, index) => {
        if (record.status === "Failed") {
            runningFailures += 1;
        }

        return {
            label: `T${index + 1}`,
            count: runningFailures,
        };
    });
}

export function buildHeatmap(defects: DefectRecord[]) {
    const areaCounts = new Map<string, number>();

    for (const defect of defects) {
        areaCounts.set(defect.area, (areaCounts.get(defect.area) ?? 0) + 1);
    }

    return [...areaCounts.entries()].map(([area, count]) => ({ area, count }));
}
