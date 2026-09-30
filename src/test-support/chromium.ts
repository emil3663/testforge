import { existsSync } from "node:fs";

/**
 * Phase 36 (TFP-125, Decision 3): unit tests that need a real browser skip,
 * with this reason, where Playwright's Chromium is not installed - instead of
 * failing for a reason that has nothing to do with the code under test.
 * Returns false when Chromium is there, so it can be passed straight to
 * node:test's `skip` option.
 *
 *   const needsChromium = await chromiumSkipReason();
 *   test("...", { skip: needsChromium }, async () => { ... });
 */
export async function chromiumSkipReason(): Promise<string | false> {
    try {
        const { chromium } = await import("@playwright/test");
        const path = chromium.executablePath();
        return existsSync(path) ? false : `needs a real browser, and Playwright's Chromium is not installed (expected at ${path}); install it with: npx playwright install chromium`;
    } catch (error) {
        return `needs a real browser, and Playwright's Chromium could not be located: ${error instanceof Error ? error.message : String(error)}`;
    }
}
