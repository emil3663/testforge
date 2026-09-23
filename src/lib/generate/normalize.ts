import type {
    ActionableElementType,
    BestPracticeArea,
    CandidateJourney,
    ContentProfile,
    ContentRules,
    DependencyKind,
    DependencyMapEntry,
    InteractionCategory,
    LinkCategory,
    LinkDetail,
    SiteGraph,
    SiteGraphEdgeKind,
    StorageUsage,
    TestAuditMode,
} from "@/lib/generate/mock";
import { BEST_PRACTICE_OPTIONS } from "@/lib/generate/mock";

const DEPENDENCY_KINDS = new Set<string>([
    "xhr-fetch",
    "form-action",
    "third-party-script",
    "iframe",
    "redirect",
    "cookie",
]);

const SITE_GRAPH_EDGE_KINDS = new Set<string>(["link", "form-submit", "action"]);

// Only correct when TestForge is testing itself. For any other target
// (Plane on :80, test-assist on :4321, ...) the caller must supply baseUrl.
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
            selectedJourneyIds: [],
        };
    }

    const rules = input as Record<string, unknown>;
    return {
        paths: normalizePaths(rules.paths),
        requiredHeadings: normalizeStringList(rules.requiredHeadings),
        requiredText: normalizeStringList(rules.requiredText),
        forbiddenText: normalizeStringList(rules.forbiddenText),
        // Ids are matched exactly against ContentProfile.journeys, so unlike
        // the text lists above they are not whitespace-collapsed.
        selectedJourneyIds: Array.isArray(rules.selectedJourneyIds)
            ? [...new Set(rules.selectedJourneyIds.filter((id): id is string => typeof id === "string" && id.length > 0))]
            : [],
    };
}

// TFP-086: same re-validation rationale as normalizeDependencyMap below -
// storageUsage is a real behavioral-probe result computed server-side by
// inspectPages, not re-derived here. Absent/malformed input defaults every
// kind to false (no false positive coverage claim), never true.
function normalizeStorageUsage(input: unknown): StorageUsage {
    const usage = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
    return {
        localStorage: Boolean(usage.localStorage),
        sessionStorage: Boolean(usage.sessionStorage),
        indexedDB: Boolean(usage.indexedDB),
    };
}

// TFP-084: the dependency map is already fully aggregated server-side by
// inspectPages before it ever reaches the client - this just re-validates
// the round-tripped JSON the same way every other contentProfile field is
// re-validated, not re-deriving it.
function normalizeDependencyMap(input: unknown): DependencyMapEntry[] {
    if (!Array.isArray(input)) {
        return [];
    }

    return input
        .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
        .map((item) => {
            const kind: DependencyKind | null =
                typeof item.kind === "string" && DEPENDENCY_KINDS.has(item.kind)
                    ? (item.kind as DependencyKind)
                    : null;

            return {
                host: typeof item.host === "string" ? item.host.trim() : "",
                kind,
                sampleUrl: typeof item.sampleUrl === "string" ? item.sampleUrl.trim() : "",
                sameOrigin: Boolean(item.sameOrigin),
                method: typeof item.method === "string" ? item.method : null,
                rawValue: typeof item.rawValue === "string" ? item.rawValue : null,
                occurrences: typeof item.occurrences === "number" && item.occurrences > 0 ? item.occurrences : 1,
                paths: normalizeStringList(item.paths),
            };
        })
        .filter((item): item is DependencyMapEntry => item.kind !== null && Boolean(item.host));
}

// TFP-089: journeys are derived server-side from the graph; this only
// re-validates the round-tripped JSON. A journey whose steps don't line up
// with its page sequence is dropped rather than repaired.
function normalizeJourneys(input: unknown, graph: SiteGraph): CandidateJourney[] {
    if (!Array.isArray(input)) {
        return [];
    }

    return input.flatMap((item): CandidateJourney[] => {
        if (!item || typeof item !== "object") {
            return [];
        }

        const journey = item as Record<string, unknown>;
        const path = normalizeStringList(journey.path);
        const steps = graph.edges.length > 0 && Array.isArray(journey.steps)
            ? journey.steps.filter((step): step is Record<string, unknown> => !!step && typeof step === "object")
            : [];
        const known = new Set(graph.edges.map((edge) => [edge.from, edge.to, edge.kind, edge.rawValue, edge.text].join("\u0000")));
        const stepEdges = steps.map((step) => ({
            from: typeof step.from === "string" ? step.from : "",
            to: typeof step.to === "string" ? step.to : "",
            kind: (typeof step.kind === "string" && SITE_GRAPH_EDGE_KINDS.has(step.kind) ? step.kind : "link") as SiteGraphEdgeKind,
            text: typeof step.text === "string" ? step.text.replace(/\s+/g, " ").trim() : "",
            rawValue: typeof step.rawValue === "string" ? step.rawValue : "",
            tagName: typeof step.tagName === "string" ? step.tagName.trim() : "",
            attributeName: typeof step.attributeName === "string" ? step.attributeName.trim() : "",
            containerLabel: typeof step.containerLabel === "string" ? step.containerLabel.replace(/\s+/g, " ").trim() : "",
        }));
        const aligned = path.length >= 2 && stepEdges.length === path.length - 1 &&
            stepEdges.every((step, index) =>
                step.from === path[index] && step.to === path[index + 1] &&
                known.has([step.from, step.to, step.kind, step.rawValue, step.text].join("\u0000")));

        if (!aligned || typeof journey.id !== "string" || (journey.source !== "automatic" && journey.source !== "named")) {
            return [];
        }

        return [{
            id: journey.id,
            source: journey.source,
            label: typeof journey.label === "string" ? journey.label : null,
            path,
            steps: stepEdges,
            declaredExitPath: typeof journey.declaredExitPath === "string" ? journey.declaredExitPath : null,
            exitInGraph: Boolean(journey.exitInGraph),
            rank: typeof journey.rank === "number" && journey.rank > 0 ? journey.rank : 0,
        }];
    });
}

// TFP-088: like the dependency map, the graph is fully built server-side by
// inspectPages (it needs embeddedLinkDetails, which the round-tripped
// ContentProfile doesn't carry) - this only re-validates the JSON that came
// back through the client, and drops any edge whose endpoints aren't nodes.
function normalizeSiteGraph(input: unknown): SiteGraph {
    if (!input || typeof input !== "object") {
        return { nodes: [], edges: [] };
    }

    const graph = input as Record<string, unknown>;
    const records = (value: unknown) =>
        Array.isArray(value)
            ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
            : [];

    const nodes = records(graph.nodes)
        .map((item) => ({
            path: typeof item.path === "string" ? item.path.trim() : "",
            url: typeof item.url === "string" ? item.url.trim() : "",
            title: typeof item.title === "string" ? item.title.replace(/\s+/g, " ").trim() : "",
            inspected: Boolean(item.inspected),
        }))
        .filter((item) => item.path);
    const nodePaths = new Set(nodes.map((node) => node.path));

    const edges = records(graph.edges)
        .flatMap((item) => {
            const kind = typeof item.kind === "string" && SITE_GRAPH_EDGE_KINDS.has(item.kind)
                ? (item.kind as SiteGraphEdgeKind)
                : null;
            const from = typeof item.from === "string" ? item.from.trim() : "";
            const to = typeof item.to === "string" ? item.to.trim() : "";

            if (!kind || !nodePaths.has(from) || !nodePaths.has(to)) {
                return [];
            }

            return [{
                from,
                to,
                kind,
                text: typeof item.text === "string" ? item.text.replace(/\s+/g, " ").trim() : "",
                rawValue: typeof item.rawValue === "string" ? item.rawValue : "",
                tagName: typeof item.tagName === "string" ? item.tagName.trim() : "",
                attributeName: typeof item.attributeName === "string" ? item.attributeName.trim() : "",
                containerLabel: typeof item.containerLabel === "string" ? item.containerLabel.replace(/\s+/g, " ").trim() : "",
            }];
        });

    return { nodes, edges };
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
                            // TFP-055: ARIA state attributes are strings when present
                            // ("true"/"false" for pressed/selected/expanded, a token
                            // for checked's "mixed" state) - null means absent, not
                            // "false", so this must not coerce to boolean the way
                            // isVisible does.
                            ariaPressed: typeof item.ariaPressed === "string" ? item.ariaPressed : null,
                            ariaSelected: typeof item.ariaSelected === "string" ? item.ariaSelected : null,
                            ariaChecked: typeof item.ariaChecked === "string" ? item.ariaChecked : null,
                            ariaExpanded: typeof item.ariaExpanded === "string" ? item.ariaExpanded : null,
                            groupId: typeof item.groupId === "string" ? item.groupId : null,
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
            dragDropTargets: Array.isArray(page.dragDropTargets)
                ? page.dragDropTargets
                    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
                    .map((item) => ({
                        text: typeof item.text === "string" ? item.text.replace(/\s+/g, " ").trim() : "",
                        containerLabel:
                            typeof item.containerLabel === "string"
                                ? item.containerLabel.replace(/\s+/g, " ").trim()
                                : "",
                        isVisible: "isVisible" in item ? Boolean(item.isVisible) : true,
                        isDraggableSource: Boolean(item.isDraggableSource),
                        isDropTarget: Boolean(item.isDropTarget),
                        tagName: typeof item.tagName === "string" ? item.tagName.trim() : "",
                        id: typeof item.id === "string" ? item.id.trim() : "",
                        className: typeof item.className === "string" ? item.className.trim() : "",
                        ariaLabel: typeof item.ariaLabel === "string" ? item.ariaLabel.replace(/\s+/g, " ").trim() : "",
                    }))
                    .filter((item) => (item.isDraggableSource || item.isDropTarget) && item.tagName)
                : [],
            visibleTextSnippets: normalizeStringList(page.visibleTextSnippets),
            storageUsage: normalizeStorageUsage(page.storageUsage),
        }));

    const siteGraph = normalizeSiteGraph(profile.siteGraph);

    return {
        scannedAt: typeof profile.scannedAt === "string" ? profile.scannedAt : "",
        baseUrl: typeof profile.baseUrl === "string" ? profile.baseUrl : "",
        pages,
        warnings: normalizeStringList(profile.warnings),
        dependencyMap: normalizeDependencyMap(profile.dependencyMap),
        siteGraph,
        journeys: normalizeJourneys(profile.journeys, siteGraph),
    };
}
