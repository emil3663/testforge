/**
 * CSS-selector locators written into generated code (Phase 34, found while
 * building TFP-117). Values were escaped for the CSS string only, then written
 * into a single-quoted JS string: a value containing ' broke the generated
 * code, and every backslash was halved. quoteSelector (format.ts) now escapes
 * the whole selector for the JS string as well.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/generate/mock/locators.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";
import type { ActionableElementDetail, DragDropTargetDetail, LinkDetail } from "./types.ts";

const { buildLocatorExpression, buildDragDropLocatorExpression, buildLinkLocatorExpression } = await import("./locators.ts");
const { findTypeErrors } = await import("../validate.ts");

// Phase 36 (TFP-125): tests that need a real browser skip, with the reason,
// where Playwright's Chromium is not installed.
const { chromiumSkipReason } = await import("../../../test-support/chromium.ts");
const needsChromium = await chromiumSkipReason();

const AWKWARD = [`it's`, "back\\slash", "note.body", "form:note", `"quoted"`];

function element(id: string): ActionableElementDetail {
    return {
        text: "", url: null, category: "action", elementType: "button", containerLabel: "", expectedStatus: null, isVisible: true,
        ariaPressed: null, ariaSelected: null, ariaChecked: null, ariaExpanded: null, groupId: null,
        locator: { role: null, name: "", label: "", placeholder: "", id, inputType: "" },
    };
}

function dragTarget(fields: Partial<DragDropTargetDetail>): DragDropTargetDetail {
    return { tagName: "div", id: "", className: "", ariaLabel: "", text: "", ...fields } as DragDropTargetDetail;
}

function link(rawHref: string): LinkDetail {
    return { text: "", url: `http://127.0.0.1/${rawHref}`, rawHref } as LinkDetail;
}

test("plain values produce exactly the same locator as before", () => {
    assert.equal(buildLocatorExpression(element("save")), `page.locator('[id="save"]').first()`);
    assert.equal(buildDragDropLocatorExpression(dragTarget({ id: "drop" })), `page.locator('[id="drop"]').first()`);
    assert.equal(buildDragDropLocatorExpression(dragTarget({ className: "canvas-wrap", tagName: "main" })), `page.locator('main[class~="canvas-wrap"]').first()`);
    // TFP-123: a link also counts as rendered when only its content renders.
    assert.equal(buildLinkLocatorExpression(link("/about")), `page.locator('a[href="/about"]:visible, a[href="/about"]:has(:visible)').first()`);
});

test("awkward ids, classes and hrefs compile and select exactly the right element in a real browser", { skip: needsChromium }, async () => {
    const { chromium } = await import("@playwright/test");
    const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        await page.setContent(
            AWKWARD.map((v, i) => `<button id="${escapeHtml(v)}">b${i}</button><div class="${escapeHtml(v)} other">d${i}</div><a href="${escapeHtml(v)}">a${i}</a>`).join("\n")
        );
        for (const [i, value] of AWKWARD.entries()) {
            const cases: Array<[string, string]> = [
                [buildLocatorExpression(element(value)), `b${i}`],
                [buildDragDropLocatorExpression(dragTarget({ id: "", className: value, tagName: "div" })), `d${i}`],
                [buildLinkLocatorExpression(link(value)), `a${i}`],
            ];
            for (const [expression, expected] of cases) {
                assert.deepEqual(findTypeErrors(`import { test } from '@playwright/test';\ntest('t', async ({ page }) => { await ${expression}.click(); });`), [], expression);
                const locator = new Function("page", `return ${expression};`)(page);
                assert.equal(await locator.count(), 1, `${JSON.stringify(value)}: ${expression} should match one element`);
                assert.equal(await locator.textContent(), expected, `${JSON.stringify(value)}: ${expression} matched the wrong element`);
            }
        }
    } finally {
        await browser.close();
    }
});
