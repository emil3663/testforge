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
}
