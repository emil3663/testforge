import { NextRequest, NextResponse } from "next/server";
import { chromium } from "@playwright/test";

const DEFAULT_BASE_URL = "http://localhost:3000";
const MAX_PATHS = 5;
const MAX_TEXT_ITEMS = 8;
const MAX_ACTIONABLE_ITEMS = 40;
const MAX_LINK_DETAILS = 100;
const MAX_EMBEDDED_LINK_DETAILS = 150;

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
    rawHref: string;
    category: "navigation" | "api";
    linkType: "internal" | "external" | "anchor" | "mailto" | "download";
    containerLabel: string;
    expectedStatus: number | null;
    isVisible: boolean;
    target: string;
    targetBehavior: "same-window" | "new-tab" | "new-window";
    titleAttribute: string;
    downloadName: string;
    requiresAuth: boolean;
    isSecure: boolean;
}

interface EmbeddedLinkDetail {
    text: string;
    url: string;
    rawValue: string;
    tagName: string;
    attributeName: string;
    kind: "iframe" | "frame" | "image" | "script" | "stylesheet" | "media" | "document" | "form" | "button" | "data" | "interactive";
    source: "dom" | "heuristic";
    containerLabel: string;
    sameOrigin: boolean;
    isVisible: boolean;
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
    embeddedLinkDetails: EmbeddedLinkDetail[];
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

                const snapshot = await page.evaluate(({ requestedPath, maxActionableItems, maxLinkDetails, maxEmbeddedLinkDetails }) => {
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

                        if (/(api call|api response|status code|send an api call|created|no\s*content|nocontent|moved|bad[-\s]?request|unauthorized|forbidden|invalid[-\s]?url|not[-\s]?found)/.test(context)) {
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

                        if (/\bno\s*content\b|\bnocontent\b/.test(context)) {
                            return 204;
                        }

                        if (/\bmoved\b/.test(context)) {
                            return 301;
                        }

                        if (/\bbad[-\s]?request\b/.test(context)) {
                            return 400;
                        }

                        if (/\bunauthorized\b/.test(context)) {
                            return 401;
                        }

                        if (/\bforbidden\b/.test(context)) {
                            return 403;
                        }

                        if (/\binvalid[-\s]?url\b|\bnot[-\s]?found\b/.test(context)) {
                            return 404;
                        }

                        return null;
                    };

                    const inferLinkType = (href: string, element: Element) => {
                        const loweredHref = href.toLowerCase();
                        const downloadAttribute = cleanText(element.getAttribute("download") ?? "");

                        if (loweredHref.startsWith("mailto:")) {
                            return "mailto" as const;
                        }

                        if (loweredHref.startsWith("#")) {
                            return "anchor" as const;
                        }

                        if (
                            downloadAttribute ||
                            /\.(pdf|doc|docx|xls|xlsx|csv|zip|ppt|pptx)([?#].*)?$/i.test(loweredHref)
                        ) {
                            return "download" as const;
                        }

                        try {
                            const resolved = new URL(href, window.location.href);
                            return resolved.origin === window.location.origin ? "internal" as const : "external" as const;
                        } catch {
                            return "external" as const;
                        }
                    };

                    const inferTargetBehavior = (target: string) => {
                        if (target === "_blank") {
                            return "new-tab" as const;
                        }

                        if (target && target !== "_self") {
                            return "new-window" as const;
                        }

                        return "same-window" as const;
                    };

                    const inferProtectedLink = (text: string, href: string, containerLabel: string) => {
                        const context = `${text} ${href} ${containerLabel}`.toLowerCase();
                        return /(login|sign in|signin|account|profile|admin|dashboard|checkout|orders|billing|settings|my\s)/.test(context);
                    };

                    const safeResolveUrl = (href: string) => {
                        try {
                            return new URL(href, window.location.href).toString();
                        } catch {
                            return null;
                        }
                    };

                    const inferEmbeddedKind = (tagName: string, attributeName: string) => {
                        if (tagName === "iframe") {
                            return "iframe" as const;
                        }

                        if (tagName === "frame") {
                            return "frame" as const;
                        }

                        if (tagName === "img") {
                            return "image" as const;
                        }

                        if (tagName === "script") {
                            return "script" as const;
                        }

                        if (tagName === "link") {
                            return "stylesheet" as const;
                        }

                        if (["video", "audio", "source"].includes(tagName)) {
                            return "media" as const;
                        }

                        if (tagName === "object" || tagName === "embed") {
                            return "document" as const;
                        }

                        if (tagName === "form") {
                            return "form" as const;
                        }

                        if (tagName === "button" || attributeName === "formaction") {
                            return "button" as const;
                        }

                        if (["data-href", "data-url", "routerlink", "ng-href", "xlink:href"].includes(attributeName)) {
                            return "data" as const;
                        }

                        return "interactive" as const;
                    };

                    const isVisibleElement = (element: Element) => {
                        const htmlElement = element as HTMLElement;
                        if (!(htmlElement instanceof HTMLElement)) {
                            return false;
                        }

                        const styles = window.getComputedStyle(htmlElement);
                        const rect = htmlElement.getBoundingClientRect();
                        return styles.display !== "none" && styles.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
                    };

                    const isSameOriginUrl = (url: string) => {
                        try {
                            return new URL(url).origin === window.location.origin;
                        } catch {
                            return false;
                        }
                    };

                    const buildEmbeddedText = (element: Element) => {
                        return cleanText(
                            getElementText(element) ||
                            element.getAttribute("aria-label") ||
                            element.getAttribute("alt") ||
                            element.getAttribute("title") ||
                            element.getAttribute("name") ||
                            element.getAttribute("id") ||
                            ""
                        );
                    };

                    const getEmbeddedAttribute = (element: Element) => {
                        for (const attributeName of [
                            "src",
                            "data",
                            "href",
                            "action",
                            "formaction",
                            "poster",
                            "data-href",
                            "data-url",
                            "routerlink",
                            "ng-href",
                            "xlink:href",
                        ]) {
                            const value = element.getAttribute(attributeName);
                            if (value && cleanText(value)) {
                                return {
                                    attributeName,
                                    rawValue: cleanText(value),
                                };
                            }
                        }

                        return null;
                    };

                    const resolveEmbeddedUrl = (attributeName: string, rawValue: string) => {
                        if (/^(mailto:|tel:|javascript:|data:)/i.test(rawValue)) {
                            return rawValue;
                        }

                        if (attributeName === "xlink:href" && rawValue.startsWith("#")) {
                            return null;
                        }

                        return safeResolveUrl(rawValue);
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
                        Array.from(document.querySelectorAll("a"))
                            .map((node) => node.textContent ?? "")
                    );

                    const actionableElements = Array.from(
                        document.querySelectorAll("a, button, input:not([type='hidden']), select, textarea, form, [role='button']")
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
                                ? safeResolveUrl(rawHref)
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
                        .slice(0, maxActionableItems);

                    const linkDetails = Array.from(document.querySelectorAll("a"))
                        .flatMap((anchor) => {
                            const rawHref = cleanText(anchor.getAttribute("href") ?? "");
                            const anchorId = cleanText(anchor.getAttribute("id") ?? "");
                            const ariaLabel = cleanText(anchor.getAttribute("aria-label") ?? "");

                            if ((rawHref.startsWith("javascript:") || rawHref.startsWith("tel:")) && !anchorId) {
                                return [];
                            }

                            try {
                                const text = cleanText(anchor.textContent ?? "");
                                const containerLabel = findContainerLabel(anchor);
                                const descriptor = [
                                    text,
                                    ariaLabel,
                                    anchorId,
                                    cleanText(anchor.getAttribute("name") ?? ""),
                                    cleanText(anchor.getAttribute("data-testid") ?? ""),
                                ].filter(Boolean).join(" ");
                                const fallbackHref = rawHref || (anchorId ? `/${anchorId}` : "");
                                const resolvedUrl = fallbackHref.toLowerCase().startsWith("mailto:")
                                    ? fallbackHref
                                    : fallbackHref
                                        ? safeResolveUrl(fallbackHref)
                                        : null;

                                if (!rawHref && !text && !ariaLabel && !anchorId) {
                                    return [];
                                }

                                if (!resolvedUrl && !text && !anchorId) {
                                    return [];
                                }

                                const category = inferCategory(anchor, "link", descriptor, resolvedUrl ?? "", containerLabel);
                                const linkType = rawHref ? inferLinkType(rawHref, anchor) : "internal" as const;
                                const target = cleanText(anchor.getAttribute("target") ?? "");
                                const titleAttribute = cleanText(anchor.getAttribute("title") ?? "");
                                const downloadName = cleanText(anchor.getAttribute("download") ?? "");

                                if (!rawHref && category !== "api") {
                                    return [];
                                }

                                return [{
                                    text,
                                    url: resolvedUrl ?? window.location.href,
                                    rawHref: rawHref || fallbackHref,
                                    category: category === "api" ? "api" : "navigation",
                                    linkType,
                                    containerLabel,
                                    expectedStatus: inferExpectedStatus(text, resolvedUrl ?? fallbackHref, containerLabel, category),
                                    isVisible: isVisibleElement(anchor),
                                    target,
                                    targetBehavior: inferTargetBehavior(target),
                                    titleAttribute,
                                    downloadName,
                                    requiresAuth: inferProtectedLink(text, rawHref, containerLabel),
                                    isSecure: Boolean(resolvedUrl?.startsWith("https://")) || rawHref.toLowerCase().startsWith("mailto:"),
                                }];
                            } catch {
                                return [];
                            }
                        })
                        .filter((link): link is LinkDetail => Boolean(link))
                        .filter(
                            (link, index, allLinks) =>
                                allLinks.findIndex(
                                    (candidate) =>
                                        candidate.rawHref === link.rawHref &&
                                        candidate.url === link.url &&
                                        candidate.text === link.text &&
                                        candidate.containerLabel === link.containerLabel
                                ) === index
                        )
                        .slice(0, maxLinkDetails);

                    const embeddedLinkDetails = [
                        ...Array.from(document.querySelectorAll("iframe[src], frame[src], embed[src], object[data], img[src], script[src], source[src], video[src], audio[src], link[href], form[action], button[formaction], input[formaction], [data-href], [data-url], [routerlink], [ng-href], [xlink\\:href], [poster]"))
                            .flatMap((element) => {
                                const tagName = element.tagName.toLowerCase();
                                const attribute = getEmbeddedAttribute(element);

                                if (!attribute) {
                                    return [];
                                }

                                const resolvedUrl = resolveEmbeddedUrl(attribute.attributeName, attribute.rawValue);

                                if (!resolvedUrl) {
                                    return [];
                                }

                                return [{
                                    text: buildEmbeddedText(element),
                                    url: resolvedUrl,
                                    rawValue: attribute.rawValue,
                                    tagName,
                                    attributeName: attribute.attributeName,
                                    kind: inferEmbeddedKind(tagName, attribute.attributeName),
                                    source: "dom" as const,
                                    containerLabel: findContainerLabel(element),
                                    sameOrigin: isSameOriginUrl(resolvedUrl),
                                    isVisible: isVisibleElement(element),
                                }];
                            }),
                        ...Array.from(document.querySelectorAll("[onclick]"))
                            .flatMap((element) => {
                                const onclickValue = cleanText(element.getAttribute("onclick") ?? "");

                                if (!onclickValue) {
                                    return [];
                                }

                                const urlMatches = [...onclickValue.matchAll(/(?:location(?:\.href)?\s*=|window\.open\(|document\.location\s*=)\s*['\"]([^'\"]+)['\"]/gi)];
                                if (urlMatches.length === 0) {
                                    return [];
                                }

                                return urlMatches.flatMap((match) => {
                                    const rawValue = cleanText(match[1] ?? "");
                                    const resolvedUrl = resolveEmbeddedUrl("onclick", rawValue);

                                    if (!resolvedUrl) {
                                        return [];
                                    }

                                    return [{
                                        text: buildEmbeddedText(element),
                                        url: resolvedUrl,
                                        rawValue,
                                        tagName: element.tagName.toLowerCase(),
                                        attributeName: "onclick",
                                        kind: "interactive" as const,
                                        source: "heuristic" as const,
                                        containerLabel: findContainerLabel(element),
                                        sameOrigin: isSameOriginUrl(resolvedUrl),
                                        isVisible: isVisibleElement(element),
                                    }];
                                });
                            }),
                    ]
                        .filter(
                            (embeddedLink, index, allEmbeddedLinks) =>
                                allEmbeddedLinks.findIndex(
                                    (candidate) =>
                                        candidate.url === embeddedLink.url &&
                                        candidate.rawValue === embeddedLink.rawValue &&
                                        candidate.tagName === embeddedLink.tagName &&
                                        candidate.attributeName === embeddedLink.attributeName &&
                                        candidate.source === embeddedLink.source &&
                                        candidate.containerLabel === embeddedLink.containerLabel
                                ) === index
                        )
                        .slice(0, maxEmbeddedLinkDetails);

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
                        embeddedLinkDetails,
                        visibleTextSnippets,
                    };
                }, {
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