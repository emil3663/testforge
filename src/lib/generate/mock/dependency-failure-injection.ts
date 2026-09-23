import { escapeForDoubleQuotedSelector, escapeForSingleQuotedString } from "./format";
import type { ContentProfile, DependencyKind, DependencyMapEntry } from "./types";

// TFP-085: cookies are recorded by TFP-084 (a real dependency worth
// knowing about), but page.route() intercepts network requests - a cookie
// isn't a routable request, so there's no honest way to "block" one this
// way. Every other kind names a real request TestForge's own introspect
// pass observed, so route() can target it.
const ROUTABLE_KINDS = new Set<DependencyKind>([
    "xhr-fetch",
    "form-action",
    "third-party-script",
    "iframe",
    "redirect",
]);

export function isRoutableDependencyKind(kind: DependencyKind) {
    return ROUTABLE_KINDS.has(kind);
}

// Decision 4 (phase-18-integration-mapping-decision-record.md, revised
// 2026-09-23): earlier the same day this excluded the whole "redirect"
// kind by default as a blanket, unpinpointed guess at "auth-critical."
// Corrected: every generated failure-injection test already runs in its
// own isolated Playwright page/context (playwright.config.ts sets no
// storageState and no shared setup - confirmed, nothing in src/lib/generate
// wires one up), so blocking a redirect inside one test cannot reach any
// other test in the run. The risk that motivated excluding it doesn't
// exist in this codebase today, so there is nothing to exclude - a
// redirect dependency is tested exactly like any other routable one.
// That risk becomes real once Phase 20 introduces a run-wide cached
// storageState shared across every generated test. At that point the
// fix must be pinpointed, not kind-wide: exclude only the specific
// dependency whose host matches Phase 20's configured login URL, not
// every "redirect"-kind entry regardless of what it actually points to.
// That's new work for Phase 20 to scope, not something to guess at here.

// The exact, unescaped title text the generated test below produces -
// reused by discovered-coverage.ts to match this dependency against the
// run's actual executed tests, the same title-matching pattern
// buildActionableElementTitle/buildAccessibilityElementTitle already
// established for functional/accessibility.
export function buildDependencyFailureTitle(entry: DependencyMapEntry) {
    return `dependency failure injection: ${entry.host} [${entry.kind}]`;
}

function pathnameOf(url: string): string {
    try {
        return new URL(url).pathname;
    } catch {
        return "/";
    }
}

// Decision 4 (revised 2026-09-23): every routable dependency, including
// redirects, gets a test by default - see the comment above
// isRoutableDependencyKind's declaration for why the earlier blanket
// exclusion was wrong and what would justify a real one later.
export const DEPENDENCY_FAILURE_INJECTION_NOTE =
    "Reliability: page.route() failure-injection blocks each recorded dependency by (host, path) - see docs/decisions/phase-18-integration-mapping-decision-record.md Decision 4 (revised): every routable dependency gets a test by default, including redirects - each generated test runs in its own isolated Playwright context with no shared storageState today, so blocking one cannot affect any other test in the run. That changes once Phase 20 introduces a run-wide cached storageState; the fix at that point must be pinpointed to the specific dependency matching the configured login URL, not a blanket kind-wide exclusion, and isn't built yet. Cookie-kind dependencies are recorded by introspect but have no generated test here for a separate, mechanical reason - a cookie isn't a routable network request. A form-action test also submits its form once blocked (requestSubmit()) so the block is actually exercised, not just present during an inert page load - still read-only from the target's point of view, since the aborted request never leaves the browser.";

// form-action's request only ever fires on submit, never on page load, so
// a reload-only test would block a dependency that nothing in the test
// actually triggers - a trivial always-pass, not a real check. Submitting
// programmatically (requestSubmit(), not a real user click) still counts
// as read-only from the target's point of view per Decision 2: the route
// is aborted client-side before the request leaves the browser, so the
// live site's server never receives it regardless of what triggered it.
function triggerStepFor(entry: DependencyMapEntry): string {
    if (entry.kind !== "form-action" || !entry.rawValue) {
        return "";
    }

    const formSelector = `form[action="${escapeForDoubleQuotedSelector(entry.rawValue)}"]`;
    return `
    const form = page.locator('${formSelector}').first();
    if (await form.count() > 0) {
      await form.evaluate((el) => (el as HTMLFormElement).requestSubmit());
    }
`;
}

// One test per routable dependency: block it by (host, pathname) - not by
// host alone, which would also catch every other same-host request the
// page depends on, and not by the full sampleUrl, which for an XHR/fetch
// target routinely carries a session token or timestamp query string that
// changes on every real request and would never match again. Asserts only
// that the page didn't break (still responds, still renders a body, no
// uncaught exception) - never a specific fallback UI TestForge can't know
// in advance, per Decision 2.
export function buildDependencyFailureTests(contentProfile: ContentProfile | null): string[] {
    const dependencyMap = contentProfile?.dependencyMap ?? [];

    return dependencyMap
        .filter((entry) => isRoutableDependencyKind(entry.kind))
        .map((entry) => {
            const path = entry.paths[0] ?? "/";
            const escapedPath = escapeForSingleQuotedString(path);
            const title = escapeForSingleQuotedString(buildDependencyFailureTitle(entry));
            const escapedHost = escapeForSingleQuotedString(entry.host);
            const pathname = pathnameOf(entry.sampleUrl);
            const escapedPathname = escapeForSingleQuotedString(pathname);
            const blockedLabel = escapeForSingleQuotedString(`${entry.host}${pathname}`);
            const triggerStep = triggerStepFor(entry);

            return `  test('${title}', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.route(
      (url) => url.host === '${escapedHost}' && url.pathname === '${escapedPathname}',
      (route) => route.abort('failed')
    );

    const response = await page.goto('${escapedPath}', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
${triggerStep}
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    expect(response?.status() ?? 0, 'the page itself should still respond with ${blockedLabel} blocked').toBeLessThan(500);
    await expect(page.locator('body'), 'the page should still render a body, not a blank crash screen').toBeVisible();
    expect(pageErrors, 'no uncaught page errors after blocking ${blockedLabel}: ' + pageErrors.join('; ')).toEqual([]);
  });`;
        });
}
