import { isRouteFragment, pagePathOf } from "../../../introspect/routes";
import type { LinkDetail } from "../types";

/** TFP-165: a link to a page of a hash-routed app (#/contact, #!/contact). */
export function isRouteLink(link: LinkDetail) {
    return link.rawHref.startsWith("#") && isRouteFragment(link.rawHref);
}

/** The route as the address bar shows it (Decision 2): /#/contact. */
export function routePathOf(link: LinkDetail) {
    try {
        return pagePathOf(new URL(link.url));
    } catch {
        return link.rawHref;
    }
}

/** The app's start route (#/ or #!/) is where a missing route may legitimately land, so it isn't compared. */
export function isStartRoute(link: LinkDetail) {
    return /^#!?\/?$/.test(link.rawHref);
}

/**
 * TFP-165 (Decisions 3 and 4, approved by Emil, 2026-10-06). The generated
 * helpers: what the app draws for a route - loaded as a fresh document in a
 * page of its own, settled to network idle with a bounded wait, read as text
 * - and, once per run (per worker), what it draws for a route that can't
 * exist. A linked route that draws the same is "not found": the client-side
 * twin of the passive missing-page probe, read-only (page loads only), and
 * independent of the site's wording.
 */
export function buildRouteHelpers(indent: string) {
    const lines = [
        "// TFP-165: what the app draws for a route - a fresh document, settled (bounded), as text.",
        "const tfRouteView = async (route: string): Promise<string> => {",
        "  const view = await page.context().newPage();",
        "  try {",
        "    await view.goto(route, { waitUntil: 'domcontentloaded', timeout: 8000 });",
        "    await view.waitForLoadState('networkidle', { timeout: 4000 }).catch(() => {});",
        "    return (await view.locator('body').innerText()).replace(/\\s+/g, ' ').trim();",
        "  } finally {",
        "    await view.close();",
        "  }",
        "};",
        "// Once per run (per worker): a route that can't exist, and what the app draws for it.",
        "const tfMissingRoute = (route: string): Promise<{ route: string; view: string }> => {",
        "  const url = new URL(route);",
        "  const prefix = url.origin + url.pathname + (url.hash.startsWith('#!') ? '#!/' : '#/');",
        "  const cache = globalThis as unknown as { __tfMissingRoutes?: Map<string, Promise<{ route: string; view: string }>> };",
        "  cache.__tfMissingRoutes ??= new Map();",
        "  let probe = cache.__tfMissingRoutes.get(prefix);",
        "  if (!probe) {",
        "    const missing = prefix + 'testforge-missing-' + Math.random().toString(36).slice(2, 10);",
        "    probe = tfRouteView(missing).then((view) => ({ route: new URL(missing).pathname + new URL(missing).hash, view }));",
        "    cache.__tfMissingRoutes.set(prefix, probe);",
        "  }",
        "  return probe;",
        "};",
    ];
    return lines.map((line) => indent + line).join("\n");
}
