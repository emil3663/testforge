import { SITE_DESCRIPTION, SITE_NAME, getSiteUrl } from "@/lib/seo";
import type { BestPracticeArea, ReportTab, TestAuditMode } from "@/app/_lib/types";

export const BEST_PRACTICE_OPTIONS = [
    {
        id: "functional",
        label: "Functional",
        description: "Forms, links, navigation, and core flows",
    },
    {
        id: "responsive/mobile",
        label: "Responsive",
        description: "Phone, tablet, and desktop viewports",
    },
    {
        id: "performance/load",
        label: "Performance",
        description: "Response-time and basic load checks",
    },
    {
        id: "security",
        label: "Security",
        description: "HTTPS and browser-visible safety checks",
    },
    {
        id: "accessibility",
        label: "Accessibility",
        description: "Headings, labels, and basic a11y smoke",
    },
    {
        id: "usability",
        label: "Usability",
        description: "Clarity, navigation, and visible guidance",
    },
    {
        id: "seo/content",
        label: "SEO",
        description: "Title, content structure, and meta signals",
    },
    {
        id: "cookie/session",
        label: "Cookies",
        description: "Session and browser cookie inspection",
    },
    {
        id: "database",
        label: "Database",
        description: "Persistence follow-up for save/update flows",
    },
    {
        id: "reliability",
        label: "Reliability",
        description: "Graceful degradation when a dependency or local storage fails",
    },
] as const;

// Only correct when TestForge is testing itself - it's the form's starting
// value, not a recommendation. For any other target (Plane on :80,
// test-assist on :4321, ...) the user must replace it.
export const DEFAULT_BASE_URL = "http://localhost:3000";

export const DEFAULT_DESCRIPTION_EXAMPLE = "E.g. Create an accessibility and performance suite for the login flow.";

export const DEFAULT_TEST_AUDIT_MODE: TestAuditMode = "fast";

export const BASE_REPORT_TABS: ReportTab[] = [
    "summary",
    "execution",
    "defects",
    "coverage",
    "performance",
    "usability",
];

export const TEST_AUDIT_MODE_OPTIONS: Array<{
    id: TestAuditMode;
    label: string;
    description: string;
}> = [
        {
            id: "fast",
            label: "Fast",
            description: "Caps per-page link-click checks and keeps generation focused on the highest-value audits.",
        },
        {
            id: "deep",
            label: "Deep",
            description: "Keeps the broader per-link navigation coverage for slower, more exhaustive suites.",
        },
    ];

export const BEST_PRACTICE_KEYWORDS: Record<BestPracticeArea, string[]> = {
    functional: ["functional", "flow", "journey", "form", "forms", "navigation", "link", "links"],
    "responsive/mobile": [
        "responsive",
        "mobile",
        "tablet",
        "desktop",
        "viewport",
        "screen size",
    ],
    "performance/load": [
        "performance",
        "load",
        "load time",
        "speed",
        "response time",
    ],
    security: ["security", "https", "ssl", "csrf", "xss", "auth"],
    accessibility: ["accessibility", "a11y", "wcag", "screen reader", "keyboard"],
    usability: ["usability", "user-friendly", "user friendly", "guidance", "clarity", "navigation"],
    "seo/content": ["seo", "content", "meta", "heading", "headings", "title"],
    "cookie/session": ["cookie", "cookies", "session", "login", "authentication"],
    database: ["database", "persist", "persistence", "save", "saved", "update"],
    reliability: ["reliability", "resilience", "degrade", "graceful", "offline", "failure", "outage"],
};

export const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web",
    url: getSiteUrl(),
    featureList: [
        "Plain-English Playwright test generation",
        "Crawl-aware page selection",
        "Content-aware assertions",
        "Structured regression reporting",
    ],
};
