import { MAX_SESSION_COOKIE_DAYS, SESSION_COOKIE_NAME } from "./mock/cookie-session-checks";
import { PASSIVE_CHECK_STANDARDS, type CheckStandard } from "@/lib/comprehensive/standards";

// Phase 35 (TFP-133, Decision 3): Comprehensive security at the passive
// level. Every check only loads pages and reads what comes back - the
// response headers, the cookies the site set, the rendered page - plus, once
// per run, one request to a path that cannot exist, to see the error page.
// Nothing submits a form, changes data or sends attack-shaped input.
//
// Failures are real exposures: a password field on a plain-HTTP page, a form
// that sends a password to a plain-HTTP address, a password or session token
// in a URL, an error page that shows a stack trace or a server file path.
// Hardening gaps are findings (Phase 34 Decision 3): missing or weak security
// headers, mixed content, a software version in the response headers, and
// session-cookie flags (the Phase 36 rules).
//
// Test bodies are raw strings with __PATH__ (the page, escaped for a
// single-quoted string) and __DETAILS__ (the test's annotations) filled in,
// so their regular expressions reach the generated file exactly as written.

/** The page a missing-page probe reports under, in the per-page table. */
export const PROBE_PAGE = "(missing-page probe)";

export interface SecurityCheckPage {
    escapedPath: string;
    /** `{ annotation: [...] }` with the page and the given standard's tags. */
    details: (standard: CheckStandard) => string;
}

function fill(template: string, page: SecurityCheckPage, standard: CheckStandard): string {
    return template.split("__PATH__").join(page.escapedPath).split("__DETAILS__").join(page.details(standard));
}

const HEADERS_AND_COOKIES = String.raw`    test('__PATH__ sends its security headers and session cookies', __DETAILS__, async ({ page, context }) => {
      const response = await page.goto('__PATH__');
      expect(response, 'no response for __PATH__').not.toBeNull();
      const notAPage = tfNotAPage(response!.status());
      test.skip(notAPage !== null, '__PATH__ ' + notAPage);
      const headers = response!.headers();
      const https = new URL(page.url()).protocol === 'https:';
      const found: string[] = [];
      const csp = headers['content-security-policy'] ?? '';
      if (!csp) {
        found.push('no Content-Security-Policy header on __PATH__');
      } else {
        if (!/object-src\s+'none'/.test(csp)) found.push("the Content-Security-Policy on __PATH__ lacks object-src 'none'");
        if (!/base-uri\s+'none'/.test(csp)) found.push("the Content-Security-Policy on __PATH__ lacks base-uri 'none'");
      }
      if (!/frame-ancestors/.test(csp)) {
        found.push(headers['x-frame-options'] ? '__PATH__ relies on the obsolete X-Frame-Options; its Content-Security-Policy has no frame-ancestors' : 'any site can frame __PATH__: no Content-Security-Policy frame-ancestors (or X-Frame-Options)');
      }
      if ((headers['x-content-type-options'] ?? '').toLowerCase() !== 'nosniff') found.push('no X-Content-Type-Options: nosniff on __PATH__');
      const metaReferrer = page.locator('meta[name="referrer"]');
      const referrer = (headers['referrer-policy'] ?? ((await metaReferrer.count()) > 0 ? await metaReferrer.first().getAttribute('content') : null) ?? '').toLowerCase();
      if (!referrer) found.push('no referrer policy on __PATH__ (no Referrer-Policy header or meta referrer)');
      else if (/unsafe-url|no-referrer-when-downgrade/.test(referrer)) found.push('the referrer policy on __PATH__ (' + referrer + ') sends full URLs to other sites');
      if (https) {
        const hsts = headers['strict-transport-security'] ?? '';
        const maxAge = Number((/max-age=(\d+)/i.exec(hsts) ?? [])[1] ?? 0);
        if (!hsts) found.push('no Strict-Transport-Security header on __PATH__');
        else if (maxAge < 31536000) found.push('Strict-Transport-Security on __PATH__ lasts ' + maxAge + ' seconds, under a year');
      }
      const host = new URL(page.url()).hostname;
      for (const cookie of await context.cookies()) {
        const domain = cookie.domain.replace(/^\./, '');
        if (!(host === domain || host.endsWith('.' + domain)) || !__SESSION_NAME__.test(cookie.name)) continue;
        const named = 'session cookie "' + cookie.name + '" set on __PATH__';
        if (https && !cookie.secure) found.push(named + ' has no Secure attribute');
        if (!cookie.httpOnly) found.push(named + ' has no HttpOnly attribute, so page scripts can read it');
        if (domain !== host) found.push(named + ' is set for ' + cookie.domain + ', so every subdomain of ' + domain + ' receives it');
        const days = cookie.expires > 0 ? (cookie.expires * 1000 - Date.now()) / 86400000 : 0;
        if (days > __MAX_DAYS__) found.push(named + ' stays valid for ' + Math.round(days) + ' days, more than __MAX_DAYS__ (A07:2025 Authentication Failures, CWE-613)');
      }
      for (const description of found) test.info().annotations.push({ type: 'finding', description });
    });`;

const VERSION = String.raw`    test('__PATH__ names no software version in its response headers', __DETAILS__, async ({ page }) => {
      const response = await page.goto('__PATH__');
      expect(response, 'no response for __PATH__').not.toBeNull();
      const headers = response!.headers();
      for (const name of ['server', 'x-powered-by', 'x-aspnet-version', 'x-aspnetmvc-version']) {
        const value = headers[name];
        if (value && /\d/.test(value)) test.info().annotations.push({ type: 'finding', description: name + ': ' + value + ' on __PATH__ names a software version' });
      }
    });`;

const TRANSPORT = String.raw`    test('__PATH__ keeps passwords off plain HTTP', __DETAILS__, async ({ page }) => {
      const response = await page.goto('__PATH__');
      const notAPage = response ? tfNotAPage(response.status()) : null;
      test.skip(notAPage !== null, '__PATH__ ' + notAPage);
      const problems: string[] = [];
      const secure = await page.evaluate(() => window.isSecureContext);
      const fields = await page.locator('input[type="password"]').evaluateAll((elements) => elements.map((element) => (element as HTMLInputElement).name || element.id || 'unnamed'));
      if (!secure && fields.length > 0) problems.push('__PATH__ is served over plain HTTP and has a password field (' + fields.join(', ') + ')');
      if (secure) {
        const targets = await page.locator('form').evaluateAll((forms) => forms.filter((form) => form.querySelector('input[type="password"]')).map((form) => new URL(form.getAttribute('action') || location.href, location.href).href));
        for (const target of targets) {
          const url = new URL(target);
          if (url.protocol === 'http:' && !tfIsLocalHost(url.hostname)) problems.push('a form on __PATH__ sends a password field to the plain-HTTP address ' + target);
        }
      }
      if (new URL(page.url()).protocol === 'https:') {
        const insecure = await page.evaluate(() => Array.from(document.querySelectorAll('img[src], script[src], iframe[src], audio[src], video[src], source[src], embed[src], link[rel~="stylesheet"][href], object[data]'))
          .map((element) => element.getAttribute('src') ?? element.getAttribute('href') ?? element.getAttribute('data') ?? '')
          .map((value) => { try { return new URL(value, location.href); } catch { return null; } })
          .filter((url): url is URL => url !== null && url.protocol === 'http:')
          .map((url) => url.href));
        for (const url of new Set(insecure)) test.info().annotations.push({ type: 'finding', description: '__PATH__ is served over HTTPS but loads ' + url + ' over plain HTTP (mixed content)' });
      }
      expect(problems, 'passwords exposed to plain HTTP: ' + problems.join('; ')).toEqual([]);
    });`;

const URL_SECRETS = String.raw`    test('__PATH__ puts no password or session token in a URL', __DETAILS__, async ({ page }) => {
      const response = await page.goto('__PATH__');
      const notAPage = response ? tfNotAPage(response.status()) : null;
      test.skip(notAPage !== null, '__PATH__ ' + notAPage);
      const problems: string[] = [];
      const chain: string[] = [];
      for (let request = response?.request() ?? null; request; request = request.redirectedFrom()) chain.push(request.url());
      for (const url of chain) {
        const names = tfSensitiveParams(url);
        if (names.length > 0) problems.push('loading __PATH__ went through ' + url + ', which carries ' + names.join(', ') + ' in the URL');
      }
      const links = await page.locator('a[href]').evaluateAll((anchors) => anchors.map((anchor) => (anchor as HTMLAnchorElement).href));
      for (const href of new Set(links)) {
        const names = tfSensitiveParams(href);
        if (names.length > 0) problems.push('a link on __PATH__ to ' + href + ' carries ' + names.join(', ') + ' in its URL');
      }
      const getForms = await page.locator('form').evaluateAll((forms) => forms
        .filter((form) => (form.getAttribute('method') || 'get').toLowerCase() === 'get' && form.querySelector('input[type="password"]'))
        .map((form) => new URL(form.getAttribute('action') || location.href, location.href).href));
      for (const target of getForms) problems.push('a form on __PATH__ would send its password field in the URL (method GET, to ' + target + ')');
      expect(problems, 'secrets in URLs: ' + problems.join('; ')).toEqual([]);
    });`;

const MISSING_PAGE_PROBE = String.raw`    test('a page that cannot exist shows no stack trace or server file path', __DETAILS__, async ({ request }) => {
      // The one request of the passive level that isn't a page load: a single
      // GET to a path that cannot exist, redirects not followed.
      const path = '/testforge-missing-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      const response = await request.get(path, { maxRedirects: 0, failOnStatusCode: false });
      const body = await response.text();
      const leaks = TF_ERROR_LEAKS
        .map(([label, pattern]) => { const match = pattern.exec(body); return match ? label + ' ("' + match[0].trim().slice(0, 120) + '")' : null; })
        .filter((leak): leak is string => leak !== null);
      expect(leaks, 'the error page for ' + path + ' (HTTP ' + response.status() + ') shows ' + leaks.join('; ')).toEqual([]);
    });`;

/** The per-page passive checks, one page load each. */
export function passiveSecurityPageTests(page: SecurityCheckPage): string[] {
    const session = (template: string) => template.split("__SESSION_NAME__").join(SESSION_COOKIE_NAME.toString()).split("__MAX_DAYS__").join(String(MAX_SESSION_COOKIE_DAYS));
    return [
        session(fill(HEADERS_AND_COOKIES, page, { ...PASSIVE_CHECK_STANDARDS.headers, asvs: [...PASSIVE_CHECK_STANDARDS.headers.asvs, ...PASSIVE_CHECK_STANDARDS.cookies.asvs] })),
        fill(VERSION, page, PASSIVE_CHECK_STANDARDS.version),
        fill(TRANSPORT, page, PASSIVE_CHECK_STANDARDS.transport),
        fill(URL_SECRETS, page, PASSIVE_CHECK_STANDARDS.urlSecrets),
    ];
}

/** The run's single missing-page probe. */
export function passiveSecurityRunTests(details: (standard: CheckStandard) => string): string[] {
    return [fill(MISSING_PAGE_PROBE, { escapedPath: PROBE_PAGE, details }, PASSIVE_CHECK_STANDARDS.errorPage)];
}

