import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { resolve } from "path";
import { normalizeLoginConfig, RunLoginError } from "@/lib/run/auth";
import { startRunJob } from "@/lib/run/executor";
import type { TestAuditMode } from "@/lib/run/executor";
import { normalizeContentProfile } from "@/lib/generate/normalize";
import { buildRunSnapshot, runJobs } from "@/lib/run/jobs";
import type { RunStatusPayload } from "@/lib/run/jobs";
import { isValidRunId, loadRunRecord, markRunAccessed, runEvidenceDir } from "@/lib/run/persistence";
import { buildRunSelection } from "@/lib/run/selection";
import { normalizeGenerationRecord } from "@/lib/run/generation-record";
import { normalizeRunMode, RunModeError } from "@/lib/comprehensive/run-mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeSelectedPractices(input: unknown) {
    if (!Array.isArray(input)) {
        return [] as string[];
    }

    return input.filter((item): item is string => typeof item === "string");
}

function normalizeTestAuditMode(input: unknown): TestAuditMode {
    return input === "deep" ? "deep" : "fast";
}

export async function POST(req: NextRequest) {
    const { code, selectedPractices, auditMode, baseUrl, excludeTestTitles, includeTestTitles, description, contentProfile, enableInteractive, login, generation, runMode } = await req.json().catch(() => ({}));

    if (!code || typeof code !== "string") {
        return NextResponse.json({ error: "code is required" }, { status: 400 });
    }

    // Phase 35 (TFP-132): absent is a Standard run, exactly as before.
    let normalizedRunMode;
    try {
        normalizedRunMode = normalizeRunMode(runMode);
    } catch (error) {
        if (error instanceof RunModeError) return NextResponse.json({ error: error.message }, { status: 400 });
        throw error;
    }
    // Its pages, cap and worker rule are all worked out from the base URL.
    if (normalizedRunMode.kind === "comprehensive" && typeof baseUrl !== "string") {
        return NextResponse.json({ error: "baseUrl is required for a Comprehensive run" }, { status: 400 });
    }

    const normalizedPractices = normalizeSelectedPractices(selectedPractices);
    const normalizedAuditMode = normalizeTestAuditMode(auditMode);
    const normalizedExcludedTitles = Array.isArray(excludeTestTitles)
        ? excludeTestTitles.filter((title): title is string => typeof title === "string")
        : [];
    const normalizedIncludedTitles = Array.isArray(includeTestTitles)
        ? includeTestTitles.filter((title): title is string => typeof title === "string")
        : [];

    if (buildRunSelection(code, normalizedExcludedTitles, normalizedIncludedTitles).runnableTestCount === 0) {
        return NextResponse.json({ error: normalizedIncludedTitles.length > 0 ? "No selected tests are available to rerun." : "No remaining tests are available to continue." }, { status: 400 });
    }

    // TFP-092: a login the request asked for must be valid and must succeed.
    // Any failure is a named error and the run does not start - never a quiet
    // fall back to unauthenticated tests.
    let job;
    try {
        const loginConfig = normalizeLoginConfig(login, typeof baseUrl === "string" ? baseUrl : undefined);
        job = await startRunJob(
            code,
            normalizedPractices,
            normalizedAuditMode,
            typeof baseUrl === "string" ? baseUrl : undefined,
            normalizedExcludedTitles,
            normalizedIncludedTitles,
            typeof description === "string" ? description : "",
            normalizeContentProfile(contentProfile),
            enableInteractive === true,
            loginConfig,
            // Phase 34 (TFP-119): untrusted input, so only the known shape, capped.
            normalizeGenerationRecord(generation),
            normalizedRunMode
        );
    } catch (error) {
        if (error instanceof RunLoginError) {
            return NextResponse.json(
                { error: error.message, errorKind: error.kind },
                { status: error.kind === "config-invalid" ? 400 : 422 }
            );
        }

        throw error;
    }

    return NextResponse.json(job, { status: 202 });
}

export async function GET(req: NextRequest) {
    const runId = req.nextUrl.searchParams.get("runId");
    const artifactId = req.nextUrl.searchParams.get("artifactId");

    if (!runId) {
        return NextResponse.json({ error: "runId is required" }, { status: 400 });
    }

    if (!isValidRunId(runId)) {
        return NextResponse.json({ error: "runId must be a valid UUID" }, { status: 400 });
    }

    const job = runJobs.get(runId);

    if (artifactId) {
        const liveArtifact = job?.artifactFiles.get(artifactId) ?? null;
        let artifact = liveArtifact;

        if (!artifact) {
            const record = await loadRunRecord(runId);
            artifact = record?.artifactFiles[artifactId] ?? null;
        }

        if (!artifact) {
            return NextResponse.json({ error: "Artifact not found" }, { status: 404 });
        }

        const artifactPath = resolve(artifact.filePath);
        const allowedRoots = [
            ...(job ? [resolve(job.artifactDir)] : []),
            resolve(runEvidenceDir(runId)),
        ];

        if (!allowedRoots.some((root) => artifactPath.startsWith(root))) {
            return NextResponse.json({ error: "Artifact path is invalid" }, { status: 400 });
        }

        const fileBuffer = await readFile(artifactPath).catch(() => null);
        if (!fileBuffer) {
            return NextResponse.json({ error: "Artifact file is unavailable" }, { status: 404 });
        }

        return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
                "Content-Type": artifact.contentType,
                "Content-Disposition": `attachment; filename="${artifact.fileName}"`,
            },
        });
    }

    if (job) {
        if (job.result) {
            await markRunAccessed(runId).catch(() => { });
        }
        return NextResponse.json(buildRunSnapshot(job));
    }

    const record = await loadRunRecord(runId);

    if (!record) {
        return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    await markRunAccessed(runId).catch(() => { });

    const snapshot: RunStatusPayload = {
        runId: record.runId,
        runStatus: record.result.runStatus,
        duration: record.result.duration,
        progress: record.result.progress,
        cancellationRequested: false,
        result: record.result,
    };

    return NextResponse.json(snapshot);
}

export async function DELETE(req: NextRequest) {
    const { runId } = await req.json().catch(() => ({ runId: null }));

    if (!runId || typeof runId !== "string") {
        return NextResponse.json({ error: "runId is required" }, { status: 400 });
    }

    if (!isValidRunId(runId)) {
        return NextResponse.json({ error: "runId must be a valid UUID" }, { status: 400 });
    }

    const job = runJobs.get(runId);

    if (!job) {
        return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    if (job.status === "running" && job.process?.exitCode === null) {
        job.cancellationRequested = true;
        job.outputChunks.push("Cancellation requested by user.\n");
        job.process.kill("SIGTERM");
    }

    return NextResponse.json(buildRunSnapshot(job));
}
