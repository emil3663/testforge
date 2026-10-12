import type { CheckStandard } from "@/lib/comprehensive/standards";
import { TOP10_2025 } from "@/lib/comprehensive/standards";

// Phase 41 (TFP-184, Decision 5): two read-only security probes for
// Comprehensive security.
//
// Known paths (bug 80; ISTQB: error guessing - the paths misconfigured
// servers leak): once per run, one GET to each path below, never following
// a redirect, on the site's origin and on every same-site origin its start
// page calls (Emil, 2026-10-12: the site's own API; the Toolshop's log is
// on its API host). A path leaks when it answers 200 with something that
// isn't an HTML document and has the content its name promises - a log's
// timestamped lines, a .env's assignments, a repository's HEAD - whatever
// its content type (the Toolshop sends its log as text/html), so a
// single-page app's catch-all page, which answers 200 to every path, is
// never mistaken for a leak. A leak is a failure: the file is readable by
// anyone. The list (Emil, 2026-10-12): version control, .env, backups and
// dumps, and common log files under /logs, /log and /storage/logs -
// Laravel's among them, which includes the Toolshop's /logs/laravel.log as
// one case of the pattern.
//
// Guessable ids (bug 82; error guessing): integer ids in the addresses a
// page uses - its own, its links, the API requests it makes - counting up
// under one route (/product/1, /product/2) are a finding, not a failure:
// the next record's address can be guessed, and whether that reaches
// someone else's record needs an authorization test this level can't run
// (OWASP WSTG-ATHZ-04, Testing for Insecure Direct Object References).

export const KNOWN_PATHS = [
    "/.env",
    "/.git/HEAD",
    "/.git/config",
    "/.svn/entries",
    "/.DS_Store",
    "/backup.zip",
    "/backup.tar.gz",
    "/backup.sql",
    "/dump.sql",
    "/database.sql",
    ...["/logs", "/log", "/storage/logs"].flatMap((folder) => ["error.log", "debug.log", "laravel.log"].map((file) => `${folder}/${file}`)),
] as const;

/**
 * Copied from the published sources (see standards.ts for their commits):
 * - Top 10:2025 A01's "List of Mapped CWEs" includes CWE-538 (Insertion of
 *   Sensitive Information into Externally-Accessible File or Directory),
 *   CWE-552 (Files or Directories Accessible to External Parties) and
 *   CWE-639 (Authorization Bypass Through User-Controlled Key).
 * - ASVS 5.0.0 13.4.1 ("deployed ... without any source control metadata,
 *   including the .git or .svn folders, or in a way that these folders are
 *   inaccessible") and 13.4.7 ("only serve files with specific file
 *   extensions to prevent unintentional information, configuration, and
 *   source code leakage"), 5.0/en/0x22-V13-Configuration.md.
 * - Guessable ids carry no ASVS requirement: 8.2.2 (IDOR) is what they
 *   point to, but a passive run can't verify authorization, so tagging it
 *   would claim V8 was tested.
 */
export const PROBE_STANDARDS = {
    knownPaths: { category: TOP10_2025.A01, asvs: ["13.4.1", "13.4.7"], why: "CWE-538 and CWE-552 are mapped to A01" },
    guessableIds: { category: TOP10_2025.A01, asvs: [], why: "CWE-639 is mapped to A01; WSTG-ATHZ-04 context, no authorization tested" },
} satisfies Record<string, CheckStandard>;

/** Helpers the probes share, written once at the top of a Comprehensive security suite. */
export const PROBE_HELPERS = String.raw`// Phase 41 (TFP-184): whether an address is on the same site as the page under
// test - the same host on any port, or the same registrable domain (the last
// two labels, or three under a two-letter country code's short second level,
// as in example.co.uk).
function tfSameSite(url: string, site: string): boolean {
  try {
    const [a, b] = [new URL(url).hostname, new URL(site).hostname];
    if (a === b) return true;
    const domain = (host: string) => { const labels = host.split('.'); const keep = labels.length > 2 && labels[labels.length - 1].length === 2 && labels[labels.length - 2].length <= 3 ? 3 : 2; return labels.slice(-keep).join('.'); };
    return !/^[\d.]+$|:/.test(a) && domain(a) === domain(b);
  } catch {
    return false;
  }
}
`;

const SIGNATURES = String.raw`// What each known path holds when it really leaks, beyond answering 200 with something that isn't a page.
function tfLeakSignature(path: string): RegExp {
  if (path.endsWith('/.env')) return /^\s*[A-Z][A-Z0-9_]*\s*=/m;
  if (path.endsWith('/.git/HEAD')) return /^ref: refs\/|^[0-9a-f]{40}\s*$/m;
  if (path.endsWith('/.git/config')) return /^\[core\]/m;
  if (path.endsWith('/.svn/entries')) return /^\d+\s*$/m;
  if (path.endsWith('/.DS_Store')) return /Bud1/;
  if (path.endsWith('.zip')) return /^PK\x03\x04/;
  if (path.endsWith('.tar.gz')) return /^\x1f\x8b/;
  if (path.endsWith('.sql')) return /\b(CREATE TABLE|INSERT INTO|DROP TABLE)\b|-- (MySQL|MariaDB|PostgreSQL) dump/i;
  return /^\[?\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/m;
}`;

/** The run's known-path probe: one GET per path, per origin, once. */
export function knownPathsTest(details: string, escapedStart: string): string {
    return String.raw`    test('${KNOWN_PATHS.length} known paths that leak (${KNOWN_PATHS.join(", ")}) are not reachable on the site or its own API', ${details}, async ({ page, request }) => {
      // ISTQB: error guessing (the paths misconfigured servers leak).
${SIGNATURES.split("\n").map((line) => `      ${line}`).join("\n")}
      const called: string[] = [];
      page.on('request', (sent) => { if (['xhr', 'fetch'].includes(sent.resourceType())) called.push(sent.url()); });
      await page.goto('${escapedStart}');
      const site = new URL(page.url()).origin;
      const origins = new Set([site, ...called.filter((url) => tfSameSite(url, site)).map((url) => new URL(url).origin)]);
      const paths = ${JSON.stringify(KNOWN_PATHS).replace(/"/g, "'")};
      const leaks: string[] = [];
      for (const origin of origins) {
        for (const path of paths) {
          const response = await request.get(origin + path, { maxRedirects: 0, failOnStatusCode: false, timeout: 10000 }).catch(() => null);
          if (!response || response.status() !== 200) continue;
          const body = (await response.body()).toString('latin1');
          // A page (a catch-all's, an error page) is a document; a leaked file may still be sent as text/html, as the Toolshop's log is.
          const html = /^\s*<(!doctype|html)/i.test(body);
          if (!html && tfLeakSignature(path).test(body)) leaks.push(origin + path + ' answers 200 with its contents ("' + body.replace(/[^\x20-\x7e]+/g, ' ').trim().slice(0, 100) + '")');
        }
      }
      test.info().annotations.push({ type: 'probe', description: 'known paths: ' + paths.length + ' paths on ' + [...origins].join(', ') + ', one GET each' });
      expect(leaks, 'files anyone can read: ' + leaks.join('; ')).toEqual([]);
    });`;
}

const GUESSABLE_IDS = String.raw`    test('__PATH__ uses no guessable sequential ids in its addresses (recorded as a finding)', __DETAILS__, async ({ page }) => {
      // ISTQB: error guessing (ids that count up under one route).
      const urls: string[] = [];
      page.on('request', (sent) => { if (['xhr', 'fetch', 'document'].includes(sent.resourceType())) urls.push(sent.url()); });
      const response = await page.goto('__PATH__');
      const notAPage = response ? tfNotAPage(response.status()) : null;
      test.skip(notAPage !== null, '__PATH__ ' + notAPage);
      urls.push(page.url(), ...(await page.locator('a[href]').evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).href))));
      const ids = new Map<string, Set<string>>();
      const add = (pattern: string, id: string) => ids.set(pattern, new Set([...(ids.get(pattern) ?? []), id]));
      for (const address of new Set(urls)) {
        if (!tfSameSite(address, page.url())) continue;
        const url = new URL(address);
        const hashRoute = /^#!?\//.test(url.hash) ? url.hash.replace(/^#!?/, '').split('?')[0] : '';
        for (const [prefix, route] of [[url.origin, url.pathname], [url.origin + url.pathname + '#', hashRoute]] as const) {
          const segments = route.split('/');
          segments.forEach((segment, index) => {
            const before = segments[index - 1] ?? '';
            if (/^\d{1,9}$/.test(segment) && /^[a-z][a-z_-]*$/i.test(before) && !/^(page|p|v\d+|api|version|year)$/i.test(before)) {
              add(prefix + segments.map((part, at) => (at === index ? ':id' : part)).join('/'), segment);
            }
          });
        }
        for (const [name, value] of url.searchParams) {
          if (/^(id|.*_id|.*[a-z]Id)$/.test(name) && /^\d{1,9}$/.test(value)) add(url.origin + url.pathname + '?' + name + '=:id', value);
        }
      }
      for (const [pattern, found] of ids) {
        if (found.size < 2) continue;
        const shown = [...found].map(Number).sort((a, b) => a - b).slice(0, 5).join(', ') + (found.size > 5 ? ', ...' : '');
        test.info().annotations.push({ type: 'finding', description: pattern + ' on __PATH__ uses sequential integer ids (' + shown + '): the next record\'s address can be guessed; whether it reaches someone else\'s record needs an authorization test (OWASP WSTG-ATHZ-04)' });
      }
    });`;

/** TFP-184's per-page check: guessable ids, as a finding. Needs PROBE_HELPERS and NOT_A_PAGE_HELPER in scope. */
export function guessableIdsTest(page: { escapedPath: string; details: (standard: CheckStandard) => string }): string {
    return GUESSABLE_IDS.split("__PATH__").join(page.escapedPath).split("__DETAILS__").join(page.details(PROBE_STANDARDS.guessableIds));
}
