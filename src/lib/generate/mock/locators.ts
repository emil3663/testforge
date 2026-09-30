import { escapeForDoubleQuotedSelector, escapeForSingleQuotedString, quoteSelector } from "./format";
import type {
    ActionableElementDetail,
    ContentProfile,
    DragDropTargetDetail,
    InteractionCategory,
    LinkDetail,
    TestAuditMode,
} from "./types";

const FAST_LINK_INTERACTION_LIMIT = 3;

export function normalizeRoutePath(path: string) {
    const normalized = path.trim() || "/";
    return normalized === "/" ? "/" : normalized.replace(/\/$/, "");
}

export function resolveLinkAuditPath(baseUrl: string) {
    const pathname = new URL(baseUrl).pathname || "/";
    return normalizeRoutePath(pathname);
}

export function resolveLinkAuditPaths(
    contentProfile: ContentProfile | null,
    baseUrl: string
) {
    const profilePaths = [...new Set(
        (contentProfile?.pages ?? [])
            .map((page) => normalizeRoutePath(page.path))
            .filter(Boolean)
    )];

    return profilePaths.length > 0 ? profilePaths : [resolveLinkAuditPath(baseUrl)];
}

export function findMatchingProfilePage(contentProfile: ContentProfile | null, path: string) {
    const normalizedPath = normalizeRoutePath(path);

    return contentProfile?.pages.find(
        (page) => normalizeRoutePath(page.path) === normalizedPath
    ) ?? contentProfile?.pages.find((page) => {
        try {
            return normalizeRoutePath(new URL(page.url).pathname) === normalizedPath;
        } catch {
            return false;
        }
    }) ?? null;
}

export function getActionableElementDisplayName(element: ActionableElementDetail) {
    return (
        element.text ||
        element.locator.name ||
        element.locator.label ||
        element.locator.placeholder ||
        element.locator.id ||
        (element.url ? `Untitled ${element.elementType} to ${element.url}` : `Untitled ${element.elementType}`)
    );
}

export function buildLocatorExpression(element: ActionableElementDetail) {
    if (element.locator.id) {
        return `page.locator(${quoteSelector(`[id="${escapeForDoubleQuotedSelector(element.locator.id)}"]`)}).first()`;
    }

    if (element.locator.role && element.locator.name) {
        return `page.getByRole('${escapeForSingleQuotedString(element.locator.role)}', { name: '${escapeForSingleQuotedString(element.locator.name)}', exact: true }).first()`;
    }

    if (element.locator.label) {
        return `page.getByLabel('${escapeForSingleQuotedString(element.locator.label)}', { exact: true }).first()`;
    }

    if (element.locator.placeholder) {
        return `page.getByPlaceholder('${escapeForSingleQuotedString(element.locator.placeholder)}', { exact: true }).first()`;
    }

    if (element.text) {
        return `page.getByText('${escapeForSingleQuotedString(element.text)}', { exact: true }).first()`;
    }

    if (element.elementType === "form") {
        return "page.locator('form').first()";
    }

    if (element.elementType === "select") {
        return "page.locator('select').first()";
    }

    if (element.elementType === "textarea") {
        return "page.locator('textarea').first()";
    }

    if (element.elementType === "button") {
        return "page.locator('button, input[type=\"button\"], input[type=\"submit\"], [role=\"button\"]').first()";
    }

    if (element.elementType === "input") {
        const inputType = element.locator.inputType || "text";
        return `page.locator(${quoteSelector(`input[type="${escapeForDoubleQuotedSelector(inputType)}"]`)}).first()`;
    }

    return "page.locator('a[href]').first()";
}

// TFP-061: a drag-drop target is rarely a form control with a role/label/
// placeholder the way ActionableElementDetail's locators are - it's
// commonly an untagged container (test-assist's canvas is a plain <main
// class="canvas-wrap">). id, then aria-label, then a class-attribute
// selector, then a bare tag selector, in that order of specificity.
export function getDragDropTargetDisplayName(target: DragDropTargetDetail) {
    return target.text || target.ariaLabel || target.id || `${target.tagName}${target.className ? `.${target.className}` : ""}`;
}

export function buildDragDropLocatorExpression(target: DragDropTargetDetail) {
    if (target.id) {
        return `page.locator(${quoteSelector(`[id="${escapeForDoubleQuotedSelector(target.id)}"]`)}).first()`;
    }

    if (target.ariaLabel) {
        return `page.getByLabel('${escapeForSingleQuotedString(target.ariaLabel)}', { exact: true }).first()`;
    }

    if (target.className) {
        return `page.locator(${quoteSelector(`${target.tagName}[class~="${escapeForDoubleQuotedSelector(target.className)}"]`)}).first()`;
    }

    return `page.locator(${quoteSelector(target.tagName)}).first()`;
}

// TFP-067 (Phase 17 Group 2): the exact title text a generated test for
// this element gets, unescaped. Playwright's JSON reporter reports the
// runtime (decoded) test title, not the JS-source-escaped form, so
// coverage matching against ExecutionRecord.title must use this raw
// builder - callers embedding it into generated source apply
// escapeForSingleQuotedString to the whole result, which is equivalent to
// the old per-field escaping since every literal separator here is
// quote/backslash-free.
export function buildActionableElementTitle(element: ActionableElementDetail) {
    const elementName = getActionableElementDisplayName(element);
    const containerSuffix = element.containerLabel ? ` [${element.containerLabel}]` : "";
    return `${buildInteractionPrefix(element.category)}: ${elementName}${containerSuffix} [${element.elementType}]`;
}

// Same rationale as buildActionableElementTitle, for buildAccessibilityElementTests' title shape.
export function buildAccessibilityElementTitle(element: ActionableElementDetail) {
    return `accessible name and role: ${getActionableElementDisplayName(element)} [${element.elementType}]`;
}

export function buildInteractionPrefix(category: InteractionCategory) {
    if (category === "navigation") {
        return "navigation element check";
    }

    if (category === "api") {
        return "api element check";
    }

    if (category === "form") {
        return "form element check";
    }

    return "action element check";
}

export function normalizeResponseHint(value: string) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .split(/\s+/)
        .map((part) => part.trim())
        .filter(Boolean)
        .filter((part) => part.length >= 3)
        .filter(
            (part) => ![
                "the",
                "and",
                "for",
                "with",
                "from",
                "that",
                "this",
                "button",
                "input",
                "form",
                "link",
                "action",
                "check",
                "element",
                "click",
                "request",
                "response",
                "status",
                "code",
                "api",
            ].includes(part)
        );
}

export function buildResponseHints(element: ActionableElementDetail) {
    const hints = new Set<string>();

    for (const value of [
        element.text,
        element.containerLabel,
        element.locator.name,
        element.locator.label,
        element.locator.id,
    ]) {
        for (const part of normalizeResponseHint(value)) {
            hints.add(part);
        }
    }

    if (element.url) {
        try {
            const parsedUrl = new URL(element.url);
            for (const part of normalizeResponseHint(parsedUrl.pathname)) {
                hints.add(part);
            }
        } catch {
            // Ignore malformed introspection URLs and fall back to text-based hints.
        }
    }

    return [...hints].slice(0, 8);
}

export function buildLinkLocatorExpression(link: LinkDetail) {
    if (link.text) {
        return `page.getByRole('link', { name: '${escapeForSingleQuotedString(link.text)}', exact: true }).first()`;
    }

    if (link.rawHref) {
        return `page.locator(${quoteSelector(`a[href="${escapeForDoubleQuotedSelector(link.rawHref)}"]:visible, a[href="${escapeForDoubleQuotedSelector(link.rawHref)}"]:has(:visible)`)}).first()`;
    }

    return `page.locator(${quoteSelector(`a[href="${escapeForDoubleQuotedSelector(link.url)}"]:visible, a[href="${escapeForDoubleQuotedSelector(link.url)}"]:has(:visible)`)}).first()`;
}

export function buildLinkTitle(link: LinkDetail) {
    const label = escapeForSingleQuotedString(link.text || `Untitled link to ${link.url}`);
    const containerSuffix = link.containerLabel
        ? ` [${escapeForSingleQuotedString(link.containerLabel)}]`
        : "";
    return `${label}${containerSuffix}`;
}

function scoreLinkInteractionPriority(link: LinkDetail) {
    let score = 0;

    if (link.category !== "api") {
        score += 4;
    }

    if (link.linkType === "internal") {
        score += 3;
    }

    if (link.targetBehavior === "same-window") {
        score += 2;
    }

    if (link.linkType === "anchor") {
        score += 1;
    }

    if (link.requiresAuth) {
        score -= 1;
    }

    return score;
}

export function selectBrowserInteractionLinks(
    links: LinkDetail[],
    auditMode: TestAuditMode
) {
    if (auditMode === "deep") {
        return links;
    }

    return links
        .map((link, index) => ({ link, index }))
        .sort((left, right) => {
            const priorityDelta = scoreLinkInteractionPriority(right.link) - scoreLinkInteractionPriority(left.link);
            return priorityDelta !== 0 ? priorityDelta : left.index - right.index;
        })
        .slice(0, FAST_LINK_INTERACTION_LIMIT)
        .map(({ link }) => link);
}
