import { basename, extname, resolve } from "path";
import { normalizeExecutionTitle } from "./text";
import type {
    DefectRecord,
    ExecutionArtifact,
    ExecutionRecord,
    JsonTestResult,
    ReportArtifactItem,
} from "./types";

export function inferArtifactType(fileName: string, contentType?: string): ExecutionArtifact["artifactType"] {
    const normalizedName = fileName.toLowerCase();
    const normalizedType = contentType?.toLowerCase() ?? "";

    if (normalizedName.endsWith(".zip") || normalizedType.includes("zip") || normalizedName.includes("trace")) {
        return "trace";
    }

    if (/(\.webm|\.mp4)$/i.test(normalizedName) || normalizedType.startsWith("video/")) {
        return "video";
    }

    if (/(\.png|\.jpg|\.jpeg|\.webp)$/i.test(normalizedName) || normalizedType.startsWith("image/")) {
        return "screenshot";
    }

    return "file";
}

export function inferArtifactContentType(fileName: string, contentType?: string) {
    if (contentType) {
        return contentType;
    }

    const extension = extname(fileName).toLowerCase();
    if (extension === ".zip") {
        return "application/zip";
    }

    if (extension === ".webm") {
        return "video/webm";
    }

    if (extension === ".mp4") {
        return "video/mp4";
    }

    if (extension === ".png") {
        return "image/png";
    }

    if (extension === ".jpg" || extension === ".jpeg") {
        return "image/jpeg";
    }

    if (extension === ".webp") {
        return "image/webp";
    }

    return "application/octet-stream";
}

export function buildArtifactLabel(artifactType: ExecutionArtifact["artifactType"], fileName: string) {
    if (artifactType === "trace") {
        return "Trace";
    }

    if (artifactType === "video") {
        return "Video";
    }

    if (artifactType === "screenshot") {
        return "Screenshot";
    }

    return basename(fileName);
}

export function createExecutionArtifacts(result: JsonTestResult | undefined, testId: string, browser: string) {
    const attachments = result?.attachments ?? [];

    return attachments
        .filter((attachment) => attachment.path)
        .map((attachment, index) => {
            const fileName = basename(attachment.path ?? `artifact-${index}`);
            const artifactType = inferArtifactType(fileName, attachment.contentType);
            return {
                artifactId: `${testId}-${browser}-${index}`.replace(/[^a-zA-Z0-9_-]+/g, "-"),
                filePath: resolve(attachment.path ?? fileName),
                fileName,
                label: buildArtifactLabel(artifactType, fileName),
                artifactType,
                contentType: inferArtifactContentType(fileName, attachment.contentType),
            } satisfies ExecutionArtifact;
        });
}

export function mapRecordArtifact(
    record: Pick<ExecutionRecord, "id" | "title" | "browser">,
    artifact: ExecutionArtifact,
    linkedDefect?: Pick<DefectRecord, "id" | "title">
): ReportArtifactItem {
    return {
        artifactId: artifact.artifactId,
        label: artifact.label,
        artifactType: artifact.artifactType,
        browser: record.browser,
        testId: record.id,
        testTitle: normalizeExecutionTitle(record.title),
        fileName: artifact.fileName,
        defectId: linkedDefect?.id,
        defectTitle: linkedDefect?.title,
    };
}

export function buildRecordRunKey(record: Pick<ExecutionRecord, "id" | "browser">) {
    return `${record.id}::${record.browser}`;
}
