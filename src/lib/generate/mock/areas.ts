import { includesAny } from "./format";
import type { BestPracticeArea } from "./types";
import { BEST_PRACTICE_OPTIONS } from "./types";

// TFP-085: reliability's failure-injection tests are read-only from the
// target's point of view (Decision 2), so they run by default the same as
// functional/accessibility - included here, not left to opt-in.
const DEFAULT_BEST_PRACTICES: BestPracticeArea[] = [
    "functional",
    "usability",
    "responsive/mobile",
    "accessibility",
    "seo/content",
    "reliability",
];

const BEST_PRACTICE_LABELS: Record<BestPracticeArea, string> = {
    functional: "Functional",
    "responsive/mobile": "Responsive/Mobile",
    "performance/load": "Performance/Load",
    security: "Security",
    accessibility: "Accessibility",
    usability: "Usability",
    "seo/content": "SEO/Content",
    "cookie/session": "Cookie/Session",
    database: "Database",
    reliability: "Reliability",
};

export function getBestPracticeAreas(
    description: string,
    selectedPractices: BestPracticeArea[]
) {
    if (selectedPractices.length > 0) {
        return BEST_PRACTICE_OPTIONS.filter((area) => selectedPractices.includes(area));
    }

    const lowerDescription = description.toLowerCase();
    const areas = new Set<BestPracticeArea>(DEFAULT_BEST_PRACTICES);

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

export function buildCoverageComment(areas: BestPracticeArea[]) {
    return areas
        .map((area) => `// - ${BEST_PRACTICE_LABELS[area]}`)
        .join("\n");
}

export function buildManualFollowUpComment(areas: BestPracticeArea[]) {
    const followUps: string[] = [];

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
