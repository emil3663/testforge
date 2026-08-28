import { pluralize } from "./text";
import type { ExecutionRecord, SeoCheckRecord, SeoCheckSummary, SeoPageCheckSummary, SeoPageGroup, SeoRecommendation } from "./types";

const SEO_RULE_DEFINITIONS: Array<{
    id: string;
    label: string;
    description: string;
    test: (record: ExecutionRecord) => boolean;
    recommendation: SeoRecommendation;
}> = [
        {
            id: "title",
            label: "Page titles",
            description: "Public pages should expose stable, descriptive document titles.",
            test: (record) => /keeps page title stable/i.test(record.title),
            recommendation: {
                priority: "High",
                title: "Stabilize page titles",
                rationale: "Set a unique, descriptive title for each public page and keep the title aligned with the final indexable URL and page intent.",
            },
        },
        {
            id: "meta-description",
            label: "Meta descriptions",
            description: "Public pages should ship a non-empty meta description that matches the page intent.",
            test: (record) => /keeps meta description stable/i.test(record.title),
            recommendation: {
                priority: "High",
                title: "Improve meta description coverage",
                rationale: "Add or refine meta descriptions so each page has concise summary copy that can stand in search results without duplication.",
            },
        },
        {
            id: "heading-structure",
            label: "Heading structure",
            description: "Landing pages should keep a visible heading hierarchy led by a clear primary heading.",
            test: (record) => /keeps heading structure stable/i.test(record.title),
            recommendation: {
                priority: "High",
                title: "Tighten heading hierarchy",
                rationale: "Ensure each public page has a clear primary heading and that major sections descend in a predictable order.",
            },
        },
        {
            id: "canonical",
            label: "Canonical URLs",
            description: "Canonical metadata should point crawlers at the final URL for each public page.",
            test: (record) => /keeps canonical metadata stable/i.test(record.title),
            recommendation: {
                priority: "High",
                title: "Validate canonical URLs",
                rationale: "Add rel=canonical to each public page and make sure it resolves to the final, preferred indexable path.",
            },
        },
        {
            id: "structured-data",
            label: "Structured data",
            description: "Public pages should expose machine-readable schema when the page is intended to rank in search.",
            test: (record) => /exposes structured data/i.test(record.title),
            recommendation: {
                priority: "Medium",
                title: "Add JSON-LD schema",
                rationale: "Publish relevant JSON-LD for the landing page or page type so crawlers can parse entity and page intent more reliably.",
            },
        },
        {
            id: "robots",
            label: "robots.txt",
            description: "robots.txt should be reachable and point crawlers at the sitemap.",
            test: (record) => /publishes robots\.txt/i.test(record.title),
            recommendation: {
                priority: "Medium",
                title: "Publish robots.txt",
                rationale: "Serve a robots.txt file that allows intended crawl paths and includes a sitemap reference for discovery.",
            },
        },
        {
            id: "sitemap",
            label: "Sitemap",
            description: "A sitemap should be reachable and expose at least one canonical URL.",
            test: (record) => /publishes sitemap\.xml/i.test(record.title),
            recommendation: {
                priority: "Medium",
                title: "Publish sitemap.xml",
                rationale: "Expose a valid sitemap.xml containing the canonical public URLs you want crawlers to discover and revisit.",
            },
        },
        {
            id: "manifest",
            label: "Manifest",
            description: "The site should expose a valid web manifest for installable-browser metadata where applicable.",
            test: (record) => /publishes manifest metadata/i.test(record.title),
            recommendation: {
                priority: "Low",
                title: "Expose a valid web manifest",
                rationale: "Link a valid web manifest from the document head so installable browsers and rich previews can resolve app metadata consistently.",
            },
        },
        {
            id: "critical-content",
            label: "Critical content",
            description: "Key public-facing content snippets should be present when they are declared as SEO-critical rules.",
            test: (record) => /shows the required content snippet/i.test(record.title),
            recommendation: {
                priority: "Medium",
                title: "Protect critical content blocks",
                rationale: "Turn important marketing copy, product value statements, or entity text into stable content checks so SEO-critical sections do not silently disappear.",
            },
        },
    ];

function normalizeSeoBaseUrl(baseUrl?: string) {
    if (!baseUrl?.trim()) {
        return null;
    }

    try {
        return new URL(baseUrl).toString().replace(/\/$/, "");
    } catch {
        return baseUrl.replace(/\/$/, "");
    }
}

function extractSeoPageInfo(title: string, baseUrl?: string) {
    const normalizedBaseUrl = normalizeSeoBaseUrl(baseUrl);
    const pathMatch = title.match(/\sfor\s(\/.*)$/i);
    if (pathMatch?.[1]) {
        return {
            pageKey: pathMatch[1],
            pageLabel: pathMatch[1] === "/" && normalizedBaseUrl
                ? normalizedBaseUrl
                : pathMatch[1],
        };
    }

    if (/robots\.txt|sitemap\.xml|manifest metadata/i.test(title)) {
        return {
            pageKey: "site-wide",
            pageLabel: "Site-wide",
        };
    }

    return {
        pageKey: "general",
        pageLabel: "General",
    };
}

export function summarizeSeoCheckFailure(check: SeoCheckSummary) {
    const failingEvidence = check.evidence.filter(
        (record) => record.status === "Failed" || record.status === "Blocked"
    );
    const browserList = [...new Set(failingEvidence.map((record) => record.browser))].join(", ");
    const browserSuffix = browserList ? ` in ${browserList}` : "";
    const failureCount = failingEvidence.length;

    switch (check.id) {
        case "title":
            return `Page titles failed ${failureCount} ${pluralize(failureCount, "time", "times")}${browserSuffix}. The audit could not confirm a stable, descriptive title for the page.`;
        case "meta-description":
            return `Meta descriptions failed ${failureCount} ${pluralize(failureCount, "time", "times")}${browserSuffix}. The audit could not confirm a stable non-empty meta description for the page.`;
        case "heading-structure":
            return `Heading structure failed ${failureCount} ${pluralize(failureCount, "time", "times")}${browserSuffix}. The audit could not confirm the expected visible heading hierarchy.`;
        case "canonical":
            return `Canonical URLs failed ${failureCount} ${pluralize(failureCount, "time", "times")}${browserSuffix}. The audit could not confirm that the page exposes the expected canonical target.`;
        case "structured-data":
            return `Structured data failed ${failureCount} ${pluralize(failureCount, "time", "times")}${browserSuffix}. The audit could not confirm usable JSON-LD on the page.`;
        case "robots":
            return `robots.txt failed ${failureCount} ${pluralize(failureCount, "time", "times")}${browserSuffix}. The crawler-facing robots file was missing or did not expose the expected sitemap reference.`;
        case "sitemap":
            return `Sitemap failed ${failureCount} ${pluralize(failureCount, "time", "times")}${browserSuffix}. The audit could not confirm a reachable sitemap with public URLs.`;
        case "manifest":
            return `Manifest metadata failed ${failureCount} ${pluralize(failureCount, "time", "times")}${browserSuffix}. The audit could not confirm a valid linked web manifest.`;
        case "critical-content":
            return `Critical content checks failed ${failureCount} ${pluralize(failureCount, "time", "times")}${browserSuffix}. Required SEO-facing copy was not confirmed in the current run.`;
        default:
            return `${check.label} failed ${failureCount} ${pluralize(failureCount, "time", "times")}${browserSuffix}. The audit could not confirm this SEO rule in the current run.`;
    }
}

export function buildSeoReport(records: ExecutionRecord[], selectedPractices: string[], baseUrl?: string) {
    const seoScopedRecords = records.filter(
        (record) => record.area === "SEO" || /shows the required content snippet/i.test(record.title)
    );
    const seoRequested = selectedPractices.includes("seo/content") || seoScopedRecords.length > 0;

    const checks = SEO_RULE_DEFINITIONS
        .filter((rule) => seoRequested || seoScopedRecords.some(rule.test))
        .map((rule) => {
            const evidence = seoScopedRecords
                .filter(rule.test)
                .map((record) => ({
                    title: record.title,
                    browser: record.browser,
                    status: record.status,
                    remarks: record.remarks,
                }));
            const hasFailure = evidence.some(
                (record) => record.status === "Failed" || record.status === "Blocked"
            );
            const hasSuccess = evidence.some(
                (record) => record.status === "Passed" || record.status === "Flaky"
            );

            return {
                id: rule.id,
                label: rule.label,
                description: rule.description,
                status: hasFailure
                    ? "failed"
                    : hasSuccess
                        ? "passed"
                        : "not-covered",
                evidence,
            } satisfies SeoCheckSummary;
        });

    const passedChecks = checks.filter((check) => check.status === "passed").length;
    const failedChecks = checks.filter((check) => check.status === "failed").length;
    const notCoveredChecks = checks.filter((check) => check.status === "not-covered").length;
    const scoreDenominator = Math.max(checks.length, 1);
    const score = Math.round((passedChecks / scoreDenominator) * 100);
    const findings = checks
        .filter((check) => check.status === "failed")
        .map((check) => summarizeSeoCheckFailure(check));
    const strengths = checks
        .filter((check) => check.status === "passed")
        .map((check) => `${check.label} passed in the current run.`);
    const pageChecks = SEO_RULE_DEFINITIONS.flatMap((rule) => {
        const groupedEvidence = new Map<string, SeoCheckRecord[]>();

        for (const record of seoScopedRecords.filter(rule.test)) {
            const pageInfo = extractSeoPageInfo(record.title, baseUrl);
            const existing = groupedEvidence.get(pageInfo.pageKey) ?? [];
            existing.push({
                title: record.title,
                browser: record.browser,
                status: record.status,
                remarks: record.remarks,
            });
            groupedEvidence.set(pageInfo.pageKey, existing);
        }

        return [...groupedEvidence.entries()].map(([pageKey, evidence]) => {
            const pageInfo = extractSeoPageInfo(evidence[0]?.title ?? "", baseUrl);
            const hasFailure = evidence.some(
                (record) => record.status === "Failed" || record.status === "Blocked"
            );
            const hasSuccess = evidence.some(
                (record) => record.status === "Passed" || record.status === "Flaky"
            );

            return {
                id: `${rule.id}:${pageKey}`,
                label: rule.label,
                description: rule.description,
                status: hasFailure
                    ? "failed"
                    : hasSuccess
                        ? "passed"
                        : "not-covered",
                evidence,
                pageKey,
                pageLabel: pageInfo.pageLabel,
            } satisfies SeoPageCheckSummary;
        });
    });
    const pageGroups = [...new Map(pageChecks.map((check) => [check.pageKey, check.pageLabel])).entries()].map(
        ([pageKey, pageLabel]) => {
            const checksForPage = pageChecks.filter((check) => check.pageKey === pageKey);
            return {
                pageKey,
                pageLabel,
                checks: checksForPage,
                findings: checksForPage
                    .filter((check) => check.status === "failed")
                    .map((check) => summarizeSeoCheckFailure(check)),
                strengths: checksForPage
                    .filter((check) => check.status === "passed")
                    .map((check) => `${check.label} passed for ${pageLabel}.`),
            } satisfies SeoPageGroup;
        }
    );
    const recommendations = pageGroups
        .flatMap((group) =>
            group.checks
                .filter((check) => check.status !== "passed")
                .map((check) => {
                    const rule = SEO_RULE_DEFINITIONS.find((item) => item.id === check.id.split(":")[0]);
                    if (!rule) {
                        return null;
                    }

                    return {
                        ...rule.recommendation,
                        pageKey: group.pageKey,
                        pageLabel: group.pageLabel,
                    } satisfies SeoRecommendation;
                })
                .filter((recommendation) => recommendation !== null)
        )
        .filter((recommendation, index, allRecommendations) =>
            allRecommendations.findIndex((candidate) =>
                candidate.title === recommendation.title && candidate.pageKey === recommendation.pageKey
            ) === index
        );

    return {
        requested: seoRequested,
        score,
        statusLabel: failedChecks > 0
            ? "Needs attention"
            : notCoveredChecks > 0
                ? "Partially covered"
                : "Healthy",
        passedChecks,
        failedChecks,
        notCoveredChecks,
        totalChecks: checks.length,
        checks,
        pageGroups,
        findings: findings.length > 0
            ? findings
            : ["No SEO-specific failures were produced in the current run."],
        strengths: strengths.length > 0
            ? strengths
            : ["Add explicit SEO checks to surface deterministic strengths in future runs."],
        recommendations: recommendations.length > 0
            ? recommendations
            : pageGroups.length > 0
                ? pageGroups.map((group) => ({
                    priority: "Low" as const,
                    title: "Keep the SEO audit in regression",
                    rationale: "Keep explicit SEO coverage in regression so metadata, schema, and crawler-facing behavior stay stable over time.",
                    pageKey: group.pageKey,
                    pageLabel: group.pageLabel,
                }))
                : [{
                    priority: "Low" as const,
                    title: "Keep the SEO audit in regression",
                    rationale: "The current run is healthy. Preserve these checks in regression so metadata, schema, and crawler files stay stable over time.",
                }],
    };
}
