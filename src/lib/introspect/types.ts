export type InteractionCategory = "navigation" | "api" | "form" | "action";
export type ActionableElementType = "link" | "button" | "input" | "select" | "textarea" | "form";

export interface LocatorHint {
    role: string | null;
    name: string;
    label: string;
    placeholder: string;
    id: string;
    inputType: string;
}

export interface ActionableElementDetail {
    text: string;
    url: string | null;
    category: InteractionCategory;
    elementType: ActionableElementType;
    containerLabel: string;
    expectedStatus: number | null;
    isVisible: boolean;
    ariaPressed: string | null;
    ariaSelected: string | null;
    ariaChecked: string | null;
    ariaExpanded: string | null;
    groupId: string | null;
    locator: LocatorHint;
}

export interface LinkDetail {
    text: string;
    url: string;
    rawHref: string;
    category: "navigation" | "api";
    linkType: "internal" | "external" | "anchor" | "mailto" | "download" | "inert";
    containerLabel: string;
    expectedStatus: number | null;
    isVisible: boolean;
    target: string;
    targetBehavior: "same-window" | "new-tab" | "new-window";
    titleAttribute: string;
    downloadName: string;
    requiresAuth: boolean;
    isSecure: boolean;
}

export interface EmbeddedLinkDetail {
    text: string;
    url: string;
    rawValue: string;
    tagName: string;
    attributeName: string;
    kind: "iframe" | "frame" | "image" | "script" | "stylesheet" | "media" | "document" | "form" | "button" | "data" | "interactive";
    source: "dom" | "heuristic";
    containerLabel: string;
    sameOrigin: boolean;
    isVisible: boolean;
}

// TFP-061: a drag source or drop target. isDropTarget can't be detected by
// attribute presence alone - most real apps (test-assist included) wire
// dragover/drop via addEventListener rather than inline ondragover=/ondrop=
// attributes, which an attribute-only scan (the [onclick] scan's pattern)
// would miss entirely. isDropTarget is instead confirmed by dispatching a
// synthetic, side-effect-free 'dragover' event and checking whether a
// listener called preventDefault() on it - the same signal the browser
// itself uses to decide whether an element accepts drops.
export interface DragDropTargetDetail {
    text: string;
    containerLabel: string;
    isVisible: boolean;
    isDraggableSource: boolean;
    isDropTarget: boolean;
    tagName: string;
    id: string;
    className: string;
    ariaLabel: string;
}

// TFP-086: which storage entry points a page's own scripts actually touched,
// determined by a real behavioral probe during introspect (an instrumented
// getter/wrapper the page's real code runs through, not a static source
// grep) - see inspector.ts's addInitScript instrumentation.
export type StorageKind = "localStorage" | "sessionStorage" | "indexedDB";
export type StorageUsage = Record<StorageKind, boolean>;

export interface PageSnapshot {
    path: string;
    url: string;
    title: string;
    metaDescription: string;
    headings: string[];
    buttons: string[];
    links: string[];
    actionableElements: ActionableElementDetail[];
    linkDetails: LinkDetail[];
    embeddedLinkDetails: EmbeddedLinkDetail[];
    dragDropTargets: DragDropTargetDetail[];
    visibleTextSnippets: string[];
    storageUsage: StorageUsage;
}

// TFP-084: a single outbound dependency observed for one page, before
// per-baseUrl aggregation. "third-party-script"/"iframe"/"form-action" come
// from the existing DOM-level embeddedLinkDetails scan (already read-only);
// "xhr-fetch"/"redirect"/"cookie" require real Playwright-level observation
// during the page's own natural load - none of these trigger any additional
// navigation or submission beyond what inspectPages already does.
export type DependencyKind =
    | "xhr-fetch"
    | "form-action"
    | "third-party-script"
    | "iframe"
    | "redirect"
    | "cookie";

export interface DependencyDetail {
    kind: DependencyKind;
    host: string;
    url: string;
    sameOrigin: boolean;
    method: string | null;
    // The raw, unresolved DOM attribute value (e.g. a <form>'s literal
    // action="/authenticate") for form-action/third-party-script/iframe
    // entries - lets a generated test locate and actually trigger the real
    // element (TFP-085's form-action test needs this to submit the form it
    // blocked, not just reload the page). Null for network-observed kinds
    // (xhr-fetch/redirect/cookie) with no corresponding DOM attribute.
    rawValue: string | null;
}

// One row per distinct (host, kind) pair across every page introspected for
// a baseUrl - the per-site model TFP-084 extends from
// buildDiscoveredCoverageMatrix's own per-site aggregation shape.
export interface DependencyMapEntry {
    host: string;
    kind: DependencyKind;
    sampleUrl: string;
    sameOrigin: boolean;
    method: string | null;
    rawValue: string | null;
    occurrences: number;
    paths: string[];
}

// TFP-088: the walkable site graph. Nodes are pages (the introspected pages
// plus any same-origin page an introspected page's elements lead to); edges
// are the specific element on one page that navigates to another. Composed
// entirely from data inspectPages already captures - no extra crawl pass.
//
// "link" is an <a href>; "form-submit" is a <form action> or a button's
// formaction (the action is only known when the DOM declares it - a
// JS-driven form with no action attribute can't be resolved without
// actually submitting it, which introspect never does); "action" is any
// other DOM-declared navigation (onclick location assignment, data-href,
// routerlink, ...).
export type SiteGraphEdgeKind = "link" | "form-submit" | "action";

export interface SiteGraphNode {
    path: string;
    url: string;
    title: string;
    // False for a page only known as the target of another page's element -
    // its own outgoing edges were never introspected, so it can end a walk
    // but not extend one.
    inspected: boolean;
}

export interface SiteGraphEdge {
    from: string;
    to: string;
    kind: SiteGraphEdgeKind;
    // The element's visible label, and the raw attribute value it navigates
    // by (href / action / formaction / ...), so a generated test can locate
    // and actually use the real element rather than a guess at it.
    text: string;
    rawValue: string;
    tagName: string;
    containerLabel: string;
}

export interface SiteGraph {
    nodes: SiteGraphNode[];
    edges: SiteGraphEdge[];
}

// TFP-089: a config-named flow (Decision 4). exitPath doesn't have to be a
// graph node - see Decision 4's amendment: it may sit beyond the flow's
// last form-submit, where only TFP-091's real submission can verify it.
export interface NamedFlow {
    label: string;
    entryPath: string;
    exitPath: string;
}

export type JourneySource = "automatic" | "named";

// One ranked, reviewable journey. `path` is the page sequence; `steps[i]` is
// the actual element that navigates path[i] -> path[i + 1], so a generated
// test (TFP-091) can locate and use it rather than assume the connection.
export interface CandidateJourney {
    // Stable across recomputation for the same graph and flows, so a
    // selection made on the review screen (TFP-090) can refer to it.
    id: string;
    source: JourneySource;
    label: string | null;
    path: string[];
    steps: SiteGraphEdge[];
    // Named flows only. exitInGraph is true when the graph itself reaches
    // exitPath (path ends there); false when exitPath is declared but
    // unverified - the path stops at the flow's last form-submit and
    // TFP-091 verifies the exit by actually submitting.
    declaredExitPath: string | null;
    exitInGraph: boolean;
    rank: number;
}
