import type {
    ActionableElementType,
    BestPracticeArea,
    ContentProfile,
    ContentRules,
    InteractionCategory,
    LinkCategory,
    LinkDetail,
    TestAuditMode,
} from "@/lib/generate/mock";
import { BEST_PRACTICE_OPTIONS } from "@/lib/generate/mock";

const DEFAULT_BASE_URL = "http://localhost:3000";

const DEFAULT_TEST_AUDIT_MODE: TestAuditMode = "fast";

export function normalizeBaseUrl(baseUrl: unknown) {
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

export function normalizeSelectedPractices(input: unknown) {
    if (!Array.isArray(input)) {
        return [] as BestPracticeArea[];
    }

    const validPractices = new Set<string>(BEST_PRACTICE_OPTIONS);
    const practices = input.filter(
        (item): item is BestPracticeArea =>
            typeof item === "string" && validPractices.has(item)
    );

    return [...new Set(practices)];
}

export function normalizeTestAuditMode(input: unknown): TestAuditMode {
    return input === "deep" ? "deep" : DEFAULT_TEST_AUDIT_MODE;
}

function normalizeStringList(input: unknown) {
    if (!Array.isArray(input)) {
        return [] as string[];
    }

    return [...new Set(
        input
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.replace(/\s+/g, " ").trim())
            .filter(Boolean)
    )];
}

function normalizePaths(input: unknown) {
    const paths = normalizeStringList(input).map((item) =>
        item.startsWith("/") ? item : `/${item}`
    );

    return paths.length > 0 ? paths : ["/"];
}

export function normalizeContentRules(input: unknown): ContentRules {
    if (!input || typeof input !== "object") {
        return {
            paths: ["/"],
            requiredHeadings: [],
            requiredText: [],
            forbiddenText: [],
        };
    }

    const rules = input as Record<string, unknown>;
    return {
        paths: normalizePaths(rules.paths),
        requiredHeadings: normalizeStringList(rules.requiredHeadings),
        requiredText: normalizeStringList(rules.requiredText),
        forbiddenText: normalizeStringList(rules.forbiddenText),
    };
}

export function normalizeContentProfile(input: unknown): ContentProfile | null {
    if (!input || typeof input !== "object") {
        return null;
    }

    const profile = input as Record<string, unknown>;
    if (!Array.isArray(profile.pages)) {
        return null;
    }

    const pages = profile.pages
        .filter((page): page is Record<string, unknown> => !!page && typeof page === "object")
        .map((page) => ({
            path: typeof page.path === "string" ? page.path : "/",
            url: typeof page.url === "string" ? page.url : "",
            title: typeof page.title === "string" ? page.title : "",
            metaDescription:
                typeof page.metaDescription === "string" ? page.metaDescription : "",
            headings: normalizeStringList(page.headings),
            buttons: normalizeStringList(page.buttons),
            links: normalizeStringList(page.links),
            actionableElements: Array.isArray(page.actionableElements)
                ? page.actionableElements
                    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
                    .map((item) => {
                        const category: InteractionCategory =
                            item.category === "api"
                                ? "api"
                                : item.category === "form"
                                    ? "form"
                                    : item.category === "action"
                                        ? "action"
                                        : "navigation";
                        const elementType: ActionableElementType =
                            item.elementType === "button" ||
                                item.elementType === "input" ||
                                item.elementType === "select" ||
                                item.elementType === "textarea" ||
                                item.elementType === "form"
                                ? item.elementType
                                : "link";

                        return {
                            text: typeof item.text === "string" ? item.text.replace(/\s+/g, " ").trim() : "",
                            url: typeof item.url === "string" ? item.url.trim() : null,
                            category,
                            elementType,
                            containerLabel:
                                typeof item.containerLabel === "string"
                                    ? item.containerLabel.replace(/\s+/g, " ").trim()
                                    : "",
                            expectedStatus:
                                typeof item.expectedStatus === "number" ? item.expectedStatus : null,
                            // TFP-053: default true (not false) when absent, matching
                            // linkDetails' own isVisible normalization just below -
                            // an older/malformed payload missing the field should not
                            // be silently read as "everything is hidden."
                            isVisible: "isVisible" in item ? Boolean(item.isVisible) : true,
                            locator: {
                                role:
                                    typeof item.locator === "object" &&
                                        item.locator &&
                                        typeof (item.locator as Record<string, unknown>).role === "string"
                                        ? ((item.locator as Record<string, unknown>).role as string).trim()
                                        : null,
                                name:
                                    typeof item.locator === "object" &&
                                        item.locator &&
                                        typeof (item.locator as Record<string, unknown>).name === "string"
                                        ? ((item.locator as Record<string, unknown>).name as string).replace(/\s+/g, " ").trim()
                                        : "",
                                label:
                                    typeof item.locator === "object" &&
                                        item.locator &&
                                        typeof (item.locator as Record<string, unknown>).label === "string"
                                        ? ((item.locator as Record<string, unknown>).label as string).replace(/\s+/g, " ").trim()
                                        : "",
                                placeholder:
                                    typeof item.locator === "object" &&
                                        item.locator &&
                                        typeof (item.locator as Record<string, unknown>).placeholder === "string"
                                        ? ((item.locator as Record<string, unknown>).placeholder as string).replace(/\s+/g, " ").trim()
                                        : "",
                                id:
                                    typeof item.locator === "object" &&
                                        item.locator &&
                                        typeof (item.locator as Record<string, unknown>).id === "string"
                                        ? ((item.locator as Record<string, unknown>).id as string).trim()
                                        : "",
                                inputType:
                                    typeof item.locator === "object" &&
                                        item.locator &&
                                        typeof (item.locator as Record<string, unknown>).inputType === "string"
                                        ? ((item.locator as Record<string, unknown>).inputType as string).trim()
                                        : "",
                            },
                        };
                    })
                    .filter((item) => Boolean(item.text || item.url || item.locator.name || item.locator.label || item.locator.placeholder || item.locator.id || item.elementType === "form"))
                : [],
            linkDetails: Array.isArray(page.linkDetails)
                ? page.linkDetails
                    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
                    .map((item) => {
                        const category: LinkCategory = item.category === "api" ? "api" : "navigation";
                        const linkType: LinkDetail["linkType"] =
                            item.linkType === "external"
                                ? "external"
                                : item.linkType === "anchor"
                                    ? "anchor"
                                    : item.linkType === "mailto"
                                        ? "mailto"
                                        : item.linkType === "download"
                                            ? "download"
                                            : item.linkType === "inert"
                                                ? "inert"
                                                : "internal";
                        const targetBehavior: LinkDetail["targetBehavior"] =
                            item.targetBehavior === "new-tab"
                                ? "new-tab"
                                : item.targetBehavior === "new-window"
                                    ? "new-window"
                                    : "same-window";

                        return {
                            text: typeof item.text === "string" ? item.text.replace(/\s+/g, " ").trim() : "",
                            url: typeof item.url === "string" ? item.url.trim() : "",
                            rawHref: typeof item.rawHref === "string" ? item.rawHref.trim() : "",
                            category,
                            linkType,
                            containerLabel:
                                typeof item.containerLabel === "string"
                                    ? item.containerLabel.replace(/\s+/g, " ").trim()
                                    : "",
                            expectedStatus:
                                typeof item.expectedStatus === "number" ? item.expectedStatus : null,
                            isVisible: "isVisible" in item ? Boolean(item.isVisible) : true,
                            target: typeof item.target === "string" ? item.target.trim() : "",
                            targetBehavior,
                            titleAttribute: typeof item.titleAttribute === "string" ? item.titleAttribute.replace(/\s+/g, " ").trim() : "",
                            downloadName: typeof item.downloadName === "string" ? item.downloadName.trim() : "",
                            requiresAuth: Boolean(item.requiresAuth),
                            isSecure: Boolean(item.isSecure),
                        };
                    })
                    .filter((item) => item.url)
                : [],
            visibleTextSnippets: normalizeStringList(page.visibleTextSnippets),
        }));

    return {
        scannedAt: typeof profile.scannedAt === "string" ? profile.scannedAt : "",
        baseUrl: typeof profile.baseUrl === "string" ? profile.baseUrl : "",
        pages,
        warnings: normalizeStringList(profile.warnings),
    };
}
