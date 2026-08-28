import { buildActionableElementTests } from "../actionable-elements";
import { escapeForSingleQuotedString } from "../format";
import { findMatchingProfilePage, selectBrowserInteractionLinks } from "../locators";
import type { BestPracticeArea, ContentProfile, TestAuditMode } from "../types";
import { buildLinkCoverageTests } from "./coverage-tests";
import { buildLinkDetailTests } from "./detail-tests";
import { buildLinkExperienceTests } from "./experience-tests";
import { buildBrowserInteractionLinkTests } from "./interaction-tests";

const FAST_LINK_AUDIT_TIMEOUT_MS = 4000;
const DEEP_LINK_AUDIT_TIMEOUT_MS = 15000;

export function buildTestMyLinksAuditTests(
    contentProfile: ContentProfile | null,
    path = "/",
    options: {
        auditMode: TestAuditMode;
        areas: BestPracticeArea[];
    }
) {
    const matchingPage = findMatchingProfilePage(contentProfile, path);

    const linkDetails = (matchingPage?.linkDetails ?? []).filter(
        (link, index, allLinks) =>
            allLinks.findIndex(
                (candidate) =>
                    candidate.rawHref === link.rawHref &&
                    candidate.url === link.url &&
                    candidate.text === link.text &&
                    candidate.containerLabel === link.containerLabel
            ) === index
    );

    if (linkDetails.length === 0) {
        return buildActionableElementTests(contentProfile, path);
    }

    const escapedPath = escapeForSingleQuotedString(path);
    const httpLinks = linkDetails.filter((link) => ["internal", "external", "download"].includes(link.linkType));
    const anchorLinks = linkDetails.filter((link) => link.linkType === "anchor");
    const secureLinks = httpLinks.filter((link) => link.isSecure);
    const nonApiLinks = linkDetails.filter((link) => link.category !== "api");
    const browserInteractionLinks = selectBrowserInteractionLinks(linkDetails, options.auditMode);
    const interactionMailtoLinks = browserInteractionLinks.filter((link) => link.linkType === "mailto");
    const interactionDownloadLinks = browserInteractionLinks.filter((link) => link.linkType === "download");
    const interactionPopupLinks = browserInteractionLinks.filter((link) => link.targetBehavior !== "same-window");
    const interactionProtectedLinks = browserInteractionLinks.filter((link) => link.requiresAuth && link.linkType === "internal");
    const interactionNonApiLinks = selectBrowserInteractionLinks(nonApiLinks, options.auditMode);
    const includeUsabilityLinkAudits = options.areas.includes("usability");
    const includeAccessibilityLinkAudits = options.areas.includes("accessibility");
    const isFastLinkAudit = options.auditMode === "fast";
    const linkAuditTimeoutMs = isFastLinkAudit ? FAST_LINK_AUDIT_TIMEOUT_MS : DEEP_LINK_AUDIT_TIMEOUT_MS;
    const allLinkPayload = JSON.stringify(linkDetails);
    const escapedCurrentPageUrl = escapeForSingleQuotedString(matchingPage?.url ?? `http://localhost${path}`);
    const scannedPages = contentProfile?.pages.map((page) => ({
        path: page.path,
        url: page.url,
        inboundCandidates: (page.linkDetails ?? []).map((link) => link.url),
    })) ?? [];

    const tests: string[] = [];

    tests.push(
        ...buildBrowserInteractionLinkTests(browserInteractionLinks, escapedPath, isFastLinkAudit, linkAuditTimeoutMs)
    );

    tests.push(
        ...buildLinkCoverageTests(
            escapedPath,
            linkAuditTimeoutMs,
            allLinkPayload,
            interactionNonApiLinks,
            isFastLinkAudit,
            escapedCurrentPageUrl
        )
    );

    tests.push(
        ...buildLinkDetailTests(
            escapedPath,
            linkAuditTimeoutMs,
            isFastLinkAudit,
            interactionMailtoLinks,
            interactionDownloadLinks,
            interactionPopupLinks,
            interactionProtectedLinks
        )
    );

    tests.push(
        ...buildLinkExperienceTests(
            escapedPath,
            includeUsabilityLinkAudits,
            includeAccessibilityLinkAudits,
            interactionNonApiLinks,
            allLinkPayload,
            secureLinks,
            anchorLinks,
            scannedPages
        )
    );

    return tests;
}
