import { chromium } from "@playwright/test";
import { captureDomSnapshot } from "./dom-snapshot";
import type { PageSnapshot } from "./types";

const MAX_TEXT_ITEMS = 8;
const MAX_ACTIONABLE_ITEMS = 40;
const MAX_LINK_DETAILS = 100;
const MAX_EMBEDDED_LINK_DETAILS = 150;

function cleanTextList(values: unknown[]) {
    return [...new Set(
        values
            .map((value) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : ""))
            .filter(Boolean)
    )].slice(0, MAX_TEXT_ITEMS);
}

export async function inspectPages(baseUrl: string, paths: string[]) {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
        const pages: PageSnapshot[] = [];
        const warnings: string[] = [];

        for (const path of paths) {
            const targetUrl = new URL(path, baseUrl).toString();

            try {
                await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
                await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => { });

                const snapshot = await page.evaluate(captureDomSnapshot, {
                    requestedPath: path,
                    maxActionableItems: MAX_ACTIONABLE_ITEMS,
                    maxLinkDetails: MAX_LINK_DETAILS,
                    maxEmbeddedLinkDetails: MAX_EMBEDDED_LINK_DETAILS,
                });

                pages.push({
                    ...snapshot,
                    headings: cleanTextList(snapshot.headings),
                    buttons: cleanTextList(snapshot.buttons),
                    links: cleanTextList(snapshot.links),
                    actionableElements: snapshot.actionableElements,
                    linkDetails: snapshot.linkDetails,
                    embeddedLinkDetails: snapshot.embeddedLinkDetails,
                    visibleTextSnippets: cleanTextList(snapshot.visibleTextSnippets),
                });
            } catch (error) {
                warnings.push(
                    `Could not inspect ${targetUrl}: ${error instanceof Error ? error.message : "Unknown error"}`
                );
            }
        }

        return { pages, warnings };
    } finally {
        await page.close().catch(() => { });
        await browser.close().catch(() => { });
    }
}
