export const SITE_NAME = "TestForge";
export const SITE_TITLE = "TestForge | AI-native Playwright test automation";
export const SITE_DESCRIPTION = "Generate, inspect, and run Playwright test suites from plain-English prompts with structured reporting, crawl-aware coverage, and content-aware assertions.";
export const SITE_TAGLINE = "AI-native Playwright test creation with structured quality reporting";
export const SITE_KEYWORDS = [
    "Playwright test automation",
    "AI test generation",
    "Next.js QA tooling",
    "quality engineering",
    "regression testing",
    "smoke testing",
    "test reporting",
    "content-aware testing",
];

function normalizeSiteUrl(value: string) {
    const trimmed = value.trim();

    if (!trimmed) {
        return "http://localhost:3000";
    }

    return /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(trimmed)
        ? trimmed
        : `https://${trimmed}`;
}

export function getSiteUrl() {
    return normalizeSiteUrl(
        process.env.NEXT_PUBLIC_SITE_URL
            ?? process.env.SITE_URL
            ?? process.env.VERCEL_PROJECT_PRODUCTION_URL
            ?? "http://localhost:3000"
    );
}

export function getSiteOrigin() {
    return new URL(getSiteUrl());
}