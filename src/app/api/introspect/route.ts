import { NextRequest, NextResponse } from "next/server";
import { chromium } from "@playwright/test";

const DEFAULT_BASE_URL = "http://localhost:3000";
const MAX_PATHS = 5;
const MAX_TEXT_ITEMS = 8;
const MAX_ACTIONABLE_ITEMS = 40;

type InteractionCategory = "navigation" | "api" | "form" | "action";
type ActionableElementType = "link" | "button" | "input" | "select" | "textarea" | "form";

interface LocatorHint {
    role: string | null;
    name: string;
    label: string;
    placeholder: string;
    id: string;
    inputType: string;
}

interface ActionableElementDetail {
    text: string;
    url: string | null;
    category: InteractionCategory;
    elementType: ActionableElementType;
    containerLabel: string;
    expectedStatus: number | null;
    locator: LocatorHint;
}

interface LinkDetail {
    text: string;
    url: string;
    category: "navigation" | "api";
    containerLabel: string;
    expectedStatus: number | null;
}

interface PageSnapshot {
    path: string;
    url: string;
    title: string;
    metaDescription: string;
    headings: string[];
    buttons: string[];
    links: string[];
    actionableElements: ActionableElementDetail[];
    linkDetails: LinkDetail[];
    visibleTextSnippets: string[];
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

function getDefaultInspectionPath(baseUrl: string) {
    try {
        const pathname = new URL(baseUrl).pathname || "/";
        return pathname === "/" ? "/" : pathname.replace(/\/$/, "");
    } catch {
        return "/";
    }
}

function normalizePaths(baseUrl: string, input: unknown) {
    if (!Array.isArray(input)) {
        return [getDefaultInspectionPath(baseUrl)];
    }

    const uniquePaths = [...new Set(
        input
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim())
            .filter(Boolean)
            .map((item) => (item.startsWith("/") ? item : `/${item}`))
    )].slice(0, MAX_PATHS);

    return uniquePaths.length > 0 ? uniquePaths : [getDefaultInspectionPath(baseUrl)];
}

function cleanTextList(values: unknown[]) {
    return [...new Set(
        values
            .map((value) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : ""))
            .filter(Boolean)
    )].slice(0, MAX_TEXT_ITEMS);
}

export async function POST(req: NextRequest) {
    const { baseUrl, paths } = await req.json();
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

    if (!normalizedBaseUrl.ok) {
        return NextResponse.json({ error: normalizedBaseUrl.message }, { status: 400 });
    }

    const normalizedPaths = normalizePaths(normalizedBaseUrl.value, paths);
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
        const pages: PageSnapshot[] = [];
        const warnings: string[] = [];

        for (const path of normalizedPaths) {
            const targetUrl = new URL(path, normalizedBaseUrl.value).toString();

            try {
                await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
                await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => { });

                const snapshot = await page.evaluate((requestedPath) => {
                    const cleanItems = (items: string[], limit = 8) => [...new Set(
                        items
                            .map((item) => item.replace(/\s+/g, " ").trim())
                            .filter(Boolean)
                    )].slice(0, limit);
                    const cleanText = (value: string) => value.replace(/\s+/g, " ").trim();
                    const labelSelectors = "h1, h2, h3, h4, h5, h6, p, legend, label, [role='heading']";

                    const findContainerLabel = (element: Element) => {
                        const ancestors: Element[] = [];
                        let current = element.parentElement;
                        let depth = 0;

                        while (current && depth < 6) {
                            ancestors.push(current);
                            current = current.parentElement;
                            depth += 1;
                        }

                        for (const ancestor of ancestors) {
                            const directLabel = Array.from(ancestor.children)
                                .filter((child) => child.matches(labelSelectors))
                                .map((child) => cleanText(child.textContent ?? ""))
                                .find(Boolean);

                            if (ancestor.querySelectorAll("a[href]").length > 1 && directLabel) {
                                return directLabel;
                            }

                            let sibling = ancestor.previousElementSibling;
                            while (sibling) {
                                if (sibling.matches(labelSelectors)) {
                                    const siblingLabel = cleanText(sibling.textContent ?? "");
                                    if (siblingLabel) {
                                        return siblingLabel;
                                    }
                                }
                                sibling = sibling.previousElementSibling;
                            }
                        }

                        let sibling = element.previousElementSibling;
                        while (sibling) {
                            if (sibling.matches(labelSelectors)) {
                                const siblingLabel = cleanText(sibling.textContent ?? "");
                                if (siblingLabel) {
                                    return siblingLabel;
                                }
                            }
                            sibling = sibling.previousElementSibling;
                        }

                        return "";
                    };

                    const getElementText = (element: Element) => {
                        if (element instanceof HTMLInputElement) {
                            return cleanText(
                                element.value ||
                                element.getAttribute("aria-label") ||
                                element.getAttribute("placeholder") ||
                                element.name ||
                                ""
                            );
                        }

                        return cleanText(element.textContent ?? "");
                    };

                    const getAssociatedLabel = (element: Element) => {
                        const htmlElement = element as HTMLElement;

                        if (htmlElement.closest("label")) {
                            return cleanText(htmlElement.closest("label")?.textContent ?? "");
                        }

                        const elementId = htmlElement.getAttribute("id");
                        if (!elementId) {
                            return "";
                        }

                        return cleanText(
                            document.querySelector(`label[for="${CSS.escape(elementId)}"]`)?.textContent ?? ""
                        );
                    };

                    const getRole = (element: Element, elementType: ActionableElementType, inputType: string) => {
                        if (elementType === "link") {
                            return "link";
                        }

                        if (elementType === "button") {
                            return "button";
                        }

                        if (elementType === "select") {
                            return "combobox";
                        }

                        if (elementType === "textarea") {
                            return "textbox";
                        }

                        if (elementType === "input") {
                            if (inputType === "checkbox") {
                                return "checkbox";
                            }

                            if (inputType === "radio") {
                                return "radio";
                            }

                            if (inputType === "submit" || inputType === "button" || inputType === "reset") {
                                return "button";
                            }

                            return "textbox";
                        }

                        if (elementType === "form") {
                            return "form";
                        }

                        return null;
                    };

                    const inferCategory = (
                        element: Element,
                        elementType: ActionableElementType,
                        descriptor: string,
                        url: string,
                        containerLabel: string
                    ): InteractionCategory => {
                        const context = `${descriptor} ${url} ${containerLabel}`.toLowerCase();

                        if (element.closest("nav, [role='navigation']")) {
                            return "navigation";
                        }

                        if (/(api call|api response|status code|send an api call|created|no content|bad request|unauthorized|forbidden|invalid url)/.test(context)) {
                            return "api";
                        }

                        if (elementType === "form" || elementType === "input" || elementType === "select" || elementType === "textarea") {
                            return "form";
                        }

                        if (elementType === "button") {
                            if (/(submit|search|filter|save|login|sign in|register|send|apply)/.test(context)) {
                                return "form";
                            }

                            if (/(next|previous|back|home|menu|open|continue|visit)/.test(context)) {
                                return "navigation";
                            }

                            return "action";
                        }

                        return elementType === "link" ? "navigation" : "action";
                    };

                    const inferExpectedStatus = (
                        text: string,
                        url: string,
                        containerLabel: string,
                        category: InteractionCategory
                    ) => {
                        if (category !== "api") {
                            return null;
                        }

                        const context = `${text} ${url} ${containerLabel}`.toLowerCase();

                        if (/\bcreated\b/.test(context)) {
                            return 201;
                        }

                        if (/\bno content\b/.test(context)) {
                            return 204;
                        }

                        if (/\bmoved\b/.test(context)) {
                            return 301;
                        }

                        if (/\bbad request\b/.test(context)) {
                            return 400;
                        }

                        if (/\bunauthorized\b/.test(context)) {
                            return 401;
                        }

                        if (/\bforbidden\b/.test(context)) {
                            return 403;
                        }

                        if (/\binvalid url\b|\bnot found\b/.test(context)) {
                            return 404;
                        }

                        return null;
                    };

                    const title = document.title.replace(/\s+/g, " ").trim();
                    const metaDescription = document
                        .querySelector('meta[name="description"]')
                        ?.getAttribute("content")
                        ?.replace(/\s+/g, " ")
                        .trim() ?? "";

                    const headings = cleanItems(
                        Array.from(document.querySelectorAll("h1, h2, h3"))
                            .map((node) => node.textContent ?? "")
                    );

                    const buttons = cleanItems(
                        Array.from(document.querySelectorAll("button, input[type='button'], input[type='submit'], [role='button']"))
                            .map((node) => (node.textContent || (node as HTMLInputElement).value || ""))
                    );

                    const links = cleanItems(
                        Array.from(document.querySelectorAll("a[href]"))
                            .map((node) => node.textContent ?? "")
                    );

                    const actionableElements = Array.from(
                        document.querySelectorAll("a[href], button, input:not([type='hidden']), select, textarea, form, [role='button']")
                    )
                        .map((node) => {
                            const tagName = node.tagName.toLowerCase();
                            const inputType = node instanceof HTMLInputElement
                                ? (node.getAttribute("type") ?? "text").toLowerCase()
                                : "";
                            const elementType: ActionableElementType =
                                tagName === "a"
                                    ? "link"
                                    : tagName === "button" || inputType === "button" || inputType === "submit" || inputType === "reset" || node.getAttribute("role") === "button"
                                        ? "button"
                                        : tagName === "select"
                                            ? "select"
                                            : tagName === "textarea"
                                                ? "textarea"
                                                : tagName === "form"
                                                    ? "form"
                                                    : "input";
                            const rawHref = node.getAttribute("href");
                            const url = rawHref && !rawHref.startsWith("#") && !rawHref.startsWith("javascript:") && !rawHref.startsWith("mailto:") && !rawHref.startsWith("tel:")
                                ? new URL(rawHref, window.location.href).toString()
                                : null;
                            const text = getElementText(node);
                            const label = getAssociatedLabel(node);
                            const placeholder = cleanText(node.getAttribute("placeholder") ?? "");
                            const name = cleanText(
                                node.getAttribute("aria-label") ??
                                label ??
                                text ??
                                placeholder ??
                                node.getAttribute("name") ??
                                ""
                            );
                            const id = cleanText(node.getAttribute("id") ?? "");

                            if (!url && !text && !label && !placeholder && !id && elementType !== "form") {
                                return null;
                            }

                            const containerLabel = findContainerLabel(node);
                            const descriptor = [
                                text,
                                name,
                                id,
                                node.getAttribute("name") ?? "",
                                node.getAttribute("data-testid") ?? "",
                                node.getAttribute("aria-controls") ?? "",
                            ]
                                .filter(Boolean)
                                .join(" ");
                            const category = inferCategory(node, elementType, descriptor, url ?? "", containerLabel);

                            return {
                                text,
                                url,
                                category,
                                elementType,
                                containerLabel,
                                expectedStatus: inferExpectedStatus(text, url ?? "", containerLabel, category),
                                locator: {
                                    role: getRole(node, elementType, inputType),
                                    name,
                                    label,
                                    placeholder,
                                    id,
                                    inputType,
                                },
                            };
                        })
                        .filter(
                            (element): element is ActionableElementDetail => Boolean(element)
                        )
                        .filter(
                            (element, index, allElements) =>
                                allElements.findIndex(
                                    (candidate) =>
                                        candidate.url === element.url &&
                                        candidate.text === element.text &&
                                        candidate.category === element.category &&
                                        candidate.elementType === element.elementType &&
                                        candidate.containerLabel === element.containerLabel &&
                                        candidate.locator.id === element.locator.id &&
                                        candidate.locator.name === element.locator.name
                                ) === index
                        )
                        .slice(0, MAX_ACTIONABLE_ITEMS);

                    const linkDetails = actionableElements
                        .filter(
                            (element): element is ActionableElementDetail & {
                                elementType: "link";
                                url: string;
                                category: "navigation" | "api";
                            } => element.elementType === "link" && Boolean(element.url) && (element.category === "navigation" || element.category === "api")
                        )
                        .map((element) => ({
                            text: element.text,
                            url: element.url,
                            category: element.category,
                            containerLabel: element.containerLabel,
                            expectedStatus: element.expectedStatus,
                        }))
                        .slice(0, 25);

                    const visibleTextSnippets = cleanItems(
                        Array.from(document.querySelectorAll("main p, article p, section p, li"))
                            .map((node) => node.textContent ?? ""),
                        10
                    );

                    return {
                        path: requestedPath,
                        url: window.location.href,
                        title,
                        metaDescription,
                        headings,
                        buttons,
                        links,
                        actionableElements,
                        linkDetails,
                        visibleTextSnippets,
                    };
                }, path);

                pages.push({
                    ...snapshot,
                    headings: cleanTextList(snapshot.headings),
                    buttons: cleanTextList(snapshot.buttons),
                    links: cleanTextList(snapshot.links),
                    actionableElements: snapshot.actionableElements,
                    linkDetails: snapshot.linkDetails,
                    visibleTextSnippets: cleanTextList(snapshot.visibleTextSnippets),
                });
            } catch (error) {
                warnings.push(
                    `Could not inspect ${targetUrl}: ${error instanceof Error ? error.message : "Unknown error"}`
                );
            }
        }

        return NextResponse.json({
            scannedAt: new Date().toISOString(),
            baseUrl: normalizedBaseUrl.value,
            pages,
            warnings,
        });
    } finally {
        await page.close().catch(() => { });
        await browser.close().catch(() => { });
    }
}