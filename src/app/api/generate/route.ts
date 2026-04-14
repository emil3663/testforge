import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const DEFAULT_BASE_URL = "http://localhost:3000";

const BEST_PRACTICE_OPTIONS = [
    "functional",
    "cross-browser",
    "responsive/mobile",
    "performance/load",
    "security",
    "accessibility",
    "usability",
    "seo/content",
    "cookie/session",
    "database",
] as const;

type BestPracticeArea = (typeof BEST_PRACTICE_OPTIONS)[number];

type InteractionCategory = "navigation" | "api" | "form" | "action";
type ActionableElementType = "link" | "button" | "input" | "select" | "textarea" | "form";
type LinkCategory = "navigation" | "api";

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
    category: LinkCategory;
    containerLabel: string;
    expectedStatus: number | null;
}

interface GeneratedSuite {
    area: BestPracticeArea;
    title: string;
    tests: string[];
    notes?: string[];
}

interface ContentRules {
    paths: string[];
    requiredHeadings: string[];
    requiredText: string[];
    forbiddenText: string[];
}

interface ContentProfilePage {
    path: string;
    url: string;
    title: string;
    metaDescription: string;
    headings: string[];
    buttons: string[];
    links: string[];
    actionableElements?: ActionableElementDetail[];
    linkDetails?: LinkDetail[];
    visibleTextSnippets: string[];
}

interface ContentProfile {
    scannedAt: string;
    baseUrl: string;
    pages: ContentProfilePage[];
    warnings?: string[];
}

const DEFAULT_BEST_PRACTICES: BestPracticeArea[] = [
    "functional",
    "usability",
    "responsive/mobile",
    "accessibility",
    "seo/content",
];

const BEST_PRACTICE_LABELS: Record<BestPracticeArea, string> = {
    functional: "Functional",
    "cross-browser": "Cross-Browser",
    "responsive/mobile": "Responsive/Mobile",
    "performance/load": "Performance/Load",
    security: "Security",
    accessibility: "Accessibility",
    usability: "Usability",
    "seo/content": "SEO/Content",
    "cookie/session": "Cookie/Session",
    database: "Database",
};

const SUITE_TITLES: Record<BestPracticeArea, string> = {
    functional: "Functional Coverage",
    "cross-browser": "Cross-Browser Coverage",
    "responsive/mobile": "Responsive Coverage",
    "performance/load": "Performance Coverage",
    security: "Security Coverage",
    accessibility: "Accessibility Coverage",
    usability: "Usability Coverage",
    "seo/content": "SEO and Content Coverage",
    "cookie/session": "Cookie and Session Coverage",
    database: "Database Coverage",
};

const BEST_PRACTICE_GUIDANCE = `Best-practice coverage to consider when relevant:
- Functional testing: verify navigation, forms, links, and primary happy-path flows.
- Cross-browser testing: write standards-based Playwright tests that can run in Chromium, Firefox, and WebKit projects.
- Responsive/mobile testing: include viewport checks for phone, tablet, and desktop when layout matters.
- Performance/load testing: include lightweight browser timing assertions when requested; do not invent JMeter or Lighthouse output.
- Security testing: focus on browser-visible checks like HTTPS, invalid-input handling, auth/session behavior, and visible security errors.
- Accessibility testing: include pragmatic WCAG-oriented checks such as headings, labels, roles, keyboard-reachable controls, and meaningful text.
- Usability testing: verify clear navigation, obvious calls to action, and visible user guidance.
- SEO/content testing: check title, meta description, heading structure, and critical content when the page is public.
- Cookie/session testing: inspect browser cookies or auth state only when it is observable from the page flow.
- Database testing: only validate data persistence indirectly through user-visible create/read/update flows unless the prompt explicitly provides an API or persistence path.

Prefer generating a balanced suite that covers the most relevant categories for the described scenario. If multiple categories are in scope, group related tests under separate test.describe blocks named after each coverage area. If a category requires tooling outside this repo, keep the executable Playwright code focused on what can actually run here and note the follow-up work in comments.`;

const SYSTEM_PROMPT = `You are TestForge, an expert Playwright test automation engineer.
Your job is to translate a plain-English test description into a clean, idiomatic Playwright TypeScript test file.

Rules:
- Use @playwright/test imports (test, expect).
- Use the base URL provided by the user as the starting point.
- Write descriptive test names that a non-developer tester could understand.
- Add clear comments explaining each step so the tester can learn from the code.
- Prefer user-visible locators (getByRole, getByLabel, getByPlaceholder, getByText) over CSS selectors.
- Include assertions that verify visible outcomes, not implementation details.
- Handle happy-path and any failure scenarios mentioned in the description.
- When multiple coverage areas are requested, group tests under named test.describe blocks by best-practice area.
- Keep the code concise but complete — no TODO stubs.
- Output ONLY the TypeScript code. Do not include markdown fences or explanations.

${BEST_PRACTICE_GUIDANCE}`;

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

function normalizeSelectedPractices(input: unknown) {
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

function normalizeContentRules(input: unknown): ContentRules {
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

function normalizeContentProfile(input: unknown): ContentProfile | null {
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

                        return {
                            text: typeof item.text === "string" ? item.text.replace(/\s+/g, " ").trim() : "",
                            url: typeof item.url === "string" ? item.url.trim() : "",
                            category,
                            containerLabel:
                                typeof item.containerLabel === "string"
                                    ? item.containerLabel.replace(/\s+/g, " ").trim()
                                    : "",
                            expectedStatus:
                                typeof item.expectedStatus === "number" ? item.expectedStatus : null,
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

function escapeForSingleQuotedString(value: string) {
    return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function escapeForDoubleQuotedSelector(value: string) {
    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function escapeForRegExpLiteral(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toSentenceCase(value: string) {
    if (!value) {
        return "Generated scenario";
    }

    return value.charAt(0).toUpperCase() + value.slice(1);
}

function summarizeDescription(description: string) {
    const cleaned = description.replace(/\s+/g, " ").trim();
    if (!cleaned) {
        return "Generated scenario";
    }

    return cleaned.length > 80 ? `${cleaned.slice(0, 77)}...` : cleaned;
}

function includesAny(text: string, keywords: string[]) {
    return keywords.some((keyword) => {
        if (/^[a-z0-9]+$/i.test(keyword)) {
            return new RegExp(`\\b${escapeRegExp(keyword)}\\b`, "i").test(text);
        }

        return text.includes(keyword);
    });
}

function getBestPracticeAreas(
    description: string,
    selectedPractices: BestPracticeArea[]
) {
    const lowerDescription = description.toLowerCase();
    const areas = new Set<BestPracticeArea>(
        selectedPractices.length > 0 ? selectedPractices : DEFAULT_BEST_PRACTICES
    );

    if (
        includesAny(lowerDescription, [
            "cross-browser",
            "browser",
            "chrome",
            "firefox",
            "safari",
            "edge",
            "webkit",
        ])
    ) {
        areas.add("cross-browser");
    }

    if (
        includesAny(lowerDescription, [
            "responsive",
            "mobile",
            "tablet",
            "desktop",
            "viewport",
            "screen size",
        ])
    ) {
        areas.add("responsive/mobile");
    }

    if (
        includesAny(lowerDescription, [
            "performance",
            "load time",
            "speed",
            "response time",
            "lighthouse",
            "jmeter",
        ])
    ) {
        areas.add("performance/load");
    }

    if (
        includesAny(lowerDescription, [
            "security",
            "ssl",
            "https",
            "vulnerability",
            "invalid input",
            "sanitize",
            "xss",
            "csrf",
        ])
    ) {
        areas.add("security");
    }

    if (
        includesAny(lowerDescription, [
            "accessibility",
            "a11y",
            "wcag",
            "screen reader",
            "keyboard",
        ])
    ) {
        areas.add("accessibility");
    }

    if (
        includesAny(lowerDescription, [
            "seo",
            "meta",
            "heading structure",
            "sitemap",
            "content",
        ])
    ) {
        areas.add("seo/content");
    }

    if (
        includesAny(lowerDescription, [
            "cookie",
            "cookies",
            "session",
            "login",
            "authentication",
            "auth",
        ])
    ) {
        areas.add("cookie/session");
    }

    if (
        includesAny(lowerDescription, [
            "database",
            "data submission",
            "save",
            "saved",
            "persist",
            "retrieval",
            "update",
        ])
    ) {
        areas.add("database");
    }

    return BEST_PRACTICE_OPTIONS.filter((area) => areas.has(area));
}

function buildCoverageComment(areas: BestPracticeArea[]) {
    return areas
        .map((area) => `// - ${BEST_PRACTICE_LABELS[area]}`)
        .join("\n");
}

function buildManualFollowUpComment(areas: BestPracticeArea[]) {
    const followUps: string[] = [];

    if (areas.includes("cross-browser")) {
        followUps.push(
            "// - Cross-browser: this suite is intended to run in Chromium, Firefox, and WebKit projects."
        );
    }

    if (areas.includes("security")) {
        followUps.push(
            "// - Security: pair these UI checks with deeper scanning for injection, auth, and header issues."
        );
    }

    if (areas.includes("database")) {
        followUps.push(
            "// - Database: verify persistence through API or backend assertions around create/update flows."
        );
    }

    return followUps.join("\n");
}

function normalizeRoutePath(path: string) {
    const normalized = path.trim() || "/";
    return normalized === "/" ? "/" : normalized.replace(/\/$/, "");
}

function resolveLinkAuditPath(baseUrl: string) {
    const pathname = new URL(baseUrl).pathname || "/";
    return normalizeRoutePath(pathname);
}

function findMatchingProfilePage(contentProfile: ContentProfile | null, path: string) {
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

function getActionableElementDisplayName(element: ActionableElementDetail) {
    return (
        element.text ||
        element.locator.name ||
        element.locator.label ||
        element.locator.placeholder ||
        element.locator.id ||
        (element.url ? `Untitled ${element.elementType} to ${element.url}` : `Untitled ${element.elementType}`)
    );
}

function buildLocatorExpression(element: ActionableElementDetail) {
    if (element.locator.id) {
        return `page.locator('[id="${escapeForDoubleQuotedSelector(element.locator.id)}"]').first()`;
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
        return `page.locator('input[type="${escapeForDoubleQuotedSelector(inputType)}"]').first()`;
    }

    return "page.locator('a[href]').first()";
}

function buildInteractionPrefix(category: InteractionCategory) {
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

function normalizeResponseHint(value: string) {
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

function buildResponseHints(element: ActionableElementDetail) {
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

function buildActionableElementTests(
    contentProfile: ContentProfile | null,
    path = "/"
) {
    const matchingPage = findMatchingProfilePage(contentProfile, path);
    const actionableElements = matchingPage?.actionableElements?.slice(0, 25) ?? [];

    if (actionableElements.length === 0) {
        const escapedPath = escapeForSingleQuotedString(path);

        return [`  test('actionable element setup for ${escapedPath} did not discover any interactive elements', async ({ page }) => {
    await page.goto('${escapedPath}');
    await page.waitForLoadState('domcontentloaded');

    const elements = await page.locator('a[href], button, input:not([type="hidden"]), select, textarea, form, [role="button"]').evaluateAll((nodes) => {
      return Array.from(nodes)
        .map((node) => ({
          text: node.textContent?.replace(/\s+/g, ' ').trim() ?? '',
          role: node.getAttribute('role') ?? '',
          id: node.getAttribute('id') ?? '',
          tagName: node.tagName.toLowerCase(),
        }))
        .filter((element) => Boolean(element.text || element.role || element.id));
    });

    expect(
      elements.length,
      'No actionable elements were discovered during introspection, so classified interaction results could not be generated.'
    ).toBeGreaterThan(0);
  });`];
    }

    return actionableElements.map((element) => {
        const elementName = getActionableElementDisplayName(element);
        const label = escapeForSingleQuotedString(elementName);
        const containerSuffix = element.containerLabel
            ? ` [${escapeForSingleQuotedString(element.containerLabel)}]`
            : "";
        const title = `${buildInteractionPrefix(element.category)}: ${label}${containerSuffix} [${element.elementType}]`;

        if (element.category === "api" && element.url) {
            const url = escapeForSingleQuotedString(element.url);
            const expectedStatusComment = typeof element.expectedStatus === "number"
                ? `    expect(response.status()).toBe(${element.expectedStatus});`
                : "    expect(response.status()).toBeLessThan(500);";
            const redirectSetting = typeof element.expectedStatus === "number" && element.expectedStatus >= 300 && element.expectedStatus < 400
                ? "      maxRedirects: 0,\n"
                : "";

            return `  test('${title}', async ({ request }) => {
    const response = await request.get('${url}', {
      failOnStatusCode: false,
      timeout: 15000,
${redirectSetting}    });

${expectedStatusComment}
  });`;
        }

        if (
            element.category === "api" &&
            (element.elementType === "button" ||
                (element.elementType === "input" && ["button", "submit", "reset"].includes(element.locator.inputType || "")) ||
                element.elementType === "link")
        ) {
            const escapedPath = escapeForSingleQuotedString(path);
            const locatorExpression = buildLocatorExpression(element);
            const expectedStatusComment = typeof element.expectedStatus === "number"
                ? `    expect(response.status()).toBe(${element.expectedStatus});`
                : "    expect(response.status()).toBeLessThan(500);";
            const responseHints = buildResponseHints(element);
            const responseHintsLiteral = `[${responseHints
                .map((hint) => `'${escapeForSingleQuotedString(hint)}'`)
                .join(", ")}]`;

            return `  test('${title}', async ({ page }) => {
        await page.goto('${escapedPath}');
        await page.waitForLoadState('domcontentloaded');

        const locator = ${locatorExpression};
        await expect(locator).toBeVisible();
        await expect(locator).toBeEnabled();
        await locator.scrollIntoViewIfNeeded();

        const responseHints = ${responseHintsLiteral};

        const responsePromise = page.waitForResponse((response) => {
            const request = response.request();
            const resourceType = request.resourceType();
            const normalizedUrl = response.url().toLowerCase();
            const hintMatch =
                responseHints.length === 0 ||
                responseHints.some((hint) => normalizedUrl.includes(hint));

            return (
                (resourceType === 'fetch' || resourceType === 'xhr' || resourceType === 'document') &&
                request.method() !== 'OPTIONS' &&
                hintMatch
            );
        }, { timeout: 15000 });

        await locator.click();
        const response = await responsePromise;

${expectedStatusComment}
    });`;
        }

        const escapedPath = escapeForSingleQuotedString(path);
        const locatorExpression = buildLocatorExpression(element);
        const visibilityAssertions = element.elementType === "form"
            ? `    await expect(locator).toBeVisible();\n\n    const controlCount = await locator.locator('input, textarea, select, button').count();\n    expect(controlCount).toBeGreaterThan(0);`
            : element.elementType === "input" || element.elementType === "textarea"
                ? `    await expect(locator).toBeVisible();\n    await expect(locator).toBeEditable();`
                : element.elementType === "select"
                    ? `    await expect(locator).toBeVisible();\n    await expect(locator).toBeEnabled();`
                    : element.elementType === "link"
                        ? `    await expect(locator).toBeVisible();\n    await expect(locator).toHaveAttribute('href', /.+/);`
                        : `    await expect(locator).toBeVisible();\n    await expect(locator).toBeEnabled();`;

        return `  test('${title}', async ({ page }) => {
    await page.goto('${escapedPath}');
    await page.waitForLoadState('domcontentloaded');

    const locator = ${locatorExpression};
${visibilityAssertions}
  });`;
    });
}

function buildTestMyLinksAuditTests(
    contentProfile: ContentProfile | null,
    path = "/"
) {
    const matchingPage = findMatchingProfilePage(contentProfile, path);

    const linkDetails = matchingPage?.linkDetails?.slice(0, 25) ?? [];

    if (linkDetails.length === 0) {
        return buildActionableElementTests(contentProfile, path);
    }

    return linkDetails.map((link) => {
        const linkName = link.text || `Untitled link to ${link.url}`;
        const label = escapeForSingleQuotedString(linkName);
        const url = escapeForSingleQuotedString(link.url);
        const containerSuffix = link.containerLabel
            ? ` [${escapeForSingleQuotedString(link.containerLabel)}]`
            : "";

        if (link.category === "api") {
            const expectedStatusComment = typeof link.expectedStatus === "number"
                ? `    expect(response.status()).toBe(${link.expectedStatus});`
                : "    expect(response.status()).toBeLessThan(500);";
            const redirectSetting = typeof link.expectedStatus === "number" && link.expectedStatus >= 300 && link.expectedStatus < 400
                ? "      maxRedirects: 0,\n"
                : "";

            return `  test('api element check: ${label}${containerSuffix} [link]', async ({ request }) => {
        const response = await request.get('${url}', {
            failOnStatusCode: false,
            timeout: 15000,
${redirectSetting}    });

${expectedStatusComment}
    });`;
        }

        return `  test('navigation element check: ${label}${containerSuffix} [link]', async ({ request }) => {
    const response = await request.get('${url}', {
      failOnStatusCode: false,
      timeout: 15000,
            maxRedirects: 0,
    });

        expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(400);
  });`;
    });
}

function buildContentProfileComment(profile: ContentProfile | null, rules: ContentRules) {
    const lines = ["// Content-aware inputs:"];

    if (profile?.pages.length) {
        lines.push(`// - Inspected ${profile.pages.length} page(s) before generation.`);
        for (const page of profile.pages.slice(0, 3)) {
            const headingPreview = page.headings.slice(0, 2).join(", ");
            const actionableCount = page.actionableElements?.length ?? 0;
            lines.push(
                `// - ${page.path}: ${page.title || "No title"}${headingPreview ? ` | headings: ${headingPreview}` : ""}${actionableCount ? ` | interactive elements: ${actionableCount}` : ""}`
            );
        }
    } else {
        lines.push("// - No page inspection data was available.");
    }

    if (rules.requiredHeadings.length > 0) {
        lines.push(`// - Required headings: ${rules.requiredHeadings.join(", ")}`);
    }

    if (rules.requiredText.length > 0) {
        lines.push(`// - Required text: ${rules.requiredText.join(", ")}`);
    }

    if (rules.forbiddenText.length > 0) {
        lines.push(`// - Forbidden text: ${rules.forbiddenText.join(", ")}`);
    }

    return lines.join("\n");
}

function buildContentSuites(
    contentProfile: ContentProfile | null,
    contentRules: ContentRules
) {
    if (!contentProfile?.pages.length) {
        return [] as GeneratedSuite[];
    }

    const seoTests: string[] = [];
    const functionalTests: string[] = [];

    for (const page of contentProfile.pages) {
        const escapedPath = escapeForSingleQuotedString(page.path || "/");
        const titleAssertion = page.title
            ? `    await expect(page).toHaveTitle('${escapeForSingleQuotedString(page.title)}');\n`
            : "    await expect(page).toHaveTitle(/.+/);\n";
        const keyHeadings = page.headings.slice(0, 3)
            .map(
                (heading) =>
                    `    await expect(page.getByRole('heading', { name: '${escapeForSingleQuotedString(heading)}', exact: true }).first()).toBeVisible();`
            )
            .join("\n");

        seoTests.push(`  test('keeps key page metadata and headings stable for ${escapedPath}', async ({ page }) => {
    await page.goto('${escapedPath}');
    await page.waitForLoadState('domcontentloaded');

${titleAssertion}${page.metaDescription ? `    await expect(page.locator('meta[name="description"]').first()).toHaveAttribute('content', /${escapeForRegExpLiteral(page.metaDescription.slice(0, 60))}/i);\n` : ""}${keyHeadings || "    await expect(page.getByRole('heading').first()).toBeVisible();"}
  });`);
    }

    for (const heading of contentRules.requiredHeadings) {
        functionalTests.push(`  test('shows the required heading ${escapeForSingleQuotedString(heading)}', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('heading', { name: '${escapeForSingleQuotedString(heading)}', exact: true }).first()).toBeVisible();
  });`);
    }

    for (const snippet of contentRules.requiredText) {
        functionalTests.push(`  test('shows the required content snippet ${escapeForSingleQuotedString(snippet)}', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('body')).toContainText('${escapeForSingleQuotedString(snippet)}');
  });`);
    }

    for (const snippet of contentRules.forbiddenText) {
        functionalTests.push(`  test('does not show the forbidden content snippet ${escapeForSingleQuotedString(snippet)}', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('body')).not.toContainText('${escapeForSingleQuotedString(snippet)}');
  });`);
    }

    const suites: GeneratedSuite[] = [];
    const seoSuite = createSuite("seo/content", seoTests);
    if (seoSuite) {
        suites.push(seoSuite);
    }

    const functionalSuite = createSuite("functional", functionalTests);
    if (functionalSuite) {
        suites.push(functionalSuite);
    }

    return suites;
}

function createSuite(
    area: BestPracticeArea,
    tests: string[],
    notes?: string[]
): GeneratedSuite | null {
    if (tests.length === 0 && (!notes || notes.length === 0)) {
        return null;
    }

    return {
        area,
        title: SUITE_TITLES[area],
        tests,
        notes,
    };
}

function buildSharedBestPracticeSuites(
    baseUrl: string,
    description: string,
    areas: BestPracticeArea[]
) {
    const lowerDescription = description.toLowerCase();
    const suites: GeneratedSuite[] = [];

    if (areas.includes("cross-browser")) {
        const suite = createSuite("cross-browser", [
            `  test('runs the core smoke journey in the configured browser project', async ({ page, browserName }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    expect(['chromium', 'firefox', 'webkit']).toContain(browserName);
    await expect(page.locator('body')).toBeVisible();
  });`,
        ]);

        if (suite) {
            suites.push(suite);
        }
    }

    if (areas.includes("responsive/mobile")) {
        const suite = createSuite("responsive/mobile", [
            `  test('keeps the core journey visible across common viewport sizes', async ({ page }) => {
    const viewports = [
      { name: 'mobile', width: 390, height: 844 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'desktop', width: 1440, height: 900 },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('body')).toBeVisible();
      await expect(page.getByRole('heading').first()).toBeVisible();
    }
  });`,
        ]);

        if (suite) {
            suites.push(suite);
        }
    }

    if (areas.includes("accessibility")) {
        const suite = createSuite("accessibility", [
            `  test('exposes basic accessible structure for assistive technologies', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('heading').first()).toBeVisible();
    const interactiveCount = await page.locator('a, button, input, textarea, select, [role="button"]').count();
    expect(interactiveCount).toBeGreaterThan(0);
  });`,
        ]);

        if (suite) {
            suites.push(suite);
        }
    }

    if (areas.includes("seo/content")) {
        const suite = createSuite("seo/content", [
            `  test('exposes core SEO and content signals on the landing page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveTitle(/.+/);
    await expect(page.getByRole('heading').first()).toBeVisible();
    const metaDescription = page.locator('meta[name="description"]');
    if (await metaDescription.count()) {
      await expect(metaDescription.first()).toHaveAttribute('content', /.+/);
    }
  });`,
        ]);

        if (suite) {
            suites.push(suite);
        }
    }

    if (
        areas.includes("performance/load") &&
        !includesAny(lowerDescription, [
            "response time",
            "performance",
            "load time",
            "speed",
        ])
    ) {
        const suite = createSuite("performance/load", [
            `  test('captures a simple load-time budget for the landing page', async ({ page }) => {
    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(response).not.toBeNull();
    expect(response?.status()).toBeLessThan(400);

    const navigationDuration = await page.evaluate(() => {
      const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      return navigationEntry?.duration ?? 0;
    });

    expect(navigationDuration).toBeLessThan(5000);
  });`,
        ]);

        if (suite) {
            suites.push(suite);
        }
    }

    if (areas.includes("security")) {
        const securityTests: string[] = [];
        const securityNotes: string[] = [];

        if (new URL(baseUrl).protocol === "https:") {
            securityTests.push(`  test('uses HTTPS for the requested public test target', async ({ page }) => {
    await page.goto('/');
    expect(new URL(page.url()).protocol).toBe('https:');
  });`);
        } else {
            securityNotes.push(
                "This target is not HTTPS by default, so deeper transport-security validation should be handled outside this browser suite."
            );
        }

        const suite = createSuite("security", securityTests, securityNotes);

        if (suite) {
            suites.push(suite);
        }
    }

    if (areas.includes("cookie/session")) {
        const suite = createSuite("cookie/session", [
            `  test('can inspect browser cookies for the session flow', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const cookies = await page.context().cookies();
    expect(Array.isArray(cookies)).toBeTruthy();
  });`,
        ]);

        if (suite) {
            suites.push(suite);
        }
    }

    return suites;
}

function buildGenericSuites(
    baseUrl: string,
    description: string,
    areas: BestPracticeArea[],
    contentProfile: ContentProfile | null
) {
    const lowerDescription = description.toLowerCase();
    const linkAuditPath = resolveLinkAuditPath(baseUrl);
    const suites: GeneratedSuite[] = [];
    const functionalTests: string[] = [];
    const usabilityTests: string[] = [];

    if (areas.includes("functional")) {
        functionalTests.push(`  test('loads the target page and shows visible content', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveTitle(/.+/);
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('body')).toContainText(/\S+/);
  });`);

        if (
            includesAny(lowerDescription, [
                "login",
                "sign in",
                "sign-in",
                "password",
                "username",
            ])
        ) {
            functionalTests.push(`  test('surfaces a sign-in related control for the described flow', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const authControls = page.locator('input[type="password"], input[name*="user" i], input[name*="email" i], button:has-text("Login"), button:has-text("Sign in"), a:has-text("Login"), a:has-text("Sign in")');
    await expect(authControls.first()).toBeVisible();
  });`);
        } else if (includesAny(lowerDescription, ["search", "find", "lookup"])) {
            functionalTests.push(`  test('shows at least one search or filter style control', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const searchControls = page.locator('input[type="search"], input[placeholder*="search" i], input[aria-label*="search" i], button:has-text("Search")');
    await expect(searchControls.first()).toBeVisible();
  });`);
        } else {
            functionalTests.push(`  test('shows at least one interactive element related to the scenario', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const interactive = page.locator('a, button, input, textarea, select, [role="button"]');
    await expect(interactive.first()).toBeVisible();
  });`);
        }

        if (contentProfile?.pages.length) {
            functionalTests.push(...buildActionableElementTests(contentProfile, linkAuditPath));
        }

        if (includesAny(lowerDescription, ["link", "links", "href", "anchor", "anchors", "broken link"])) {
            functionalTests.push(...buildTestMyLinksAuditTests(contentProfile, linkAuditPath));
        }
    }

    if (areas.includes("usability")) {
        usabilityTests.push(`  test('keeps navigation and guidance visible for a first-time user', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('heading').first()).toBeVisible();
    const visibleInteractive = page.locator('a:visible, button:visible');
    expect(await visibleInteractive.count()).toBeGreaterThan(0);
  });`);
    }

    const functionalSuite = createSuite("functional", functionalTests);
    if (functionalSuite) {
        suites.push(functionalSuite);
    }

    const usabilitySuite = createSuite("usability", usabilityTests);
    if (usabilitySuite) {
        suites.push(usabilitySuite);
    }

    return [...suites, ...buildSharedBestPracticeSuites(baseUrl, description, areas)];
}

function buildDemoQaSuites(
    baseUrl: string,
    description: string,
    areas: BestPracticeArea[],
    contentProfile: ContentProfile | null
) {
    const lowerDescription = description.toLowerCase();
    const linkAuditPath = resolveLinkAuditPath(baseUrl);
    const suites: GeneratedSuite[] = [];
    const functionalTests: string[] = [];
    const usabilityTests: string[] = [];

    if (areas.includes("functional")) {
        functionalTests.push(`  test('opens DemoQA and shows the main practice categories', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveTitle(/demosite|DEMOQA|ToolsQA/i);
    await expect(page.getByText('Elements', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Forms', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Book Store Application', { exact: true }).first()).toBeVisible();
  });`);

        if (
            includesAny(lowerDescription, [
                "login",
                "sign in",
                "sign-in",
                "book store",
                "bookstore",
                "profile",
                "password",
                "username",
            ])
        ) {
            functionalTests.push(`  test('shows the DemoQA book store login form', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('heading', { name: 'Login', exact: true })).toBeVisible();
    await expect(page.getByText('Login in Book Store', { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder('UserName')).toBeVisible();
    await expect(page.getByPlaceholder('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New User' })).toBeVisible();
  });`);
        }

        if (
            includesAny(lowerDescription, [
                "elements",
                "text box",
                "check box",
                "checkbox",
                "radio",
                "buttons",
                "links",
                "upload",
                "download",
                "dynamic properties",
                "web tables",
            ])
        ) {
            functionalTests.push(`  test('shows the expected options in the Elements section', async ({ page }) => {
    await page.goto('/elements');
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveURL(/\\/elements$/);
    await expect(page.getByText('Elements', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Please select an item from left to start practice.')).toBeVisible();
    await expect(page.getByText('Text Box', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Buttons', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Web Tables', { exact: true }).first()).toBeVisible();
  });`);
        }

        if (
            includesAny(lowerDescription, [
                "form",
                "forms",
                "practice form",
                "submit",
                "registration",
            ])
        ) {
            functionalTests.push(`  test('shows the DemoQA forms section for form-based scenarios', async ({ page }) => {
    await page.goto('/forms');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText('Forms', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Practice Form', { exact: true }).first()).toBeVisible();
  });`);
        }

        if (includesAny(lowerDescription, ["alert", "window", "frame", "modal"])) {
            functionalTests.push(`  test('shows the alerts and windows section navigation', async ({ page }) => {
    await page.goto('/alertsWindows');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText('Alerts, Frame & Windows', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Browser Windows', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Alerts', { exact: true }).first()).toBeVisible();
  });`);
        }

        if (
            includesAny(lowerDescription, [
                "widget",
                "widgets",
                "accordion",
                "autocomplete",
                "slider",
                "progress",
                "tabs",
                "tooltip",
                "menu",
            ])
        ) {
            functionalTests.push(`  test('shows the widgets section for interactive component checks', async ({ page }) => {
    await page.goto('/widgets');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText('Widgets', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Accordian', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Slider', { exact: true }).first()).toBeVisible();
  });`);
        }

        if (
            includesAny(lowerDescription, [
                "interaction",
                "interactions",
                "drag",
                "drop",
                "selectable",
                "sortable",
                "droppable",
                "resizable",
            ])
        ) {
            functionalTests.push(`  test('shows the interactions section for drag and drop style flows', async ({ page }) => {
    await page.goto('/interaction');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText('Interactions', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Sortable', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Droppable', { exact: true }).first()).toBeVisible();
  });`);
        }

        if (includesAny(lowerDescription, ["book", "books", "store", "search book"])) {
            functionalTests.push(`  test('shows the DemoQA book store catalog', async ({ page }) => {
    await page.goto('/books');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText('Book Store', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('textbox', { name: /search/i })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Login' })).toBeVisible();
  });`);
        }

        if (functionalTests.length === 1) {
            functionalTests.push(`  test('lets a tester drill into a common practice area', async ({ page }) => {
    await page.goto('/elements');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText('Elements', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Please select an item from left to start practice.')).toBeVisible();
  });`);
        }

        if (contentProfile?.pages.length) {
            functionalTests.push(...buildActionableElementTests(contentProfile, linkAuditPath));
        }

        if (includesAny(lowerDescription, ["link", "links", "href", "anchor", "anchors", "broken link"])) {
            functionalTests.push(...buildTestMyLinksAuditTests(contentProfile, linkAuditPath));
        }
    }

    if (
        areas.includes("performance/load") &&
        includesAny(lowerDescription, [
            "response time",
            "performance",
            "load time",
            "speed",
        ])
    ) {
        const performanceSuite = createSuite("performance/load", [
            `  test('captures a simple response-time check for the requested page', async ({ page }) => {
    const response = await page.goto('/elements', { waitUntil: 'domcontentloaded' });

    await expect(response).not.toBeNull();
    expect(response?.status()).toBeLessThan(400);

    const navigationDuration = await page.evaluate(() => {
      const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      return navigationEntry?.duration ?? 0;
    });

    expect(navigationDuration).toBeLessThan(5000);
  });`,
        ]);

        if (performanceSuite) {
            suites.push(performanceSuite);
        }
    }

    if (areas.includes("usability")) {
        usabilityTests.push(`  test('shows clear practice navigation and guidance for testers', async ({ page }) => {
    await page.goto('/elements');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText('Please select an item from left to start practice.')).toBeVisible();
    await expect(page.getByText('Text Box', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Buttons', { exact: true }).first()).toBeVisible();
  });`);
    }

    const functionalSuite = createSuite("functional", functionalTests);
    if (functionalSuite) {
        suites.push(functionalSuite);
    }

    const usabilitySuite = createSuite("usability", usabilityTests);
    if (usabilitySuite) {
        suites.push(usabilitySuite);
    }

    return [...suites, ...buildSharedBestPracticeSuites(baseUrl, description, areas)];
}

function renderSuites(suites: GeneratedSuite[]) {
    return suites
        .map((suite) => {
            const notes = suite.notes?.length
                ? `${suite.notes.map((note) => `// ${note}`).join("\n")}\n`
                : "";

            return `${notes}test.describe('${escapeForSingleQuotedString(
                suite.title
            )}', () => {\n${suite.tests.join("\n\n")}\n});`;
        })
        .join("\n\n");
}

function mockGenerate(
    baseUrl: string,
    description: string,
    selectedPractices: BestPracticeArea[],
    contentProfile: ContentProfile | null,
    contentRules: ContentRules
) {
    const parsedBaseUrl = new URL(baseUrl);
    const escapedBaseUrl = escapeForSingleQuotedString(baseUrl);
    const escapedDescription = escapeForSingleQuotedString(
        summarizeDescription(description)
    );
    const bestPracticeAreas = getBestPracticeAreas(description, selectedPractices);
    const suiteTitle = escapeForSingleQuotedString(
        toSentenceCase(summarizeDescription(description))
    );
    const suites = parsedBaseUrl.hostname.includes("demoqa.com")
        ? buildDemoQaSuites(baseUrl, description, bestPracticeAreas, contentProfile)
        : buildGenericSuites(baseUrl, description, bestPracticeAreas, contentProfile);
    const contentSuites = buildContentSuites(contentProfile, contentRules);
    const manualFollowUpComment = buildManualFollowUpComment(bestPracticeAreas);

    return `import { test, expect } from '@playwright/test';

// Generated by TestForge without an OpenAI API key.
// Scenario: ${escapedDescription}
// Best-practice coverage selected for this suite:
${buildCoverageComment(bestPracticeAreas)}
${buildContentProfileComment(contentProfile, contentRules)}
${manualFollowUpComment ? `${manualFollowUpComment}\n` : ""}

// Suite grouping root: ${suiteTitle}

test.use({ baseURL: '${escapedBaseUrl}' });

${renderSuites([...suites, ...contentSuites])}

// NOTE: This fallback generator uses URL and keyword heuristics.
// Add OPENAI_API_KEY in your .env to generate tests tailored more deeply to the scenario.`;
}

export async function POST(req: NextRequest) {
    const { baseUrl, description, selectedPractices, contentProfile, contentRules } = await req.json();

    if (!description || typeof description !== "string") {
        return NextResponse.json(
            { error: "description is required" },
            { status: 400 }
        );
    }

    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    if (!normalizedBaseUrl.ok) {
        return NextResponse.json(
            { error: normalizedBaseUrl.message },
            { status: 400 }
        );
    }

    const normalizedPractices = normalizeSelectedPractices(selectedPractices);
    const normalizedContentProfile = normalizeContentProfile(contentProfile);
    const normalizedContentRules = normalizeContentRules(contentRules);
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
        const code = mockGenerate(
            normalizedBaseUrl.value,
            description,
            normalizedPractices,
            normalizedContentProfile,
            normalizedContentRules
        );
        return NextResponse.json({ code });
    }

    const client = new OpenAI({ apiKey });

    const chat = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
                role: "user",
                content: `Base URL: ${normalizedBaseUrl.value}\nSelected best-practice coverage: ${normalizedPractices.length > 0 ? normalizedPractices.join(
                    ", "
                ) : "infer from prompt"}\nContent rules: ${JSON.stringify(normalizedContentRules, null, 2)}\nPage inspection profile: ${JSON.stringify(normalizedContentProfile, null, 2)}\n\nTest description:\n${description}`,
            },
        ],
        temperature: 0.2,
    });

    const code = chat.choices[0]?.message?.content ?? "";
    return NextResponse.json({ code });
}
