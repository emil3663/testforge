import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { crawlSite, createEmptyCrawlProgress, normalizeCrawlBaseUrl, type CrawlProgressSnapshot, type CrawlResultPayload } from "@/lib/pipeline/crawl";

type CrawlLifecycleStatus = "running" | "completed" | "failed" | "cancelled";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CrawlStatusPayload {
    crawlId: string;
    crawlStatus: CrawlLifecycleStatus;
    duration: number;
    progress: CrawlProgressSnapshot;
    result?: CrawlResultPayload;
    error?: string;
}

interface CrawlJob {
    id: string;
    status: CrawlLifecycleStatus;
    cancellationRequested: boolean;
    createdAt: number;
    finishedAt: number | null;
    baseUrl: string;
    progress: CrawlProgressSnapshot;
    result: CrawlResultPayload | null;
    error: string | null;
    /** Closes the crawl's page and browser while it runs (Phase 47 TFP-263: the crawl itself is in src/lib/pipeline). */
    closeBrowser: (() => Promise<void>) | null;
}

const globalCrawlJobs = globalThis as typeof globalThis & {
    __testforgeCrawlJobs?: Map<string, CrawlJob>;
};
const crawlJobs = globalCrawlJobs.__testforgeCrawlJobs ?? (globalCrawlJobs.__testforgeCrawlJobs = new Map());

function buildCrawlSnapshot(job: CrawlJob): CrawlStatusPayload {
    return {
        crawlId: job.id,
        crawlStatus: job.status,
        duration: (job.finishedAt ?? Date.now()) - job.createdAt,
        progress: job.progress,
        result: job.result ?? undefined,
        error: job.error ?? undefined,
    };
}

async function runCrawlJob(job: CrawlJob) {
    const outcome = await crawlSite(job.baseUrl, {
        progress: job.progress,
        isCancelled: () => job.cancellationRequested,
        onBrowser: (close) => { job.closeBrowser = close; },
    });
    job.finishedAt = outcome.finishedAt;
    if (outcome.status === "failed") {
        job.error = outcome.error;
    } else {
        job.result = outcome.result;
    }
    job.status = outcome.status;
}

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
        return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
    }

    const { baseUrl } = body;

    const normalizedBaseUrl = normalizeCrawlBaseUrl(baseUrl);

    if (!normalizedBaseUrl.ok) {
        return NextResponse.json({ error: normalizedBaseUrl.message }, { status: 400 });
    }

    const crawlId = randomUUID();
    const job: CrawlJob = {
        id: crawlId,
        status: "running",
        cancellationRequested: false,
        createdAt: Date.now(),
        finishedAt: null,
        baseUrl: normalizedBaseUrl.value,
        progress: createEmptyCrawlProgress(),
        result: null,
        error: null,
        closeBrowser: null,
    };

    crawlJobs.set(crawlId, job);
    void runCrawlJob(job);

    return NextResponse.json(buildCrawlSnapshot(job), { status: 202 });
}

export async function GET(req: NextRequest) {
    const crawlId = req.nextUrl.searchParams.get("crawlId");

    if (!crawlId) {
        return NextResponse.json({ error: "crawlId is required" }, { status: 400 });
    }

    const job = crawlJobs.get(crawlId);

    if (!job) {
        return NextResponse.json({ error: "Crawl not found" }, { status: 404 });
    }

    return NextResponse.json(buildCrawlSnapshot(job));
}

export async function DELETE(req: NextRequest) {
    const { crawlId } = await req.json().catch(() => ({ crawlId: null }));

    if (!crawlId || typeof crawlId !== "string") {
        return NextResponse.json({ error: "crawlId is required" }, { status: 400 });
    }

    const job = crawlJobs.get(crawlId);

    if (!job) {
        return NextResponse.json({ error: "Crawl not found" }, { status: 404 });
    }

    if (job.status === "running") {
        job.cancellationRequested = true;
        await job.closeBrowser?.();
    }

    return NextResponse.json(buildCrawlSnapshot(job));
}
