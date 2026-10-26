/**
 * TFP-167 (owner decision, 2026-10-06): every page visit in a generated
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

const PAGE_GOTO = /\bpage\.goto\(/g;
const IMPORT_START = /^import\b/;
const IMPORT_END = /(from\s+['"][^'"]+['"]|^import\s+['"][^'"]+['"])\s*;?\s*$/;

/**
 * Routes every `page.goto(...)` in a generated suite through the helper and
 * adds it once after `test.use(...)`. The call's arguments are kept as they
 * were, so the only lines that change are the visits and the helper itself.
 *
 * TFP-168: safe to run again on a suite that already has the helper - a
 * template suite with the local model's code added to it. Every visit
 * outside the helper's own body is routed, and the helper stays once. A
 * suite whose imports aren't the template's line (OpenAI's own) gets the
 * helper after its last import.
 */
export function routePageVisits(code: string) {
    const route = (part: string) => part.replace(PAGE_GOTO, "tfGoto(page, ");
    const helperAt = code.indexOf(PAGE_VISIT_HELPER);
    if (helperAt >= 0) {
        // The helper's own page.goto calls stay; everything around it is routed.
        return route(code.slice(0, helperAt)) + PAGE_VISIT_HELPER + route(code.slice(helperAt + PAGE_VISIT_HELPER.length));
    }
    // A helper of another shape is left alone rather than routed into calling itself.
    if (!/\bpage\.goto\(/.test(code) || code.includes("async function tfGoto(")) {
        return code;
    }
    const routed = route(code);
    const afterUse = routed.replace(/^(test\.use\(\{ baseURL: [^\n]*\);\n)/m, `$1\n${PAGE_VISIT_HELPER}\n`);
    if (afterUse !== routed) return afterUse;
    const afterImport = routed.replace(/^(import \{ test, expect \} from '@playwright\/test';\n)/m, `$1\n${PAGE_VISIT_HELPER}\n`);
    if (afterImport !== routed) return afterImport;
    // TFP-168: any other imports (double quotes, more names, several lines): the helper goes after the last one.
    const lines = routed.split("\n");
    let lastImport = -1;
    let inImport = false;
    lines.forEach((line, index) => {
        if (inImport || IMPORT_START.test(line)) {
            inImport = !IMPORT_END.test(line);
            lastImport = index;
        }
    });
    lines.splice(lastImport + 1, 0, "", PAGE_VISIT_HELPER, "");
    return lines.join("\n");
}

/**
 * TFP-168: code added to a finished suite (the local model's block, its
 * Comprehensive scenarios) routes its own visits, leaving the suite above it
 * byte for byte as it was. Returns the added code routed, and the helper to
 * put before it when the suite doesn't define one yet ("" otherwise).
 */
export function routeAddedVisits(suiteCode: string, addedCode: string) {
    if (!PAGE_GOTO.test(addedCode)) {
        PAGE_GOTO.lastIndex = 0;
        return { code: addedCode, helper: "" };
    }
    PAGE_GOTO.lastIndex = 0;
    return {
        code: addedCode.replace(PAGE_GOTO, "tfGoto(page, "),
        helper: suiteCode.includes("async function tfGoto(") ? "" : `\n${PAGE_VISIT_HELPER}\n`,
    };
}
