import type { DependencyMapEntry, StorageUsage } from "@/lib/introspect/types";

export const BEST_PRACTICE_OPTIONS = [
    "functional",
    "responsive/mobile",
    "performance/load",
    "security",
    "accessibility",
    "usability",
    "seo/content",
    "cookie/session",
    "database",
    "reliability",
] as const;

export type BestPracticeArea = (typeof BEST_PRACTICE_OPTIONS)[number];
export type TestAuditMode = "fast" | "deep";

export type InteractionCategory = "navigation" | "api" | "form" | "action";
export type ActionableElementType = "link" | "button" | "input" | "select" | "textarea" | "form";
export type LinkCategory = "navigation" | "api";

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
    category: LinkCategory;
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

export interface GeneratedSuite {
    area: BestPracticeArea;
    title: string;
    tests: string[];
    notes?: string[];
}

export interface ContentRules {
    paths: string[];
    requiredHeadings: string[];
    requiredText: string[];
    forbiddenText: string[];
}

export interface ContentProfilePage {
    path: string;
    url: string;
    title: string;
    metaDescription: string;
    headings: string[];
    buttons: string[];
    links: string[];
    actionableElements?: ActionableElementDetail[];
    linkDetails?: LinkDetail[];
    dragDropTargets?: DragDropTargetDetail[];
    visibleTextSnippets: string[];
    storageUsage?: StorageUsage;
}

// TFP-084/086: re-exported from introspect/types.ts (not redeclared) so the
// generator, coverage, and persistence layers share the exact same shape
// inspectPages actually produces.
export type { DependencyKind, DependencyMapEntry, StorageKind, StorageUsage } from "@/lib/introspect/types";

export interface ContentProfile {
    scannedAt: string;
    baseUrl: string;
    pages: ContentProfilePage[];
    warnings?: string[];
    dependencyMap?: DependencyMapEntry[];
}
