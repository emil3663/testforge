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
    visibleTextSnippets: string[];
}
