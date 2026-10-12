/**
 * Phase 41 (TFP-181, Decision 3, amending Phase 38 Decision 1): the read-only
 * gate also allows interactions whose requests are all GETs and that submit
 * no form - a sort, a filter, a quantity stepper, a link followed - under a
 * request guard. While the guard is armed:
 * - any request whose method isn't GET is aborted before it leaves the
 *   browser;
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
 * Generated code, kept as a raw string like the passive security helpers, so
 * it reaches the generated file exactly as written here.
 */
export const READ_ONLY_GUARD_HELPER = String.raw`// TFP-181 (Phase 41 Decision 3): a read-only test that interacts runs its
// interaction here. Any request other than GET is aborted, and any form
// submission stopped, and either fails the test as a guard breach, named.
async function tfReadOnlyGuarded(page: import('@playwright/test').Page, interact: () => Promise<void>) {
  const breaches: string[] = [];
  await page.exposeBinding('__tfGuardBreach', (_source, what: string) => { breaches.push(what); });
  await page.route('**/*', async (route) => {
    const request = route.request();
    if (request.method() === 'GET') return route.fallback();
    breaches.push(request.method() + ' ' + request.url());
    await route.abort('blockedbyclient');
  });
  const stopSubmissions = () => {
    const scope = window as unknown as { __tfGuardBreach?: (what: string) => void; __tfGuardArmed?: boolean };
    if (scope.__tfGuardArmed) return;
    scope.__tfGuardArmed = true;
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
  await page.addInitScript(stopSubmissions);
  await page.evaluate(stopSubmissions);
  let failure: unknown = null;
  try {
    await interact();
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  } catch (error) {
    failure = error;
  }
  expect(breaches, 'read-only guard breach, aborted: ' + breaches.join('; ') + ' (the read-only gate allows only GET requests and no form submission)').toEqual([]);
  if (failure) throw failure;
}`;
