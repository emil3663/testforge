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

// Decision 4 (phase-18-integration-mapping-decision-record.md, resolved
// 2026-09-23): auth-critical dependencies are excluded from blanket
// page.route() blocking by default, since blocking a login-flow redirect
// could invalidate every later test in the same run rather than proving
// graceful degradation. "cookie" dependencies (session-setting cookies)
// are already excluded for a separate, mechanical reason - they aren't a
// routable network request at all (see ROUTABLE_KINDS above). "redirect"
// is the one routable kind that's also auth-critical, so it's the only
// entry here; the dependency map doesn't yet distinguish a login-flow
// redirect from an unrelated one (e.g. http->https), so the whole kind is
// excluded by default - the closest granularity currently available. An
// explicit opt-out list (naming specific hosts to test anyway) is the
// likely future shape per the decision record, but isn't built yet - no
// run config currently threads that override into this function.
const AUTH_CRITICAL_KINDS = new Set<DependencyKind>(["redirect"]);

export function isAuthCriticalDependencyKind(kind: DependencyKind) {
    return AUTH_CRITICAL_KINDS.has(kind);
}

// A dependency gets a generated failure-injection test only if page.route()
// can target it at all AND it isn't excluded by Decision 4's auth-critical
// default.
export function isBlockedByDefaultDependencyKind(kind: DependencyKind) {
    return isRoutableDependencyKind(kind) && !isAuthCriticalDependencyKind(kind);
}

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

// Decision 4 (resolved 2026-09-23): auth-critical dependencies are
// excluded from blanket blocking by default. See
// isAuthCriticalDependencyKind above for exactly what that covers today.
export const DEPENDENCY_FAILURE_INJECTION_NOTE =
    "Reliability: page.route() failure-injection blocks each recorded dependency by (host, path) - see docs/decisions/phase-18-integration-mapping-decision-record.md Decision 4 (resolved): auth-critical dependencies are excluded from blanket blocking by default, so a login-flow redirect can't fail every later test in the same run. Concretely today that means redirect-kind dependencies get no generated test - the map doesn't yet distinguish a login redirect from any other, so the whole kind is excluded as the closest available granularity; an explicit opt-out list to test specific ones anyway isn't built yet. Cookie-kind dependencies are recorded by introspect but have no generated test here for a separate, mechanical reason - a cookie isn't a routable network request. A form-action test also submits its form once blocked (requestSubmit()) so the block is actually exercised, not just present during an inert page load - still read-only from the target's point of view, since the aborted request never leaves the browser.";

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
        .filter((entry) => isBlockedByDefaultDependencyKind(entry.kind))
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
