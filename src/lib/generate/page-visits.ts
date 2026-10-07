/**
 * TFP-167 (approved by Emil, 2026-10-06): every page visit in a generated
 * test waits for the page to draw. A single-page app (Angular, React, Vue)
 * draws its content after the HTML arrives, so a check run at
 * `domcontentloaded` or `load` read a header-and-footer shell: on the
 * Toolshop (TFP-154) the form checks failed falsely (T25) and the product
 * page's own bugs went unread.
 *
 * One helper takes every visit:
 * - a hash route loads as a fresh document, as the crawl loads it (TFP-165),
 *   so the wait below isn't over before it starts;
 * - the page loads as the test asked (its own `waitUntil`, if any);
 * - then the network must go quiet, for at most 5 s, as the crawl waits.
 *   The wait never fails a test: a page that keeps polling is checked as it
 *   is after 5 s.
 *
 * Rejected: waiting for a known element - a generated test can't know each
 * app's markers in advance.
 */
export const PAGE_VISIT_WAIT_MS = 5000;

export const PAGE_VISIT_HELPER = `// TFP-167: every page visit waits for the page to draw - the network quiet, at most ${PAGE_VISIT_WAIT_MS / 1000} s,
// never failing the test for the wait - as the crawl does. A hash route (#/...) loads as a fresh document.
async function tfGoto(page: import('@playwright/test').Page, url: string, options?: Parameters<import('@playwright/test').Page['goto']>[1]) {
  if (/#!?\\//.test(url)) await page.goto('about:blank').catch(() => null);
  const response = await page.goto(url, options);
  await page.waitForLoadState('networkidle', { timeout: ${PAGE_VISIT_WAIT_MS} }).catch(() => {});
  return response;
}`;

/**
 * Routes every `page.goto(...)` in a generated suite through the helper and
 * adds it once after `test.use(...)`. The call's arguments are kept as they
 * were, so the only lines that change are the visits and the helper itself.
 */
export function routePageVisits(code: string) {
    if (!/\bpage\.goto\(/.test(code)) {
        return code;
    }
    const routed = code.replace(/\bpage\.goto\(/g, "tfGoto(page, ");
    const afterUse = routed.replace(/^(test\.use\(\{ baseURL: [^\n]*\);\n)/m, `$1\n${PAGE_VISIT_HELPER}\n`);
    return afterUse !== routed
        ? afterUse
        : routed.replace(/^(import \{ test, expect \} from '@playwright\/test';\n)/m, `$1\n${PAGE_VISIT_HELPER}\n`);
}
