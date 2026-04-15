import { NextRequest, NextResponse } from "next/server";
import { chromium } from "@playwright/test";

const DEFAULT_BASE_URL = "http://localhost:3000";
const MAX_CRAWL_PAGES = 100;
const MAX_DISCOVERED_LINKS_PER_PAGE = 200;
const SKIPPED_EXTENSIONS = /\.(?:pdf|doc|docx|xls|xlsx|csv|zip|ppt|pptx|jpg|jpeg|png|gif|svg|webp|ico|css|js|json|xml|txt|mp3|mp4|avi|mov|woff|woff2|ttf|eot)(?:[?#].*)?$/i;

interface CrawledPage {
    path: string;
    url: string;
    title: string;
    discoveredFrom: string | null;
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
    return `${pathname}${url.search}`;
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

export async function POST(req: NextRequest) {
    const { baseUrl } = await req.json();
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

    if (!normalizedBaseUrl.ok) {
        return NextResponse.json({ error: normalizedBaseUrl.message }, { status: 400 });
    }

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const startUrl = new URL(normalizedBaseUrl.value);
    const queue: Array<{ url: string; discoveredFrom: string | null }> = [{
        url: startUrl.toString(),
        discoveredFrom: null,
    }];
    const queued = new Set<string>([startUrl.toString()]);
    const visited = new Set<string>();
    const visitedPaths = new Set<string>();
    const pages: CrawledPage[] = [];
    const warnings: string[] = [];

    try {
        while (queue.length > 0 && pages.length < MAX_CRAWL_PAGES) {
            const nextItem = queue.shift();

            if (!nextItem) {
                break;
            }

            const targetUrl = nextItem.url;
            if (visited.has(targetUrl)) {
                continue;
            }

            visited.add(targetUrl);

            try {
                await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
                await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => { });

                const pageData = await page.evaluate(({ origin, limit }) => {
                    const links = Array.from(document.querySelectorAll("a[href]"))
                        .map((anchor) => {
                            const rawHref = anchor.getAttribute("href");
                            if (!rawHref) {
                                return null;
                            }

                            try {
                                const resolved = new URL(rawHref, window.location.href);
                                resolved.hash = "";
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

                const currentUrl = new URL(pageData.currentUrl);
                currentUrl.hash = "";
                const path = normalizePath(currentUrl);

                if (!visitedPaths.has(path)) {
                    visitedPaths.add(path);
                    pages.push({
                        path,
                        url: currentUrl.toString(),
                        title: pageData.title,
                        discoveredFrom: nextItem.discoveredFrom,
                    });
                }

                for (const discoveredUrl of pageData.links) {
                    try {
                        const candidateUrl = new URL(discoveredUrl);
                        candidateUrl.hash = "";

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
            } catch (error) {
                warnings.push(
                    `Could not crawl ${targetUrl}: ${error instanceof Error ? error.message : "Unknown error"}`
                );
            }
        }

        const sortedPages = [...pages].sort((left, right) => left.path.localeCompare(right.path));

        return NextResponse.json({
            crawledAt: new Date().toISOString(),
            baseUrl: normalizedBaseUrl.value,
            pageCount: sortedPages.length,
            pages: sortedPages,
            warnings,
        });
    } finally {
        await page.close().catch(() => { });
        await browser.close().catch(() => { });
    }
}
