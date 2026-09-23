import { NextRequest, NextResponse } from "next/server";
import { chromium, type Browser, type Page } from "@playwright/test";
import { randomUUID } from "crypto";

// Only correct when TestForge is testing itself. For any other target
// (Plane on :80, test-assist on :4321, ...) the caller must supply baseUrl.
const DEFAULT_BASE_URL = "http://localhost:3000";
const MAX_CRAWL_PAGES = 100;
const MAX_DISCOVERED_LINKS_PER_PAGE = 200;
const SKIPPED_EXTENSIONS = /\.(?:pdf|doc|docx|xls|xlsx|csv|zip|ppt|pptx|jpg|jpeg|png|gif|svg|webp|ico|css|js|json|xml|txt|mp3|mp4|avi|mov|woff|woff2|ttf|eot)(?:[?#].*)?$/i;

type CrawlLifecycleStatus = "running" | "completed" | "failed" | "cancelled";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CrawledPage {
    path: string;
    url: string;
    title: string;
    discoveredFrom: string | null;
}

interface CrawlResultPayload {
    crawledAt: string;
    baseUrl: string;
    pageCount: number;
    pages: CrawledPage[];
    warnings?: string[];
}

interface CrawlProgressSnapshot {
    maxPages: number;
    visitedUrls: number;
    queuedUrls: number;
    discoveredPages: number;
    warningsCount: number;
    currentUrl: string | null;
    currentPath: string | null;
    currentTitle: string | null;
    lastCompletedPath: string | null;
    lastCompletedTitle: string | null;
}

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
    browser: Browser | null;
    page: Page | null;
}

const globalCrawlJobs = globalThis as typeof globalThis & {
    __testforgeCrawlJobs?: Map<string, CrawlJob>;
};
const crawlJobs = globalCrawlJobs.__testforgeCrawlJobs ?? (globalCrawlJobs.__testforgeCrawlJobs = new Map());

function createEmptyCrawlProgress(): CrawlProgressSnapshot {
    return {
        maxPages: MAX_CRAWL_PAGES,
        visitedUrls: 0,
        queuedUrls: 0,
        discoveredPages: 0,
        warningsCount: 0,
        currentUrl: null,
        currentPath: null,
        currentTitle: null,
        lastCompletedPath: null,
        lastCompletedTitle: null,
    };
}

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

function normalizeBaseUrl(baseUrl: unknown) {
    if (typeof baseUrl !== "string" || !baseUrl.trim()) {
        return { ok: true as const, value: DEFAULT_BASE_URL };
    }

    const trimmed = baseUrl.trim();
    const withProtocol = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(trimmed)
        ? trimmed
        : `http://${trimmed}`;

    try {
        const normalized = new URL(withProtocol);
        normalized.hash = "";
        return {
            ok: true as const,
            value: normalized.toString().replace(/\/$/, ""),
        };
    } catch {
        return {
            ok: false as const,
            message: "baseUrl must be a valid URL",
        };
    }
}

function normalizePath(url: URL) {
    const pathname = url.pathname === "/" ? "/" : url.pathname.replace(/\/$/, "");
    return pathname;
}

function normalizeCrawlUrl(url: URL) {
    const normalized = new URL(url.toString());
    normalized.hash = "";
    normalized.search = "";

    if (normalized.pathname !== "/") {
        normalized.pathname = normalized.pathname.replace(/\/$/, "");
    }

    return normalized;
}

function shouldQueueUrl(candidateUrl: URL, origin: string) {
    if (candidateUrl.origin !== origin) {
        return false;
    }

    if (["mailto:", "tel:", "javascript:", "data:"].includes(candidateUrl.protocol)) {
        return false;
    }

    if (SKIPPED_EXTENSIONS.test(candidateUrl.pathname)) {
        return false;
    }

    return true;
}

async function runCrawlJob(job: CrawlJob) {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    job.browser = browser;
    job.page = page;
    const startUrl = new URL(job.baseUrl);
    const normalizedStartUrl = normalizeCrawlUrl(startUrl);
    const queue: Array<{ url: string; discoveredFrom: string | null }> = [{
        url: normalizedStartUrl.toString(),
        discoveredFrom: null,
    }];
    const queued = new Set<string>([normalizedStartUrl.toString()]);
    const visited = new Set<string>();
    const visitedPaths = new Set<string>();
    const pages: CrawledPage[] = [];
    const warnings: string[] = [];

    job.progress.queuedUrls = queue.length;

    try {
        while (queue.length > 0 && pages.length < MAX_CRAWL_PAGES) {
            if (job.cancellationRequested) {
                break;
            }

            const nextItem = queue.shift();

            if (!nextItem) {
                break;
            }

            const targetUrl = nextItem.url;
            const targetPath = normalizePath(new URL(targetUrl));
            if (visited.has(targetUrl)) {
                job.progress.queuedUrls = queue.length;
                continue;
            }

            visited.add(targetUrl);
            job.progress.visitedUrls = visited.size;
            job.progress.queuedUrls = queue.length;
            job.progress.currentUrl = targetUrl;
            job.progress.currentPath = targetPath;
            job.progress.currentTitle = null;

            try {
                await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
                await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => { });

                if (job.cancellationRequested) {
                    break;
                }

                const pageData = await page.evaluate(({ origin, limit }) => {
                    const links = Array.from(document.querySelectorAll("a[href]"))
                        .map((anchor) => {
                            const rawHref = anchor.getAttribute("href");
                            if (!rawHref) {
                                return null;
                            }

                            try {
                                const resolved = new URL(rawHref, window.location.href);
                                return resolved.toString();
                            } catch {
                                return null;
                            }
                        })
                        .filter((link): link is string => Boolean(link))
                        .filter((link, index, allLinks) => allLinks.indexOf(link) === index)
                        .filter((link) => link.startsWith(origin))
                        .slice(0, limit);

                    return {
                        title: document.title.replace(/\s+/g, " ").trim(),
                        currentUrl: window.location.href,
                        links,
                    };
                }, {
                    origin: startUrl.origin,
                    limit: MAX_DISCOVERED_LINKS_PER_PAGE,
                });

                const currentUrl = normalizeCrawlUrl(new URL(pageData.currentUrl));
                const path = normalizePath(currentUrl);
                job.progress.currentTitle = pageData.title || null;

                if (!visitedPaths.has(path)) {
                    visitedPaths.add(path);
                    pages.push({
                        path,
                        url: currentUrl.toString(),
                        title: pageData.title,
                        discoveredFrom: nextItem.discoveredFrom,
                    });
                    job.progress.discoveredPages = pages.length;
                }

                for (const discoveredUrl of pageData.links) {
                    try {
                        const candidateUrl = normalizeCrawlUrl(new URL(discoveredUrl));

                        if (!shouldQueueUrl(candidateUrl, startUrl.origin)) {
                            continue;
                        }

                        const normalizedCandidate = candidateUrl.toString();
                        if (queued.has(normalizedCandidate) || visited.has(normalizedCandidate)) {
                            continue;
                        }

                        queued.add(normalizedCandidate);
                        queue.push({
                            url: normalizedCandidate,
                            discoveredFrom: path,
                        });
                    } catch {
                        continue;
                    }
                }

                job.progress.lastCompletedPath = path;
                job.progress.lastCompletedTitle = pageData.title || path;
                job.progress.queuedUrls = queue.length;
            } catch (error) {
                if (job.cancellationRequested) {
                    break;
                }

                warnings.push(
                    `Could not crawl ${targetUrl}: ${error instanceof Error ? error.message : "Unknown error"}`
                );
                job.progress.warningsCount = warnings.length;
                job.progress.queuedUrls = queue.length;
            }
        }

        const sortedPages = [...pages].sort((left, right) => left.path.localeCompare(right.path));

        job.finishedAt = Date.now();
        job.progress.currentUrl = null;
        job.progress.currentPath = null;
        job.progress.currentTitle = null;
        job.progress.queuedUrls = 0;
        job.progress.discoveredPages = sortedPages.length;
        job.result = {
            crawledAt: new Date(job.finishedAt).toISOString(),
            baseUrl: job.baseUrl,
            pageCount: sortedPages.length,
            pages: sortedPages,
            warnings,
        };
        job.status = job.cancellationRequested ? "cancelled" : "completed";
    } catch (error) {
        job.finishedAt = Date.now();
        job.progress.currentUrl = null;
        job.progress.currentPath = null;
        job.progress.currentTitle = null;
        job.progress.queuedUrls = 0;
        if (job.cancellationRequested) {
            const sortedPages = [...pages].sort((left, right) => left.path.localeCompare(right.path));
            job.result = {
                crawledAt: new Date(job.finishedAt).toISOString(),
                baseUrl: job.baseUrl,
                pageCount: sortedPages.length,
                pages: sortedPages,
                warnings,
            };
            job.status = "cancelled";
        } else {
            job.error = error instanceof Error ? error.message : "Site crawl failed";
            job.status = "failed";
        }
    } finally {
        job.page = null;
        job.browser = null;
        await page.close().catch(() => { });
        await browser.close().catch(() => { });
    }
}

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
        return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
    }

    const { baseUrl } = body;

    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

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
        browser: null,
        page: null,
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
        await Promise.all([
            job.page?.close().catch(() => { }),
            job.browser?.close().catch(() => { }),
        ]);
    }

    return NextResponse.json(buildCrawlSnapshot(job));
}
