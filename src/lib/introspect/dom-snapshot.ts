import type { ActionableElementDetail, ActionableElementType, InteractionCategory, LinkDetail, PageSnapshot } from "./types";

export interface DomSnapshotArgs {
    requestedPath: string;
    maxActionableItems: number;
    maxLinkDetails: number;
    maxEmbeddedLinkDetails: number;
    maxDragDropTargets: number;
}

// Passed to page.evaluate by reference: Playwright serializes this function's
// own source and runs it inside the browser's isolated JS context, with no
// access to this module's scope. Every helper it uses must stay nested in its
// body (only real browser globals and the destructured args are available at
// runtime), so this function cannot be split further without breaking that.
export function captureDomSnapshot({ requestedPath, maxActionableItems, maxLinkDetails, maxEmbeddedLinkDetails, maxDragDropTargets }: DomSnapshotArgs): Omit<PageSnapshot, "storageUsage"> {
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

            if (inputType === "submit" || inputType === "button" || inputType === "reset" || inputType === "image") {
                return "button";
            }

            // TFP-163: the role ARIA in HTML gives each input type, so a labelled search field is found by role.
            // A text-like field with a list attribute is a combobox; types with no role there keep textbox.
            if (inputType === "search") {
                return element.hasAttribute("list") ? "combobox" : "searchbox";
            }

            if (inputType === "number") {
                return "spinbutton";
            }

            if (inputType === "range") {
                return "slider";
            }

            if (["text", "email", "tel", "url"].includes(inputType) && element.hasAttribute("list")) {
                return "combobox";
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

    // TFP-165 (Decision 1, as isRouteFragment in routes.ts - this runs in the page, so it
    // can't import it): a # link whose fragment starts with / or !/ is a page of a
    // hash-routed app, not an in-page anchor.
    const isRouteHref = (href: string) => href.startsWith("#/") || href.startsWith("#!/");

    const inferLinkType = (href: string, element: Element) => {
        const loweredHref = href.toLowerCase();
        const downloadAttribute = cleanText(element.getAttribute("download") ?? "");

        if (loweredHref.startsWith("mailto:")) {
            return "mailto" as const;
        }

        if (isRouteHref(loweredHref)) {
            return "internal" as const;
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

    const getAriaAttribute = (element: Element, name: string) => {
        const value = element.getAttribute(name);
        return value === null ? null : cleanText(value);
    };

    // Names that make a button a one-shot action rather than a member of a
    // mutually-exclusive selection/toggle group - Undo/Redo/Clear share a
    // container and a role with each other (and, via findContainerLabel's
    // own sibling-walk, sometimes with an unrelated toggle group too), but
    // are three independent actions, not a set where exactly one is ever
    // "current." Excluding recognizable action verbs is what keeps a group
    // like that from being merged into a real toggle group such as
    // test-assist's seven .tool-btn elements (TA-252).
    const ONE_SHOT_ACTION_WORDS = [
        "undo", "redo", "clear", "save", "cancel", "close", "delete", "remove",
        "add", "export", "import", "confirm", "submit", "reset", "apply",
        "discard", "done", "ok",
    ];

    const isLikelyOneShotAction = (text: string) => {
        const normalized = text.toLowerCase();
        return ONE_SHOT_ACTION_WORDS.some((word) => new RegExp(`\\b${word}\\b`).test(normalized));
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

    // TFP-160: a form's identity without its text - its action and method as
    // written, which of the page's forms with those it is, and its fields.
    const recordForm = (form: HTMLFormElement) => {
        const action = form.getAttribute("action") ?? "";
        const method = (form.getAttribute("method") ?? "").toLowerCase();
        const occurrence = Array.from(document.querySelectorAll("form"))
            .slice(0, Array.from(document.querySelectorAll("form")).indexOf(form))
            .filter((other) => (other.getAttribute("action") ?? "") === action && (other.getAttribute("method") ?? "").toLowerCase() === method)
            .length;
        const fields = Array.from(form.querySelectorAll("input:not([type='hidden']), select, textarea, button"))
            .map((field) => ({
                tag: field.tagName.toLowerCase(),
                type: (field.getAttribute("type") ?? "").toLowerCase(),
                name: field.getAttribute("name") ?? "",
                id: field.getAttribute("id") ?? "",
            }));
        return { action, method, occurrence, fields };
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

    // TFP-163: every button-kind element in document order, for a button's position on the page.
    const buttonNodes = Array.from(document.querySelectorAll("button, input[type='button'], input[type='submit'], input[type='reset'], [role='button']"));
    const dedupedActionableElements = Array.from(
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
            const url = rawHref && (!rawHref.startsWith("#") || isRouteHref(rawHref)) && !rawHref.startsWith("javascript:") && !rawHref.startsWith("mailto:") && !rawHref.startsWith("tel:")
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

            // TFP-163: a button is kept even with no text, label or id (an icon-only button: Toolshop's
            // show-password toggle, R10), so it gets a name check; it is found by its position.
            if (!url && !text && !label && !placeholder && !id && elementType !== "form" && elementType !== "button") {
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
                isVisible: isVisibleElement(node),
                ariaPressed: getAriaAttribute(node, "aria-pressed"),
                ariaSelected: getAriaAttribute(node, "aria-selected"),
                ariaChecked: getAriaAttribute(node, "aria-checked"),
                ariaExpanded: getAriaAttribute(node, "aria-expanded"),
                groupId: null as string | null,
                locator: {
                    role: getRole(node, elementType, inputType),
                    name,
                    label,
                    placeholder,
                    id,
                    inputType,
                },
                ...(node instanceof HTMLFormElement ? { form: recordForm(node) } : {}),
                // TFP-163: which of the page's buttons this is, in document order, and which of the earlier
                // buttons with the same text it follows (0 for the first), so each same-text button tests itself.
                ...(elementType === "button" && buttonNodes.includes(node)
                    ? { position: buttonNodes.indexOf(node), occurrence: buttonNodes.slice(0, buttonNodes.indexOf(node)).filter((other) => getElementText(other) === text).length }
                    : {}),
            };
        })
        .filter(
            (element): element is ActionableElementDetail => Boolean(element)
        )
        .filter(
            // TFP-163: buttons aren't merged - two same-text buttons under one heading are two records, kept
            // apart by position, as TFP-145 kept links apart (both were merged into the first before).
            (element, index, allElements) =>
                element.position !== undefined ||
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
        );

    // TFP-055: detect toggle/selection groups heuristically, reusing the
    // same signal findContainerLabel already computes rather than a new
    // discovery mechanism - elements sharing a container and a role of
    // button/radio, per the ticket's own scope. Role alone over-groups:
    // test-assist's strokeColor/strokeSize/fillOpacity inputs all resolve
    // to role "textbox" (getRole()'s fallback for any non-checkbox/radio
    // input) and briefly matched before this was restricted to button/
    // radio specifically. Container alone also over-groups the other way -
    // findContainerLabel's own sibling-walk gives test-assist's
    // Undo/Redo/Clear the same containerLabel, "Tools", as its seven real
    // .tool-btn elements, since both sit under the same ancestor's nearest
    // heading - so one-shot action verbs are excluded too, and a group
    // needs 3+ members before it counts. A starter heuristic, expected to
    // be wrong in more places than these two caught, not a claim of
    // general correctness.
    const groupCandidates = new Map<string, ActionableElementDetail[]>();
    for (const element of dedupedActionableElements) {
        const isGroupableRole = element.locator.role === "button" || element.locator.role === "radio";
        if (!element.containerLabel || !isGroupableRole || isLikelyOneShotAction(element.text)) {
            continue;
        }

        const key = `${element.containerLabel}::${element.locator.role}::${element.elementType}`;
        const members = groupCandidates.get(key) ?? [];
        members.push(element);
        groupCandidates.set(key, members);
    }

    let groupSequence = 0;
    for (const members of groupCandidates.values()) {
        if (members.length < 3) {
            continue;
        }

        groupSequence += 1;
        const groupId = `group-${groupSequence}`;
        for (const member of members) {
            member.groupId = groupId;
        }
    }

    const actionableElements = dedupedActionableElements.slice(0, maxActionableItems);

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
                const isInertScheme = rawHref.startsWith("javascript:") || rawHref.startsWith("tel:");
                const linkType = isInertScheme
                    ? "inert" as const
                    : rawHref
                        ? inferLinkType(rawHref, anchor)
                        : "internal" as const;
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

    // TFP-061: [draggable]/[ondragover]/[ondrop] catches the rare
    // inline-attribute case cheaply, but most real drop targets (including
    // test-assist's canvas) attach dragover/drop via addEventListener,
    // which no attribute selector can see. The extra candidate selectors
    // below (semantic class/id hints, plus `main`) are only a shortlist to
    // probe, not the detection itself - actual confirmation is the
    // dispatched 'dragover' event below, which mirrors how the browser
    // itself decides an element accepts drops. Dispatching only
    // 'dragover' (never 'drop') keeps this read-only: a well-behaved
    // dragover handler is a visual hint only (see test-assist's own,
    // which just toggles an outline), not a state mutation.
    const dragDropCandidates = Array.from(document.querySelectorAll(
        '[draggable], [ondragover], [ondrop], main, [class*="canvas" i], [class*="drop" i], [class*="upload" i], [id*="canvas" i], [id*="drop" i], [id*="upload" i]'
    )).slice(0, 25);

    // bubbles: false is deliberate and differs from a real drag
    // interaction (which does bubble): a bubbling probe dispatched on any
    // descendant of a real drop target also reaches the target's own
    // listener and reports defaultPrevented, falsely flagging every
    // descendant as its own drop target. Disabling bubbling for the probe
    // isolates exactly which element has a directly-attached listener,
    // without changing how the generated test itself later dispatches a
    // real (bubbling) drop.
    const probeAcceptsDrop = (element: Element) => {
        try {
            const event = typeof DragEvent !== "undefined"
                ? new DragEvent("dragover", { bubbles: false, cancelable: true })
                : new Event("dragover", { bubbles: false, cancelable: true });
            element.dispatchEvent(event);
            return event.defaultPrevented;
        } catch {
            return false;
        }
    };

    const dragDropTargets = dragDropCandidates
        .map((element) => {
            const draggableAttribute = element.getAttribute("draggable");
            const isDraggableSource = draggableAttribute !== null && draggableAttribute !== "false";
            const isDropTarget =
                element.hasAttribute("ondragover") ||
                element.hasAttribute("ondrop") ||
                probeAcceptsDrop(element);

            if (!isDraggableSource && !isDropTarget) {
                return null;
            }

            const classAttribute = typeof element.className === "string" ? element.className : "";

            return {
                text: buildEmbeddedText(element),
                containerLabel: findContainerLabel(element),
                isVisible: isVisibleElement(element),
                isDraggableSource,
                isDropTarget,
                tagName: element.tagName.toLowerCase(),
                id: element.id || "",
                className: cleanText(classAttribute).split(" ").find(Boolean) ?? "",
                ariaLabel: cleanText(element.getAttribute("aria-label") ?? ""),
            };
        })
        .filter((target): target is NonNullable<typeof target> => target !== null)
        .slice(0, maxDragDropTargets);

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
        dragDropTargets,
        visibleTextSnippets,
    };
}
