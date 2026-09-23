/**
 * Golden-output regression test for actionable-elements' split (TFP-079,
 * Phase 27 loose ends).
 *
 * actionable-elements.ts (517 lines) was split along its 5 exported
 * functions into this directory (functional.ts, toggle-groups.ts,
 * accessibility.ts, usability.ts, action-pairs.ts), re-exported from
 * index.ts so the three importing files (demoqa-suites.ts,
 * generic-suites.ts, link-audits/index.ts) needed no import-path changes.
 *
 * This is a real extraction, not a rewrite, so it was verified per
 * behavior-preservation-verification before landing: the pre-split
 * actionable-elements.ts (at HEAD before this change) was run against the
 * frozen fixture below and its output captured; the same fixture was then
 * run against the post-split code and the two outputs were diffed and
 * hashed - `diff` exit 0, SHA-256
 * b9776890dcd8d9a8637601a5510997b80f3ffe09c1846d35d4f99957f92b447a on both
 * sides, 30096 bytes. __fixtures__/golden-output.json is that verified
 * output, committed so this test keeps proving it going forward, not just
 * once at split time.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/generate/mock/actionable-elements/index.test.ts
 */
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
    buildAccessibilityElementTests,
    buildActionableElementTests,
    buildActionPairTests,
    buildToggleGroupTests,
    buildUsabilityElementTests,
} from "./index.ts";
import type { ActionableElementDetail, ContentProfile } from "../types";

function element(overrides: Partial<Omit<ActionableElementDetail, "locator">> & { locator?: Partial<ActionableElementDetail["locator"]> }): ActionableElementDetail {
    return {
        text: "",
        url: null,
        category: "form",
        elementType: "button",
        containerLabel: "",
        expectedStatus: null,
        isVisible: true,
        ariaPressed: null,
        ariaSelected: null,
        ariaChecked: null,
        ariaExpanded: null,
        groupId: null,
        ...overrides,
        locator: {
            role: null,
            name: "",
            label: "",
            placeholder: "",
            id: "",
            inputType: "",
            ...(overrides.locator ?? {}),
        },
    } as ActionableElementDetail;
}

const mainPageElements: ActionableElementDetail[] = [
    element({ text: "Fetch status", category: "api", elementType: "link", url: "https://example.test/api/status", expectedStatus: 200, locator: { id: "status-link" } }),
    element({ text: "Old redirect", category: "api", elementType: "link", url: "https://example.test/old-path", expectedStatus: 301, locator: { id: "redirect-link" } }),
    element({ text: "Submit (hidden)", category: "api", elementType: "button", isVisible: false, locator: { id: "hidden-submit" } }),
    element({ text: "Save changes", category: "form", elementType: "button", locator: { id: "save-btn", label: "Save changes" } }),
    element({ text: "", category: "form", elementType: "form", locator: { id: "signup-form" } }),
    element({ text: "", category: "form", elementType: "input", locator: { label: "Email address", inputType: "email" } }),
    element({ text: "", category: "form", elementType: "input", isVisible: false, locator: { label: "Promo code" } }),
    element({ text: "", category: "form", elementType: "select", locator: { label: "Country" } }),
    element({ text: "", category: "form", elementType: "textarea", locator: { placeholder: "Leave a comment" } }),
    element({ text: "Learn more", category: "navigation", elementType: "link", url: "https://example.test/about", locator: {} }),
    element({ text: "Click here", category: "form", elementType: "button", locator: { label: "Click here" } }),
    element({ text: "Checkout", category: "form", elementType: "button", locator: { id: "checkout-btn", label: "Checkout" } }),
    element({ text: "Bold", category: "action", elementType: "button", groupId: "format-group", containerLabel: "Formatting toolbar", ariaPressed: "true", locator: { id: "bold-btn" } }),
    element({ text: "Italic", category: "action", elementType: "button", groupId: "format-group", containerLabel: "Formatting toolbar", locator: { id: "italic-btn" } }),
    element({ text: "Tab A", category: "navigation", elementType: "button", groupId: "tabs-group", containerLabel: "Section tabs", locator: { id: "tab-a" } }),
    element({ text: "Tab B", category: "navigation", elementType: "button", groupId: "tabs-group", containerLabel: "Section tabs", locator: { id: "tab-b" } }),
    element({ text: "Undo", category: "action", elementType: "button", locator: { id: "undo-btn" } }),
    element({ text: "Redo", category: "action", elementType: "button", locator: { id: "redo-btn" } }),
];

const fixtureContentProfile: ContentProfile = {
    scannedAt: "2026-01-01T00:00:00.000Z",
    baseUrl: "https://example.test",
    pages: [
        {
            path: "/",
            url: "https://example.test/",
            title: "Home",
            metaDescription: "",
            headings: [],
            buttons: [],
            links: [],
            actionableElements: mainPageElements,
            visibleTextSnippets: [],
        },
        {
            path: "/empty",
            url: "https://example.test/empty",
            title: "Empty",
            metaDescription: "",
            headings: [],
            buttons: [],
            links: [],
            actionableElements: [],
            visibleTextSnippets: [],
        },
    ],
};

test("actionable-elements split: output for the frozen fixture matches the verified pre-split golden output byte-for-byte", () => {
    const golden = JSON.parse(
        readFileSync(join(import.meta.dirname, "__fixtures__", "golden-output.json"), "utf8")
    );

    const actual = {
        buildActionableElementTests_main: buildActionableElementTests(fixtureContentProfile, "/"),
        buildActionableElementTests_empty: buildActionableElementTests(fixtureContentProfile, "/empty"),
        buildToggleGroupTests: buildToggleGroupTests(fixtureContentProfile, "/"),
        buildAccessibilityElementTests: buildAccessibilityElementTests(fixtureContentProfile, "/"),
        buildUsabilityElementTests: buildUsabilityElementTests(fixtureContentProfile, "/"),
        buildActionPairTests: buildActionPairTests(fixtureContentProfile, "/"),
    };

    assert.deepStrictEqual(actual, golden);
});
