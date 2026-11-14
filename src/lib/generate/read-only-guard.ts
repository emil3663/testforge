/**
 * Phase 41 (TFP-181, Decision 3, amending Phase 38 Decision 1): the read-only
 * gate also allows interactions whose requests are all GETs and that submit
 * no form - a sort, a filter, a quantity stepper, a link followed - under a
 * request guard. Amended by owner decision, 2026-10-12 (found on the clean Toolshop,
 * which searches with QUERY): "GETs" means the methods HTTP defines as
 * safe - GET, HEAD and QUERY (RFC 10008, a GET with its criteria in the
 * body). While the guard is armed:
 * - any request with another method (POST, PUT, PATCH, DELETE, ...) is
 *   aborted before it leaves the browser;
 * - any form submission is stopped before the page's own handlers see it
 *   (a submit event, or `form.submit()`, which fires none);
 * and either one fails the test as a guard breach, naming the request or the
 * form. The breach is the failure reported even when the interaction then
 * fails for another reason (often the aborted request's own error), so the
 * report says why.
 *
 * The guard is armed after the page has loaded: loading a page is already
 * read-only (Phase 38 Decision 1), and what the guard judges is what the
 * interaction sends. It stays armed across navigations the interaction
 * causes, until the test ends.
 *
 * TFP-182: after the interaction it waits with tfSettle, not
 * `waitForLoadState('networkidle')`, which returns at once once a page has
 * loaded, so a request the interaction starts a moment later (a debounced
 * filter) was never waited for.
 *
 * TFP-199 (run-evidence-sweep backlog; owner decision, 2026-10-13; Phase 41 Gate B's
 * T33): a site's own beacons are aborted too - nothing leaves the browser -
 * but noted, not counted as a breach. On the hosted Toolshops, Cloudflare's
 * analytics fire as a page navigates (measured: one POST of resource type
 * `ping`, from navigator.sendBeacon, and one `xhr` POST, both to
 * /cdn-cgi/rum), so the link-destination check failed on every hosted page.
 * A beacon is any request Chromium types `ping` (sendBeacon, a link's ping
 * attribute), or a non-safe request to a named analytics path. Every other
 * non-safe request, and every form submission, is still a breach.
 *
 * TFP-284 (owner ruling, 2026-11-14): from Playwright 1.62 (Chromium 151), a
 * beacon the route aborts still reaches the server: sendBeacon's, and a
 * fetch with keepalive. So each frame also gets a stub, run in every frame
 * the page has when the guard arms and, as an init script, in every frame
 * after: sendBeacon, and a keepalive fetch with a method but GET, HEAD and
 * QUERY, are stopped in the page and handed to the guard. The guard judges
 * them as it judges the route's (a beacon is noted; anything else is a
 * breach). The route's abort stays, for every other request.
 *
 * Generated code, kept as a raw string like the passive security helpers, so
 * it reaches the generated file exactly as written here.
 */
export const READ_ONLY_GUARD_HELPER = String.raw`// TFP-182: waits until the page's requests have been quiet for quietMs (at most maxMs),
// after an interaction on a page that has already loaded; it never fails the test.
async function tfSettle(page: import('@playwright/test').Page, quietMs = 500, maxMs = 5000) {
  let inFlight = 0;
  let last = Date.now();
  const started = () => { inFlight++; last = Date.now(); };
  const ended = () => { inFlight = Math.max(0, inFlight - 1); last = Date.now(); };
  page.on('request', started);
  page.on('requestfinished', ended);
  page.on('requestfailed', ended);
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    await page.waitForTimeout(100);
    if (inFlight === 0 && Date.now() - last >= quietMs) break;
  }
  page.off('request', started);
  page.off('requestfinished', ended);
  page.off('requestfailed', ended);
}

// TFP-199: analytics paths whose beacons a site sends with ordinary fetch or XHR. Cloudflare's first (measured).
const TF_BEACON_PATHS = ['/cdn-cgi/rum'];

// TFP-181 (Phase 41 Decision 3): a read-only test that interacts runs its
// interaction here. Any request but a safe one (GET, HEAD, QUERY) is aborted, and any form
// submission stopped, and either fails the test as a guard breach, named. TFP-199: a site's
// beacon is aborted too, but noted, not counted as a breach. TFP-284: sendBeacon and a keepalive fetch
// are stopped in the page as well, in every frame, since the route's abort no longer stops them.
async function tfReadOnlyGuarded(page: import('@playwright/test').Page, interact: () => Promise<void>) {
  const breaches: string[] = [];
  const beacons: string[] = [];
  const judge = (method: string, url: string, type: string) => {
    const beacon = type === 'ping' || TF_BEACON_PATHS.some((path) => new URL(url).pathname.startsWith(path));
    (beacon ? beacons : breaches).push(method + ' ' + url + (beacon ? ' (' + type + ')' : ''));
  };
  await page.exposeBinding('__tfGuardBreach', (_source, what: string) => { breaches.push(what); });
  await page.exposeBinding('__tfGuardRequest', (_source, method: string, url: string, type: string) => judge(method, url, type));
  await page.route('**/*', async (route) => {
    const request = route.request();
    if (['GET', 'HEAD', 'QUERY'].includes(request.method())) return route.fallback();
    judge(request.method(), request.url(), request.resourceType());
    await route.abort('blockedbyclient');
  });
  const armFrame = () => {
    const scope = window as unknown as { __tfGuardBreach?: (what: string) => void; __tfGuardRequest?: (method: string, url: string, type: string) => void; __tfGuardArmed?: boolean };
    if (scope.__tfGuardArmed) return;
    scope.__tfGuardArmed = true;
    const stopped = (method: string, url: string, type: string) => scope.__tfGuardRequest?.(method, new URL(url, location.href).href, type);
    Navigator.prototype.sendBeacon = function (url: string | URL) { stopped('POST', String(url), 'ping'); return true; };
    const send = window.fetch;
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : null;
      const method = String(init?.method ?? request?.method ?? 'GET').toUpperCase();
      if ((init?.keepalive ?? request?.keepalive) && !['GET', 'HEAD', 'QUERY'].includes(method)) {
        stopped(method, request ? request.url : String(input), 'fetch');
        return Promise.reject(new TypeError('Failed to fetch'));
      }
      return send.call(window, input, init);
    };
    const name = (form: HTMLFormElement) => {
      const label = form.getAttribute('aria-label') || form.id || form.getAttribute('name') || '';
      const method = (form.getAttribute('method') || 'get').toUpperCase();
      return 'form submission' + (label ? ' "' + label + '"' : '') + ' (' + method + ' ' + new URL(form.getAttribute('action') || location.href, location.href).href + ')';
    };
    window.addEventListener('submit', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      scope.__tfGuardBreach?.(name(event.target as HTMLFormElement));
    }, true);
    HTMLFormElement.prototype.submit = function (this: HTMLFormElement) { scope.__tfGuardBreach?.(name(this)); };
  };
  await page.addInitScript(armFrame);
  await page.evaluate(armFrame);
  for (const frame of page.frames().slice(1)) await frame.evaluate(armFrame).catch(() => undefined); // a frame gone since
  let failure: unknown = null;
  try {
    await interact();
    await tfSettle(page);
  } catch (error) {
    failure = error;
  }
  if (beacons.length > 0) test.info().annotations.push({ type: 'note', description: 'read-only guard: aborted ' + beacons.length + ' site beacon(s), not a breach: ' + [...new Set(beacons)].join('; ') });
  expect(breaches, 'read-only guard breach, aborted: ' + breaches.join('; ') + ' (the read-only gate allows only GET, HEAD and QUERY requests and no form submission)').toEqual([]);
  if (failure) throw failure;
}`;
