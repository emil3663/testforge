import { escapeForSingleQuotedString } from "./format";
import { buildDragDropLocatorExpression, findMatchingProfilePage, getDragDropTargetDisplayName } from "./locators";
import type { ContentProfile } from "./types";

// A minimal, structurally valid 1x1 transparent PNG - small enough to
// inline, and a real image (not just image-typed bytes), so a handler
// that actually decodes the dropped file (not just checks its MIME type)
// still succeeds.
const VALID_PNG_BASE64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4AWNgAAAAAgABc3UBGAAAAABJRU5ErkJggg==";

/**
 * TFP-061: generates one drag-and-drop test per detected drop target -
 * valid content dispatched via the same dragover+drop DragEvent sequence
 * real browsers fire (see test-assist's own dropFile test helper, which
 * this mirrors), asserting no uncaught page error and some observable DOM
 * change; invalid content (wrong MIME type), asserting only "no crash" -
 * a generic app may correctly do nothing with unrecognized content, which
 * is not a failure to assert against, unlike an uncaught exception.
 */
export function buildDragDropTests(
    contentProfile: ContentProfile | null,
    path = "/"
) {
    const matchingPage = findMatchingProfilePage(contentProfile, path);
    const dropTargets = (matchingPage?.dragDropTargets ?? [])
        .filter((target) => target.isDropTarget && target.isVisible)
        .slice(0, 10);
    const escapedPath = escapeForSingleQuotedString(path);
    const tests: string[] = [];

    for (const target of dropTargets) {
        const name = escapeForSingleQuotedString(getDragDropTargetDisplayName(target));
        const locatorExpression = buildDragDropLocatorExpression(target);

        tests.push(`  test('drag and drop: valid content dropped onto ${name} produces an observable change', async ({ page }) => {
    await page.goto('${escapedPath}');
    await page.waitForLoadState('domcontentloaded');

    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => pageErrors.push(error));

    const target = ${locatorExpression};
    const beforeHtml = await page.evaluate(() => document.body.innerHTML.length);

    await target.evaluate((element, base64) => {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const file = new File([bytes], 'testforge-drop-fixture.png', { type: 'image/png' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      element.dispatchEvent(new DragEvent('dragover', { dataTransfer, bubbles: true, cancelable: true }));
      element.dispatchEvent(new DragEvent('drop', { dataTransfer, bubbles: true, cancelable: true }));
    }, '${VALID_PNG_BASE64}');

    const afterHtml = await page.evaluate(() => document.body.innerHTML.length);

    expect(pageErrors, 'dropping valid content onto ${name} raised an uncaught page error: ' + pageErrors.map((error) => error.message).join('; ')).toHaveLength(0);
    expect(afterHtml, 'dropping valid content onto ${name} produced no observable DOM change').not.toBe(beforeHtml);
  });`);

        tests.push(`  test('drag and drop: invalid content dropped onto ${name} does not crash the page', async ({ page }) => {
    await page.goto('${escapedPath}');
    await page.waitForLoadState('domcontentloaded');

    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => pageErrors.push(error));

    const target = ${locatorExpression};

    await target.evaluate((element) => {
      const file = new File(['not an image'], 'testforge-drop-fixture.txt', { type: 'text/plain' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      element.dispatchEvent(new DragEvent('dragover', { dataTransfer, bubbles: true, cancelable: true }));
      element.dispatchEvent(new DragEvent('drop', { dataTransfer, bubbles: true, cancelable: true }));
    });

    await expect(target).toBeAttached();
    expect(pageErrors, 'dropping invalid content onto ${name} raised an uncaught page error: ' + pageErrors.map((error) => error.message).join('; ')).toHaveLength(0);
  });`);
    }

    return tests;
}
