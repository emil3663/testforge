import { Chevron } from "@/app/_components/Chevron";
import { getEmbeddedPreviewLabel, getLinkPreviewLabel } from "@/app/_lib/derive";
import type { ContentProfile, TestAuditMode } from "@/app/_lib/types";

interface DiscoveredLinkGroup {
    title: string;
    links: NonNullable<ContentProfile["pages"][number]["linkDetails"]>;
}

interface ContentRulesSectionProps {
    isContentRulesCollapsed: boolean;
    setIsContentRulesCollapsed: (updater: (value: boolean) => boolean) => void;
    contentAwareRequested: boolean;
    isContentAwareReady: boolean;
    contentProfile: ContentProfile | null;
    discoveredLinkCount: number;
    auditMode: TestAuditMode;
    discoveredEmbeddedLinkCount: number;
    discoveredLinkPages: { path: string; count: number }[];
    discoveredEmbeddedLinkPages: { path: string; count: number }[];
    displayedDiscoveredLinks: NonNullable<ContentProfile["pages"][number]["linkDetails"]>;
    discoveredLinkGroups: DiscoveredLinkGroup[];
    displayedDiscoveredEmbeddedLinks: NonNullable<ContentProfile["pages"][number]["embeddedLinkDetails"]>;
    contentPathsInput: string;
    setContentPathsInput: (value: string) => void;
    requiredHeadingsInput: string;
    setRequiredHeadingsInput: (value: string) => void;
    requiredTextInput: string;
    setRequiredTextInput: (value: string) => void;
    forbiddenTextInput: string;
    setForbiddenTextInput: (value: string) => void;
}

export function ContentRulesSection({
    isContentRulesCollapsed,
    setIsContentRulesCollapsed,
    contentAwareRequested,
    isContentAwareReady,
    contentProfile,
    discoveredLinkCount,
    auditMode,
    discoveredEmbeddedLinkCount,
    discoveredLinkPages,
    discoveredEmbeddedLinkPages,
    displayedDiscoveredLinks,
    discoveredLinkGroups,
    displayedDiscoveredEmbeddedLinks,
    contentPathsInput,
    setContentPathsInput,
    requiredHeadingsInput,
    setRequiredHeadingsInput,
    requiredTextInput,
    setRequiredTextInput,
    forbiddenTextInput,
    setForbiddenTextInput,
}: ContentRulesSectionProps) {
    return (
                        <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-4">
                            <button
                                type="button"
                                onClick={() => setIsContentRulesCollapsed((value) => !value)}
                                aria-expanded={!isContentRulesCollapsed}
                                aria-controls="content-rules-panel"
                                className="flex w-full items-center justify-between gap-3 text-left"
                            >
                                <div>
                                    <div className="text-sm font-medium text-zinc-700">
                                        Content Rules
                                    </div>
                                    <p className="mt-1 text-xs leading-5 text-zinc-500">
                                        Inspect the page before generation and turn these content expectations into explicit assertions.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                                        Content-aware generation
                                    </span>
                                    <Chevron collapsed={isContentRulesCollapsed} />
                                </div>
                            </button>
                            {!isContentRulesCollapsed && (
                                <div id="content-rules-panel">
                                    <div className="mt-3 rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs leading-5 text-zinc-500">
                                        {contentAwareRequested
                                            ? isContentAwareReady
                                                ? "Content-aware inputs are synced with the generated suite."
                                                : "Content-aware inputs changed. Regenerate the suite before running tests."
                                            : "Leave these fields empty if you only want URL and flow-based tests."}
                                    </div>

                                    {contentProfile && (
                                        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <div>
                                                    <div className="text-sm font-semibold text-emerald-950">
                                                        Inspection Summary
                                                    </div>
                                                    <p className="mt-1 text-xs leading-5 text-emerald-800">
                                                        {discoveredLinkCount > 0
                                                            ? auditMode === "deep"
                                                                ? `${discoveredLinkCount} unique link${discoveredLinkCount === 1 ? "" : "s"} discovered and available for generated link tests.`
                                                                : `${discoveredLinkCount} visible link${discoveredLinkCount === 1 ? "" : "s"} discovered and shown for fast testing.`
                                                            : auditMode === "deep"
                                                                ? "No link metadata was discovered in the latest inspection."
                                                                : "No visible links were discovered in the latest inspection for fast testing."}
                                                    </p>
                                                    {auditMode === "deep" && (
                                                        <p className="mt-1 text-xs leading-5 text-emerald-800">
                                                            {discoveredEmbeddedLinkCount > 0
                                                                ? `${discoveredEmbeddedLinkCount} embedded target${discoveredEmbeddedLinkCount === 1 ? "" : "s"} discovered across frames, assets, forms, and runtime-style attributes.`
                                                                : "No embedded targets were discovered in the latest inspection."}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="rounded-full border border-emerald-300 bg-white px-3 py-1 text-xs font-semibold text-emerald-800">
                                                    {contentProfile.pages.length} page{contentProfile.pages.length === 1 ? "" : "s"} inspected
                                                </div>
                                            </div>

                                            {discoveredLinkPages.length > 0 && (
                                                <div className="mt-3 flex flex-wrap gap-2 text-xs text-emerald-900">
                                                    {discoveredLinkPages.map((page) => (
                                                        <span
                                                            key={page.path}
                                                            className="rounded-full border border-emerald-200 bg-white px-3 py-1"
                                                        >
                                                            {page.path}: {page.count} link{page.count === 1 ? "" : "s"}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            {discoveredEmbeddedLinkPages.length > 0 && (
                                                <div className="mt-3 flex flex-wrap gap-2 text-xs text-emerald-900">
                                                    {discoveredEmbeddedLinkPages.map((page) => (
                                                        <span
                                                            key={`${page.path}-embedded`}
                                                            className="rounded-full border border-emerald-200 bg-white px-3 py-1"
                                                        >
                                                            {page.path}: {page.count} embedded target{page.count === 1 ? "" : "s"}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            {displayedDiscoveredLinks.length > 0 && (
                                                <div className="mt-4">
                                                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                                                        {auditMode === "deep" ? "Discovered Links" : "Visible Links For Fast Testing"}
                                                    </div>
                                                    <div className="mt-2 space-y-3">
                                                        {discoveredLinkGroups.map((group) => (
                                                            <div key={group.title} className="rounded-2xl border border-emerald-200 bg-white">
                                                                <div className="border-b border-emerald-100 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                                                                    {group.title}
                                                                </div>
                                                                <div className="px-4 py-2 text-[11px] leading-5 text-zinc-600">
                                                                    Links found: {group.links.map((link) => getLinkPreviewLabel(link)).join(", ")}
                                                                </div>
                                                                <div className="max-h-56 overflow-y-auto divide-y divide-emerald-100">
                                                                    {group.links.map((link, index) => (
                                                                        <div key={`${group.title}-${link.url}-${index}`} className="px-4 py-3 text-xs leading-5 text-emerald-950">
                                                                            <div className="font-medium text-zinc-900">
                                                                                {getLinkPreviewLabel(link)}
                                                                            </div>
                                                                            <div className="mt-1 text-zinc-600">
                                                                                {link.category === "api" ? "API" : "Navigation"}
                                                                                {link.linkType ? ` • ${link.linkType}` : ""}
                                                                                {link.targetBehavior === "new-tab" || link.targetBehavior === "new-window"
                                                                                    ? " • opens new tab"
                                                                                    : " • same tab"}
                                                                                {link.isVisible === false ? " • hidden" : " • visible"}
                                                                                {link.containerLabel ? ` • ${link.containerLabel}` : ""}
                                                                            </div>
                                                                            <div className="mt-1 break-all text-zinc-500">
                                                                                {link.url}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {displayedDiscoveredEmbeddedLinks.length > 0 && (
                                                <div className="mt-4">
                                                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                                                        Embedded Targets
                                                    </div>
                                                    <div className="mt-2 max-h-56 overflow-y-auto rounded-2xl border border-emerald-200 bg-white">
                                                        <div className="divide-y divide-emerald-100">
                                                            {displayedDiscoveredEmbeddedLinks.map((embeddedLink, index) => (
                                                                <div key={`${embeddedLink.url}-${embeddedLink.attributeName}-${index}`} className="px-4 py-3 text-xs leading-5 text-emerald-950">
                                                                    <div className="font-medium text-zinc-900">
                                                                        {getEmbeddedPreviewLabel(embeddedLink)}
                                                                    </div>
                                                                    <div className="mt-1 text-zinc-600">
                                                                        {embeddedLink.kind} • {embeddedLink.tagName}[{embeddedLink.attributeName}] • {embeddedLink.source}
                                                                        {embeddedLink.containerLabel ? ` • ${embeddedLink.containerLabel}` : ""}
                                                                    </div>
                                                                    <div className="mt-1 text-zinc-500">
                                                                        {embeddedLink.sameOrigin ? "Same origin" : "Cross origin or external"}
                                                                        {embeddedLink.isVisible ? " • visible" : " • non-visible"}
                                                                    </div>
                                                                    <div className="mt-1 break-all text-zinc-500">
                                                                        {embeddedLink.url}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                                        <div className="space-y-1.5">
                                            <label htmlFor="content-paths-input" className="block text-sm font-medium text-zinc-700">
                                                Paths to inspect
                                            </label>
                                            <textarea
                                                id="content-paths-input"
                                                aria-label="Paths to inspect"
                                                rows={4}
                                                value={contentPathsInput}
                                                onChange={(event) => setContentPathsInput(event.target.value)}
                                                placeholder="Leave blank to inspect the exact page in Base URL, or add paths like /pricing and /about"
                                                className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label htmlFor="required-headings-input" className="block text-sm font-medium text-zinc-700">
                                                Required headings
                                            </label>
                                            <textarea
                                                id="required-headings-input"
                                                aria-label="Required headings"
                                                rows={4}
                                                value={requiredHeadingsInput}
                                                onChange={(event) => setRequiredHeadingsInput(event.target.value)}
                                                placeholder="Welcome\nPricing\nFrequently Asked Questions"
                                                className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label htmlFor="required-text-input" className="block text-sm font-medium text-zinc-700">
                                                Required text snippets
                                            </label>
                                            <textarea
                                                id="required-text-input"
                                                aria-label="Required text snippets"
                                                rows={4}
                                                value={requiredTextInput}
                                                onChange={(event) => setRequiredTextInput(event.target.value)}
                                                placeholder="Start free trial\nContact sales"
                                                className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label htmlFor="forbidden-text-input" className="block text-sm font-medium text-zinc-700">
                                                Forbidden text snippets
                                            </label>
                                            <textarea
                                                id="forbidden-text-input"
                                                aria-label="Forbidden text snippets"
                                                rows={4}
                                                value={forbiddenTextInput}
                                                onChange={(event) => setForbiddenTextInput(event.target.value)}
                                                placeholder="Lorem ipsum\nComing soon"
                                                className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
    );
}
